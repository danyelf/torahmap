import { expect, type Page } from '@playwright/test';
import type { Chrome } from './check.ts';
import { viaMenu } from '../browser/page.ts';
import { SEARCHED } from './visTexts.ts';
import { GO_TO_BOX_ID } from '../../packages/shell/src/goToBox.ts';

const GO_TO_BOX = `#${GO_TO_BOX_ID}`;

export interface State {
  name: string;
  link: string;
  then?: (page: Page) => Promise<void>;
  /** Opens as a returning reader, so an empty link skips the story. */
  returning?: boolean;
  /** Elements that must show in full, so a selector that stops matching fails rather than measuring nothing. */
  shown?: string[];
}

// The frame (index.html, packages/shell/src/styles/frame.css). The menu and the ☰ are left
// out of `fixed`: on a desktop both sit over the column by design. Links in the
// story's prose and in the credits are running text, which touch-size rules
// exempt.
export const CHROME: Chrome = {
  fixed: '#panel, #map-legend, #zoom-controls, #popup.visible',
  map: '#canvas',
  panel: '#panel',
  interactive:
    '#panel button:not(.parallel-verses button), #panel select, #panel input, ' +
    '#panel a:not(.story-stop a):not(.credits-list a):not(.byline a), ' +
    '#menu-toggle, #menu button, #map-legend button, ' +
    '#popup button, #popup a, #zoom-controls button',
  text:
    '.map-legend-summary, .menu-title, .menu-item, .column-title, .panel-title, #panel label, ' +
    '.story-card-place, #popup .ref-text, .goto-ref, .goto-none, .goto-completion, .goto-example',
};

/** Opens Go to through the ☰, types `typed` there, and takes the offer with Enter if `take`. */
export async function goTo(page: Page, typed = '', take = false): Promise<void> {
  await viaMenu(page, 'goto');
  if (!typed) return;
  await page.locator(GO_TO_BOX).fill(typed);
  // An offer grows when the text it quotes arrives.
  await page.locator('.goto-quote:not(:empty), .goto-none, .goto-completion').first().waitFor();
  await sheetMeasured(page);
  if (take) await page.locator(GO_TO_BOX).press('Enter');
}

/** Waits for a phone's map to make room for the sheet, which main.ts measures after it changes height. */
async function sheetMeasured(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        if (style.getPropertyValue('--layout').trim() !== 'phone') return true;
        const sheet = document.getElementById('panel')!;
        return style.getPropertyValue('--sheet-shown') === `${sheet.offsetHeight}px`;
      }),
    )
    .toBe(true);
}

const stop = (id: string): string => `.story-stop[data-stop-id="${id}"] .story-text`;

export const ABRAHAM = encodeURIComponent('אברם,אברהם');

const BOTH_ROWS = ['search', 'overlay'].flatMap((panel) => [
  `.map-legend-row[data-panel="${panel}"]`,
  `.map-legend-row[data-panel="${panel}"] .map-legend-close`,
]);

