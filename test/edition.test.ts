import { env, exports } from 'cloudflare:workers';
import { createExecutionContext, createScheduledController, introspectWorkflow, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWeather } from '../src/collect/weather';
import { buildEditorInput, buildFacts, localNow, type Reader } from '../src/edition/facts';
import { validateBrief } from '../src/edit/validate';
import { fallbackBrief } from '../src/edit/fallback';
import { runEditor, EDITOR_MODEL, EditorRefusal } from '../src/edit/editor';
import type { BriefOutput } from '../src/edit/schema';
import type { Brief } from '../src/edit/brief';
import type { UserItem } from '../src/db/queries';
import { insertItems, loadEdition, recentlyPrinted, subscribeAllUsers, syncSources } from '../src/db/queries';
import { SOURCES } from '../src/collect/sources';
import worker from '../src/index';
import { app } from '../src/app';
import { editionHour, REFRESH_CRON } from '../src/scheduled';
import type { EditionOutput } from '../src/workflows/edition';

const DATE = '2026-11-07';

/** A synthetic Open-Meteo response: 1 past day + 8 days, 24 hours each. */
function openMeteo(rainAt = 15) {
  const days = Array.from({ length: 9 }, (_, i) => new Date(Date.UTC(2026, 10, 6 + i)).toISOString().slice(0, 10));
  const hours = days.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  return {
    daily: {
      time: days,
      sunrise: days.map((d) => `${d}T07:13`),
      sunset: days.map((d) => `${d}T16:25`),
      daylight_duration: days.map((_, i) => 33_400 - i * 210),
      temperature_2m_max: days.map((_, i) => 6.4 - i * 0.5),
      temperature_2m_min: days.map(() => 0.6),
      weather_code: days.map((_, i) => (i === 1 ? 3 : 61)),
      precipitation_probability_max: days.map((_, i) => (i === 2 ? 80 : 10)),
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((t) => 1 + Math.min(+t.slice(11, 13), 14) * 0.35),
      apparent_temperature: hours.map((t) => -2 + Math.min(+t.slice(11, 13), 14) * 0.3),
      precipitation_probability: hours.map((t) => (t.startsWith(DATE) && +t.slice(11, 13) >= rainAt ? 70 : 0)),
      wind_speed_10m: hours.map(() => 4.6),
      weather_code: hours.map((t) => (t.startsWith(DATE) && +t.slice(11, 13) >= rainAt ? 61 : 3)),
    },
  };
}

const reader: Reader = {
  id: 1, name: 'Reader', editionTitle: 'Утренний', locale: 'en', learnerLevel: 'B1', timezone: 'Europe/Berlin',
  city: 'Berlin', lat: 52.52, lon: 13.405, wakeTime: '07:00', contextMd: '',
  autoRefresh: true, autoEdition: true, editionLangs: ['en'],
};

const userItem = (id: number, over: Partial<UserItem> = {}): UserItem => ({
  id, sourceId: 'tagesschau-inland', source: 'tagesschau', rubric: 'Germany', url: `https://www.tagesschau.de/${id}.html`,
  title: `Titel ${id}`, body: `Text zu ${id}.`, link: null, publishedAt: `2026-11-07T0${id % 10}:00:00.000Z`, ...over,
});

const items: UserItem[] = [
  userItem(1),
  userItem(2, { sourceId: 'tagesspiegel-berlin', source: 'Tagesspiegel', rubric: 'Berlin' }),
  userItem(3, { sourceId: 'faz-ausland', source: 'FAZ', rubric: 'World' }),
  userItem(4, { sourceId: 'berliner-zeitung', source: 'Berliner Zeitung', rubric: null }),
  userItem(5, { sourceId: 'tg-zerkalo', source: 'Зеркало', rubric: null, url: 'https://t.me/zerkalo_io/5', link: 'https://news.zerkalo.io/5.html', title: 'Пост' }),
];

