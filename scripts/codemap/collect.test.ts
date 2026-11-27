import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CodeFile, CodeStructure } from '../../apps/codemap/src/data.ts';
import { collect, envWithoutGit } from './collect.ts';
import { isExcluded } from './exclude.ts';

const URL = 'https://example.com/r';
const MAIN_TIME = 1_700_000_000;
const MAIN_EDIT_TIME = MAIN_TIME + 500;
const COMMIT_1_TIME = MAIN_TIME + 1000;
const COMMIT_2_TIME = MAIN_TIME + 2000;

const OLD = [
  'export function old() {',
  '  return 1;',
  '\treturn 10 + 200;',
  '}',
  '',
  '// the old file',
  '',
].join('\n');

let repo: string;

function git(args: string[], time = MAIN_TIME): string {
  return execFileSync('git', ['-c', 'init.defaultBranch=main', ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...envWithoutGit(),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_AUTHOR_DATE: `${time} +0000`,
      GIT_COMMITTER_DATE: `${time} +0000`,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

function write(path: string, lines: string[]): void {
  writeFileSync(join(repo, path), lines.join('\n') + '\n');
}

function commit(message: string, time: number): void {
  git(['add', '-A'], time);
  git(['commit', '-q', '-m', message], time);
}

function fileAt(structure: CodeStructure, path: string): CodeFile {
  const file = structure.files.find((f) => f.path === path);
  if (!file) throw new Error(`no ${path}`);
  return file;
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'codemap-'));
  git(['init', '-q']);
  write('a.ts', ['one', 'two', 'three', 'four', 'five']);
  writeFileSync(join(repo, 'old.ts'), OLD);
  write('gone.ts', ['gone']);
  write('package-lock.json', ['{}']);
  commit('main', MAIN_TIME);
  writeFileSync(join(repo, 'old.ts'), OLD.replace('// the old file', '// the old file, edited'));
  commit('main edit', MAIN_EDIT_TIME);
  git(['checkout', '-q', '-b', 'branch']);
  write('a.ts', ['one', 'TWO', 'three', 'four', 'five', 'six']);
  commit('first', COMMIT_1_TIME);
  write('a.ts', ['one', 'TWO', 'three', 'five', 'six']);
  git(['mv', 'old.ts', 'new.ts'], COMMIT_2_TIME);
  unlinkSync(join(repo, 'gone.ts'));
  commit('second', COMMIT_2_TIME);
  git(['checkout', '-q', '-b', 'side', 'main']);
  write('side.ts', ['s']);
  commit('side one', COMMIT_1_TIME);
  write('side.ts', ['s', 't']);
  commit('side two', COMMIT_2_TIME);
  git(['checkout', '-q', '-b', 'merged', 'main']);
  git(['merge', '-q', '--no-ff', '-m', 'merge side', 'side'], COMMIT_2_TIME + 100);
  git(['checkout', '-q', 'main']);
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('collect', () => {
  it('marks the pull request and each commit on the head lines', () => {
    const { structure } = collect(repo, 'main', 'branch', URL);
    const a = fileAt(structure, 'a.ts');
    expect(a.pr).toEqual({ marks: '.c..a', deletedBefore: [4] });
    expect(a.commits.map((c) => c.marks)).toEqual(['.c..a', '.....']);
    expect(a.commits[1].deletedBefore).toEqual([4]);
    expect(structure.commits.map((c) => c.subject)).toEqual(['first', 'second']);
  });

  it('follows a rename and keeps a deleted file as a stub', () => {
    const { structure } = collect(repo, 'main', 'branch', URL);
    expect(new Set(fileAt(structure, 'new.ts').pr.marks)).toEqual(new Set(['.']));
    const gone = fileAt(structure, 'gone.ts');
    expect(gone.deleted).toBe(true);
    expect(gone.indent).toEqual([]);
    expect(gone.commits).toHaveLength(2);
  });

  it('marks a deleted file as removed in the pull request and in the commit that deleted it alone', () => {
    const gone = fileAt(collect(repo, 'main', 'branch', URL).structure, 'gone.ts');
    expect(gone.pr.deletedBefore).toEqual([1]);
    expect(gone.commits.map((c) => c.deletedBefore)).toEqual([[], [1]]);
  });

  it('counts and dates each line over the whole history', () => {
    const { structure } = collect(repo, 'main', 'branch', URL);
    const a = fileAt(structure, 'a.ts');
    expect(a.timesChanged).toEqual([1, 2, 1, 1, 1]);
    const timeOf = (change: number) => structure.changes[change].time;
    expect(a.lastChange.map(timeOf)).toEqual([
      MAIN_TIME,
      COMMIT_1_TIME,
      MAIN_TIME,
      MAIN_TIME,
      COMMIT_1_TIME,
    ]);
    const renamed = fileAt(structure, 'new.ts');
    expect(renamed.timesChanged).toEqual([1, 1, 1, 1, 1, 2]);
    expect(timeOf(renamed.lastChange[5])).toBe(MAIN_EDIT_TIME);
  });

  it('places each change among all the commits and among the mainline steps', () => {
    const { structure } = collect(repo, 'main', 'branch', URL);
    const change = (path: string, line: number) =>
      structure.changes[fileAt(structure, path).lastChange[line - 1]];
    // main, main edit, first, second: one commit each, and each its own mainline step.
    expect(change('a.ts', 1)).toMatchObject({ commit: 0, pr: 0 });
    expect(change('new.ts', 6)).toMatchObject({ commit: 1, pr: 1 });
    expect(change('a.ts', 2)).toMatchObject({ commit: 2, pr: 2 });
  });

  it('counts a merged branch as one mainline step', () => {
    const { structure } = collect(repo, 'merged', 'merged', URL);
    const [one, two] = fileAt(structure, 'side.ts').lastChange.map((c) => structure.changes[c]);
    expect(one.commit).toBeLessThan(two.commit);
    expect(one.pr).toBe(two.pr);
    expect(one.pr).toBeGreaterThan(structure.changes[fileAt(structure, 'old.ts').lastChange[5]].pr);
  });

  it('gives each head line its text, shape and kind', () => {
    const { structure, texts } = collect(repo, 'main', 'branch', URL);
    const a = fileAt(structure, 'a.ts');
    expect(texts[structure.files.indexOf(a)]).toHaveLength(a.indent.length);
    const n = fileAt(structure, 'new.ts');
    expect(texts[structure.files.indexOf(n)][1]).toBe('  return 1;');
    expect(n.indent.slice(0, 3)).toEqual([0, 2, 4]);
    expect(n.length.slice(0, 3)).toEqual([23, 11, 20]);
    expect(n.kind[0]).toBe('h');
  });

  it('leaves out excluded files', () => {
    const { structure } = collect(repo, 'main', 'branch', URL);
    expect(structure.files.map((f) => f.path)).toEqual(['a.ts', 'gone.ts', 'new.ts']);
  });

  it('has no commits when the head is the base', () => {
    expect(collect(repo, 'main', 'main', URL).structure.commits).toEqual([]);
  });
});

describe('isExcluded', () => {
  it('leaves out lockfiles, shipped data and binaries', () => {
    expect(isExcluded('package-lock.json')).toBe(true);
    expect(isExcluded('apps/x/pnpm-lock.yaml')).toBe(true);
    expect(isExcluded('public/data/codemap/texts.json')).toBe(true);
    expect(isExcluded('data/texts/genesis-he.json')).toBe(true);
    expect(isExcluded('experiments/eu-ai-act/downloads/law.xhtml')).toBe(true);
    expect(isExcluded('experiments/eu-ai-act/build.ts')).toBe(false);
    expect(isExcluded('experiments/eu-ai-act/ai-act.json')).toBe(true);
    expect(isExcluded('experiments/eu-ai-act/refs.json')).toBe(true);
    expect(isExcluded('docs/shot.PNG')).toBe(true);
    expect(isExcluded('apps/codemap/src/data.ts')).toBe(false);
  });
});
