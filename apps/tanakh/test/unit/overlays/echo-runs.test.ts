import { describe, it, expect } from 'vitest';
import { echoRun, type EchoesFile } from '../../../src/overlays/text-analytics/echoes';

/** An echoes file from pairs of positions, each sharing `words` words. */
const fileOf = (pairs: [number, number][], words = 5): EchoesFile => {
  const file: EchoesFile = {};
  for (const [a, b] of pairs) (file[a] ??= []).push(b, words);
  return file;
};
const sorted = (pairs: [number, number][]) => [...pairs].sort((p, q) => p[0] - q[0] || p[1] - q[1]);

describe('the run of parallel verses an echo belongs to', () => {
  it('follows verse after verse on both sides of the one asked about', () => {
    const file = fileOf([
      [10, 50],
      [11, 51],
      [12, 52],
    ]);
    expect(sorted(echoRun(file, 11, 5))).toEqual([
      [10, 50],
      [11, 51],
      [12, 52],
    ]);
  });

  it('is the same run from the other side', () => {
    const file = fileOf([
      [10, 50],
      [11, 51],
    ]);
    expect(sorted(echoRun(file, 51, 5))).toEqual([
      [50, 10],
      [51, 11],
    ]);
  });

  it('bridges a few verses missing on either side, but not a long gap', () => {
    const file = fileOf([
      [10, 50],
      [14, 54],
      [30, 70],
    ]);
    expect(sorted(echoRun(file, 10, 5))).toEqual([
      [10, 50],
      [14, 54],
    ]);
    expect(echoRun(file, 30, 5)).toEqual([[30, 70]]);
  });

  it('keeps to echoes of at least the words asked for', () => {
    const file: EchoesFile = { 10: [50, 6], 11: [51, 4] };
    expect(echoRun(file, 10, 5)).toEqual([[10, 50]]);
  });

  it('is empty for a verse with no echoes', () => {
    expect(echoRun(fileOf([[10, 50]]), 30, 5)).toEqual([]);
  });
});