export const STATES: State[] = [
  { name: 'story-opening', link: 'story=tour&stop=intro', shown: [stop('intro')] },
  {
    name: 'story-stop-with-verse',
    link: 'story=tour&stop=abraham_call',
    shown: ['#map-legend', stop('abraham_call')],
  },
  {
    name: 'goto-panel',
    link: '',
    returning: true,
    then: (page) => goTo(page),
    shown: [GO_TO_BOX, '.goto-example'],
  },
  {
    name: 'goto-completing',
    link: '',
    returning: true,
    then: (page) => goTo(page, 'שמ'),
    shown: [GO_TO_BOX, '.goto-completion'],
  },
  {
    name: 'goto-completing-word',
    link: '',
    returning: true,
    then: (page) => goTo(page, 'Sam'),
    shown: [GO_TO_BOX, '.goto-completion'],
  },
  {
    name: 'goto-offer',
    link: '',
    returning: true,
    then: (page) => goTo(page, '1 Sam 3:17'),
    shown: [GO_TO_BOX, '.goto-offer'],
  },
  {
    name: 'goto-hebrew-offer',
    link: '',
    returning: true,
    then: (page) => goTo(page, 'שמואל א ג:יז'),
    shown: [GO_TO_BOX, '.goto-offer'],
  },
  {
    name: 'goto-not-found',
    link: '',
    returning: true,
    then: (page) => goTo(page, 'Genesis 51'),
    shown: [GO_TO_BOX, '.goto-none'],
  },
  {
    name: 'goto-chapter-taken',
    link: '',
    returning: true,
    then: (page) => goTo(page, 'Isaiah 40', true),
    shown: ['#popup.visible'],
  },
  {
    name: 'story-menu-down',
    link: 'story=tour&stop=abraham_call',
    then: (page) => page.locator('#menu-toggle').click(),
    shown: ['#menu', '.menu-item[data-action="share"]', '#map-legend'],
  },
  { name: 'explore-link', link: 'overlay=commentary', shown: ['#map-legend'] },
  {
    name: 'overlay-none',
    link: '',
    returning: true,
    shown: ['#overlay-select', '[data-start="search"]'],
  },
  {
    // A link that only moves the camera shows nothing either.
    name: 'overlay-none-camera-link',
    link: 'zoom=0.32&x=1693.1&y=838.7',
    shown: ['#overlay-select', '[data-start="search"]'],
  },
  {
    name: 'overlay-none-trop',
    link: '',
    returning: true,
    then: async (page) => {
      await page.locator('[data-start="overlay"][data-id="trop"]').click();
      await expect(page).toHaveURL(/overlay=trop/);
      // Left where it clicked, the pointer is over the trop chart that replaced
      // the button, and the map previews the mark under it.
      await page.locator('#overlay-description').hover();
    },
    shown: ['#overlay-select', '#map-legend'],
  },
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
    name: 'explore-trop-legend',
    link: 'overlay=trop&trop=shalshelet',
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-legend').scrollIntoViewIfNeeded();
    },
    shown: ['#overlay-legend'],
  },
  {
    name: 'explore-trop',
    link: 'overlay=trop&trop=tipcha',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'explore-trop-poetic',
    // Centered on Psalms, so the poetic mark lights verses in view.
    link: 'overlay=trop&trop=tarcha&tab=poetic&zoom=0.8&x=2900&y=1420',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'explore-text-analytics',
    link: 'overlay=text-analytics&analysis=repetitive-wording',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'explore-text-analytics-pinned',
    link: 'overlay=text-analytics&analysis=repetitive-wording&verse=Genesis.5.25',
    shown: ['#popup', '#map-legend'],
  },
  {
    // Numbers 7 repeats one offering every six verses; the pointer is on verse 37.
    name: 'explore-text-analytics-hover',
    link: 'overlay=text-analytics&analysis=repetitive-wording&zoom=1.4&x=2283&y=67',
    then: async (page) => {
      const canvas = (await page.locator('#canvas').boundingBox())!;
      await page.mouse.move(canvas.x + canvas.width / 2 - 134, canvas.y + canvas.height / 2);
    },
    shown: ['#map-legend'],
  },
  {
    // Numbers 1:29 echoes only 2:6; the pointer is on 1:29.
    name: 'explore-text-analytics-hover-one-echo',
    link: 'overlay=text-analytics&analysis=repetitive-wording&zoom=1.4&x=2304&y=11',
    then: async (page) => {
      const canvas = (await page.locator('#canvas').boundingBox())!;
      await page.mouse.move(canvas.x + canvas.width / 2 - 97, canvas.y + canvas.height / 2 - 11);
    },
    shown: ['#map-legend'],
  },
  {
    // Zoomed out, a pinned verse and its echoes still show.
    name: 'explore-text-analytics-echoes-zoomed-out',
    link: 'overlay=text-analytics&analysis=repetitive-wording&zoom=0.3&x=2304&y=11&verse=Numbers.1.29',
    shown: ['#popup', '#map-legend'],
  },
  {
    // A parallel verse in the panel travels to it and pins it, its own parallels next.
    name: 'explore-text-analytics-parallel-link',
    link: 'overlay=text-analytics&analysis=repetitive-wording&zoom=0.8&x=2304&y=11&verse=Numbers.1.29',
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('.parallel-verses button').first().click();
      await expect(page.locator('#popup')).toContainText('Numbers 2:6');
    },
    shown: ['#popup', '#map-legend'],
  },
  {
    // Pinned, a verse keeps its echoes lit with the pointer elsewhere.
    name: 'explore-text-analytics-echoes-pinned',
    link: 'overlay=text-analytics&analysis=repetitive-wording&zoom=1.4&x=2283&y=67&verse=Numbers.7.37',
    shown: ['#popup', '#map-legend'],
  },
  {
    name: 'explore-text-analytics-echoes-view',
    link: 'overlay=text-analytics&analysis=echoes',
    shown: ['#map-legend'],
  },
  {
    // The whole Tanakh at once: the spectrum reads as sections of colour.
    name: 'explore-text-analytics-echoes-view-zoomed-out',
    link: 'overlay=text-analytics&analysis=echoes&zoom=0.1',
    shown: ['#map-legend'],
  },
  {
    // The slider at eight words: only the long shared passages remain.
    name: 'explore-text-analytics-echoes-view-long-phrase',
    link: 'overlay=text-analytics&analysis=echoes&words=8&zoom=0.1',
    shown: ['#map-legend'],
  },
  {
    // 2 Kings 22:1 is retold in 1 Kings 15:10 and 2 Chronicles 34:1.
    name: 'explore-text-analytics-echoes-view-pinned',
    link: 'overlay=text-analytics&analysis=echoes&zoom=0.1&verse=II.Kings.22.1',
    shown: ['#popup', '#map-legend'],
  },
  {
    // Kings, where the wheel's hue changes fast from verse to verse: nearby echoes fade to grey.
    name: 'explore-text-analytics-echoes-kings-pinned',
    link: 'overlay=text-analytics&analysis=echoes&zoom=0.6&verse=I.Kings.16.27',
    shown: ['#popup', '#map-legend'],
  },
  {
    // Pinned, a verse keeps its reading and haftarah lit.
    name: 'explore-haftarah-pinned',
    link: 'overlay=haftarah&verse=Genesis.1.1',
    shown: ['#popup', '#map-legend'],
  },
  // A rare mark lights a few dozen verses, which must show with the whole map in view.
  {
    name: 'explore-trop-rare',
    link: 'overlay=trop&trop=shalshelet&zoom=0.1',
    shown: ['#map-legend'],
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
    shown: ['#popup', ...BOTH_ROWS],
  },
  {
    name: 'explore-verse-pinned',
    link: 'overlay=commentary&verse=Genesis.12.1',
    shown: ['#popup', '#map-legend'],
  },
  {
    // A word read as two, so the menu offers two meanings and is at its tallest.
    // Which word a click is on arrives after the map does; clicked before it,
    // the menu offers only the exact search, so it is clicked until it is not.
    name: 'explore-word-menu',
    link: 'overlay=commentary&verse=Genesis.30.11',
    then: async (page) => {
      const word = page.locator('#popup .popup-word', { hasText: 'בגד' });
      await expect(async () => {
        // A press outside the menu closes it; the click opens it again.
        await word.click();
        await expect(page.locator('.word-menu-choice').nth(1)).toBeVisible({ timeout: 500 });
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
    shown: ['#language-choice'],
  },
  ...Object.entries({ both: 'both', english: 'en' }).map(([name, choice]) => ({
    name: `title-${name}`,
    link: 'zoom=0.3&x=900&y=500',
    returning: true,
    then: async (page: Page) => {
      await viaMenu(page, 'about');
      await page.locator(`#language-choice [data-languages="${choice}"]`).click();
      await page.keyboard.press('Escape');
    },
    shown: ['#map-title'],
  })),
  ...Object.entries({ hebrew: 'he', both: 'both', english: 'en' }).map(([name, choice]) => ({
    name: `languages-${name}`,
    link: 'overlay=commentary&verse=Genesis.12.1',
    then: async (page: Page) => {
      await viaMenu(page, 'about');
      await page.locator(`#language-choice [data-languages="${choice}"]`).click();
    },
    shown: ['#language-choice', '#popup'],
  })),
];

/** The AI Act's page, at /euaiact/ (euaiact.spec.ts). */
export const ACT_STATES: State[] = [
  { name: 'act-opening', link: '' },
  { name: 'act-article-numbers', link: 'zoom=2&x=300&y=240' },
  {
    name: 'act-amendment-legend',
    link: 'overlay=amendment',
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-legend').scrollIntoViewIfNeeded();
    },
    shown: ['#overlay-legend'],
  },
  {
    name: 'act-references-legend',
    link: 'overlay=references&article=6',
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-legend').scrollIntoViewIfNeeded();
    },
    shown: ['#overlay-legend'],
  },
  { name: 'act-amendment', link: 'overlay=amendment&zoom=0.6', shown: ['#map-legend'] },
  {
    name: 'act-references',
    link: 'overlay=references&article=6&zoom=0.6',
    shown: ['#map-legend'],
  },
  { name: 'act-recital-pinned', link: 'at=Recital.12', shown: ['#popup.visible'] },
  { name: 'act-search', link: 'search=deployer&zoom=0.6', shown: ['#map-legend'] },
  {
    name: 'act-search-panel',
    link: `search=${encodeURIComponent('deployer,biometric,risk')}&mode=w,w,s&zoom=0.6`,
    then: (page) => viaMenu(page, 'search'),
    shown: ['#search-input', '#search-clear-all'],
  },
  {
    name: 'act-goto-panel',
    link: 'zoom=0.6',
    then: (page) => goTo(page),
    shown: [GO_TO_BOX, '.goto-example'],
  },
  {
    name: 'act-goto-completing',
    link: 'zoom=0.6',
    then: (page) => goTo(page, 'a'),
    shown: [GO_TO_BOX, '.goto-completion'],
  },
  {
    name: 'act-goto-article',
    link: 'zoom=0.6',
    then: (page) => goTo(page, 'Article'),
    shown: [GO_TO_BOX, '.goto-completion'],
  },
  {
    name: 'act-goto-offer',
    link: 'zoom=0.6',
    then: (page) => goTo(page, 'Annex III'),
    shown: [GO_TO_BOX, '.goto-offer'],
  },
  {
    name: 'act-goto-taken',
    link: 'zoom=0.6',
    then: (page) => goTo(page, 'Annex III', true),
    shown: ['#popup.visible'],
  },
  {
    name: 'act-about',
    link: 'zoom=0.6',
    then: (page) => viaMenu(page, 'about'),
    shown: ['#about-panel .about-section:first-of-type .panel-section-heading'],
  },
];

