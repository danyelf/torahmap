# Layout tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Playwright suite that loads the real map in a real browser at four screen sizes, checks the layout against rules that hold for any good layout, and writes a contact sheet of every state for Danyel to look at.

**Architecture:** `@playwright/test` runs against a Vite dev server it starts itself, with SwiftShader so WebGL renders headless. Layout rules are pure functions over measured rectangles that return a list of violations, so they are testable without a browser and read well when they fail. A small custom reporter lays every screenshot out as states × screen sizes. It runs as `npm run test:layout`, outside the pre-commit hook.

**Tech Stack:** `@playwright/test` 1.58.2 (pinned to match the installed `playwright`), Chromium 1208 already in `~/Library/Caches/ms-playwright`, Vite 7, TypeScript 7.

**Spec:** `docs/plans/2026-09-23-ui-information-hierarchy-design.md` — this plan is the "Testing" bullet of its "How this lands in the code today" section. It lands before the frame, on its own branch, against today's interface.

## Global Constraints

- Work in a new worktree off `origin/main`, branch `layout-tests`. Not in the primary checkout, and not on the design branch.
- `@playwright/test` must be exactly `1.58.2`, the version of the installed `playwright`. Danyel's `~/.npmrc` refuses packages published in the last 7 days; 1.58.2 was published 2026-02-06. If npm refuses anyway, stop and report — do not override the policy.
- The pre-commit hook stays as it is: prettier, typecheck, vitest, about six seconds. Browser tests do not go in it.
- The test server gets its own port (`5199`, `--strictPort`) and is started by Playwright. Never reuse a dev server that is already running: if the port is taken, the run must fail loudly.
- No new runtime dependencies. The app ships none.
- Comments follow AGENTS.md: present tense, only what the code cannot say.
- `npm` only (the repo has `package-lock.json`).

## What the rules are, and why these

A screenshot compared against a screenshot of the same code proves nothing. These rules instead state properties any acceptable layout has, measured in the browser:

| rule | what it catches |
|---|---|
| no horizontal page scroll | anything wider than the screen |
| chrome inside the viewport | controls pushed off an edge |
| chrome does not overlap chrome | popup under the panel, zoom buttons under the popup |
| the map and the panel do not overlap | the panel covering the map it describes |
| text is not clipped | labels cut off or spilling out of their box |
| touch targets at least 44×44 CSS px, on touch screens | footer links too small for a thumb (44 is Apple's guideline; WCAG AA's floor is 24) |
| the map rendered, in more than one colour | a blank or single-colour canvas |

The render rule compares against the constant background `#1a1a1a` (`gl.clearColor(0.1, 0.1, 0.1)` in `src/rendering.ts:87`, and `body` in `src/styles/main.css:13`), not against anything the app computes. Its thresholds are floors against "nothing drew", not a measure of correctness.

Today's interface will break some rules. Each measured failure is listed in `layout/known.ts` with a reason, after Danyel has looked at it. A listed failure that stops failing fails the run, so the list cannot go stale.

## File Structure

```
layout/
  playwright.config.ts   runner config: server, SwiftShader, screen sizes, reporters
  tsconfig.json          typechecks layout/ with Node types
  screens.ts             the four screen sizes, as Playwright projects
  geometry.ts            pure rectangle rules, each returning violations
  geometry.spec.ts       tests for geometry.ts (no browser)
  page.ts                opening the map, measuring elements, counting pixels
  known.ts               layout failures accepted for now, with reasons
  check.ts               applies the rules to a page and reconciles with known.ts
  app.spec.ts            the app's states, checked at every screen size
  contactSheet.ts        reporter writing layout-report/index.html
src/main.ts              one line: marks the map ready
package.json             devDependency and scripts
.gitignore               test output directories
CLAUDE.md, AGENTS.md     how and when to run it
```

---

### Task 1: The runner loads the map and sees it render

**Files:**
- Create: `layout/playwright.config.ts`, `layout/tsconfig.json`, `layout/screens.ts`, `layout/page.ts`, `layout/app.spec.ts`
- Modify: `package.json` (devDependency, scripts), `.gitignore`, `src/main.ts` (end of `main()`, after `scheduleStoryFrame();` near line 1467)

