// The editor's output (docs/02-plan.md §3.1). In M1 this comes from Claude via AI Gateway
// and is validated against the input ids; in M0 it is written by hand in src/fake/.

export interface Brief {
  /** ≤ 60 chars, shown as the title of the insight box. */
  headline: string;
  /** ≤ 120 chars, the highlighted advice line under the weather. */
  weather_note: string;
  agenda: { event_id: string; note: string }[];
  tasks: { task_id: string; context: string }[];
  news: { rubric: string; item_id: string; title: string; summary: string }[];
  telegram_digest: { channel: string; summary: string }[];
  /** 2–4 sentences, ≤ 400 chars. */
  insight: string;
  sport: string | null;
  german: {
    cards: { card_id: string; example: string }[];
    new_word: { de: string; en: string; from_item_id: string } | null;
  };
  hobby_fact: { text: string; item_id: string | null } | null;
  /** Block J; not in the first plan schema, added for the design brief. */
  on_this_day: { text: string; author?: string } | null;
  tomorrow: string;
}