const brief = (over: Partial<Brief> = {}): Brief => ({
  headline: 'A calm Saturday', weather_note: 'Rain from 15:00, take an umbrella.', agenda: [], tasks: [],
  news: [
    { rubric: 'Berlin', item_id: 'n2', title: 'Berlin story', summary: 'Two sentences.' },
    { rubric: 'Germany', item_id: 'n1', title: 'Germany story', summary: 'Two sentences.' },
  ],
  briefs: [],
  telegram_digest: [{ channel: '@zerkalo_io', summary: 'Один пост о Минске', points: ['Аренда в Минске'] }],
  insight: '', sport: null, german: { cards: [], new_word: { de: 'der Titel', en: 'title', example: 'Der Titel ist kurz.', from_item_id: 'n1' } },
  hobby_fact: null, on_this_day: { text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' }, tomorrow: 'Rain likely',
  deep: [{ rubric: 'Germany', item_id: 'n1', title: 'Longer', body: 'Five sentences.' }],
  back_news: [{ rubric: 'World', item_id: 'n3', title: 'World story', summary: 'More.' }],
  word_of_day: null, ...over,
});

/** The editor's raw output (BriefSchema shape): no nullable objects, empty string = none. */
const output = (): BriefOutput => {
  const b = brief();
  return {
    headline: b.headline, news: b.news.map((n) => ({ ...n, story: n.title })), briefs: [], telegram_digest: b.telegram_digest,
    insight: b.insight, tomorrow: b.tomorrow, deep: b.deep, back_news: b.back_news.map((n) => ({ ...n, story: n.title })),
    talk: { topic: 'Union schlägt Leipzig', text: 'Ganz Köpenick feiert.', item_id: '', story: 'Union', also: ['Til Schweiger'] },
    new_word: { de: 'der Titel', en: 'title', example: 'Der Titel ist kurz.', from_item_id: 'n1' },
    on_this_day: { text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' },
    word_of_day: { de: '', en: '', example: '', extra: '' },
    glossary: [],
  };
};

/** A Messages API response body carrying `brief` as the JSON text output. */
const anthropicResponse = (b: unknown, over: Record<string, unknown> = {}) => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: EDITOR_MODEL,
  content: [{ type: 'text', text: JSON.stringify(b) }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 9000, output_tokens: 3000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...over,
});

describe('weather', () => {
  it('summarises the day, the sun, hours and week from Open-Meteo', () => {
    const w = parseWeather(openMeteo() as never, DATE, 'en');
    expect(w.sun).toEqual({ sunrise: '07:13', sunset: '16:25', dayMinutes: 553, deltaMinutes: -4 });
    expect(w.weather.max).toBe(6);
    expect(w.weather.summary).toBe('Cloudy, rain from 15:00. Morning +4°, feels 0°.');
    expect(w.hourly.map((h) => h.hour)).toEqual(['06', '09', '12', '15', '18', '21']);
    expect(w.hourly[3]).toMatchObject({ rainPct: 70, windMs: 5 });
    expect(w.week).toHaveLength(7);
    expect(w.week[1]).toMatchObject({ date: '2026-11-08', sky: 'rain', rainPct: 80 });
    expect(w.forEditor.tomorrow).toBe('+5° / +1°, rain, rain 80 %');
  });

  it('writes German and says "trocken" without rain', () => {
    const w = parseWeather(openMeteo(99) as never, DATE, 'de');
    expect(w.weather.summary).toBe('Bewölkt, trocken. Morgens +4°, gefühlt 0°.');
    expect(w.forEditor.rainFromHour).toBeNull();
  });
});

describe('facts and editor input', () => {
  it('maps items to n<id>, Telegram to its channel and article link', () => {
    const f = buildFacts({ reader, date: DATE, issue: 3, generatedAt: '06:05', items, weather: null, weatherError: 'Open-Meteo timeout', publicUrl: 'x/today' });
    expect(f.items.map((i) => i.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    expect(f.items[4]).toEqual({ id: 'n5', source: '@zerkalo_io', url: 'https://news.zerkalo.io/5.html' });
    expect(f.telegram).toEqual([{ channel: '@zerkalo_io', posts: 1 }]);
    expect(f.unavailable).toEqual({ weather: 'Open-Meteo timeout' });
    expect(f.sourcesCount).toBe(5);
    const input = buildEditorInput(reader, DATE, items, null);
    expect(input.items.map((i) => i.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(input.telegram).toEqual([{ channel: '@zerkalo_io', items: [expect.objectContaining({ id: 'n5', title: 'Пост' })] }]);
    expect(input.weekday).toBe('Saturday');
  });

  it('localNow gives the reader-local date and hour', () => {
    expect(localNow(new Date('2026-11-07T23:30:00Z'), 'Europe/Berlin')).toEqual({ date: '2026-11-08', time: '00:30', hour: 0 });
  });

  it('editionHour is the hour containing wake time − 30 min', () => {
    expect(editionHour('07:00')).toBe(6);
    expect(editionHour('07:45')).toBe(7);
    expect(editionHour('00:10')).toBe(23);
  });
});

describe('validateBrief', () => {
  const known = { items: new Set(['n1', 'n2', 'n3']), events: new Set<string>(), tasks: new Set<string>(), cards: new Set<string>(), channels: new Set(['@zerkalo_io']) };

  it('drops unknown ids and duplicate items, clips long text', () => {
    const { brief: b, dropped } = validateBrief(brief({
      headline: 'x'.repeat(90),
      agenda: [{ event_id: 'e1', note: 'invented' }],
      news: [...brief().news, { rubric: 'World', item_id: 'n99', title: 'Made up', summary: '' }, { rubric: 'World', item_id: 'n1', title: 'Again', summary: '' }],
      back_news: [{ rubric: 'World', item_id: 'n2', title: 'Front item again', summary: '' }, ...brief().back_news],
      telegram_digest: [...brief().telegram_digest, { channel: '@other', summary: '', points: [] }],
      german: { cards: [{ card_id: 'c1', example: '' }], new_word: { de: 'x', en: 'x', example: 'x', from_item_id: 'n42' } },
    }), known);
    expect(b.headline.length).toBe(60);
    expect(b.agenda).toEqual([]);
    expect(b.news.map((n) => n.item_id)).toEqual(['n2', 'n1']);
    expect(b.back_news.map((n) => n.item_id)).toEqual(['n3']);
    expect(b.telegram_digest.map((t) => t.channel)).toEqual(['@zerkalo_io']);
    expect(b.german).toEqual({ cards: [], new_word: null });
    expect(dropped).toEqual(expect.arrayContaining(['event e1', 'news n99', 'news n1', 'news n2', 'channel @other', 'card c1', 'new_word n42']));
  });
});

it('rubric names keep only the reader-language part', async () => {
  const { rubricName } = await import('../src/edit/validate');
  expect(rubricName('Germany/Deutschland', 'en')).toBe('Germany');
  expect(rubricName('World / Welt', 'de')).toBe('Welt');
  expect(rubricName('Berlin', 'de')).toBe('Berlin');
});

describe('fallback editor', () => {
  it('picks newest items per rubric, Berliner Zeitung under Berlin; Telegram stays Russian', () => {
    const b = fallbackBrief(buildEditorInput(reader, DATE, items, parseWeather(openMeteo() as never, DATE, 'en')));
    expect(b.news.map((n) => [n.rubric, n.item_id])).toEqual([['Berlin', 'n4'], ['Berlin', 'n2'], ['Germany', 'n1'], ['World', 'n3']]);
    expect(b.telegram_digest).toEqual([{ channel: '@zerkalo_io', summary: '1 пост', points: ['Пост'] }]);
    expect(b.tomorrow).toBe('+5° / +1°, rain, rain 80 %');
  });

  it('uses German rubric names for a German reader', () => {
    const b = fallbackBrief(buildEditorInput({ ...reader, locale: 'de' }, DATE, items, null));
    expect(new Set(b.news.map((n) => n.rubric))).toEqual(new Set(['Berlin', 'Deutschland', 'Welt']));
  });
});

describe('Claude editor', () => {
  const input = buildEditorInput(reader, DATE, items, null);

  it('sends model, effort, fallbacks and schema; parses the brief and the cost', async () => {
    let sent: Record<string, unknown> = {};
    let headers = new Headers();
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://gateway.example/anthropic/v1/messages');
      sent = JSON.parse(String(init!.body));
      headers = new Headers(init!.headers);
      return Response.json(anthropicResponse(output()));
    }) as typeof fetch;
    const r = await runEditor(input, { apiKey: 'sk-test', gatewayUrl: 'https://gateway.example/anthropic', fetch: fetcher });
    expect(sent).toMatchObject({ model: 'claude-sonnet-5-5', fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } } });
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(String(sent.system)).toContain('Use only ids that appear in the input');
    expect(r.brief.headline).toBe('A calm Saturday');
    expect(r.brief.on_this_day).toEqual({ text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' });
    expect(r.brief.german.new_word).toMatchObject({ de: 'der Titel', from_item_id: 'n1' });
    expect(r.brief.word_of_day).toBeNull(); // empty strings mean "none"
    expect(r.brief).toMatchObject({ agenda: [], tasks: [], sport: null, hobby_fact: null });
    expect(r.brief.talk).toMatchObject({ topic: 'Union schlägt Leipzig', item_id: null, also: ['Til Schweiger'] });
    const schema = JSON.stringify((sent.output_config as { format: { schema: unknown } }).format.schema);
    expect(schema).not.toContain('anyOf'); // nullable unions blow up the compiled grammar
    expect(r).toMatchObject({ model: EDITOR_MODEL, tokensIn: 9000, tokensOut: 3000, costCents: 4.8 });
  });

  it('Haiku: no server-side fallbacks, Haiku prices', async () => {
    let sent: Record<string, unknown> = {};
    let headers = new Headers();
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      sent = JSON.parse(String(init!.body));
      headers = new Headers(init!.headers);
      return Response.json(anthropicResponse(output(), { model: 'claude-haiku-5-5' }));
    }) as typeof fetch;
    const r = await runEditor(input, { apiKey: 'sk-test', model: 'claude-haiku-5-5', fetch: fetcher });
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent).not.toHaveProperty('fallbacks');
    expect(headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
    expect(r.costCents).toBe(0.24);
  });

  it('turns a refusal into EditorRefusal', async () => {
    const fetcher = (async () => Response.json(anthropicResponse({}, { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: '' } }))) as typeof fetch;
    await expect(runEditor(input, { apiKey: 'sk-test', fetch: fetcher })).rejects.toBeInstanceOf(EditorRefusal);
  });
});