/** The Talmud's page, at /talmud/ (talmud.spec.ts). */
export const TALMUD_STATES: State[] = [
  {
    name: 'talmud-goto-panel',
    link: '',
    then: (page) => goTo(page),
    shown: [GO_TO_BOX, '.goto-example'],
  },
  {
    name: 'talmud-goto-completing',
    link: '',
    then: (page) => goTo(page, 'Ba'),
    shown: [GO_TO_BOX, '.goto-completion'],
  },
  {
    name: 'talmud-goto-offer',
    link: '',
    then: (page) => goTo(page, 'Berakhot 17a'),
    shown: [GO_TO_BOX, '.goto-offer'],
  },
  {
    name: 'talmud-dating-legend',
    link: 'overlay=dating',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'talmud-rabbis-legend',
    link: 'overlay=rabbis&rabbis=rabbi-yochanan-b-napacha,rabbi-shimon-b-lakish',
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-legend').scrollIntoViewIfNeeded();
    },
    shown: ['#overlay-legend'],
  },
  { name: 'talmud-dating', link: 'overlay=dating', shown: ['#map-legend'] },
  {
    name: 'talmud-dating-pinned',
    link: 'overlay=dating&at=Berakhot.2b.8&zoom=3',
    shown: ['#map-legend', '#popup.visible'],
  },
  {
    name: 'talmud-rabbis',
    link: 'overlay=rabbis&rabbis=rabbi-yochanan-b-napacha,rabbi-shimon-b-lakish',
    shown: ['#map-legend'],
  },
  {
    name: 'talmud-rabbis-pinned',
    link: 'overlay=rabbis&rabbis=rabbi-yochanan-b-napacha,rabbi-shimon-b-lakish&at=Shabbat.71b.3&zoom=3',
    shown: ['#map-legend', '#popup.visible', '.rabbi-name'],
  },
  {
    name: 'talmud-rabbis-panel',
    link: 'overlay=rabbis&rabbis=rabbi-yochanan-b-napacha,rabbi-shimon-b-lakish',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['.pick-input'],
  },
  {
    name: 'talmud-rabbis-and-search',
    link: `search=${encodeURIComponent('אמר')}&overlay=rabbis&rabbis=rabbi-yochanan-b-napacha,rabbi-shimon-b-lakish`,
    shown: ['#map-legend'],
  },
  {
    name: 'talmud-goto-not-found',
    link: '',
    then: (page) => goTo(page, 'Berakhot 99a'),
    shown: [GO_TO_BOX, '.goto-none'],
  },
];

