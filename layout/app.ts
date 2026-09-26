import type { Page } from '@playwright/test';
import type { Chrome } from './check.ts';

export interface State {
  name: string;
  hash: string;
  then?: (page: Page) => Promise<void>;
  /** Elements that must show in full, so a selector that stops matching fails rather than measuring nothing. */
  shown?: string[];
}

// The frame (index.html, src/styles/frame.css). The menu is left out of
// `fixed`: on a desktop it drops over the story's column by design. Links in
// the story's prose and in the credits are running text, which touch-size
// rules exempt.
export const CHROME: Chrome = {
  fixed: '#panel, #rail, #top-bar, #map-legend, #zoom-controls, #verse-popup.visible',
  map: '#canvas',
  panel: '#panel, #rail',
  interactive:
    '#panel button, #panel select, #panel input, ' +
    '#panel a:not(.story-stop a):not(.credits-list a):not(.byline a), ' +
    '#rail button, #top-bar button, #menu button, #map-legend button, ' +
    '#verse-popup button, #verse-popup a, #zoom-controls button',
  text:
    '.map-legend-summary, .menu-title, .menu-item, .rail-label, .panel-title, #panel label, ' +
    '.story-card-place, #verse-popup .ref-text',
};

/** Opens a menu item by whichever ☰ is showing: the story's, the rail's, or the phone's. */
async function viaMenu(page: Page, action: string): Promise<void> {
  await page.locator('.menu-button:visible').first().click();
  await page.locator(`.menu-item[data-action="${action}"]:visible`).click();
}

const stop = (id: string): string => `.story-stop[data-stop-id="${id}"] .story-text`;

export const STATES: State[] = [
  { name: 'story-opening', hash: 'story=intro', shown: [stop('intro')] },
  {
    name: 'story-stop-with-verse',
    hash: 'story=abraham_call',
    shown: ['#map-legend', stop('abraham_call')],
  },
  {
    name: 'story-menu-down',
    hash: 'story=abraham_call',
    then: (page) => page.locator('.menu-button:visible').first().click(),
    shown: ['#menu', '#map-legend'],
  },
  { name: 'explore-link', hash: 'overlay=commentary', shown: ['#map-legend'] },
  {
    name: 'explore-overlay-open',
    hash: 'overlay=commentary',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select', '#map-legend'],
  },
  {
    name: 'explore-search',
    hash: `overlay=search&q=${encodeURIComponent('אברהם')}`,
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select', '#search-input'],
  },
  {
    name: 'explore-verse-pinned',
    hash: 'overlay=commentary&verse=Genesis.12.1',
    shown: ['#verse-popup', '#map-legend'],
  },
  {
    name: 'stories-panel',
    hash: 'overlay=commentary',
    then: (page) => viaMenu(page, 'stories'),
    shown: ['.story-card'],
  },
  {
    name: 'about-panel',
    hash: 'overlay=commentary',
    then: (page) => viaMenu(page, 'about'),
    shown: ['#hebrew-toggle'],
  },
];
