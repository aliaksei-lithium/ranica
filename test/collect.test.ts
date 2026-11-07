import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRss } from '../src/collect/rss';
import { parseTelegram } from '../src/collect/telegram';
import { MAX_BYTES, fetchCapped } from '../src/collect/fetch';
import { clip, decodeEntities, hash, htmlToText } from '../src/collect/text';
import { SOURCES } from '../src/collect/sources';
import app from '../src/index';
import tagesschauXml from './fixtures/rss-tagesschau.xml?raw';
import fazXml from './fixtures/rss-faz.xml?raw';
import bzXml from './fixtures/rss-berliner-zeitung.xml?raw';
import telegramHtml from './fixtures/telegram-zerkalo.html?raw';

const FIXTURES: Record<string, string> = {
  'rss-tagesschau.xml': tagesschauXml,
  'rss-faz.xml': fazXml,
  'rss-berliner-zeitung.xml': bzXml,
  'telegram-zerkalo.html': telegramHtml,
};
const fixture = (name: string) => FIXTURES[name]!;

describe('text helpers', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('&quot;a&quot; &amp; &#8722;4 &#x2014; &auml; &bogus;')).toBe('"a" & −4 — ä &bogus;');
  });
  it('turns HTML into plain text with line breaks', () => {
    expect(htmlToText('<p>Eins&nbsp; <b>zwei</b></p><p>drei<br/>vier</p>')).toBe('Eins zwei\ndrei\nvier');
  });
  it('clips on a word boundary', () => {
    expect(clip('ein zwei drei vier', 12)).toBe('ein zwei…');
    expect(clip('kurz', 12)).toBe('kurz');
  });
  it('hashes stably', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
    expect(hash('abc')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('RSS parser', () => {
  it('tagesschau: entities, content:encoded ignored when description exists, dedupe, empty titles skipped', () => {
    const items = parseRss(fixture('rss-tagesschau.xml'), 'tagesschau-inland');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: 'tagesschau-inland',
      externalId: 'c89daacc-bbf1-499a-8da1-7652895b4f69',
      url: 'https://www.tagesschau.de/inland/gesetz-100.html',
      title: 'Bundestag beschließt neues Gesetz',
      body: 'Der Bundestag hat am Freitag ein Gesetz beschlossen. Die Opposition kritisiert "Eile" & fehlende Debatte.',
      publishedAt: '2026-11-07T14:57:49.000Z',
    });
    expect(items[1]!.body).toBe('Nachts bis −4 Grad.');
  });

  it('FAZ: CDATA title and description with markup', () => {
    const [item] = parseRss(fixture('rss-faz.xml'), 'faz-ausland');
    expect(item!.title).toBe('Liveblog: Minister „will bald entscheiden“');
    expect(item!.body).toBe('Stehen bereit, zu helfen +++ Neue Angebote');
    expect(item!.externalId).toBe('https://www.faz.net/aktuell/politik/ausland/liveblog-201657223.html');
  });

  it('Berliner Zeitung: guid before title, invalid date → null', () => {
    const [item] = parseRss(fixture('rss-berliner-zeitung.xml'), 'berliner-zeitung');
    expect(item).toMatchObject({ externalId: '10573761', title: 'Filialen schließen: Hunderte Jobs bedroht', publishedAt: null });
  });

  it('respects the limit', () => {
    expect(parseRss(fixture('rss-tagesschau.xml'), 'x', { limit: 1 })).toHaveLength(1);
  });
});

describe('Telegram parser', () => {
  const posts = parseTelegram(fixture('telegram-zerkalo.html'), 'tg-zerkalo', 'zerkalo_io', 'zerkalo.io');

  it('skips posts without text and returns newest first', () => {
    expect(posts.map((p) => p.externalId)).toEqual(['zerkalo_io/102', 'zerkalo_io/101']);
  });

  it('first line is the title, boilerplate and bare links are dropped, canonical link preferred', () => {
    const p = posts[1]!;
    expect(p).toMatchObject({
      url: 'https://t.me/zerkalo_io/101',
      title: 'В Минске похолодает до −5.',
      body: 'Рассказываем о погоде на неделю.',
      publishedAt: '2026-11-07T15:10:32.000Z',
      link: 'https://news.zerkalo.io/life/1.html?tg=5',
    });
  });

  it('falls back to the first outbound link without linkHost', () => {
    const [, p] = parseTelegram(fixture('telegram-zerkalo.html'), 'tg', 'zerkalo_io');
    expect(p!.link).toBe('https://zerkalo-mirror.xyz/news/life/1.html?tg=5');
  });

  it('a one-line post has an empty body and no link', () => {
    expect(posts[0]).toMatchObject({ title: 'Главное за день & коротко.', body: '', link: null });
  });
});

describe('fetchCapped', () => {
  it('cuts the body at 512 kB and sends conditional headers', async () => {
    const big = 'x'.repeat(MAX_BYTES + 1000);
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>)['if-none-match']).toBe('"e1"');
      return new Response(big, { headers: { etag: '"e2"' } });
    });
    const r = await fetchCapped('https://feed.example/', { etag: '"e1"' }, fetcher as typeof fetch);
    expect(r).toMatchObject({ status: 200, bytes: MAX_BYTES, truncated: true, etag: '"e2"' });
    expect(r.text.length).toBe(MAX_BYTES);
  });

  it('returns an empty body on 304', async () => {
    const r = await fetchCapped('https://feed.example/', {}, (async () => new Response(null, { status: 304 })) as typeof fetch);
    expect(r).toMatchObject({ status: 304, text: '', bytes: 0 });
  });
});

describe('/probe/sources', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is hidden without PROBE_KEY or with a wrong key', async () => {
    expect((await app.request('/probe/sources')).status).toBe(404);
    expect((await app.request('/probe/sources?key=nope', {}, { PROBE_KEY: 'k' })).status).toBe(404);
  });

  it('fetches every source and reports status, items and errors', async () => {
    const rss = fixture('rss-tagesschau.xml');
    const tg = fixture('telegram-zerkalo.html');
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('faz.net')) throw new Error('connect timeout');
      if (url.includes('berliner-zeitung')) return new Response('blocked', { status: 403 });
      return new Response(url.startsWith('https://t.me/') ? tg : rss);
    });
    const res = await app.request('/probe/sources?key=k', {}, { PROBE_KEY: 'k' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: number; total: number; results: { id: string; ok: boolean; status: number | null; items: number; error?: string; sample?: string }[] };
    expect(body.total).toBe(SOURCES.length);
    const by = new Map(body.results.map((r) => [r.id, r]));
    expect(by.get('tagesschau-inland')).toMatchObject({ ok: true, status: 200, items: 2, sample: 'Bundestag beschließt neues Gesetz' });
    expect(by.get('tg-zerkalo')).toMatchObject({ ok: true, items: 2 });
    expect(by.get('faz-inland')).toMatchObject({ ok: false, status: null, error: 'connect timeout' });
    expect(by.get('berliner-zeitung')).toMatchObject({ ok: false, status: 403 });
    expect(body.ok).toBe(4);
  });
});