**Interfaces:**
- Produces: `SCREENS: { name: string; use: PlaywrightTestOptions }[]` in `screens.ts`; `openMap(page: Page, hash: string): Promise<void>` and `mapPixels(page: Page): Promise<{ drawn: number; colours: number }>` in `page.ts`; the attribute `data-map-ready` on `<html>`.

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/danyel/code/MISC/torahmap
git fetch origin
git worktree add .claude/worktrees/layout-tests -b layout-tests origin/main
cd .claude/worktrees/layout-tests
npm install
```

Expected: `npm install` finishes; `ls node_modules/.bin/vitest` exists.

- [ ] **Step 2: Add the dependency and scripts**

```bash
npm install --save-dev --save-exact @playwright/test@1.58.2
```

Expected: `package.json` gains `"@playwright/test": "1.58.2"`. If npm refuses because of the release-age policy, stop and report.

Then edit `package.json` scripts: add after `"test:coverage"`:

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
import { devices, type PlaywrightTestOptions } from '@playwright/test';

// The phone layout starts at max-width 768px (src/styles/right-panel.css), so
// the tablet gets the desktop layout.
export const SCREENS: { name: string; use: Partial<PlaywrightTestOptions> }[] = [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
];
```

`layout/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { SCREENS } from './screens';

const PORT = Number(process.env.LAYOUT_PORT ?? 5199);

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['./contactSheet.ts', { outputDir: '../layout-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    reducedMotion: 'reduce',
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
    { name: 'rules', testMatch: 'geometry.spec.ts' },
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

The reporter file does not exist until Task 4. Until then, change the `reporter` line to `reporter: 'list',` and restore it in Task 4.

- [ ] **Step 5: Write `page.ts`**

```ts
import { expect, type Page } from '@playwright/test';

/** The canvas's clear colour and the page's background: #1a1a1a. */
const BACKGROUND = 26;
/** A channel this far from the background counts as drawn. */
const DRAWN_DELTA = 12;

/** Loads the map at `hash` and waits until it has drawn. */
export async function openMap(page: Page, hash: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(hash ? `/#${hash}` : '/');
  await page.locator('html[data-map-ready]').waitFor({ timeout: 30_000 });
  await expect
    .poll(async () => (await mapPixels(page)).drawn, { timeout: 15_000 })
    .toBeGreaterThan(1000);
  expect(errors, 'page errors').toEqual([]);
}

/**
 * Counts the map's drawn pixels and its distinct colours, from a screenshot of
 * the canvas: a screenshot is what the reader sees, and reading the WebGL
 * buffer directly would depend on preserveDrawingBuffer.
 */
