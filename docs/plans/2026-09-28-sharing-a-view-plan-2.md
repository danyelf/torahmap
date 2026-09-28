# Sharing a view, part 2: Share, the tab title, and the story's link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A *Share this view* item in the ☰ menu that copies (or, on a touch
screen, shares) the link to what is on screen; a tab title that names the
view; and an address bar that follows the reader once they take the map
inside a story.

**Architecture:** `@torahmap/link` gains `describeLink(state, names)`, the
title and description table from the spec, with the names it cannot know
(overlays, stories) passed in; the catalog and the stories package export
them. The page sets the tab title from the address after every write and
restore. One function decides the link for the screen from the mode and who
drives. Share reads the address bar, which that function keeps current.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Playwright layout tests.

**Spec:** `docs/plans/2026-09-28-sharing-a-view.md` — this plan is its second
pull request ("How it lands", item 2). Part 1 (#278) is merged into this
branch's base.

## Global Constraints

- Tagline, verbatim: `A Visual Concordance of the Hebrew Bible.`
- Title separator: ` · ` (space, U+00B7 middle dot, space). Site name: `Torahmap`.
- Menu labels, verbatim: `Share this view`, `Share this stop`, `Link copied ✓`,
  `Couldn't copy`. The confirmation shows for 1500 ms, then the menu closes.
- The share sheet is used only when `navigator.share` exists **and**
  `matchMedia('(pointer: coarse)')` matches; everything else copies.
- Off the live site the tab title keeps its branch suffix: `… · Torahmap [<branch>]`,
  as `src/main.ts:186` does today.
- Packages never import from `src/`; `src/` imports packages by name. `@torahmap/link`
  must not import `@torahmap/stories` or `@torahmap/overlay-catalog` (both import it).
- No new dependencies. No telemetry in this part (part 3 adds it).
- Comments follow AGENTS.md: present tense, only what the code cannot say.
- Every commit passes the pre-commit hook.

## Review Focus

1. **Escape or a click elsewhere during *Link copied ✓*** must not be undone by
   the 1500 ms timer reopening or re-toggling the menu. (Task 4, Step 1.)
2. **The reader pans in a story, then scrolls the story on** — the story takes
   the map back and the address returns to the stop, replacing rather than
   adding a history entry. (Task 3, Step 1.)
3. **Back and Forward** set the tab title too, not only writes. (Task 2, Step 5.)
4. **A story or overlay id the link names but nobody knows** (a deleted story,
   a hidden overlay) describes as if it were absent, never "undefined". (Task 1, Step 1.)
5. **A stop whose text opens with Markdown** (`**אברם**`, `*Lekh lekha*`, a
   link) gives a plain first sentence. (Task 1, Step 1.)

---

## File structure

- `packages/link/src/describe.ts` — `describeLink`, `LinkNames`, `TAGLINE`, `SITE_NAME`
- `packages/link/test/describe.test.ts`
- `packages/stories/src/names.ts` — `storyTitle`, `stopOpening`
- `packages/stories/test/names.test.ts`
- `src/linkNames.ts` — the `LinkNames` the page passes, and `tabTitle(state)`
- `src/linkForScreen.ts` — which link the screen has
- `src/share.ts` — `shareLink(url, title, env)`: share sheet or copy, and the outcome
- Modified: `packages/link/src/index.ts`, `packages/stories/src/index.ts`,
  `src/menu.ts`, `src/main.ts`, `src/styles/frame.css`, `src/aboutPanel.ts`,
  `layout/app.ts`, `CLAUDE.md`, tests beside each.

---

### Task 1: Describing a link

**Files:**
- Create: `packages/link/src/describe.ts`, `packages/link/test/describe.test.ts`,
  `packages/stories/src/names.ts`, `packages/stories/test/names.test.ts`
- Modify: `packages/link/src/index.ts`, `packages/stories/src/index.ts`

**Interfaces — produces:**
```ts
// @torahmap/link
export const SITE_NAME = 'Torahmap';
export const TAGLINE = 'A Visual Concordance of the Hebrew Bible.';
export interface LinkNames {
  overlayName(id: string): string | undefined;
  storyTitle(id: string): string | undefined;
  stopOpening(storyId: string, stopId: string): string | undefined;
}
export interface LinkDescription { title: string; description: string }
export function describeLink(state: UrlState, names: LinkNames): LinkDescription;

// @torahmap/stories
export function storyTitle(id: string): string | undefined;
/** The first sentence of a stop's text, as plain text. */
export function stopOpening(storyId: string, stopId: string): string | undefined;
```
`overlayName` already exists in `@torahmap/overlay-catalog`.

- [ ] **Step 1: Write the failing tests.** `packages/link/test/describe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeLink, readLink, TAGLINE, type LinkNames } from '@torahmap/link';

const names: LinkNames = {
  overlayName: (id) => ({ commentary: 'Commentary' })[id],
  storyTitle: (id) => ({ tour: 'The Guided Tour' })[id],
  stopOpening: (s, stop) =>
    s === 'tour' && stop === 'abraham_zoom' ? 'We can overlay the map with data.' : undefined,
};
const describeQuery = (q: string) => describeLink(readLink(q), names);

describe('describeLink', () => {
  it('names a pinned verse, with the overlay in the description', () => {
    expect(describeQuery('?verse=Genesis.12.1&overlay=commentary')).toEqual({
      title: 'Genesis 12:1 · Torahmap',
      description: `Commentary overlay. ${TAGLINE}`,
    });
  });

  it('names a search', () => {
    expect(describeQuery('?search=אברם')).toEqual({
      title: 'Search: אברם · Torahmap',
      description: TAGLINE,
    });
  });

  it('puts the verse before the search', () => {
    expect(describeQuery('?search=אברם&overlay=commentary&verse=Genesis.12.1')).toEqual({
      title: 'Genesis 12:1 · Search: אברם · Torahmap',
      description: `Commentary overlay. ${TAGLINE}`,
    });
  });

  it('names a story stop by its story, and opens with the stop', () => {
    expect(describeQuery('?story=tour&stop=abraham_zoom')).toEqual({
      title: 'The Guided Tour · Torahmap',
      description: `We can overlay the map with data. ${TAGLINE}`,
    });
  });

  it('names the site alone for the plain map or a camera', () => {
    const plain = { title: 'Torahmap', description: TAGLINE };
    expect(describeQuery('')).toEqual(plain);
    expect(describeQuery('?zoom=2&x=10&y=20')).toEqual(plain);
  });

  it('writes a book with a number the way readers do', () => {
    expect(describeQuery('?verse=I.Samuel.1.5').title).toBe('I Samuel 1:5 · Torahmap');
  });

  it('describes an unknown story or overlay as if it were absent', () => {
    expect(describeQuery('?story=gone&stop=x')).toEqual({ title: 'Torahmap', description: TAGLINE });
    expect(describeQuery('?overlay=text-dating').description).toBe(TAGLINE);
    expect(describeQuery('?story=tour&stop=gone').description).toBe(TAGLINE);
  });
});
```

`packages/stories/test/names.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { storyTitle, stopOpening } from '@torahmap/stories';

describe('story names', () => {
  it('titles a story by id', () => {
    expect(storyTitle('tour')).toBe('The Guided Tour');
    expect(storyTitle('gone')).toBeUndefined();
  });

  it("opens with a stop's first sentence", () => {
    expect(stopOpening('tour', 'abraham_zoom')).toBe(
      'We can overlay the map with data.',
    );
  });

  it('gives plain text where the stop is written in Markdown', () => {
    const opening = stopOpening('tour', 'abraham_call');
    expect(opening).toBeDefined();
    expect(opening).not.toMatch(/[*_[\]]/);
  });

  it('knows nothing of a stop the story lacks', () => {
    expect(stopOpening('tour', 'gone')).toBeUndefined();
    expect(stopOpening('gone', 'intro')).toBeUndefined();
  });
});
```

  Check the expected strings against `packages/stories/markdown/tour.md` before
  running; if the story's text has changed, correct the test's expectation to
  the text, not the other way round.

- [ ] **Step 2: Run** — `npx vitest run packages/link/test/describe.test.ts packages/stories/test/names.test.ts`.
  Expected: FAIL (not exported).

- [ ] **Step 3: Implement** `packages/link/src/describe.ts`:

```ts
import { parseVerseFromUrl, type UrlState } from './link';

export const SITE_NAME = 'Torahmap';
export const TAGLINE = 'A Visual Concordance of the Hebrew Bible.';
const SEPARATOR = ' · ';

/** The names a link carries only as ids; the page and the Worker pass the same ones. */
export interface LinkNames {
  overlayName(id: string): string | undefined;
  storyTitle(id: string): string | undefined;
  stopOpening(storyId: string, stopId: string): string | undefined;
}

export interface LinkDescription {
  title: string;
  description: string;
}

/**
 * What a link is called in a tab and a chat preview. The title names what the
 * link points at, most specific first, because tabs and previews cut from the
 * right.
 */
export function describeLink(state: UrlState, names: LinkNames): LinkDescription {
  if (state.story) {
    const title = names.storyTitle(state.story);
    const opening = state.stop ? names.stopOpening(state.story, state.stop) : undefined;
    return {
      title: title ? [title, SITE_NAME].join(SEPARATOR) : SITE_NAME,
      description: opening ? `${opening} ${TAGLINE}` : TAGLINE,
    };
  }
  const verse = state.verse ? parseVerseFromUrl(state.verse) : null;
  const search = state.searchParams?.search;
  const parts = [
    verse && `${verse.book} ${verse.chapter}:${verse.verse}`,
    search && `Search: ${search}`,
    SITE_NAME,
  ].filter(Boolean);
  const overlay = state.overlay ? names.overlayName(state.overlay) : undefined;
  return {
    title: parts.join(SEPARATOR),
    description: overlay ? `${overlay} overlay. ${TAGLINE}` : TAGLINE,
  };
}
```

  Export `describeLink`, `LinkNames`, `LinkDescription`, `SITE_NAME`, `TAGLINE`
  from `packages/link/src/index.ts`.

  Move the building of `STORIES` out of `packages/stories/src/index.ts` into
  `packages/stories/src/stories.ts` (so `names.ts` can import it without a
  cycle through `index.ts`); `index.ts` re-exports it. Then
  `packages/stories/src/names.ts`:

```ts
export function storyTitle(id: string): string | undefined {
  return STORIES.find((s) => s.id === id)?.data.title || undefined;
}

export function stopOpening(storyId: string, stopId: string): string | undefined {
  const stop = STORIES.find((s) => s.id === storyId)?.data.stops.find((s) => s.id === stopId);
  if (!stop) return undefined;
  const text = plainText(stop.text);
  return text.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? (text || undefined);
}

/** Markdown emphasis and links reduced to their words, on one line. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}
```

  Export both from `packages/stories/src/index.ts`.

- [ ] **Step 4: Run** the two test files. Expected: PASS. Then
  `npm run typecheck && npm test`: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Describe a link: the title and description a tab and a preview show"`

---

### Task 2: The tab title follows the view

**Files:**
- Create: `src/linkNames.ts`, `src/__tests__/unit/linkNames.test.ts`
- Modify: `src/main.ts` (`:186`, `syncUrl`, `restoreFromUrl`)

**Interfaces:**
- Consumes: `describeLink`, `LinkNames` (Task 1); `overlayName` (catalog);
  `storyTitle`, `stopOpening` (stories); `parseUrlState` (src/urlState.ts).
- Produces:
```ts
/** The names the page describes links with. */
export const LINK_NAMES: LinkNames;
/** The tab's title for a view: its description's title, and the branch off the live site. */
export function tabTitle(state: UrlState, branch: string): string;
```

- [ ] **Step 1: Write the failing test** `src/__tests__/unit/linkNames.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readLink } from '@torahmap/link';
import { tabTitle } from '../../linkNames';

describe('tabTitle', () => {
  it('is the view’s title on the live site', () => {
    expect(tabTitle(readLink('?verse=Genesis.12.1'), 'main')).toBe('Genesis 12:1 · Torahmap');
  });

  it('keeps the branch name anywhere else', () => {
    expect(tabTitle(readLink('?verse=Genesis.12.1'), 'share-view-2')).toBe(
      'Genesis 12:1 · Torahmap [share-view-2]',
    );
  });

  it('names a story by its real title', () => {
    expect(tabTitle(readLink('?story=tour&stop=intro'), 'main')).toBe('The Guided Tour · Torahmap');
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/__tests__/unit/linkNames.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `src/linkNames.ts`:

```ts
import { describeLink, type LinkNames, type UrlState } from '@torahmap/link';
import { overlayName } from '@torahmap/overlay-catalog';
import { storyTitle, stopOpening } from '@torahmap/stories';

export const LINK_NAMES: LinkNames = { overlayName, storyTitle, stopOpening };

export function tabTitle(state: UrlState, branch: string): string {
  const { title } = describeLink(state, LINK_NAMES);
  return branch === 'main' ? title : `${title} [${branch}]`;
}
```

  In `src/main.ts`: replace the fixed title at `:186` with a function

```ts
function showTitle(): void {
  document.title = tabTitle(parseUrlState(overlayParamSpecs), __GIT_BRANCH__);
}
```

  called at the end of `syncUrl` (after `updateUrl`), at the end of
  `restoreFromUrl`, and once at startup after the link is restored. The title
  is read back from the address rather than from the state `syncUrl` built, so
  it can never name a view the address does not hold (a write suppressed by
  `applyingExternalState` leaves both unchanged).

- [ ] **Step 4: Run** — the new tests, then `npm run typecheck && npm test`. Expected: PASS.

- [ ] **Step 5: Check by hand.** Start your own `npm run dev` in the background
  (let Vite pick the port; read it from the output). With a Playwright script
  in the scratchpad (chromium headless, the SwiftShader flags from
  `layout/playwright.config.ts`): open `/?verse=Genesis.12.1&overlay=commentary`
  → title starts `Genesis 12:1 · Torahmap`; choose another overlay, then
  `history.back()` → the title still matches the address. Stop your server.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Name the view in the tab's title"`

---

### Task 3: The address bar follows the reader inside a story

**Files:**
- Create: `src/linkForScreen.ts`, `src/__tests__/unit/linkForScreen.test.ts`
- Modify: `src/main.ts` (`syncUrl` at ~`:938` and its doc comment, `takeOver` at ~`:651`)

**Interfaces — produces:**
```ts
/**
 * The link for what is on screen: the story's stop while the story has the
 * map, and otherwise the reader's own view.
 */
export function linkForScreen(screen: {
  mode: 'story' | 'explore';
  driver: DriverKind;            // from src/scrollytelling/driver.ts
  story: { id: string; stop: string };
  explore: () => UrlState;       // built only when needed
}): UrlState;
```

- [ ] **Step 1: Write the failing test** `src/__tests__/unit/linkForScreen.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { linkForScreen } from '../../linkForScreen';

const view = { verse: 'Genesis.12.1', overlay: 'commentary', overlayParams: {} };
const story = { id: 'tour', stop: 'abraham_call' };

describe('linkForScreen', () => {
  it('names the stop while the story has the map', () => {
    const explore = vi.fn(() => view);
    expect(linkForScreen({ mode: 'story', driver: 'story', story, explore })).toEqual({
      story: 'tour',
      stop: 'abraham_call',
      overlayParams: {},
    });
    expect(explore).not.toHaveBeenCalled();
  });

  it("is the reader's view once they take the map inside a story", () => {
    expect(linkForScreen({ mode: 'story', driver: 'reader', story, explore: () => view })).toBe(view);
  });

  it("is the reader's view while exploring", () => {
    expect(linkForScreen({ mode: 'explore', driver: 'reader', story, explore: () => view })).toBe(view);
  });
});
```

- [ ] **Step 2: Run** it. Expected: FAIL.

- [ ] **Step 3: Implement** `src/linkForScreen.ts` as the interface says, and
  in `src/main.ts`:

```ts
/**
 * Write the URL for what is on screen. `push` adds a history entry, for a
 * discrete step rather than a pan or a scroll.
 */
function syncUrl(push: boolean = false): void {
  updateUrl(
    linkForScreen({
      mode: frame.mode,
      driver: driverKind(driver),
      story: { id: story.id, stop: resolvedStops[storyStopIndex()].id },
      explore: buildCurrentUrlState,
    }),
    push,
  );
  showTitle();
}
```

  In `takeOver`, after `applyTools()`, add `syncUrl(true)` so taking the map is
  a Back step. The story taking the map back already calls `syncUrl()` (a
  replace) on each story frame (`main.ts` ~`:1634`), which returns the address
  to the stop without adding an entry; confirm that call is reached when the
  driver goes from `reader` to `rejoining` to `story`, and say in your report
  where.

- [ ] **Step 4: Run** — the new test, then `npm run typecheck && npm test`. Expected: PASS.

- [ ] **Step 5: Check by hand** (your own dev server, a scratchpad Playwright
  script as in Task 2): open `/?story=tour&stop=abraham_call` on a desktop
  viewport; drag the map → the address becomes an explore link (`?…verse=` or
  `x=`/`y=`, no `story=`), and `history.length` grew by one; scroll the story
  panel (`#story-content`) down past the next stop → the address names a stop
  again and `history.length` did not grow; `history.back()` from the explore
  entry returns to the stop. Report what you observed.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "The address follows the reader who takes the map inside a story"`

---

### Task 4: Share in the menu

**Files:**
- Create: `src/share.ts`, `src/__tests__/unit/share.test.ts`
- Modify: `src/menu.ts`, `src/__tests__/unit/menu.test.ts`, `src/main.ts`
  (`applyFrame` menu drawing ~`:532`, `onChromeClick` ~`:1415`),
  `src/styles/frame.css`

**Interfaces — produces:**
```ts
// src/menu.ts
export const SHARE = 'share';
export function menuHtml(place: StoryPlace & { title: string; sharing: 'view' | 'stop' }): string;

// src/share.ts
export type ShareOutcome = 'copied' | 'share_sheet' | 'cancelled' | 'failed';
export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  writeText: (text: string) => Promise<void>;
  coarsePointer: boolean;
}
/** Send a link: the system share sheet on a touch screen that has one, otherwise the clipboard. */
export function shareLink(url: string, title: string, env: ShareEnv): Promise<ShareOutcome>;
/** After `ms`, close the menu if it is still open. */
export function closeAfterConfirming(isOpen: () => boolean, close: () => void, ms: number): void;
```
`ShareOutcome` is what part 3's `share` event records as `how`.

- [ ] **Step 1: Write the failing tests.** `src/__tests__/unit/share.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { shareLink } from '../../share';

