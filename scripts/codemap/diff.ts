import type { Marks } from '../../apps/codemap/src/data.ts';

/** 1-based, as git's `@@ -oldStart,oldCount +newStart,newCount @@`. A zero count puts the start on the line before. */
export interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

/** A path is null for an added or deleted file. */
export interface FileDiff {
  oldPath: string | null;
  newPath: string | null;
  hunks: Hunk[];
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const NO_FILE = '/dev/null';

function headerPaths(line: string): [string, string] {
  const rest = line.slice('diff --git a/'.length);
  const half = (rest.length - 3) / 2;
  if (Number.isInteger(half) && rest.slice(half, half + 3) === ' b/') {
    return [rest.slice(0, half), rest.slice(half + 3)];
  }
  const split = rest.indexOf(' b/');
  return [rest.slice(0, split), rest.slice(split + 3)];
}

function filePath(line: string, prefix: string): string | null {
  const path = line.slice(prefix.length);
  return path === NO_FILE ? null : path.replace(/^[ab]\//, '');
}

export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | undefined;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const [oldPath, newPath] = headerPaths(line);
      file = { oldPath, newPath, hunks: [] };
      files.push(file);
    } else if (!file) {
      continue;
    } else if (line.startsWith('rename from ')) {
      file.oldPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      file.newPath = line.slice('rename to '.length);
    } else if (file.hunks.length === 0 && line.startsWith('--- ')) {
      file.oldPath = filePath(line, '--- ');
    } else if (file.hunks.length === 0 && line.startsWith('+++ ')) {
      file.newPath = filePath(line, '+++ ');
    } else if (line.startsWith('@@')) {
      const m = HUNK.exec(line);
      if (!m) continue;
      file.hunks.push({
        oldStart: Number(m[1]),
        oldCount: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newCount: m[4] === undefined ? 1 : Number(m[4]),
      });
    }
  }
  return files;
}

/** The new line just below the place a hunk removed lines from. */
function belowRemoval(h: Hunk): number {
  return h.newCount === 0 ? h.newStart + 1 : h.newStart + h.newCount;
}

/** In a hunk that removes and adds, the first min(old, new) added lines count as changed. */
export function marksOf(hunks: readonly Hunk[], lineCount: number): Marks {
  const marks = new Array<string>(lineCount).fill('.');
  const deletedBefore: number[] = [];
  for (const h of hunks) {
    const changed = Math.min(h.oldCount, h.newCount);
    for (let i = 0; i < h.newCount; i++) marks[h.newStart - 1 + i] = i < changed ? 'c' : 'a';
    if (h.oldCount > h.newCount) deletedBefore.push(belowRemoval(h));
  }
  return { marks: marks.join(''), deletedBefore };
}

/** Where an old line sits in the new file, or the new line just below where it was removed. */
export function carryForward(
  line: number,
  hunks: readonly Hunk[],
): number | { removedBefore: number } {
  let shift = 0;
  for (const h of hunks) {
    const first = h.oldCount === 0 ? h.oldStart + 1 : h.oldStart;
    if (line < first) break;
    if (line < first + h.oldCount) return { removedBefore: belowRemoval(h) };
    shift += h.newCount - h.oldCount;
  }
  return line + shift;
}
