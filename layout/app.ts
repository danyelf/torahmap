import { expect, type Page } from '@playwright/test';
import type { Chrome } from './check.ts';

export interface State {
  name: string;
  link: string;
  then?: (page: Page) => Promise<void>;
  /** Elements that must show in full, so a selector that stops matching fails rather than measuring nothing. */
  shown?: string[];
}

// The frame (index.html, src/styles/frame.css). The menu and the ☰ are left
// out of `fixed`: on a desktop both sit over the column by design. Links in the
// story's prose and in the credits are running text, which touch-size rules
// exempt.
export const CHROME: Chrome = {
  fixed: '#panel, #map-legend, #zoom-controls, #verse-popup.visible',
  map: '#canvas',
  panel: '#panel',
  interactive:
    '#panel button, #panel select, #panel input, ' +
    '#panel a:not(.story-stop a):not(.credits-list a):not(.byline a), ' +
    '#menu-toggle, #menu button, #map-legend button, ' +
    '#verse-popup button, #verse-popup a, #zoom-controls button',
  text:
    '.map-legend-summary, .menu-title, .menu-item, .column-title, .panel-title, #panel label, ' +
    '.story-card-place, #verse-popup .ref-text',
};

/** Opens a menu item through the ☰. */
async function viaMenu(page: Page, action: string): Promise<void> {
  await page.locator('#menu-toggle').click();
  await page.locator(`.menu-item[data-action="${action}"]:visible`).click();
}

const stop = (id: string): string => `.story-stop[data-stop-id="${id}"] .story-text`;

const ABRAHAM = encodeURIComponent('אברם,אברהם');
const BOTH_ROWS = ['.map-legend-row[data-panel="search"]', '.map-legend-row[data-panel="overlay"]'];

export const STATES: State[] = [
  { name: 'story-opening', link: 'story=tour&stop=intro', shown: [stop('intro')] },
  {
    name: 'story-stop-with-verse',
    link: 'story=tour&stop=abraham_call',
    shown: ['#map-legend', stop('abraham_call')],
  },
  {
    name: 'story-menu-down',
    link: 'story=tour&stop=abraham_call',
    then: (page) => page.locator('#menu-toggle').click(),
    shown: ['#menu', '.menu-item[data-action="share"]', '#map-legend'],
  },
  { name: 'explore-link', link: 'overlay=commentary', shown: ['#map-legend'] },
  {
    name: 'story-closed',
    link: 'story=tour&stop=intro',
    then: (page) => page.keyboard.press('Escape'),
    shown: ['#menu-toggle'],
  },
  {
    name: 'explore-panel-closed',
    link: 'overlay=commentary',
    then: (page) => page.keyboard.press('Escape'),
    shown: ['#menu-toggle', '#map-legend'],
  },
  {
    name: 'explore-menu-down',
    link: 'overlay=commentary',
    then: (page) => page.locator('#menu-toggle').click(),
    shown: ['#menu', '.menu-item[data-action="share"]', '#map-legend'],
  },
  {
    name: 'explore-link-copied',
    link: 'overlay=commentary',
    then: async (page) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      // Freezes the menu's 1500ms auto-close so it can never fire mid-screenshot.
      await page.clock.install();
      await page.clock.pauseAt(Date.now());
      await page.locator('#menu-toggle').click();
      await page.locator('.menu-item[data-action="share"]:visible').click();
      await page
        .locator('.menu-item[data-action="share"]:visible', { hasText: 'Link copied' })
        .waitFor();
    },
    shown: ['#menu', '.menu-item[data-action="share"]'],
  },
  {
    name: 'explore-overlay-open',
    link: 'overlay=commentary',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select', '#map-legend'],
  },
  {
    name: 'explore-haftarah',
    link: 'overlay=haftarah',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'explore-trop',
    link: 'overlay=trop&trop=tipcha',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'explore-search',
    link: `search=${encodeURIComponent('אברהם')}`,
    then: (page) => viaMenu(page, 'search'),
    shown: ['#search-input', '#search-clear-all'],
  },
  {
    name: 'explore-search-and-overlay',
    link: `search=${ABRAHAM}&overlay=haftarah`,
    shown: BOTH_ROWS,
  },
  {
    name: 'explore-search-overlay-switched',
    link: `search=${ABRAHAM}&overlay=haftarah`,
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-select').selectOption('commentary');
    },
    shown: ['#overlay-select', ...BOTH_ROWS],
  },
  {
    name: 'explore-search-and-overlay-pinned',
    link: `search=${ABRAHAM}&overlay=commentary&verse=Genesis.17.5`,
    shown: ['#verse-popup', ...BOTH_ROWS],
  },
  {
    name: 'explore-verse-pinned',
    link: 'overlay=commentary&verse=Genesis.12.1',
    shown: ['#verse-popup', '#map-legend'],
  },
  {
    // A word read as two, so the menu offers two meanings and is at its tallest.
    // Which word a click is on arrives after the map does; clicked before it,
    // the menu offers only the exact search, so it is clicked until it is not.
    name: 'explore-word-menu',
    link: 'overlay=commentary&verse=Genesis.30.11',
    then: async (page) => {
      const word = page.locator('#verse-popup .verse-word', { hasText: '(בגד)' });
      await expect(async () => {
        // A press outside the menu closes it; the click opens it again.
        await word.click();
        // Both readings and the exact search.
        await expect(page.locator('.word-menu-choice')).toHaveCount(3, { timeout: 500 });
      }).toPass();
    },
    shown: ['.word-menu'],
  },
  {
    name: 'stories-panel',
    link: 'overlay=commentary',
    then: (page) => viaMenu(page, 'stories'),
    shown: ['.story-card[data-story="tour"]'],
  },
  {
    // On a phone the sheet holds about one card; the rest scroll into it.
    name: 'stories-panel-scrolled',
    link: 'overlay=commentary',
    then: async (page) => {
      await viaMenu(page, 'stories');
      await page.locator('.story-card[data-story="sample"]').scrollIntoViewIfNeeded();
    },
    shown: ['.story-card[data-story="sample"]'],
  },
  { name: 'story-sample', link: 'story=sample&stop=book', shown: [stop('book')] },
  {
    name: 'about-panel',
    link: 'overlay=commentary',
    then: (page) => viaMenu(page, 'about'),
    shown: ['#hebrew-toggle'],
  },
];
