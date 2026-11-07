import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Lang } from './model';
import { fakeArchive, fakeEdition, type Variant } from './fake/editions';
import { renderEdition, type Nav, type View } from './compose/compose';
import { ArchivePage } from './web/archive';
import { probeSources } from './web/probe';
import type { Env } from './env';
import { editionLog, getReader, listEditions, loadEdition, saveSettings, sourceStatus, type StoredEdition } from './db/queries';
import { SettingsPage } from './web/settings';
import type { RefreshParams } from './workflows/source-refresh';
import type { EditionParams } from './workflows/edition';

// HTTP routes. /today shows the newest stored edition in ?lang= (default: the first language
// stored); ?fake=1 (or no edition yet) shows the fake one from src/fake/ for template work.
// /admin (settings, rebuild) and /admin/* need PROBE_KEY.

/** The single M1 reader (seed/me.sql). */
const READER = 1;

export const app = new Hono<{ Bindings: Env }>();

/** Routes for the operator only: 404 unless the PROBE_KEY secret is set and passed as ?key=…. */
const authorized = (c: Context<{ Bindings: Env }>) => {
  const key = c.env?.PROBE_KEY;
  return !!key && c.req.query('key') === key;
};

/** ctx.exports.SourceRefreshWorkflow (declared under `exports` in wrangler.jsonc). */
const refreshWorkflow = (c: Context<{ Bindings: Env }>): Workflow<RefreshParams> => c.executionCtx.exports.SourceRefreshWorkflow;
const editionWorkflow = (c: Context<{ Bindings: Env }>): Workflow<EditionParams> => c.executionCtx.exports.EditionWorkflow;

/** The stored edition (newest, or for `date`) in ?lang=, unless ?fake=1 or there is none / no database (tests). */
async function realEdition(c: Context<{ Bindings: Env }>, date?: string): Promise<StoredEdition | null> {
  if (c.req.query('fake') === '1' || !c.env?.DB) return null;
  const lang = c.req.query('lang');
  return loadEdition(c.env.DB, READER, { date, lang: lang === 'en' || lang === 'de' ? lang : undefined });
}

const nav = (e: StoredEdition, path: string): Nav => ({ langs: e.langs, path });

const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function options(c: Context) {
  const variant = pick<Variant>(c.req.query('day'), ['full', 'thin'], 'full');
  const pages = pick(c.req.query('pages'), ['1', '2'], variant === 'thin' ? '1' : '2');
  return {
    lang: pick<Lang>(c.req.query('lang'), ['en', 'de'], 'en'),
    variant,
    view: pick<View>(c.req.query('view'), ['web', 'print', 'kindle', 'eink'], 'web'),
    backPage: pages === '2',
  };
}

app.get('/', (c) => c.redirect('/today'));

app.get('/health', (c) => c.json({ ok: true, milestone: 'M1' }));

/** The edition: ?view=web|print|kindle|eink &pages=1|2; fake only: ?fake=1 &lang=en|de &day=full|thin */
app.get('/today', async (c) => {
  const o = options(c);
  const real = await realEdition(c);
  if (real) return c.html(renderEdition(real, o.view, { ...o, nav: nav(real, '/today') }));
  return c.html(renderEdition(fakeEdition(o.lang, o.variant), o.view, o));
});

/** E-ink widget, 800 × 480 (same as /today?view=eink). */
app.get('/today.eink', async (c) => {
  const o = options(c);
  return c.html(renderEdition((await realEdition(c)) ?? fakeEdition(o.lang, o.variant), 'eink'));
});

/** The data behind the page (facts + brief). */
app.get('/api/edition', async (c) => {
  const o = options(c);
  return c.json((await realEdition(c)) ?? fakeEdition(o.lang, o.variant));
});

/** Day-1 check: fetch and parse every source from this Worker. Needs the PROBE_KEY secret. */
app.get('/probe/sources', async (c) => {
  if (!authorized(c)) return c.notFound();
  const colo = (c.req.raw as { cf?: { colo?: string } }).cf?.colo;
  return c.json({ ...(await probeSources()), colo });
});

/** What the refresh Workflow stored: per source last fetch, status, error, item count. */
app.get('/admin/sources', async (c) => {
  if (!authorized(c)) return c.notFound();
  return c.json(await sourceStatus(c.env.DB));
});

