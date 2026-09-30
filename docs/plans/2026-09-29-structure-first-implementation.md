# Draw the Map From the Structure File Alone: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the first frame once `tanakh-structure.json` is laid out, waiting
beyond that only for the data the link names; load everything else after.

**Architecture:** Every tool (the search and each overlay) is made ready by its
own `init`, run once by `ready(tool)` in a new `src/dataLoading.ts`. A tool
that is not ready is left off the map in `toolsShown`, the one place exploring
and the story both ask what is on. `main` waits for what the link needs, draws,
then starts the rest and cross-fades each tool in as it arrives.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom; `src/__tests__/setup.ts`
serves `public/` from disk for `fetch`), Playwright for the layout tests and the
timing script.

**Spec:** `docs/plans/2026-09-29-structure-first-design.md`

## Global Constraints

- Every change to the map's picture goes through the renderer's cross-fade; no
  new animation path.
- No loading indicator anywhere.
- A link waits for exactly what it names: its overlay, its search, the texts for
  a pinned verse, and the same for the story stop it opens. Nothing else.
- Order: structure; what the link names; first frame and `data-map-ready`; then
  every other load at once.
- Comments describe the code as it is now; no ticket numbers in code (AGENTS.md).
- Tests check behaviour: no assertions on reader-visible wording, shipped-data
  counts or timings.
- `npm`, not `pnpm`, in this repository.

## Review Focus

1. A link naming an overlay and a search (`search=…&overlay=haftarah`) waits for
   both before the first frame, and shows both.
2. A search term typed before the dictionary arrives ends up with its meanings
   and its results once it does, without the reader retyping.
3. A reader who picks an overlay in the first second sees the map fade to it
   when its data lands, not stay plain until the next interaction.
4. A story stop scrolled to before its overlay is ready shows it once the data
   lands, and is not stuck showing the plain map from a cached picture.
5. Back/Forward to a search link before the dictionary arrives behaves as 2.

Tests pinning 1 and 4 are in Tasks 4 and 2; 2 and 5 in Task 3; 3 is checked by
hand in Task 5, since `main` has no unit tests.

---

### Task 0: Baseline timing

**Files:**
- Create (scratch, not committed): `$SCRATCH/measure-first-frame.mjs`, where
  `$SCRATCH` is the session scratchpad directory.

- [ ] **Step 1: Write the timing script**

```js
// Cold loads to data-map-ready on a throttled connection.
// Usage: node measure-first-frame.mjs http://localhost:PORT
import { chromium } from 'playwright';

const base = process.argv[2];
const links = ['', 'search=%D7%90%D7%95%D7%A8', 'overlay=commentary', 'verse=Genesis.12.1'];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const link of links) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    // Roughly a slow 4G phone: 1.6 Mbit/s down, 150 ms latency.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1.6e6 / 8,
      uploadThroughput: 750e3 / 8,
    });
    const start = Date.now();
    await page.goto(`${base}/${link ? `?${link}` : ''}`);
    await page.locator('html[data-map-ready]').waitFor({ state: 'attached', timeout: 180_000 });
    times.push(Date.now() - start);
    await context.close();
  }
  console.log(`${link || '(bare address)'}: ${times.join(', ')} ms`);
}
await browser.close();
```

- [ ] **Step 2: Build and serve the production bundle**

Run: `npm run build`, then start `npx vite preview --port 4317 --strictPort` as a
tracked background task. Check compression:
`curl -sI -H 'Accept-Encoding: gzip, br' http://localhost:4317/data/all-texts.json | grep -i content-encoding`.
If there is none, say so in the report: absolute times then overstate a real
load about threefold, but before and after remain comparable.

- [ ] **Step 3: Record the baseline**

Run: `node $SCRATCH/measure-first-frame.mjs http://localhost:4317`
Save the output for the PR. Stop the preview server (its PID only).

---

### Task 1: One load per tool

