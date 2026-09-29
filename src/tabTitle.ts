import type { UrlState } from '@torahmap/link';
import { describeLink } from '@torahmap/site';

/** The tab's title for a view: its description's title, and the branch off the live site. */
export function tabTitle(state: UrlState, branch: string): string {
  const { title } = describeLink(state);
  return branch === 'main' ? title : `${title} [${branch}]`;
}
