// Runs the browser suites the files changed since origin/main can break:
// layout for the interface, loading for what downloads when.
//
//   npm run test:browser            pick the suites, then run them
//   npm run test:browser -- --list  only say which, and why
//
// The first rule a file matches decides; a file no rule names runs both suites.

import { spawnSync } from 'node:child_process';
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
  // What downloads when. main.ts's landing callback is loading's too, but its
  // file is the interface's; a comment there asks for the loading suite.
  [
    /^packages\/shell\/src\/(loader|viewFiles|downloads|dataFiles|loadNotice|overlays\/prebuild)\.ts$/,
    LOADING,
  ],
  [/^apps\/[^/]+\/src\/files\.ts$/, LOADING],
  // The map is laid out from the data, and the layout suite records what a reader does.
  [/^public\/data\/|^packages\/shell\/src\/analytics\.ts$/, BOTH],
  [/^test\/loading\//, LOADING],
  [/^test\/browser\//, BOTH],
  [/^test\/layout\//, LAYOUT],
  // The page, its dev server and its dependencies. A dependency changes
  // package-lock.json; package.json alone is scripts and settings.
  [/^index\.html$/, LAYOUT],
  [/^(vite\.config\.ts|pages\.ts|build\.ts|package-lock\.json)$/, BOTH],
  // Unit tests' helpers, the Worker, tooling and configuration.
  [/(^|\/)test\//, NEITHER],
  [/^apps\/worker\//, NEITHER],
  [/^(docs|experiments|scripts|video|data|test-harness|\.github|\.githooks|\.claude)\//, NEITHER],
  [/^[^/]+\.(json|jsonc)$|^\.[^/]+$|^LICENSE$/, NEITHER],
  [/^(apps|packages|public)\//, LAYOUT],
];

/** The suites a change to `path` can break, and whether a rule named it. */
export function suitesFor(path: string): { suites: Suite[]; named: boolean } {
  const rule = RULES.find(([pattern]) => pattern.test(path));
  return rule ? { suites: rule[1], named: true } : { suites: BOTH, named: false };
}

/** Each suite with the files that call for it, in the order the suites run. */
export function plan(paths: readonly string[]): Map<Suite, string[]> {
  const called = new Map<Suite, string[]>([
    ['layout', []],
    ['loading', []],
  ]);
  for (const path of paths)
    for (const suite of suitesFor(path).suites) called.get(suite)!.push(path);
  for (const [suite, files] of called) if (files.length === 0) called.delete(suite);
  return called;
}

function git(...args: string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.split('\n').filter(Boolean);
}

/** The files changed since this branch left origin/main, committed or not. */
function changedFiles(): string[] {
  const [base] = git('merge-base', 'HEAD', 'origin/main');
  return [
    ...new Set([
      ...git('diff', '--name-only', base),
      ...git('ls-files', '--others', '--exclude-standard'),
    ]),
  ];
}

function main(args: string[]): void {
  const paths = changedFiles();
  const suites = plan(paths);
  const unnamed = paths.filter((path) => !suitesFor(path).named);
  const shown = (files: string[]) =>
    files.slice(0, 5).join(', ') + (files.length > 5 ? `, and ${files.length - 5} more` : '');

  console.log(`${paths.length} files changed since origin/main.`);
  for (const [suite, files] of suites) console.log(`  ${suite}: ${shown(files)}`);
  if (suites.size === 0) console.log('  No browser suite can break.');
  if (unnamed.length > 0)
    console.log(
      `  No rule in scripts/test-browser.ts names ${shown(unnamed)}, so both suites run.`,
    );
  if (args.includes('--list')) return;

  const failed = [...suites.keys()].filter(
    (suite) => spawnSync('npm', ['run', `test:${suite}`], { stdio: 'inherit' }).status !== 0,
  );
  if (failed.length > 0) {
    console.error(`Failed: ${failed.join(', ')}.`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
