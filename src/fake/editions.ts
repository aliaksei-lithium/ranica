// Fake editions for M0, taken from the sample content in docs/03-design-brief.md §5.
import type { Edition, Facts, Lang } from '../model';

const items: Facts['items'] = [
  { id: 'n1', source: 'The Verge', url: 'https://www.theverge.com/' },
  { id: 'n2', source: 'JetBrains blog', url: 'https://blog.jetbrains.com/kotlin/' },
  { id: 'n3', source: 'tagesschau', url: 'https://www.tagesschau.de/' },
  { id: 'n4', source: 'DLF', url: 'https://www.deutschlandfunk.de/' },
  { id: 'n5', source: 'tagesschau', url: 'https://www.tagesschau.de/ausland/' },
  { id: 'n22', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sputnik_2' },
];

const cards: Facts['cards'] = [
  { id: 'c1', de: 'der Termin', en: 'appointment' },
  { id: 'c2', de: 'die Erinnerung', en: 'reminder' },
  { id: 'c3', de: 'verschieben', en: 'to postpone' },
  { id: 'c4', de: 'der Vertrag', en: 'contract' },
  { id: 'c5', de: 'wahrscheinlich', en: 'probably' },
];

const germanCards = [
  { card_id: 'c1', example: 'Ich habe um 13 Uhr einen Termin beim Zahnarzt.' },
  { card_id: 'c2', example: 'Die Erinnerung kam gestern per E-Mail.' },
  { card_id: 'c3', example: 'Können wir das Treffen verschieben?' },
  { card_id: 'c4', example: 'Der Vertrag ist noch nicht unterschrieben.' },
  { card_id: 'c5', example: 'Morgen regnet es wahrscheinlich.' },
];

const common = {
  date: '2026-11-03',
  issue: 12,
  city: 'Berlin',
  readerName: 'Aliaksei',
  editionTitle: 'Утренний Алексей',
  sun: { sunrise: '07:06', sunset: '16:33', dayMinutes: 9 * 60 + 27, deltaMinutes: -3 },
  items,
  cards,
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
    weather: {
      max: 6,
      glyph: 'cloud',
      summary: 'Morning +2°, feels like −3°. Cloudy, dry, wind 5 m/s. Up to +6° by 14:00.',
    },
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
      { rubric: 'Tech', item_id: 'n1', title: 'Google releases Gemini 4; Alphabet shares fall 10 %',
        summary: 'Investors question how much the company spends on AI data centres.' },
      { rubric: 'Tech', item_id: 'n2', title: 'Kotlin 2.4 ships with faster incremental compilation',
        summary: 'Gradle builds of large multiplatform projects are up to 30 % faster.' },
      { rubric: 'Germany', item_id: 'n3', title: 'DAX expected to retreat ahead of US midterms',
        summary: 'Traders wait for the results before buying; the euro is stable.' },
      { rubric: 'Germany', item_id: 'n4', title: 'Bundestag debates heating-law amendments',
        summary: 'The coalition wants more time for owners of old gas heating systems.' },
    ],
    telegram_digest: [{ channel: '@tagesschau', summary: '20 posts, mostly markets and the midterms.' }],
    insight:
      'Two deadlines collide this week: the contract and the flight prices. Sign today, and the ' +
      'December trip gets cheaper by Friday. Your German exam is in 12 days; the next three evenings are free.',
    sport: 'Gym day (last visit Fri). Dry until 18:00, so a run is possible too.',
    german: {
      cards: germanCards,
      new_word: { de: 'die Zwischenwahl', en: 'midterm election', from_item_id: 'n5' },
    },
    hobby_fact: { text: 'On this day in 1957, Sputnik 2 carried Laika into orbit.', item_id: 'n22' },
    on_this_day: { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    tomorrow: '2 events, rain likely',
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
    weather: {
      max: 6,
      glyph: 'cloud',
      summary: 'Morgens +2°, gefühlt −3°. Bewölkt, trocken, Wind 5 m/s. Bis 14 Uhr +6°.',
    },
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
      { rubric: 'Technik', item_id: 'n1', title: 'Google bringt Gemini 4; Alphabet-Aktie fällt um 10 %',
        summary: 'Anleger fragen, wie viel Geld die Firma für KI-Rechenzentren ausgibt.' },
      { rubric: 'Technik', item_id: 'n2', title: 'Kotlin 2.4 kompiliert schneller',
        summary: 'Große Multiplatform-Projekte bauen mit Gradle bis zu 30 % schneller.' },
      { rubric: 'Deutschland', item_id: 'n3', title: 'DAX vor den US-Zwischenwahlen wohl schwächer',
        summary: 'Händler warten auf die Ergebnisse (results). Der Euro bleibt stabil.' },
      { rubric: 'Deutschland', item_id: 'n4', title: 'Bundestag diskutiert über das Heizungsgesetz',
        summary: 'Die Koalition will Besitzern alter Gasheizungen mehr Zeit geben. Es geht auch um den Krankenversicherungsbeitrag.' },
    ],
    telegram_digest: [{ channel: '@tagesschau', summary: '20 Posts, meistens Börse und die Zwischenwahlen.' }],
    insight:
      'Diese Woche treffen zwei Fristen (deadlines) zusammen: der Vertrag und die Flugpreise. Wenn du ' +
      'heute unterschreibst, wird die Dezember-Reise bis Freitag günstiger. Deine Prüfung ist in ' +
      '12 Tagen, die nächsten drei Abende sind frei.',
    sport: 'Heute Gym (zuletzt Freitag). Bis 18 Uhr trocken, Laufen geht auch.',
    hobby_fact: { text: 'Heute vor 69 Jahren, 1957, flog die Hündin Laika mit Sputnik 2 ins All.', item_id: 'n22' },
    on_this_day: { text: 'Der Anfang ist die Hälfte des Ganzen.', author: 'Aristoteles' },
    tomorrow: '2 Termine, wahrscheinlich Regen',
  },
};

/** Deliverable 3: no meetings, 2 tasks, weather unavailable, 2 rubrics, no sport/hobby/quote. */
function thinOf(e: Edition): Edition {
  const de = e.facts.lang === 'de';
  const rubrics = [...new Set(e.brief.news.map((n) => n.rubric))].slice(0, 1);
  return {
    facts: {
      ...e.facts,
      weather: null,
      events: [],
      tasks: e.facts.tasks.slice(0, 2),
      unavailable: {
        weather: de ? 'Wetter nicht verfügbar (Open-Meteo antwortet nicht)' : 'Weather unavailable (Open-Meteo timeout)',
      },
    },
    brief: {
      ...e.brief,
      agenda: [],
      news: e.brief.news.filter((n) => rubrics.includes(n.rubric)),
      sport: null,
      hobby_fact: null,
      on_this_day: null,
      tomorrow: de ? 'keine Termine, trocken' : 'no events, dry',
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
  const out: { date: string; issue: number }[] = [];
  const start = Date.UTC(2026, 10, 3);
  for (let i = 0; i < 7; i++) {
    out.push({ date: new Date(start - i * 86_400_000).toISOString().slice(0, 10), issue: 12 - i });
  }
  return out;
}
