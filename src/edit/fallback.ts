// No-LLM editor (docs/02-plan.md §3.1, last link of the fallback chain): facts only, newest items
// per rubric with their own titles and teasers. Used without an API key or when Claude fails.
import type { Brief, NewsPick } from './brief';
import type { EditorInput, EditorItem } from '../edition/facts';
import { clip } from '../collect/text';

const RUBRICS = { en: { Berlin: 'Berlin', Germany: 'Germany', World: 'World' }, de: { Berlin: 'Berlin', Germany: 'Deutschland', World: 'Welt' } };

const newest = (a: EditorItem, b: EditorItem) => (b.published ?? '').localeCompare(a.published ?? '');

export function fallbackBrief(input: EditorInput): Brief {
  const R = RUBRICS[input.lang];
  const used = new Set<string>();
  const pick = (rubric: keyof typeof R, n: number, pool = input.items): NewsPick[] =>
    pool
      .filter((i) => (i.rubric ?? 'Berlin') === rubric && !used.has(i.id))
      .sort(newest)
      .slice(0, n)
      .map((i) => (used.add(i.id), { rubric: R[rubric], item_id: i.id, title: clip(i.title, 100), summary: clip(i.body, 200) }));

  const news = [...pick('Berlin', 3), ...pick('Germany', 3)];
  const backNews = [...pick('World', 4)];
  const top = news[0];
  const de = input.lang === 'de';

  return {
    headline: clip(top?.title ?? (de ? 'Guten Morgen' : 'Good morning'), 60),
    weather_note: '',
    agenda: [],
    tasks: [],
    news,
    telegram_digest: input.telegram.map((c) => ({
      channel: c.channel,
      summary: de ? `${c.items.length} ${c.items.length === 1 ? 'Beitrag' : 'Beiträge'}` : `${c.items.length} ${c.items.length === 1 ? 'post' : 'posts'}`,
      points: [...c.items].sort(newest).slice(0, 4).map((i) => clip(i.title, 140)),
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
