import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Lang } from './model';
import { fakeArchive, fakeEdition, type Variant } from './fake/editions';
import { renderPage, type View } from './compose/compose';
import { renderEink } from './compose/eink';
import { ArchivePage } from './web/archive';

// M0: every route serves fake data (docs/02-plan.md §6, M0). No D1, R2, LLM or collectors yet.

type Env = { ASSETS: Fetcher };

const app = new Hono<{ Bindings: Env }>();

const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function options(c: Context) {
  return {
    lang: pick<Lang>(c.req.query('lang'), ['en', 'de'], 'en'),
    variant: pick<Variant>(c.req.query('day'), ['full', 'thin'], 'full'),
    view: pick<View>(c.req.query('view'), ['web', 'print', 'kindle'], 'web'),
  };
}

app.get('/', (c) => c.redirect('/today'));

app.get('/health', (c) => c.json({ ok: true, milestone: 'M0', data: 'fake' }));

/** The edition: ?lang=en|de &day=full|thin &view=web|print|kindle */
app.get('/today', (c) => {
  const o = options(c);
  return c.html(renderPage(fakeEdition(o.lang, o.variant), o.view));
});

/** E-ink widget page, 800 × 480. */
app.get('/today.eink', (c) => {
  const o = options(c);
  return c.html(renderEink(fakeEdition(o.lang, o.variant)));
});

/** The data behind the page (facts + brief), useful for template work. */
app.get('/api/edition', (c) => {
  const o = options(c);
  return c.json(fakeEdition(o.lang, o.variant));
});

app.get('/editions', (c) => c.html(`<!doctype html>${ArchivePage({ lang: options(c).lang, list: fakeArchive() })}`));

app.get('/editions/:date{\\d{4}-\\d{2}-\\d{2}}', (c) => {
  const o = options(c);
  const date = c.req.param('date');
  const issue = fakeArchive().find((a) => a.date === date)?.issue;
  if (!issue) return c.notFound();
  const e = fakeEdition(o.lang, o.variant, date);
  return c.html(renderPage({ ...e, facts: { ...e.facts, issue } }, o.view));
});

export default app;