export async function mapPixels(page: Page): Promise<{ drawn: number; colours: number }> {
  const png = await page.locator('#canvas').screenshot();
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

- [ ] **Step 6: Write a first spec that must pass**

`layout/app.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { mapPixels, openMap } from './page';

test('the map renders with an overlay on', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  const { drawn, colours } = await mapPixels(page);
  expect(drawn).toBeGreaterThan(1000);
  expect(colours).toBeGreaterThanOrEqual(8);
});
```

- [ ] **Step 7: Run it**

Run: `npm run test:layout -- --project=desktop`
Expected: 1 passed. Then print the measured numbers once, to see how far above the floors they sit:

Run: `npm run test:layout -- --project=desktop` with a temporary `console.log(await mapPixels(page))` in the test.
Expected: `drawn` in the tens of thousands, `colours` well above 8. Remove the `console.log`. If `drawn` is 0, SwiftShader is not active: check the launch args before anything else.

- [ ] **Step 8: Prove the check can fail**

Temporarily change `openMap`'s poll to `.toBeGreaterThan(10_000_000)` and run again.
Expected: FAIL with a timeout naming the poll. Revert.

- [ ] **Step 9: Run all four screens**

Run: `npm run test:layout`
Expected: 4 passed (one per screen). The `rules` project has no tests yet and reports nothing.

- [ ] **Step 10: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add package.json package-lock.json .gitignore src/main.ts layout/
git commit -m "Layout tests: Playwright loads the real map at four screen sizes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
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
  - `outsideOf(boxes: Box[], frame: Rect): string[]`
  - `tooSmallToTouch(boxes: Box[], min: number): string[]`
  - `apart(a: Box[], b: Box[]): string[]` — every box in `a` clear of every box in `b`

- [ ] **Step 1: Write the failing tests**

`layout/geometry.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { apart, outsideOf, overlapping, tooSmallToTouch, type Box } from './geometry';

const box = (name: string, x: number, y: number, width: number, height: number): Box => ({
  name, x, y, width, height,
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

test.describe('apart', () => {
  test('reports a box from each side that meet', () => {
    expect(apart([box('map', 0, 0, 100, 100)], [box('panel', 90, 0, 50, 100)])).toEqual([
      'map overlaps panel by 10×100px',
    ]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm run test:layout -- --project=rules`
Expected: FAIL — cannot find module `./geometry`.

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

- [ ] **Step 5: Commit**

```bash
git add layout/geometry.ts layout/geometry.spec.ts
git commit -m "Layout rules as pure functions over measured boxes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Every state of today's interface, checked at every screen size

**Files:**
- Modify: `layout/page.ts` (add measuring), `layout/app.spec.ts` (replace the first spec)
- Create: `layout/check.ts`, `layout/known.ts`

**Interfaces:**
- Consumes: `openMap`, `mapPixels` (Task 1); `overlapping`, `apart`, `outsideOf`, `tooSmallToTouch`, `Box` (Task 2).
- Produces:
  - `boxes(page: Page, selector: string): Promise<Box[]>` — visible boxes only, clipped to scrolling or overflow-hidden ancestors, skipping inert subtrees.
  - `clippedText(page: Page, selector: string): Promise<string[]>`
  - `horizontalScroll(page: Page): Promise<string[]>`
  - `interface Chrome { fixed: string; map: string; panel: string; interactive: string; text: string }` — the selectors a layout's rules are applied to.
  - `checkLayout(page: Page, state: string, chrome: Chrome): Promise<void>`
  - `KNOWN: Record<string, string>` keyed `"<state>/<screen>/<rule>"`.

- [ ] **Step 1: Add measuring to `page.ts`**

Add `import type { Box } from './geometry';` to the imports at the top, then append:

```ts
/**
 * The visible part of every element matching `selector`. An element inside a
 * collapsed or scrolled container still has a full bounding rect, so each is
 * cut to the ancestors that clip it; what is left of it is what the reader can
 * see and touch.
 */
export async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      if (el.closest('[inert]')) return [];
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return [];
      }
      let { left, top, right, bottom } = el.getBoundingClientRect();
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.opacity === '0' || s.visibility === 'hidden') return [];
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const r = a.getBoundingClientRect();
        left = Math.max(left, r.left);
        top = Math.max(top, r.top);
        right = Math.min(right, r.right);
        bottom = Math.min(bottom, r.bottom);
      }
      if (right - left < 1 || bottom - top < 1) return [];
      const name = el.id
        ? `#${el.id}`
        : el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
      return [{ name, x: left, y: top, width: right - left, height: bottom - top }];
    }),
  );
}

/** Elements whose text is wider than their box: cut off, or spilling out. */
export async function clippedText(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      const h = el as HTMLElement;
      if (h.closest('[inert]') || h.getClientRects().length === 0 || !h.textContent?.trim()) return [];
      return h.scrollWidth > h.clientWidth + 1
        ? [`${h.id ? '#' + h.id : h.className || h.tagName} needs ${h.scrollWidth}px, has ${h.clientWidth}`]
        : [];
    }),
  );
}

export async function horizontalScroll(page: Page): Promise<string[]> {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  return scroll > width ? [`the page is ${scroll}px wide on a ${width}px screen`] : [];
}
```

- [ ] **Step 2: Write `known.ts`, empty**

```ts
/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>", each with
 * the reason it is accepted. A listed failure that stops happening fails the
 * run, so remove it when it is fixed.
 */
