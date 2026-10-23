// The Text analytics scores file, and how its numbers read. Free of the page,
// so the script that writes the file and its report can use it too.

import type { TEXT_ANALYTICS_MEASURES } from '@torahmap/overlay-catalog';

export const SCORES_FILE = 'overlays/text-analytics/scores.json';

export type Measure = (typeof TEXT_ANALYTICS_MEASURES)[number];

/** What each measure is called wherever a reader sees it. */
export const MEASURE_LABELS: Record<Measure, string> = {
  repetition: 'Repetitive wording',
};

/** Book → chapter → each verse's score, from verse 1; null for a verse with none. */
export type MeasureScores = Record<string, Record<string, (number | null)[]>>;

/** The values the measures were computed with, for the legend to name. */
export interface ScoreParameters {
  minWords: number;
  runWords: number;
  reachVerses: number;
  formulaBooks: number;
}

export type ScoresFile = { parameters: ScoreParameters } & Record<Measure, MeasureScores>;

// The colours span the middle of the scores, so a handful of extreme passages
// do not push every other verse into one end of the scale.
export const LOW_PERCENTILE = 0.02;
export const HIGH_PERCENTILE = 0.98;

/** The value a share `q` of `sorted` falls at or below. */
export function percentile(sorted: readonly number[], q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
}

export const percent = (v: number): string => `${Math.round(v * 100)}%`;
