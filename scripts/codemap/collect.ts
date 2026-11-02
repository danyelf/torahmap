import { execFileSync } from 'node:child_process';
import type { CodeFile, CodeStructure, CodeTexts, Marks } from '../../apps/codemap/src/data.ts';
import { carryForward, type FileDiff, type Hunk, marksOf, parseDiff } from './diff.ts';
import { isExcluded } from './exclude.ts';
import { lineKinds } from './lineKind.ts';

const MAX_BUFFER = 1 << 30;
const TAB_WIDTH = 4;
const SYMLINK_MODE = '120000';

/**
 * The environment without git's own variables. A git hook sets GIT_DIR and GIT_INDEX_FILE, which
 * would send every command to the hook's repository instead of the one in `cwd`.
 */
export function envWithoutGit(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    env: envWithoutGit(),
  });
}

/** Text files at head, by tree entry rather than the index, so any ref can be read. */
function headPaths(repo: string, head: string): string[] {
  return git(repo, ['ls-tree', '-r', '-z', head])
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [info, path] = entry.split('\t');
      const [mode, type] = info.split(' ');
      return { mode, type, path };
    })
    .filter((e) => e.type === 'blob' && e.mode !== SYMLINK_MODE && !isExcluded(e.path))
    .map((e) => e.path);
}

