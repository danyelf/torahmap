// Draws the named layout states on the real map, on a desktop and a phone, redraws the share
// cards, and publishes the pictures for the pull request, printing their Markdown. A share card
// is published when the branch changes it.
//
//   npm run shots -- explore-search act-search
//
// The states are named in test/layout/app.ts. Every state on every screen, with the contact
// sheet at layout-report/index.html, is npm run test:layout:shots.
//
// Main does not track the pictures: two branches that redraw the same one cannot be merged. They
// go to `refs/shots/<branch>`, a commit holding only them. A clone fetches branches and tags only,
// so they cost no one a download, and the ref keeps every commit the links name. Publishing again
// adds a commit on top; earlier links still work. To look through them later:
//
//   git fetch origin 'refs/shots/*:refs/shots/*'
//   git archive refs/shots/<branch> | tar -x -C <dir>

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DESKTOP_AND_PHONE } from '../test/browser/screens.ts';
import { changedFiles } from './test-browser.ts';

const SHOTS_DIR = 'layout-report/shots';

/** Playwright's --grep for the tests that draw `states`, and the share cards. */
export function grepFor(states: string[]): string {
  const names = states.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return `(^| )(${names})$|shareCards\\.spec\\.ts`;
}

/** The screenshot of each state on each screen, `<state>--<screen>.png`. */
export const shotNames = (states: string[], screens: string[]): string[] =>
  states.flatMap((s) => screens.map((screen) => `${s}--${screen}.png`)).sort();

/** `owner/repo` from a GitHub remote, over HTTPS or SSH. */
export function repoOf(remoteUrl: string): string {
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?\/?$/);
  if (!match) throw new Error(`Not a GitHub remote: ${remoteUrl}`);
  return match[1];
}

export function markdown(repo: string, commit: string, files: string[]): string {
  return files
    .map(
      (f) =>
        `![${f.replace(/\.\w+$/, '')}](https://github.com/${repo}/blob/${commit}/${f}?raw=true)`,
    )
    .join('\n');
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** Publishes `paths`, each under its own name, with `message`; returns their Markdown. */
function publish(paths: string[], message: string): string {
  const branch = git('branch', '--show-current');
  if (!branch || branch === 'main') throw new Error('Publish from the pull request’s branch.');
  const ref = `refs/shots/${branch}`;

  const tree = execFileSync('git', ['mktree'], {
    encoding: 'utf8',
    input: paths
      .map((p) => `100644 blob ${git('hash-object', '-w', p)}\t${basename(p)}\n`)
      .join(''),
  }).trim();
  const previous = git('ls-remote', 'origin', ref).split('\t')[0];
  if (previous) git('fetch', '--quiet', 'origin', ref);
  const parent = previous ? ['-p', previous] : [];
  const commit = git('commit-tree', tree, ...parent, '-m', message);
  git('push', '--quiet', 'origin', `${commit}:${ref}`);

  return markdown(
    repoOf(git('remote', 'get-url', 'origin')),
    commit,
    paths.map((p) => basename(p)),
  );
}

function main(states: string[]): void {
  if (!states.length) throw new Error('Name the states to draw, as in vis-default.');
  // A name no test draws must not publish a picture an earlier run left.
  const shots = shotNames(states, DESKTOP_AND_PHONE).map((f) => join(SHOTS_DIR, f));
  for (const shot of shots) rmSync(shot, { force: true });
  const run = spawnSync(
    'node',
    [
      'scripts/suite-lock.ts',
      'playwright',
      'test',
      '-c',
      'test/layout',
      ...DESKTOP_AND_PHONE.flatMap((screen) => ['--project', screen]),
      '-g',
      grepFor(states),
    ],
    { stdio: 'inherit', env: { ...process.env, SCREENSHOTS: '1' } },
  );
  if (run.status !== 0) throw new Error('The drawing run failed, so nothing was published.');
  const missing = shots.filter((shot) => !existsSync(shot));
  if (missing.length)
    throw new Error(`No test drew ${missing.map((f) => basename(f)).join(', ')}.`);

  const cards = changedFiles().filter(
    (p) => /^public\/[^/]*og-image\.jpg$/.test(p) && existsSync(p),
  );
  console.log(publish([...shots, ...cards], `Screenshots: ${[...states, ...cards].join(', ')}`));
  if (cards.length)
    console.log(`\nThis branch changes the share cards: commit ${cards.join(' and ')}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
