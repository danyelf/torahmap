// Runs the browser tests the files changed since origin/main can break: the
// layout suite for the interface, the loading suite for what downloads when,
// and of each only the tests of the texts the change belongs to.
//
//   npm run test:browser            pick the tests, then run them
//   npm run test:browser -- --list  only say which, and why
//   npm run test:browser -- --all   every test in both suites
//
// The first rule a file matches decides the suites; a file no rule names runs
// both. A file of one text's own (its app, its data, its tests) runs that
// text's tests; any other runs every text's.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type Suite = 'layout' | 'loading';

const NEITHER: Suite[] = [];
const LAYOUT: Suite[] = ['layout'];
const LOADING: Suite[] = ['loading'];
const BOTH: Suite[] = ['layout', 'loading'];

const RULES: [RegExp, Suite[]][] = [
  [/\.test\.ts$/, NEITHER],
  // Stories are Markdown the map shows; the rest is documents.
  [/^packages\/stories\/markdown\//, LAYOUT],
  [/\.md$/, NEITHER],
  // What downloads when, and what the page says while it waits. What main.ts
  // asks of these is loading's too: see the comment above createLoader.
  [
    /^packages\/shell\/src\/(loader|viewFiles|downloads|dataFiles|loadNotice|overlays\/prebuild)\.ts$/,
    LOADING,
  ],
  [/^apps\/[^/]+\/src\/files\.ts$/, LOADING],
  // Each text's data files, by name and how they are read: the map is drawn
  // from them, and search waits on them.
  [/^apps\/[^/]+\/src\/(data|verseTexts|search\/data)\.ts$/, BOTH],
  // Both suites draw the map from the data and record what the app sends.
  [/^public\/data\/|^packages\/shell\/src\/analytics\.ts$/, BOTH],
  [/^test\/loading\//, LOADING],
  [/^test\/browser\//, BOTH],
  [/^test\/layout\//, LAYOUT],
  // The page, its build and its dependencies. A dependency changes
  // package-lock.json; package.json alone is scripts and settings.
  [/^index\.html$/, LAYOUT],
  [/^(vite\.config\.ts|pages\.ts|build\.ts|package-lock\.json)$/, BOTH],
  // The VIS layout tests pack their stand-in text with it.
  [/^scripts\/ieeevis\/pack\.ts$/, LAYOUT],
  // Unit tests' helpers, the Worker, tooling and configuration.
  [/(^|\/)test\//, NEITHER],
  [/^apps\/worker\//, NEITHER],
  [/^(docs|experiments|scripts|video|data|test-harness|\.github|\.githooks|\.claude)\//, NEITHER],
  [/^[^/]+\.(json|jsonc)$|^\.[^/]+$|^LICENSE$|^vitest\.config\.ts$/, NEITHER],
  [/^(apps|packages|public)\//, LAYOUT],
];

/** The suites a change to `path` can break, and whether a rule named it. */
export function suitesFor(path: string): { suites: Suite[]; named: boolean } {
  const rule = RULES.find(([pattern]) => pattern.test(path));
  return rule ? { suites: rule[1], named: true } : { suites: BOTH, named: false };
}

/** The folders in apps/: each text's, and the Worker's, which no rule gives a suite. */
const TEXTS = readdirSync(new URL('../apps/', import.meta.url));

/** The text a spec file is named for, as in tanakh-analytics.spec.ts. */
function textOfSpec(file: string): string | undefined {
  const text = file.match(/^([^/.-]+)[^/]*\.spec\.ts$/)?.[1];
  return text && TEXTS.includes(text) ? text : undefined;
}

/** The text whose own code, data or tests `path` is; undefined for what every text shares. */
export function textOf(path: string): string | undefined {
  const own = path.match(/^(?:apps|public\/data)\/([^/]+)\//)?.[1];
  if (own && TEXTS.includes(own)) return own;
  const spec = textOfSpec(path.match(/^test\/(?:layout|loading)\/(.+)$/)?.[1] ?? '');
  if (spec) return spec;
  // The rest of public/data is the Tanakh's, and so are the stories.
  if (/^public\/data\/|^packages\/stories\/markdown\//.test(path)) return 'tanakh';
  return undefined;
}

/** What a suite runs: the tests of `texts`, or of every text, for the changed `files`. */
export interface Run {
  files: string[];
  texts: Set<string> | 'every';
}

/** Each suite a change calls for, in the order the suites run. */
export function plan(paths: readonly string[]): Map<Suite, Run> {
  const runs = new Map<Suite, Run>(BOTH.map((suite) => [suite, { files: [], texts: new Set() }]));
  for (const path of paths) {
    const text = textOf(path);
    for (const suite of suitesFor(path).suites) {
      const run = runs.get(suite)!;
      run.files.push(path);
      if (text === undefined) run.texts = 'every';
      else if (run.texts !== 'every') run.texts.add(text);
    }
  }
  for (const [suite, run] of runs) if (run.files.length === 0) runs.delete(suite);
  return runs;
}

/** The spec files in `files` named for one of `texts`. */
export function specsOf(texts: ReadonlySet<string>, files: readonly string[]): string[] {
  return files.filter((file) => texts.has(textOfSpec(file) ?? ''));
}

function git(...args: string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.split('\n').filter(Boolean);
}

/**
 * The files changed since this branch left origin/main, committed or not. A
 * renamed file counts under its old path as well as its new one.
 */
export function changedFiles(): string[] {
  const [base] = git('merge-base', 'HEAD', 'origin/main');
  return [
    ...new Set([
      ...git('diff', '--name-only', '--no-renames', base),
      ...git('ls-files', '--others', '--exclude-standard', '--full-name'),
    ]),
  ];
}

const shown = (files: string[]) =>
  files.slice(0, 5).join(', ') + (files.length > 5 ? `, and ${files.length - 5} more` : '');

/** The runs the changed files call for, said as they are worked out. */
function planChanges(): Map<Suite, Run> {
  let paths: string[];
  try {
    paths = changedFiles();
  } catch (error) {
    console.error(`Cannot tell what changed since origin/main. ${(error as Error).message}`);
    process.exit(1);
  }
  const runs = plan(paths);
  const unnamed = paths.filter((path) => !suitesFor(path).named);
  console.log(`${paths.length} files changed since origin/main.`);
  for (const [suite, { files, texts }] of runs) {
    const whose = texts === 'every' ? 'every text' : [...texts].join(' and ');
    console.log(`  ${suite}, the tests of ${whose}: ${shown(files)}`);
  }
  if (runs.size === 0) console.log('  No browser test can break.');
  if (unnamed.length > 0)
    console.log(
      `  No rule in scripts/test-browser.ts names ${shown(unnamed)}, so both suites run.`,
    );
  return runs;
}

function main(args: string[]): void {
  const all = args.includes('--all');
  if (all) console.log('Every test in both suites.');
  // Playwright's arguments for each suite: none for every test, else the spec files to run.
  const filters = new Map<Suite, string[]>(all ? BOTH.map((suite) => [suite, []]) : []);
  for (const [suite, { texts }] of all ? [] : planChanges()) {
    if (texts === 'every') {
      filters.set(suite, []);
      continue;
    }
    const specs = specsOf(texts, readdirSync(new URL(`../test/${suite}/`, import.meta.url)));
    if (specs.length > 0) filters.set(suite, specs);
    else console.log(`  The ${suite} suite has no tests of ${[...texts].join(' or ')}.`);
  }
  if (args.includes('--list')) return;
  if (!all && filters.size > 0)
    console.log(
      'This is the run a pull request needs.' +
        (filters.has('layout')
          ? ' While working, check one layout state at a time: npm run test:layout -- -g <state>'
          : ''),
    );

  const failed = [...filters].filter(
    ([suite, specs]) =>
      spawnSync('npm', ['run', `test:${suite}`, '--', ...specs], { stdio: 'inherit' }).status !== 0,
  );
  if (failed.length > 0) {
    console.error(`Failed: ${failed.map(([suite]) => suite).join(', ')}.`);
    process.exit(1);
  }
  if (!all && filters.has('layout'))
    console.log(
      'Passed. To show the change in its pull request, draw the states it touches, named in ' +
        'test/layout/app.ts: npm run shots -- <state>...',
    );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
