# Layout tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Playwright suite that loads the real map in a real browser at four screen sizes, checks the layout against rules that hold for any good layout, and writes a contact sheet of every state for Danyel to look at.

**Architecture:** `@playwright/test` runs against a Vite dev server it starts itself, with SwiftShader so WebGL renders headless. Layout rules are pure functions over measured rectangles that return a list of violations, so they are testable without a browser and read well when they fail. Every measurement and every rule is also shown to be able to fail. A small custom reporter lays every screenshot out as states × screen sizes. It runs as `npm run test:layout`, outside the pre-commit hook.

**Tech Stack:** `@playwright/test` 1.58.2 (pinned to match the installed `playwright`), Chromium 1208 already in `~/Library/Caches/ms-playwright`, Vite 7, TypeScript 7.

**Spec:** `docs/plans/2026-09-23-ui-information-hierarchy-design.md` — this plan is the "Testing" bullet of its "How this lands in the code today" section. It lands before the frame, on its own branch, against today's interface.

## Global Constraints

- Work in a new worktree off `origin/main`, branch `layout-tests`. Not in the primary checkout, and not on the design branch.
- `@playwright/test` must be exactly `1.58.2`, the version of the installed `playwright`. Danyel's `~/.npmrc` refuses packages published in the last 7 days; 1.58.2 was published 2026-02-06. If npm refuses anyway, stop and report — do not override the policy.
- The pre-commit hook stays as it is: prettier on staged files, typecheck, vitest, about six seconds. Browser tests do not go in it.
- Before every commit, run `npx prettier --write` on the files you are committing. The code in this plan is not guaranteed to be in Prettier's layout, and the hook rejects anything that is not.
- The test server gets its own port (`5199`, `--strictPort`) and is started by Playwright. Never reuse a dev server that is already running: if the port is taken, the run must fail loudly.
- No new runtime dependencies. The app ships none.
- Imports inside `layout/` carry the `.ts` extension, as `src/` does.
- Comments follow AGENTS.md: present tense, only what the code cannot say.
- `npm` only (the repo has `package-lock.json`).

## What the rules are, and why these

A screenshot compared against a screenshot of the same code proves nothing. These rules instead state properties any acceptable layout has, measured in the browser:

| rule | what it catches |
|---|---|
| `chrome-in-viewport` | controls, panels or a dialog pushed off an edge |
| `chrome-apart` | popup under the panel, zoom buttons under the popup |
| `map-clear-of-panel` | the panel covering the map it describes |
| `text-not-clipped` | labels cut off or spilling out of their box |
| `touch-targets`, on touch screens | controls too small for a thumb: under 44×44 CSS px, Apple's guideline (WCAG AA's floor is 24) |
| the map rendered, in more than one colour | a blank canvas |

There is no rule against horizontal scrolling. Everything in this interface is fixed-position, which never widens the document, and `body` hides its overflow, so an element too wide is cut off rather than scrollable; `chrome-in-viewport` catches it.

The render check hides everything drawn over the canvas before it counts pixels — the book labels, the title and every control carry enough anti-aliased text to pass for a map on their own — and compares against the constant background `#1a1a1a` (`gl.clearColor(0.1, 0.1, 0.1)` in `src/rendering.ts:87`, and `body` in `src/styles/main.css:13`). A test with WebGL's draw call stubbed out proves it fails on a map that drew nothing.

Today's interface will break some rules. Each measured failure goes into `layout/known.ts` with the exact violations it produces and a reason, after Danyel has looked at it. A known failure whose violations change — fixed, or joined by a new one — fails the run, and a test checks that every entry names a state, screen and rule that are actually checked.

## File Structure

```
layout/
  playwright.config.ts   runner config: server, SwiftShader, screen sizes, reporters
  tsconfig.json          typechecks layout/ with Node types
  screens.ts             the four screen sizes, as Playwright projects
  geometry.ts            pure rectangle rules, each returning violations
  geometry.spec.ts       tests for geometry.ts (no browser)
  page.ts                opening the map, measuring elements, counting pixels
  check.ts               the rules applied to a page, reconciled with known.ts
  known.ts               layout failures accepted for now, with their violations
  known.spec.ts          every known failure names something that is checked
  app.ts                 the interface's chrome selectors and its states
  app.spec.ts            the states, checked at every screen size
  contactSheet.ts        reporter writing layout-report/index.html
src/main.ts              one line: marks the map ready
package.json             devDependency and scripts
.gitignore               test output directories
CLAUDE.md, AGENTS.md     how and when to run it
```

