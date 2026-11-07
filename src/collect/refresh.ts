// Refresh one source: conditional fetch → parse → insert new items → record the fetch.
// Runs as one Workflow step per source (docs/02-plan.md §3, rule 6).
import { fetchCapped, parseSource } from './fetch';
import { sourceUrl, type Source } from './sources';
import { getSourceState, insertItems, recordFetch } from '../db/queries';

export interface RefreshResult {
  id: string;
  status: number | null;
  parsed: number;
  inserted: number;
  error?: string;
}

/** Transient failures the Workflow should retry: network errors, 429 and 5xx. */
export class RetryableFetchError extends Error {}

export async function refreshSource(
  db: D1Database,
  source: Source,
  now: Date = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<RefreshResult> {
  const at = now.toISOString();
  const prev = await getSourceState(db, source.id);
  let r;
  try {
    r = await fetchCapped(sourceUrl(source), prev ?? {}, fetcher);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await recordFetch(db, source.id, { at, status: null, error });
    throw new RetryableFetchError(`${source.id}: ${error}`);
  }

  if (r.status === 304) {
    await recordFetch(db, source.id, { at, status: 304, etag: r.etag, lastModified: r.lastModified });
    return { id: source.id, status: 304, parsed: 0, inserted: 0 };
  }
  if (r.status !== 200) {
    const error = `HTTP ${r.status}`;
    await recordFetch(db, source.id, { at, status: r.status, error });
    if (r.status === 429 || r.status >= 500) throw new RetryableFetchError(`${source.id}: ${error}`);
    return { id: source.id, status: r.status, parsed: 0, inserted: 0, error };
  }

  const items = parseSource(source, r.text);
  const inserted = await insertItems(db, items, at);
  const error = items.length ? (r.truncated ? 'truncated at 512 kB' : null) : 'no items parsed';
  await recordFetch(db, source.id, { at, status: 200, etag: r.etag, lastModified: r.lastModified, error });
  return { id: source.id, status: 200, parsed: items.length, inserted, ...(error ? { error } : {}) };
}
