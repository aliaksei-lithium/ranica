// Facts for one edition (src/model.ts) plus the editor's view of the same day: the items with
// their text. Pure functions; the EditionWorkflow loads the inputs from D1 and Open-Meteo.
import type { Facts, Lang } from '../model';
import type { UserItem } from '../db/queries';
import type { WeatherFacts } from '../collect/weather';
import { SOURCES } from '../collect/sources';
import { clip } from '../collect/text';

export interface Reader {
  id: number;
  name: string;
  editionTitle: string | null;
  locale: Lang;
  learnerLevel: string | null;
  timezone: string;
  city: string;
  lat: number;
  lon: number;
  wakeTime: string;
  contextMd: string;
}

/** An item as the editor sees it. `id` is the "n<row id>" used in the Brief. */
export interface EditorItem {
  id: string;
  source: string;
  rubric: string | null;
  title: string;
  body: string;
  published: string | null;
}

export interface EditorInput {
  lang: Lang;
  learnerLevel: string | null;
  date: string;
  weekday: string;
  city: string;
  readerName: string;
  context: string;
  weather: WeatherFacts['forEditor'] | null;
  items: EditorItem[];
  telegram: { channel: string; items: EditorItem[] }[];
}

const TELEGRAM = new Map(SOURCES.flatMap((s) => (s.kind === 'telegram' ? [[s.id, `@${s.channel}`] as const] : [])));

/** Local calendar date and HH:MM of `now` in a time zone. */
export function localNow(now: Date, timezone: string): { date: string; time: string; hour: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: Number(p.hour) };
}

const itemId = (i: UserItem) => `n${i.id}`;
const toEditorItem = (i: UserItem): EditorItem => ({
  id: itemId(i), source: i.source, rubric: i.rubric, title: i.title, body: clip(i.body, 500), published: i.publishedAt,
});

export function buildEditorInput(reader: Reader, date: string, items: UserItem[], weather: WeatherFacts | null): EditorInput {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const news = items.filter((i) => !TELEGRAM.has(i.sourceId));
  const channels = [...TELEGRAM].map(([sourceId, channel]) => ({
    channel,
    items: items.filter((i) => i.sourceId === sourceId).map(toEditorItem),
  })).filter((c) => c.items.length);
  return {
    lang: reader.locale,
    learnerLevel: reader.learnerLevel,
    date,
    weekday,
    city: reader.city,
    readerName: reader.name,
    context: reader.contextMd,
    weather: weather?.forEditor ?? null,
    items: news.map(toEditorItem),
    telegram: channels,
  };
}

export function buildFacts(opts: {
  reader: Reader;
  date: string;
  issue: number;
  generatedAt: string;
  items: UserItem[];
  weather: WeatherFacts | null;
  weatherError?: string;
  publicUrl: string;
}): Facts {
  const { reader, weather } = opts;
  const telegramCounts = new Map<string, number>();
  for (const i of opts.items) {
    const ch = TELEGRAM.get(i.sourceId);
    if (ch) telegramCounts.set(ch, (telegramCounts.get(ch) ?? 0) + 1);
  }
  return {
    lang: reader.locale,
    date: opts.date,
    issue: opts.issue,
    city: reader.city,
    readerName: reader.name,
    editionTitle: reader.editionTitle ?? '',
    sun: weather?.sun ?? null,
    countdowns: [],
    weather: weather?.weather ?? null,
    events: [],
    tasks: [],
    // Telegram posts link to the article they announce when there is one.
    items: opts.items.map((i) => ({ id: itemId(i), source: TELEGRAM.get(i.sourceId) ?? i.source, url: i.link ?? i.url })),
    cards: [],
    telegram: [...telegramCounts].map(([channel, posts]) => ({ channel, posts })),
    week: (weather?.week ?? []).map((w) => ({ date: w.date, hi: w.hi, lo: w.lo, sky: w.sky, events: 0, calendar: '', due: null })),
    hourly: weather?.hourly ?? [],
    upcoming: [],
    weekWords: [],
    generatedAt: opts.generatedAt,
    sourcesCount: new Set(opts.items.map((i) => i.sourceId)).size + (weather ? 1 : 0),
    url: opts.publicUrl,
    unavailable: weather ? {} : { weather: opts.weatherError ?? 'Open-Meteo' },
  };
}