---

### Task 1: The runner loads the map and can tell whether it drew

**Files:**
- Create: `layout/playwright.config.ts`, `layout/tsconfig.json`, `layout/screens.ts`, `layout/page.ts`, `layout/app.spec.ts`
- Modify: `package.json` (devDependency, scripts), `.gitignore`, `src/main.ts` (end of `main()`, after `scheduleStoryFrame();`, near line 1451)

**Interfaces:**
- Produces: `SCREENS: { name: string; use: Project['use'] }[]` in `screens.ts`; `openMap(page: Page, hash: string): Promise<void>`, `mapPixels(page: Page): Promise<{ drawn: number; colours: number }>` and `DRAWN_FLOOR = 1000` in `page.ts`; the attribute `data-map-ready` on `<html>`.

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/danyel/code/MISC/torahmap
git fetch origin
git worktree add .claude/worktrees/layout-tests -b layout-tests origin/main
cd .claude/worktrees/layout-tests
npm install
```

Expected: `ls node_modules/.bin/vitest` exists.

- [ ] **Step 2: Add the dependency and scripts**

```bash
npm install --save-dev --save-exact @playwright/test@1.58.2
```

Expected: `package.json` gains `"@playwright/test": "1.58.2"`. If npm refuses because of the release-age policy, stop and report.

Edit `package.json` scripts: add after `"test:coverage"`:

```json
    "test:layout": "playwright test -c layout",
```

and change `"typecheck"` to:

```json
    "typecheck": "tsc --project tsconfig.build.json --noEmit && tsc --project layout/tsconfig.json --noEmit",
```

Append to `.gitignore`:

```
# Layout test output (npm run test:layout)
test-results/
layout-report/
playwright-report/
```

- [ ] **Step 3: Mark the map ready**

In `src/main.ts`, after `scheduleStoryFrame();` at the end of `main()`, add:

```ts
  // Layout tests wait on this; nothing in the app reads it.
  document.documentElement.dataset.mapReady = '';
```

- [ ] **Step 4: Write the config, tsconfig and screen sizes**

`layout/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["."]
}
```

`layout/screens.ts`:

```ts
import { devices, type Project } from '@playwright/test';

