import { escapeHtml } from './utils/html.ts';

/** Where the story is: its stop, counted from one, and how many it has. */
export interface StoryPlace {
  number: number;
  total: number;
}

const item = (action: string, label: string, detail = ''): string =>
  `<button type="button" class="menu-item" data-action="${action}">${label}` +
  (detail ? ` <span class="menu-detail">${detail}</span>` : '') +
  `</button>`;

/** The menu: the site's name, then its items. Each item carries the action it takes; the click handler reads it. */
export function menuHtml(place: StoryPlace & { title: string }): string {
  return [
    '<h2 class="menu-title">Torahmap</h2>',
    item('story', `Continue ${escapeHtml(place.title)}`, `${place.number}/${place.total}`),
    item('overlay', 'Overlays'),
    item('stories', 'Stories'),
    item('about', 'About &amp; settings'),
  ].join('');
}
