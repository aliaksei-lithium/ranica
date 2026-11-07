// EditionWorkflow (docs/02-plan.md §3): one instance per reader and day builds the edition in every
// language the reader chose. Steps: [refresh sources] → load → weather → per language: editor
// (Claude, else the no-LLM fallback) → store. Each step is retried on its own.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../env';
import type { Lang } from '../model';
import { fetchForecast, parseWeather, type WeatherFacts } from '../collect/weather';
import { getReader, itemsForUser, nextIssue, saveEdition } from '../db/queries';
import { buildEditorInput, buildFacts, localNow } from '../edition/facts';
import { runEditor, EditorRefusal, type EditorResult } from '../edit/editor';
import { fallbackBrief } from '../edit/fallback';
import { validateBrief } from '../edit/validate';
import { refreshAllSteps } from './source-refresh';

export interface EditionParams {
  userId: number;
  /** Local date YYYY-MM-DD; defaults to "today" in the reader's time zone. */
  date?: string;
  /** Languages to build; default: the reader's edition_langs setting. */
  langs?: Lang[];
  /** Fetch all sources first (manual rebuild). */
  refresh?: boolean;
}

export interface EditionOutput {
  date: string;
  issue: number;
  items: number;
  refreshed: number | null;
  editions: { lang: Lang; editor: string; dropped: string[]; error: string | null; costCents: number | null }[];
}

/** Items from the last 26 hours, at most this many per source, go to the editor. */
const WINDOW_HOURS = 26;
const PER_SOURCE = 10;

export class EditionWorkflow extends WorkflowEntrypoint<Env, EditionParams> {
  async run(event: WorkflowEvent<EditionParams>, step: WorkflowStep): Promise<EditionOutput> {
    const db = this.env.DB;
    const { userId } = event.payload;

    let refreshed: number | null = null;
    if (event.payload.refresh) {
      const r = await refreshAllSteps(db, step);
      refreshed = r.results.reduce((n, x) => n + x.inserted, 0);
    }

    const ctx = await step.do('load', async () => {
      const reader = await getReader(db, userId);
      if (!reader) throw new Error(`no user ${userId}`);
      const now = localNow(new Date(), reader.timezone);
      const date = event.payload.date ?? now.date;
      const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
      const items = await itemsForUser(db, userId, since, PER_SOURCE);
      return { reader, date, generatedAt: now.time, issue: await nextIssue(db, userId, date), items };
    });
    const langs = event.payload.langs?.length ? event.payload.langs : ctx.reader.editionLangs.length ? ctx.reader.editionLangs : [ctx.reader.locale];

    // The raw forecast once; each language gets its own summary line from it.
    const forecast = await step.do('weather', { retries: { limit: 2, delay: '20 seconds', backoff: 'exponential' } }, async () => {
      try {
        return { ok: true as const, json: await fetchForecast(ctx.reader) };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
      }
    });

    const editions: EditionOutput['editions'] = [];
    for (const lang of langs) {
      let wx: WeatherFacts | null = null;
      let weatherError = forecast.ok ? undefined : 'Open-Meteo';
      if (forecast.ok) {
        try {
          wx = parseWeather(forecast.json, ctx.date, lang);
        } catch {
          weatherError = 'Open-Meteo';
        }
      }
      const reader = { ...ctx.reader, locale: lang };
      const input = buildEditorInput(reader, ctx.date, ctx.items, wx);
      const base = this.env.PUBLIC_URL ?? 'ranica.app/today';
      const facts = buildFacts({
        reader, date: ctx.date, issue: ctx.issue, generatedAt: ctx.generatedAt, items: ctx.items,
        weather: wx, weatherError, publicUrl: lang === 'en' ? base : `${base}?lang=${lang}`,
      });

      let edited: (EditorResult & { error: null }) | { error: string } = { error: 'no ANTHROPIC_API_KEY' };
      if (this.env.ANTHROPIC_API_KEY) {
        try {
          edited = await step.do(`editor ${lang}`, { retries: { limit: 1, delay: '1 minute' }, timeout: '10 minutes' }, async () => {
            try {
              return {
                ...(await runEditor(input, { apiKey: this.env.ANTHROPIC_API_KEY!, model: this.env.EDITOR_MODEL, gatewayUrl: this.env.AI_GATEWAY_URL })),
                error: null,
              };
            } catch (e) {
              // A refusal (after the server-side fallback) will not change on retry.
              if (e instanceof EditorRefusal) return { error: e.message };
              throw e;
            }
          });
        } catch (e) {
          edited = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      const llm = edited.error === null ? edited : null;
      const { brief, dropped } = validateBrief(llm ? llm.brief : fallbackBrief(input), {
        items: new Set(facts.items.map((i) => i.id)),
        events: new Set(facts.events.map((e) => e.id)),
        tasks: new Set(facts.tasks.map((t) => t.id)),
        cards: new Set(facts.cards.map((c) => c.id)),
        channels: new Set(facts.telegram.map((t) => t.channel)),
      });

      await step.do(`store ${lang}`, () =>
        saveEdition(db, {
          userId, date: ctx.date, lang, issue: ctx.issue, edition: { facts, brief },
          model: llm?.model ?? 'fallback', tokensIn: llm?.tokensIn ?? null, tokensOut: llm?.tokensOut ?? null,
          costCents: llm?.costCents ?? null, error: edited.error, generatedAt: new Date().toISOString(),
        }),
      );
      editions.push({ lang, editor: llm?.model ?? 'fallback', dropped, error: edited.error, costCents: llm?.costCents ?? null });
    }

    return { date: ctx.date, issue: ctx.issue, items: ctx.items.length, refreshed, editions };
  }
}
