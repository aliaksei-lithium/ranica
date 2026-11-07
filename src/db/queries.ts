// Typed D1 queries for sources and items (docs/02-plan.md §4). Write budget matters on the Free plan
// (100 k rows/day): unchanged sources are not rewritten, duplicate items are ignored by the
// UNIQUE (source_id, hash) index, and old items are pruned.
import type { Item } from '../collect/item';
import type { Source } from '../collect/sources';

export const ITEM_RETENTION_DAYS = 7;

/** The part of a source that lives in `config_json`, with a stable key order. */
export function sourceConfig(s: Source): string {
  return s.kind === 'rss'
    ? JSON.stringify({ url: s.url, rubric: s.rubric ?? null })
    : JSON.stringify({ channel: s.channel, linkHost: s.linkHost ?? null });
}

/**
 * Upsert the shared sources from code; rows only change when kind/name/config differ.
 * Shared sources that left the list are deactivated, not deleted (their items stay until pruned).
 */
export async function syncSources(db: D1Database, sources: Source[]): Promise<number> {
  const upsert = db.prepare(
    `INSERT INTO source (id, kind, name, config_json, shared, active) VALUES (?1, ?2, ?3, ?4, 1, 1)
     ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, name = excluded.name, config_json = excluded.config_json, active = 1
     WHERE source.kind <> excluded.kind OR source.name <> excluded.name
        OR source.config_json <> excluded.config_json OR source.active = 0`,
  );
  const ids = sources.map((s) => s.id);
  const deactivate = db
    .prepare(`UPDATE source SET active = 0 WHERE shared = 1 AND active = 1 AND id NOT IN (SELECT value FROM json_each(?1))`)
    .bind(JSON.stringify(ids));
  const res = await db.batch([...sources.map((s) => upsert.bind(s.id, s.kind, s.name, sourceConfig(s))), deactivate]);
  return res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

/** M1 is single-user: subscribe every user to every active shared source they lack, with its rubric. */
export async function subscribeAllUsers(db: D1Database): Promise<number> {
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO subscription (user_id, source_id, rubric)
       SELECT u.id, s.id, json_extract(s.config_json, '$.rubric') FROM user u CROSS JOIN source s
       WHERE s.shared = 1 AND s.active = 1`,
    )
    .run();
  return r.meta.changes ?? 0;
}

export interface SourceState {
  etag: string | null;
  lastModified: string | null;
}

export async function getSourceState(db: D1Database, id: string): Promise<SourceState | null> {
  const row = await db
    .prepare('SELECT etag, last_modified FROM source WHERE id = ?1')
    .bind(id)
    .first<{ etag: string | null; last_modified: string | null }>();
  return row ? { etag: row.etag, lastModified: row.last_modified } : null;
}

export interface FetchRecord {
  at: string;
  status: number | null;
  etag?: string | null;
  lastModified?: string | null;
  error?: string | null;
}

/** One write per refresh. Validators are kept from the previous fetch when the new one has none. */
export async function recordFetch(db: D1Database, id: string, f: FetchRecord): Promise<void> {
  const ok = f.status === 200 || f.status === 304;
  await db
    .prepare(
      `UPDATE source SET last_fetch_at = ?2, last_status = ?3, last_error = ?4,
         last_ok_at = CASE WHEN ?5 THEN ?2 ELSE last_ok_at END,
         etag = COALESCE(?6, etag), last_modified = COALESCE(?7, last_modified)
       WHERE id = ?1`,
    )
    .bind(id, f.at, f.status, f.error ?? null, ok ? 1 : 0, ok ? (f.etag ?? null) : null, ok ? (f.lastModified ?? null) : null)
    .run();
}

/** Insert new items, ignoring ones already stored and ones older than the retention window. Returns rows inserted. */
export async function insertItems(db: D1Database, items: (Item & { link?: string | null })[], fetchedAt: string): Promise<number> {
  const cutoff = retentionCutoff(new Date(fetchedAt));
  const fresh = items.filter((i) => !i.publishedAt || i.publishedAt >= cutoff);
  if (!fresh.length) return 0;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO item (source_id, external_id, url, title, body, link, published_at, fetched_at, hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  );
  const res = await db.batch(
    fresh.map((i) => stmt.bind(i.sourceId, i.externalId, i.url, i.title, i.body, i.link ?? null, i.publishedAt, fetchedAt, i.hash)),
  );
  return res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

export const retentionCutoff = (now: Date, days = ITEM_RETENTION_DAYS): string =>
  new Date(now.getTime() - days * 86_400_000).toISOString();

/** Delete items whose publication (or, without a date, fetch) time is older than the cutoff. */
export async function pruneItems(db: D1Database, cutoff: string): Promise<number> {
  const r = await db.prepare('DELETE FROM item WHERE COALESCE(published_at, fetched_at) < ?1').bind(cutoff).run();
  return r.meta.changes ?? 0;
}

export interface UserItem {
  id: number;
  sourceId: string;
  source: string;
  rubric: string | null;
  url: string;
  title: string;
  body: string;
  link: string | null;
  publishedAt: string | null;
}

/** The newest items from a user's active subscriptions since `since`, at most `perSource` per source. */
export async function itemsForUser(db: D1Database, userId: number, since: string, perSource = 15): Promise<UserItem[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source_id AS sourceId, source, rubric, url, title, body, link, published_at AS publishedAt FROM (
         SELECT i.*, s.name AS source, sub.rubric,
                ROW_NUMBER() OVER (PARTITION BY i.source_id ORDER BY COALESCE(i.published_at, i.fetched_at) DESC) AS rn
         FROM item i
         JOIN subscription sub ON sub.source_id = i.source_id AND sub.user_id = ?1
         JOIN source s ON s.id = i.source_id AND s.active = 1
         WHERE COALESCE(i.published_at, i.fetched_at) >= ?2
       ) WHERE rn <= ?3
       ORDER BY COALESCE(publishedAt, '') DESC`,
    )
    .bind(userId, since, perSource)
    .all<UserItem>();
  return results;
}

export interface SourceStatus {
  id: string;
  kind: string;
  name: string;
  active: number;
  lastFetchAt: string | null;
  lastOkAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  items: number;
  newest: string | null;
}

export async function sourceStatus(db: D1Database): Promise<SourceStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.kind, s.name, s.active, s.last_fetch_at AS lastFetchAt, s.last_ok_at AS lastOkAt,
              s.last_status AS lastStatus, s.last_error AS lastError,
              COUNT(i.id) AS items, MAX(i.published_at) AS newest
       FROM source s LEFT JOIN item i ON i.source_id = s.id
       GROUP BY s.id ORDER BY s.id`,
    )
    .all<SourceStatus>();
  return results;
}
