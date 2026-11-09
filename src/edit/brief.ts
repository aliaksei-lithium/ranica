// The editor's output (docs/02-plan.md §3.1). In M1 this comes from Claude via AI Gateway
// and is validated against the input ids; in M0 it is written by hand in src/fake/.

export interface NewsPick {
  rubric: string;
  item_id: string;
  /** ≤ 70 chars on the front page. */
  title: string;
  /** ≤ 2 lines on the front page. */
  summary: string;
}

export interface Brief {
  /** ≤ 60 chars; used as the page title. */
  headline: string;
  /** ≤ 120 chars, the bold advice line under the weather. */
  weather_note: string;
  agenda: { event_id: string; note: string }[];
  tasks: { task_id: string; context: string }[];
  /** Front page news, up to 5 rubrics. */
  news: NewsPick[];
  /** One-line items that fill the rest of the page (absent in editions before 2026-11-08). */
  briefs?: { rubric: string; item_id: string; text: string }[];
  /** `summary` is the one-line front-page digest; `points` are the back-page bullets. */
  telegram_digest: { channel: string; summary: string; points: string[] }[];
  /** 2–4 sentences, ≤ 400 chars. */
  insight: string;
  sport: string | null;
  german: {
    cards: { card_id: string; example: string }[];
    new_word: { de: string; en: string; example: string; from_item_id: string } | null;
  };
  hobby_fact: { text: string; item_id: string | null } | null;
  /** Block J: a quote, proverb or date fact. */
  on_this_day: { text: string; author?: string } | null;
  tomorrow: string;

  // Back page (design/pages/back-page-*.html)
  /** Longer articles for front-page items (since 2026-11-09 printed on the front in place of the summary). */
  deep: { rubric: string; item_id: string; title: string; body: string }[];
  /** Rubrics that only appear on the back page, e.g. World. */
  back_news: NewsPick[];
  word_of_day: { de: string; en: string; example: string; extra: string } | null;
  /** German edition: hard words from today's German text with a short English meaning. */
  glossary?: { de: string; en: string }[];
}