// The phone layout starts at max-width 768px (src/styles/right-panel.css), so
// the tablet gets the desktop layout.
export const SCREENS: { name: string; use: Project['use'] }[] = [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  // Playwright's iPhone 13 is 390×664: the part of the screen Safari leaves the page.
  { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
];
```

`layout/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { SCREENS } from './screens.ts';

const PORT = Number(process.env.LAYOUT_PORT ?? 5199);

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Transitions finish at once, so nothing is measured mid-animation.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: {
      // Headless Chromium has no WebGL2 without software rendering.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    // Pure checks, no page. The web server still starts: it is shared by every project.
    { name: 'rules', testMatch: ['geometry.spec.ts', 'known.spec.ts'] },
    ...SCREENS.map((s) => ({ name: s.name, use: s.use, testMatch: 'app.spec.ts' })),
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

Task 4 replaces `reporter: 'list'` with the contact sheet.

- [ ] **Step 5: Write `page.ts`**

```ts
import { expect, type Page } from '@playwright/test';

/** The canvas's clear colour and the page's background: #1a1a1a. */
const BACKGROUND = 26;
/** A channel this far from the background counts as drawn. */
const DRAWN_DELTA = 12;
/** Fewer drawn pixels than this is a map that did not draw. */
export const DRAWN_FLOOR = 1000;

/**
 * Loads the map at `hash` and waits until it has drawn and settled: the story
 * applies a stop on the animation frame after startup, and the title face
 * arrives from Google Fonts with display=swap, changing text widths.
 */
export async function openMap(page: Page, hash: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(hash ? `/#${hash}` : '/');
  await page.locator('html[data-map-ready]').waitFor({ timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await expect
    .poll(async () => (await mapPixels(page)).drawn, { timeout: 15_000 })
    .toBeGreaterThan(DRAWN_FLOOR);
  expect(errors, 'page errors').toEqual([]);
}

/**
 * Counts the map's drawn pixels and its distinct colours, from a screenshot of
 * the canvas with everything over it hidden: the labels, the title and the
 * controls carry enough text to pass for a map on their own. A screenshot is
 * what the reader sees; reading the WebGL buffer would depend on
 * preserveDrawingBuffer.
 */
export async function mapPixels(page: Page): Promise<{ drawn: number; colours: number }> {
  const hide = await page.addStyleTag({
    content: 'body *:not(#canvas) { visibility: hidden !important; }',
  });
  let png: Buffer;
  try {
    png = await page.locator('#canvas').screenshot();
  } finally {
    await hide.evaluate((el) => el.remove());
  }
  return page.evaluate(
    async ({ b64, bg, delta }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let drawn = 0;
      const colours = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (Math.max(Math.abs(r - bg), Math.abs(g - bg), Math.abs(b - bg)) <= delta) continue;
        drawn++;
        colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      }
      return { drawn, colours: colours.size };
    },
    { b64: png.toString('base64'), bg: BACKGROUND, delta: DRAWN_DELTA },
  );
}
```

- [ ] **Step 6: Write the render checks, including the one that must fail**

`layout/app.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { DRAWN_FLOOR, mapPixels, openMap } from './page.ts';

test('the map renders in more than one colour with an overlay on', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  const { drawn, colours } = await mapPixels(page);
  expect(drawn).toBeGreaterThan(DRAWN_FLOOR);
  expect(colours).toBeGreaterThanOrEqual(8);
});

test('the render check sees a map that drew nothing', async ({ page }) => {
  // The map draws with drawArrays alone (src/rendering.ts); the clear still runs.
  await page.addInitScript(() => {
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });
  await page.goto('/#overlay=commentary');
  await page.locator('html[data-map-ready]').waitFor({ timeout: 30_000 });
  expect((await mapPixels(page)).drawn).toBeLessThan(DRAWN_FLOOR);
});
```

- [ ] **Step 7: Run it**

Run: `npm run test:layout -- --project=desktop`
Expected: 2 passed.

Then print the real numbers once, to see how far above the floors they sit: add `console.log(await mapPixels(page))` to the first test, run the same command, and remove it.
Expected: `drawn` in the tens of thousands, `colours` well above 8. If the first test fails with `drawn` at 0, SwiftShader is not active: check the launch args before anything else. If the second test fails, the pixel count is seeing something other than the map: find what, and hide it too.

- [ ] **Step 8: Run all four screens**

Run: `npm run test:layout`
Expected: 8 passed (two per screen). The `rules` project has no tests yet.

- [ ] **Step 9: Typecheck, format and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
npx prettier --write layout/ package.json
git add package.json package-lock.json .gitignore src/main.ts layout/
git commit -m "Layout tests: Playwright loads the real map at four screen sizes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37"
```

---

### Task 2: The layout rules, as pure functions

**Files:**
- Create: `layout/geometry.ts`, `layout/geometry.spec.ts`

**Interfaces:**
- Produces, in `geometry.ts`:
  - `interface Rect { x: number; y: number; width: number; height: number }`
  - `interface Box extends Rect { name: string }`
  - `overlapping(boxes: Box[]): string[]`
  - `apart(a: Box[], b: Box[]): string[]` — every box in `a` clear of every box in `b`
  - `outsideOf(boxes: Box[], frame: Rect): string[]`
  - `tooSmallToTouch(boxes: Box[], min: number): string[]`

- [ ] **Step 1: Write the failing tests**

`layout/geometry.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { apart, outsideOf, overlapping, tooSmallToTouch, type Box } from './geometry.ts';

const box = (name: string, x: number, y: number, width: number, height: number): Box => ({
  name,
  x,
  y,
  width,
  height,
});

test.describe('overlapping', () => {
  test('boxes that share only an edge do not overlap', () => {
    expect(overlapping([box('a', 0, 0, 10, 10), box('b', 10, 0, 10, 10)])).toEqual([]);
  });
  test('sub-pixel rounding at an edge is not an overlap', () => {
    expect(overlapping([box('a', 0, 0, 10.4, 10), box('b', 10, 0, 10, 10)])).toEqual([]);
  });
  test('names both boxes and the shared area', () => {
    expect(overlapping([box('a', 0, 0, 10, 10), box('b', 5, 5, 10, 10)])).toEqual([
      'a overlaps b by 5×5px',
    ]);
  });
});

test.describe('apart', () => {
  test('reports a box from each side that meet', () => {
    expect(apart([box('map', 0, 0, 100, 100)], [box('panel', 90, 0, 50, 100)])).toEqual([
      'map overlaps panel by 10×100px',
    ]);
  });
});

test.describe('outsideOf', () => {
  const screen = { x: 0, y: 0, width: 100, height: 100 };
  test('a box inside the frame passes', () => {
    expect(outsideOf([box('a', 10, 10, 20, 20)], screen)).toEqual([]);
  });
  test('names every side a box crosses', () => {
    expect(outsideOf([box('a', -5, 90, 20, 20)], screen)).toEqual([
      'a crosses the left, bottom edge',
    ]);
  });
});

test.describe('tooSmallToTouch', () => {
  test('passes a box at the minimum', () => {
    expect(tooSmallToTouch([box('a', 0, 0, 44, 44)], 44)).toEqual([]);
  });
  test('reports the measured size', () => {
    expect(tooSmallToTouch([box('a', 0, 0, 80, 20)], 44)).toEqual(['a is 80×20px, under 44']);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm run test:layout -- --project=rules`
Expected: FAIL — cannot find module `./geometry.ts`.

- [ ] **Step 3: Implement**

`layout/geometry.ts`:

```ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Box extends Rect {
  name: string;
}

/** Fractional CSS lengths round differently at each edge; this much is not a defect. */
const SLACK = 0.5;

const px = (n: number): string => `${Math.round(n)}`;

function overlap(a: Rect, b: Rect): { w: number; h: number } | null {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > SLACK && h > SLACK ? { w, h } : null;
}

const describeOverlap = (a: Box, b: Box, o: { w: number; h: number }): string =>
  `${a.name} overlaps ${b.name} by ${px(o.w)}×${px(o.h)}px`;

export function overlapping(boxes: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const o = overlap(boxes[i], boxes[j]);
      if (o) out.push(describeOverlap(boxes[i], boxes[j], o));
    }
  }
  return out;
}

export function apart(a: Box[], b: Box[]): string[] {
  return a.flatMap((x) =>
    b.flatMap((y) => {
      const o = overlap(x, y);
      return o ? [describeOverlap(x, y, o)] : [];
    }),
  );
}

export function outsideOf(boxes: Box[], frame: Rect): string[] {
  return boxes.flatMap((b) => {
    const sides = [
      b.x < frame.x - SLACK && 'left',
      b.y < frame.y - SLACK && 'top',
      b.x + b.width > frame.x + frame.width + SLACK && 'right',
      b.y + b.height > frame.y + frame.height + SLACK && 'bottom',
    ].filter(Boolean);
    return sides.length ? [`${b.name} crosses the ${sides.join(', ')} edge`] : [];
  });
}

export function tooSmallToTouch(boxes: Box[], min: number): string[] {
  return boxes
    .filter((b) => b.width < min - SLACK || b.height < min - SLACK)
    .map((b) => `${b.name} is ${px(b.width)}×${px(b.height)}px, under ${min}`);
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npm run test:layout -- --project=rules`
Expected: 8 passed.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write layout/geometry.ts layout/geometry.spec.ts
git add layout/geometry.ts layout/geometry.spec.ts
git commit -m "Layout rules as pure functions over measured boxes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37"
```

---

### Task 3: Every state of today's interface, checked at every screen size

**Files:**
- Modify: `layout/page.ts` (add measuring), `layout/app.spec.ts` (add the states)
- Create: `layout/check.ts`, `layout/known.ts`, `layout/known.spec.ts`, `layout/app.ts`

**Interfaces:**
- Consumes: `openMap`, `mapPixels`, `DRAWN_FLOOR` (Task 1); `overlapping`, `apart`, `outsideOf`, `tooSmallToTouch`, `Box` (Task 2); `SCREENS` (Task 1).
- Produces:
  - `boxes(page: Page, selector: string): Promise<Box[]>` — the visible part of each match
  - `clippedText(page: Page, selector: string): Promise<string[]>`
  - `interface Chrome { fixed: string; modal?: string; map: string; panel: string; interactive: string; text: string }`
  - `RULES` (the rule names, `as const`) and `checkLayout(page: Page, state: string, chrome: Chrome): Promise<void>` in `check.ts`
  - `interface Known { reason: string; violations: string[] }` and `KNOWN: Record<string, Known>` keyed `"<state>/<screen>/<rule>"` in `known.ts`
  - `interface State { name: string; hash: string; then?: (page: Page) => Promise<void> }`, `CHROME: Chrome` and `STATES: State[]` in `app.ts`

- [ ] **Step 1: Add measuring to `page.ts`**

Add `import type { Box } from './geometry.ts';` to the imports at the top, then append:

```ts
/**
 * The visible part of every element matching `selector`. An element inside a
 * collapsed or scrolled container still has its full bounding rect, so each is
 * cut to the ancestors that clip it. The walk stops at <body>, whose overflow
 * the browser hands to the viewport, and after the first fixed-position box,
 * since nothing above a fixed box clips it.
 */
export async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      if (el.closest('[inert]')) return [];
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      for (let a: Element | null = el; a; a = a.parentElement) {
        if (getComputedStyle(a).opacity === '0') return [];
      }
      let { left, top, right, bottom } = el.getBoundingClientRect();
      if (style.position !== 'fixed') {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
            const r = a.getBoundingClientRect();
            left = Math.max(left, r.left);
            top = Math.max(top, r.top);
            right = Math.min(right, r.right);
            bottom = Math.min(bottom, r.bottom);
          }
          if (s.position === 'fixed') break;
        }
      }
      if (right - left < 1 || bottom - top < 1) return [];
      const name = el.id
        ? `#${el.id}`
        : el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
      return [{ name, x: left, y: top, width: right - left, height: bottom - top }];
    }),
  );
}

