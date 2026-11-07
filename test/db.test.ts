import { env, exports } from 'cloudflare:workers';
import { createExecutionContext, createScheduledController, introspectWorkflow, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOURCES, type Source } from '../src/collect/sources';
import { refreshSource } from '../src/collect/refresh';
import type { Item } from '../src/collect/item';
import {
  insertItems, itemsForUser, pruneItems, recordFetch, retentionCutoff, sourceStatus, subscribeAllUsers, syncSources,
} from '../src/db/queries';
import type { RefreshOutput } from '../src/workflows/source-refresh';
import worker, { REFRESH_CRON } from '../src/index';
import tagesschauXml from './fixtures/rss-tagesschau.xml?raw';
import telegramHtml from './fixtures/telegram-zerkalo.html?raw';

const db = env.DB;
const NOW = new Date('2026-11-07T16:00:00Z');

async function reset() {
  await db.batch(['DELETE FROM item', 'DELETE FROM subscription', 'DELETE FROM source', 'DELETE FROM profile', 'DELETE FROM user'].map((q) => db.prepare(q)));
  await db.prepare(`INSERT INTO user (id, name, city, lat, lon) VALUES (1, 'Reader', 'Berlin', 52.52, 13.405)`).run();
}

const item = (over: Partial<Item> = {}): Item => ({
  sourceId: 'tagesschau-inland', externalId: 'g1', url: 'https://example.org/1', title: 'Titel', body: 'Text',
  publishedAt: '2026-11-07T10:00:00.000Z', hash: 'aaaa0001', ...over,
});

const count = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())!.n;

/** Serve fixtures for every source URL; `override` replaces responses for matching URLs. */
function stubFeeds(override: (url: string) => Response | Error | undefined = () => undefined) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const o = override(url);
    if (o instanceof Error) throw o;
    if (o) return o;
    return new Response(url.startsWith('https://t.me/') ? telegramHtml : tagesschauXml, { headers: { etag: `"${url.length}"` } });
  });
  return calls;
}

beforeEach(reset);
afterEach(() => vi.unstubAllGlobals());

describe('schema and source sync', () => {
  it('inserts all sources once and does not rewrite unchanged rows', async () => {
    expect(await syncSources(db, SOURCES)).toBe(SOURCES.length);
    expect(await syncSources(db, SOURCES)).toBe(0);
    const renamed: Source[] = SOURCES.map((s) => (s.id === 'faz-inland' ? { ...s, name: 'F.A.Z.' } : s));
    expect(await syncSources(db, renamed)).toBe(1);
  });

  it('deactivates shared sources that left the list and reactivates them on return', async () => {
    await syncSources(db, SOURCES);
    await syncSources(db, SOURCES.filter((s) => s.id !== 'berliner-zeitung'));
    expect(await count(`SELECT active AS n FROM source WHERE id = 'berliner-zeitung'`)).toBe(0);
    await syncSources(db, SOURCES);
    expect(await count(`SELECT active AS n FROM source WHERE id = 'berliner-zeitung'`)).toBe(1);
  });

  it('subscribes the reader with each source rubric; Berliner Zeitung has none', async () => {
    await syncSources(db, SOURCES);
    expect(await subscribeAllUsers(db)).toBe(SOURCES.length);
    expect(await subscribeAllUsers(db)).toBe(0);
    const { results } = await db.prepare('SELECT source_id, rubric FROM subscription ORDER BY source_id').all<{ source_id: string; rubric: string | null }>();
    expect(Object.fromEntries(results.map((r) => [r.source_id, r.rubric]))).toMatchObject({
      'berliner-zeitung': null, 'tagesspiegel-berlin': 'Berlin', 'tagesschau-ausland': 'World', 'faz-inland': 'Germany', 'tg-zerkalo': null,
    });
  });

  it('enforces the locale check', async () => {
    await expect(db.prepare(`INSERT INTO user (name, city, lat, lon, locale) VALUES ('x', 'y', 0, 0, 'fr')`).run()).rejects.toThrow(/CHECK/);
  });
});

