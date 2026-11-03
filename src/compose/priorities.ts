import type { BlockId } from '../model';

/**
 * Priority per block (docs/03-design-brief.md §4). 1 = never removed, 5 = removed first.
 * The fit-to-page loop (public/fit.js) removes the highest number first, bottom-up.
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
  sport: 3,
  hobby: 4,
  onthisday: 5,
};
