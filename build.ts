// What a build of the site holds: the live site's, built from main, has the Tanakh's page alone;
// every other branch's preview has the Talmud's too.

import { TALMUD_DATA_DIR } from '@torahmap/talmud/data.ts';

export type BuiltPage = 'main' | 'talmud';

export function isLiveBuild(command: 'build' | 'serve', branch: string): boolean {
  return command === 'build' && branch === 'main';
}

export function builtPages(live: boolean): BuiltPage[] {
  return live ? ['main'] : ['main', 'talmud'];
}

/** What Cloudflare does not publish of the build: its own list, and the data of pages it lacks. */
export function unpublished(live: boolean): string[] {
  return ['.assetsignore', ...(live ? [`data/${TALMUD_DATA_DIR}`] : [])];
}
