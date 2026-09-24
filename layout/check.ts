import { expect, test, type Page } from '@playwright/test';
import { apart, outsideOf, overlapping, tooSmallToTouch } from './geometry.ts';
import { KNOWN } from './known.ts';
import { boxes, clippedText } from './page.ts';

/** The selectors the rules measure, which belong to the interface being tested. */
export interface Chrome {
  /** Fixed-position chrome that must not overlap itself. */
  fixed: string;
  /** A dialog, which covers the rest by design but must fit the screen. */
  modal?: string;
  map: string;
  panel: string;
  interactive: string;
  text: string;
}

export const RULES = [
  'chrome-in-viewport',
  'chrome-apart',
  'map-clear-of-panel',
  'text-not-clipped',
  'touch-targets',
] as const;

// WCAG 2.2 AA (success criterion 2.5.8) sets 24×24 as its minimum; this
// interface is a map to read, not a panel of buttons, so it isn't held to
// the stricter 44px some style guides prefer.
const TOUCH_MIN = 24;

export async function checkLayout(page: Page, state: string, chrome: Chrome): Promise<void> {
  const info = test.info();
  const screen = page.viewportSize()!;
  const touch = Boolean(info.project.use.hasTouch);
  const onScreen = [chrome.fixed, chrome.interactive, chrome.modal].filter(Boolean).join(', ');

  const measure: Record<(typeof RULES)[number], (() => Promise<string[]>) | null> = {
    'chrome-in-viewport': async () =>
      outsideOf(await boxes(page, onScreen), { x: 0, y: 0, ...screen }),
    'chrome-apart': async () => overlapping(await boxes(page, chrome.fixed)),
    'map-clear-of-panel': async () =>
      apart(await boxes(page, chrome.map), await boxes(page, chrome.panel)),
    'text-not-clipped': () => clippedText(page, chrome.text),
    'touch-targets': touch
      ? async () => tooSmallToTouch(await boxes(page, chrome.interactive), TOUCH_MIN)
      : null,
  };

  for (const rule of RULES) {
    const run = measure[rule];
    if (!run) continue;
    const key = `${state}/${info.project.name}/${rule}`;
    const violations = await run();
    const known = KNOWN[key];
    if (!known) {
      expect.soft(violations, key).toEqual([]);
    } else if (JSON.stringify(violations) === JSON.stringify(known.violations)) {
      info.annotations.push({
        type: 'known layout defect',
        description: `${key}: ${known.reason}`,
      });
    } else {
      expect
        .soft(violations, `${key} no longer measures what known.ts records: update or remove it`)
        .toEqual(known.violations);
    }
  }
}