**Files:**
- Create: `src/dataLoading.ts`
- Modify: `src/verseTexts.ts` (add `allVerseTexts`)
- Modify: `src/overlays/trop.ts`, `src/overlays/verse-length.ts`,
  `src/overlays/search/index.ts` (add `init`)
- Test: `src/__tests__/unit/dataLoading.test.ts`

**Interfaces:**
- Produces: `allVerseTexts(): Promise<VerseTexts>` — downloads once.
- Produces: `interface Loadable { id: string; init?(): Promise<void> }`,
  `ready(tool: Loadable): Promise<void>`, `isReady(tool: Loadable): boolean`.
- Produces: `searchTool.init`, `tropOverlay.init`, `verseLengthOverlay.init`.
  The existing `configure` functions stay, since tests and scripts call them.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { ready, isReady } from '../../dataLoading';
import { allVerseTexts } from '../../verseTexts';
import { tropOverlay } from '../../overlays/trop';

describe('ready', () => {
  it('runs a tool’s init once however often it is asked for', async () => {
    const init = vi.fn(async () => {});
    const tool = { id: 'fake', init };
    await Promise.all([ready(tool), ready(tool), ready(tool)]);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('counts a tool as ready only once its init has finished', async () => {
    let finish!: () => void;
    const tool = { id: 'slow', init: () => new Promise<void>((r) => (finish = r)) };
    const done = ready(tool);
    expect(isReady(tool)).toBe(false);
    finish();
    await done;
    expect(isReady(tool)).toBe(true);
  });

  it('counts a tool with no init as ready from the start', () => {
    expect(isReady({ id: 'plain' })).toBe(true);
  });

  it('counts a failed init as finished, so nothing waits on it for ever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tool = { id: 'broken', init: () => Promise.reject(new Error('404')) };
    await ready(tool);
    expect(isReady(tool)).toBe(true);
    warn.mockRestore();
  });
});

describe('allVerseTexts', () => {
  it('downloads the texts once for every caller', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const [a, b] = await Promise.all([allVerseTexts(), allVerseTexts()]);
    expect(a).toBe(b);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('all-texts')).length).toBe(1);
    fetchSpy.mockRestore();
  });
});

describe('trop init', () => {
  it('builds the trop index from the texts', async () => {
    await ready(tropOverlay);
    const colors = tropOverlay.colorsFor!(
      [{ book: 'Genesis', chapter: 1, verse: 1 }],
      tropOverlay.settingsFromUrl!({} as never),
      null,
    );
    expect(colors[0]).not.toBeNull();
  });
});
```

The trop test's shape depends on trop's `colorsFor`, settings and the default
mark. Read `src/overlays/trop.ts` and adjust it so that it would fail with no
index built: pick a verse that has the default mark, or assert through
`summary` or `getHoverInfo`, whichever is non-empty only with the index.

- [ ] **Step 2: Run the tests; they fail**

Run: `npx vitest run src/__tests__/unit/dataLoading.test.ts`
Expected: FAIL, because `../../dataLoading` does not exist.

- [ ] **Step 3: Implement**

In `src/verseTexts.ts`, after `loadAllVerseTexts`:

```ts
let texts: Promise<VerseTexts> | null = null;

/** Every verse's text, downloaded once and shared by every caller. */
export function allVerseTexts(): Promise<VerseTexts> {
  return (texts ??= loadAllVerseTexts());
}
```

Create `src/dataLoading.ts`:

```ts
// Each tool's data is loaded by its own init, run once here. A tool whose init
// has not finished is left off the map (toolsShown, src/tools.ts).

export interface Loadable {
  id: string;
  init?(): Promise<void>;
}

const started = new Map<Loadable, Promise<void>>();
const finished = new Set<Loadable>();

/**
 * Run `tool`'s init once, however often it is asked for. A failure warns and
 * counts as finished: the tool then shows what it has, as it always has with
 * its data missing, rather than keep everything that waits on it waiting.
 */
