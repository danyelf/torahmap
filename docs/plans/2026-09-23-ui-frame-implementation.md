# The frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accordion panel with the frame from the design: a story is a mode with only a ☰, the menu drops into the story's column, and outside a story there is an icon rail on desktop and a bottom sheet on a phone, with anything on but not open folded to a labelled line.

**Architecture:** A pure module, `src/frame.ts`, owns what the panel shows — the mode, which panel is open, whether the story's menu is down, whether a phone's sheet is dragged to full — as a state and one transition function, tested in vitest. `main.ts` keeps its story and driver logic and applies the frame to the page as `data-` attributes on `<body>`; the stylesheet does the rest. Menu, Stories and About panels are small functions that return HTML, each tested on its own.

**Tech Stack:** TypeScript 7, Vite 7, vitest 4 with happy-dom, Playwright for layout (from the layout-tests branch).

**Spec:** `docs/plans/2026-09-23-ui-information-hierarchy-design.md` — this plan is step 1 of its "Order of work", "The frame". Read the whole design first; the mockup at the top of it is the target.

## Global Constraints

- Work in a new worktree, branch `ui-frame`, based on `worktree-ui-information-hierarchy` (the design branch, which carries the spec). Rebase onto `origin/main` once the design PR has merged.
- Step 1 only. Search stays an overlay in the overlay list; there is no Share; there is one story. The rail therefore has Stories, Overlay and ☰ — Search and Share join it in later steps.
- The rail and the panel sit on the **right**, where the panel is today. Pointer handling in `main.ts` treats `clientX`/`clientY` as map coordinates, which holds only while the canvas starts at the window's left edge. The mockups drew the rail on the left; moving it there needs every pointer and label coordinate offset first, and is not this plan.
- `--panel-width` (380px, `src/styles/main.css:2`) stays the width of everything right of the map, in both modes: the story column is 380px; the rail (56px) and the open panel (324px) together are 380px. The map does not change width when the mode changes.
- The verse popup and the zoom buttons keep their places and styles. Hide Hebrew keeps its storage key, `torahMap.englishOnly`.
- Every new touch target on a phone is at least 44×44 CSS px.
- Telemetry values stay as they are: `ExitHow` `'fold'` now means "left the story for the tools", because `scripts/telemetry/` filters on the value.
- Comments follow AGENTS.md: present tense, only what the code cannot say. No ticket numbers or step labels in code.
- `npm` only. The pre-commit hook (prettier, typecheck, vitest) must pass on every commit.
- This is a UI change: it is not done until Danyel has looked at it on the PR's preview link and agreed.

## Decisions this plan takes that Danyel has not seen

Each is a constant or a string in one place, so changing it is one edit. List them in the PR.

1. **The rail's icons** are placeholder glyphs (`📖`, `◧`, `☰`) with a text label under each. The design says the real icons are a design job of their own.
2. **The phone's top bar comes back 2 seconds after the map stops moving** (`BAR_RETURN_MS`). The design says it hides when the map moves but not when it returns.
3. **The Stories panel calls the story "The guided tour"**, since the story file has no title yet; titles arrive with the multiple-stories step.
4. **Each overlay's description shows under the overlay picker** now, not in step 3. The help window's Overlays tab goes away in this step, and without this the descriptions would vanish from the interface until step 3.
5. **At rest on a phone, a link into the explore view opens with nothing open** — the map and the folded line — and on a desktop with the Overlay panel open.
6. **The rail and the panel stay on the right**, where the panel is today, though the mockups drew them on the left. See Global Constraints for why.

## File Structure

```
src/frame.ts                  NEW  the frame's state and transitions (replaces src/sheet.ts)
src/menu.ts                   NEW  the menu's items
src/storiesPanel.ts           NEW  the Stories panel
src/aboutPanel.ts             NEW  About & settings (replaces src/help.ts)
src/hebrewDisplay.ts          CHANGED  applies the stored choice at startup; binds a toggle it is given
src/panelSummary.ts           unchanged; its summary now fills the folded line
src/sheet.ts, src/help.ts     DELETED
src/styles/frame.css          NEW  (replaces src/styles/right-panel.css)
src/styles/about.css          NEW  (the content rules of src/styles/help.css)
src/styles/right-panel.css, src/styles/help.css   DELETED
src/styles/verse-popup.css    one selector
src/telemetry/driverChange.ts one doc comment
index.html                    the panel's markup, the rail, the phone's top bar
src/main.ts                   the wiring
src/__tests__/unit/frame.test.ts, menu.test.ts, storiesPanel.test.ts, aboutPanel.test.ts   NEW
src/__tests__/unit/overlays/descriptions.test.ts   NEW (the registry checks from help.test.ts)
src/__tests__/unit/sheet.test.ts, help.test.ts     DELETED
layout/app.spec.ts            the frame's states (after the layout-tests branch merges)
CLAUDE.md                     Features and Interactions
```

---

### Task 1: The frame's state and transitions

**Files:**
- Create: `src/frame.ts`, `src/__tests__/unit/frame.test.ts`

**Interfaces:**
- Produces:
  - `type Panel = 'overlay' | 'stories' | 'about' | 'menu'`
  - `interface Frame { mode: 'story' | 'explore'; open: Panel | null; menu: boolean; full: boolean }`
  - `type FrameEvent = { type: 'menu' } | { type: 'choose'; panel: Panel } | { type: 'story' } | { type: 'map-touched' } | { type: 'drag'; dy: number } | { type: 'typing' } | { type: 'layout-changed' }`
  - `const STORY: Frame`
  - `const DRAG_PX = 10`
  - `function exploreFrame(phone: boolean): Frame`
  - `function nextFrame(frame: Frame, event: FrameEvent, phone: boolean): Frame`

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/danyel/code/MISC/torahmap
git worktree add .claude/worktrees/ui-frame -b ui-frame worktree-ui-information-hierarchy
cd .claude/worktrees/ui-frame
npm install
```

Expected: `ls node_modules/.bin/vitest` exists; `ls docs/plans/2026-09-23-ui-information-hierarchy-design.md` exists.

- [ ] **Step 2: Write the failing tests**

`src/__tests__/unit/frame.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DRAG_PX, STORY, exploreFrame, nextFrame, type Frame } from '../../frame';

const explore = (open: Frame['open'], full = false): Frame => ({
  mode: 'explore',
  open,
  menu: false,
  full,
});
const PHONE = true;
const DESKTOP = false;

describe('the story', () => {
  it('drops its menu on ☰ and lifts it on ☰ again', () => {
    const down = nextFrame(STORY, { type: 'menu' }, DESKTOP);
    expect(down).toEqual({ ...STORY, menu: true });
    expect(nextFrame(down, { type: 'menu' }, DESKTOP)).toEqual(STORY);
  });

  it('lifts its menu when the map is touched', () => {
    const down = { ...STORY, menu: true };
    expect(nextFrame(down, { type: 'map-touched' }, PHONE)).toEqual(STORY);
    expect(nextFrame(down, { type: 'map-touched' }, DESKTOP)).toEqual(STORY);
  });

  it('ends when a panel is chosen, opening that panel', () => {
    const down = { ...STORY, menu: true };
    expect(nextFrame(down, { type: 'choose', panel: 'about' }, DESKTOP)).toEqual(explore('about'));
  });

  it('keeps a constant height: a drag does nothing', () => {
    expect(nextFrame(STORY, { type: 'drag', dy: -100 }, PHONE)).toEqual(STORY);
  });
});

describe('returning to the story', () => {
  it('comes from any panel', () => {
    expect(nextFrame(explore('about', true), { type: 'story' }, PHONE)).toEqual(STORY);
  });
});

