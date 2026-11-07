import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Lang } from './model';
import { fakeArchive, fakeEdition, type Variant } from './fake/editions';
import { renderEdition, type View } from './compose/compose';
import { ArchivePage } from './web/archive';
import { probeSources } from './web/probe';
import type { Env } from './env';
import { sourceStatus } from './db/queries';
import type { RefreshParams } from './workflows/source-refresh';

export { SourceRefreshWorkflow } from './workflows/source-refresh';

// Edition routes still serve fake data (docs/02-plan.md §6, M0). Since M1 the hourly
// SourceRefreshWorkflow fills D1 with items; /admin/* shows and triggers it.

const app = new Hono<{ Bindings: Env }>();

/** Routes for the operator only: 404 unless the PROBE_KEY secret is set and passed as ?key=…. */
const authorized = (c: Context<{ Bindings: Env }>) => {
  const key = c.env?.PROBE_KEY;
  return !!key && c.req.query('key') === key;
};

/** ctx.exports.SourceRefreshWorkflow (declared under `exports` in wrangler.jsonc). */
const refreshWorkflow = (c: Context<{ Bindings: Env }>): Workflow<RefreshParams> => c.executionCtx.exports.SourceRefreshWorkflow;

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

app.get('/health', (c) => c.json({ ok: true, milestone: 'M1', data: 'fake editions, live items' }));

/** The edition: ?lang=en|de &day=full|thin &view=web|print|kindle|eink &pages=1|2 */
app.get('/today', (c) => {
  const o = options(c);
  return c.html(renderEdition(fakeEdition(o.lang, o.variant), o.view, o));
});

/** E-ink widget, 800 × 480 (same as /today?view=eink). */
app.get('/today.eink', (c) => {
  const o = options(c);
  return c.html(renderEdition(fakeEdition(o.lang, o.variant), 'eink'));
});

/** The data behind the page (facts + brief), useful for template work. */
app.get('/api/edition', (c) => {
  const o = options(c);
  return c.json(fakeEdition(o.lang, o.variant));
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

app.get('/editions', (c) => c.html(`<!doctype html>${ArchivePage({ lang: options(c).lang, list: fakeArchive() })}`));

app.get('/editions/:date{\\d{4}-\\d{2}-\\d{2}}', (c) => {
  const o = options(c);
  const date = c.req.param('date');
  const issue = fakeArchive().find((a) => a.date === date)?.issue;
  if (!issue) return c.notFound();
  const e = fakeEdition(o.lang, o.variant, date);
  return c.html(renderEdition({ ...e, facts: { ...e.facts, issue } }, o.view, o));
});

export default app;
