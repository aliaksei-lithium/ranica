import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Lang } from './model';
import { fakeArchive, fakeEdition, type Variant } from './fake/editions';
import { renderEdition, type View } from './compose/compose';
import { ArchivePage } from './web/archive';
import { probeSources } from './web/probe';
import type { Env } from './env';
import { listEditions, loadEdition, sourceStatus } from './db/queries';
import type { RefreshParams } from './workflows/source-refresh';
import type { EditionParams } from './workflows/edition';

// HTTP routes. /today shows the newest stored edition; ?fake=1 (or no edition
// yet) shows the fake one from src/fake/ for template work. /admin/* needs PROBE_KEY.

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

/** The stored edition (newest, or for `date`), unless ?fake=1 or there is none / no database (tests). */
async function realEdition(c: Context<{ Bindings: Env }>, date?: string) {
  if (c.req.query('fake') === '1' || !c.env?.DB) return null;
  return loadEdition(c.env.DB, READER, date);
}

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
  const e = (await realEdition(c)) ?? fakeEdition(o.lang, o.variant);
  return c.html(renderEdition(e, o.view, o));
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

/** Build today's edition now (also runs by itself in the hour before wake time). */
app.post('/admin/edition', async (c) => {
  if (!authorized(c)) return c.notFound();
  const date = c.req.query('date');
  const instance = await editionWorkflow(c).create({ params: { userId: READER, ...(date ? { date } : {}) } });
  return c.json({ id: instance.id, status: await instance.status() }, 202);
});

app.get('/admin/edition/:id', async (c) => {
  if (!authorized(c)) return c.notFound();
  return c.json(await (await editionWorkflow(c).get(c.req.param('id'))).status());
});

app.get('/editions', async (c) => {
  const real = c.req.query('fake') === '1' || !c.env?.DB ? [] : await listEditions(c.env.DB, READER);
  const lang = real.length ? ((await loadEdition(c.env.DB, READER))?.facts.lang ?? 'en') : options(c).lang;
  return c.html(`<!doctype html>${ArchivePage({ lang, list: real.length ? real : fakeArchive() })}`);
});

app.get('/editions/:date{\\d{4}-\\d{2}-\\d{2}}', async (c) => {
  const o = options(c);
  const date = c.req.param('date');
  const real = await realEdition(c, date);
  if (real) return c.html(renderEdition(real, o.view, o));
  const issue = fakeArchive().find((a) => a.date === date)?.issue;
  if (!issue) return c.notFound();
  const e = fakeEdition(o.lang, o.variant, date);
  return c.html(renderEdition({ ...e, facts: { ...e.facts, issue } }, o.view, o));
});
