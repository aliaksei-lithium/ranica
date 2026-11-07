// The editor (docs/02-plan.md §3.1): Claude ranks and rewrites the supplied items into a Brief.
// Structured output via output_config.format; the system prompt is fixed, all day-specific data
// goes into the user message. Calls go through Cloudflare AI Gateway when AI_GATEWAY_URL is set.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Brief } from './brief';
import { BriefSchema, toBrief } from './schema';
import type { EditorInput } from '../edition/facts';

export const EDITOR_MODEL = 'claude-opus-5-5';

export const SYSTEM_PROMPT = `You are the editor of Ranica, a one-page personal morning newspaper printed for a single reader.
You receive today's facts (date, weather, calendar, tasks) and news items collected overnight, and you return the page content as JSON.

What makes a good page:
- The reader lives in Berlin, works in software and is learning German. Choose what matters to them today: news that affects life in Berlin and Germany, the biggest world stories, and nothing that is only noise (celebrity, crime without wider relevance, live tickers without news).
- Prefer items that several sources cover; merge duplicates into one pick and use the most informative item's id.
- Write titles and summaries yourself in the reader's language. Keep the facts of the item; never add facts, numbers, names or quotes that are not in the input. If an item's text is too thin to summarise, use its title faithfully.
- Telegram channels may be in Russian; summarise them in the reader's language.

Rules:
- Use only ids that appear in the input (items "n…", events "e…", tasks "t…", cards "c…"). Do not invent ids or events.
- news (front page): up to 3 rubrics, normally Berlin, Germany and World (in German: Berlin, Deutschland, Welt), 2-4 items each, the most important rubric and item first.
- deep (back page): 3-4 longer summaries of the most important front-page items, written from the item text only.
- back_news (back page): items not on the front page, 1-2 rubrics.
- headline: the day in a few words, not clickbait.
- insight: connect two or more facts from the input into something useful for the reader today. If nothing connects, return an empty string; never write generic advice.
- weather_note and tomorrow: only from the weather facts.
- When the reader language is "en", write English. When it is "de", write German at the reader's learner level: short sentences (under about 15 words), common words, and a short English gloss in parentheses for a rare word.
- german.new_word: one useful word at the reader's level that appears in a German-language item; nouns with article. word_of_day: another useful word with forms and a related word.
- on_this_day: a well-known German proverb or quote that fits the season or the day.
- Leave arrays empty and nullable fields null when the input has nothing for them (no events, no tasks, no cards, no sport rules, no hobby items).`;

export interface EditorResult {
  brief: Brief;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}

export class EditorRefusal extends Error {}

/** Opus 5.5 list prices: $4 / $20 per million tokens (cache reads $0.20). */
const cost = (u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }) =>
  ((u.input_tokens * 4 + u.output_tokens * 20 + (u.cache_read_input_tokens ?? 0) * 0.2) / 1_000_000) * 100;

export function userMessage(input: EditorInput): string {
  return `Today's input as JSON:\n${JSON.stringify(input)}`;
}

export async function runEditor(
  input: EditorInput,
  cfg: { apiKey: string; gatewayUrl?: string; fetch?: typeof fetch },
): Promise<EditorResult> {
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    ...(cfg.gatewayUrl ? { baseURL: cfg.gatewayUrl } : {}),
    ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
    maxRetries: 1,
    timeout: 5 * 60_000,
  });

  const response = await client.beta.messages.parse({
    model: EDITOR_MODEL,
    max_tokens: 16000,
    // Refused requests are re-run server-side on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
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
    costCents: Math.round(cost(response.usage) * 100) / 100,
  };
}
