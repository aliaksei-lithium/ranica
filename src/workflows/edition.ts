// EditionWorkflow (docs/02-plan.md §3): one instance per reader per day. Steps: load the reader and
// items, weather, editor (Claude, else the no-LLM fallback), store. Each step is retried on its own.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../env';
import { fetchWeather, type WeatherFacts } from '../collect/weather';
import { getReader, itemsForUser, nextIssue, saveEdition } from '../db/queries';
import { buildEditorInput, buildFacts, localNow } from '../edition/facts';
import { runEditor, EditorRefusal, type EditorResult } from '../edit/editor';
import { fallbackBrief } from '../edit/fallback';
import { validateBrief } from '../edit/validate';

export interface EditionParams {
  userId: number;
  /** Local date YYYY-MM-DD; defaults to "today" in the reader's time zone. */
  date?: string;
}

export interface EditionOutput {
  date: string;
  issue: number;
  editor: string;
  items: number;
  dropped: string[];
  error: string | null;
  costCents: number | null;
}

/** Items from the last 26 hours, at most this many per source, go to the editor. */
const WINDOW_HOURS = 26;
const PER_SOURCE = 12;

export class EditionWorkflow extends WorkflowEntrypoint<Env, EditionParams> {
  async run(event: WorkflowEvent<EditionParams>, step: WorkflowStep): Promise<EditionOutput> {
    const db = this.env.DB;
    const { userId } = event.payload;

    const ctx = await step.do('load', async () => {
      const reader = await getReader(db, userId);
      if (!reader) throw new Error(`no user ${userId}`);
      const now = localNow(new Date(), reader.timezone);
      const date = event.payload.date ?? now.date;
      const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
      const items = await itemsForUser(db, userId, since, PER_SOURCE);
      return { reader, date, generatedAt: now.time, issue: await nextIssue(db, userId, date), items };
    });

    const weather = await step.do('weather', { retries: { limit: 2, delay: '20 seconds', backoff: 'exponential' } }, async () => {
      try {
        return { ok: true as const, data: await fetchWeather(ctx.reader, ctx.date, ctx.reader.locale) };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
      }
    });
    const wx: WeatherFacts | null = weather.ok ? weather.data : null;

    const input = buildEditorInput(ctx.reader, ctx.date, ctx.items, wx);
    const facts = buildFacts({
      reader: ctx.reader, date: ctx.date, issue: ctx.issue, generatedAt: ctx.generatedAt, items: ctx.items,
      weather: wx, weatherError: weather.ok ? undefined : 'Open-Meteo', publicUrl: this.env.PUBLIC_URL ?? 'ranica.app/today',
    });

    let edited: (EditorResult & { error: null }) | { error: string } = { error: 'no ANTHROPIC_API_KEY' };
    if (this.env.ANTHROPIC_API_KEY) {
      try {
        edited = await step.do('editor', { retries: { limit: 1, delay: '1 minute' }, timeout: '10 minutes' }, async () => {
          try {
            return { ...(await runEditor(input, { apiKey: this.env.ANTHROPIC_API_KEY!, model: this.env.EDITOR_MODEL, gatewayUrl: this.env.AI_GATEWAY_URL })), error: null };
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
    const raw = llm ? llm.brief : fallbackBrief(input);
    const { brief, dropped } = validateBrief(raw, {
      items: new Set(facts.items.map((i) => i.id)),
      events: new Set(facts.events.map((e) => e.id)),
      tasks: new Set(facts.tasks.map((t) => t.id)),
      cards: new Set(facts.cards.map((c) => c.id)),
      channels: new Set(facts.telegram.map((t) => t.channel)),
    });

    await step.do('store', () =>
      saveEdition(db, {
        userId, date: ctx.date, issue: ctx.issue, edition: { facts, brief },
        model: llm?.model ?? 'fallback', tokensIn: llm?.tokensIn ?? null, tokensOut: llm?.tokensOut ?? null,
        costCents: llm?.costCents ?? null, error: edited.error, generatedAt: new Date().toISOString(),
      }),
    );

    return {
      date: ctx.date, issue: ctx.issue, editor: llm?.model ?? 'fallback', items: ctx.items.length,
      dropped, error: edited.error, costCents: llm?.costCents ?? null,
    };
  }
}
