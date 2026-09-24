import { expect, test, type Page } from '@playwright/test';
import type { State } from './app.ts';
import { apart, notShownInFull, outsideOf, overlapping, tooSmallToTouch } from './geometry.ts';
import { KNOWN } from './known.ts';
import { boxes, clippedText, shown } from './page.ts';

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
  'expected-shown',
] as const;

export type Rule = (typeof RULES)[number];

// WCAG 2.2 AA (success criterion 2.5.8) sets 24×24 as its minimum; this
// interface is a map to read, not a panel of buttons, so it isn't held to
// the stricter 44px some style guides prefer.
const TOUCH_MIN = 24;

/** Each rule's violations on the page as it is; touch targets only on a touch screen. */
export async function measureLayout(
  page: Page,
  chrome: Chrome,
  expected: string[] = [],
): Promise<Partial<Record<Rule, string[]>>> {
  const screen = page.viewportSize()!;
  const onScreen = [chrome.fixed, chrome.interactive, chrome.modal].filter(Boolean).join(', ');
  const out: Partial<Record<Rule, string[]>> = {
    'chrome-in-viewport': outsideOf(await boxes(page, onScreen), { x: 0, y: 0, ...screen }),
    'chrome-apart': overlapping(await boxes(page, chrome.fixed)),
    'map-clear-of-panel': apart(await boxes(page, chrome.map), await boxes(page, chrome.panel)),
    'text-not-clipped': await clippedText(page, chrome.text),
  };
  if (test.info().project.use.hasTouch) {
    out['touch-targets'] = tooSmallToTouch(await boxes(page, chrome.interactive), TOUCH_MIN);
  }
  const missing: string[] = [];
  for (const selector of expected) {
    missing.push(...notShownInFull(selector, await shown(page, selector)));
  }
  out['expected-shown'] = missing;
  return out;
}

/** Measures the page and fails on every violation that `KNOWN` does not record exactly. */
export async function checkLayout(page: Page, state: State, chrome: Chrome): Promise<void> {
  const info = test.info();
  const measured = await measureLayout(page, chrome, state.shown);
  for (const rule of RULES) {
    const violations = measured[rule];
    if (!violations) continue;
    const key = `${state.name}/${info.project.name}/${rule}`;
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
