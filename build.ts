// What a build of the site holds: the live site's, built from main, has the Tanakh's page and the
// pages whose flag is on; every other branch's preview has every page.

import { EUAIACT_DATA_DIR } from '@torahmap/euaiact/data.ts';
import { IEEEVIS_DATA_DIR } from '@torahmap/ieeevis/data.ts';
import { TALMUD_DATA_DIR } from '@torahmap/talmud/data.ts';

export type BuiltPage = 'main' | 'talmud' | 'euaiact' | 'ieeevis';

/** A page beside the Tanakh's: its data folder under public/data/, and whether the live site has it. */
export interface ExtraPage {
  page: Exclude<BuiltPage, 'main'>;
  dataDir: string;
  live: boolean;
}

export const EXTRA_PAGES: readonly ExtraPage[] = [
  { page: 'talmud', dataDir: TALMUD_DATA_DIR, live: true },
  { page: 'euaiact', dataDir: EUAIACT_DATA_DIR, live: true },
  { page: 'ieeevis', dataDir: IEEEVIS_DATA_DIR, live: false },
];

export function isLiveBuild(command: 'build' | 'serve', branch: string): boolean {
  return command === 'build' && branch === 'main';
}

export function builtPages(live: boolean, pages: readonly ExtraPage[] = EXTRA_PAGES): BuiltPage[] {
  return ['main', ...pages.filter((p) => !live || p.live).map((p) => p.page)];
}

/** What Cloudflare does not publish of the build: its own list, and the data of pages it lacks. */
export function unpublished(live: boolean, pages: readonly ExtraPage[] = EXTRA_PAGES): string[] {
  const absent = live ? pages.filter((p) => !p.live) : [];
  return ['.assetsignore', ...absent.map((p) => `data/${p.dataDir}`)];
}
