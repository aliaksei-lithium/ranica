// No-LLM editor (docs/02-plan.md §3.1, last link of the fallback chain): facts only, newest items
// per rubric with their own titles and teasers, then one-liners. Used without an API key or when
// Claude fails. Telegram posts stay in their own language.
import type { Brief, NewsPick } from './brief';
import type { EditorInput, EditorItem } from '../edition/facts';
import { clip } from '../collect/text';

const RUBRICS = {
  en: { Berlin: 'Berlin', Germany: 'Germany', World: 'World', Business: 'Business' },
  de: { Berlin: 'Berlin', Germany: 'Deutschland', World: 'Welt', Business: 'Wirtschaft' },
};
type Key = keyof (typeof RUBRICS)['en'];

const newest = (a: EditorItem, b: EditorItem) => (b.published ?? '').localeCompare(a.published ?? '');
/** Sources without a fixed rubric (Berliner Zeitung) count as Berlin. */
const rubricOf = (i: EditorItem): Key => ((i.rubric ?? 'Berlin') in RUBRICS.en ? (i.rubric ?? 'Berlin') : 'Berlin') as Key;

export function fallbackBrief(input: EditorInput): Brief {
  const R = RUBRICS[input.lang];
  const used = new Set<string>();
  const pool = [...input.items].sort(newest);
  const pick = (rubric: Key, n: number): NewsPick[] =>
    pool
      .filter((i) => rubricOf(i) === rubric && !used.has(i.id))
      .slice(0, n)
      .map((i) => (used.add(i.id), { rubric: R[rubric], item_id: i.id, title: clip(i.title, 80), summary: clip(i.body, 120) }));

  const news = [...pick('Berlin', 4), ...pick('Germany', 4), ...pick('World', 3), ...pick('Business', 3)];
  const briefs = (['Berlin', 'Germany', 'Business', 'World'] as Key[]).flatMap((rubric) =>
    pool
      .filter((i) => rubricOf(i) === rubric && !used.has(i.id))
      .slice(0, 5)
      .map((i) => (used.add(i.id), { rubric: R[rubric], item_id: i.id, text: clip(i.title, 100) })),
  );
  const backNews = [...pick('World', 4), ...pick('Business', 3), ...pick('Germany', 3), ...pick('Berlin', 3)];
  const top = news[0];
  const de = input.lang === 'de';

  return {
    headline: clip(top?.title ?? (de ? 'Guten Morgen' : 'Good morning'), 60),
    weather_note: '',
    agenda: [],
    tasks: [],
    news,
    briefs,
    telegram_digest: input.telegram.map((c) => ({
      channel: c.channel,
      summary: c.items.length === 1 ? '1 пост' : `${c.items.length} постов`,
      points: [...c.items].sort(newest).slice(0, 5).map((i) => clip(i.title, 140)),
    })),
    insight: '',
    sport: null,
    german: { cards: [], new_word: null },
    hobby_fact: null,
    on_this_day: null,
    tomorrow: input.weather?.tomorrow ?? '',
    deep: [],
    back_news: backNews,
    word_of_day: null,
  };
}
