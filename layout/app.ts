import type { Page } from '@playwright/test';
import type { Chrome } from './check.ts';

export interface State {
  name: string;
  hash: string;
  then?: (page: Page) => Promise<void>;
}

// Today's panel, story strip, footer and help window (index.html,
// src/styles/right-panel.css, src/help.ts). Links inside the story's prose are
// running text, which touch-size rules exempt.
export const CHROME: Chrome = {
  fixed: '#right-panel, #zoom-controls, #verse-popup.visible',
  modal: '#help-modal.visible .help-content',
  map: '#canvas',
  panel: '#right-panel',
  interactive:
    '#right-panel button, #right-panel select, #right-panel input, ' +
    '#right-panel a:not(.story-stop a), #verse-popup button, #verse-popup a, ' +
    '#zoom-controls button, #help-modal.visible button',
  text:
    '#controls-summary, #story-strip-title, .footer-link, #right-panel label, ' +
    '#verse-popup .ref-text, #help-modal.visible .help-tab',
};

export const STATES: State[] = [
  { name: 'story-opening', hash: 'story=intro' },
  { name: 'story-stop-with-verse', hash: 'story=abraham_call' },
  { name: 'explore-no-overlay', hash: 'zoom=0.5' },
  { name: 'explore-commentary', hash: 'overlay=commentary' },
  { name: 'explore-search', hash: `overlay=search&q=${encodeURIComponent('אברהם')}` },
  { name: 'explore-verse-pinned', hash: 'overlay=commentary&verse=Genesis.12.1' },
  {
    name: 'about-open',
    hash: 'overlay=commentary',
    then: (page) => page.locator('#about-btn').click(),
  },
];