const url = 'https://torahmap.org/?verse=Genesis.12.1';

describe('shareLink', () => {
  it('copies on a screen without a share sheet', async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { writeText, coarsePointer: false })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('copies with a mouse even where a share sheet exists', async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { share, writeText, coarsePointer: false })).toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });

  it('opens the share sheet on a touch screen', async () => {
    const share = vi.fn(async () => {});
    expect(await shareLink(url, 'Genesis 12:1 · Torahmap', { share, writeText: vi.fn(), coarsePointer: true })).toBe('share_sheet');
    expect(share).toHaveBeenCalledWith({ url, title: 'Genesis 12:1 · Torahmap' });
  });

  it('reports a share sheet the reader backed out of', async () => {
    const share = vi.fn(async () => { throw new DOMException('', 'AbortError'); });
    expect(await shareLink(url, 't', { share, writeText: vi.fn(), coarsePointer: true })).toBe('cancelled');
  });

  it('copies when the share sheet refuses', async () => {
    const share = vi.fn(async () => { throw new DOMException('', 'NotAllowedError'); });
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { share, writeText, coarsePointer: true })).toBe('copied');
  });

  it('fails when the copy fails', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied'); });
    expect(await shareLink(url, 't', { writeText, coarsePointer: false })).toBe('failed');
  });
});
```

  In `src/__tests__/unit/menu.test.ts`, update the order test and add:

```ts
it('then the search, the overlays, the stories, and about', () => {
  const actions = items(menuHtml({ number: 1, total: 21, title: 'x', sharing: 'view' })).map(
    (b) => b.dataset.action,
  );
  expect(actions).toEqual(['story', 'share', 'search', 'overlay', 'stories', 'about']);
});

