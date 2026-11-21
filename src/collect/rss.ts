// RSS 2.0 parser for the §6.1 feeds (tagesschau, Tagesspiegel, Handelsblatt, rbb24, Morgenpost; FAZ and Berliner Zeitung fixtures stay as test cases).
// Regex over <item> blocks instead of an XML DOM: the feeds are flat, and this keeps a
// 100 kB feed at ~1 ms CPU. Title/description/content:encoded may be CDATA or entity-escaped.
import { BODY_MAX, type Item } from './item';
import { clip, decodeEntities, hash, htmlToText, toIso, unwrapCdata } from './text';

/** Raw inner text of the first `<tag …>…</tag>` in `xml`, or undefined. Tag names may have a prefix. */
function element(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  return re.exec(xml)?.[1];
}

/** Element text with CDATA unwrapped and entities decoded (still may contain HTML). */
const value = (xml: string, tag: string): string | undefined => {
  const raw = element(xml, tag);
  return raw === undefined ? undefined : decodeEntities(unwrapCdata(raw)).trim();
};

export interface ParseOptions {
  /** Keep at most this many items (feeds are newest first). */
  limit?: number;
}

export function parseRss(xml: string, sourceId: string, opts: ParseOptions = {}): Item[] {
  const limit = opts.limit ?? 60;
  const out: Item[] = [];
  const seen = new Set<string>();
  const items = xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi);
  for (const m of items) {
    if (out.length >= limit) break;
    const x = m[1]!;
    const title = htmlToText(value(x, 'title') ?? '');
    const url = (value(x, 'link') ?? '').trim();
    if (!title || !url) continue;
    // description is usually the teaser; content:encoded repeats it with an image (tagesschau, FAZ).
    const body = clip(htmlToText(value(x, 'description') ?? value(x, 'content:encoded') ?? ''), BODY_MAX);
    const externalId = value(x, 'guid') || url;
    const key = hash(externalId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      sourceId,
      externalId,
      url,
      title,
      body,
      publishedAt: toIso(value(x, 'pubDate') ?? value(x, 'dc:date')),
      hash: key,
    });
  }
  return out;
}

/** "2000+" / "10.000+" → 2000 / 10000. */
const traffic = (s: string | undefined): number => Number((s ?? '').replace(/\D/g, '')) || 0;

/**
 * Google Trends "trending now" RSS (https://trends.google.com/trending/rss?geo=DE-BE): one item per
 * search term with its approximate traffic and up to three news articles about it. This is the
 * "what people talk about" signal for the Stadtgespräch block (football, TV, scandals), not news.
 * The term is the title; the body lists traffic and the articles; one item per term and day.
 */
export function parseTrends(xml: string, sourceId: string, opts: ParseOptions = {}): Item[] {
  const limit = opts.limit ?? 25;
  const out: Item[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    if (out.length >= limit) break;
    const x = m[1]!;
    const term = htmlToText(value(x, 'title') ?? '');
    if (!term) continue;
    const publishedAt = toIso(value(x, 'pubDate'));
    const news = [...x.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi)].map((n) => ({
      title: htmlToText(value(n[1]!, 'ht:news_item_title') ?? ''),
      source: htmlToText(value(n[1]!, 'ht:news_item_source') ?? ''),
      url: (value(n[1]!, 'ht:news_item_url') ?? '').trim(),
    })).filter((n) => n.title);
    // The same term trends for hours: keep it once per day (the first, i.e. newest, sighting).
    const externalId = `${term.toLowerCase()}|${(publishedAt ?? '').slice(0, 10)}`;
    const key = hash(externalId);
    if (seen.has(key)) continue;
    seen.add(key);
    const searches = traffic(value(x, 'ht:approx_traffic'));
    out.push({
      sourceId,
      externalId,
      url: news.find((n) => n.url)?.url ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(term)}`,
      title: term,
      body: clip([`${searches}+ searches.`, ...news.map((n) => `${n.title}${n.source ? ` (${n.source})` : ''}`)].join('\n'), BODY_MAX),
      publishedAt,
      hash: key,
    });
  }
  return out;
}
