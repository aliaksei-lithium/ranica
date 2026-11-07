// Open-Meteo forecast (no key): today's summary, sun times, the hourly table and the week
// (docs/02-plan.md §2, blocks B/C and the back page). One request per edition.
import type { Facts, Lang } from '../model';

const SKY: Record<Lang, [number[], string][]> = {
  en: [
    [[0], 'clear'], [[1, 2], 'partly cloudy'], [[3], 'cloudy'], [[45, 48], 'fog'],
    [[51, 53, 55, 56, 57], 'drizzle'], [[61, 63, 65, 66, 67], 'rain'], [[71, 73, 75, 77], 'snow'],
    [[80, 81, 82], 'showers'], [[85, 86], 'snow showers'], [[95, 96, 99], 'thunderstorms'],
  ],
  de: [
    [[0], 'klar'], [[1, 2], 'heiter'], [[3], 'bewölkt'], [[45, 48], 'Nebel'],
    [[51, 53, 55, 56, 57], 'Niesel'], [[61, 63, 65, 66, 67], 'Regen'], [[71, 73, 75, 77], 'Schnee'],
    [[80, 81, 82], 'Schauer'], [[85, 86], 'Schneeschauer'], [[95, 96, 99], 'Gewitter'],
  ],
};

export const sky = (code: number, lang: Lang): string => SKY[lang].find(([codes]) => codes.includes(code))?.[1] ?? '—';
const WET = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

const r = (n: number) => Math.round(n);
const fmt = (n: number) => (r(n) > 0 ? `+${r(n)}` : r(n) < 0 ? `−${Math.abs(r(n))}` : '0');

export interface OpenMeteo {
  daily: {
    time: string[]; sunrise: string[]; sunset: string[]; daylight_duration: number[];
    temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; precipitation_probability_max: number[];
  };
  hourly: {
    time: string[]; temperature_2m: number[]; apparent_temperature: number[];
    precipitation_probability: number[]; wind_speed_10m: number[]; weather_code: number[];
  };
}

export interface WeatherFacts {
  sun: NonNullable<Facts['sun']>;
  weather: NonNullable<Facts['weather']>;
  hourly: Facts['hourly'];
  week: { date: string; hi: number; lo: number; sky: string; rainPct: number }[];
  /** Plain facts for the editor (it writes the advice line and "tomorrow"). */
  forEditor: { today: string; tomorrow: string; rainFromHour: string | null };
}

export function forecastUrl(lat: number, lon: number, timezone: string): string {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone, forecast_days: '8', past_days: '1', wind_speed_unit: 'ms',
    daily: 'sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code',
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

/** Turn an Open-Meteo response into the page's weather facts for local date `date`. */
export function parseWeather(json: OpenMeteo, date: string, lang: Lang): WeatherFacts {
  const d = json.daily;
  const i = d.time.indexOf(date);
  if (i < 1) throw new Error(`forecast has no ${date}`);
  const time = (iso: string) => iso.slice(11, 16);
  const dayMin = (k: number) => r(d.daylight_duration[k]! / 60);

  const hours = json.hourly.time.flatMap((t, k) => (t.startsWith(date) ? [k] : []));
  const at = (hh: string) => hours.find((k) => json.hourly.time[k]!.endsWith(`T${hh}:00`));
  const hourly = ['06', '09', '12', '15', '18', '21'].flatMap((hh) => {
    const k = at(hh);
    if (k === undefined) return [];
    const h = json.hourly;
    return [{ hour: hh, temp: r(h.temperature_2m[k]!), feels: r(h.apparent_temperature[k]!), rainPct: r(h.precipitation_probability[k]!), windMs: r(h.wind_speed_10m[k]!) }];
  });

  const h = json.hourly;
  const day = hours.filter((k) => { const hh = +h.time[k]!.slice(11, 13); return hh >= 7 && hh <= 21; });
  const morning = at('08') ?? day[0]!;
  const peak = day.reduce((a, b) => (h.temperature_2m[b]! > h.temperature_2m[a]! ? b : a), day[0]!);
  const windMax = r(Math.max(...day.map((k) => h.wind_speed_10m[k]!)));
  const rainHour = day.find((k) => h.precipitation_probability[k]! >= 50 || WET.has(h.weather_code[k]!) && h.precipitation_probability[k]! >= 30);
  const skyToday = sky(d.weather_code[i]!, lang);
  const rainFromHour = rainHour === undefined ? null : time(h.time[rainHour]!);

  const wetDay = WET.has(d.weather_code[i]!);
  const dry = { en: wetDay ? 'mostly dry' : 'dry', de: wetDay ? 'meist trocken' : 'trocken' }[lang];
  const summary =
    lang === 'de'
      ? `Morgens ${fmt(h.temperature_2m[morning]!)}°, gefühlt ${fmt(h.apparent_temperature[morning]!)}°. ${cap(skyToday)}, ` +
        `${rainFromHour ? `Regen ab ${rainFromHour}` : dry}, Wind bis ${windMax} m/s. Bis ${time(h.time[peak]!)} ${fmt(h.temperature_2m[peak]!)}°.`
      : `Morning ${fmt(h.temperature_2m[morning]!)}°, feels like ${fmt(h.apparent_temperature[morning]!)}°. ${cap(skyToday)}, ` +
        `${rainFromHour ? `rain from ${rainFromHour}` : dry}, wind up to ${windMax} m/s. Up to ${fmt(h.temperature_2m[peak]!)}° by ${time(h.time[peak]!)}.`;

  const week = d.time.slice(i, i + 7).map((t, n) => ({
    date: t, hi: r(d.temperature_2m_max[i + n]!), lo: r(d.temperature_2m_min[i + n]!),
    sky: sky(d.weather_code[i + n]!, lang), rainPct: r(d.precipitation_probability_max[i + n]!),
  }));
  const tm = week[1];
  const tomorrow = tm ? `${fmt(tm.hi)}° / ${fmt(tm.lo)}°, ${tm.sky}, ${lang === 'de' ? 'Regen' : 'rain'} ${tm.rainPct} %` : '';

  return {
    sun: { sunrise: time(d.sunrise[i]!), sunset: time(d.sunset[i]!), dayMinutes: dayMin(i), deltaMinutes: dayMin(i) - dayMin(i - 1) },
    weather: { max: r(d.temperature_2m_max[i]!), summary },
    hourly,
    week,
    forEditor: { today: summary, tomorrow, rainFromHour },
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The raw forecast (one request); parse it per language with parseWeather. */
export async function fetchForecast(loc: { lat: number; lon: number; timezone: string }, fetcher: typeof fetch = fetch): Promise<OpenMeteo> {
  const res = await fetcher(forecastUrl(loc.lat, loc.lon, loc.timezone), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return (await res.json()) as OpenMeteo;
}

export async function fetchWeather(
  loc: { lat: number; lon: number; timezone: string }, date: string, lang: Lang, fetcher: typeof fetch = fetch,
): Promise<WeatherFacts> {
  return parseWeather(await fetchForecast(loc, fetcher), date, lang);
}