export const KNOWN: Record<string, string> = {};
```

- [ ] **Step 3: Write `check.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { apart, outsideOf, overlapping, tooSmallToTouch } from './geometry';
import { KNOWN } from './known';
import { boxes, clippedText, horizontalScroll } from './page';

/** The selectors the rules measure, which belong to the layout being tested. */
export interface Chrome {
  /** Fixed-position chrome that must not overlap itself. */
  fixed: string;
  map: string;
  panel: string;
  interactive: string;
  text: string;
}

const TOUCH_MIN = 44;

export async function checkLayout(page: Page, state: string, chrome: Chrome): Promise<void> {
  const info = test.info();
  const screen = page.viewportSize()!;
  const touch = Boolean(info.project.use.hasTouch);

  const rules: Record<string, () => Promise<string[]>> = {
    'no-horizontal-scroll': () => horizontalScroll(page),
    'chrome-in-viewport': async () =>
      outsideOf(
        [...(await boxes(page, chrome.fixed)), ...(await boxes(page, chrome.interactive))],
        { x: 0, y: 0, ...screen },
      ),
    'chrome-apart': async () => overlapping(await boxes(page, chrome.fixed)),
    'map-clear-of-panel': async () =>
      apart(await boxes(page, chrome.map), await boxes(page, chrome.panel)),
    'text-not-clipped': () => clippedText(page, chrome.text),
    ...(touch && {
      'touch-targets': async () =>
        tooSmallToTouch(await boxes(page, chrome.interactive), TOUCH_MIN),
    }),
  };

  for (const [rule, measure] of Object.entries(rules)) {
    const key = `${state}/${info.project.name}/${rule}`;
    const violations = await measure();
    const known = KNOWN[key];
    if (known && violations.length) {
      info.annotations.push({ type: 'known layout defect', description: `${key}: ${known}` });
    } else if (known) {
      expect.soft(violations, `${key} is listed in known.ts but passes: remove it`).not.toEqual([]);
    } else {
      expect.soft(violations, key).toEqual([]);
    }
  }
}
```

- [ ] **Step 4: Write the states spec**

Replace `layout/app.spec.ts` with:

```ts
import { expect, test, type Page } from '@playwright/test';
import { checkLayout, type Chrome } from './check';
import { mapPixels, openMap } from './page';

// Today's panel, story strip and footer (index.html, src/styles/right-panel.css).
const CHROME: Chrome = {
  fixed: '#right-panel, #zoom-controls, #verse-popup.visible',
  map: '#canvas',
  panel: '#right-panel',
  interactive:
    '#right-panel button, #right-panel select, #right-panel input, #right-panel a, ' +
    '#verse-popup button, #verse-popup a, #zoom-controls button',
  text: '#controls-summary, #story-strip-title, .footer-link, #right-panel label, #verse-popup .ref-text',
};

interface State {
  name: string;
  hash: string;
  then?: (page: Page) => Promise<void>;
}

const STATES: State[] = [
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

test('the map renders more than one colour with an overlay on', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  expect((await mapPixels(page)).colours).toBeGreaterThanOrEqual(8);
});

test('the title face loads', async ({ page }) => {
  await openMap(page, 'story=intro');
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 32px "David Libre"');
  });
  expect(loaded, 'David Libre comes from Google Fonts, so this needs the network').toBe(true);
});
```

- [ ] **Step 5: Check the story stop exists**

Run: `grep -n "stop: abraham_call" public/data/story.md`
Expected: one line. If not, pick another stop that pins a verse from `grep -n "verse:" public/data/story.md` and use its id.

- [ ] **Step 6: Run everything and collect the failures**

Run: `npm run test:layout 2>&1 | tee test-results/first-run.txt`
Expected: some failures on today's interface. Each soft failure prints its key (`state/screen/rule`) and its violations.

- [ ] **Step 7: Prove each rule can fail on purpose**

For each rule, confirm at least one real failure appeared in Step 6, or make one: e.g. temporarily set `TOUCH_MIN = 400` and confirm `touch-targets` fails on `phone`; temporarily add `#canvas` to `fixed` and confirm `chrome-apart` fails. Revert each. A rule that cannot be made to fail is not measuring anything — fix it before going on.