it('offers to share the view, or the stop while the story has the map', () => {
  const label = (sharing: 'view' | 'stop') =>
    items(menuHtml({ number: 1, total: 2, title: 'x', sharing })).find(
      (b) => b.dataset.action === 'share',
    )?.textContent;
  expect(label('view')).toBe('Share this view');
  expect(label('stop')).toBe('Share this stop');
});

it('sets the two actions apart from the tools', () => {
  const div = document.createElement('div');
  div.innerHTML = menuHtml({ number: 1, total: 2, title: 'x', sharing: 'view' });
  const share = div.querySelector('[data-action="share"]');
  expect(share?.nextElementSibling?.classList.contains('menu-divider')).toBe(true);
});
```

  (Every other `menuHtml(...)` call in the file gains `sharing: 'view'`.)

  For Review Focus 1, in `share.test.ts`:

```ts
import { closeAfterConfirming } from '../../share';

describe('closeAfterConfirming', () => {
  it('closes the menu once the confirmation has shown', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    closeAfterConfirming(() => true, close, 1500);
    vi.advanceTimersByTime(1499);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('leaves alone a menu the reader already closed', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    closeAfterConfirming(() => false, close, 1500);
    vi.advanceTimersByTime(1500);
    expect(close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/__tests__/unit/share.test.ts src/__tests__/unit/menu.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** `src/share.ts`:

```ts
export async function shareLink(url: string, title: string, env: ShareEnv): Promise<ShareOutcome> {
  if (env.share && env.coarsePointer) {
    try {
      await env.share({ url, title });
      return 'share_sheet';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await env.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
```

  `src/menu.ts`: after the Continue item, `item(SHARE, sharing === 'stop' ?
  'Share this stop' : 'Share this view')`, then
  `'<div class="menu-divider" role="separator"></div>'`. In
  `src/styles/frame.css`, beside `.menu-item`:

```css
.menu-divider {
  margin: 6px 0;
  border-top: 1px solid #333;
}
```

  `src/main.ts`:
  - where the menu is drawn (~`:532`), pass
    `sharing: frame.mode === 'story' && driverKind(driver) === 'story' ? 'stop' : 'view'`.
  - in `onChromeClick`, before the panel choosing, handle the share item:

```ts
if (action === SHARE) {
  const item = target.closest<HTMLElement>('[data-action]')!;
  syncUrl(false); // a pan's debounced write may not have landed yet
  const outcome = await shareLink(location.href, describeLink(parseUrlState(overlayParamSpecs), LINK_NAMES).title, {
    share: navigator.share?.bind(navigator),
    writeText: (t) => navigator.clipboard.writeText(t),
    coarsePointer: matchMedia('(pointer: coarse)').matches,
  });
  if (outcome === 'copied' || outcome === 'failed') {
    item.innerHTML = outcome === 'copied' ? 'Link copied <span class="menu-detail">✓</span>' : "Couldn't copy";
    closeAfterConfirming(() => frame.menu, () => dispatch({ type: 'menu' }), 1500);
  } else if (frame.menu) {
    dispatch({ type: 'menu' });
  }
  return;
}
```

  (`onChromeClick` becomes `async`, or the share branch calls an async helper;
  keep the rest synchronous. `navigator.clipboard` is absent outside a secure
  context: guard so a missing clipboard counts as `failed`, not a thrown
  TypeError.) Whether the ✓ is accent-coloured: match the mockup the plan was
  approved from — `Link copied` in the item's colour, `✓` in `var(--accent)`;
  give it its own class rather than borrowing `.menu-detail` if that reads
  wrong.

- [ ] **Step 4: Run** — the two test files, then `npm run typecheck && npm test`. Expected: PASS.

- [ ] **Step 5: Check by hand** (own dev server, scratchpad Playwright, desktop
  viewport, grant `clipboard-read`/`clipboard-write` to the context): open
  `/?verse=Genesis.12.1&overlay=commentary`, open ☰ → the item under Continue
  reads *Share this view*; click it → the label reads *Link copied ✓*; the
  clipboard holds the page's URL; after ~1.6 s the menu is closed. Repeat and
  press Escape at once → the menu stays closed after 1.6 s. Open
  `/?story=tour&stop=abraham_call` → the item reads *Share this stop*; drag the
  map, reopen ☰ → *Share this view*.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Share this view, from the menu"`

---

### Task 5: Layout, documentation, and the pull request

**Files:** `layout/app.ts`, `src/aboutPanel.ts`, `CLAUDE.md`, `layout-report/shots/` (committed for the PR)

- [ ] **Step 1: Layout states.** In `layout/app.ts`, add
  `'.menu-item[data-action="share"]'` to `shown` in `story-menu-down` and
  `explore-menu-down`, and a new state:

```ts
{
  name: 'explore-link-copied',
  link: 'overlay=commentary',
  then: async (page) => {
    await page.locator('#menu-toggle').click();
    await page.locator('.menu-item[data-action="share"]:visible').click();
  },
  shown: ['#menu', '.menu-item[data-action="share"]'],
},
```

  In headless Chromium a touch screen may have no share sheet, and a copy may
  fail without clipboard permission; either label must fit. The harness
  measures right after `then` returns, well inside the 1500 ms; if
  `layout/app.spec.ts` shows otherwise, report it rather than lengthening the
  confirmation.

- [ ] **Step 2: The About panel's Controls list** (`src/aboutPanel.ts`): the ☰
  row reads `The menu: continue the story, share this view, search, overlays,
  stories, About &amp; settings`. Its test (`aboutPanel.test.ts`) follows if it
  pins the text.

- [ ] **Step 3: `CLAUDE.md`.** Under Interactions, the ☰ line becomes
  "The menu: continue the story, share this view, search, overlays, stories,
  About & settings; Escape closes it", and after the URL paragraph add one
  sentence: "*Share this view* in the menu copies that link, or opens the share
  sheet on a touch screen; the tab's title names the view (`describeLink`)."

- [ ] **Step 4: Run** `npm run test:layout` (check port 5199 is free first).
  Expected: PASS apart from `layout/known.ts`. Read the new state's PNG and the
  two menu-down PNGs at desktop and phone.

- [ ] **Step 5: Commit** the code changes; commit the PNGs for the touched
  states (`story-menu-down`, `explore-menu-down`, `explore-link-copied`, at
  desktop and phone) in their own commit so the PR can link them by
  commit-pinned URL.