describe('exploring on a desktop', () => {
  it('always has a panel open', () => {
    expect(exploreFrame(DESKTOP)).toEqual(explore('overlay'));
    expect(nextFrame(explore('stories'), { type: 'map-touched' }, DESKTOP)).toEqual(
      explore('stories'),
    );
  });

  it('keeps a panel open when its rail icon is clicked again', () => {
    expect(nextFrame(explore('about'), { type: 'choose', panel: 'about' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });

  it('closes the menu panel back to the overlay on ☰', () => {
    expect(nextFrame(explore('menu'), { type: 'menu' }, DESKTOP)).toEqual(explore('overlay'));
  });

  it('never goes full height', () => {
    expect(nextFrame(explore('overlay'), { type: 'typing' }, DESKTOP)).toEqual(explore('overlay'));
  });
});

describe('exploring on a phone', () => {
  it('opens a link with nothing open', () => {
    expect(exploreFrame(PHONE)).toEqual(explore(null));
  });

  it('folds everything when the map is touched', () => {
    expect(nextFrame(explore('overlay', true), { type: 'map-touched' }, PHONE)).toEqual(
      explore(null),
    );
  });

  it('folds a panel whose line is tapped again', () => {
    expect(nextFrame(explore('overlay'), { type: 'choose', panel: 'overlay' }, PHONE)).toEqual(
      explore(null),
    );
  });

  it('opens and closes the menu panel on ☰', () => {
    const open = nextFrame(explore(null), { type: 'menu' }, PHONE);
    expect(open).toEqual(explore('menu'));
    expect(nextFrame(open, { type: 'menu' }, PHONE)).toEqual(explore(null));
  });

  it('goes full height on a drag up, then back, then folds', () => {
    const full = nextFrame(explore('overlay'), { type: 'drag', dy: -40 }, PHONE);
    expect(full).toEqual(explore('overlay', true));
    const fitted = nextFrame(full, { type: 'drag', dy: 40 }, PHONE);
    expect(fitted).toEqual(explore('overlay'));
    expect(nextFrame(fitted, { type: 'drag', dy: 40 }, PHONE)).toEqual(explore(null));
  });

  it('treats a movement under DRAG_PX as no drag', () => {
    const f = explore('overlay');
    expect(nextFrame(f, { type: 'drag', dy: -(DRAG_PX - 1) }, PHONE)).toEqual(f);
  });

  it('cannot drag a sheet with nothing open', () => {
    expect(nextFrame(explore(null), { type: 'drag', dy: -40 }, PHONE)).toEqual(explore(null));
  });

  it('goes full height for typing', () => {
    expect(nextFrame(explore('overlay'), { type: 'typing' }, PHONE)).toEqual(
      explore('overlay', true),
    );
  });
});

describe('crossing from phone width to desktop width', () => {
  it('opens the overlay if nothing was open, and drops full height', () => {
    expect(nextFrame(explore(null), { type: 'layout-changed' }, DESKTOP)).toEqual(
      explore('overlay'),
    );
    expect(nextFrame(explore('about', true), { type: 'layout-changed' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/frame.test.ts`
Expected: FAIL — cannot resolve `../../frame`.

- [ ] **Step 4: Implement**

`src/frame.ts`:

```ts
// What the panel shows. A story is a mode with no tools, only its menu.
// Outside it one panel is open — on a phone possibly none, leaving the map and
// the folded lines — and a phone's sheet can be dragged to full height.

export type Panel = 'overlay' | 'stories' | 'about' | 'menu';

export interface Frame {
  mode: 'story' | 'explore';
  /** The open panel, while exploring. Null on a phone at rest, never on a desktop. */
  open: Panel | null;
  /** The menu has dropped over the story. */
  menu: boolean;
  /** A phone's open panel, dragged to full height. */
  full: boolean;
}

export type FrameEvent =
  | { type: 'menu' }
  | { type: 'choose'; panel: Panel }
  | { type: 'story' }
  | { type: 'map-touched' }
  | { type: 'drag'; dy: number }
  | { type: 'typing' }
  | { type: 'layout-changed' };

export const STORY: Frame = { mode: 'story', open: null, menu: false, full: false };

/** How far a finger must travel to count as a drag rather than a tap. */
export const DRAG_PX = 10;

const explore = (open: Panel | null): Frame => ({ mode: 'explore', open, menu: false, full: false });

/** Where leaving the story, or a link into the explore view, lands. */
export function exploreFrame(phone: boolean): Frame {
  return explore(phone ? null : 'overlay');
}

export function nextFrame(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  return fit(step(frame, event, phone), phone);
}

/** A desktop always has a panel open and has no full height. */
function fit(frame: Frame, phone: boolean): Frame {
  if (phone || frame.mode === 'story') return frame;
  return { ...frame, open: frame.open ?? 'overlay', full: false };
}

function step(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  switch (event.type) {
    case 'menu':
      if (frame.mode === 'story') return { ...frame, menu: !frame.menu };
      return explore(frame.open === 'menu' ? null : 'menu');
    case 'choose': {
      const again = phone && frame.mode === 'explore' && frame.open === event.panel;
      return explore(again ? null : event.panel);
    }
    case 'story':
      return STORY;
    case 'map-touched':
      if (frame.mode === 'story') return { ...frame, menu: false };
      return phone ? explore(null) : frame;
    case 'drag':
      if (!phone || frame.mode === 'story' || frame.open === null) return frame;
      if (Math.abs(event.dy) < DRAG_PX) return frame;
      if (event.dy < 0) return { ...frame, full: true };
      return frame.full ? { ...frame, full: false } : explore(null);
    case 'typing':
      return phone && frame.mode === 'explore' ? { ...frame, full: true } : frame;
    case 'layout-changed':
      return frame;
  }
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/__tests__/unit/frame.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/frame.ts src/__tests__/unit/frame.test.ts
git commit -m "The frame's state and transitions, as a pure module

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The menu, the Stories panel and the About panel

**Files:**
- Create: `src/menu.ts`, `src/storiesPanel.ts`, `src/aboutPanel.ts`, `src/styles/about.css`
- Create tests: `src/__tests__/unit/menu.test.ts`, `src/__tests__/unit/storiesPanel.test.ts`, `src/__tests__/unit/aboutPanel.test.ts`, `src/__tests__/unit/overlays/descriptions.test.ts`
- Modify: `src/hebrewDisplay.ts`
- Read before deleting anything: `src/help.ts`, `src/__tests__/unit/help.test.ts`, `src/styles/help.css`

`src/help.ts`, its test and its stylesheet stay in place until Task 3, because `main.ts` still imports them; this task only builds what replaces them.

**Interfaces:**
- Consumes: `escapeHtml` from `src/utils/html.ts`; `renderCreditsHtml` from `src/credits.ts`; `getAllOverlays` from `src/overlays/registry.ts`.
- Produces:
  - `interface StoryPlace { number: number; total: number }` and `menuHtml(place: StoryPlace): string` in `menu.ts`. Items are `button.menu-item[data-action]`, with `data-action` one of `'story' | 'overlay' | 'stories' | 'about'`.
  - `storiesHtml(place: StoryPlace & { label: string }): string` in `storiesPanel.ts`. Buttons carry `data-action="story"` (continue) and `data-action="restart"`.
  - `aboutHtml(overlays: readonly { name: string; credits?: readonly Credit[] }[]): string` in `aboutPanel.ts`, containing `button#hebrew-toggle`.
  - `applyHebrewChoice(): void` and `bindHebrewToggle(button: HTMLButtonElement): void` in `hebrewDisplay.ts`, replacing `initHebrewToggle`.

- [ ] **Step 1: Write the menu's failing test**

`src/__tests__/unit/menu.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { menuHtml } from '../../menu';

function items(html: string): HTMLButtonElement[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll<HTMLButtonElement>('button.menu-item')];
}

describe('menuHtml', () => {
  it('offers the story first, with where it is', () => {
    const [first] = items(menuHtml({ number: 7, total: 21 }));
    expect(first.dataset.action).toBe('story');
    expect(first.textContent).toContain('Continue the story');
    expect(first.textContent).toContain('7 of 21');
  });

  it('then the overlays, the stories, and about', () => {
    const actions = items(menuHtml({ number: 1, total: 21 })).map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'overlay', 'stories', 'about']);
  });

  it('makes every item a real button', () => {
    for (const b of items(menuHtml({ number: 1, total: 2 }))) expect(b.type).toBe('button');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/unit/menu.test.ts`
Expected: FAIL — cannot resolve `../../menu`.

- [ ] **Step 3: Implement the menu**

`src/menu.ts`:

```ts
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
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/unit/menu.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Write the Stories panel's failing test**

`src/__tests__/unit/storiesPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { storiesHtml } from '../../storiesPanel';

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('storiesHtml', () => {
  it('names the stop the story is at', () => {
    const text = parse(storiesHtml({ number: 7, total: 21, label: "Abraham's call" })).textContent;
    expect(text).toContain('7 of 21');
    expect(text).toContain("Abraham's call");
  });

  it('offers to continue and to start again', () => {
    const actions = [
      ...parse(storiesHtml({ number: 7, total: 21, label: 'x' })).querySelectorAll<HTMLElement>(
        'button[data-action]',
      ),
    ].map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'restart']);
  });

  it('escapes the stop label', () => {
    const div = parse(storiesHtml({ number: 1, total: 1, label: '<img src=x>' }));
    expect(div.querySelector('img')).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to see it fail, then implement**

Run: `npx vitest run src/__tests__/unit/storiesPanel.test.ts`
Expected: FAIL — cannot resolve `../../storiesPanel`.

`src/storiesPanel.ts`:

```ts
import { escapeHtml } from './utils/html.ts';
import type { StoryPlace } from './menu.ts';

/** The stories on offer. There is one, the guided tour, and it keeps its place. */
export function storiesHtml(place: StoryPlace & { label: string }): string {
  return `
    <h2 class="panel-title">Stories</h2>
    <div class="story-card">
      <h3>The guided tour</h3>
      <p class="story-card-place">Stop ${place.number} of ${place.total}: ${escapeHtml(place.label)}</p>
      <div class="story-card-actions">
        <button type="button" class="story-card-action" data-action="story">Continue</button>
        <button type="button" class="story-card-action secondary" data-action="restart">Start from the beginning</button>
      </div>
    </div>`;
}
```

Run: `npx vitest run src/__tests__/unit/storiesPanel.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Split the Hebrew toggle**

Replace `initHebrewToggle` in `src/hebrewDisplay.ts` with two functions; keep `STORAGE_KEY`, `CLASS`, `load` and `save` as they are:

```ts
/** Applies the reader's stored choice. Runs at startup, before any panel exists. */
export function applyHebrewChoice(): void {
  document.body.classList.toggle(CLASS, load());
}

/** Makes `button` show and flip the choice. The About panel draws it afresh each time it opens. */
export function bindHebrewToggle(button: HTMLButtonElement): void {
  const label = (): void => {
    button.textContent = document.body.classList.contains(CLASS) ? 'Show Hebrew' : 'Hide Hebrew';
  };
  label();
  button.addEventListener('click', () => {
    const englishOnly = !document.body.classList.contains(CLASS);
    document.body.classList.toggle(CLASS, englishOnly);
    save(englishOnly);
    label();
  });
}
```

`main.ts` still calls `initHebrewToggle` until Task 3, so the typecheck fails between this step and Task 3. Do not commit this step on its own; Task 2 commits once, at the end, and Step 12 restores a compiling `main.ts` temporarily. (See Step 12.)

- [ ] **Step 8: Write the About panel's failing test**

Read `src/__tests__/unit/help.test.ts` first. Its credits and byline tests carry over; its tab and modal tests do not; its overlay-description tests move to Step 10.

`src/__tests__/unit/aboutPanel.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function about(): Promise<HTMLDivElement> {
  vi.resetModules();
  // The registry fills when the overlays register, so the panel is built after that.
  const { registerAllOverlays } = await import('../../overlays/index');
  registerAllOverlays();
  const { getAllOverlays } = await import('../../overlays/registry');
  const { aboutHtml } = await import('../../aboutPanel');
  const div = document.createElement('div');
  div.innerHTML = aboutHtml(getAllOverlays());
  return div;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the About panel', () => {
  it('offers the Hebrew toggle as a button', async () => {
    const div = await about();
    const toggle = div.querySelector<HTMLButtonElement>('#hebrew-toggle');
    expect(toggle?.type).toBe('button');
  });

  it('says what the map is and who made it', async () => {
    const text = (await about()).textContent ?? '';
    expect(text).toContain('Torahmap');
    expect(text).toContain('Danyel Fisher');
  });

  it('lists the controls', async () => {
    expect((await about()).querySelector('.controls-table')).not.toBeNull();
  });

  it('carries the credits, the map first', async () => {
    const titles = [...(await about()).querySelectorAll('.credit-block-title')].map(
      (h) => h.textContent,
    );
    expect(titles[0]).toBe('The map itself');
    expect(titles.length).toBeGreaterThan(1);
  });

  it('opens every source link in a new tab, safely', async () => {
    for (const a of (await about()).querySelectorAll<HTMLAnchorElement>('.credits-list a')) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    }
  });
});
```

Check the names before running: `grep -n "export function registerAllOverlays" src/overlays/index.ts` and `grep -n "The map itself" src/credits.ts`. If either differs, use what the source says.

- [ ] **Step 9: Run it to see it fail, then implement**

Run: `npx vitest run src/__tests__/unit/aboutPanel.test.ts`
Expected: FAIL — cannot resolve `../../aboutPanel`.

`src/aboutPanel.ts` — the overview and controls text are copied from `TAB_CONTENT` in `src/help.ts`, with the overview's "Sources and credits" link button removed, since the credits are further down the same panel:

```ts
import './styles/about.css';
import { renderCreditsHtml, type Credit } from './credits.ts';

/** About & settings: one scrolling panel, settings first because they are what a returning reader wants. */
export function aboutHtml(overlays: readonly { name: string; credits?: readonly Credit[] }[]): string {
  return `
    <h2 class="panel-title">About &amp; settings</h2>
    <section class="about-section">
      <h3>Settings</h3>
      <button type="button" id="hebrew-toggle" class="setting-toggle"></button>
    </section>
    <section class="about-section">
      <h3>Torahmap</h3>
      <p>An interactive visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position.</p>
      <p>The map is divided into three sections, stacked vertically:</p>
      <ul>
        <li><strong>Torah</strong> — The Five Books of Moses</li>
        <li><strong>Nevi'im</strong> — The Prophets</li>
        <li><strong>Ketuvim</strong> — The Writings</li>
      </ul>
      <p>Switch between different analytical overlays to reveal patterns across 23,000+ verses.</p>
      <p class="byline">
        By <a href="https://danyelfisher.info" target="_blank" rel="noopener noreferrer">Danyel Fisher</a> ·
        <a href="https://github.com/danyelf/torahmap" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    </section>
    <section class="about-section">
      <h3>Controls</h3>
      <table class="controls-table">
        <tr><td>Scroll / Pinch</td><td>Zoom in/out</td></tr>
        <tr><td>Drag</td><td>Pan around</td></tr>
        <tr><td>Hover</td><td>Preview verse details</td></tr>
        <tr><td>Click / Tap</td><td>Pin verse details</td></tr>
        <tr><td>Click pinned / Tap again</td><td>Unpin verse</td></tr>
        <tr><td>&larr; &rarr; arrow keys</td><td>Navigate verses</td></tr>
        <tr><td>Escape</td><td>Unpin verse</td></tr>
      </table>
    </section>
    <section class="about-section">
      <h3>Sources and credits</h3>
      ${renderCreditsHtml(overlays)}
    </section>`;
}
```

If the overview or controls text in `src/help.ts` differs from the above when you read it, copy what `src/help.ts` says; it is the source.

`src/styles/about.css`: copy these rules from `src/styles/help.css`, renaming the `.help-body` prefix to `#about-panel` where a rule has it: `.controls-table` and its three descendants, every `.credit*` rule (`.credits-list`, `.credit-block`, `.credit-block-title`, `.credit-rows`, `.credit-row`, `.credit-source`, `.credit-license`, `.credit-meta`, `a.credit-license` and its hover), the `@media (max-width: 480px)` block, and `.help-body p`, `.help-body ul`, `.help-body li`, `.help-body h2` as `#about-panel p`, `ul`, `li`, `.panel-title`. Drop every `.help-modal`, `.help-backdrop`, `.help-content`, `.help-header`, `.help-tab*`, `.help-close`, `.overlay-list*` and `.link-button` rule. Then add:

```css
.about-section {
  margin: 0 0 20px;
}

.about-section h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #999;
}

.setting-toggle {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
  color: #fff;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
```

Run: `npx vitest run src/__tests__/unit/aboutPanel.test.ts`
Expected: 5 passed.

- [ ] **Step 10: Keep the checks on overlay descriptions**

`src/__tests__/unit/overlays/descriptions.test.ts` — the two registry checks from `help.test.ts` that are about the overlays rather than the modal:

```ts
import { describe, it, expect, vi } from 'vitest';

async function overlays() {
  vi.resetModules();
  const { registerAllOverlays } = await import('../../../overlays/index');
  registerAllOverlays();
  const { getAllOverlays } = await import('../../../overlays/registry');
  return getAllOverlays();
}

describe('overlay descriptions', () => {
  it('gives every overlay a description of its own', async () => {
    const all = await overlays();
    for (const o of all) expect(o.description, o.name).toBeTruthy();
    expect(new Set(all.map((o) => o.description)).size).toBe(all.length);
  });
});
```

Run: `npx vitest run src/__tests__/unit/overlays/descriptions.test.ts`
Expected: 1 passed. If an overlay has no description, that is a real gap: stop and report it rather than loosening the test.

- [ ] **Step 11: Style the menu and Stories panel**

These rules go in `src/styles/frame.css`, which Task 3 creates. Keep them in a scratch note for now; Task 3 Step 3 includes them.

- [ ] **Step 12: Commit with a compiling tree**

`main.ts` still calls `initHebrewToggle(panelFooter)`. So that this commit typechecks, change that one call in `main.ts` to:

```ts
    applyHebrewChoice();
```

and its import from `./hebrewDisplay.ts` to `applyHebrewChoice`. The footer loses its Hebrew button until Task 3 replaces the footer; that is acceptable inside the branch.

Run: `npm run typecheck && npx vitest run`
Expected: no type errors; every test passes, including the old `help.test.ts`.

```bash
git add src/menu.ts src/storiesPanel.ts src/aboutPanel.ts src/styles/about.css src/hebrewDisplay.ts src/main.ts src/__tests__/unit/menu.test.ts src/__tests__/unit/storiesPanel.test.ts src/__tests__/unit/aboutPanel.test.ts src/__tests__/unit/overlays/descriptions.test.ts
git commit -m "The menu, Stories and About panels, as HTML the frame will place

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The frame, drawn and wired

This task replaces the markup, the stylesheet and the panel wiring in `main.ts` together. They cannot be split: the old wiring looks up elements the new markup removes, and the page is broken between any two of the three.

**Files:**
- Modify: `index.html` (lines 80-118, `#right-panel` and everything inside it)
- Create: `src/styles/frame.css`; delete `src/styles/right-panel.css`, `src/styles/help.css`, `src/help.ts`, `src/sheet.ts`, `src/__tests__/unit/help.test.ts`, `src/__tests__/unit/sheet.test.ts`
- Modify: `src/main.ts`, `src/styles/verse-popup.css:128`, `src/telemetry/driverChange.ts:3`

**Interfaces:**
- Consumes: everything from Tasks 1 and 2; `summaryHtml` from `src/panelSummary.ts`; `stopLabel` from `src/scrollytelling/storyPanel.ts`; `stopAt` (already imported in `main.ts`).
- Produces, as the contract with the stylesheet and the layout tests:
  - on `<body>`: `data-mode="story|explore"`, `data-open="overlay|stories|about|menu"` (absent when nothing is open), `data-menu` (story menu down), `data-full` (phone sheet full), `data-bar-hidden` (phone top bar hidden)
  - ids: `#rail`, `#top-bar`, `#top-menu`, `#panel`, `#sheet-grabber`, `#story`, `#story-menu`, `#story-progress`, `#menu`, `#story-content`, `#story-cue`, `#tools`, `#panel-body`, `#overlay-panel`, `#overlay-select`, `#overlay-description`, `#overlay-controls`, `#overlay-legend`, `#stories-panel`, `#about-panel`, `#menu-panel`, `#folded`, `#folded-overlay`
  - classes: `.rail-button[data-panel]`, `.menu-button`, `.menu-item[data-action]`, `.folded-line[data-panel]`, `.tool[data-panel]`

- [ ] **Step 1: Replace the panel's markup**

In `index.html`, change `<body>` to `<body data-mode="story">`, so the page has a mode before `main.ts` runs; without it the stylesheet hides both the story and the tools until then.

Then, in `index.html`, replace everything from `<div id="right-panel">` to its closing `</div>` (lines 80-118) with:

```html
    <header id="top-bar">
      <button id="top-menu" class="menu-button" type="button" aria-label="Menu">☰</button>
      <span class="top-name">Torahmap</span>
    </header>

    <nav id="rail" aria-label="Tools">
      <button class="rail-button" type="button" data-panel="stories">
        <span class="rail-icon" aria-hidden="true">📖</span><span class="rail-label">Stories</span>
      </button>
      <button class="rail-button" type="button" data-panel="overlay">
        <span class="rail-icon" aria-hidden="true">◧</span><span class="rail-label">Overlay</span>
      </button>
      <button class="rail-button menu-button rail-menu" type="button" aria-label="Menu">
        <span class="rail-icon" aria-hidden="true">☰</span><span class="rail-label">Menu</span>
      </button>
    </nav>

    <aside id="panel">
      <button
        id="sheet-grabber"
        type="button"
        aria-label="Make the panel taller or shorter"
      ></button>

      <section id="story" aria-label="Story">
        <div class="story-head">
          <button
            id="story-menu"
            class="menu-button"
            type="button"
            aria-label="Menu"
            aria-expanded="false"
            aria-controls="menu"
          >
            ☰
          </button>
          <span id="story-progress"></span>
          <div id="menu" class="menu" hidden></div>
        </div>
        <div id="story-content"></div>
        <svg id="story-cue" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="1,2 9,50 1,98" />
        </svg>
      </section>

      <section id="tools">
        <div id="panel-body">
          <div id="overlay-panel" class="tool" data-panel="overlay">
            <div class="panel-picker">
              <label for="overlay-select">Overlay</label>
              <!-- The overlays themselves are added here at startup, from the
                 registry. Do not list them: that is what the registry is for. -->
              <select id="overlay-select">
                <option value="none">None</option>
              </select>
              <p id="overlay-description"></p>
            </div>
            <div id="overlay-controls"></div>
            <div id="overlay-legend"></div>
          </div>
          <div id="stories-panel" class="tool" data-panel="stories"></div>
          <div id="about-panel" class="tool" data-panel="about"></div>
          <div id="menu-panel" class="tool menu" data-panel="menu"></div>
        </div>
        <div id="folded">
          <button id="folded-overlay" class="folded-line" type="button" data-panel="overlay">
            <span class="folded-summary"></span>
            <span class="chevron" aria-hidden="true"></span>
          </button>
        </div>
      </section>
    </aside>
```

- [ ] **Step 2: Remove what the frame replaces**

```bash
git rm src/styles/right-panel.css src/styles/help.css src/help.ts src/sheet.ts \
  src/__tests__/unit/help.test.ts src/__tests__/unit/sheet.test.ts
```

- [ ] **Step 3: Write `src/styles/frame.css`**

Before writing it, read the deleted `right-panel.css` from git (`git show HEAD:src/styles/right-panel.css`): the story rules below are carried from it, including its comments on why stops are spaced in `cqh` and why the phone uses `svh`.

```css
/* The frame. On a desktop everything right of the map is --panel-width wide in
   both modes — the story's column, or the rail and the open panel together —
   so the map never changes width when the mode does. On a phone the panel is a
   sheet along the bottom and a bar along the top that hides while the map
   moves. The mode and the open panel are data- attributes on <body>, set by
   main.ts from src/frame.ts. */
:root {
  --rail-width: 56px;
  --story-bg: #16181d;
  --panel-bg: rgba(0, 0, 0, 0.92);
  --line: rgba(255, 255, 255, 0.1);
  --accent: #6ab0f3;
}

#canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: calc(100vw - var(--panel-width));
  /* A canvas does not stretch between its edges; 100% is of the visible window. */
  height: 100%;
}

#panel {
  position: fixed;
  /* Pinned to both edges rather than given a height. On an iPad 100vh counts
     the space behind Safari's toolbar. */
  top: 0;
  bottom: 0;
  right: 0;
  width: var(--panel-width);
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border-left: 1px solid var(--line);
  z-index: 10;
  font-family: system-ui, sans-serif;
  color: #fff;
}

body[data-mode='explore'] #panel {
  right: var(--rail-width);
  width: calc(var(--panel-width) - var(--rail-width));
}

#top-bar,
#rail,
#sheet-grabber {
  display: none;
}

body[data-mode='explore'] #rail {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: var(--rail-width);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  box-sizing: border-box;
  background: #000;
  border-left: 1px solid var(--line);
  z-index: 11;
}

.rail-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: 52px;
  padding: 6px 0;
  border: none;
  background: none;
  color: #aaa;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.rail-button:hover {
  color: #fff;
}

.rail-button[aria-pressed='true'] {
  color: var(--accent);
}

.rail-icon {
  font-size: 18px;
  line-height: 1;
}

.rail-menu {
  margin-top: auto;
}

#story,
#tools {
  display: none;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

body[data-mode='story'] #story {
  display: flex;
  position: relative;
  background: var(--story-bg);
}

body[data-mode='explore'] #tools {
  display: flex;
}

/* The story's header: its menu button and where it has got to. The menu drops
   from here over the top of the story, which stays visible below it. */
.story-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}

.menu-button {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid #444;
  border-radius: 6px;
  background: none;
  color: #ddd;
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}

.menu-button:hover {
  border-color: #777;
  color: #fff;
}

#story-progress {
  color: #999;
  font-size: 13px;
}

#menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 2;
  padding: 6px 0;
  background: #111;
  border-bottom: 1px solid #444;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
}

#menu[hidden] {
  display: none;
}

body[data-menu] #story-content {
  opacity: 0.3;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  border: none;
  background: none;
  color: #eee;
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.menu-item[data-action='story'] {
  color: var(--accent);
}

.menu-detail {
  color: #999;
  font-size: 13px;
}

#story-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  container-type: size;
  scrollbar-color: #444 transparent;
}

/* A cue that there is more story: a tall angle bracket, pointing down here
   and right on a phone, where the stops sit side by side. */
#story-cue {
  position: absolute;
  left: calc(50% - 6px);
  bottom: -8px;
  width: 12px;
  height: 44px;
  transform: rotate(90deg);
  pointer-events: none;
  fill: none;
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

#story-cue polyline {
  vector-effect: non-scaling-stroke;
}

body.story-at-end #story-cue,
body[data-menu] #story-cue {
  display: none;
}

/* Paragraphs sit half a panel apart, so when one is centred the next starts
   at the bottom edge. The first starts mid-panel and the last can scroll up
   to it. cqh is the story's height, not the window's. */
.story-stop {
  padding: 25cqh 24px;
}

.story-stop:first-child {
  padding-top: 50cqh;
}

.story-stop:last-child {
  padding-bottom: 50cqh;
}

.story-stop h2 {
  color: #fff;
  font-size: 20px;
  margin: 0 0 16px 0;
  font-weight: 500;
}

.story-stop p {
  color: #ccc;
  font-size: 15px;
  line-height: 1.7;
  margin: 0;
}

.story-leave {
  margin-top: 20px;
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.story-leave:hover {
  background: rgba(106, 176, 243, 0.12);
}

/* The open panel scrolls; the folded lines stay at the bottom edge. */
#panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 12px;
  scrollbar-color: #444 transparent;
  display: flex;
  flex-direction: column;
}

.tool {
  display: none;
  flex-direction: column;
  min-height: 0;
}

body[data-open='overlay'] #overlay-panel,
body[data-open='stories'] #stories-panel,
body[data-open='about'] #about-panel,
body[data-open='menu'] #menu-panel {
  display: flex;
}

#menu-panel {
  margin: -16px -20px 0;
}

.panel-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
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

#overlay-description {
  margin: 8px 0 12px;
  color: #aaa;
  font-size: 13px;
  line-height: 1.5;
}

#overlay-description:empty {
  display: none;
}

/* Search's results fill what the open panel has, in their own scroll. Every
   other overlay's controls keep their height and the panel scrolls. */
#overlay-panel:has(#search-results),
#overlay-controls:has(#search-results) {
  flex: 1 1 auto;
  min-height: 0;
}

#overlay-controls:has(#search-results) {
  display: flex;
  flex-direction: column;
}

#overlay-controls:has(#search-results) > * {
  flex-shrink: 0;
}

#panel #search-results {
  flex: 1 1 auto;
  min-height: 120px;
  max-height: none;
}

/* Reaches the overlay picker and any select an overlay renders into its
   controls. color-scheme matters as much as the colours: without it the popup
   list keeps the system's light theme. */
#panel select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #222;
  color: #fff;
  color-scheme: dark;
  font-size: 14px;
  cursor: pointer;
}

.story-card {
  padding: 14px;
  border: 1px solid #333;
  border-radius: 6px;
}

.story-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.story-card-place {
  margin: 0 0 12px;
  color: #aaa;
  font-size: 13px;
}

.story-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.story-card-action {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.story-card-action.secondary {
  border-color: #444;
  color: #ddd;
}

/* Anything on but not open: one labelled line each, at the bottom edge. */
#folded {
  flex-shrink: 0;
  border-top: 1px solid var(--line);
}

body[data-open='overlay'] #folded {
  display: none;
}

.folded-line {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  border: none;
  background: none;
  color: #ddd;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.folded-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.folded-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

/* Drawn rather than a ▴ glyph, which renders small and faint in system fonts. */
.folded-line .chevron {
  flex-shrink: 0;
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-right: 2px solid #ddd;
  border-bottom: 2px solid #ddd;
  transform: translateY(2px) rotate(-135deg);
}

.summary-name {
  font-weight: 600;
}

.summary-name.dim {
  color: #888;
  font-weight: 400;
}

.summary-sep,
.summary-detail {
  color: #999;
}

.summary-term,
.summary-swatches {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.summary-swatch {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.summary-swatch.strip {
  width: 60px;
}

/* On a phone the panel is a sheet along the bottom.

   In a story it is a constant 30svh, which leaves every stop room for about
   150px of text on an 844px-tall screen; the camera already moves between
   stops, and a sheet resizing under it would move the whole screen. svh, not
   vh: a phone's vh counts the space behind the browser's toolbar.

   Exploring, the sheet is as tall as its open panel, up to half the screen,
   or only its folded lines when nothing is open. Dragged to full, it grows up
   over the map rather than shrinking it. --sheet-shown is the height the map
   and the verse popup make room for; main.ts measures it. */
@media (max-width: 768px) {
  :root {
    --story-sheet: 30svh;
    --sheet-cap: 50svh;
    --sheet-full: 85svh;
    --bar-height: 52px;
  }

  #canvas {
    width: 100vw;
    height: calc(100svh - var(--sheet-shown));
  }

  body[data-mode='explore'] #rail {
    display: none;
  }

  #panel,
  body[data-mode='explore'] #panel {
    top: auto;
    left: 0;
    right: 0;
    width: 100%;
    max-height: var(--sheet-cap);
    border-left: none;
    border-top: 1px solid var(--line);
    border-radius: 16px 16px 0 0;
  }

  body[data-mode='story'] #panel {
    height: var(--story-sheet);
    max-height: none;
  }

  body[data-full] #panel {
    height: var(--sheet-full);
    max-height: none;
  }

  /* The story's menu needs more room than the story's sheet has, so the sheet
     grows over the map while it is down, as full height does. */
  body[data-mode='story'][data-menu] #panel {
    height: var(--sheet-cap);
  }

  body[data-mode='explore']:not([data-open]) #panel-body {
    display: none;
  }

  body[data-mode='explore']:not([data-open]) #folded {
    border-top: none;
  }

  /* The top of an open sheet, with a short pill drawn in it: tap to go full
     height or back, drag to do the same or to fold. */
  body[data-mode='explore'][data-open] #sheet-grabber {
    display: block;
    flex-shrink: 0;
    width: 100%;
    height: 22px;
    padding: 0;
    border: none;
    background: none;
    touch-action: none;
    cursor: grab;
  }

  #sheet-grabber::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    margin: 8px auto 0;
    border-radius: 2px;
    background: #666;
  }

  body[data-mode='explore'] #top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--bar-height);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.85);
    border-bottom: 1px solid var(--line);
    z-index: 12;
    transition:
      background 200ms ease,
      border-color 200ms ease;
  }

  .top-name {
    font-family: 'David Libre', Georgia, serif;
    font-weight: 700;
    font-size: 18px;
  }

  /* Hidden, the bar leaves its menu button floating over the map. */
  body[data-bar-hidden] #top-bar {
    background: transparent;
    border-bottom-color: transparent;
    pointer-events: none;
  }

  body[data-bar-hidden] .top-name {
    visibility: hidden;
  }

  body[data-bar-hidden] #top-menu {
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.7);
  }

  /* The stops sit side by side, a page each, and a swipe moves one. */
  #story-content {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .story-stop,
  .story-stop:first-child,
  .story-stop:last-child {
    flex: 0 0 100%;
    box-sizing: border-box;
    padding: 4px 24px 8px;
    overflow-y: auto;
    scroll-snap-align: center;
  }

  #story-cue {
    left: auto;
    right: 6px;
    top: calc(50% - 14px);
    bottom: auto;
    width: 10px;
    height: 72px;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  #top-bar {
    transition: none;
  }
}
```

`#panel` sits on the right on a desktop in both modes, so `--panel-width` is unchanged and `src/styles/zoom-buttons.css` needs nothing.

- [ ] **Step 4: Point the verse popup at the new full-height attribute**

In `src/styles/verse-popup.css`, change `body.sheet-tall #verse-popup` to `body[data-full] #verse-popup`. Then:

Run: `grep -rn "story-folded\|sheet-down\|sheet-tall\|no-overlay-quiet\|right-panel\|panel-footer\|controls-toggle\|story-strip\|footer-link" src index.html`
Expected: matches only in `src/main.ts`, which Step 5 rewrites. Any match elsewhere is an old selector to update.

- [ ] **Step 5: Rewire `main.ts`**

Work through these in order. Line numbers are from the design branch's `main.ts` and drift as you edit; search for the quoted code.

**5a. Imports.** Remove `import { initHelp } from './help.ts'` (near line 13), `import { summaryHtml } from './panelSummary.ts'` stays, remove the `sheet.ts` import (near line 139: `Sheet`, `sheetAfterDrag`, `sheetAfterTap`), change the stylesheet import `./styles/right-panel.css` (near line 143) to `./styles/frame.css`. Add:

```ts
import { DRAG_PX, STORY, exploreFrame, nextFrame, type Frame, type FrameEvent, type Panel } from './frame.ts';
import { menuHtml, type StoryPlace } from './menu.ts';
import { storiesHtml } from './storiesPanel.ts';
import { aboutHtml } from './aboutPanel.ts';
import { bindHebrewToggle } from './hebrewDisplay.ts';
```

Keep `applyHebrewChoice` imported from Task 2. Add `stopLabel` to the existing import from `./scrollytelling/storyPanel` if it is not already imported (it is, for the story strip). Import `getAllOverlays` from `./overlays/registry.ts` if `main.ts` does not already.

**5b. Element handles.** Replace the block at lines 331-335 (`panelControls`, `controlsToggle`, `controlsSummary`, `storyStrip`, `storyStripTitle`) with:

```ts
  const panel = document.getElementById('panel')!;
  const storyMenu = document.getElementById('menu')!;
  const storyMenuButton = document.getElementById('story-menu')!;
  const storyProgress = document.getElementById('story-progress')!;
  const menuPanel = document.getElementById('menu-panel')!;
  const storiesPanel = document.getElementById('stories-panel')!;
  const aboutPanel = document.getElementById('about-panel')!;
  const foldedSummary = document.querySelector<HTMLElement>('#folded-overlay .folded-summary')!;
  const overlayDescription = document.getElementById('overlay-description')!;
  const railButtons = [...document.querySelectorAll<HTMLButtonElement>('.rail-button[data-panel]')];
```

**5c. The frame's state.** Replace the accordion comment and `let storyOpen = true;` (lines 337-340) with:

```ts
  // What the panel shows (src/frame.ts). storyOpen is its mode, kept as a
  // boolean because the story's driver logic reads it on every frame.
  let frame: Frame = STORY;
  let storyOpen = true;
```

Delete `let cancelOpening` (line 348) and its comment.

**5d. `setStoryOpen`.** Replace the function (lines 356-368) with:

```ts
  function setStoryOpen(open: boolean): void {
    if (!open && storyOpen) heldStop = storyStopIndex();
    storyOpen = open;
    if (open) frame = STORY;
    else if (frame.mode === 'story') frame = exploreFrame(phoneLayout.matches);
    applyFrame();
  }
```

`phoneLayout` is declared further down (line 383); move its declaration (`const phoneLayout = window.matchMedia('(max-width: 768px)');`) up to just above `setStoryOpen`, and delete `let sheet: Sheet = 'normal';`.

**5e. Delete** `updateInert` (lines 370-378), `setSheet` (lines 411-417), the bare `updateInert();` after it (line 418), and `updateSummaryShown` (lines 420-429) with its doc comment. Remove the `updateSummaryShown();` call inside `setDriver` (line 438) and inside `overlayChanged` (line 902).

**5f. Applying the frame.** Add after `setStoryOpen`:

```ts
  function storyPlace(): StoryPlace {
    return { number: stopAt(resolvedStops, storyStopIndex()).number, total: resolvedStops.length };
  }

  /** Puts the frame on the page. The stylesheet reads the attributes; the panels are drawn as they open. */
  function applyFrame(): void {
    const body = document.body;
    body.dataset.mode = frame.mode;
    if (frame.open) body.dataset.open = frame.open;
    else delete body.dataset.open;
    body.toggleAttribute('data-menu', frame.menu);
    body.toggleAttribute('data-full', frame.full);
    storyMenu.hidden = !frame.menu;
    storyMenuButton.setAttribute('aria-expanded', String(frame.menu));
    storyContent.inert = frame.menu;
    for (const button of railButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.panel === frame.open));
    }
    if (frame.menu || frame.open === 'menu') {
      const html = menuHtml(storyPlace());
      storyMenu.innerHTML = html;
      menuPanel.innerHTML = html;
    }
    if (frame.open === 'stories') {
      storiesPanel.innerHTML = storiesHtml({
        ...storyPlace(),
        label: stopLabel(resolvedStops[storyStopIndex()]),
      });
    }
    if (frame.open === 'about') {
      aboutPanel.innerHTML = aboutHtml(getAllOverlays());
      bindHebrewToggle(aboutPanel.querySelector<HTMLButtonElement>('#hebrew-toggle')!);
    }
  }

  function setFrame(next: Frame): void {
    frame = next;
    applyFrame();
  }

  /** Every control that changes the panel comes through here. */
  function dispatch(event: FrameEvent): void {
    const next = nextFrame(frame, event, phoneLayout.matches);
    if (frame.mode === 'explore' && next.mode === 'story') {
      readerOpensStory();
      return;
    }
    if (frame.mode === 'story' && next.mode === 'explore') leaveStory();
    setFrame(next);
  }
```

`resolvedStops` is declared later (near line 1062), but `applyFrame` only reads it when a menu or panel is drawn, which cannot happen before the story has loaded. The one early call, `setStoryOpen` during startup, draws no panel: the story menu is up and nothing is open.

**5g. The map lowers the sheet, and hides the phone's bar.** In the canvas `pointerdown` handler (line 642), replace:

```ts
    if (phoneLayout.matches && sheet !== 'down') setSheet('down');
```

with:

```ts
    dispatch({ type: 'map-touched' });
```

Then add, near the other top-level constants of `main()`:

```ts
  // How long the phone's top bar stays hidden after the map stops moving.
  const BAR_RETURN_MS = 2000;
  let barTimer: number | undefined;

  function mapMoved(): void {
    if (!phoneLayout.matches) return;
    document.body.toggleAttribute('data-bar-hidden', true);
    clearTimeout(barTimer);
    barTimer = window.setTimeout(
      () => document.body.removeAttribute('data-bar-hidden'),
      BAR_RETURN_MS,
    );
  }
```

and call `mapMoved();` where the map is panned by a drag (the `pointermove` branch that applies `dx`/`dy` to the camera, near line 653) and where a pinch zooms (the two-finger branch of `touchmove`, near line 611).

**5h. The folded line and the overlay's description.** In `overlayChanged` (near line 891), replace:

```ts
    controlsSummary.innerHTML = summaryHtml(
```

with:

```ts
    overlayDescription.textContent = currentOverlay?.description ?? '';
    foldedSummary.innerHTML = summaryHtml(
```

**5i. The search result's glide.** In `configureSearch`'s `onVerseClick` (near line 1029), replace `if (sheet === 'tall') setSheet('normal');` with:

```ts
        if (frame.full) setFrame({ ...frame, full: false });
```

and update the comment above it to "A full-height sheet would hide the glide."

**5j. The footer.** Delete the block that finds `#panel-footer` and calls `initHelp` (lines 1036-1040). Keep the `applyHebrewChoice();` call from Task 2, placed where that block was.

**5k. Crossing phone width.** In the `phoneLayout` `change` handler (line 1069), replace `if (!phoneLayout.matches) setSheet('normal');` with:

```ts
    if (!phoneLayout.matches) document.documentElement.style.removeProperty('--sheet-shown');
    setFrame(nextFrame(frame, { type: 'layout-changed' }, phoneLayout.matches));
```

**5l. Leaving and opening the story.** Rename `openControls` (line 1111) to `leaveStory`, and update its one other caller, the `.story-leave` handler, which step 5m replaces anyway. Its body stays:

```ts
  function leaveStory(): void {
    takeOver('fold');
    setStoryOpen(false);
    rememberStoryFolded(true);
    render();
    syncUrl(true);
  }
```

Delete `const rightPanel = …` (line 1119). Replace `openStory` (lines 1121-1167) with — the story no longer grows into place, so it no longer waits for a transition:

```ts
  /**
   * Open the story at `stop` and hand it the map, easing from the reader's view
   * or cutting to the stop, as a link does.
   */
  function openStory(stop: number, arrive: 'ease' | 'cut', how: ReturnHow): void {
    heldStop = stop;
    setStoryOpen(true);
    showStop(stopElements[stop]);
    // Handed over while the stop is still held, so the return names `stop`
    // rather than wherever the story's scroll has got to.
    if (arrive === 'ease') {
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), how);
    } else {
      handOver(STORY_DRIVING, how);
      // Make the next frame apply the stop's overlay, settings and pin.
      lastSyncedStopId = null;
    }
    heldStop = null;
    scheduleStoryFrame();
  }
```

`readerOpensStory` (line 1169) stays as it is.

**5m. The handlers.** Delete the `controlsToggle` click handler, the `storyStrip`, `#return-to-story` and `#leave-story` handlers (lines 1175-1186), `resizesSheet` and its three uses (lines 1188-1228), and the `panelControls` `focusin` handler (lines 1230-1233). Replace the `.story-leave` handler (lines 1234-1237) and add the frame's handlers in their place:

```ts
  // Delegated: the menus and panels are redrawn as they open.
  function onChromeClick(e: MouseEvent): void {
    const target = e.target as Element;
    if (target.closest('.menu-button')) return dispatch({ type: 'menu' });
    if (target.closest('.story-leave')) return dispatch({ type: 'choose', panel: 'overlay' });
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'story') return dispatch({ type: 'story' });
    if (action === 'restart') {
      openStory(0, 'ease', 'open');
      rememberStoryFolded(false);
      syncUrl(true);
      return;
    }
    const panelName = action ?? target.closest<HTMLElement>('[data-panel]')?.dataset.panel;
    if (panelName) dispatch({ type: 'choose', panel: panelName as Panel });
  }
  for (const id of ['panel', 'rail', 'top-bar']) {
    document.getElementById(id)!.addEventListener('click', onChromeClick);
  }

  // On a phone the grabber takes the open sheet to full height and back on a
  // tap, and a vertical drag does the same or folds it, judged on release.
  const grabber = document.getElementById('sheet-grabber')!;
  let dragFrom: number | null = null;
  let dragged = false;
  grabber.addEventListener('pointerdown', (e) => {
    dragFrom = e.clientY;
    dragged = false;
    grabber.setPointerCapture(e.pointerId);
  });
  grabber.addEventListener('pointerup', (e) => {
    if (dragFrom === null) return;
    const dy = e.clientY - dragFrom;
    dragFrom = null;
    if (Math.abs(dy) < DRAG_PX) return;
    dragged = true;
    dispatch({ type: 'drag', dy });
  });
  grabber.addEventListener('pointercancel', () => {
    dragFrom = null;
  });
  grabber.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragged) {
      dragged = false;
      return;
    }
    dispatch({ type: 'drag', dy: frame.full ? DRAG_PX : -DRAG_PX });
  });

  // Typing wants room for the words and their results.
  panel.addEventListener('focusin', (e) => {
    if (e.target instanceof HTMLInputElement) dispatch({ type: 'typing' });
  });

  // An exploring phone's sheet is as tall as its content; the map and the verse
  // popup make room for it. Full height, and the story's menu, grow over the map instead.
  new ResizeObserver(() => {
    if (!phoneLayout.matches || frame.full || frame.menu) return;
    document.documentElement.style.setProperty('--sheet-shown', `${panel.offsetHeight}px`);
  }).observe(panel);
```

**5n. The story's place in its header.** In `arriveAtStop` (near line 1299), after `lastSyncedStopId = stop.id;`, add:

```ts
    storyProgress.textContent = `${stopAt(resolvedStops, resolvedStops.indexOf(stop)).number} of ${resolvedStops.length}`;
```

**5o. The canvas can now change height with the mode.** On a phone the sheet's height differs between the story and the explore view, so the canvas does too, and a stop's camera is resolved against the canvas's size. In the canvas `ResizeObserver` (near line 990), after `resizeCanvas(); render();`, add:

```ts
      // A stop centres its verse at a height that depends on the canvas's.
      if (typeof resolvedStops !== 'undefined') {
        resolvedStops = resolveStory();
        scheduleStoryFrame();
      }
```

If `resolvedStops` is declared with `let` after this observer, the `typeof` guard does not protect against the temporal dead zone. In that case move the observer's `.observe(canvas)` call to just after `let resolvedStops = resolveStory();` instead, and drop the guard.

**5p. Startup.** At the end of `main()`'s synchronous setup, before `restoreFromUrl` runs, make sure the page starts in the story frame: add `applyFrame();` directly after `let stopElements = renderStoryPanel(…)` (near line 1063).

- [ ] **Step 6: The telemetry comment**

In `src/telemetry/driverChange.ts`, line 3 documents `ExitHow`. Read it, and rewrite it in the present tense so `'fold'` reads as "the reader left the story for the tools: the menu, a rail icon, or the story's last button". Leave the value alone.

Run: `grep -rn "'fold'" scripts/telemetry src/telemetry`
Expected: the saved queries still find the value they filter on.

- [ ] **Step 7: Typecheck and test**

Run: `npm run typecheck`
Expected: no errors. Fix every one in one pass before re-running.

Run: `npx vitest run`
Expected: all pass. A failing test that reads `#right-panel`, the story strip or the footer is testing the removed interface: rewrite it against the frame or delete it, and say which in the commit message.

- [ ] **Step 8: Look at it in a browser**

Start your own dev server (never reuse one that is running):

```bash
npx vite --port 5299 --strictPort
```

Run it in the background and confirm it responds: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5299/` prints `200`.

Check each of these by hand at desktop width, then with the window under 768px wide:
- `http://localhost:5299/` opens the story: the column, the map, one ☰, "1 of 21" in the header.
- ☰ drops the menu over the top of the story, which stays visible and dimmed below; ☰ again lifts it; touching the map lifts it.
- "Overlays" in the menu leaves the story: on a desktop the rail appears with Overlay lit; on a phone the sheet shrinks to the folded line, and the top bar appears.
- The rail's Stories shows "Stop N of 21" with the stop the story was at; Continue returns to it; "Start from the beginning" goes to stop 1.
- About & settings shows Hide Hebrew; it hides the Hebrew in the verse popup and in the map's labels, and survives a reload.
- On a desktop with About open, the overlay's folded line sits at the bottom of the column; clicking it opens the overlay panel.
- On a phone, the folded line opens the overlay panel; the grabber takes it to full height and back; dragging it down folds it; panning the map hides the top bar except its ☰, which comes back 2 seconds after the map stops.
- The story's last stop, "Explore the map yourself", opens the explore view.
- `http://localhost:5299/#overlay=commentary` opens straight into the explore view; Back returns to the story if it came from there.

Stop the server by its PID when done.

- [ ] **Step 9: Commit**

```bash
git add -A index.html src
git commit -m "The frame: the story as a mode, a rail and panel on desktop, a sheet on a phone

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Say how the interface works now

**Files:**
- Modify: `CLAUDE.md` (Features, Interactions)

- [ ] **Step 1: Update CLAUDE.md**

In **Features**, the overlay bullet ends "…and the help modal's Overlays tab is built from them." Change it to "…shown under the overlay picker." The story bullet says the story lives "in the right panel" and that "folding it away leaves the overlay controls". Change it to:

```markdown
- **A guided story**, a mode of its own. Scrolling it moves the map from stop to
  stop; its ☰ menu leads to the overlays, the stories and About & settings,
  and choosing one leaves the story where it is, to be continued later. The
  text is `public/data/story.md`, which the dev server hot-reloads.
```

In **Interactions**, the opening line points at "The help modal's Controls tab"; change it to "The About panel's Controls list". Replace the **Story strip** bullet with:

```markdown
- **☰** - The menu: continue the story, overlays, stories, About & settings
- **Rail** (desktop) - Open a tool's panel; anything on but not open is folded
  to a line at the bottom of the panel
- **Sheet** (phone) - Tap a folded line to open it; the grabber takes it to
  full height and back, and a drag down folds it
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Describe the frame in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Layout tests for the frame

**Depends on:** the `layout-tests` branch (`docs/plans/2026-09-23-layout-tests-implementation.md`) merged into `main`. If it has not merged, stop here, open the PR as a draft with Tasks 1-4, and say so.

**Files:**
- Modify: `layout/app.spec.ts`, `layout/known.ts`

**Interfaces:**
- Consumes: `openMap`, `mapPixels` (`layout/page.ts`); `checkLayout`, `Chrome` (`layout/check.ts`); `KNOWN` (`layout/known.ts`).

- [ ] **Step 1: Bring the layout tests in**

```bash
git fetch origin
git rebase origin/main
npm install
```

Expected: `ls layout/app.spec.ts` exists.

- [ ] **Step 2: Point the rules at the frame's chrome and states**

In `layout/app.spec.ts`, replace `CHROME` and `STATES` with:

```ts
const CHROME: Chrome = {
  fixed: '#panel, #rail, #zoom-controls, #verse-popup.visible',
  map: '#canvas',
  panel: '#panel, #rail',
  interactive:
    '#panel button, #panel select, #panel input, #panel a, #rail button, #top-bar button, ' +
    '#verse-popup button, #verse-popup a, #zoom-controls button',
  text: '.folded-line, .menu-item, .rail-label, #story-progress, #panel label, #verse-popup .ref-text',
};

/** Opens a menu item by whichever ☰ is showing: the story's, the rail's, or the phone's. */
async function viaMenu(page: Page, action: string): Promise<void> {
  await page.locator('.menu-button:visible').first().click();
  await page.locator(`.menu-item[data-action="${action}"]:visible`).click();
}

const STATES: State[] = [
  { name: 'story-opening', hash: 'story=intro' },
  { name: 'story-stop-with-verse', hash: 'story=abraham_call' },
  {
    name: 'story-menu-down',
    hash: 'story=abraham_call',
    then: (page) => page.locator('#story-menu').click(),
  },
  { name: 'explore-link', hash: 'overlay=commentary' },
  {
    name: 'explore-overlay-open',
    hash: 'overlay=commentary',
    then: (page) => viaMenu(page, 'overlay'),
  },
  {
    name: 'explore-search',
    hash: `overlay=search&q=${encodeURIComponent('אברהם')}`,
    then: (page) => viaMenu(page, 'overlay'),
  },
  { name: 'explore-verse-pinned', hash: 'overlay=commentary&verse=Genesis.12.1' },
  { name: 'stories-panel', hash: 'overlay=commentary', then: (page) => viaMenu(page, 'stories') },
  { name: 'about-panel', hash: 'overlay=commentary', then: (page) => viaMenu(page, 'about') },
];
```

The top bar is left out of `fixed` on purpose: on a phone it lies over the map by design, and the map-and-panel rule would report it.

- [ ] **Step 3: Start `known.ts` again**

Every entry in `layout/known.ts` describes the interface this branch removed. Empty it back to `{}`; stale keys naming states that no longer exist would never be checked and never be noticed.

- [ ] **Step 4: Run, and bring the failures to Danyel**

Run: `npm run test:layout`
Expected: the list reporter shows each failing `state/screen/rule` with its violations, and `layout-report/index.html` is written.

Fix what is plainly a defect of the frame — overlap, clipping, a small touch target — in `src/styles/frame.css`, and re-run. What remains, or anything whose fix is a judgement, goes to Danyel with the contact sheet before it enters `known.ts`.

- [ ] **Step 5: Commit**

```bash
git add layout/
git commit -m "Layout tests cover the frame's states

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Open the PR

- [ ] **Step 1: Every gate**

Run: `npm run typecheck && npx vitest run && npm run test:layout`
Expected: all pass (the last only if Task 5 ran).

- [ ] **Step 2: Screenshots for the PR**

Copy three or four cells from `layout-report/shots/` — the story with its menu down, the explore view on a desktop, a phone at rest, a phone with a panel open — into `docs/plans/images/2026-09-23-ui-frame/`, commit them, push, and embed them in the PR body by commit-pinned URL (`https://raw.githubusercontent.com/danyelf/torahmap/<sha>/docs/plans/images/…`). Relative paths 404 until the PR merges.

- [ ] **Step 3: Push and open it**

```bash
git push -u origin ui-frame
gh pr create --base main --title "The frame: stories as a mode, a rail on desktop, a sheet on a phone" --body "…"
```

The body leads with what changed for a reader, then embeds the screenshots, then lists **Decisions this plan takes that Danyel has not seen** from the top of this plan, then says what to look at on the preview link: the story's ☰, leaving and continuing the story, a phone's folded line and grabber, About & settings. It says `Closes #236` and `Refs #234, #235, #237`. It ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Expected: the PR URL is printed. `gh pr view --json comments` shows the Cloudflare preview link once the build finishes; put that link in a PR comment addressed to Danyel.

---

## Self-Review

- **Spec coverage.** The design's frame: the story as a mode with only ☰ (Task 3 markup and `data-mode`); the menu dropping into the story's column with the stop visible below (`#menu`, `body[data-menu] #story-content`); "Continue the story" first (`menuHtml`); leaving through the menu or the story's end, landing on the story's view (`leaveStory`, which keeps `takeOver('fold')`); the rail on desktop and the sheet on a phone (`frame.css`); folded lines (`#folded`); the phone's top bar hiding while the map moves (`mapMoved`); the sheet as tall as its content, capped at half, dragged to full, constant in a story (`frame.ts`, `frame.css`); the help window dissolved into About (Task 2); each overlay's description by its picker (Task 3, 5h). Out of scope by the design's order of work: search as its own tool, share, several stories.
- **Placeholders.** The PR body is described rather than written, because it embeds screenshots taken in Task 5.
- **Names.** `Frame`, `FrameEvent`, `Panel`, `STORY`, `DRAG_PX`, `exploreFrame`, `nextFrame`, `StoryPlace`, `menuHtml`, `storiesHtml`, `aboutHtml`, `applyHebrewChoice`, `bindHebrewToggle`, `applyFrame`, `setFrame`, `dispatch`, `leaveStory`, `mapMoved`, `storyPlace` are each defined once and used with the same signatures.
