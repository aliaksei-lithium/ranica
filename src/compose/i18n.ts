import type { Lang } from '../model';

const labels = {
  en: {
    motto: 'Everything that counts today.',
    issue: (n: number) => `Issue №${n}`,
    printRun: 'Print run: 1 copy',
    forReader: 'for',
    day: 'day',
    h: 'h',
    min: 'min',
    vsYesterday: 'vs yesterday',
    daysTo: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    weather: 'Weather',
    weatherUnavailable: 'Weather unavailable',
    unavailable: 'unavailable',
    today: 'Today',
    tasks: 'Tasks',
    noEvents: 'No meetings today.',
    sport: 'Sport',
    german: 'German today',
    germanSub: (n: number, extra: boolean) => `${n} words to repeat${extra ? ' + 1 from the news' : ''}`,
    newWord: 'New from the news',
    hobby: 'Hobby',
    onThisDay: 'On this day',
    morePage2: 'more on page 2',
    telegram: 'From Telegram',
    scan: 'Scan to read on',
    insight: 'Insight of the day',
    tomorrow: 'Tomorrow',
    generated: 'Generated',
    sources: 'sources',
    // back page
    backPage: 'Back page',
    page2: 'Page 2',
    week: 'The week ahead',
    weekRows: ['Weather', 'Calendar', 'Due'],
    hours: 'Today by hour',
    hourRows: ['Time', 'Temp', 'Feels', 'Rain', 'Wind m/s'],
    depth: 'In depth',
    digest: 'Telegram digest',
    posts: 'posts',
    upcoming: 'Coming up',
    words: 'Words this week',
    wordOfDay: 'Word of the day',
    archive: 'Archive',
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayNum: (d: number) => String(d),
  },
  de: {
    motto: 'Alles, was heute zählt.',
    issue: (n: number) => `Ausgabe Nr. ${n}`,
    printRun: 'Auflage: 1 Exemplar',
    forReader: 'für',
    day: 'Tag',
    h: 'Std',
    min: 'Min',
    vsYesterday: 'zu gestern',
    daysTo: (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`),
    weather: 'Wetter',
    weatherUnavailable: 'Wetter nicht verfügbar',
    unavailable: 'nicht verfügbar',
    today: 'Heute',
    tasks: 'Aufgaben',
    noEvents: 'Heute keine Termine.',
    sport: 'Sport',
    german: 'Deutsch heute',
    germanSub: (n: number, extra: boolean) => `${n} Wörter zum Wiederholen${extra ? ' + 1 aus den Nachrichten' : ''}`,
    newWord: 'Neu aus den Nachrichten',
    hobby: 'Hobby',
    onThisDay: 'An diesem Tag',
    morePage2: 'mehr auf Seite 2',
    telegram: 'Aus Telegram',
    scan: 'Zum Weiterlesen scannen',
    insight: 'Einblick des Tages',
    tomorrow: 'Morgen',
    generated: 'Erstellt',
    sources: 'Quellen',
    backPage: 'Rückseite',
    page2: 'Seite 2',
    week: 'Die Woche',
    weekRows: ['Wetter', 'Kalender', 'Fällig'],
    hours: 'Heute im Tagesverlauf',
    hourRows: ['Uhr', 'Temp.', 'Gefühlt', 'Regen', 'Wind m/s'],
    depth: 'Im Detail',
    digest: 'Telegram-Überblick',
    posts: 'Beiträge',
    upcoming: 'Demnächst',
    words: 'Wörter der Woche',
    wordOfDay: 'Wort des Tages',
    archive: 'Archiv',
    weekdaysShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    dayNum: (d: number) => `${d}.`,
  },
} as const;

export type Labels = (typeof labels)[Lang];

export const t = (lang: Lang): Labels => labels[lang];

const locale = (lang: Lang) => (lang === 'de' ? 'de-DE' : 'en-GB');

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function dateParts(iso: string, lang: Lang) {
  const d = utc(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', ...o }).format(d);
  const day = d.getUTCDate();
  const month = fmt({ month: 'long' });
  const weekday = fmt({ weekday: 'long' });
  const year = String(d.getUTCFullYear());
  return {
    day: String(day),
    month,
    weekday,
    year,
    /** "Tuesday, 3 November 2026" / "Dienstag, 3. November 2026" */
    long: lang === 'de' ? `${weekday}, ${day}. ${month} ${year}` : `${weekday}, ${day} ${month} ${year}`,
  };
}

/** "Wed 5" / "Mi 5." */
export function shortDay(iso: string, lang: Lang): { weekday: string; day: string } {
  const d = utc(iso);
  return { weekday: t(lang).weekdaysShort[d.getUTCDay()]!, day: t(lang).dayNum(d.getUTCDate()) };
}

/** Signed number with a real minus sign: +6, −3, 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** URL fragment for a rubric: "From Telegram" → "from-telegram". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
