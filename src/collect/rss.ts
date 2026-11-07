// RSS 2.0 parser for the §6.1 feeds (tagesschau, Tagesspiegel, FAZ, Berliner Zeitung).
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