/**
 * Elements whose text does not fit their box. A block is measured by its
 * scroll width; an inline element has none, so its text is measured against
 * its parent's box instead. Anything a pixel or less across is hidden for
 * screen readers on purpose, and skipped.
 */
export async function clippedText(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      const h = el as HTMLElement;
      if (h.closest('[inert]') || !h.textContent?.trim()) return [];
      const box = h.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return [];
      const name = h.id ? `#${h.id}` : `${h.tagName.toLowerCase()}.${[...h.classList].join('.')}`;
      if (getComputedStyle(h).display === 'inline') {
        const range = document.createRange();
        range.selectNodeContents(h);
        const text = range.getBoundingClientRect();
        const parent = h.parentElement!.getBoundingClientRect();
        return text.left < parent.left - 1 || text.right > parent.right + 1
          ? [`${name} runs ${Math.round(text.right - parent.right)}px past its parent`]
          : [];
      }
      return h.scrollWidth > h.clientWidth + 1
        ? [`${name} needs ${h.scrollWidth}px, has ${h.clientWidth}`]
        : [];
    }),
  );
}
```

- [ ] **Step 2: Write `known.ts`, empty**

```ts
/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does.
 */
export const KNOWN: Record<string, Known> = {};
```

- [ ] **Step 3: Write `check.ts`**

```ts
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