- [ ] **Step 8: Stop and review the failures with Danyel**

Do not edit `known.ts` alone. Write the list of failing keys and their violation text into the PR description draft, grouped by rule, and ask Danyel which are real defects of today's interface and which mean a rule is wrong. Only then:
- a real defect that the frame replaces goes into `KNOWN` with a one-line reason;
- a rule that is wrong is fixed in `check.ts` or `geometry.ts`, with a test in `geometry.spec.ts` when the fix is in the geometry.

- [ ] **Step 9: Run clean and commit**

Run: `npm run test:layout`
Expected: all pass, with known defects listed as annotations.

Run: `npm run typecheck`
Expected: no errors.

```bash
git add layout/
git commit -m "Layout tests: every state of the interface at every screen size

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A contact sheet of every state at every size

**Files:**
- Create: `layout/contactSheet.ts`
- Modify: `layout/playwright.config.ts` (restore the reporter line)

**Interfaces:**
- Consumes: attachments named `layout` (Task 3), annotations of type `known layout defect` (Task 3).
- Produces: `layout-report/index.html`, self-contained with `layout-report/shots/*.png`.

- [ ] **Step 1: Write the reporter**

```ts
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface Cell {
  shot: string;
  failures: string[];
  known: string[];
}

/** Writes every layout screenshot as a grid: states down, screen sizes across. */
export default class ContactSheet implements Reporter {
  private readonly dir: string;
  private readonly cells = new Map<string, Map<string, Cell>>();
  private readonly screens: string[] = [];

  constructor(options: { outputDir: string }) {
    this.dir = options.outputDir;
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
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

- [ ] **Step 2: Restore the reporter line in the config**

```ts
  reporter: [['list'], ['./contactSheet.ts', { outputDir: '../layout-report' }]],
```

- [ ] **Step 3: Run and open it**

Run: `npm run test:layout`
Expected: ends with `Contact sheet: …/layout-report/index.html`.

Run: `open layout-report/index.html`
Expected: seven rows of states, four columns of screen sizes, a screenshot in each cell, known defects in yellow under the cells they belong to. Read two or three screenshots at full size: the map has coloured squares in them, and the Hebrew title is in David Libre rather than a fallback serif.

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add layout/contactSheet.ts layout/playwright.config.ts
git commit -m "Layout tests write a contact sheet: states down, screen sizes across

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
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
the map with software WebGL, and checks every state in `layout/app.spec.ts`
against rules any good layout keeps: nothing off screen or overlapping, no
clipped text, touch targets large enough for a thumb, and a map that actually
drew. `layout/known.ts` lists the failures accepted for now and why. It ends by
writing `layout-report/index.html`, every state at every size side by side.

It takes about a minute, so the pre-commit hook does not run it. Run it before
opening any pull request that changes the interface.
````

The Test Harness paragraph says the harness is for headless browsers "where WebGL is unavailable". Change that sentence to:

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

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
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

- **Spec coverage.** The design's Testing bullet asks for the frame's states to be driven and looked at in a real browser, with state kept in vitest. This plan builds the browser half against today's interface; the frame plan adds the frame's states to `app.spec.ts` and its `CHROME` selectors. The vitest half is unchanged and belongs to the frame plan.
- **Placeholders.** The PR body in Task 5 is described rather than written, because it lists the known defects Task 3 has not yet measured. Everything else is literal.
- **Names.** `openMap`, `mapPixels`, `boxes`, `clippedText`, `horizontalScroll`, `checkLayout`, `Chrome`, `KNOWN`, `overlapping`, `apart`, `outsideOf`, `tooSmallToTouch`, `Box`, `Rect` are each defined once and used with the same signatures throughout.
