import { env, exports } from 'cloudflare:workers';
import { createExecutionContext, createScheduledController, introspectWorkflow, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWeather } from '../src/collect/weather';
import { buildEditorInput, buildFacts, localNow, type Reader } from '../src/edition/facts';
import { validateBrief } from '../src/edit/validate';
import { fallbackBrief } from '../src/edit/fallback';
import { runEditor, EDITOR_MODEL, EditorRefusal } from '../src/edit/editor';
import { BriefSchema } from '../src/edit/schema';
import type { Brief } from '../src/edit/brief';
import type { UserItem } from '../src/db/queries';
import { insertItems, loadEdition, subscribeAllUsers, syncSources } from '../src/db/queries';
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
  telegram_digest: [{ channel: '@zerkalo_io', summary: 'One post about Minsk', points: ['Rent in Minsk'] }],
  insight: '', sport: null, german: { cards: [], new_word: { de: 'der Titel', en: 'title', example: 'Der Titel ist kurz.', from_item_id: 'n1' } },
  hobby_fact: null, on_this_day: { text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' }, tomorrow: 'Rain likely',
  deep: [{ rubric: 'Germany', item_id: 'n1', title: 'Longer', body: 'Five sentences.' }],
  back_news: [{ rubric: 'World', item_id: 'n3', title: 'World story', summary: 'More.' }],
  word_of_day: null, ...over,
});

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
    expect(w.weather.summary).toBe('Morning +4°, feels like 0°. Cloudy, rain from 15:00, wind up to 5 m/s. Up to +6° by 14:00.');
    expect(w.hourly.map((h) => h.hour)).toEqual(['06', '09', '12', '15', '18', '21']);
    expect(w.hourly[3]).toMatchObject({ rainPct: 70, windMs: 5 });
    expect(w.week).toHaveLength(7);
    expect(w.week[1]).toMatchObject({ date: '2026-11-08', sky: 'rain', rainPct: 80 });
    expect(w.forEditor.tomorrow).toBe('+5° / +1°, rain, rain 80 %');
  });

  it('writes German and says "trocken" without rain', () => {
    const w = parseWeather(openMeteo(99) as never, DATE, 'de');
    expect(w.weather.summary).toContain('Bewölkt, trocken, Wind bis 5 m/s');
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

describe('fallback editor', () => {
  it('picks newest items per rubric, Berliner Zeitung under Berlin, World on the back page', () => {
    const b = fallbackBrief(buildEditorInput(reader, DATE, items, parseWeather(openMeteo() as never, DATE, 'en')));
    expect(b.news.map((n) => [n.rubric, n.item_id])).toEqual([['Berlin', 'n4'], ['Berlin', 'n2'], ['Germany', 'n1']]);
    expect(b.back_news.map((n) => n.item_id)).toEqual(['n3']);
    expect(b.telegram_digest).toEqual([{ channel: '@zerkalo_io', summary: '1 post', points: ['Пост'] }]);
    expect(b.tomorrow).toBe('+5° / +1°, rain, rain 80 %');
    expect(BriefSchema.safeParse({ ...b, on_this_day: null }).success).toBe(true);
  });

  it('uses German rubric names for a German reader', () => {
    const b = fallbackBrief(buildEditorInput({ ...reader, locale: 'de' }, DATE, items, null));
    expect(new Set(b.news.map((n) => n.rubric))).toEqual(new Set(['Berlin', 'Deutschland']));
    expect(b.back_news[0]!.rubric).toBe('Welt');
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
      return Response.json(anthropicResponse(brief()));
    }) as typeof fetch;
    const r = await runEditor(input, { apiKey: 'sk-test', gatewayUrl: 'https://gateway.example/anthropic', fetch: fetcher });
    expect(sent).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } } });
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(String(sent.system)).toContain('Use only ids that appear in the input');
    expect(r.brief.headline).toBe('A calm Saturday');
    expect(r.brief.on_this_day).toEqual({ text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' });
    expect(r).toMatchObject({ model: EDITOR_MODEL, tokensIn: 9000, tokensOut: 3000, costCents: 9.6 });
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
      { sourceId: 'faz-ausland', externalId: 'c', url: 'https://t/3', title: 'Welt', body: 'Text.', publishedAt: now, hash: 'c1' },
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
    expect(out).toMatchObject({ date: DATE, issue: 1, editor: 'fallback', items: 3, error: 'no ANTHROPIC_API_KEY' });
    expect(weatherCalls).toBe(1);
    const e = await loadEdition(db, 1, DATE);
    expect(e!.facts.weather!.max).toBe(6);
    expect(e!.brief.news.map((n) => n.rubric)).toEqual(['Berlin', 'Germany']);

    const page = await (await exports.default.fetch('https://ranica.test/today')).text();
    expect(page).toContain('BVG');
    expect(page).toContain('Issue №1');
    expect(page).not.toContain('leave by 12:20'); // not the fake edition
    expect(await (await exports.default.fetch('https://ranica.test/today?fake=1')).text()).toContain('leave by 12:20');
    expect((await (await exports.default.fetch(`https://ranica.test/editions/${DATE}`)).text())).toContain('BVG');
  });

  it('a second run of the same day keeps the issue number; weather failure is shown, not fatal', async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    await run('a', DATE);
    const { out } = await run('b', DATE);
    expect(out.issue).toBe(1);
    const e = await loadEdition(db, 1, DATE);
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
  expect(await (await app.request('/today')).text()).toContain('leave by 12:20');
});