const TOUCH_MIN = 44;

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
      info.annotations.push({ type: 'known layout defect', description: `${key}: ${known.reason}` });
    } else {
      expect
        .soft(violations, `${key} no longer measures what known.ts records: update or remove it`)
        .toEqual(known.violations);
    }
  }
}
```

- [ ] **Step 4: Write `app.ts`: today's chrome and states**

```ts
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
```

Check the names the states rely on before going on:

Run: `grep -n "stop: abraham_call" public/data/story.md; grep -n "about-btn\|help-modal\|help-content\|help-tab" src/help.ts | head; grep -n "'q'\|key: 'q'" src/overlays/search/index.ts`
Expected: the stop exists (it pins `Genesis.12.1`); `#about-btn`, `#help-modal`, `.help-content` and `.help-tab` exist; search's URL key is `q`. Change any name the source spells differently.

- [ ] **Step 5: Check the states, and check that the measurements see something**

Append to `layout/app.spec.ts`, and add `boxes` to its import from `./page.ts`:

```ts
import { CHROME, STATES } from './app.ts';
import { checkLayout } from './check.ts';

test('measuring finds the panel and its controls', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  expect(await boxes(page, CHROME.panel)).not.toEqual([]);
  expect(await boxes(page, CHROME.interactive)).not.toEqual([]);
});

for (const state of STATES) {
  test(state.name, async ({ page }, info) => {
    await openMap(page, state.hash);
    await state.then?.(page);
    const shot = info.outputPath('screen.png');
    await page.screenshot({ path: shot });
    await info.attach('layout', { path: shot, contentType: 'image/png' });
    await checkLayout(page, state.name, CHROME);
  });
}

test('the title face loads', async ({ page }) => {
  await openMap(page, 'story=intro');
  // document.fonts.check() is true for a face that was never declared; load() is not.
  const faces = await page.evaluate(
    async () => (await document.fonts.load('700 32px "David Libre"')).length,
  );
  expect(faces, 'David Libre comes from Google Fonts, so this needs the network').toBeGreaterThan(
    0,
  );
});
```

