/** The rows of a list that a scroll box shows, with room to scroll to the rest. */
export interface RowWindow {
  /** First row to draw. */
  start: number;
  /** One past the last row to draw. */
  end: number;
  /** Height of the rows before `start`. */
  before: number;
  /** Height of the rows from `end` on. */
  after: number;
}

/**
 * Which of rows of the given `heights` (each with the gap below it) overlap a box `viewport` tall
 * scrolled to `scrollTop`, widened by `overscan` rows each way.
 */
export function windowOf(
  heights: readonly number[],
  scrollTop: number,
  viewport: number,
  overscan: number,
): RowWindow {
  const total = heights.reduce((sum, h) => sum + h, 0);
  let start = 0;
  let top = 0;
  while (start < heights.length && top + heights[start] <= scrollTop) top += heights[start++];
  let end = start;
  let bottom = top;
  while (end < heights.length && bottom < scrollTop + viewport) bottom += heights[end++];
  const first = Math.max(0, start - overscan);
  while (start > first) top -= heights[--start];
  const stop = Math.min(heights.length, end + overscan);
  for (; end < stop; end++) bottom += heights[end];
  return { start, end, before: top, after: total - bottom };
}
