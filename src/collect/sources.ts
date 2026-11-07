// The M1 sources (docs/02-plan.md §6.1). In M1 this list seeds the D1 `source` table;
// until then it is the single place the collectors and the probe read from.

export type Rubric = 'Germany' | 'Berlin' | 'World' | 'Business';

export interface RssSource {
  kind: 'rss';
  id: string;
  /** Source tag printed next to each item. */
  name: string;
  url: string;
  /** Fixed rubric, or undefined when the feed mixes sections and the editor assigns one. */
  rubric?: Rubric;
}

export interface TelegramSource {
  kind: 'telegram';
  id: string;
  name: string;
  /** Public channel username without @. */
  channel: string;
  /** Prefer article links on this host (see parseTelegram). */
  linkHost?: string;
}

export type Source = RssSource | TelegramSource;

export const SOURCES: Source[] = [
  { kind: 'rss', id: 'tagesschau-inland', name: 'tagesschau', url: 'https://www.tagesschau.de/inland/index~rss2.xml', rubric: 'Germany' },
  { kind: 'rss', id: 'tagesschau-ausland', name: 'tagesschau', url: 'https://www.tagesschau.de/ausland/index~rss2.xml', rubric: 'World' },
  { kind: 'rss', id: 'tagesspiegel-berlin', name: 'Tagesspiegel', url: 'https://www.tagesspiegel.de/contentexport/feed/berlin', rubric: 'Berlin' },
  { kind: 'rss', id: 'faz-inland', name: 'FAZ', url: 'https://www.faz.net/rss/aktuell/politik/inland/', rubric: 'Germany' },
  { kind: 'rss', id: 'faz-ausland', name: 'FAZ', url: 'https://www.faz.net/rss/aktuell/politik/ausland/', rubric: 'World' },
  { kind: 'rss', id: 'berliner-zeitung', name: 'Berliner Zeitung', url: 'https://www.berliner-zeitung.de/feed.xml' },
  // Added 2026-11-07: more Berlin (incl. transport, no BVG/S-Bahn/VBB feed exists), politics, business.
  { kind: 'rss', id: 'rbb24', name: 'rbb24', url: 'https://www.rbb24.de/aktuell/index.xml/feed=rss.xml', rubric: 'Berlin' },
  { kind: 'rss', id: 'morgenpost-berlin', name: 'Berliner Morgenpost', url: 'https://www.morgenpost.de/berlin/rss', rubric: 'Berlin' },
  { kind: 'rss', id: 'tagesspiegel-politik', name: 'Tagesspiegel', url: 'https://www.tagesspiegel.de/contentexport/feed/politik', rubric: 'Germany' },
  { kind: 'rss', id: 'handelsblatt-top', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/top-themen', rubric: 'Business' },
  { kind: 'rss', id: 'handelsblatt-finanzen', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/finanzen', rubric: 'Business' },
  { kind: 'rss', id: 'tagesschau-wirtschaft', name: 'tagesschau', url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', rubric: 'Business' },
  { kind: 'telegram', id: 'tg-zerkalo', name: 'Зеркало', channel: 'zerkalo_io', linkHost: 'zerkalo.io' },
];

export const sourceUrl = (s: Source): string => (s.kind === 'rss' ? s.url : `https://t.me/s/${s.channel}`);