Move the imports to the top of the file with the others.

- [ ] **Step 6: Check that every known failure names something checked**

`layout/known.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { STATES } from './app.ts';
import { RULES } from './check.ts';
import { KNOWN } from './known.ts';
import { SCREENS } from './screens.ts';

test('every known failure names a state, screen and rule that are checked', () => {
  const states = new Set(STATES.map((s) => s.name));
  const touch = new Map(SCREENS.map((s) => [s.name, Boolean(s.use?.hasTouch)]));
  for (const key of Object.keys(KNOWN)) {
    const [state, screen, rule] = key.split('/');
    expect(states.has(state), `${key}: no such state`).toBe(true);
    expect(touch.has(screen), `${key}: no such screen`).toBe(true);
    expect(RULES as readonly string[], `${key}: no such rule`).toContain(rule);
    if (rule === 'touch-targets') {
      expect(touch.get(screen), `${key}: touch targets are checked only on touch screens`).toBe(
        true,
      );
    }
  }
});
```

Run: `npm run test:layout -- --project=rules`
Expected: 9 passed.

- [ ] **Step 7: Run everything and keep the output**

Run: `mkdir -p layout-report && npm run test:layout 2>&1 | tee layout-report/first-run.txt`
Expected: "measuring finds the panel and its controls" passes on all four screens — if it fails, the measurement is broken and nothing after it means anything; fix it first. Then some state failures on today's interface: each soft failure prints its key (`state/screen/rule`) and its violations. (`layout-report/` rather than `test-results/`, which Playwright empties at the start of every run.)

- [ ] **Step 8: Prove each rule can fail on purpose**

For each rule with no failure in Step 7, make one and revert it: `TOUCH_MIN = 400` for `touch-targets` on `phone`; `#canvas` added to `CHROME.fixed` for `chrome-apart`; `CHROME.panel` set to `'#canvas'` for `map-clear-of-panel`; a style tag setting `#right-panel { right: -100px }` in a state's `then` for `chrome-in-viewport`; `#controls-summary { width: 20px }` for `text-not-clipped`. A rule that cannot be made to fail is not measuring anything — fix it before going on.

- [ ] **Step 9: Stop and review the failures with Danyel**

