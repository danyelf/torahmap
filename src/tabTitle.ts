import type { UrlState } from '@torahmap/link';
import type { Site } from './app/text.ts';

/** The tab's title for a view: its description's title, then `branch` unless it is null. */
export function tabTitle(site: Site, state: UrlState, branch: string | null): string {
  const { title } = site.describe(state);
  return branch === null ? title : `${title} [${branch}]`;
}
