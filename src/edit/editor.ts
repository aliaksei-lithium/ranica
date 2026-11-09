// The editor (docs/02-plan.md §3.1): Claude ranks and rewrites the supplied items into a Brief.
// Structured output via output_config.format; the system prompt is fixed, all day-specific data
// goes into the user message. Calls go through Cloudflare AI Gateway when AI_GATEWAY_URL is set.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Brief } from './brief';
import { BriefSchema, toBrief } from './schema';
import type { EditorInput } from '../edition/facts';

/** Default editor model; override with the EDITOR_MODEL var (e.g. claude-haiku-5-5 for the cheapest run). */
export const EDITOR_MODEL = 'claude-sonnet-5-5';

/** List prices in $ per million tokens: input, output, cache read. Unknown models are costed as Opus. */
const PRICES: Record<string, [number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
};

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`); Haiku has none. */
const SERVER_FALLBACKS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1']);

export const SYSTEM_PROMPT = `You are the editor of Ranica, a one-page personal morning newspaper printed for a single reader.
You receive today's facts (date, weather, calendar, tasks) and news items collected overnight, and you return the page content as JSON.

What makes a good page:
- The reader lives in Berlin, works in software and is learning German. Choose what matters to them today. Priorities, in order: politics (Berlin, Germany, Europe), local Berlin news, Berlin transport (BVG, S-Bahn, U-Bahn, trams, roads, strikes, closures, construction), business and finance (markets, interest rates, big companies, the Berlin economy), and the biggest world stories. Leave out noise (celebrity, crime without wider relevance, live tickers without news).
- Quality over quantity: the front page should read calmly. Every item must matter to the reader; leave out sport results, gossip and trivia unless they are big news.
- Prefer items that several sources cover; merge duplicates into one pick and use the most informative item's id.
- Write titles and summaries yourself in the reader's language. Keep the facts of the item; never add facts, numbers, names or quotes that are not in the input. If an item's text is too thin to summarise, use its title faithfully.
- Give the point, not just the event: where the item states an outcome, a consequence, what happens next, or the author's or a named person's view, say it (attributed, e.g. "the FAZ calls it…", "critics say…"). Never invent an opinion or outcome that the item does not contain.
- Never repeat a story anywhere on the page, not even from a different source or in different words: each story appears exactly once (in news, briefs or back_news).
- Russian and Belarusian content stays in its own language: write the Telegram digest (summary and points) in the language of the channel's posts, not in the reader's language.

Rules:
- Use only ids that appear in the input (items "n…", events "e…", tasks "t…", cards "c…"). Do not invent ids or events.
- Rubric names, exactly one of these per item. Reader language "en": Berlin, Transport, Germany, World, Business. Reader language "de": Berlin, Verkehr, Deutschland, Welt, Wirtschaft. Use Transport/Verkehr only when there are transport items.
- news (front page): up to 4 rubrics, 2-3 items each, the most important rubric and item first. A title of at most 70 characters and a summary of one or two sentences (at most 180 characters) with the point of the story.
- deep (front page): exactly one longer article (4-6 sentences, at most 650 characters) for the first item of the Germany rubric and one for the first item of the World rubric (Deutschland, Welt in German); same item_id as that news item. It is printed on the front page in place of that item's short summary, so it must stand alone. Write it from the item text only.
- briefs (front page): 4-8 more stories, not used in news, each in one or two lines (at most 160 characters): what happened and its outcome or meaning. Only ones with real news value (a decision, a change, a number that matters), grouped by rubric.
- back_news (back page): 2-4 rubrics with 3-5 items each, stories not used in news, deep or briefs.
- headline: the day in a few words, not clickbait.
- insight: connect two or more facts from the input into something useful for the reader today. If nothing connects, return an empty string; never write generic advice.
- tomorrow: only from the weather facts.
- When the reader language is "en", write English.
- When it is "de", the reader is at B1 and wants to read German news almost like a native: write natural German newspaper language, simplified only a little (split very long sentences, prefer a common word where a rare one adds nothing), without glosses in parentheses. Then fill glossary with 10-15 words or phrases from your German text on this page that are hard at B1: compound nouns, political, legal and economic terms, idioms. Base form, nouns with article; en is a short English meaning. For "en" leave glossary empty.
- new_word: one useful word at the reader's level that appears in a German-language item; nouns with article. word_of_day: another useful word with forms and a related word.
- on_this_day: a well-known German proverb or quote that fits the season or the day.
- Leave a field as an empty string when the input has nothing for it.`;

export interface EditorResult {
  brief: Brief;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}

export class EditorRefusal extends Error {}

function costCents(model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }): number {
  const [i, o, c] = PRICES[model] ?? PRICES['claude-opus-5-5']!;
  return Math.round(((u.input_tokens * i + u.output_tokens * o + (u.cache_read_input_tokens ?? 0) * c) / 1_000_000) * 100 * 100) / 100;
}

export function userMessage(input: EditorInput): string {
  return `Today's input as JSON:\n${JSON.stringify(input)}`;
}

export async function runEditor(
  input: EditorInput,
  cfg: { apiKey: string; model?: string; gatewayUrl?: string; fetch?: typeof fetch },
): Promise<EditorResult> {
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    ...(cfg.gatewayUrl ? { baseURL: cfg.gatewayUrl } : {}),
    ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
    maxRetries: 1,
    timeout: 5 * 60_000,
  });

  const model = cfg.model || EDITOR_MODEL;
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    // Refused requests are re-run server-side on Anthropic's recommended fallback model.
    ...(SERVER_FALLBACKS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    output_config: { effort: 'medium', format: betaZodOutputFormat(BriefSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage(input) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new EditorRefusal(`refused (${response.stop_details?.category ?? 'no category'})`);
  }
  if (response.stop_reason === 'max_tokens') throw new Error('editor output hit max_tokens');
  if (!response.parsed_output) throw new Error('editor output did not match the schema');

  return {
    brief: toBrief(response.parsed_output),
    model: response.model,
    tokensIn: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0),
    tokensOut: response.usage.output_tokens,
    costCents: costCents(model, response.usage),
  };
}
