import type { Lang } from '../model';

const labels = {
  en: {
    issue: 'Issue №',
    printRun: 'Print run: 1 copy',
    forReader: 'for',
    motto: 'All that matters today',
    weather: 'Weather',
    today: 'Today',
    tasks: 'Tasks',
    noEvents: 'No meetings today.',
    noTasks: 'Nothing on the list.',
    sport: 'Sport',
    german: 'German today',
    newWord: 'New from the news',
    news: 'News',
    telegram: 'From Telegram',
    insight: 'Insight of the day',
    hobby: 'Hobby',
    onThisDay: 'Quote of the day',
    tomorrow: 'Tomorrow',
    generated: 'Generated',
    sources: 'sources',
    day: 'day',
    h: 'h',
    min: 'min',
    vsYesterday: 'vs yesterday',
    daysTo: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    archive: 'Archive',
  },
  de: {
    issue: 'Ausgabe Nr. ',
    printRun: 'Auflage: 1 Exemplar',
    forReader: 'für',
    motto: 'Alles, was heute zählt',
    weather: 'Wetter',
    today: 'Heute',
    tasks: 'Aufgaben',
    noEvents: 'Heute keine Termine.',
    noTasks: 'Nichts auf der Liste.',
    sport: 'Sport',
    german: 'Deutsch heute',
    newWord: 'Neu aus den Nachrichten',
    news: 'Nachrichten',
    telegram: 'Aus Telegram',
    insight: 'Einblick des Tages',
    hobby: 'Hobby',
    onThisDay: 'Zitat des Tages',
    tomorrow: 'Morgen',
    generated: 'Erstellt',
    sources: 'Quellen',
    day: 'Tag',
    h: 'Std',
    min: 'Min',
    vsYesterday: 'zu gestern',
    daysTo: (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`),
    archive: 'Archiv',
  },
} as const;

export type Labels = (typeof labels)[Lang];

export const t = (lang: Lang): Labels => labels[lang];

const locale = (lang: Lang) => (lang === 'de' ? 'de-DE' : 'en-GB');

export function dateParts(iso: string, lang: Lang) {
  const d = new Date(`${iso}T12:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', ...o }).format(d);
  return {
    day: String(d.getUTCDate()).padStart(2, '0'),
    month: fmt({ month: 'long' }),
    weekday: fmt({ weekday: 'long' }),
    year: String(d.getUTCFullYear()),
  };
}

/** Signed number with a real minus sign: +6, −3, 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}