/** The VIS map's page, at /ieeevis/ (ieeevis.spec.ts). */
export const IEEEVIS_STATES: State[] = [
  { name: 'vis-default', link: '', shown: ['#map-legend'] },
  { name: 'vis-sections', link: 'overlay=sections', shown: ['#map-legend'] },
  { name: 'vis-session-wrap', link: 'at=38.0&zoom=2', shown: ['#popup.visible'] },
  {
    name: 'vis-kinds-legend',
    link: 'overlay=kinds',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  {
    name: 'vis-sections-legend',
    link: 'overlay=sections',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['#overlay-select'],
  },
  { name: 'vis-long-paper', link: 'at=394.0&zoom=1.5', shown: ['#popup.visible'] },
  { name: 'vis-references-popup', link: 'at=1.12&zoom=4', shown: ['#popup.visible'] },
  {
    name: 'vis-authors',
    link: 'overlay=authors&authors=Bei Wang,Chaoli Wang',
    shown: ['#map-legend'],
  },
  {
    name: 'vis-authors-panel',
    link: 'overlay=authors&authors=Bei Wang,Chaoli Wang',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['.pick-input', '.pick-picked-row'],
  },
  {
    name: 'vis-keywords',
    link: 'overlay=keywords&keywords=visual analytics,Uncertainty visualization',
    shown: ['#map-legend'],
  },
  {
    name: 'vis-keywords-panel',
    link: 'overlay=keywords&keywords=visual analytics,Uncertainty visualization',
    then: (page) => viaMenu(page, 'overlay'),
    shown: ['.pick-input'],
  },
  {
    name: 'vis-search-and-keywords',
    link: `search=${SEARCHED}&overlay=keywords&keywords=visual analytics,Uncertainty visualization`,
    shown: ['#map-legend'],
  },
];
