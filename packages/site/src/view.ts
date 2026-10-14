// What every text's site shares: where it lives, and how a view is titled.

import type { UrlState } from '@torahmap/link';

export const ORIGIN = 'https://torahmap.org';
/** Where the Tanakh's map is served, under the site's address. */
export const TANAKH_PATH = '/';
export const SEPARATOR = ' · ';

/** A view's title on any text's site: what it pins, then its search, then the site's name. */
export function viewTitle(siteName: string, pinned: string | null, state: UrlState): string {
  const search = state.searchParams?.search;
  return [pinned, search && `Search: ${search}`, siteName].filter(Boolean).join(SEPARATOR);
}
