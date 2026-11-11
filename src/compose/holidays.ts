// Public holidays and notable days for the reader's two places: Berlin (federal + Berlin law) and
// Belarus (official days off plus a few traditional dates). Pure date arithmetic, no network, so
// stored and archived editions get them too: the front page computes them from the edition date.
import type { Lang } from '../model';

export type Region = 'berlin' | 'belarus';

export interface Holiday {
  /** ISO date. */
  date: string;
  name: string;
  regions: Region[];
  /** A statutory day off in at least one of the regions. */
  off: boolean;
}

type Def = { id: string; region: Region; off: boolean; en: string; de: string; at: (y: number) => Date };

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const plus = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Western (Gregorian) Easter Sunday, anonymous Gregorian algorithm. */
export function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

/** Orthodox Easter Sunday as a Gregorian date (Meeus' Julian algorithm, +13 days for 1900–2099). */
export function orthodoxEaster(y: number): Date {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return plus(ymd(y, month, day), 13);
}

/** The last `weekday` (0 = Sunday) of a month. */
const lastWeekday = (y: number, m: number, weekday: number) => {
  const last = ymd(y, m + 1, 0);
  return plus(last, -((last.getUTCDay() - weekday + 7) % 7));
};
/** The n-th `weekday` (0 = Sunday) of a month. */
const nthWeekday = (y: number, m: number, weekday: number, n: number) => {
  const first = ymd(y, m, 1);
  return plus(first, ((weekday - first.getUTCDay() + 7) % 7) + 7 * (n - 1));
};
/** Advent Sundays: the 4th is the last Sunday before 25 December. */
const advent = (y: number, n: number) => {
  const xmas = ymd(y, 12, 25);
  const fourth = plus(xmas, -(xmas.getUTCDay() || 7));
  return plus(fourth, -7 * (4 - n));
};

const fixed = (m: number, d: number) => (y: number) => ymd(y, m, d);
const fromEaster = (days: number) => (y: number) => plus(easter(y), days);
const fromOrthodox = (days: number) => (y: number) => plus(orthodoxEaster(y), days);