describe('EditionWorkflow', () => {
  const db = env.DB;
  beforeEach(async () => {
    await db.batch(['DELETE FROM edition', 'DELETE FROM item', 'DELETE FROM subscription', 'DELETE FROM source', 'DELETE FROM profile', 'DELETE FROM user'].map((q) => db.prepare(q)));
    await db.prepare(`INSERT INTO user (id, name, city, lat, lon, locale, learner_level, wake_time) VALUES (1, 'Reader', 'Berlin', 52.52, 13.405, 'en', 'B1', '07:00')`).run();
    await syncSources(db, SOURCES);
    await subscribeAllUsers(db);
    const now = new Date().toISOString();
    await insertItems(db, [
      { sourceId: 'tagesschau-inland', externalId: 'a', url: 'https://t/1', title: 'Bundestag', body: 'Text.', publishedAt: now, hash: 'a1' },
      { sourceId: 'tagesspiegel-berlin', externalId: 'b', url: 'https://t/2', title: 'BVG', body: 'Text.', publishedAt: now, hash: 'b1' },
      { sourceId: 'tagesschau-ausland', externalId: 'c', url: 'https://t/3', title: 'Welt', body: 'Text.', publishedAt: now, hash: 'c1' },
    ], now);
  });
  afterEach(() => vi.unstubAllGlobals());

  const run = async (id: string, date: string) => {
    await using wf = await introspectWorkflow(env.EDITION);
    await wf.modifyAll(async (m) => { await m.disableRetryDelays(); });
    const res = await exports.default.fetch(`https://ranica.test/admin/edition?key=test-key&date=${date}`, { method: 'POST' });
    expect(res.status).toBe(202);
    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    return { id, out: (await instance!.getOutput()) as EditionOutput };
  };

  it('without an API key: fallback editor, stored, served at /today', async () => {
    let weatherCalls = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url).startsWith('https://api.open-meteo.com/')) return weatherCalls++, Response.json(openMeteo());
      throw new Error(`unexpected fetch ${url}`);
    });
    const { out } = await run('a', DATE);
    expect(out).toMatchObject({ date: DATE, issue: 1, items: 3, refreshed: null, editions: [{ lang: 'en', editor: 'fallback', error: 'no ANTHROPIC_API_KEY' }] });
    expect(weatherCalls).toBe(1);
    const e = await loadEdition(db, 1, { date: DATE });
    expect(e!.facts.weather!.max).toBe(6);
    expect(e!.brief.news.map((n) => n.rubric)).toEqual(['Berlin', 'Germany', 'World']);

    const page = await (await exports.default.fetch('https://ranica.test/today')).text();
    expect(page).toContain('BVG');
    expect(page).toContain('Issue №1');
    expect(page).not.toContain('Sign today, fly cheaper'); // not the fake edition
    expect(await (await exports.default.fetch('https://ranica.test/today?fake=1')).text()).toContain('Sign today, fly cheaper');
    expect((await (await exports.default.fetch(`https://ranica.test/editions/${DATE}`)).text())).toContain('BVG');
  });

  it('a second run of the same day keeps the issue number; weather failure is shown, not fatal', async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    await run('a', DATE);
    const { out } = await run('b', DATE);
    expect(out.issue).toBe(1);
    const e = await loadEdition(db, 1, { date: DATE });
    expect(e!.facts.weather).toBeNull();
    expect(e!.facts.unavailable).toEqual({ weather: 'Open-Meteo' });
  });

  it('the hourly cron starts the edition only in the edition hour', async () => {
    vi.stubGlobal('fetch', async (url: string) => (String(url).includes('open-meteo') ? Response.json(openMeteo()) : new Response('', { status: 404 })));
    await using wf = await introspectWorkflow(env.EDITION);
    const at = async (iso: string) => {
      const ctx = createExecutionContext();
      await worker.scheduled(createScheduledController({ cron: REFRESH_CRON, scheduledTime: new Date(iso) }), env, ctx);
      await waitOnExecutionContext(ctx);
    };
    await at('2026-11-07T04:00:00Z'); // 05:00 Berlin: too early
    expect(await wf.get()).toHaveLength(0);
    await at('2026-11-07T05:00:00Z'); // 06:00 Berlin: edition hour for wake 07:00
    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    expect(((await instance!.getOutput()) as EditionOutput).date).toBe(DATE);
  });
});

