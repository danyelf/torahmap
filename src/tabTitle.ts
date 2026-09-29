import type { UrlState } from '@torahmap/link';
import { describeLink } from '@torahmap/site';

/** The tab's title for a view: its description's title, then `branch` unless it is null. */
export function tabTitle(state: UrlState, branch: string | null): string {
  const { title } = describeLink(state);
  return branch === null ? title : `${title} [${branch}]`;
}
