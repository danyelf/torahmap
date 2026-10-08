import type { UrlState } from '@torahmap/link';
import type { Site } from './app/text.ts';

/** The tab's title for a view: the site's title for it, then `branch` unless it is null. */
export function tabTitle(site: Site, state: UrlState, branch: string | null): string {
  const title = site.title(state);
  return branch === null ? title : `${title} [${branch}]`;
}
