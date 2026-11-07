// A collected item, shaped like a row of the D1 `item` table (docs/02-plan.md §4).

export interface Item {
  sourceId: string;
  /** Feed guid / Telegram post id; falls back to the URL. */
  externalId: string;
  url: string;
  title: string;
  /** Plain text, ≤ 2 kB. */
  body: string;
  /** ISO 8601, or null when the feed gives no usable date. */
  publishedAt: string | null;
  /** Dedupe key, unique per (sourceId, hash). */
  hash: string;
}

/** Max characters kept in `Item.body` (2 kB budget per row). */
export const BODY_MAX = 2000;
