/** Where the story is: its stop, counted from one, and how many it has. */
export interface StoryPlace {
  number: number;
  total: number;
}

const item = (action: string, label: string, detail = ''): string =>
  `<button type="button" class="menu-item" data-action="${action}">${label}` +
  (detail ? ` <span class="menu-detail">${detail}</span>` : '') +
  `</button>`;

/** The menu's items. Each carries the action it takes; the panel's click handler reads it. */
export function menuHtml(place: StoryPlace): string {
  return [
    item('story', 'Continue the story', `${place.number} of ${place.total}`),
    item('overlay', 'Overlays'),
    item('stories', 'Stories'),
    item('about', 'About &amp; settings'),
  ].join('');
}
