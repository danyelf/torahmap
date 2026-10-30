// Publishes the layout screenshots of the named states for a pull request to embed, and prints
// their Markdown. Main does not track the screenshots: two branches that redraw the same picture
// cannot be merged.
//
//   npm run shots:publish -- vis-default explore-search
//
// The pictures go to `refs/shots/<branch>`, a commit holding only them. A clone fetches branches
// and tags only, so they cost no one a download, and the ref keeps every commit the links name.
// Publishing again adds a commit on top; earlier links still work. To look through them later:
//
//   git fetch origin 'refs/shots/*:refs/shots/*'
//   git archive refs/shots/<branch> | tar -x -C <dir>

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHOTS_DIR = 'layout-report/shots';

/** The screenshots of each state, at every size it was drawn: `<state>--<size>.png`. */
export function shotsOf(states: string[], files: string[]): string[] {
  const missing = states.filter((s) => !files.some((f) => f.startsWith(`${s}--`)));
  if (missing.length) throw new Error(`No screenshots for: ${missing.join(', ')}`);
  return files.filter((f) => states.some((s) => f.startsWith(`${s}--`))).sort();
}

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
        `![${f.replace(/\.png$/, '')}](https://github.com/${repo}/blob/${commit}/${f}?raw=true)`,
    )
    .join('\n');
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function publish(states: string[]): void {
  if (!states.length) throw new Error('Name the states to publish, as in vis-default.');
  const files = shotsOf(states, readdirSync(SHOTS_DIR));
  const branch = git('branch', '--show-current');
  if (!branch || branch === 'main') throw new Error('Publish from the pull request’s branch.');
  const ref = `refs/shots/${branch}`;

  const tree = execFileSync('git', ['mktree'], {
    encoding: 'utf8',
    input: files
      .map((f) => `100644 blob ${git('hash-object', '-w', join(SHOTS_DIR, f))}\t${f}\n`)
      .join(''),
  }).trim();
  const previous = git('ls-remote', 'origin', ref).split('\t')[0];
  if (previous) git('fetch', '--quiet', 'origin', ref);
  const parent = previous ? ['-p', previous] : [];
  const commit = git('commit-tree', tree, ...parent, '-m', `Screenshots: ${states.join(', ')}`);
  git('push', '--quiet', 'origin', `${commit}:${ref}`);

  console.log(markdown(repoOf(git('remote', 'get-url', 'origin')), commit, files));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    publish(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
