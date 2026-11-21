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
  /** `trends`: a Google Trends feed (search terms, not news) for the Stadtgespräch block. */
  format?: 'trends';
  /** Trends only: the region the searches come from, as shown to the editor. */
  region?: string;
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

// Removing a source here switches it off: the next refresh marks its row inactive (syncSources) and
// the editor no longer sees its items. Switched off 2026-11-16 because the editor rarely printed them
// (items printed in 8 days of editions, both languages; tagesschau-ausland, the most used, had 35):
//   faz-inland        6   https://www.faz.net/rss/aktuell/politik/inland/   (Germany: tagesschau, Tagesspiegel)
//   faz-ausland       9   https://www.faz.net/rss/aktuell/politik/ausland/  (World: tagesschau)
//   berliner-zeitung  4   https://www.berliner-zeitung.de/feed.xml          (Berlin: Tagesspiegel, Morgenpost, rbb24)
export const SOURCES: Source[] = [
  { kind: 'rss', id: 'tagesschau-inland', name: 'tagesschau', url: 'https://www.tagesschau.de/inland/index~rss2.xml', rubric: 'Germany' },
  { kind: 'rss', id: 'tagesschau-ausland', name: 'tagesschau', url: 'https://www.tagesschau.de/ausland/index~rss2.xml', rubric: 'World' },
  { kind: 'rss', id: 'tagesspiegel-berlin', name: 'Tagesspiegel', url: 'https://www.tagesspiegel.de/contentexport/feed/berlin', rubric: 'Berlin' },
  // Added 2026-11-07: more Berlin (incl. transport, no BVG/S-Bahn/VBB feed exists), politics, business.
  { kind: 'rss', id: 'rbb24', name: 'rbb24', url: 'https://www.rbb24.de/aktuell/index.xml/feed=rss.xml', rubric: 'Berlin' },
  { kind: 'rss', id: 'morgenpost-berlin', name: 'Berliner Morgenpost', url: 'https://www.morgenpost.de/berlin/rss', rubric: 'Berlin' },
  { kind: 'rss', id: 'tagesspiegel-politik', name: 'Tagesspiegel', url: 'https://www.tagesspiegel.de/contentexport/feed/politik', rubric: 'Germany' },
  { kind: 'rss', id: 'handelsblatt-top', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/top-themen', rubric: 'Business' },
  { kind: 'rss', id: 'handelsblatt-finanzen', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/finanzen', rubric: 'Business' },
  { kind: 'rss', id: 'tagesschau-wirtschaft', name: 'tagesschau', url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', rubric: 'Business' },
  // Added 2026-11-21: what Berlin and Germany search for right now (football, TV, scandals), the
  // signal for the Stadtgespräch block; never printed as news.
  { kind: 'rss', id: 'trends-berlin', name: 'Google Trends', url: 'https://trends.google.com/trending/rss?geo=DE-BE', format: 'trends', region: 'Berlin' },
  { kind: 'rss', id: 'trends-de', name: 'Google Trends', url: 'https://trends.google.com/trending/rss?geo=DE', format: 'trends', region: 'Deutschland' },
  { kind: 'telegram', id: 'tg-zerkalo', name: 'Зеркало', channel: 'zerkalo_io', linkHost: 'zerkalo.io' },
];

export const isTrends = (s: Source): s is RssSource => s.kind === 'rss' && s.format === 'trends';

export const sourceUrl = (s: Source): string => (s.kind === 'rss' ? s.url : `https://t.me/s/${s.channel}`);