/** Start a SourceRefreshWorkflow run now (it also runs hourly). */
app.post('/admin/refresh', async (c) => {
  if (!authorized(c)) return c.notFound();
  const instance = await refreshWorkflow(c).create({ params: {} });
  return c.json({ id: instance.id, status: await instance.status() }, 202);
});

app.get('/admin/refresh/:id', async (c) => {
  if (!authorized(c)) return c.notFound();
  const instance = await refreshWorkflow(c).get(c.req.param('id'));
  return c.json(await instance.status());
});

/** Build today's edition now (also runs by itself in the hour before wake time). ?refresh=1 fetches sources first. */
app.post('/admin/edition', async (c) => {
  if (!authorized(c)) return c.notFound();
  const date = c.req.query('date');
  const refresh = c.req.query('refresh') === '1';
  const instance = await editionWorkflow(c).create({ params: { userId: READER, ...(date ? { date } : {}), ...(refresh ? { refresh } : {}) } });
  return c.json({ id: instance.id, status: await instance.status() }, 202);
});

/** Settings page: schedule on/off, languages, wake time, rebuild button, recent editions, sources. */
app.get('/admin', async (c) => {
  if (!authorized(c)) return c.notFound();
  const reader = await getReader(c.env.DB, READER);
  if (!reader) return c.text('No reader: run seed/me.sql', 500);
  const runId = c.req.query('run');
  let run: { id: string; status: string; error?: string | null } | undefined;
  if (runId) {
    try {
      const s = await (await editionWorkflow(c).get(runId)).status();
      run = { id: runId, status: s.status, error: s.error?.message ?? null };
    } catch {
      run = { id: runId, status: 'unknown' };
    }
  }
  const [log, sources] = await Promise.all([editionLog(c.env.DB, READER), sourceStatus(c.env.DB)]);
  return c.html(`<!doctype html>${SettingsPage({ reader, keyParam: c.req.query('key')!, log, sources, run })}`);
});

app.post('/admin/settings', async (c) => {
  if (!authorized(c)) return c.notFound();
  const body = await c.req.parseBody({ all: true });
  const langs = ([] as unknown[]).concat(body.lang ?? []).filter((l): l is Lang => l === 'en' || l === 'de');
  const wake = typeof body.wakeTime === 'string' && /^\d{2}:\d{2}$/.test(body.wakeTime) ? body.wakeTime : '07:00';
  await saveSettings(c.env.DB, READER, { autoRefresh: body.autoRefresh === 'on', autoEdition: body.autoEdition === 'on', editionLangs: langs, wakeTime: wake });
  return c.redirect(`/admin?key=${encodeURIComponent(c.req.query('key')!)}`, 303);
});

/** The "Rebuild now" button: fetch all sources, then build today's edition in every chosen language. */
app.post('/admin/rebuild', async (c) => {
  if (!authorized(c)) return c.notFound();
  const instance = await editionWorkflow(c).create({ params: { userId: READER, refresh: true } });
  return c.redirect(`/admin?key=${encodeURIComponent(c.req.query('key')!)}&run=${encodeURIComponent(instance.id)}`, 303);
});

app.get('/admin/edition/:id', async (c) => {
  if (!authorized(c)) return c.notFound();
  return c.json(await (await editionWorkflow(c).get(c.req.param('id'))).status());
});

app.get('/editions', async (c) => {
  const real = c.req.query('fake') === '1' || !c.env?.DB ? [] : await listEditions(c.env.DB, READER);
  const lang = real.length ? ((await realEdition(c))?.lang ?? 'en') : options(c).lang;
  return c.html(`<!doctype html>${ArchivePage({ lang, list: real.length ? real : fakeArchive() })}`);
});

app.get('/editions/:date{\\d{4}-\\d{2}-\\d{2}}', async (c) => {
  const o = options(c);
  const date = c.req.param('date');
  const real = await realEdition(c, date);
  if (real) return c.html(renderEdition(real, o.view, { ...o, nav: nav(real, `/editions/${date}`) }));
  const issue = fakeArchive().find((a) => a.date === date)?.issue;
  if (!issue) return c.notFound();
  const e = fakeEdition(o.lang, o.variant, date);
  return c.html(renderEdition({ ...e, facts: { ...e.facts, issue } }, o.view, o));
});