it('the fake edition still renders without a database', async () => {
  expect(await (await app.request('/today')).text()).toContain('Sign today, fly cheaper');
});

describe('front page layout', () => {
  it('caps front rubrics at 4 items; one-liners skip items already on the front', () => {
    const known = { items: new Set(['n1', 'n2', 'n3', 'n4', 'n5', 'n6']), events: new Set<string>(), tasks: new Set<string>(), cards: new Set<string>(), channels: new Set<string>() };
    const five = ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => ({ rubric: 'Germany', item_id: id, title: id, summary: '' }));
    const briefs = [{ rubric: 'Germany', item_id: 'n1', text: 'again' }, { rubric: 'Germany', item_id: 'n6', text: 'x'.repeat(150) }];
    const { brief: b, dropped } = validateBrief(brief({ news: five, briefs, back_news: [] }), known);
    expect(b.news.map((n) => n.item_id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(dropped).toEqual(expect.arrayContaining(['over limit n5', 'brief n1']));
    expect(b.briefs!.map((x) => [x.item_id, x.text.length])).toEqual([['n6', 150]]); // up to 180 characters now
  });

  it('lead row, one news flow with one-liners last; extra items and one-liners are trimmable', async () => {
    const { renderEdition } = await import('../src/compose/compose');
    const facts = buildFacts({ reader, date: DATE, issue: 1, generatedAt: '06:00', items, weather: null, publicUrl: 'x/today' });
    const b = brief({
      news: [
        { rubric: 'Germany', item_id: 'n1', title: 'G1', summary: '' },
        { rubric: 'Berlin', item_id: 'n2', title: 'B1', summary: '' },
        { rubric: 'Berlin', item_id: 'n4', title: 'B2', summary: '' },
        { rubric: 'Berlin', item_id: 'n5', title: 'B3', summary: '' },
      ],
      briefs: [{ rubric: 'World', item_id: 'n3', text: 'One line' }],
      insight: 'Two facts connected.',
    });
    const html = renderEdition({ facts, brief: b }, 'print', { backPage: true, nav: { langs: ['en', 'de'], path: '/today' } });
    const lead = html.slice(html.indexOf('class="lead"'), html.indexOf('class="flow"'));
    const flow = html.slice(html.indexOf('class="flow"'), html.indexOf('<footer'));
    const back = html.slice(html.indexOf('sheet--page2'));
    expect(lead).toContain('data-block="insight"');
    expect(flow.indexOf('id="germany"')).toBeLessThan(flow.indexOf('id="berlin"'));
    expect(flow.indexOf('id="berlin"')).toBeLessThan(flow.indexOf('One line'));
    expect(html.match(/data-block="newsextra"/g)).toHaveLength(1);
    expect(html.match(/data-block="brief"/g)).toHaveLength(1);
    expect(flow).not.toContain('From Telegram'); // Telegram and the German word are on the back page now
    expect(flow).not.toContain('der Titel');
    expect(back).toContain('class="digest__list" lang="ru"'); // the Russian digest keeps its language
    expect(back).toContain('der Titel');
    expect(html).toContain('href="/today?lang=de&amp;view=print"');
  });
});

describe('settings, languages and manual rebuild', () => {
  const db = env.DB;
  beforeEach(async () => {
    await db.batch(['DELETE FROM edition', 'DELETE FROM item', 'DELETE FROM subscription', 'DELETE FROM source', 'DELETE FROM profile', 'DELETE FROM user'].map((q) => db.prepare(q)));
    await db.prepare(`INSERT INTO user (id, name, city, lat, lon, wake_time, edition_langs) VALUES (1, 'Reader', 'Berlin', 52.52, 13.405, '07:00', 'en,de')`).run();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saving the form turns the schedule off; the cron then starts nothing', async () => {
    const form = new URLSearchParams([['lang', 'de'], ['wakeTime', '06:30']]); // both checkboxes unticked
    const res = await exports.default.fetch('https://ranica.test/admin/settings?key=test-key', { method: 'POST', body: form, redirect: 'manual' });
    expect(res.status).toBe(303);
    const r = await db.prepare('SELECT auto_refresh, auto_edition, edition_langs, wake_time FROM user WHERE id = 1').first();
    expect(r).toEqual({ auto_refresh: 0, auto_edition: 0, edition_langs: 'de', wake_time: '06:30' });

    await using refresh = await introspectWorkflow(env.SOURCE_REFRESH);
    await using edition = await introspectWorkflow(env.EDITION);
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: REFRESH_CRON, scheduledTime: new Date('2026-11-07T04:00:00Z') }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await refresh.get()).toHaveLength(0);
    expect(await edition.get()).toHaveLength(0);
  });

  it('the settings page needs the key and shows the switches', async () => {
    const login = await exports.default.fetch('https://ranica.test/admin');
    expect(login.status).toBe(200);
    const form = await login.text();
    expect(form).toContain('action="/admin/login"');
    expect(form).not.toContain('name="autoRefresh"');
    expect((await exports.default.fetch('https://ranica.test/admin/sources')).status).toBe(404); // the JSON routes stay hidden
    const html = await (await exports.default.fetch('https://ranica.test/admin?key=test-key')).text();
    expect(html).toContain('name="autoRefresh"');
    expect(html).toContain('Rebuild today');
    expect(html).toContain('action="/admin/rebuild?key=test-key"');
  });

  it('the login form remembers the key in a cookie; a wrong key is refused', async () => {
    const post = (key: string) =>
      exports.default.fetch('https://ranica.test/admin/login', { method: 'POST', body: new URLSearchParams([['key', key]]), redirect: 'manual' });
    const wrong = await post('nope');
    expect(wrong.headers.get('location')).toBe('/admin?wrong=1');
    expect(wrong.headers.get('set-cookie')).toBeNull();
    expect((await exports.default.fetch('https://ranica.test/admin?wrong=1')).status).toBe(401);

    const ok = await post('test-key');
    expect(ok.headers.get('location')).toBe('/admin');
    const setCookie = ok.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/admin_key=test-key;.*HttpOnly/);
    const cookie = setCookie.split(';')[0]!;
    const html = await (await exports.default.fetch('https://ranica.test/admin', { headers: { cookie } })).text();
    expect(html).toContain('action="/admin/rebuild"'); // no key in the URLs
    expect(html).toContain('Log out');
    const rebuildPage = await exports.default.fetch('https://ranica.test/admin/settings', {
      method: 'POST', headers: { cookie }, body: new URLSearchParams([['lang', 'de'], ['wakeTime', '07:00']]), redirect: 'manual',
    });
    expect(rebuildPage.headers.get('location')).toBe('/admin');
  });

  it('the page links to admin', async () => {
    expect(await (await exports.default.fetch('https://ranica.test/editions')).text()).toContain('href="/admin"');
  });

  it('Rebuild now refreshes sources, then builds every chosen language; /today switches language', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url);
      if (u.includes('open-meteo')) return Response.json(openMeteo());
      if (u.startsWith('https://t.me/')) return new Response('<html></html>');
      return new Response(`<rss><channel><item><title>Neu ${u.length}</title><link>${u}#1</link><guid>${u}</guid><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
    });
    await using wf = await introspectWorkflow(env.EDITION);
    await wf.modifyAll(async (m) => { await m.disableRetryDelays(); });
    const res = await exports.default.fetch('https://ranica.test/admin/rebuild?key=test-key', { method: 'POST', redirect: 'manual' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toMatch(/run=/);
    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    const out = (await instance!.getOutput()) as EditionOutput;
    expect(out.refreshed).toBe(SOURCES.length - 1); // one item per RSS feed, none from Telegram
    expect(out.editions.map((e) => e.lang)).toEqual(['en', 'de']);

    expect(await (await exports.default.fetch('https://ranica.test/today')).text()).toContain('<html lang="de"'); // default
    // The choice is remembered: ?lang=en sets a cookie, and /today without ?lang then stays English.
    const choose = await exports.default.fetch('https://ranica.test/today?lang=en');
    const cookie = choose.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('lang=en');
    const again = await exports.default.fetch('https://ranica.test/today', { headers: { cookie: cookie.split(';')[0] ?? '' } });
    expect(await again.text()).toContain('<html lang="en"');
    const de = await (await exports.default.fetch('https://ranica.test/today?lang=de')).text();
    expect(de).toContain('<html lang="de"');
    expect(de).toContain('<strong>Deutsch</strong>');
    expect(de).toContain('href="/today?lang=en"');
    const en = await (await exports.default.fetch(`https://ranica.test/editions/${out.date}?lang=en`)).text();
    expect(en).toContain('<html lang="en"');
  });
});