export function ready(tool: Loadable): Promise<void> {
  let loading = started.get(tool);
  if (!loading) {
    loading = Promise.resolve()
      .then(() => tool.init?.())
      .catch((err) => console.warn(`Could not load the data for ${tool.id}:`, err))
      .then(() => {
        finished.add(tool);
      });
    started.set(tool, loading);
  }
  return loading;
}

export function isReady(tool: Loadable): boolean {
  return !tool.init || finished.has(tool);
}
```

In `src/overlays/trop.ts`, add to `tropOverlay` (import `allVerseTexts`):

```ts
  async init() {
    configure({ verseTexts: await allVerseTexts() });
  },
```

In `src/overlays/verse-length.ts`, the same on `verseLengthOverlay`.

In `src/overlays/search/index.ts`, on `searchTool` (import `allVerseTexts`,
`loadLexiconData`, `buildSearchIndex`):

```ts
  async init() {
    const [texts] = await Promise.all([allVerseTexts(), loadLexiconData()]);
    buildSearchIndex(texts);
  },
```

- [ ] **Step 4: Run the tests; they pass**

Run: `npx vitest run src/__tests__/unit/dataLoading.test.ts`, then `npx tsc --noEmit`.
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/dataLoading.ts src/verseTexts.ts src/overlays/trop.ts src/overlays/verse-length.ts src/overlays/search/index.ts src/__tests__/unit/dataLoading.test.ts
git commit -m "Load each tool's data through its own init, once"
```

---

### Task 2: Leave a tool off the map until it is ready

**Files:**
- Modify: `src/tools.ts` (`toolsShown`)
- Modify: `src/scrollytelling/overlayBlender.ts` (`pictureForStop`)
- Test: `src/__tests__/unit/tools.test.ts`,
  `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**
- Consumes: `ready`, `isReady` from Task 1.
- Produces: `toolsShown` returns `null` for a tool that is not ready.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/tools.test.ts`, add:

```ts
import { ready } from '../../dataLoading';

describe('toolsShown before the data arrives', () => {
  it('leaves an overlay off until its init has finished', async () => {
    let finish!: () => void;
    const overlay = { ...commentaryOverlay, init: () => new Promise<void>((r) => (finish = r)) };
    const loading = ready(overlay);
    expect(toolsShown(overlay, { category: 'total' }, settingsFromLink(searchTool, {})).overlay).toBeNull();
    finish();
    await loading;
    expect(toolsShown(overlay, { category: 'total' }, settingsFromLink(searchTool, {})).overlay).not.toBeNull();
  });
});
```

and make the existing `describe('toolsShown')` block start with
`beforeAll(() => Promise.all([ready(commentaryOverlay), ready(searchTool)]));`.

In `overlayBlender.test.ts`, add a test that a stop's picture drawn while its
overlay was not ready is not reused once it is: call `pictureForStop` for a stop
whose overlay is a copy of a real overlay with a held-open `init` (as above),
finish the init, call again with the same stop and verses, and expect the second
picture's colours to differ from the first's (the first is all plain).

- [ ] **Step 2: Run them; they fail**

Run: `npx vitest run src/__tests__/unit/tools.test.ts src/scrollytelling/__tests__/overlayBlender.test.ts`
Expected: the new tests FAIL (the overlay is shown while loading; the cached
plain picture is reused).

- [ ] **Step 3: Implement**

`src/tools.ts`:

```ts
    overlay: overlay && isReady(overlay) ? { tool: overlay, settings: overlaySettings } : null,
    search: isSearching(search) && isReady(searchTool) ? { tool: searchTool, settings: search } : null,
```

`src/scrollytelling/overlayBlender.ts`, in `pictureForStop`:

```ts
  // A picture drawn before its tools' data arrived would outlive the data.
  const complete = (!overlay || isReady(overlay)) && isReady(searchTool);
  if (!byHover && complete) cache.set(key, picture);
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. Other tests that put real overlays or the search on the map
through `toolsShown` (integration tests such as `overlay-switching`,
`view-state-restore`, `search-overlay-modes`, and `overlayBlender`) will now see
them as not ready. Fix each by awaiting `ready(tool)` for the tools it uses in a
`beforeAll`, not by weakening `toolsShown`.

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts src/scrollytelling/overlayBlender.ts src/__tests__ src/scrollytelling/__tests__
git commit -m "Leave a tool off the map until its data is in"
```