function readLines(repo: string, head: string, path: string): string[] {
  const lines = git(repo, ['show', `${head}:${path}`]).split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Where a line's bar starts and where its text ends, in columns. */
function shape(line: string): { indent: number; length: number } {
  const lead = /^[ \t]*/.exec(line)![0];
  let indent = 0;
  for (const ch of lead) indent += ch === '\t' ? TAB_WIDTH : 1;
  return { indent, length: indent + line.slice(lead.length).trimEnd().length };
}

function lastChanged(repo: string, head: string, path: string): number[] {
  return git(repo, ['blame', '--line-porcelain', '-M', '-C', head, '--', path])
    .split('\n')
    .filter((line) => line.startsWith('committer-time '))
    .map((line) => Number(line.slice('committer-time '.length)));
}

/**
 * How many commits made or changed each line, walking the file's first-parent history: a
 * merged pull request counts once, and the walk stays linear so lines carry forward.
 */
function timesChanged(repo: string, head: string, path: string, lineCount: number): number[] {
  const log = git(repo, [
    'log',
    '--follow',
    '--first-parent',
    '--diff-merges=first-parent',
    '--format=',
    '-p',
    '-U0',
    '-M',
    head,
    '--',
    path,
  ]);
  let counts: number[] = [];
  for (const { hunks } of parseDiff(log).reverse()) {
    const grown = hunks.reduce((n, h) => n + h.newCount - h.oldCount, 0);
    const next = new Array<number>(counts.length + grown).fill(0);
    counts.forEach((count, i) => {
      const to = carryForward(i + 1, hunks);
      if (typeof to === 'number') next[to - 1] = count;
    });
    for (const h of hunks) {
      const changed = Math.min(h.oldCount, h.newCount);
      for (let i = 0; i < h.newCount; i++) {
        next[h.newStart - 1 + i] = i < changed ? counts[h.oldStart - 1 + i] + 1 : 1;
      }
    }
    counts = next;
  }
  if (counts.length !== lineCount) {
    console.warn(`${path}: history gives ${counts.length} lines, head has ${lineCount}`);
    return new Array<number>(lineCount).fill(1);
  }
  return counts;
}

interface HeadMarks {
  lines: Map<number, string>;
  deletedBefore: number[];
}

/**
 * One commit's marks, carried through the later commits to the head, by head path. A marked
 * line a later commit removes becomes a deletion where it was removed.
 */
function commitMarks(diffs: readonly FileDiff[][], index: number): Map<string, HeadMarks> {
  const byPath = new Map<string, HeadMarks>();
  const later = diffs.slice(index + 1).map((files) => {
    const byOld = new Map<string, FileDiff>();
    for (const f of files) if (f.oldPath !== null) byOld.set(f.oldPath, f);
    return byOld;
  });
  for (const file of diffs[index]) {
    if (file.newPath === null) continue;
    const end = Math.max(0, ...file.hunks.map((h) => h.newStart + h.newCount - 1));
    const own = marksOf(file.hunks, end);
    let lines = new Map<number, string>();
    [...own.marks].forEach((mark, i) => {
      if (mark !== '.' && mark !== '') lines.set(i + 1, mark);
    });
    let deletedBefore = own.deletedBefore;
    let path: string | null = file.newPath;
    for (const byOld of later) {
      const step = byOld.get(path);
      if (!step) continue;
      path = step.newPath;
      if (path === null) break;
      const carried = carry(lines, deletedBefore, step.hunks);
      lines = carried.lines;
      deletedBefore = carried.deletedBefore;
    }
    if (path !== null) byPath.set(path, { lines, deletedBefore });
  }
  return byPath;
}

function carry(lines: Map<number, string>, gaps: number[], hunks: readonly Hunk[]): HeadMarks {
  const moved = new Map<number, string>();
  const deletedBefore: number[] = [];
  const place = (line: number): number | null => {
    const to = carryForward(line, hunks);
    if (typeof to === 'number') return to;
    deletedBefore.push(to.removedBefore);
    return null;
  };
  for (const [line, mark] of lines) {
    const to = place(line);
    if (to !== null) moved.set(to, mark);
  }
  for (const gap of gaps) {
    const to = place(gap);
    if (to !== null) deletedBefore.push(to);
  }
  return { lines: moved, deletedBefore };
}

function onHead(found: HeadMarks | undefined, lineCount: number): Marks {
  const marks = new Array<string>(lineCount).fill('.');
  for (const [line, mark] of found?.lines ?? []) if (line <= lineCount) marks[line - 1] = mark;
  const deletedBefore = [...new Set(found?.deletedBefore ?? [])].sort((a, b) => a - b);
  return { marks: marks.join(''), deletedBefore };
}

const NO_MARKS: Marks = { marks: '', deletedBefore: [] };
// A deleted file is one removal, above its stub's one line.
const FILE_REMOVED: Marks = { marks: '', deletedBefore: [1] };

/** The commit that deleted the file at `path` in the base, following its renames; -1 for none. */
function deletingCommit(diffs: readonly FileDiff[][], path: string): number {
  let at = path;
  for (const [i, files] of diffs.entries()) {
    const step = files.find((f) => f.oldPath === at);
    if (!step) continue;
    if (step.newPath === null) return i;
    at = step.newPath;
  }
  return -1;
}

export function collect(
  repo: string,
  base: string,
  head: string,
  repoUrl: string,
): { structure: CodeStructure; texts: CodeTexts } {
  const headSha = git(repo, ['rev-parse', `${head}^{commit}`]).trim();
  const baseSha = git(repo, ['merge-base', base, headSha]).trim();
  const commits = git(repo, [
    'log',
    '--reverse',
    '--first-parent',
    '--format=%H %s',
    `${baseSha}..${headSha}`,
  ])
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const space = line.indexOf(' ');
      return { sha: line.slice(0, space), subject: line.slice(space + 1) };
    });

  const prDiff = parseDiff(git(repo, ['diff', '-U0', '-M', baseSha, headSha]));
  const commitDiffs = commits.map(({ sha }) =>
    parseDiff(git(repo, ['diff', '-U0', '-M', `${sha}^`, sha])),
  );
  const perCommit = commits.map((_, i) => commitMarks(commitDiffs, i));
  const prByPath = new Map(prDiff.flatMap((f) => (f.newPath === null ? [] : [[f.newPath, f]])));

  const entries: { file: CodeFile; lines: string[] }[] = headPaths(repo, headSha).map((path) => {
    const lines = readLines(repo, headSha, path);
    const shapes = lines.map(shape);
    const pr = prByPath.get(path);
    return {
      lines,
      file: {
        path,
        indent: shapes.map((s) => s.indent),
        length: shapes.map((s) => s.length),
        kind: lineKinds(path, lines),
        lastChanged: lastChanged(repo, headSha, path),
        timesChanged: timesChanged(repo, headSha, path, lines.length),
        pr: pr ? marksOf(pr.hunks, lines.length) : onHead(undefined, lines.length),
        commits: perCommit.map((byPath) => onHead(byPath.get(path), lines.length)),
      },
    };
  });
  for (const f of prDiff) {
    if (f.newPath !== null || f.oldPath === null || isExcluded(f.oldPath)) continue;
    const deletedBy = deletingCommit(commitDiffs, f.oldPath);
    entries.push({
      lines: [],
      file: {
        path: f.oldPath,
        indent: [],
        length: [],
        kind: '',
        lastChanged: [],
        timesChanged: [],
        pr: FILE_REMOVED,
        commits: commits.map((_, i) => (i === deletedBy ? FILE_REMOVED : NO_MARKS)),
        deleted: true,
      },
    });
  }
  entries.sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));

  return {
    structure: {
      repoUrl,
      base: baseSha,
      head: headSha,
      commits,
      files: entries.map((e) => e.file),
    },
    texts: entries.map((e) => e.lines),
  };
}