Do not edit `known.ts` alone. Write the failing keys and their violation text into the PR description draft, grouped by rule, with the screenshot each comes from, and ask Danyel which are real defects of today's interface and which mean a rule is wrong. Only then:
- a real defect goes into `KNOWN` with its reason and its violations copied exactly from the run;
- a wrong rule is fixed in `check.ts`, `page.ts` or `geometry.ts`, with a test in `geometry.spec.ts` when the fix is in the geometry.

- [ ] **Step 10: Run clean, typecheck, format and commit**

Run: `npm run test:layout`
Expected: all pass, with known defects listed as annotations.

Run: `npm run typecheck`
Expected: no errors.

```bash
npx prettier --write layout/
git add layout/
git commit -m "Layout tests: every state of the interface at every screen size

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37"
```

---

### Task 4: A contact sheet of every state at every size

**Files:**
- Create: `layout/contactSheet.ts`
- Modify: `layout/playwright.config.ts` (the reporter line)

**Interfaces:**
- Consumes: attachments named `layout` (Task 3), annotations of type `known layout defect` (Task 3).
- Produces: `layout-report/index.html`, self-contained with `layout-report/shots/*.png`.

- [ ] **Step 1: Write the reporter**

```ts
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface Cell {
  shot: string;
  failures: string[];
  known: string[];
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Writes every layout screenshot as a grid: states down, screen sizes across. */
export default class ContactSheet implements Reporter {
  private readonly dir: string;
  private readonly cells = new Map<string, Map<string, Cell>>();
  private readonly screens: string[] = [];

  // Playwright passes a reporter's options through as given, adding configDir;
  // a relative outputDir would otherwise resolve against the working directory.
  constructor(options: { outputDir: string; configDir: string }) {
    this.dir = resolve(options.configDir, options.outputDir);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const shot = result.attachments.find((a) => a.name === 'layout' && a.path);
    if (!shot?.path) return;
    const screen = test.parent.project()!.name;
    if (!this.screens.includes(screen)) this.screens.push(screen);
    mkdirSync(join(this.dir, 'shots'), { recursive: true });
    const file = `shots/${test.title}--${screen}.png`;
    copyFileSync(shot.path, join(this.dir, file));
    const row = this.cells.get(test.title) ?? new Map<string, Cell>();
    row.set(screen, {
      shot: file,
      failures: result.errors.map((e) => (e.message ?? '').split('\n')[0]),
      known: test.annotations
        .filter((a) => a.type === 'known layout defect')
        .map((a) => a.description ?? ''),
    });
    this.cells.set(test.title, row);
  }

  onEnd(): void {
    if (this.cells.size === 0) return;
    const head = this.screens.map((s) => `<th>${esc(s)}</th>`).join('');
    const rows = [...this.cells]
      .map(([state, row]) => {
        const tds = this.screens
          .map((s) => {
            const c = row.get(s);
            if (!c) return '<td></td>';
            const notes = [
              ...c.failures.map((f) => `<li class="fail">${esc(f)}</li>`),
              ...c.known.map((k) => `<li class="known">${esc(k)}</li>`),
            ].join('');
            return `<td><a href="${c.shot}"><img src="${c.shot}" loading="lazy"></a><ul>${notes}</ul></td>`;
          })
          .join('');
        return `<tr><th>${esc(state)}</th>${tds}</tr>`;
      })
      .join('');
    writeFileSync(
      join(this.dir, 'index.html'),
      `<!doctype html><meta charset="utf-8"><title>Layout</title><style>
