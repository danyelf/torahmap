// Draws the named layout states on the real map, on a desktop and a phone, redraws the share
// cards, and publishes the pictures for the pull request, printing their Markdown. A share card
// is published only when its picture changed.
//
//   npm run shots -- explore-search act-search
//
// The states are named in test/layout/app.ts. Every state on every screen, with the contact
// sheet at layout-report/index.html, is npm run test:layout:shots.

import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DESKTOP_AND_PHONE } from '../test/browser/screens.ts';
import { publish, shotsOf } from './publish-shots.ts';

const SHOTS_DIR = 'layout-report/shots';

/** Playwright's --grep for the tests that draw `states`, and the share cards. */
export function grepFor(states: string[]): string {
  const names = states.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return `(^| )(${names})$|shareCards\\.spec\\.ts`;
}

function main(states: string[]): void {
  if (!states.length) throw new Error('Name the states to draw, as in vis-default.');
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

  const shots = shotsOf(states, DESKTOP_AND_PHONE, readdirSync(SHOTS_DIR));
  const cards = execFileSync('git', ['status', '--porcelain', '--', 'public/*og-image.jpg'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  console.log(
    publish(
      [...shots.map((f) => join(SHOTS_DIR, f)), ...cards],
      `Screenshots: ${[...states, ...cards].join(', ')}`,
    ),
  );
  if (cards.length) console.log(`\nThe share cards changed: commit ${cards.join(' and ')}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