describe('items', () => {
  beforeEach(async () => {
    await syncSources(db, SOURCES);
    await subscribeAllUsers(db);
  });

  it('ignores duplicates and items older than 7 days', async () => {
    const at = NOW.toISOString();
    const old = item({ externalId: 'old', hash: 'old00001', publishedAt: '2026-10-01T00:00:00.000Z' });
    expect(await insertItems(db, [item(), item({ externalId: 'g2', hash: 'aaaa0002' }), old], at)).toBe(2);
    expect(await insertItems(db, [item(), item({ externalId: 'g3', hash: 'aaaa0003' })], at)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM item')).toBe(3);
  });

  it('prunes by publication date, or fetch date when there is none', async () => {
    await insertItems(db, [item({ publishedAt: '2026-11-01T00:00:00.000Z' }), item({ hash: 'nodate01', publishedAt: null })], '2026-11-02T00:00:00.000Z');
    await insertItems(db, [item({ hash: 'fresh001', publishedAt: '2026-11-07T00:00:00.000Z' })], NOW.toISOString());
    expect(await pruneItems(db, retentionCutoff(new Date('2026-11-10T00:00:00Z')))).toBe(2);
    expect(await count('SELECT COUNT(*) AS n FROM item')).toBe(1);
  });

  it('itemsForUser joins source name and rubric, newest first, capped per source', async () => {
    const at = NOW.toISOString();
    await insertItems(db, [1, 2, 3].map((n) => item({ hash: `h${n}`, title: `T${n}`, publishedAt: `2026-11-07T0${n}:00:00.000Z` })), at);
    await insertItems(db, [item({ sourceId: 'berliner-zeitung', hash: 'bz1', publishedAt: '2026-11-07T05:00:00.000Z' })], at);
    const rows = await itemsForUser(db, 1, '2026-11-06T00:00:00.000Z', 2);
    expect(rows.map((r) => [r.sourceId, r.title])).toEqual([['berliner-zeitung', 'Titel'], ['tagesschau-inland', 'T3'], ['tagesschau-inland', 'T2']]);
    expect(rows[1]).toMatchObject({ source: 'tagesschau', rubric: 'Germany' });
  });

  it('recordFetch keeps old validators when a fetch fails', async () => {
    await recordFetch(db, 'faz-inland', { at: '2026-11-07T10:00:00.000Z', status: 200, etag: '"v1"' });
    await recordFetch(db, 'faz-inland', { at: '2026-11-07T11:00:00.000Z', status: 503, error: 'HTTP 503' });
    const [s] = (await sourceStatus(db)).filter((x) => x.id === 'faz-inland');
    expect(s).toMatchObject({ lastOkAt: '2026-11-07T10:00:00.000Z', lastStatus: 503, lastError: 'HTTP 503' });
    expect(await count(`SELECT COUNT(*) AS n FROM source WHERE id = 'faz-inland' AND etag = '"v1"'`)).toBe(1);
  });
});

describe('refreshSource', () => {
  const tagesschau = SOURCES.find((s) => s.id === 'tagesschau-inland')!;
  beforeEach(() => syncSources(db, SOURCES));

  it('stores items, then sends If-None-Match and handles 304', async () => {
    const calls = stubFeeds((url) => (calls.length > 1 && url.includes('tagesschau') ? new Response(null, { status: 304 }) : undefined));
    expect(await refreshSource(db, tagesschau, NOW)).toMatchObject({ status: 200, parsed: 2, inserted: 2 });
    expect(await refreshSource(db, tagesschau, NOW)).toMatchObject({ status: 304, inserted: 0 });
    expect(calls[1]!.headers['if-none-match']).toMatch(/^"\d+"$/);
  });

  it('records a 404 without throwing, throws on 503 for a retry', async () => {
    stubFeeds((url) => new Response('x', { status: url.includes('inland') ? 404 : 503 }));
    expect(await refreshSource(db, tagesschau, NOW)).toMatchObject({ status: 404, error: 'HTTP 404' });
    await expect(refreshSource(db, SOURCES.find((s) => s.id === 'faz-ausland')!, NOW)).rejects.toThrow('faz-ausland: HTTP 503');
    expect((await sourceStatus(db)).find((s) => s.id === 'faz-ausland')).toMatchObject({ lastStatus: 503 });
  });
});

describe('SourceRefreshWorkflow', () => {
  it('POST /admin/refresh runs every source; one failing source does not stop the others', async () => {
    stubFeeds((url) => (url.includes('faz.net/rss/aktuell/politik/inland') ? new Error('connect timeout') : undefined));
    await using wf = await introspectWorkflow(env.SOURCE_REFRESH);
    await wf.modifyAll(async (m) => {
      await m.disableRetryDelays();
    });

    expect((await exports.default.fetch('https://ranica.test/admin/refresh')).status).toBe(404); // GET is not a route
    expect((await exports.default.fetch('https://ranica.test/admin/refresh', { method: 'POST' })).status).toBe(404); // no key
    const res = await exports.default.fetch('https://ranica.test/admin/refresh?key=test-key', { method: 'POST' });
    expect(res.status).toBe(202);

    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    const out = (await instance!.getOutput()) as RefreshOutput;
    expect(out.synced).toBe(SOURCES.length);
    expect(out.subscribed).toBe(SOURCES.length);
    const by = new Map(out.results.map((r) => [r.id, r]));
    expect(by.get('faz-inland')).toMatchObject({ status: null, inserted: 0 });
    expect(by.get('faz-inland')!.error).toContain('connect timeout');
    expect(by.get('tg-zerkalo')).toMatchObject({ status: 200, inserted: 2 });
    expect(by.get('tagesspiegel-berlin')).toMatchObject({ status: 200, inserted: 2 });

    const status = await (await exports.default.fetch('https://ranica.test/admin/sources?key=test-key')).json<{ id: string; items: number; lastError: string | null }[]>();
    expect(status.find((s) => s.id === 'faz-inland')!.lastError).toContain('connect timeout');
    expect(status.filter((s) => s.items > 0)).toHaveLength(SOURCES.length - 1);
  });
});

describe('hourly cron', () => {
  it('starts a SourceRefreshWorkflow run', async () => {
    stubFeeds();
    await using wf = await introspectWorkflow(env.SOURCE_REFRESH);
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: REFRESH_CRON, scheduledTime: NOW }), env, ctx);
    await waitOnExecutionContext(ctx);
    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    expect(((await instance!.getOutput()) as RefreshOutput).results).toHaveLength(SOURCES.length);
  });
});