body{font:13px system-ui;background:#111;color:#ddd;margin:16px}
table{border-collapse:collapse}th,td{border:1px solid #333;padding:6px;vertical-align:top}
img{max-width:260px;max-height:320px;display:block}ul{margin:4px 0 0;padding-left:16px;max-width:260px}
.fail{color:#f77}.known{color:#aa8}
</style><table><tr><th></th>${head}</tr>${rows}</table>`,
    );
    console.log(`Contact sheet: ${join(this.dir, 'index.html')}`);
  }
}
```

- [ ] **Step 2: Use it in the config**

In `layout/playwright.config.ts`, replace `reporter: 'list',` with:

```ts
  reporter: [['list'], ['./contactSheet.ts', { outputDir: '../layout-report' }]],
```

- [ ] **Step 3: Run and open it**

Run: `npm run test:layout`
Expected: ends with `Contact sheet: <worktree>/layout-report/index.html` — inside the worktree, not beside it.

Run: `open layout-report/index.html`
Expected: seven rows of states, four columns of screen sizes, a screenshot in each cell, known defects in yellow under the cells they belong to. Read two or three screenshots at full size: the map has coloured squares in them, and the Hebrew title is in David Libre rather than a fallback serif.

- [ ] **Step 4: Typecheck, format and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
npx prettier --write layout/contactSheet.ts layout/playwright.config.ts
git add layout/contactSheet.ts layout/playwright.config.ts
git commit -m "Layout tests write a contact sheet: states down, screen sizes across

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37"
```

---

### Task 5: Say how and when to run it, and open the PR

**Files:**
- Modify: `CLAUDE.md` (the Testing section and its Test Harness paragraph), `AGENTS.md` (the UI Changes paragraph)

- [ ] **Step 1: Document it in CLAUDE.md**

In `## Testing`, after the `npm run test:coverage` code block, add:

````markdown
### Layout tests

The interface is tested for layout in a real browser, at four screen sizes, from
a phone to a desktop:

```bash
npm run test:layout
```

It starts its own dev server on port 5199 (`LAYOUT_PORT` to change it), renders
the map with software WebGL, and checks every state in `layout/app.ts` against
rules any good layout keeps: nothing off screen or overlapping, no clipped
text, touch targets large enough for a thumb, and a map that actually drew.
`layout/known.ts` lists the failures accepted for now, what each measures and
why. It ends by writing `layout-report/index.html`, every state at every size
side by side.

It takes about a minute, so the pre-commit hook does not run it. Run it before
opening any pull request that changes the interface.
````

The Test Harness paragraph says the harness is for headless browsers "where WebGL is unavailable". Change that paragraph to:

```markdown
A standalone test harness at `http://localhost:5173/test-harness/` provides the search input flow on its own, without the map. Source lives in `test-harness/`.
```

- [ ] **Step 2: Point UI changes at it in AGENTS.md**

In the **UI Changes** paragraph, after its first sentence, add:

```markdown
Run `npm run test:layout` first, and attach or link the contact sheet it writes
(`layout-report/index.html`) for the states the change touches.
```

- [ ] **Step 3: Run every gate**

Run: `npm run typecheck && npm test && npm run test:layout`
Expected: all pass.

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "Say how and when to run the layout tests

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37"
git push -u origin layout-tests
gh pr create --base main --title "Layout tests: the real map, four screen sizes, a contact sheet" --body "…"
```

The PR body leads with what the suite checks and why, lists the known defects of today's interface that Danyel accepted in Task 3, and embeds two or three contact-sheet screenshots by commit-pinned URL (commit them under `docs/plans/images/2026-09-23-layout-tests/`; relative image paths 404 until the PR merges). It ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Expected: the PR URL is printed; `gh pr view` shows it open against `main`.

---

## Self-Review

- **Spec coverage.** The design's Testing bullet asks for the frame's states to be driven and looked at in a real browser, with state kept in vitest. This plan builds the browser half against today's interface; the frame plan replaces `CHROME` and `STATES` in `layout/app.ts` with the frame's. The vitest half belongs to the frame plan.
- **Every check can fail.** The render check has a test that stubs out drawing; the measurement has a test that it finds the panel; each rule is made to fail once by hand in Task 3 Step 8; `known.ts` entries are pinned to their exact violations and to names that exist.
- **Placeholders.** The PR body in Task 5 is described rather than written, because it lists the known defects Task 3 has not yet measured.
- **Names.** `openMap`, `mapPixels`, `DRAWN_FLOOR`, `boxes`, `clippedText`, `checkLayout`, `RULES`, `Chrome`, `Known`, `KNOWN`, `State`, `CHROME`, `STATES`, `SCREENS`, `overlapping`, `apart`, `outsideOf`, `tooSmallToTouch`, `Box`, `Rect` are each defined once and used with the same signatures.