const DEFS: Def[] = [
  // Berlin: statutory holidays
  { id: 'newyear', region: 'berlin', off: true, en: 'New Year’s Day', de: 'Neujahr', at: fixed(1, 1) },
  { id: 'women', region: 'berlin', off: true, en: 'International Women’s Day', de: 'Internationaler Frauentag', at: fixed(3, 8) },
  { id: 'goodfriday', region: 'berlin', off: true, en: 'Good Friday', de: 'Karfreitag', at: fromEaster(-2) },
  { id: 'easter', region: 'berlin', off: false, en: 'Easter Sunday', de: 'Ostersonntag', at: fromEaster(0) },
  { id: 'eastermonday', region: 'berlin', off: true, en: 'Easter Monday', de: 'Ostermontag', at: fromEaster(1) },
  { id: 'may1', region: 'berlin', off: true, en: 'Labour Day', de: 'Tag der Arbeit', at: fixed(5, 1) },
  { id: 'ascension', region: 'berlin', off: true, en: 'Ascension Day', de: 'Christi Himmelfahrt', at: fromEaster(39) },
  { id: 'whitmonday', region: 'berlin', off: true, en: 'Whit Monday', de: 'Pfingstmontag', at: fromEaster(50) },
  { id: 'unity', region: 'berlin', off: true, en: 'German Unity Day', de: 'Tag der Deutschen Einheit', at: fixed(10, 3) },
  { id: 'xmas', region: 'berlin', off: true, en: 'Christmas Day', de: '1. Weihnachtstag', at: fixed(12, 25) },
  { id: 'xmas2', region: 'berlin', off: true, en: 'Boxing Day', de: '2. Weihnachtstag', at: fixed(12, 26) },
  // Berlin: days worth knowing about
  { id: 'valentine', region: 'berlin', off: false, en: 'Valentine’s Day', de: 'Valentinstag', at: fixed(2, 14) },
  { id: 'dst', region: 'berlin', off: false, en: 'Clocks go forward', de: 'Beginn der Sommerzeit', at: (y) => lastWeekday(y, 3, 0) },
  { id: 'mother', region: 'berlin', off: false, en: 'Mother’s Day', de: 'Muttertag', at: (y) => nthWeekday(y, 5, 0, 2) },
  { id: 'std', region: 'berlin', off: false, en: 'Clocks go back', de: 'Ende der Sommerzeit', at: (y) => lastWeekday(y, 10, 0) },
  { id: 'wall', region: 'berlin', off: false, en: 'Fall of the Berlin Wall', de: 'Jahrestag des Mauerfalls', at: fixed(11, 9) },
  { id: 'martin', region: 'berlin', off: false, en: 'St Martin’s Day', de: 'Martinstag', at: fixed(11, 11) },
  { id: 'advent1', region: 'berlin', off: false, en: '1st Sunday of Advent', de: '1. Advent', at: (y) => advent(y, 1) },
  { id: 'advent2', region: 'berlin', off: false, en: '2nd Sunday of Advent', de: '2. Advent', at: (y) => advent(y, 2) },
  { id: 'advent3', region: 'berlin', off: false, en: '3rd Sunday of Advent', de: '3. Advent', at: (y) => advent(y, 3) },
  { id: 'advent4', region: 'berlin', off: false, en: '4th Sunday of Advent', de: '4. Advent', at: (y) => advent(y, 4) },
  { id: 'nicholas', region: 'berlin', off: false, en: 'St Nicholas’ Day', de: 'Nikolaus', at: fixed(12, 6) },
  { id: 'xmaseve', region: 'berlin', off: false, en: 'Christmas Eve', de: 'Heiligabend', at: fixed(12, 24) },
  { id: 'nye', region: 'berlin', off: false, en: 'New Year’s Eve', de: 'Silvester', at: fixed(12, 31) },
  // Belarus: official days off
  { id: 'newyear', region: 'belarus', off: true, en: 'New Year’s Day', de: 'Neujahr', at: fixed(1, 1) },
  { id: 'newyear2', region: 'belarus', off: true, en: 'New Year holiday', de: 'Neujahrsfeiertag', at: fixed(1, 2) },
  { id: 'oxmas', region: 'belarus', off: true, en: 'Orthodox Christmas', de: 'Orthodoxes Weihnachten', at: fixed(1, 7) },
  { id: 'women', region: 'belarus', off: true, en: 'International Women’s Day', de: 'Internationaler Frauentag', at: fixed(3, 8) },
  { id: 'may1', region: 'belarus', off: true, en: 'Labour Day', de: 'Tag der Arbeit', at: fixed(5, 1) },
  { id: 'victory', region: 'belarus', off: true, en: 'Victory Day', de: 'Tag des Sieges', at: fixed(5, 9) },
  { id: 'radunitsa', region: 'belarus', off: true, en: 'Radunitsa', de: 'Raduniza', at: fromOrthodox(9) },
  { id: 'independence', region: 'belarus', off: true, en: 'Independence Day', de: 'Unabhängigkeitstag', at: fixed(7, 3) },
  { id: 'october', region: 'belarus', off: true, en: 'October Revolution Day', de: 'Tag der Oktoberrevolution', at: fixed(11, 7) },
  { id: 'xmas', region: 'belarus', off: true, en: 'Christmas Day', de: '1. Weihnachtstag', at: fixed(12, 25) },
  // Belarus: traditional and memorable dates
  { id: 'maslenitsa', region: 'belarus', off: false, en: 'Maslenitsa (Kamajedzica)', de: 'Maslenitsa (Kamajedzica)', at: fromOrthodox(-49) },
  { id: 'freedom', region: 'belarus', off: false, en: 'Freedom Day', de: 'Tag der Freiheit', at: fixed(3, 25) },
  { id: 'oeaster', region: 'belarus', off: false, en: 'Orthodox Easter', de: 'Orthodoxes Ostern', at: fromOrthodox(0) },
  { id: 'kupalle', region: 'belarus', off: false, en: 'Kupalle', de: 'Kupalle', at: fixed(7, 7) },
  { id: 'dziady', region: 'belarus', off: false, en: 'Dziady, day of remembrance', de: 'Dsjady, Totengedenken', at: fixed(11, 2) },
];

/** Every holiday of a year, merged across regions (same day and id → one entry), by date. */
export function holidaysOf(year: number, lang: Lang): Holiday[] {
  const byKey = new Map<string, Holiday>();
  for (const d of DEFS) {
    const date = iso(d.at(year));
    const key = `${date}:${d.id}`;
    const h = byKey.get(key);
    if (h) {
      h.regions.push(d.region);
      h.off ||= d.off;
    } else byKey.set(key, { date, name: d[lang], regions: [d.region], off: d.off });
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Today's holidays and the next few (within `days`, at most `max`), for an ISO date. */
export function holidaysAround(date: string, lang: Lang, max = 4, days = 60): { today: Holiday[]; next: (Holiday & { inDays: number })[] } {
  const y = Number(date.slice(0, 4));
  const all = [...holidaysOf(y, lang), ...holidaysOf(y + 1, lang)];
  const t0 = Date.parse(`${date}T00:00:00Z`);
  const next = all
    .map((h) => ({ ...h, inDays: Math.round((Date.parse(`${h.date}T00:00:00Z`) - t0) / 86400000) }))
    .filter((h) => h.inDays > 0 && h.inDays <= days)
    .slice(0, max);
  return { today: all.filter((h) => h.date === date), next };
}
