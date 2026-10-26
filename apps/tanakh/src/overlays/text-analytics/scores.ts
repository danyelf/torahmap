// The Text Analytics scores file, and how its numbers read. Free of the page,
// so the script that writes the file and its report can use it too.

export const SCORES_FILE = 'overlays/text-analytics/scores.json';

/** Book → chapter → each verse's score, from verse 1; null for a verse with none. */
export type MeasureScores = Record<string, Record<string, (number | null)[]>>;

/**
 * Book → chapter → verse number → the stretches of the verse's words that repeat, as start, end
 * pairs (end excluded) in one list, counting words as the verse's length does. A verse with
 * none, or without a score, is left out.
 */
export type RepeatedWords = Record<string, Record<string, Record<string, number[]>>>;

/** The values the scores were computed with, for the legend to name. */
export interface ScoreParameters {
  minWords: number;
  runWords: number;
  reachVerses: number;
  formulaBooks: number;
}

export interface ScoresFile {
  parameters: ScoreParameters;
  repetition: MeasureScores;
  repeated: RepeatedWords;
}

// The colours span the middle of the scores, so a handful of extreme passages
// do not push every other verse into one end of the scale.
export const LOW_PERCENTILE = 0.02;
export const HIGH_PERCENTILE = 0.98;

/** The value a share `q` of `sorted` falls at or below. */
export function percentile(sorted: readonly number[], q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
}

export const percent = (v: number): string => `${Math.round(v * 100)}%`;
