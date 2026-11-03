// Facts collected before the editor runs (calendar, tasks, weather, items, vocab).
// In M1 the collectors in src/collect/ produce these; in M0 they are fake (src/fake/).
import type { Brief } from './edit/brief';

export type Lang = 'en' | 'de';

/** Block ids from the design brief §4. */
export type BlockId =
  | 'masthead' | 'sun' | 'weather' | 'today' | 'sport' | 'german'
  | 'news' | 'insight' | 'hobby' | 'onthisday' | 'footer';

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
  weather: { max: number; summary: string; glyph: 'sun' | 'cloud' | 'rain' | 'snow' } | null;
  events: { id: string; time: string; title: string; durationMin?: number; place?: string }[];
  tasks: { id: string; title: string }[];
  items: { id: string; source: string; url: string }[];
  cards: { id: string; de: string; en: string }[];
  generatedAt: string;
  sourcesCount: number;
  url: string;
  /** Blocks whose data failed, with the one-line reason shown instead of the block. */
  unavailable: Partial<Record<BlockId, string>>;
}

export interface Edition {
  facts: Facts;
  brief: Brief;
}
