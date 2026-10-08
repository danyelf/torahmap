// Which text's page each address serves, for the Vite config. Imports only the texts' copy.

import type { PageCopy } from './app/page.ts';
import { TANAKH_PAGE } from './tanakh/page.ts';
import { TALMUD_PAGE } from './talmud/page.ts';

export interface Page {
  path: string;
  copy: PageCopy;
  entry: string;
}

export const TALMUD_PATH = '/talmud/';

/** The Tanakh's at the root, built and deployed; the Talmud's on the dev server alone. */
export const PAGES: readonly Page[] = [
  { path: '/', copy: TANAKH_PAGE, entry: '/src/main-tanakh.ts' },
  { path: TALMUD_PATH, copy: TALMUD_PAGE, entry: '/src/main-talmud.ts' },
];

/** The page an address asks for, with or without its query and index.html; the root's for any other. */
export function pageAt(url: string): Page {
  const path = url.split('?')[0].replace(/index\.html$/, '');
  return PAGES.find((page) => page.path === path) ?? PAGES[0];
}
