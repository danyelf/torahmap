# Story panel implementation plan

**Status:** Built, then revised. Tasks 1, 2, 4 and 5 stand as written. The
fixed band of Tasks 3, 6 and 7, and the × and Show the story, were replaced by
the accordion the revised spec describes. What was built instead:

- `index.html`: `#controls-toggle` (the summary line, styled as a field),
  `#panel-controls`, `#story-strip` (the folded story's title) and
  `#story-content`, placed on the rows of a grid. `right-panel.css` swaps the
  two opening rows between `0fr` and `1fr`, so the accordion animates in CSS.
- `src/panelSummary.ts`: the summary from the overlay's name, its URL
  settings, search's `.term-swatch` colours and the backgrounds its legend
  drew. The `Overlay` interface is unchanged.
- `main.ts`: `storyOpen` and `setStoryOpen` replace `storyShown`.
  `openControls` folds the story and hands the reader the map; `openStory`
  eases back once the story has finished opening. The fold is remembered under
  `torahMap.storyFolded`, only from the reader's own taps.
- Search results fill the open controls in their own scroll; other overlays'
  controls keep their height and the column scrolls.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The right panel stops swapping between a story and a control panel.
The controls sit in a fixed band above the story, which drives them until the
reader touches something; a deliberate scroll eases the reader back.

**Architecture:** `index.html` gets one panel with three zones: controls band,
story section, footer. `src/scrollytelling/modeSwitch.ts` and `AppMode` go; in
their place a pure state machine, `src/scrollytelling/driver.ts`, says who is
driving the map — the story, the reader, or the story easing back — and
`main.ts` consults it from the scroll handler it already has. The ease-back
reuses the story's own interpolation (`lerpCamera`, `blendColorArrays`); at
rest the story still paints through the explore-mode colour path
(`applyOverlay`), so there is still one colour pipeline.

**Tech Stack:** TypeScript, Vite, vitest with happy-dom, WebGL 2. No runtime
dependencies.

**Spec:** `docs/plans/2026-09-17-story-panel-design.md` (as of `5630d02`). Read
it first; this plan argues from it and does not repeat its reasons.

## Global Constraints

- **Worktree.** Work on branch `worktree-story-panel-design` in
  `.claude/worktrees/story-panel-design`, never the primary checkout.
- **Every commit runs the gate.** The pre-commit hook runs Prettier's check,
  `npm run typecheck` and the full suite (about six seconds). Run
  `npm run format` before committing.
- **No runtime dependencies. No `@ts-ignore`.**
- **No ticket or stage references in code, comments or test names.** Describe
  behaviour. Issue numbers go in commit messages.
- **Comments describe the code as it is now.** Not what it used to do.
- **Panel width:** 380px, from one `--panel-width` custom property.
- **Band heights:** desktop about 225px, phone about 90px, both unmeasured
  until Task 7. Put them in `--band-height` and nowhere else.
- **Rejoin numbers:** 60px of scrolled distance, 700ms ease-back. Both are
  guesses to be tuned in Task 7; each lives in one named constant.
- **Hover never takes the wheel.** Clicking a verse to pin it does.
- **Mobile is `max-width: 768px`**, the breakpoint the stylesheets already use.
- **Verify in a browser, not by reading the diff.** Start your own dev server
  (`npm run dev`; Vite picks a free port — read it from the output, and never
  touch a server you did not start). The Chrome extension's window resize does
  not change the viewport; measure the phone layout inside a 390×844 iframe on
  the dev server's page, where the media queries respond to the iframe.
- **UI work is not finished until Danyel has looked at it.** Task 8 is that.

---

### Task 1: One panel width, and no zoom buttons on a phone

The panel's width is written three times: `380px` in `#right-panel` and in
the `#canvas` width `calc`, and `420px` (width plus gap) in
`#zoom-controls`. On a phone the zoom buttons move to `bottom: 60px`, which
puts them on top of the panel sheet, 286px below the map; pinch already zooms.

**Files:**
- Modify: `src/styles/right-panel.css` (`#right-panel`, `#canvas`)
- Modify: `src/styles/zoom-buttons.css`
- Modify: `src/styles/main.css` (the `:root` block, if it has one; otherwise add
  it at the top)

**Interfaces:**
- Produces: `--panel-width` on `:root`. Tasks 3 and 7 read it.

- [ ] **Step 1: Add the custom property**

```css
/* main.css */
:root {
  --panel-width: 380px;
}
```

- [ ] **Step 2: Read it in all three places**

```css
/* right-panel.css */
#right-panel {
  /* … */
  width: var(--panel-width);
}

#canvas {
  /* … */
  width: calc(100vw - var(--panel-width));
}
```

```css
/* zoom-buttons.css */
#zoom-controls {
  position: fixed;
  bottom: 20px;
  right: calc(var(--panel-width) + 40px);
  /* … */
}

/* Pinch zooms on a phone, and there the buttons would sit on the panel sheet. */
@media (max-width: 768px) {
  #zoom-controls {
    display: none;
  }
}
```

The `+ 40px` keeps today's position exactly (`420 - 380`). The media query
replaces the existing one, which only moved the buttons.

- [ ] **Step 3: Verify in the browser**

Start the dev server and load it. On desktop, check the buttons sit where they
did: `document.getElementById('zoom-controls').getBoundingClientRect().right`
should equal `innerWidth - 420`. In a 390×844 iframe of the same page, check
`getComputedStyle(zoomControls).display === 'none'`.

- [ ] **Step 4: Commit**

```bash
git add src/styles/main.css src/styles/right-panel.css src/styles/zoom-buttons.css
git commit -m "Read the panel width from one place; hide zoom buttons on a phone"
```

---

### Task 2: Help opens from the panel footer, never by itself

`initHelp()` hangs a 24px `?` off the panel corner (`top: -8px; right: -8px`,
clipped by the screen edge on a phone) and opens the modal on a first visit.
The story is the front door now. The modal stays — its Credits tab is owed to
Sefaria, ETCBC and hebcal — reached from a labelled control in a footer.

Once nothing opens the modal automatically, `torahMap.helpSeen` has no reader.
Remove it rather than keep writing a key nothing checks.

**Files:**
- Modify: `index.html` (add `#panel-footer` as the last child of
  `#right-panel`)
- Modify: `src/help.ts` (`initHelp`, `hideHelp`, `STORAGE_KEY_SEEN`)
- Modify: `src/styles/help.css` (`#help-btn` rules become `#about-btn`)
- Modify: `src/styles/right-panel.css` (`#story-panel` and `#explore-panel`
  from `height: 100%` to `flex: 1; min-height: 0`, so the footer fits)
- Modify: `src/main.ts` (the `initHelp(rightPanel)` call, around line 700)
- Test: `src/__tests__/unit/help.test.ts`

**Interfaces:**
- Produces: `initHelp(footer: HTMLElement): void` — appends a button reading
  "About & credits" with id `about-btn`, and does not open the modal.
  `#panel-footer` exists in `index.html` and is what Task 3 keeps.

- [ ] **Step 1: Rewrite the first-visit test to the new behaviour**

In `help.test.ts`, `openHelp()` relies on the modal opening itself. Make it
click the button instead, and replace the first test:

```ts
async function openHelp(): Promise<HTMLElement> {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();

  const { initHelp } = await import('../../help');

  const { registerAllOverlays } = await import('../../overlays/index');
  registerAllOverlays();
  const footer = document.createElement('div');
  document.body.appendChild(footer);
  initHelp(footer);

  footer.querySelector<HTMLButtonElement>('#about-btn')!.click();
  return document.getElementById('help-modal') as HTMLElement;
}
```

```ts
describe('help modal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays closed on a first visit', async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    const { initHelp } = await import('../../help');
    const footer = document.createElement('div');
    document.body.appendChild(footer);

    initHelp(footer);

    const modal = document.getElementById('help-modal');
    expect(modal === null || !modal.classList.contains('visible')).toBe(true);
  });

  it('opens from a labelled control and offers a Credits tab', async () => {
    const modal = await openHelp();

    expect(modal.classList.contains('visible')).toBe(true);
    expect(modal.querySelector('.help-tab[data-tab="credits"]')).not.toBeNull();
  });

  it('labels its control in words, not a question mark', async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    const { initHelp } = await import('../../help');
    const footer = document.createElement('div');
    initHelp(footer);

    expect(footer.querySelector('#about-btn')?.textContent).toBe('About & credits');
  });

  // 'remembers which tab was last open' stays as it is.
});
```

Also update the comment on `openHelp` that says "With nothing seen yet,
initHelp opens the modal itself" — it no longer does.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/unit/help.test.ts`
Expected: FAIL — `#about-btn` is null, and the modal is visible on a first visit.

- [ ] **Step 3: Change `initHelp` and drop the seen key**

```ts
// help.ts
export function initHelp(footer: HTMLElement): void {
  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-btn';
  aboutBtn.type = 'button';
  aboutBtn.textContent = 'About & credits';
  aboutBtn.addEventListener('click', showHelp);
  footer.appendChild(aboutBtn);
}

function hideHelp(): void {
  modal?.classList.remove('visible');
}
```

Delete `STORAGE_KEY_SEEN`.

- [ ] **Step 4: Add the footer and restyle the control**

```html
<!-- index.html, last child of #right-panel -->
<footer id="panel-footer"></footer>
```

```css
/* right-panel.css */
#story-panel,
#explore-panel {
  flex: 1;
  min-height: 0;
}

#panel-footer {
  flex-shrink: 0;
  padding: 10px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
```

```css
/* help.css — replaces the #help-btn rules */
#about-btn {
  background: none;
  border: none;
  padding: 0;
  color: #6ab0f3;
  font-size: 13px;
  cursor: pointer;
}

#about-btn:hover {
  color: #9cd;
  text-decoration: underline;
}
```

```ts
// main.ts, replacing the rightPanel/initHelp block
const panelFooter = document.getElementById('panel-footer');
if (panelFooter) initHelp(panelFooter);
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/unit/help.test.ts`
Expected: PASS

- [ ] **Step 6: Verify in the browser**

With `localStorage` cleared, load the app: no modal. The footer shows "About &
credits" at the bottom of the panel in both story and explore modes, and
clicking it opens the modal. In the 390×844 iframe, the control is fully on
screen. Record the footer's measured height on a phone — Task 7 needs it.

- [ ] **Step 7: Commit**

```bash
git add index.html src/help.ts src/styles/help.css src/styles/right-panel.css src/main.ts src/__tests__/unit/help.test.ts
git commit -m "Open help from an About & credits link, never by itself"
```

---

### Task 3: One panel — controls above the story, the story put away with ×

This is the structural change. The controls stop living inside
`#explore-panel`; they sit in a band at the top of `#right-panel` in every
state, so the reader sees the picker and the legend while the story drives
them. `modeSwitch.ts` and `AppMode` go. In their place `main.ts` holds one
boolean, whether the story is shown.

This task does not yet change *who drives*: while the story is shown it drives
exactly as it does today, and putting it away is today's "Explore freely".
Task 5 adds taking the wheel.

**A defect this exposes.** `syncStoryStopStateUnguarded()` calls
`activateOverlay()` but never sets `overlaySelect.value`. It never mattered,
because the picker was hidden during the story. Now it is the thing the reader
is meant to watch, so the story must move it.

**Files:**
- Modify: `index.html` (`#right-panel` contents)
- Modify: `src/styles/right-panel.css`
- Delete: `src/scrollytelling/modeSwitch.ts`
- Modify: `src/main.ts` (the `appMode` declaration around line 207; the
  `exit-story`/`back-to-story` handlers around lines 757–774; the scroll
  handler's `appMode` guard at 777; the resize handler at 821;
  `restoreFromUrlUnguarded` at 884–901; `syncStoryStopStateUnguarded` at 169)

**Interfaces:**
- Consumes: `#panel-footer` from Task 2; `--panel-width` from Task 1.
- Produces, in `main.ts`: `let storyShown: boolean` and
  `function setStoryShown(shown: boolean): void`, which toggles the
  `story-hidden` class on `document.body`. Tasks 5 and 6 call it. The DOM ids
  `panel-controls`, `overlay-summary`, `overlay-controls`, `overlay-legend`,
  `overlay-legend-summary`, `story-section`, `story-content`, `hide-story`,
  `show-story`. Tasks 5–7 rely on them.

- [ ] **Step 1: Replace the panel markup**

```html
<div id="right-panel">
  <div id="panel-controls">
    <div class="panel-picker">
      <label for="overlay-select">Overlay</label>
      <!-- The overlays themselves are added here at startup, from the
         registry. Do not list them: that is what the registry is for. -->
      <select id="overlay-select">
        <option value="none">None</option>
      </select>
    </div>
    <div id="overlay-summary"></div>
    <div id="overlay-controls"></div>
    <div id="overlay-legend"></div>
    <div id="overlay-legend-summary"></div>
  </div>

  <section id="story-section">
    <button id="hide-story" type="button" aria-label="Hide the story">&times;</button>
    <div id="story-content"></div>
  </section>

  <button id="show-story" type="button">Show the story</button>

  <footer id="panel-footer"></footer>
</div>
```

`#overlay-summary` and `#overlay-legend-summary` stay empty until Tasks 6 and
7 fill them.

- [ ] **Step 2: Lay the panel out as one column**

Replace the `#story-panel`, `.story-header`, `#exit-story`, `#explore-panel`,
`.explore-header`, `.explore-footer` and `#back-to-story` rules. Keep
`.story-stop` and its children, and rename the `#explore-panel select` rule to
`#panel-controls select` (its comment still holds).

```css
:root {
  --band-height: 225px;
}

#panel-controls {
  flex-shrink: 0;
  height: var(--band-height);
  overflow-y: auto;
  padding: 14px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* With the story put away the controls have the column to themselves. */
body.story-hidden #panel-controls {
  flex: 1;
  height: auto;
  border-bottom: none;
}

.panel-picker label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #aaa;
}

.panel-picker select {
  width: 100%;
}

#story-section {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

body.story-hidden #story-section {
  display: none;
}

#hide-story {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 1;
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

#hide-story:hover {
  color: #fff;
}

#story-content {
  flex: 1;
  overflow-y: auto;
}

#show-story {
  display: none;
  flex-shrink: 0;
  margin: 10px 20px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #aaa;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

body.story-hidden #show-story {
  display: block;
}

@media (max-width: 768px) {
  :root {
    --band-height: 90px;
  }
}
```

The `@media (max-width: 768px)` block for `#right-panel` and `#canvas` stays.

- [ ] **Step 3: Replace the mode with a boolean**

In `main.ts`, delete the `modeSwitch` import and `let appMode: AppMode = 'story'`,
and add:

```ts
// Whether the story section is showing. With it put away the controls have the
// panel to themselves and nothing scrolls the map but the reader.
let storyShown = true;

function setStoryShown(shown: boolean): void {
  storyShown = shown;
  document.body.classList.toggle('story-hidden', !shown);
}
```

Replace the two handlers:

```ts
document.getElementById('hide-story')?.addEventListener('click', () => {
  lastStoryScrollTop = storyContent.scrollTop;
  setStoryShown(false);
  saveUrlState(true);
});

document.getElementById('show-story')?.addEventListener('click', () => {
  // The reader may have changed the overlay or pin while the story was away,
  // so the next settled frame has to re-apply the resting stop's state.
  lastSyncedStopId = null;
  setStoryShown(true);
  storyContent.scrollTop = lastStoryScrollTop;
  storyContent.dispatchEvent(new Event('scroll'));
});
```

Every `appMode !== 'story'` becomes `!storyShown`, and every
`appMode === 'story'` becomes `storyShown`. In `restoreFromUrlUnguarded`,
`appMode = 'story'; switchToStory(…, 0)` becomes `setStoryShown(true);
storyContent.scrollTop = 0;` and `appMode = 'explore'; switchToExplore(…)`
becomes `setStoryShown(false);`.

Delete `src/scrollytelling/modeSwitch.ts`. Nothing else imports it (check with
`grep -rn modeSwitch src`).

- [ ] **Step 4: Make the story move the picker**

In `syncStoryStopStateUnguarded`, right after `activateOverlay(wantedOverlay)`:

```ts
if (overlaySelect) overlaySelect.value = wantedOverlay;
```

`overlaySelect` is declared later in `main()` than this function. Both are
inside `main()` and the function only runs after startup, so the reference is
fine at runtime. If the typechecker objects to use-before-declaration, move the
`overlaySelect` declaration above `syncStoryStopState`.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. No test references the removed ids (`story-panel`,
`explore-panel`, `exit-story`, `back-to-story`); confirm with
`grep -rn "explore-panel\|story-panel\|exit-story\|back-to-story" src test-harness index.html`
returning nothing.

- [ ] **Step 6: Verify in the browser**

Load the app and scroll the story from the top to the end. Check:
- The picker reads None, then Text Search at "The Call", Haftarah at "The
  Pairing", Commentary at "How to Read a Verse".
- The legend is visible at the two commentary stops.
- The story's top edge does not move between stops:
  `document.getElementById('story-section').getBoundingClientRect().top` is the
  same at every stop.
- × hides the story, the controls take the column, "Show the story" appears;
  pressing it returns to the same place in the story.
- `#overlay=haftarah` hard-loaded opens with the story put away. `#story=intro`
  opens with it shown.
- In the 390×844 iframe: the sheet holds the band, the story, and the footer,
  and nothing overlaps.

- [ ] **Step 7: Commit**

```bash
git add index.html src/styles/right-panel.css src/main.ts
git rm src/scrollytelling/modeSwitch.ts
git commit -m "Keep the controls above the story instead of swapping them out"
```

---

### Task 4: Who is driving, as a pure state machine

The rules for taking the wheel and rejoining, with no DOM and no clock of their
own, so they can be tested exactly.

The threshold counts scrolled distance, not scroll events. A trackpad fires
many small events where a wheel fires few large ones; counting events would
make the threshold a different number on different hardware.

**Files:**
- Create: `src/scrollytelling/driver.ts`
- Test: `src/scrollytelling/__tests__/driver.test.ts`

**Interfaces:**
- Consumes: `ResolvedStoryStop`, `CameraPosition` from
  `src/scrollytelling/types.ts`.
- Produces:

```ts
export const REJOIN_SCROLL_PX: number; // 60
export const REJOIN_EASE_MS: number; // 700
export type Driver =
  | { by: 'story' }
  | { by: 'reader'; lastScrollTop: number; travelled: number }
  | { by: 'rejoining'; since: number };
export const STORY_DRIVING: Driver;
export function readerTakesOver(scrollTop: number): Driver;
export function storyScrolled(driver: Driver, scrollTop: number, now: number): Driver;
export function rejoinNow(now: number): Driver;
export function rejoinProgress(driver: Driver, now: number): number;
export function settle(driver: Driver, now: number): Driver;
export function readerAsStop(
  camera: CameraPosition,
  overlayId: string,
  params: Record<string, string>,
): ResolvedStoryStop;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  REJOIN_SCROLL_PX,
  REJOIN_EASE_MS,
  STORY_DRIVING,
  readerTakesOver,
  storyScrolled,
  rejoinNow,
  rejoinProgress,
  settle,
  readerAsStop,
} from '../driver';

describe('the story drives until the reader takes over', () => {
  it('ignores scrolling while the story is already driving', () => {
    expect(storyScrolled(STORY_DRIVING, 500, 0)).toBe(STORY_DRIVING);
  });

  it('keeps the reader driving through a nudge', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1020, 0);
    driver = storyScrolled(driver, 1045, 0);

    expect(driver.by).toBe('reader');
  });

  it('hands back once the reader has scrolled the threshold', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1000 + REJOIN_SCROLL_PX, 42);

    expect(driver).toEqual({ by: 'rejoining', since: 42 });
  });

  it('measures distance, so many small scrolls count the same as one large one', () => {
    let small = readerTakesOver(0);
    for (let top = 5; top <= REJOIN_SCROLL_PX; top += 5) small = storyScrolled(small, top, 0);

    const large = storyScrolled(readerTakesOver(0), REJOIN_SCROLL_PX, 0);

    expect(small.by).toBe('rejoining');
    expect(large.by).toBe('rejoining');
  });

  it('counts scrolling back up as distance too', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1000 - REJOIN_SCROLL_PX / 2, 0);
    driver = storyScrolled(driver, 1000, 0);

    expect(driver.by).toBe('rejoining');
  });

  it('lets the reader take over again in the middle of an ease-back', () => {
    const driver = readerTakesOver(700);

    expect(driver).toEqual({ by: 'reader', lastScrollTop: 700, travelled: 0 });
  });
});

describe('easing back', () => {
  it('runs from 0 to 1 over the ease-back time', () => {
    const driver = rejoinNow(1000);

    expect(rejoinProgress(driver, 1000)).toBe(0);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS / 2)).toBeCloseTo(0.5);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS * 2)).toBe(1);
  });

  it('hands the map back to the story when it finishes', () => {
    const driver = rejoinNow(0);

    expect(settle(driver, REJOIN_EASE_MS - 1).by).toBe('rejoining');
    expect(settle(driver, REJOIN_EASE_MS)).toEqual(STORY_DRIVING);
  });

  it('leaves the reader alone', () => {
    const driver = readerTakesOver(0);

    expect(settle(driver, 10_000)).toBe(driver);
  });
});

describe('readerAsStop', () => {
  it('describes what the reader has on screen the way a story stop would', () => {
    const stop = readerAsStop({ x: 1, y: 2, zoom: 3 }, 'search', { q: 'אברם' });

    expect(stop.camera).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(stop.overlay).toBe('search');
    expect(stop.overlayParams).toEqual({ q: 'אברם' });
  });

  it('treats no overlay as no overlay', () => {
    expect(readerAsStop({ x: 0, y: 0, zoom: 1 }, 'none', {}).overlay).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/scrollytelling/__tests__/driver.test.ts`
Expected: FAIL — cannot resolve `../driver`.

- [ ] **Step 3: Write the module**

```ts
// Who is moving the map: the story, the reader, or the story easing the map
// back from wherever the reader left it.

import type { CameraPosition, ResolvedStoryStop } from './types';

/**
 * How far the reader must scroll the story, while driving, before the story
 * takes the map back. A trackpad nudge over the panel should not undo a view
 * the reader just built. A guess, awaiting tuning against the real app.
 */
export const REJOIN_SCROLL_PX = 60;

/** How long the story takes to ease the map back. A guess, awaiting tuning. */
export const REJOIN_EASE_MS = 700;

export type Driver =
  | { by: 'story' }
  | { by: 'reader'; lastScrollTop: number; travelled: number }
  | { by: 'rejoining'; since: number };

export const STORY_DRIVING: Driver = { by: 'story' };

export function readerTakesOver(scrollTop: number): Driver {
  return { by: 'reader', lastScrollTop: scrollTop, travelled: 0 };
}

export function rejoinNow(now: number): Driver {
  return { by: 'rejoining', since: now };
}

/**
 * Distance, not event count: a trackpad fires many small scroll events where a
 * wheel fires few large ones.
 */
export function storyScrolled(driver: Driver, scrollTop: number, now: number): Driver {
  if (driver.by !== 'reader') return driver;

  const travelled = driver.travelled + Math.abs(scrollTop - driver.lastScrollTop);
  if (travelled >= REJOIN_SCROLL_PX) return rejoinNow(now);
  return { by: 'reader', lastScrollTop: scrollTop, travelled };
}

/** How far through the ease-back, 0 to 1. Only meaningful while rejoining. */
export function rejoinProgress(driver: Driver, now: number): number {
  if (driver.by !== 'rejoining') return 1;
  return Math.min(1, Math.max(0, (now - driver.since) / REJOIN_EASE_MS));
}

export function settle(driver: Driver, now: number): Driver {
  return driver.by === 'rejoining' && rejoinProgress(driver, now) >= 1 ? STORY_DRIVING : driver;
}

/** The reader's view as a story stop, so the story's own blending can start from it. */
export function readerAsStop(
  camera: CameraPosition,
  overlayId: string,
  params: Record<string, string>,
): ResolvedStoryStop {
  return {
    id: 'reader',
    title: '',
    text: '',
    camera: { ...camera },
    overlay: overlayId === 'none' ? null : overlayId,
    overlayParams: params,
  };
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/scrollytelling/__tests__/driver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrollytelling/driver.ts src/scrollytelling/__tests__/driver.test.ts
git commit -m "Say who is driving the map as a pure state machine"
```

---

### Task 5: Taking the wheel, and easing back

Wire Task 4 into `main.ts`. Touching a control, or dragging, zooming, pinching
or clicking a verse on the map, makes the reader the driver. While the reader
drives, story scrolls only count towards the threshold. Crossing it starts a
700ms ease from the reader's view to the story's, then the story drives again.

**How the ease-back paints.** Both colour arrays are computed once when the
ease-back starts: the reader's (from `readerAsStop`) and the story's at the
stop the scroll position is on. Each frame then blends them with
`blendColorArrays`, and lerps the camera from the reader's view to the story's
current camera. Computing them every frame would re-run the overlays' colouring
— for search, a search — sixty times a second. When the ease-back finishes,
`lastSyncedStopId = null` makes the next frame re-sync overlay, params and pin
through `syncStoryStopState`, and painting returns to `applyOverlay()`. There is
still one colour pipeline: at rest the story paints through `applyOverlay()`, as
it does today.

**Files:**
- Modify: `src/scrollytelling/overlayBlender.ts` (export `colorsForStop`)
- Modify: `src/main.ts`
- Test: `src/scrollytelling/__tests__/overlayBlender.test.ts` (one test)

**Interfaces:**
- Consumes: everything from Task 4; `setStoryShown`, `storyShown` from Task 3;
  `blendColorArrays` from `colorBlending.ts`; `lerpCamera`, `easingFunctions`
  from `interpolation.ts`.
- Produces: `function takeOver(): void` in `main.ts`. Task 6 calls it.

- [ ] **Step 1: Export the per-stop colours, with a test**

Rename `getColorsForStop` to `colorsForStop` and export it. Add to
`overlayBlender.test.ts`, inside the existing `describe`, whose `beforeEach`
registers the `test-stipple` overlay:

```ts
it('gives a stop the same colours whether asked directly or as a zero blend', () => {
  const stop: ResolvedStoryStop = {
    id: 's1',
    title: 'S',
    text: '',
    camera: { x: 0, y: 0, zoom: 1 },
    overlay: 'test-stipple',
  };

  expect(colorsForStop(stop, verses)).toEqual(computeBlendedColors(stop, stop, 0, verses));
});
```

Run: `npx vitest run src/scrollytelling/__tests__/overlayBlender.test.ts`
Expected: FAIL, then PASS after the export.

- [ ] **Step 2: Hold the driver in `main.ts`**

Next to `storyShown`:

```ts
let driver: Driver = STORY_DRIVING;

// Captured when an ease-back starts; see paintStoryFrame.
let rejoin: {
  fromCamera: CameraPosition;
  fromColors: (Color | Color[])[];
  toColors: (Color | Color[])[];
} | null = null;

function takeOver(): void {
  if (!storyShown || driver.by === 'reader') return;
  driver = readerTakesOver(storyContent.scrollTop);
  rejoin = null;
  saveUrlState(true);
}
```

`storyContent` is declared later in `main()`. As with `overlaySelect` in Task
3, move its declaration up if the typechecker objects.

- [ ] **Step 3: Call it from every gesture that changes what is shown**

- The canvas `wheel` handler, first line.
- The zoom buttons' two `click` handlers, first line.
- The canvas `pointermove` drag branch (`if (mouseState.isDragging && …)`),
  first line inside it. Not `pointerdown`: a tap that pins is handled next.
- The `pointerup` tap branch, before `pinVerse`/`unpinVerse`.
- The `touchmove` pinch branch (`activeTouches.size >= 2`), first line.
- The `keydown` handler, after the `if (!pinnedVerse) return;` guard.
- The word menu's `onChoose`, first line.
- The controls band, by delegation, so overlays added later take the wheel
  without knowing about it:

```ts
// Anything the reader does to a control hands them the map. Events the story
// causes are not DOM events, so only the reader's own reach this.
const panelControls = document.getElementById('panel-controls');
for (const type of ['input', 'change', 'click'] as const) {
  panelControls?.addEventListener(type, takeOver);
}
```

Hover — the non-dragging `pointermove` handler — does not call it.

- [ ] **Step 4: Split the scroll handler into a frame function that knows about the driver**

Replace the body of the `storyContent` scroll listener:

```ts
let storyFrame: number | null = null;

function scheduleStoryFrame(): void {
  if (storyFrame === null) storyFrame = requestAnimationFrame(paintStoryFrame);
}

storyContent.addEventListener('scroll', () => {
  if (!storyShown) return;

  const before = driver.by;
  driver = storyScrolled(driver, storyContent.scrollTop, performance.now());
  if (driver.by === 'reader') return;
  if (before === 'reader') beginRejoin();
  scheduleStoryFrame();
});

function beginRejoin(): void {
  const state = currentStoryState();
  const toStop = state.fromStop === state.toStop || state.t <= 0.5 ? state.fromStop : state.toStop;
  const fromStop = readerAsStop(
    { x: camera.x, y: camera.y, zoom: camera.zoom },
    currentOverlayId,
    currentOverlay?.getUrlParams?.() ?? {},
  );
  rejoin = {
    fromCamera: { ...fromStop.camera },
    fromColors: colorsForStop(fromStop, verses),
    toColors: colorsForStop(toStop, verses),
  };
}

function currentStoryState(): InterpolatedState {
  return computeInterpolatedState(
    resolvedStops,
    computeStopOffsets(stopElements),
    storyContent.scrollHeight,
    storyContent.scrollTop,
    storyData.defaults?.easing ?? 'ease-in-out',
    stopElements.map((el) => el.offsetHeight),
    storyContent.clientHeight,
  );
}

function paintStoryFrame(now: number): void {
  storyFrame = null;

  const wasRejoining = driver.by === 'rejoining';
  driver = settle(driver, now);
  if (wasRejoining && driver.by === 'story') {
    rejoin = null;
    lastSyncedStopId = null;
  }

  const state = currentStoryState();

  if (driver.by === 'rejoining' && rejoin) {
    const t = easingFunctions['ease-in-out'](rejoinProgress(driver, now));
    Object.assign(camera, lerpCamera(rejoin.fromCamera, state.camera, t));
    rebuildGeometry(
      renderContext.gl,
      renderState,
      blendColorArrays(rejoin.fromColors, rejoin.toColors, t),
    );
    render();
    scheduleStoryFrame();
    return;
  }

  // …the existing body from `camera.x = state.camera.x;` through
  // `updateUrl({ story: dominantStop.id, overlayParams: {} }, false);`,
  // unchanged.
}
```

Replace every `storyContent.dispatchEvent(new Event('scroll'))` whose purpose
is to repaint (the resize handler, `reloadStory`, the end of
`restoreFromUrlUnguarded`, the show-story handler) with `scheduleStoryFrame()`.
A synthetic scroll event would now also count towards the threshold.

- [ ] **Step 5: "Show the story" eases back at once**

Danyel decided: showing the story returns the map to the story's view, as a
deliberate scroll would (`driver = rejoinNow(performance.now()); beginRejoin();`).

Also on show: `driver = …` must be set before `scheduleStoryFrame()`. On hide:
`driver = readerTakesOver(storyContent.scrollTop); rejoin = null;` so that
showing it again starts from a known state.

- [ ] **Step 6: Typecheck and run the suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS

- [ ] **Step 7: Verify in the browser**

The prototype this was designed from lives in `.superpowers/brainstorm/` in the
primary checkout; open it alongside for comparison. In the app:
- Scroll to "The Call". Drag the map: the story stops moving it; a scroll
  under 60px changes nothing; a longer scroll eases the map back to Genesis 12
  and the search colours return, over about 0.7s, then the story carries on.
- Repeat taking the wheel by: the zoom buttons, the canvas wheel, clicking a
  verse, choosing Trop in the picker, typing in the search box.
- Hovering the map during the story does not take the wheel.
- Taking the wheel writes an explore URL (`#overlay=…`), and rejoining writes
  `#story=…` again.
- Take the wheel during an ease-back: it stops where it is.

Background tabs do not run `requestAnimationFrame`, so any automated check of
the ease-back must run with the tab in front.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts src/scrollytelling/overlayBlender.ts src/scrollytelling/__tests__/overlayBlender.test.ts
git commit -m "Let the reader take the wheel; a deliberate scroll eases them back"
```

---

### Task 6: A one-line summary in place of the full controls

While the story drives, the band shows each overlay's summary — one line saying
what is selected — instead of its full controls, so the band's height does not
depend on which overlay a story uses. The trop grid is 426px; its summary is
one line. The full controls appear when the reader takes the wheel or puts the
story away. Clicking the summary is a click in the band, so it takes the wheel
through Task 5's delegation and the full controls replace it.

All four containers are always rendered; CSS decides which show. Search keeps
its state in the elements `renderControls` mounts, so those must exist whether
or not they are visible.

**Files:**
- Modify: `src/overlays/types.ts` (add `renderSummary`)
- Modify: `src/overlays/search/index.ts`, `trop.ts`, `commentary.ts`,
  `haftarah.ts` (add `renderSummary`)
- Modify: `src/main.ts` (`activateOverlay`, the `onUpdate` callback, and the
  driver/story-shown changes)
- Modify: `src/styles/right-panel.css`
- Test: `src/__tests__/unit/overlays/summaries.test.ts` (create)

**Interfaces:**
- Consumes: `takeOver`, `driver` from Task 5; `setStoryShown` from Task 3.
- Produces: `Overlay.renderSummary?(container: HTMLElement): void`, and the
  `band-summary` class on `document.body`.

- [ ] **Step 1: Decide each overlay's summary with Danyel**

The spec leaves the wording open. Proposed, for him to accept or change before
any of it is built:

| overlay | summary |
| --- | --- |
| Text Search | the terms, comma-separated, as the story writes them: `אברם, אברהם` |
| Trop | the selected mark's name, or `No mark selected` |
| Commentary | the category's label: `All linked texts`, `Midrash`, … |
| Haftarah | the custom: `Ashkenazi` or `Sephardi` |
| Text Dating, Verse Length | none — they have no controls to summarise |

Write his answer into this table before continuing.

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { searchOverlay, searchForMeaning } from '../../../overlays/search/index';
import { tropOverlay } from '../../../overlays/trop';
import { commentaryOverlay } from '../../../overlays/commentary';
import { haftarahOverlay } from '../../../overlays/haftarah';
import { applyOverlayParams } from '../../../overlays/applyParams';

function summaryOf(overlay: { renderSummary?(c: HTMLElement): void }): string {
  const container = document.createElement('div');
  overlay.renderSummary?.(container);
  return container.textContent?.trim() ?? '';
}

describe('overlay summaries', () => {
  it('names the haftarah custom', () => {
    applyOverlayParams(haftarahOverlay, { custom: 'sephardi' });
    expect(summaryOf(haftarahOverlay)).toBe('Sephardi');
  });

  it('names the commentary category by its label', () => {
    applyOverlayParams(commentaryOverlay, { category: 'total' });
    expect(summaryOf(commentaryOverlay)).toBe('All linked texts');
  });

  it('says when no trop mark is chosen', () => {
    expect(summaryOf(tropOverlay)).toBe('No mark selected');
  });

  it('lists the search terms', () => {
    applyOverlayParams(searchOverlay, { q: 'אברם,אברהם' });
    expect(summaryOf(searchOverlay)).toBe('אברם, אברהם');
  });

  it('is one line', () => {
    const container = document.createElement('div');
    tropOverlay.renderSummary?.(container);
    expect(container.children.length).toBeLessThanOrEqual(1);
  });
});
```

The parameter names are the overlays' own: `custom`, `category`, `q`. Search
needs its data loaded to run a query; follow the setup in
`src/__tests__/unit/overlays/search.test.ts`.

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/summaries.test.ts`
Expected: FAIL — `renderSummary` is undefined, every summary is empty.

- [ ] **Step 4: Add the method and implement it**

```ts
// types.ts, next to renderControls
// One line saying what is selected, shown above the story in place of the full
// controls. Absent when there is nothing to summarise.
renderSummary?(container: HTMLElement): void;
```

```ts
// haftarah.ts
renderSummary(container: HTMLElement) {
  container.textContent = currentCustom === 'ashkenazi' ? 'Ashkenazi' : 'Sephardi';
},
```

```ts
// commentary.ts — read the label from the same <option> list renderControls
// builds, so the two cannot disagree. Pull the option markup out of
// renderControls into a module constant CATEGORY_OPTIONS_HTML first.
renderSummary(container: HTMLElement) {
  const options = document.createElement('select');
  options.innerHTML = CATEGORY_OPTIONS_HTML;
  options.value = currentCategory;
  container.textContent = options.selectedOptions[0]?.textContent ?? currentCategory;
},
```

```ts
// trop.ts
renderSummary(container: HTMLElement) {
  container.textContent = selectedTrop ? selectedTrop.name : 'No mark selected';
},
```

```ts
// search/index.ts
renderSummary(container: HTMLElement): void {
  container.textContent = activeTerms().map((term) => term.text).join(', ');
},
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/__tests__/unit/overlays/summaries.test.ts`
Expected: PASS

- [ ] **Step 6: Render and switch in `main.ts`**

In `activateOverlay` and in the `onUpdate` callback, next to the legend:

```ts
const overlaySummaryContainer = document.getElementById('overlay-summary');
// …
if (overlaySummaryContainer) {
  overlaySummaryContainer.innerHTML = '';
  currentOverlay?.renderSummary?.(overlaySummaryContainer);
}
```

And one function that says which form the band shows, called after every
change to `driver` or `storyShown`:

```ts
// The summary while the story drives; the full controls once the reader has
// the map, or the story is put away.
function updateBand(): void {
  document.body.classList.toggle('band-summary', storyShown && driver.by !== 'reader');
}
```

```css
/* right-panel.css */
#overlay-summary {
  display: none;
  margin-top: 8px;
  font-size: 13px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

body.band-summary #overlay-summary {
  display: block;
}

