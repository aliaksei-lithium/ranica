// The editor's structured output (docs/02-plan.md §3.1) as a zod schema; the SDK turns it into the
// JSON schema sent in output_config.format. Lengths are stated in descriptions because structured
// outputs do not enforce string lengths; validate.ts clips and drops unknown ids afterwards.
import { z } from 'zod';
import type { Brief } from './brief';

const newsPick = z.object({
  rubric: z.string().describe('One rubric name from the list for the reader language, e.g. Germany (en) or Deutschland (de)'),
  item_id: z.string().describe('id of an input item, e.g. "n12"'),
  title: z.string().describe('Headline in the reader language, at most 90 characters'),
  summary: z.string().describe('One or two sentences, at most 180 characters: what happened and its outcome or the stated view'),
});

// Kept small on purpose: structured outputs compile the schema into a grammar with a size limit
// ("compiled grammar is too large", 2026-11-07). So no nullable objects (an empty string means
// "none"), and no fields without input yet (agenda, tasks, vocabulary cards, sport, hobby): toBrief
// fills those. Add them back here when calendar, tasks and vocabulary arrive. weather_note is not
// written any more (review 2026-11-08: less weather on the page).
const word = z.object({
  de: z.string().describe('German word, nouns with article; empty string if none'),
  en: z.string(),
  example: z.string().describe('A simple German example sentence'),
});

export const BriefSchema = z.object({
  headline: z.string().describe('The day in at most 60 characters; becomes the page title'),
  news: z.array(newsPick).describe('Front page: up to 4 rubrics with 2-3 items each, most important first; title at most 70 characters, summary one sentence of at most 140 characters'),
  briefs: z
    .array(z.object({
      rubric: z.string(),
      item_id: z.string(),
      text: z.string().describe('What happened and its outcome or meaning, one or two lines, at most 160 characters'),
    }))
    .describe('4-8 stories with real news value, not used in news, grouped by rubric, most important first'),
  telegram_digest: z
    .array(z.object({
      channel: z.string().describe('Channel as given, e.g. "@zerkalo_io"'),
      summary: z.string().describe("One line (at most 110 characters) about what the channel covered, in the channel's own language"),
      points: z.array(z.string()).describe("3-6 bullet points, each at most 140 characters, in the channel's own language"),
    }))
    .describe('One entry per input Telegram channel'),
  insight: z.string().describe('2-4 sentences, at most 400 characters, connecting facts from the input; empty rather than generic'),
  new_word: word.extend({ from_item_id: z.string() }).describe('One useful B1 word that appears in a German input item'),
  on_this_day: z.object({ text: z.string(), author: z.string() })
    .describe('A well-known German proverb or quote that fits the day; author or "Sprichwort"/"German proverb"'),
  tomorrow: z.string().describe('At most 60 characters about tomorrow, from the weather facts'),
  deep: z
    .array(z.object({ rubric: z.string(), item_id: z.string(), title: z.string(), body: z.string().describe('4-6 sentences, at most 650 characters, only from the item text') }))
    .describe('Front page: one longer article for the first Germany item and one for the first World item, same item_id as that news item'),
  back_news: z.array(newsPick).describe('Back page: 2-4 rubrics with 3-5 items each, not used on the front page or in briefs'),
  word_of_day: word.extend({ extra: z.string().describe('Plural or forms, one related word') }),
  glossary: z
    .array(z.object({ de: z.string(), en: z.string() }))
    .describe('German edition only: 10-15 hard words or phrases from the German text on this page, base form, nouns with article; empty for English'),
});

export type BriefOutput = z.infer<typeof BriefSchema>;

/** The editor's output as a full Brief: fields the schema leaves out are empty. */
export function toBrief(o: BriefOutput): Brief {
  const { new_word, on_this_day, word_of_day, ...rest } = o;
  return {
    ...rest,
    weather_note: '',
    agenda: [],
    tasks: [],
    sport: null,
    hobby_fact: null,
    german: { cards: [], new_word: new_word.de ? new_word : null },
    on_this_day: on_this_day.text ? { text: on_this_day.text, ...(on_this_day.author ? { author: on_this_day.author } : {}) } : null,
    word_of_day: word_of_day.de ? word_of_day : null,
  };
}