describe('review 2026-11-09: no repeats, three days, German word list', () => {
  const known = { lang: 'de' as const, items: new Set(['n1', 'n2', 'n3']), events: new Set<string>(), tasks: new Set<string>(), cards: new Set<string>(), channels: new Set<string>() };

  it('long articles only for front items, one each; glossary deduped, dropped for English', () => {
    const { brief: b, dropped } = validateBrief(brief({
      deep: [
        { rubric: 'Germany', item_id: 'n1', title: 'L', body: 'Long.' },
        { rubric: 'Germany', item_id: 'n1', title: 'Again', body: 'Twice.' },
        { rubric: 'World', item_id: 'n3', title: 'Back', body: 'Not on the front.' },
      ],
      glossary: [{ de: 'die Nominierung', en: 'nomination' }, { de: 'Die Nominierung', en: 'again' }, { de: '', en: 'x' }, { de: 'der Titel ', en: 'the new word again' }],
    }), known);
    expect(b.deep.map((d) => d.item_id)).toEqual(['n1']);
    expect(dropped).toEqual(expect.arrayContaining(['deep n1', 'deep n3']));
    expect(b.glossary).toEqual([{ de: 'die Nominierung', en: 'nomination' }]);
    expect(validateBrief(brief({ glossary: [{ de: 'x', en: 'y' }] }), { ...known, lang: 'en' }).brief.glossary).toEqual([]);
  });

  it('the long article replaces the summary on the front and is not repeated on page 2', async () => {
    const { renderEdition } = await import('../src/compose/compose');
    const facts = buildFacts({ reader, date: DATE, issue: 1, generatedAt: '06:00', items, weather: parseWeather(openMeteo() as never, DATE, 'en'), publicUrl: 'x/today' });
    const html = renderEdition({ facts, brief: brief({ deep: [{ rubric: 'Germany', item_id: 'n1', title: 'Longer', body: 'The long article text.' }], glossary: [{ de: 'die Nominierung', en: 'nomination' }] }) }, 'print');
    const front = html.slice(0, html.indexOf('sheet--page2'));
    const back = html.slice(html.indexOf('sheet--page2'));
    expect(front).toContain('item item--long');
    expect(front).toContain('The long article text.');
    expect(back).not.toContain('The long article text.');
    expect(back).not.toContain('data-block="depth"');
    expect(back.match(/class="week__day"/g)).toHaveLength(3); // next three days
    expect(back).toContain('die Nominierung');
    expect(back).toContain('harder words from today');
  });
});

