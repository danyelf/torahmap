import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carryForward, marksOf, parseDiff } from './diff.ts';

const SAMPLE = readFileSync('scripts/codemap/fixtures/sample.diff', 'utf8');

describe('parseDiff', () => {
  it('reads paths and hunks of modified, added, deleted and renamed files', () => {
    expect(parseDiff(SAMPLE).map((f) => [f.oldPath, f.newPath, f.hunks.length])).toEqual([
      ['a.ts', 'a.ts', 2],
      [null, 'add.ts', 1],
      ['gone.ts', null, 1],
      ['old.ts', 'new.ts', 1],
    ]);
  });

  it('reads a missing count as 1 and a zero count as zero', () => {
    const [a, add] = parseDiff(SAMPLE);
    expect(a.hunks).toEqual([
      { oldStart: 3, oldCount: 1, newStart: 3, newCount: 1 },
      { oldStart: 9, oldCount: 1, newStart: 8, newCount: 0 },
    ]);
    expect(add.hunks).toEqual([{ oldStart: 0, oldCount: 0, newStart: 1, newCount: 2 }]);
  });

  it('keeps a rename with no edits', () => {
    const text =
      'diff --git a/x.ts b/y.ts\nsimilarity index 100%\nrename from x.ts\nrename to y.ts\n';
    expect(parseDiff(text)).toEqual([{ oldPath: 'x.ts', newPath: 'y.ts', hunks: [] }]);
  });
});

describe('marksOf', () => {
  it('marks changed lines then added lines', () => {
    expect(marksOf([{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 3 }], 12)).toEqual({
      marks: '.........cca',
      deletedBefore: [],
    });
  });

  it('marks a pure deletion below the gap', () => {
    expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 4, newCount: 0 }], 6)).toEqual({
      marks: '......',
      deletedBefore: [5],
    });
  });

  it('marks a shrinking change and the line below it', () => {
    expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 5, newCount: 1 }], 6)).toEqual({
      marks: '....c.',
      deletedBefore: [6],
    });
  });

  it('marks a pure addition as added', () => {
    expect(marksOf([{ oldStart: 0, oldCount: 0, newStart: 1, newCount: 2 }], 3)).toEqual({
      marks: 'aa.',
      deletedBefore: [],
    });
  });
});

describe('carryForward', () => {
  const hunks = [{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 5 }];

  it('keeps lines above a hunk and shifts lines below it', () => {
    expect(carryForward(3, hunks)).toBe(3);
    expect(carryForward(20, hunks)).toBe(23);
  });

  it('reports the line below a removed line', () => {
    expect(carryForward(11, hunks)).toEqual({ removedBefore: 15 });
  });

  it('reports a line removed by a pure deletion', () => {
    expect(carryForward(5, [{ oldStart: 5, oldCount: 3, newStart: 4, newCount: 0 }])).toEqual({
      removedBefore: 5,
    });
  });

  it('shifts by every earlier hunk, including pure additions', () => {
    const two = [
      { oldStart: 2, oldCount: 0, newStart: 3, newCount: 2 },
      { oldStart: 9, oldCount: 1, newStart: 10, newCount: 0 },
    ];
    expect(carryForward(2, two)).toBe(2);
    expect(carryForward(3, two)).toBe(5);
    expect(carryForward(9, two)).toEqual({ removedBefore: 11 });
    expect(carryForward(10, two)).toBe(11);
  });
});

describe('parseDiff hunk bodies', () => {
  it('does not read file headers from body lines that look like them', () => {
    const text = [
      'diff --git a/q.sql b/q.sql',
      '--- a/q.sql',
      '+++ b/q.sql',
      '@@ -1,2 +1,2 @@',
      '--- x',
      '+++ y',
      '@@ -9 +9 @@',
      '--- z',
      '+++ w',
      '',
    ].join('\n');
    expect(parseDiff(text).map((f) => [f.oldPath, f.newPath, f.hunks.length])).toEqual([
      ['q.sql', 'q.sql', 2],
    ]);
  });
});
