// One fetch per source with the collector limits from docs/02-plan.md §8:
// timeout, 512 kB response cap, a plain User-Agent, ETag / Last-Modified support.
import { parseRss } from './rss';
import { parseTelegram } from './telegram';
import { sourceUrl, type Source } from './sources';
import type { Item } from './item';

export const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Ranica/0.1 (personal morning paper)';

export interface FetchResult {
  status: number;
  /** Response body, cut at MAX_BYTES; empty on 304. */
  text: string;
  bytes: number;
  truncated: boolean;
  etag: string | null;
  lastModified: string | null;
}

export async function fetchCapped(
  url: string,
  prev: { etag?: string | null; lastModified?: string | null } = {},
  fetcher: typeof fetch = fetch,
): Promise<FetchResult> {
  const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: '*/*' };
  if (prev.etag) headers['if-none-match'] = prev.etag;
  if (prev.lastModified) headers['if-modified-since'] = prev.lastModified;
  const res = await fetcher(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  const meta = { status: res.status, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
  if (res.status === 304 || !res.body) return { ...meta, text: '', bytes: 0, truncated: false };

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (bytes + value.byteLength > MAX_BYTES) {
      chunks.push(value.subarray(0, MAX_BYTES - bytes));
      bytes = MAX_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }
  const buf = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    buf.set(c, at);
    at += c.byteLength;
  }
  return { ...meta, text: new TextDecoder('utf-8').decode(buf), bytes, truncated };
}

/** Parse a fetched body with the parser for this source's kind. */
export function parseSource(source: Source, text: string): Item[] {
  return source.kind === 'rss' ? parseRss(text, source.id) : parseTelegram(text, source.id, source.channel, source.linkHost);
}

export async function collect(source: Source, fetcher: typeof fetch = fetch) {
  const r = await fetchCapped(sourceUrl(source), {}, fetcher);
  return { ...r, items: r.status === 200 ? parseSource(source, r.text) : [] };
}
