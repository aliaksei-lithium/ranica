// Facts collected before the editor runs (calendar, tasks, weather, items, vocab).
// In M1 the collectors in src/collect/ produce these; in M0 they are fake (src/fake/).
import type { Brief } from './edit/brief';

export type Lang = 'en' | 'de';

/** Block ids from the design brief §4, plus the back page blocks (design/pages/back-page-*). */
export type BlockId =
  | 'masthead' | 'sun' | 'weather' | 'today' | 'sport' | 'german' | 'hobby' | 'onthisday'
  | 'news' | 'newsextra' | 'brief' | 'telegram' | 'qr' | 'insight' | 'footer'
  | 'week' | 'hours' | 'depth' | 'world' | 'digest' | 'upcoming' | 'words';

export interface Facts {
  lang: Lang;
  /** ISO date of the edition, e.g. 2026-11-03. */
  date: string;
  issue: number;
  city: string;
  readerName: string;
  /** The reader's own title under the masthead, e.g. "Утренний Алексей". */
  editionTitle: string;
  sun: { sunrise: string; sunset: string; dayMinutes: number; deltaMinutes: number } | null;
  countdowns: { label: string; days: number }[];
  weather: { max: number; summary: string } | null;
  events: { id: string; time: string; title: string; durationMin?: number; place?: string }[];
  tasks: { id: string; title: string; done?: boolean }[];
  items: { id: string; source: string; url: string; minutes?: number }[];
  cards: { id: string; de: string; en: string }[];
  telegram: { channel: string; posts: number }[];
  /** Back page. */
  week: { date: string; hi: number; lo: number; sky: string; events: number; calendar: string; due: string | null }[];
  hourly: { hour: string; temp: number; feels: number; rainPct: number; windMs: number }[];
  upcoming: { date: string; title: string; note?: string }[];
  weekWords: { de: string; en: string }[];
  generatedAt: string;
  sourcesCount: number;
  /** Public address of the web edition, without scheme, e.g. "ranica.app/today". */
  url: string;
  /** Blocks whose data failed: the source name shown in the "unavailable" line. */
  unavailable: Partial<Record<BlockId, string>>;
}

export interface Edition {
  facts: Facts;
  brief: Brief;
}
