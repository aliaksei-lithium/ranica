import { describe, expect, it } from 'vitest';
import app from '../src/index';

const get = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: await res.text() };
};

describe('M0 routes with fake data', () => {
  it('redirects / to /today', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/today');
  });

  it('renders the English edition with all blocks', async () => {
    const { status, body } = await get('/today');
    expect(status).toBe(200);
    expect(body.startsWith('<!doctype html>')).toBe(true);
    expect(body).toContain('lang="en"');
    for (const block of ['masthead', 'sun', 'weather', 'today', 'sport', 'german', 'news', 'insight', 'hobby', 'onthisday', 'footer']) {
      expect(body).toContain(`data-block="${block}"`);
    }
    expect(body).toContain('Tuesday, 2026');
    expect(body).toContain('leave by 12:20, U8 takes 18 min');
  });

  it('renders the German edition', async () => {
    const { body } = await get('/today?lang=de');
    expect(body).toContain('lang="de"');
    expect(body).toContain('Deutsch heute');
    expect(body).toContain('Einblick des Tages');
    expect(body).toContain('Dienstag, 2026');
  });

  it('thin day shows the unavailable line and drops optional blocks', async () => {
    const { body } = await get('/today?day=thin');
    expect(body).toContain('class="unavailable"');
    expect(body).toContain('Weather unavailable (Open-Meteo timeout)');
    expect(body).toContain('No meetings today.');
    for (const block of ['sport', 'hobby', 'onthisday']) expect(body).not.toContain(`data-block="${block}"`);
  });

  it('print view loads the fit-to-page script, web view does not', async () => {
    expect((await get('/today?view=print')).body).toContain('/fit.js');
    expect((await get('/today')).body).not.toContain('/fit.js');
  });

  it('falls back to defaults on unknown query values', async () => {
    const { status, body } = await get('/today?lang=xx&view=zzz&day=nope');
    expect(status).toBe(200);
    expect(body).toContain('class="view-web"');
  });

  it('renders the e-ink widget with at most 3 headlines', async () => {
    const { body } = await get('/today.eink');
    expect(body).toContain('class="eink"');
    expect(body.match(/eink-headline/g)?.length).toBe(3);
  });

  it('serves the archive and editions by date, 404 for unknown dates', async () => {
    expect((await get('/editions')).body).toContain('/editions/2026-10-28');
    const ed = await get('/editions/2026-10-30');
    expect(ed.status).toBe(200);
    expect(ed.body).toContain('30');
    expect((await get('/editions/2020-01-01')).status).toBe(404);
  });

  it('exposes the fake edition as JSON', async () => {
    const res = await app.request('/api/edition?lang=de');
    const json = (await res.json()) as { facts: { lang: string }; brief: { headline: string } };
    expect(json.facts.lang).toBe('de');
    expect(json.brief.headline.length).toBeLessThanOrEqual(60);
  });
});
