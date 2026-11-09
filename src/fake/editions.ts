// Fake editions for M0: the sample content of the reference pages in design/pages/
// (print-page-en/de, print-page-thin, back-page-en/de), split into facts and an editor brief.
import type { Edition, Facts, Lang } from '../model';

const items: Facts['items'] = [
  { id: 'n1', source: 'The Verge', url: 'https://www.theverge.com/', minutes: 9 },
  { id: 'n2', source: 'JetBrains blog', url: 'https://blog.jetbrains.com/kotlin/', minutes: 6 },
  { id: 'n3', source: 'tagesschau', url: 'https://www.tagesschau.de/' },
  { id: 'n4', source: 'DLF', url: 'https://www.deutschlandfunk.de/' },
  { id: 'n5', source: 'tagesschau', url: 'https://www.tagesschau.de/ausland/' },
  { id: 'n6', source: 'Deutschlandfunk', url: 'https://www.deutschlandfunk.de/', minutes: 7 },
  { id: 'n7', source: 'Reuters', url: 'https://www.reuters.com/' },
  { id: 'n8', source: 'FT', url: 'https://www.ft.com/' },
  { id: 'n9', source: 'Belsat', url: 'https://belsat.eu/' },
  { id: 'n22', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sputnik_2' },
];

const cards: Facts['cards'] = [
  { id: 'c1', de: 'der Termin', en: 'appointment' },
  { id: 'c2', de: 'die Erinnerung', en: 'reminder' },
  { id: 'c3', de: 'verschieben', en: 'to postpone' },
  { id: 'c4', de: 'der Vertrag', en: 'contract' },
  { id: 'c5', de: 'wahrscheinlich', en: 'probably' },
];

const german: Edition['brief']['german'] = {
  cards: [
    { card_id: 'c1', example: 'Ich habe um 13 Uhr einen Termin beim Zahnarzt.' },
    { card_id: 'c2', example: 'Die Erinnerung kam gestern per E-Mail.' },
    { card_id: 'c3', example: 'Können wir das Treffen verschieben?' },
    { card_id: 'c4', example: 'Der Vertrag ist noch nicht unterschrieben.' },
    { card_id: 'c5', example: 'Morgen regnet es wahrscheinlich.' },
  ],
  new_word: { de: 'die Zwischenwahl', en: 'midterm election', example: 'Die Zwischenwahl in den USA ist morgen.', from_item_id: 'n5' },
};

const weekWords: Facts['weekWords'] = [
  ...cards.map(({ de, en }) => ({ de, en })),
  { de: 'die Zwischenwahl', en: 'midterm election' },
  { de: 'die Frist', en: 'deadline' },
  { de: 'unterschreiben', en: 'to sign' },
  { de: 'die Heizung', en: 'heating' },
  { de: 'der Zahnarzt', en: 'dentist' },
  { de: 'günstig', en: 'cheap, favourable' },
  { de: 'die Prüfung', en: 'exam' },
];

const hourly: Facts['hourly'] = [
  { hour: '06', temp: 2, feels: -3, rainPct: 10, windMs: 5 },
  { hour: '09', temp: 3, feels: -1, rainPct: 10, windMs: 5 },
  { hour: '12', temp: 5, feels: 2, rainPct: 0, windMs: 4 },
  { hour: '15', temp: 6, feels: 4, rainPct: 0, windMs: 4 },
  { hour: '18', temp: 4, feels: 1, rainPct: 20, windMs: 3 },
  { hour: '21', temp: 2, feels: -1, rainPct: 40, windMs: 3 },
];

const weekDates = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
const temps: [number, number][] = [[6, -1], [5, 0], [4, -2], [3, -3], [2, -4], [1, -5], [2, -3]];
const eventsPerDay = [3, 2, 1, 1, 0, 0, 0];
const week = (sky: string[], calendar: string[], due: (string | null)[]): Facts['week'] =>
  weekDates.map((date, i) => ({
    date,
    hi: temps[i]![0],
    lo: temps[i]![1],
    sky: sky[i]!,
    events: eventsPerDay[i]!,
    calendar: calendar[i]!,
    due: due[i]!,
  }));

const common = {
  date: '2026-11-03',
  issue: 12,
  city: 'Berlin',
  readerName: 'Aliaksei',
  editionTitle: 'Ранішні Аляксей',
  sun: { sunrise: '07:06', sunset: '16:33', dayMinutes: 9 * 60 + 27, deltaMinutes: -3 },
  items,
  cards,
  telegram: [
    { channel: '@tagesschau', posts: 20 },
    { channel: '@kotlin_lang', posts: 6 },
    { channel: '@easy_german', posts: 4 },
  ],
  hourly,
  weekWords,
  generatedAt: '06:40',
  sourcesCount: 14,
  url: 'ranica.app/today',
  unavailable: {},
} satisfies Partial<Facts>;

const en: Edition = {
  facts: {
    ...common,
    lang: 'en',
    countdowns: [
      { label: 'to Christmas', days: 47 },
      { label: 'to B1 exam', days: 12 },
    ],
    weather: { max: 6, summary: 'Morning +2°, feels like −3°. Cloudy, dry, wind 5 m/s. Up to +6° by 14:00.' },
    events: [
      { id: 'e1', time: '09:30', title: 'Standup', durationMin: 30 },
      { id: 'e2', time: '13:00', title: 'Dentist', place: 'Friedrichstr. 12' },
      { id: 'e3', time: '18:30', title: 'Deutschkurs B1', place: 'online' },
    ],
    tasks: [
      { id: 't1', title: 'Sign the contract' },
      { id: 't2', title: 'Reply to Wizstar' },
      { id: 't3', title: 'Book flights for December' },
    ],
    week: week(
      ['cloudy', 'rain', 'showers', 'clear', 'clear, cold', 'snow?', 'cloudy'],
      ['Dentist 13:00', 'Rain likely', 'Team lunch', 'Deutschkurs 18:30', 'Free evening', '—', '—'],
      ['Contract', null, 'Timesheet', null, 'Insurance', 'Writing', null],
    ),
    upcoming: [
      { date: '2026-11-05', title: 'Submit timesheet', note: 'monthly, by 18:00' },
      { date: '2026-11-07', title: 'Pay Krankenversicherungsbeitrag', note: 'transfer, reference number in the letter' },
      { date: '2026-11-08', title: 'B1 writing practice', note: 'one timed letter, 30 min' },
      { date: '2026-11-15', title: 'B1 exam, Goethe-Institut', note: '09:00, bring passport; Hören first' },
    ],
  },
  brief: {
    headline: 'Sign today, fly cheaper',
    weather_note: 'Colder than it looks. Take a hat.',
    agenda: [{ event_id: 'e2', note: 'leave by 12:20, U8 takes 18 min' }],
    tasks: [
      { task_id: 't1', context: 'DocuSign sent reminder #2 yesterday' },
      { task_id: 't2', context: 'waiting since Thursday' },
    ],
    news: [
      { rubric: 'Tech', item_id: 'n1', title: 'Google releases Gemini 4; Alphabet shares fall 10 % after investors question AI spend',
        summary: "The model leads most benchmarks, but the quarter's capex guidance spooked the market." },
      { rubric: 'Tech', item_id: 'n2', title: 'Kotlin 2.4 ships with faster incremental compilation',
        summary: 'The compiler reuses more of the previous build; large projects rebuild 30–40 % faster.' },
      { rubric: 'Germany', item_id: 'n3', title: 'DAX expected to retreat ahead of US midterms',
        summary: "Analysts expect a cautious open while traders wait for Tuesday's congressional vote." },
      { rubric: 'Germany', item_id: 'n4', title: 'Bundestag debates heating-law amendments',
        summary: 'The coalition wants softer deadlines for replacing gas boilers; the opposition calls it a U-turn.' },
    ],
    telegram_digest: [
      { channel: '@tagesschau', summary: '20 posts, mostly markets and the midterms',
        points: ['DAX and midterms dominate; three posts on the heating law', 'Bahn strike talks continue, no dates announced'] },
      { channel: '@kotlin_lang', summary: '6 posts: release notes and a KotlinConf CFP reminder',
        points: ['Kotlin 2.4 release notes and migration guide', 'KotlinConf 2027 call for papers closes 30 Nov'] },
      { channel: '@easy_german', summary: '4 posts, a new episode about the doctor',
        points: ["New episode: 'Beim Arzt', useful before the dentist"] },
    ],
    insight:
      'Two deadlines collide this week: the contract and the flight prices. Sign today, and the December trip ' +
      'gets cheaper by Friday. Your German exam is in 12 days; the next three evenings are free.',
    sport: 'Gym day (last visit Fri). Dry until 18:00, so a run is possible too.',
    german,
    hobby_fact: { text: 'On this day in 1957, Sputnik 2 carried Laika into orbit.', item_id: 'n22' },
    on_this_day: { text: 'The early morning has gold in its mouth.', author: 'German proverb' },
    tomorrow: '2 events, rain likely',
    deep: [
      { rubric: 'Tech', item_id: 'n1', title: 'Gemini 4: strong model, nervous investors',
        body: "Google's new model leads most public benchmarks and ships with a 2-million-token context window and a cheaper 'Flash' tier. The market read the launch differently: Alphabet guided to another year of record data-centre spending and gave no new revenue figure for AI products, and the shares fell 10 % in a day. The three numbers analysts watched: capex, cloud growth and the share of searches answered by AI overviews." },
      { rubric: 'Tech', item_id: 'n2', title: 'Kotlin 2.4 and the new incremental compiler',
        body: 'The compiler now tracks dependencies per declaration instead of per file, so changing a private function no longer rebuilds everything that imports the class. JetBrains quotes 30–40 % shorter rebuilds on a 2 000-module Android project; a changed public signature still forces a wider rebuild. K2 is the only frontend now, and the old one is removed.' },
      { rubric: 'Germany', item_id: 'n6', title: 'Heating law: what the amendment actually changes',
        body: 'The 2024 Building Energy Act set dates after which a new heating system must run on 65 % renewable energy. The amendment pushes those dates back by up to four years for older buildings, widens the exceptions for owners over 70, and keeps the subsidy of up to 70 % for heat pumps. Tenants keep the existing cap on rent increases after a modernisation.' },
    ],
    back_news: [
      { rubric: 'World', item_id: 'n7', title: 'US midterms: what is decided tomorrow',
        summary: "All 435 House seats and 33 Senate seats. Polls close from 01:00 Berlin time; the first reliable House numbers usually arrive around 05:00, so expect them in Wednesday's paper." },
      { rubric: 'World', item_id: 'n8', title: 'ECB keeps rates at 2 %',
        summary: 'The bank held for the third time and repeated that it will decide meeting by meeting. Mortgage rates in Germany are unlikely to move before spring.' },
      { rubric: 'World', item_id: 'n9', title: 'Poland reopens the Bobrowniki crossing',
        summary: 'Lorry traffic resumes from Monday with new document checks; cars still go through Terespol. Expect long waits in the first week.' },
    ],
    word_of_day: { de: 'die Frist', en: 'deadline', example: 'Die Frist für den Vertrag endet am Freitag.',
      extra: 'Plural: die Fristen. Related: fristgerecht (on time).' },
  },
};

const de: Edition = {
  facts: {
    ...en.facts,
    lang: 'de',
    countdowns: [
      { label: 'bis Weihnachten', days: 47 },
      { label: 'bis zur B1-Prüfung', days: 12 },
    ],
    weather: { max: 6, summary: 'Morgens +2°, gefühlt −3°. Bewölkt, trocken, Wind 5 m/s. Bis 14 Uhr +6°.' },
    events: [
      { id: 'e1', time: '09:30', title: 'Standup', durationMin: 30 },
      { id: 'e2', time: '13:00', title: 'Zahnarzt', place: 'Friedrichstr. 12' },
      { id: 'e3', time: '18:30', title: 'Deutschkurs B1', place: 'online' },
    ],
    tasks: [
      { id: 't1', title: 'Vertrag unterschreiben' },
      { id: 't2', title: 'Wizstar antworten' },
      { id: 't3', title: 'Flüge für Dezember buchen' },
    ],
    items: items.map((i) => (i.id === 'n2' ? { ...i, source: 'JetBrains-Blog' } : i)),
    week: week(
      ['bewölkt', 'Regen', 'Schauer', 'klar', 'klar, kalt', 'Schnee?', 'bewölkt'],
      ['Zahnarzt 13:00', 'wohl Regen', 'Team-Essen', 'Deutschkurs 18:30', 'Abend frei', '—', '—'],
      ['Vertrag', null, 'Stundenzettel', null, 'Versicherung', 'Schreibübung', null],
    ),
    upcoming: [
      { date: '2026-11-05', title: 'Stundenzettel abgeben', note: 'monatlich, bis 18:00' },
      { date: '2026-11-07', title: 'Krankenversicherungsbeitrag überweisen', note: 'Verwendungszweck steht im Brief' },
      { date: '2026-11-08', title: 'B1-Schreibübung', note: 'ein Brief mit Zeitlimit, 30 Min' },
      { date: '2026-11-15', title: 'B1-Prüfung, Goethe-Institut', note: '09:00, Pass mitbringen; Hören zuerst' },
    ],
  },
  brief: {
    ...en.brief,
    headline: 'Heute unterschreiben, billiger fliegen',
    weather_note: 'Kälter, als es aussieht. Mütze mitnehmen.',
    agenda: [{ event_id: 'e2', note: 'um 12:20 losgehen, U8 braucht 18 Min' }],
    tasks: [
      { task_id: 't1', context: 'DocuSign hat gestern die 2. Erinnerung geschickt' },
      { task_id: 't2', context: 'wartet seit Donnerstag' },
    ],
    news: [
      { rubric: 'Tech', item_id: 'n1', title: 'Google veröffentlicht Gemini 4; Alphabet-Aktie fällt um 10 %, weil Investoren die KI-Ausgaben kritisieren',
        summary: 'Das Modell ist in den meisten Tests vorn, aber die geplanten Ausgaben (Capex) haben den Markt erschreckt.' },
      { rubric: 'Tech', item_id: 'n2', title: 'Kotlin 2.4 ist da: schnellere inkrementelle Kompilierung',
        summary: 'Der Compiler nutzt mehr vom letzten Build; große Projekte bauen 30–40 % schneller.' },
      { rubric: 'Deutschland', item_id: 'n3', title: 'DAX dürfte vor den US-Zwischenwahlen nachgeben',
        summary: 'Analysten erwarten einen vorsichtigen Start, weil alle auf die Wahl am Dienstag warten.' },
      { rubric: 'Deutschland', item_id: 'n4', title: 'Bundestag diskutiert Änderungen am Heizungsgesetz',
        summary: 'Die Koalition will längere Fristen für alte Gasheizungen; die Opposition nennt das eine Kehrtwende.' },
    ],
    telegram_digest: [
      { channel: '@tagesschau', summary: '20 Beiträge, vor allem Börse und Zwischenwahlen',
        points: ['DAX und Zwischenwahlen dominieren; drei Beiträge zum Heizungsgesetz', 'Gespräche zum Bahnstreik gehen weiter, keine Termine'] },
      { channel: '@kotlin_lang', summary: '6 Beiträge: Release-Notes und eine Erinnerung an den KotlinConf-CFP',
        points: ['Kotlin 2.4: Release-Notes und Migrationsleitfaden', 'KotlinConf 2027: Call for Papers endet am 30. Nov.'] },
      { channel: '@easy_german', summary: '4 Beiträge, eine neue Folge über den Arztbesuch',
        points: ['Neue Folge: „Beim Arzt“, passt vor dem Zahnarzt'] },
    ],
    insight:
      'Diese Woche treffen zwei Fristen zusammen: der Vertrag und die Flugpreise. Wenn du heute unterschreibst, ' +
      'wird die Dezember-Reise bis Freitag günstiger. Deine Prüfung ist in 12 Tagen, die nächsten drei Abende sind frei.',
    sport: 'Heute Gym (zuletzt Freitag). Bis 18 Uhr trocken, Laufen geht auch.',
    hobby_fact: { text: 'Heute vor 69 Jahren (1957) flog die Hündin Laika mit Sputnik 2 ins All.', item_id: 'n22' },
    on_this_day: { text: 'Morgenstund hat Gold im Mund.', author: 'Sprichwort' },
    tomorrow: '2 Termine, wahrscheinlich Regen',
    deep: [
      { rubric: 'Tech', item_id: 'n1', title: 'Gemini 4: starkes Modell, nervöse Investoren',
        body: 'Googles neues Modell ist in den meisten Tests vorn. Es hat ein Kontextfenster von 2 Millionen Token und eine günstigere „Flash“-Version. Der Markt hat die Nachricht anders gelesen: Alphabet plant noch ein Jahr mit Rekordausgaben für Rechenzentren und nennt keine neue Umsatzzahl für KI-Produkte. Die Aktie fiel an einem Tag um 10 %. Drei Zahlen zählen für Analysten: Investitionen, Cloud-Wachstum und der Anteil der Suchanfragen mit KI-Antwort.' },
      { rubric: 'Tech', item_id: 'n2', title: 'Kotlin 2.4 und der neue inkrementelle Compiler',
        body: 'Der Compiler merkt sich Abhängigkeiten jetzt pro Deklaration, nicht pro Datei. Wenn man eine private Funktion ändert, wird nicht mehr alles neu gebaut, was die Klasse importiert. JetBrains nennt 30–40 % kürzere Builds bei einem Android-Projekt mit 2 000 Modulen. Eine geänderte öffentliche Signatur führt weiter zu einem größeren Rebuild. K2 ist jetzt das einzige Frontend.' },
      { rubric: 'Deutschland', item_id: 'n6', title: 'Heizungsgesetz: Was die Änderung wirklich bedeutet',
        body: 'Das Gebäudeenergiegesetz von 2024 nennt Termine, ab denen eine neue Heizung zu 65 % mit erneuerbarer Energie laufen muss. Die Änderung verschiebt diese Termine für ältere Häuser um bis zu vier Jahre, erweitert die Ausnahmen für Eigentümer über 70 und behält die Förderung von bis zu 70 % für Wärmepumpen. Für Mieter bleibt die Grenze für Mieterhöhungen nach einer Modernisierung.' },
    ],
    back_news: [
      { rubric: 'Welt', item_id: 'n7', title: 'US-Zwischenwahlen: Was morgen entschieden wird',
        summary: 'Alle 435 Sitze im Repräsentantenhaus und 33 Sitze im Senat. Die Wahllokale schließen ab 01:00 Uhr Berliner Zeit; erste sichere Zahlen kommen meist gegen 05:00 Uhr, also in der Zeitung am Mittwoch.' },
      { rubric: 'Welt', item_id: 'n8', title: 'EZB lässt den Zins bei 2 %',
        summary: 'Die Bank hat zum dritten Mal nichts geändert und will von Sitzung zu Sitzung entscheiden. Die Zinsen für Immobilienkredite in Deutschland ändern sich vor dem Frühling wahrscheinlich nicht.' },
      { rubric: 'Welt', item_id: 'n9', title: 'Polen öffnet den Grenzübergang Bobrowniki wieder',
        summary: 'Lkw dürfen ab Montag wieder fahren, mit neuen Kontrollen; Pkw müssen weiter über Terespol. Erste Woche: lange Wartezeiten.' },
    ],
    word_of_day: { de: 'die Frist', en: 'deadline', example: 'Die Frist für den Vertrag endet am Freitag.',
      extra: 'Plural: die Fristen. Verwandt: fristgerecht (rechtzeitig).' },
  },
};

/** The "thin day" (design/pages/print-page-thin.html): a quiet Sunday, weather down, two rubrics. */
function thinOf(e: Edition): Edition {
  const isDe = e.facts.lang === 'de';
  const rubrics = [...new Set(e.brief.news.map((n) => n.rubric))].slice(0, 2);
  return {
    facts: {
      ...e.facts,
      date: '2026-11-08',
      issue: 17,
      sun: { sunrise: '07:15', sunset: '16:25', dayMinutes: 9 * 60 + 10, deltaMinutes: -3 },
      countdowns: e.facts.countdowns.map((c) => ({ ...c, days: c.days - 5 })),
      weather: null,
      events: [],
      tasks: isDe
        ? [{ id: 't4', title: 'B1-Schreibproben durchsehen' }, { id: 't5', title: 'Pflanzen gießen' }]
        : [{ id: 't4', title: 'Review B1 writing samples' }, { id: 't5', title: 'Water the plants' }],
      unavailable: { weather: 'Open-Meteo timeout' },
    },
    brief: {
      ...e.brief,
      agenda: [],
      tasks: [{ task_id: 't4', context: isDe ? 'Prüfung in 7 Tagen; Schreiben ist der schwächste Teil' : 'exam in 7 days; the Schreiben part is weakest' }],
      news: e.brief.news.filter((n) => rubrics.includes(n.rubric)),
      telegram_digest: [],
      sport: null,
      hobby_fact: null,
      on_this_day: null,
      insight: isDe
        ? 'Ein ruhiger Sonntag ohne Termine. Die Prüfung ist in einer Woche, und für den Schreibteil hast du am wenigsten geübt. Ein Brief mit Zeitlimit heute Morgen wäre eine gute Idee.'
        : 'A quiet Sunday with nothing in the calendar. The exam is in a week and the writing part has had the least practice, so one timed letter this morning would be a good use of the free hours.',
      tomorrow: isDe ? '1 Termin, trocken' : '1 event, dry',
    },
  };
}

export type Variant = 'full' | 'thin';

export function fakeEdition(lang: Lang, variant: Variant = 'full', date?: string): Edition {
  const full = lang === 'de' ? de : en;
  const base = variant === 'thin' ? thinOf(full) : full;
  return date ? { ...base, facts: { ...base.facts, date } } : base;
}

/** A fake archive: the last few issues, newest first. */
export function fakeArchive(): { date: string; issue: number }[] {
  const start = Date.UTC(2026, 10, 3);
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(start - i * 86_400_000).toISOString().slice(0, 10),
    issue: 12 - i,
  }));
}
