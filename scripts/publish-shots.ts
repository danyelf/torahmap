// Publishes pictures for a pull request to embed, and gives their Markdown, for scripts/shots.ts.
// Main does not track the screenshots: two branches that redraw the same picture cannot be merged.
//
// The pictures go to `refs/shots/<branch>`, a commit holding only them. A clone fetches branches
// and tags only, so they cost no one a download, and the ref keeps every commit the links name.
// Publishing again adds a commit on top; earlier links still work. To look through them later:
//
//   git fetch origin 'refs/shots/*:refs/shots/*'
//   git archive refs/shots/<branch> | tar -x -C <dir>

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

/** The screenshot of each state on each screen, `<state>--<screen>.png`, all of which must be in `files`. */
export function shotsOf(states: string[], screens: string[], files: string[]): string[] {
  const wanted = states.flatMap((s) => screens.map((screen) => `${s}--${screen}.png`));
  const missing = wanted.filter((f) => !files.includes(f));
  if (missing.length) throw new Error(`No screenshots: ${missing.join(', ')}`);
  return wanted.sort();
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
        `![${f.replace(/\.\w+$/, '')}](https://github.com/${repo}/blob/${commit}/${f}?raw=true)`,
    )
    .join('\n');
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** Publishes `paths`, each under its own name, with `message`; returns their Markdown. */
export function publish(paths: string[], message: string): string {
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