---

### Task 3: Look up a term's meanings again once the dictionary arrives

**Files:**
- Modify: `src/search/terms.ts`
- Test: `src/__tests__/unit/search-meanings-late.test.ts` (new file, so the
  dictionary starts unloaded)

**Interfaces:**
- Produces: `lookUpMeaningsAgain(terms: SearchTerm[]): SearchTerm[]`. It always
  returns a new array; terms that already have meanings are returned unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { addTerm, lookUpMeaningsAgain } from '../../search/terms';
import { loadLexiconData } from '../../search';

describe('lookUpMeaningsAgain', () => {
  it('gives a term typed before the dictionary arrived its meanings, all checked', async () => {
    const [early] = addTerm([], 'אור');
    expect(early.meanings).toEqual([]);

    await loadLexiconData();
    const [late] = lookUpMeaningsAgain([early]);

    expect(late.id).toBe(early.id);
    expect(late.meanings.length).toBeGreaterThan(0);
    expect(late.selected.size).toBe(late.meanings.length);
  });

  it('leaves a term that has its meanings as it is, with the reader’s choices', async () => {
    await loadLexiconData();
    const [term] = addTerm([], 'אור');
    const narrowed = { ...term, selected: new Set([term.meanings[0].keys[0]]) };
    expect(lookUpMeaningsAgain([narrowed])[0]).toBe(narrowed);
  });
});
```

- [ ] **Step 2: Run it; it fails**

Run: `npx vitest run src/__tests__/unit/search-meanings-late.test.ts`
Expected: FAIL, because `lookUpMeaningsAgain` is not exported. If the first
assertion (`early.meanings` empty) fails instead, `meaningsFor` finds meanings
without the dictionary; stop and report, since the premise is wrong.

- [ ] **Step 3: Implement**, in `src/search/terms.ts` after `resolve`:

```ts
/** Look up the meanings of terms that have none, such as ones typed before the dictionary arrived. */
export function lookUpMeaningsAgain(terms: SearchTerm[]): SearchTerm[] {
  return terms.map((t) => (t.meanings.length > 0 ? t : { ...t, ...resolve(t.text) }));
}
```

- [ ] **Step 4: Run it; it passes**

- [ ] **Step 5: Commit**

```bash
git add src/search/terms.ts src/__tests__/unit/search-meanings-late.test.ts
git commit -m "Look up a search term's meanings again once the dictionary is in"
```

---

### Task 4: What a link needs before its first frame

**Files:**
- Modify: `src/dataLoading.ts`
- Test: `src/__tests__/unit/dataLoading.test.ts`

**Interfaces:**
- Consumes: `UrlState` (`@torahmap/link`), `StoryStop` (`@torahmap/stories`).
- Produces:
  `linkNeeds(link: UrlState, stop: StoryStop | null): { overlays: string[]; search: boolean; texts: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
import { linkNeeds } from '../../dataLoading';

const stop = (fields: Partial<StoryStop>): StoryStop => ({
  id: 's', text: '', camera: { kind: 'verse', ref: 'Genesis.1.1' }, overlay: null, ...fields,
});

describe('linkNeeds', () => {
  it('needs nothing for a bare address opening a plain stop', () => {
    expect(linkNeeds({ overlayParams: {} }, stop({}))).toEqual({ overlays: [], search: false, texts: false });
  });

  it('needs the overlay, the search and the texts a link names', () => {
    expect(
      linkNeeds({ overlay: 'haftarah', verse: 'Genesis.12.1', overlayParams: {}, searchParams: { search: 'אור' } }, null),
    ).toEqual({ overlays: ['haftarah'], search: true, texts: true });
  });

  it('needs what the story stop it opens shows', () => {
    expect(
      linkNeeds({ story: 'haftarah', overlayParams: {} }, stop({ overlay: 'haftarah', searchParams: { search: 'אור' }, verse: 'Isaiah.40.1' })),
    ).toEqual({ overlays: ['haftarah'], search: true, texts: true });
  });

  it('does not need the search for search settings with no word', () => {
    expect(linkNeeds({ overlayParams: {}, searchParams: { mode: 'w' } }, null).search).toBe(false);
  });
});
```

Check the `CameraRef` and `UrlState` shapes against `packages/stories/src/types.ts`
and `packages/link/src/link.ts`, and correct the literals if they differ.

- [ ] **Step 2: Run them; they fail** (`linkNeeds` is not exported)

- [ ] **Step 3: Implement**, in `src/dataLoading.ts`:

```ts
/** What must be in before a link's first frame: its own view, and the story stop it opens. */
export function linkNeeds(
  link: UrlState,
  stop: StoryStop | null,
): { overlays: string[]; search: boolean; texts: boolean } {
  const overlays = [link.overlay, stop?.overlay].filter((id): id is string => !!id);
  return {
    overlays: [...new Set(overlays)],
    search: !!(link.searchParams?.search || stop?.searchParams?.search),
    texts: !!(link.verse || stop?.verse),
  };
}
```

- [ ] **Step 4: Run them; they pass.** Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/dataLoading.ts src/__tests__/unit/dataLoading.test.ts
git commit -m "Work out what a link needs before its first frame"
```

---

### Task 5: Start from the structure in `main`

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ready`, `isReady`, `linkNeeds` (Tasks 1, 4); `allVerseTexts`
  (Task 1); `lookUpMeaningsAgain` (Task 3); `storyToOpen`, `listedStories`,
  `STORIES` (already imported); `colorSource` from `./scrollytelling/driver`.

`main` has no unit tests; this task is checked in the browser.

- [ ] **Step 1: Load only the structure, then wait for what the link needs**

Replace the `Promise.all` at `src/main.ts:234` with
`const torahData = await loadTanakhStructure();`. Delete `buildSearchIndex(verseTexts);`,
`configureTrop(...)`, `configureVerseLength(...)` and
`await Promise.all(getAllOverlays().map((o) => o.init?.()));`, and their now
unused imports. After `configureCommentary({ verses });` add:

```ts
  // Filled in when the texts arrive; the verse popup shows the reference until then.
  let verseTexts: VerseTexts = {};

  // The first frame waits for what the link shows, and nothing else.
  const opening = parseUrlState(overlayParamSpecs);
  const openingStory = storyToOpen(listedStories(STORIES, !__LIVE__), opening.story ?? null);
  const needs = linkNeeds(
    opening,
    openingStory?.data.stops.find((s) => s.id === opening.stop) ?? openingStory?.data.stops[0] ?? null,
  );
  await Promise.all([
    ...needs.overlays.flatMap((id) => getOverlay(id) ?? []).map(ready),
    needs.search && ready(searchTool),
    needs.texts &&
      allVerseTexts().then((texts) => {
        verseTexts = texts;
      }),
  ]);
```

- [ ] **Step 2: Share the front tool's fade**

Split `setFrontTool` (`src/main.ts:~401`) so the fade can run on its own:

```ts
  /**
   * Cross-fade the map to what the tools show now, over FRONT_FADE.DURATION_MS,
   * through the renderer's own picture blend — the one a story ease uses.
   * Snaps under reduced motion.
   */
  function fadeToTools(): void {
    if (reducedMotion.matches) {
      applyTools();
      render();
      return;
    }
    cancelFrontFade();
    // (the existing body from `const from = flatten(...)` to
    // `frontFadeFrame = requestAnimationFrame(step);`, unchanged, with
    // `dimFor(next)` becoming `dimFor(frontTool)`)
  }

  /** Move the front tool to `next`, fading when both tools are on. */
  function setFrontTool(next: FrontTool): void {
    if (next === frontTool) return;
    frontTool = next;
    const tools = toolsNow();
    if (!tools.search || !tools.overlay) {
      applyTools();
      render();
      return;
    }
    fadeToTools();
  }
```

- [ ] **Step 3: Load the rest after the first frame, fading each tool in**

Add, near `refreshVersePopup`:

```ts
  /** Show a tool whose data has just arrived, if it is on the map. */
  function toolArrived(tool: Overlay): void {
    if (tool === searchTool) {
      const search = overlaySettings.get(searchTool);
      overlaySettings.set(searchTool, { ...search, terms: lookUpMeaningsAgain(search.terms) });
      searchChanged(false);
      if (!isSearching(overlaySettings.get(searchTool))) return;
    } else if (tool === currentOverlay) {
      overlayChanged(true);
    } else {
      return;
    }
    if (colorSource(driver) === 'overlay') fadeToTools();
  }
```

Import `isSearching` from wherever `src/tools.ts` gets it. Then at the end of
`main`, after `document.documentElement.dataset.mapReady = '';` and before
`prefetchMorphology();`:

```ts
  void allVerseTexts().then((texts) => {
    verseTexts = texts;
    refreshVersePopup();
  });
  for (const tool of [searchTool, ...getAllOverlays()]) {
    if (!isReady(tool)) void ready(tool).then(() => toolArrived(tool));
  }
```

A tool mid-ease (`colorSource` is `'blend'`) needs nothing: each frame asks
`pictureForStop` afresh, and Task 2 stopped it caching the plain picture.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors; PASS.

- [ ] **Step 5: Check in the browser**

Start your own `npx vite` as a tracked background task, read its port from the
output, and confirm with `curl -s`. In Chrome DevTools, throttle to "Slow 4G",
disable the cache, and load each of these on a cold cache:

1. `/`: the tour draws before `all-texts.json` has finished (watch the
   Network panel).
2. `/?overlay=commentary`: first frame already coloured; `all-texts.json`
   starts only after it.
3. `/?search=אור`: first frame shows the results.
4. `/?verse=Genesis.12.1`: popup shows the verse text in the first frame.
5. `/?overlay=commentary`, then at once pick trop from the menu: the map fades
   to trop when the texts arrive; the trop controls list its marks.
6. `/`, then at once open search and type `אור`: once the dictionary arrives
   the meanings appear and the map fades to the results.
7. `/?story=haftarah`, scroll at once to a stop with an overlay: it appears
   once its data does.

Also check the console for errors on each. Do not use the extension browser
for any timing.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "Draw the map once the structure is laid out, and load the rest behind it (#313)"
```

---

### Task 6: Layout tests, timing, pull request

**Files:**
- Modify (if needed): `layout/app.ts`

- [ ] **Step 1: Run the layout tests**

Run: `npm run test:layout`
The state `explore-search-overlay-switched` picks commentary after loading, and
now its legend row appears when the commentary file lands. If it fails on a
missing row, make its `then` wait for that row, e.g.
`await page.locator('#map-legend').getByText(...)`, choosing a locator that does
not assert reader-visible wording (a data attribute or row count). Rerun until
it passes. Read two or three screenshots from `layout-report/shots/` to confirm
the map actually drew.

- [ ] **Step 2: Time after**

Repeat Task 0 Steps 2–3 on this branch. Expect the bare address and
`overlay=commentary` to drop sharply. The search and verse links wait for the
texts, so expect them no slower than before, not faster.

- [ ] **Step 3: Update the design doc's status line** to
`**Status:** Built; see src/dataLoading.ts.`, and commit.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "Draw the map as soon as the structure file arrives" --body "..."
```

The body starts `🤖 Claude:`, leads with the problem and the fix in plain
English, gives the before/after timing table, lists what to look at on the
preview link (Task 5 Step 5's list), embeds any layout screenshot that changed
by commit-pinned URL, ends with `Closes #313` and the Claude Code line.
