import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

const get = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: await res.text() };
};

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

describe('M0 routes with fake data', () => {
  it('redirects / to /today', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/today');
  });

  it('renders front and back page in English with the design stylesheet', async () => {
    const { status, body } = await get('/today');
    expect(status).toBe(200);
    expect(body.startsWith('<!doctype html>')).toBe(true);
    expect(body).toContain('/css/ranica.css');
    expect(body).toContain('class="desk desk--stack"');
    expect(count(body, /<article class="sheet[ "]/g)).toBe(2);
    expect(body).toContain('sheet sheet--page2');
    for (const block of ['masthead', 'sun', 'weather', 'today', 'sport', 'hobby', 'onthisday', 'news', 'qr', 'insight', 'footer', 'week', 'depth', 'world', 'digest', 'upcoming', 'words']) {
      expect(body).toContain(`data-block="${block}"`);
    }
    expect(body).toContain('Tuesday · 2026');
    expect(body).toContain('leave by 12:20, U8 takes 18 min');
    expect(body).toContain('more on page 2');
  });

  it('renders the German edition', async () => {
    const { body } = await get('/today?lang=de');
    expect(body).toContain('lang="de"');
    expect(body).toContain('Wort des Tages'); // the German block is on the back page
    expect(body).toContain('Einblick des Tages');
    expect(body).toContain('Dienstag, 3. November 2026');
    expect(body).toContain('Rückseite');
  });

  it('thin day: one sheet, unavailable weather, optional blocks gone', async () => {
    const { body } = await get('/today?day=thin');
    expect(count(body, /<article class="sheet[ "]/g)).toBe(1);
    expect(body).toContain('Weather unavailable <span class="unavailable__reason">Open-Meteo timeout</span>');
    expect(body).toContain('No meetings today.');
    for (const block of ['sport', 'hobby', 'onthisday', 'telegram']) expect(body).not.toContain(`data-block="${block}"`);
  });

  it('pages=1 drops the back page', async () => {
    const { body } = await get('/today?pages=1');
    expect(body).not.toContain('sheet--page2');
  });

  it('print view loads the fit-to-page script, web view does not', async () => {
    expect((await get('/today?view=print')).body).toContain('/fit.js');
    expect((await get('/today')).body).not.toContain('/fit.js');
  });

  it('kindle view is the front page only', async () => {
    const { body } = await get('/today?view=kindle');
    expect(body).toContain('sheet sheet--kindle');
    expect(body).not.toContain('sheet--page2');
  });

  it('QR codes point to the rubric anchors of the web edition', async () => {
    const { body } = await get('/today');
    expect(body).toContain('href="https://ranica.app/today#tech"');
    expect(body).toContain('id="tech"');
    expect(count(body, /aria-label="QR code"/g)).toBe(2); // one per front rubric
  });

  it('falls back to defaults on unknown query values', async () => {
    const { status, body } = await get('/today?lang=xx&view=zzz&day=nope&pages=9');
    expect(status).toBe(200);
    expect(body).toContain('class="view-web"');
  });

  it('renders the e-ink widget: 5 agenda rows, 3 headlines', async () => {
    for (const path of ['/today.eink', '/today?view=eink']) {
      const { body } = await get(path);
      expect(body).toContain('data-theme="eink"');
      expect(count(body, /class="agenda__title"/g)).toBe(5);
      expect(count(body, /class="widget__headline"/g)).toBe(3);
    }
  });

  it('serves the archive and editions by date, 404 for unknown dates', async () => {
    expect((await get('/editions')).body).toContain('/editions/2026-10-28');
    const ed = await get('/editions/2026-10-30');
    expect(ed.status).toBe(200);
    expect(ed.body).toContain('Issue №8');
    expect((await get('/editions/2020-01-01')).status).toBe(404);
  });

  it('exposes the fake edition as JSON', async () => {
    const res = await app.request('/api/edition?lang=de');
    const json = (await res.json()) as { facts: { lang: string }; brief: { headline: string } };
    expect(json.facts.lang).toBe('de');
    expect(json.brief.headline.length).toBeLessThanOrEqual(60);
  });
});