body.band-summary #overlay-controls {
  display: none;
}
```

- [ ] **Step 7: Typecheck, run the suite, verify in the browser**

Run: `npm run typecheck && npx vitest run`

In the browser, scroll the story: at "The Rename" the band reads
`Text Search` over `אברם, אברהם`, not the term rows. Click the summary: the
term rows appear and the story stops driving. Choose Trop while driving: the
grid appears, scrolling inside the band. Measure the band's content height
with each overlay selected and the summary showing; record the tallest — Task
7 needs it.

- [ ] **Step 8: Commit**

```bash
git add src/overlays src/main.ts src/styles/right-panel.css src/__tests__/unit/overlays/summaries.test.ts
git commit -m "Show a one-line summary of the overlay's controls above the story"
```

---

### Task 7: The phone band, and tuning the numbers

On a phone the band is the picker and a one-line summary of the legend, about
90px, leaving about 330px of story on an 844px screen. Then every number this
plan guessed gets measured.

**Files:**
- Modify: `src/overlays/types.ts` (add `renderLegendSummary`)
- Modify: the overlays with a legend: `commentary.ts`, `haftarah.ts`,
  `trop.ts`, `text-dating.ts`, `verse-length.ts` (search has no legend)
- Modify: `src/overlays/legend.ts` (shared helpers, if two overlays need the
  same shape)
- Modify: `src/main.ts`, `src/styles/right-panel.css`
- Modify: `src/scrollytelling/driver.ts` (constants, if tuning changes them)
- Test: `src/__tests__/unit/overlays/summaries.test.ts` (extend)

**Interfaces:**
- Consumes: `band-summary` from Task 6.
- Produces: `Overlay.renderLegendSummary?(container: HTMLElement): void`.

- [ ] **Step 1: Decide each legend's one-line form with Danyel**

The spec leaves this open. Proposed, for him to accept or change:

| overlay | legend in one line |
| --- | --- |
| Commentary, Verse Length | the gradient strip alone, no tick labels |
| Haftarah, Text Dating | the swatches alone, no labels |
| Trop | the swatch or gradient it would show, no label |

Write his answer here before continuing.

- [ ] **Step 2: Write the failing tests**

Extend `summaries.test.ts` with one test per overlay in the table, asserting
the agreed form — for the proposal above, that the container holds a strip or
swatches and no text:

```ts
describe('legend summaries', () => {
  it.each([
    ['commentary', commentaryOverlay],
    ['haftarah', haftarahOverlay],
    ['trop', tropOverlay],
    ['text-dating', textDatingOverlay],
    ['verse-length', verseLengthOverlay],
  ])('%s fits its legend in one line with no labels', (_, overlay) => {
    const container = document.createElement('div');
    overlay.renderLegendSummary?.(container);

    expect(container.innerHTML).not.toBe('');
    expect(container.textContent?.trim()).toBe('');
  });
});
```

Run it and see it fail.

- [ ] **Step 3: Implement the agreed forms**

Each overlay renders from the same data its `renderLegend` already uses; where
two overlays share a shape (a bare gradient strip, a row of swatches), put the
markup in `legend.ts` beside `renderAxis` and `legendRow`. Render into
`#overlay-legend-summary` in `activateOverlay` and `onUpdate`, as Task 6 did for
the summary.

