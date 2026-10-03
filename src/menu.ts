import { escapeHtml } from './utils/html.ts';
import { SITE_NAME } from '@torahmap/site';
import { PANELS, type Panel } from './frame.ts';

/** Where the story is: its stop, counted from one, and how many it has. */
export interface StoryPlace {
  number: number;
  total: number;
}

/** The menu item that returns to the story being read. */
export const CONTINUE_STORY = 'story';

/** The menu item that shares the current view or story stop. */
export const SHARE = 'share';

// The menu offers a choice of overlays, where the open panel shows one; the
// rest match PANEL_TITLES.
const MENU_LABELS: Record<Panel, string> = {
  start: 'Start here',
  search: 'Search',
  overlay: 'Overlays',
  stories: 'Stories',
  about: 'About &amp; settings',
};

const item = (action: string, label: string, detail = ''): string =>
  `<button type="button" class="menu-item" data-action="${action}">${label}` +
  (detail ? ` <span class="menu-detail">${detail}</span>` : '') +
  `</button>`;

/** The menu: the site's name, then its items. Each item carries the action it takes; the click handler reads it. */
export function menuHtml(place: StoryPlace & { title: string }): string {
  return [
    `<h2 class="menu-title">${SITE_NAME}</h2>`,
    item(CONTINUE_STORY, `Continue ${escapeHtml(place.title)}`, `${place.number}/${place.total}`),
    item(SHARE, 'Share'),
    '<div class="menu-divider" role="separator"></div>',
    ...PANELS.map((panel) => item(panel, MENU_LABELS[panel])),
  ].join('');
}
