// Editor contract (docs/02-plan.md §3.1): every id in the Brief must exist in the input, text is
// clipped to what the layout holds, and an item is used at most once per page side.
import type { Brief, NewsPick } from './brief';
import { clip } from '../collect/text';

/** "Germany/Deutschland" → the part in the reader's language (Sonnet once wrote both, 2026-11-08). */
export function rubricName(name: string, lang?: 'en' | 'de'): string {
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return (lang === 'de' ? parts[1] : parts[0])!;
}

export interface KnownIds {
  /** Reader language, to clean up rubric names. */
  lang?: 'en' | 'de';
  items: Set<string>;
  events: Set<string>;
  tasks: Set<string>;
  cards: Set<string>;
  channels: Set<string>;
}

export interface Validation {
  brief: Brief;
  dropped: string[];
}

export function validateBrief(b: Brief, known: KnownIds): Validation {
  const dropped: string[] = [];
  const keep = <T>(list: T[], ok: (x: T) => boolean, what: (x: T) => string) =>
    list.filter((x) => (ok(x) ? true : (dropped.push(what(x)), false)));

  const picks = (list: NewsPick[], used: Set<string>, title: number, summary: number, perRubric: number) => {
    const count = new Map<string, number>();
    return keep(list, (n) => known.items.has(n.item_id) && !used.has(n.item_id) && !!used.add(n.item_id), (n) => `news ${n.item_id}`)
      .filter((n) => {
        const k = (count.get(n.rubric) ?? 0) + 1;
        count.set(n.rubric, k);
        return k <= perRubric || (dropped.push(`over limit ${n.item_id}`), false);
      })
      .map((n) => ({ ...n, rubric: clip(rubricName(n.rubric, known.lang), 24), title: clip(n.title, title), summary: clip(n.summary, summary) }));
  };

  // Front page: at most 4 items per rubric (fit.js trims the 3rd/4th first), short summaries;
  // then one-liners. Back page: up to 5 items per rubric.
  const front = new Set<string>();
  const news = picks(b.news, front, 80, 170, 4);
  const briefs = keep(b.briefs ?? [], (x) => known.items.has(x.item_id) && !front.has(x.item_id) && !!front.add(x.item_id), (x) => `brief ${x.item_id}`)
    .slice(0, 8)
    .map((x) => ({ ...x, rubric: clip(rubricName(x.rubric, known.lang), 24), text: clip(x.text, 110) }));
  const back = new Set<string>(front);
  const backNews = picks(b.back_news, back, 100, 320, 5);
  const nw = b.german.new_word;
  const hobby = b.hobby_fact;

  return {
    brief: {
      ...b,
      headline: clip(b.headline, 60),
      weather_note: clip(b.weather_note, 120),
      agenda: keep(b.agenda, (a) => known.events.has(a.event_id), (a) => `event ${a.event_id}`),
      tasks: keep(b.tasks, (t) => known.tasks.has(t.task_id), (t) => `task ${t.task_id}`),
      news,
      briefs,
      telegram_digest: keep(b.telegram_digest, (t) => known.channels.has(t.channel), (t) => `channel ${t.channel}`)
        .map((t) => ({ ...t, summary: clip(t.summary, 120), points: t.points.slice(0, 5).map((p) => clip(p, 160)) })),
      insight: clip(b.insight, 420),
      german: {
        cards: keep(b.german.cards, (c) => known.cards.has(c.card_id), (c) => `card ${c.card_id}`),
        new_word: nw && known.items.has(nw.from_item_id) ? nw : (nw && dropped.push(`new_word ${nw.from_item_id}`), null),
      },
      hobby_fact: hobby && hobby.item_id && !known.items.has(hobby.item_id) ? (dropped.push(`hobby ${hobby.item_id}`), null) : hobby,
      tomorrow: clip(b.tomorrow, 70),
      deep: keep(b.deep, (d) => known.items.has(d.item_id), (d) => `deep ${d.item_id}`)
        .slice(0, 4)
        .map((d) => ({ ...d, rubric: rubricName(d.rubric, known.lang), title: clip(d.title, 90), body: clip(d.body, 700) })),
      back_news: backNews,
    },
    dropped,
  };
}