```css
#overlay-legend-summary {
  display: none;
}

@media (max-width: 768px) {
  body.band-summary #overlay-summary,
  body.band-summary #overlay-legend {
    display: none;
  }

  body.band-summary #overlay-legend-summary {
    display: block;
  }
}
```

Run the tests and see them pass.

- [ ] **Step 4: Measure the band heights and set them**

In a desktop viewport, with the summary showing, measure
`#panel-controls` `scrollHeight` for every overlay. Set desktop
`--band-height` to the tallest, rounded up to the next 5px. In the 390×844
iframe do the same for the phone. The spec's estimates were 225px and 90px;
if either measurement is far off, tell Danyel before setting it.

Also measure the footer on the phone and report what the story is left with:
`innerHeight / 2 - band - footer`. The spec's figure of about 330px ignores the
footer.

- [ ] **Step 5: Tune the rejoin numbers with Danyel**

With him driving the real app, try `REJOIN_SCROLL_PX` at 40, 60 and 100, and
`REJOIN_EASE_MS` at 500, 700 and 1000, on a trackpad and on a mouse wheel.
Keep what he picks; the constants' comments stop calling them guesses.

- [ ] **Step 6: Typecheck, run the suite, commit**

```bash
npm run typecheck && npx vitest run
git add src
git commit -m "Summarise the legend in one line on a phone; set measured band heights"
```

---

### Task 8: Danyel looks at it

- [ ] **Step 1: Remember a hidden story across visits**

Danyel decided it is remembered. Store it under `torahMap.storyHidden` in
`setStoryShown`, read it at startup only when the URL names neither a story
stop nor an overlay, and wrap both in `try`/`catch` like the help module's
storage. A URL naming an overlay but no stop opens with the story hidden
regardless.

- [ ] **Step 2: Show him**

Start a dev server on this branch and give him the port and branch name. Walk
the story end to end on desktop and in a phone-sized window, take the wheel
from each kind of control, and hide and show the story. Screenshots of the
band in summary and full form, desktop and phone, go in the PR description.

- [ ] **Step 3: Open the PR once he agrees**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --fill --body "Closes #84, closes #85, closes #86, closes #87, closes #135"
```