describe('review 2026-11-21: Stadtgespräch, one story once, nothing from the last two days', () => {
  const known = { lang: 'de' as const, items: new Set(['n1', 'n2', 'n3', 'n4', 'n7']), events: new Set<string>(), tasks: new Set<string>(), cards: new Set<string>(), channels: new Set<string>() };

  it('trending searches go to the editor apart from the news, Berlin first, with recent headlines', () => {
    const trend = (id: number, sourceId: string) => userItem(id, { sourceId, source: 'Google Trends', rubric: null, title: `trend ${id}`, body: '500+ searches.' });
    const input = buildEditorInput(reader, DATE, [...items, trend(7, 'trends-de'), trend(8, 'trends-berlin')], null, ['Jugendproteste in Dutzenden Städten']);
    expect(input.items.map((i) => i.id)).not.toContain('n7');
    expect(input.trending.map((t) => [t.region, t.items.map((i) => i.id)])).toEqual([['Berlin', ['n8']], ['Deutschland', ['n7']]]);
    expect(input.printed_recently).toEqual(['Jugendproteste in Dutzenden Städten']);
    expect(fallbackBrief(input).talk).toBeNull();
    expect(fallbackBrief(input).news.map((n) => n.item_id)).not.toContain('n8');
  });

  it('the Stadtgespräch story wins; a second pick of the same story is dropped everywhere', () => {
    const { brief: b, dropped } = validateBrief(brief({
      talk: { topic: 'Gen Z auf der Straße', text: 'Zehntausende Jugendliche demonstrieren.', item_id: 'n4', story: 'Gen-Z-Proteste', also: ['Til Schweiger', '', 'a', 'b', 'c'] },
      news: [
        { rubric: 'Deutschland', item_id: 'n1', title: 'Jugendliche demonstrieren', summary: '.', story: 'gen z proteste' },
        { rubric: 'Berlin', item_id: 'n2', title: 'Senat', summary: '.', story: 'Senat' },
        { rubric: 'Berlin', item_id: 'n4', title: 'Talk item again', summary: '.', story: 'anders' },
      ],
      briefs: [{ rubric: 'Berlin', item_id: 'n7', text: 'Senat, anders erzählt', story: 'SENAT' }],
      back_news: [{ rubric: 'Berlin', item_id: 'n3', title: '„Gen Z regelt“-Demo zieht durch Berlin', summary: '.', story: 'Gen-Z-Proteste' }],
    }), known);
    expect(b.talk).toMatchObject({ topic: 'Gen Z auf der Straße', item_id: 'n4', also: ['Til Schweiger', 'a', 'b', 'c'] });
    expect(b.news.map((n) => n.item_id)).toEqual(['n2']);
    expect(b.briefs).toEqual([]);
    expect(b.back_news).toEqual([]);
    expect(dropped).toEqual(expect.arrayContaining(['same story n1', 'news n4', 'same story n7', 'same story n3']));
    expect(validateBrief(brief({ talk: { topic: 'x', text: 'y', item_id: 'n99', also: [] } }), known).brief.talk!.item_id).toBeNull();
  });

  it('the front page opens the news with the Stadtgespräch', async () => {
    const { renderEdition } = await import('../src/compose/compose');
    const facts = buildFacts({ reader: { ...reader, locale: 'de' }, date: DATE, issue: 1, generatedAt: '06:00', items, weather: null, publicUrl: 'x/today' });
    const html = renderEdition({ facts, brief: brief({ talk: { topic: 'Union schlägt Leipzig', text: 'Köpenick feiert.', item_id: 'n2', also: ['Til Schweiger', 'Gladbach – BVB'] } }) }, 'print');
    const flow = html.slice(html.indexOf('class="flow"'));
    expect(flow.indexOf('class="talk"')).toBeLessThan(flow.indexOf('class="rubric"'));
    expect(html).toContain('Stadtgespräch');
    expect(html).toContain('href="https://www.tagesschau.de/2.html">Union schlägt Leipzig</a>');
    expect(html).toContain('Til Schweiger · Gladbach – BVB');
    expect(html).toContain('data-block="talk" data-priority="2"');
  });

  it('the workflow leaves out items printed yesterday and tells the editor their headlines', async () => {
    const db = env.DB;
    await db.batch(['DELETE FROM edition', 'DELETE FROM item', 'DELETE FROM subscription', 'DELETE FROM source', 'DELETE FROM profile', 'DELETE FROM user'].map((q) => db.prepare(q)));
    await db.prepare(`INSERT INTO user (id, name, city, lat, lon, locale, learner_level, wake_time) VALUES (1, 'Reader', 'Berlin', 52.52, 13.405, 'en', 'B1', '07:00')`).run();
    await syncSources(db, SOURCES);
    await subscribeAllUsers(db);
    const now = new Date().toISOString();
    await insertItems(db, [
      { sourceId: 'tagesschau-inland', externalId: 'old', url: 'https://t/old', title: 'Printed yesterday', body: 'Text.', publishedAt: now, hash: 'o1' },
      { sourceId: 'tagesschau-inland', externalId: 'new', url: 'https://t/new', title: 'Fresh story', body: 'Text.', publishedAt: now, hash: 'n1' },
    ], now);
    const old = await db.prepare(`SELECT id FROM item WHERE external_id = 'old'`).first<{ id: number }>();
    const yesterday = new Date(Date.parse(`${DATE}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    await db.prepare(`INSERT INTO edition (user_id, date, lang, issue, status, facts_json, brief_json) VALUES (1, ?1, 'en', 1, 'ready', '{}', ?2)`)
      .bind(yesterday, JSON.stringify(brief({ news: [{ rubric: 'Germany', item_id: `n${old!.id}`, title: 'Printed yesterday', summary: '.' }], back_news: [], deep: [] }))).run();
    expect((await recentlyPrinted(db, 1, DATE, 'en')).titles).toEqual(['Printed yesterday']);
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    await using wf = await introspectWorkflow(env.EDITION);
    await wf.modifyAll(async (m) => { await m.disableRetryDelays(); });
    await exports.default.fetch(`https://ranica.test/admin/edition?key=test-key&date=${DATE}`, { method: 'POST' });
    const [instance] = await wf.get();
    await instance!.waitForStatus('complete');
    expect(((await instance!.getOutput()) as EditionOutput).items).toBe(1);
    const e = await loadEdition(db, 1, { date: DATE });
    expect(e!.brief.news.map((n) => n.title)).toEqual(['Fresh story']);
    vi.unstubAllGlobals();
  });
});
