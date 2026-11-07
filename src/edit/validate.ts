// Editor contract (docs/02-plan.md §3.1): every id in the Brief must exist in the input, text is
// clipped to what the layout holds, and an item is used at most once per page side.
import type { Brief, NewsPick } from './brief';
import { clip } from '../collect/text';

export interface KnownIds {
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

  const picks = (list: NewsPick[], used: Set<string>, title: number, summary: number) =>
    keep(list, (n) => known.items.has(n.item_id) && !used.has(n.item_id) && !!used.add(n.item_id), (n) => `news ${n.item_id}`)
      .map((n) => ({ ...n, rubric: clip(n.rubric, 24), title: clip(n.title, title), summary: clip(n.summary, summary) }));

  const front = new Set<string>();
  const news = picks(b.news, front, 100, 220);
  const back = new Set<string>(front);
  const backNews = picks(b.back_news, back, 100, 320);
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
        .map((d) => ({ ...d, title: clip(d.title, 90), body: clip(d.body, 700) })),
      back_news: backNews,
    },
    dropped,
  };
}
