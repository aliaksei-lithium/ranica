import type { BlockId } from '../model';

/**
 * Priority per block (docs/03-design-brief.md §4). 1 = never removed, 5 = removed first.
 * public/fit.js removes the highest number first, last on the sheet first, until the sheet fits.
 */
export const PRIORITY: Record<BlockId, 1 | 2 | 3 | 4 | 5> = {
  masthead: 1,
  sun: 1,
  weather: 1,
  today: 1,
  footer: 1,
  german: 2,
  news: 2,
  insight: 2,
  telegram: 3,
  sport: 3,
  qr: 4,
  /** 3rd and 4th item of a news rubric: dropped first, so one-liners (more news) win over long items. */
  newsextra: 5,
  /** One-liners fill the rest of the sheet, dropped from the end; the rest move to the back page. */
  brief: 4,
  hobby: 4,
  onthisday: 5,
  // back page
  week: 2,
  depth: 2,
  hours: 3,
  world: 3,
  upcoming: 3,
  digest: 4,
  words: 4,
};

/** Attributes the fit loop reads. */
export const fit = (id: BlockId) => ({ 'data-block': id, 'data-priority': PRIORITY[id] });
