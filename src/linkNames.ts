// The tab's title follows the view: how @torahmap/link's describeLink names
// the app's own overlays and stories.

import { describeLink, type LinkNames, type UrlState } from '@torahmap/link';
import { overlayName } from '@torahmap/overlay-catalog';
import { storyTitle, stopOpening } from '@torahmap/stories';

/** The names the page describes links with. */
export const LINK_NAMES: LinkNames = { overlayName, storyTitle, stopOpening };

/** The tab's title for a view: its description's title, and the branch off the live site. */
export function tabTitle(state: UrlState, branch: string): string {
  const { title } = describeLink(state, LINK_NAMES);
  return branch === 'main' ? title : `${title} [${branch}]`;
}
