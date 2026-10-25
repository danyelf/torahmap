// Which text's page each address serves, for the Vite config. Imports only the texts' copy.

import { TANAKH_PATH } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';
import { TANAKH_PAGE } from '@torahmap/tanakh/page.ts';
import { TALMUD_PAGE, TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { EUAIACT_PAGE, EUAIACT_PATH } from '@torahmap/euaiact/page.ts';
import { COLORTESTBED_PAGE, COLORTESTBED_PATH } from '@torahmap/colortestbed/page.ts';

export interface Page {
  path: string;
  copy: PageCopy;
  entry: string;
}

/** The Tanakh's at the root; the Talmud's at /talmud/; the AI Act's at /euaiact/; the colour testbed's at /colors/. */
export const PAGES: readonly Page[] = [
  { path: TANAKH_PATH, copy: TANAKH_PAGE, entry: '/apps/tanakh/src/main.ts' },
  { path: TALMUD_PATH, copy: TALMUD_PAGE, entry: '/apps/talmud/src/main.ts' },
  { path: EUAIACT_PATH, copy: EUAIACT_PAGE, entry: '/apps/euaiact/src/main.ts' },
  { path: COLORTESTBED_PATH, copy: COLORTESTBED_PAGE, entry: '/apps/colortestbed/src/main.ts' },
];

/** The page an address asks for, with or without its query and index.html; the root's for any other. */
export function pageAt(url: string): Page {
  const path = url.split('?')[0].replace(/index\.html$/, '');
  return PAGES.find((page) => page.path === path) ?? PAGES[0];
}
