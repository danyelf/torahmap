# Overlays Are Functions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an overlay a function from settings to colours, so the story blender can
evaluate a stop without changing what the app is showing, and a link can be restored as
a complete view state rather than a series of partial writes.

**Architecture:** Each overlay grows a pure `colorsFor(items, settings, hovered)`, and
`getVerseColor` is defined in terms of it, so the rule has one implementation and two
callers. The blender calls it and memoises on the serialized settings, never writing to
the overlay. `computeItemStates` takes a resolved colour array instead of an overlay, so
settled and mid-transition frames composite hover through the same path. URL restore
resolves a complete view state, defaults included, and applies it in one ordered pass.

**Tech Stack:** TypeScript, Vite, vitest, WebGL 2. No runtime dependencies.

**Spec:** `docs/plans/2026-09-17-overlays-are-functions-design.md`

## Global Constraints

- Every commit must pass `.githooks/pre-commit`: `npm run format:check`, typecheck, and
  the full suite. A commit that does not typecheck cannot land, so each task leaves the
  tree building.
- Never use `@ts-ignore`. Fix the type.
- Prettier owns formatting: `singleQuote`, `printWidth: 100`, `quoteProps: preserve`.
  Run `npm run format` before committing.
- Comments describe the code as it is now. No ticket numbers, no "this used to".
- Do not change what any overlay looks like. This is a change of shape, not of
  appearance; a colour that differs before and after is a bug in the task.
- The blender must not know how many story stops exist or what they are called.

## Ordering

Tasks 1–12 leave every reported bug fixed. Task 13 is the structural finish that makes
those bugs unrepresentable rather than fixed, and can be judged on its own.

---

### Task 1: Confirm the two unverified diagnoses

The design carries two claims read off the code and never reproduced. Settle them before
building on them.

**Files:**

- Modify: `docs/plans/2026-09-17-overlays-are-functions-design.md` (assumptions section)

**Interfaces:**

- Consumes: nothing
- Produces: a decision on whether Task 12 also closes #169

- [ ] **Step 1: Start a dev server and note the port**

Run: `npm run dev`
Vite picks its own port. Read it from the output; do not assume 5173.

- [ ] **Step 2: Reproduce #169**

Open in a fresh tab:
`http://localhost:<port>/#overlay=search&q=אור&verse=Genesis.1.3&zoom=8`
Expected per the issue: black canvas, working sidebar and result list. Record whether it
reproduces.

- [ ] **Step 3: Test the ordering hypothesis**

Load the same hash with the zoom removed:
`http://localhost:<port>/#overlay=search&q=אור&verse=Genesis.1.3`
If that paints and the one with `zoom=8` does not, centre-then-zoom is the cause.

- [ ] **Step 4: Reproduce #56's at-rest half**

Load `http://localhost:<port>/#story=abraham_call`, let the scroll settle, then move the
mouse onto the canvas. Record whether the overlay colours survive. Then scroll slowly
through a transition while hovering and record what happens mid-flight.

- [ ] **Step 5: Write down what happened**

Replace the two open assumptions in the design doc's final section with what was
observed. If #169 does not reproduce, say so and leave it open rather than claiming
Task 12 closes it.

- [ ] **Step 6: Commit**

```bash
git add docs/plans/2026-09-17-overlays-are-functions-design.md
git commit -m "Record what the #169 and #56 repros actually do"
```

---

### Task 2: A declared default for every overlay parameter

Absent must mean default. Today an overlay keeps whatever it had, which is #74.

**Files:**

- Modify: `src/urlState.ts` (`UrlParamSpec`, `validateOverlayParams`)
- Modify: `src/overlays/commentary.ts`, `src/overlays/haftarah.ts`
- Test: `src/__tests__/unit/urlState.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `UrlParamSpec` gains `readonly default?: string`.
  `validateOverlayParams(specs, raw)` returns a record holding every declared key whose
  spec has a `default`, filled in when `raw` omits it or its value fails validation.

- [ ] **Step 1: Write the failing tests**

```ts
describe('validateOverlayParams defaults', () => {
  const specs = [
    { key: 'category', kind: 'category', default: 'total' },
    { key: 'note', kind: 'token' },
  ] as const satisfies readonly UrlParamSpec[];

  it('fills a declared default when the key is absent', () => {
    expect(validateOverlayParams(specs, {})).toEqual({ category: 'total' });
  });

  it('fills a declared default when the value is rejected', () => {
    expect(validateOverlayParams(specs, { category: '<script>' })).toEqual({
      category: 'total',
    });
  });

  it('prefers a valid supplied value over the default', () => {
    expect(validateOverlayParams(specs, { category: 'Midrash' })).toEqual({
      category: 'Midrash',
    });
  });

  it('leaves a key with no declared default absent', () => {
    expect(validateOverlayParams(specs, {})).not.toHaveProperty('note');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/__tests__/unit/urlState.test.ts -t 'defaults'`
Expected: FAIL — the returned record is `{}`.

- [ ] **Step 3: Add `default` to the spec and fill it in the validator**

In `src/urlState.ts`, add `readonly default?: string;` to `UrlParamSpec`, documented as
the value the overlay holds when the URL says nothing — the other half of the rule
overlays already follow when they omit a default on the way out.

In `validateOverlayParams`, when `validateOneParam` returns null, fall back to
`spec.default` when the spec declares one.

- [ ] **Step 4: Declare the defaults the overlays already have**

- `commentary.ts`: `{ key: 'category', kind: 'category', default: 'total' }`
- `haftarah.ts`: `{ key: 'custom', kind: 'token', allowed: CUSTOMS, default: 'ashkenazi' }`
- `trop.ts`: leave `trop` without a default. "No mark selected" is a real state that no
  string spells; Task 13 gives it one.
- `search/index.ts`: leave `q`, `mode` and `m` without defaults. `applyUrlParams` already
  reads `params.q ?? ''`, which is the same rule stated locally.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. A test that asserted applying `{}` left a category alone was pinning #74;
it should now assert the reset.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "An omitted overlay parameter means its default, not its last value"
```

---

### Task 3: computeItemStates takes colours, not an overlay

So a blended colour array can go through the same composite as a settled frame.

**Files:**

- Modify: `src/itemColoring.ts`
- Modify: `src/main.ts:145`, `src/main-talmud.ts:97`
- Test: `src/__tests__/unit/verseColoring.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `overlayColorsFor<T>(overlay: Overlay<T> | null, items: SpatialItem<T>[]): (Color | Color[] | null)[]`
  - `computeItemStates<T>(items, overlayColors, hoveredItem, pinnedItem, itemsEqual): ItemState[]`
    — the second argument is now the colour array, parallel to `items`.

- [ ] **Step 1: Write the failing test**

```ts
it('composites hover onto colours it was handed, with no overlay', () => {
  const items = [createVerse({ book: 'Genesis', chapter: 1, verse: 1 })];
  const handed: (Color | Color[] | null)[] = [[1, 0, 0]];

  const states = computeItemStates(items, handed, items[0], null, tanakhIdentitiesEqual);

  expect(states[0].hasOverlayColor).toBe(true);
  expect(states[0].resolvedColor).toEqual([1, 0, 0]);
  expect(states[0].isHovered).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/verseColoring.test.ts -t 'handed'`
Expected: FAIL — `computeItemStates` expects an overlay.

- [ ] **Step 3: Change the signature and add the helper**

In `src/itemColoring.ts`, replace the `overlay` parameter of `computeItemStates` with
`overlayColors: (Color | Color[] | null)[]`, reading `overlayColors[i]` where it called
`getOverlayColor(overlay, v)`. Add `overlayColorsFor`, which maps an overlay over the
items using the existing `getOverlayColor`. Keep `getOverlayColor` exported: it is still
the one place that turns an overlay's answer into a colour or null.

- [ ] **Step 4: Update both call sites**

`src/main.ts:145` and `src/main-talmud.ts:97` wrap their overlay in
`overlayColorsFor(...)`. Nothing else changes.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS, once the existing `computeItemStates` tests pass a colour array.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "Composite item states from a colour array rather than an overlay"
```

---

### Task 4: One colour layer in main.ts

Hover should re-composite, not recompute. This is what lets a hover mid-transition keep
the blended colours.

**Files:**

- Modify: `src/main.ts` (`applyOverlay` and its callers)

**Interfaces:**

- Consumes: `overlayColorsFor`, `computeItemStates` from Task 3
- Produces: inside `main()`,
  - `let colorLayer: (Color | Color[] | null)[]`
  - `setColorLayer(next)` — replaces the layer, then composites
  - `composite()` — re-runs `computeItemStates`/`applyItemColors` over the current layer
    and rebuilds geometry, without asking any overlay for anything

- [ ] **Step 1: Introduce the layer**

`applyOverlay()` becomes `setColorLayer(overlayColorsFor(currentOverlay, verses))`.
Every existing caller of `applyOverlay()` keeps calling it.

- [ ] **Step 2: Make hover composite only**

In the `pointermove` and `pointerleave` handlers, call `composite()` instead of
`applyOverlay()`. Hover changes what is highlighted, not what the overlay says.

Haftarah is the exception and must keep working: its `setHoveredVerse` returns true
because its own colours depend on hover. When it returns true, recompute the layer with
`setColorLayer(overlayColorsFor(currentOverlay, verses))` before compositing.

- [ ] **Step 3: Verify by hand**

Run the dev server. Under Commentary, hover the map and confirm the highlight appears and
the heatmap does not flicker. Under Haftarah, confirm the pairing still brightens and the
rest desaturates.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "Hold one colour layer so hover re-composites instead of recomputing"
```

---

### Task 5: Hover survives a story transition

**Files:**

- Modify: `src/main.ts` (story scroll handler, `pointermove` handler)
- Test: `src/__tests__/unit/verseColoring.test.ts`

**Interfaces:**

- Consumes: `setColorLayer`, `composite` from Task 4
- Produces: `lastPointerPosition: { x: number; y: number } | null` inside `main()`

- [ ] **Step 1: Write the test that pins the property**

```ts
it('brightens a hovered verse in colours that came from a blend', () => {
  const items = [
    createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
    createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
  ];
  const blended: (Color | Color[] | null)[] = [
    [0.4, 0.2, 0.2],
    [0.4, 0.2, 0.2],
  ];

  const colors = applyItemColors(
    computeItemStates(items, blended, items[0], null, tanakhIdentitiesEqual),
  );

  expect((colors[0] as Color)[0]).toBeGreaterThan((colors[1] as Color)[0]);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/__tests__/unit/verseColoring.test.ts -t 'blend'`
Expected: PASS, given Task 3. If it fails, Task 3 is wrong; fix that first.

- [ ] **Step 3: Route blended frames through the composite**

In the story scroll handler, the mid-scroll branch calls
`rebuildGeometry(gl, renderState, computeBlendedColors(...))`. Replace it with
`setColorLayer(computeBlendedColors(...))`, which composites and rebuilds.

- [ ] **Step 4: Re-run hit detection each transition frame**

The camera moves during a transition, so the verse under a stationary cursor changes. A
scroll fires no pointer event, so record the last pointer position in the `pointermove`
handler and, in the mid-scroll branch after the camera is updated, recompute
`mouseState.hoveredVerse` with `findItemAtPoint(verses, camera, lastPointerPosition.x, lastPointerPosition.y)`
when a position has been recorded. Clear it on `pointerleave`.

- [ ] **Step 5: Verify by hand**

Scroll through the Abraham sequence with the cursor resting on the map. The highlight
follows the verse under the cursor as the map moves, and the overlay colours do not
blink.

- [ ] **Step 6: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "Keep the hover highlight through a story transition"
```

---

### Task 6: colorsFor on the Overlay interface, and Commentary first

Commentary has one setting and the simplest rule, so it sets the pattern.

**Files:**

- Modify: `src/overlays/types.ts` (the `Overlay` interface)
- Modify: `src/overlays/commentary.ts`
- Test: `src/__tests__/unit/overlays/commentary.test.ts`

**Interfaces:**

- Consumes: `UrlParamValues` from `src/urlState.ts`
- Produces: on `Overlay<T>`,

```ts
colorsFor?(
  items: T[],
  settings: UrlParamValues,
  hovered: T | null,
): (Color | Color[] | null)[];
```

  Optional on the interface because the Talmud overlays do not need it. Every overlay in
  `src/overlays/` implements it by the end of Task 10.

- [ ] **Step 1: Write the failing test**

```ts
it('answers for settings it is handed without changing what it is showing', async () => {
  await commentaryOverlay.init?.();
  commentaryOverlay.applyUrlParams?.({ category: 'Midrash' });

  const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];

  // Asking about another category must not move the overlay off Midrash.
  commentaryOverlay.colorsFor!(items, { category: 'total' }, null);
  expect(commentaryOverlay.getUrlParams?.()).toEqual({ category: 'Midrash' });

  // And asking about the category it is on must agree with what it paints.
  expect(commentaryOverlay.colorsFor!(items, { category: 'Midrash' }, null)).toEqual([
    commentaryOverlay.getVerseColor(items[0]),
  ]);
});
```

Do not assert that two different categories give different colours for one verse: a verse
with no links in either category is the same colour in both, and which verse that is
depends on the fixture.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/overlays/commentary.test.ts -t 'handed'`
Expected: FAIL — `colorsFor` is not a function.

- [ ] **Step 3: Extract the rule**

In `commentary.ts`, give `getCount` and `linkScale` an explicit category argument rather
than reading `currentCategory`, and add:

```ts
function commentaryColorAt(verse: TanakhIdentity, category: string): Color | null {
  const count = getCount(verse.book, verse.chapter, verse.verse, category);
  if (count === 0) return NO_LINKS;
  return linkScale(category).colorOf(count);
}
```

`getVerseColor` becomes `commentaryColorAt(verse, currentCategory)`, and

```ts
colorsFor(items, settings, _hovered) {
  const category = settings.category ?? 'total';
  return items.map((item) => commentaryColorAt(item, category));
}
```

`cachedMaxValues` is already keyed by category, so it serves both callers unchanged.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS, and Commentary's map is unchanged in the browser.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "Commentary answers for a category it is handed"
```

---

### Task 7: Trop

**Files:**

- Modify: `src/overlays/trop.ts`
- Test: `src/__tests__/unit/overlays/trop.test.ts`

**Interfaces:**

- Consumes: `colorsFor` from Task 6
- Produces: `tropOverlay.colorsFor(items, settings, hovered)`

- [ ] **Step 1: Write the failing test**

```ts
it('answers for a mark it is handed without changing its selection', async () => {
  await tropOverlay.init?.();
  tropOverlay.applyUrlParams?.({ trop: 'etnahta' });

  const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];
  tropOverlay.colorsFor!(items, { trop: 'zaqef-qatan' }, null);

  expect(tropOverlay.getUrlParams?.()).toEqual({ trop: 'etnahta' });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/overlays/trop.test.ts -t 'handed'`
Expected: FAIL — `colorsFor` is not a function.

- [ ] **Step 3: Extract the rule**

`selectedTrop`, `cachedVerseLookup`, `cachedMaxCount` and `cachedTier` are together a
derivation from one setting. Pull them into

```ts
interface TropDerivation {
  verseLookup: Map<string, number>;
  maxCount: number;
  tier: 'rare' | 'uncommon' | 'common';
}

function deriveTrop(tropName: string | undefined): TropDerivation | null;
function tropColorAt(verse: TanakhIdentity, derived: TropDerivation | null): Color | null;
```

The module keeps one `TropDerivation` for its own selection, exactly as the cache does
today. `colorsFor` derives for the settings it was handed and throws its derivation away.

- [ ] **Step 4: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "Trop answers for a mark it is handed"
```

---

### Task 8: Haftarah, the one that reads hover

**Files:**

- Modify: `src/overlays/haftarah.ts`
- Test: `src/__tests__/unit/overlays/haftarah.test.ts`

**Interfaces:**

- Consumes: `colorsFor` from Task 6
- Produces: `haftarahOverlay.colorsFor(items, settings, hovered)` — the only overlay whose
  answer depends on the third argument.

- [ ] **Step 1: Write the failing test**

```ts
it('answers for a custom it is handed without changing its own', async () => {
  await haftarahOverlay.init?.();
  haftarahOverlay.applyUrlParams?.({ custom: 'sephardi' });

  const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];
  haftarahOverlay.colorsFor!(items, { custom: 'ashkenazi' }, null);

  expect(haftarahOverlay.getUrlParams?.()).toEqual({ custom: 'sephardi' });
});

it('brightens the pairing of the verse it is told is hovered', async () => {
  await haftarahOverlay.init?.();
  const torah = { book: 'Genesis', chapter: 1, verse: 1 };
  const items = [torah];

  const cold = haftarahOverlay.colorsFor!(items, { custom: 'ashkenazi' }, null);
  const hot = haftarahOverlay.colorsFor!(items, { custom: 'ashkenazi' }, torah);

  expect(hot).not.toEqual(cold);
});
```

Both tests need the loaded haftarah tables, so use whatever fixture the existing tests in
this file already set up rather than a bare verse — a verse the tables do not know is
`null` in every custom and hover state, and would pass the first test for the wrong
reason.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/__tests__/unit/overlays/haftarah.test.ts -t 'handed'`
Expected: FAIL — `colorsFor` is not a function.

- [ ] **Step 3: Extract the rule**

`buildIndexes()` derives `torahVerseToParsha`, `haftarahVerseToItem`, `isTorahVerse`,
`isHaftarahVerse`, `itemToColor` and `totalItems` from the loaded data and one setting.
Pull that into a `HaftarahDerivation` value returned by `deriveHaftarah(custom)`, and give
`resolveHoverColors` and `getHoveredContext` explicit `derived` and `hovered` arguments
instead of reading the module's. The module keeps one derivation for its own custom,
rebuilt when the custom changes, as `buildIndexes` does today.

Because the derivation is per-custom and there are two customs, cache it by custom rather
than rebuilding per call.

- [ ] **Step 4: Verify the hover behaviour by hand**

Under Haftarah, hover a Torah verse and confirm its parsha and the haftarah read with it
both brighten while everything else desaturates. This is the behaviour the second test
pins; confirm it visually as well, because the test only asserts that something changed.

- [ ] **Step 5: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "Haftarah answers for a custom and a hover it is handed"
```

---

### Task 9: Search — split runSearch, then answer for a term list

This is the task that stops the scroll from fabricating analytics events.

**Files:**

- Modify: `src/overlays/search/index.ts`
- Test: `src/__tests__/unit/overlays/search.test.ts`

**Interfaces:**

- Consumes: `colorsFor` from Task 6; `SearchTerm` and `parseSearchTerms` from
  `src/overlays/search/terms.ts`
- Produces:

```ts
interface SearchMatches {
  results: SearchResult[];
  matchingTerms: Map<string, number[]>;
}

function matchesForTerms(terms: SearchTerm[]): SearchMatches;
function termsFromSettings(settings: UrlParamValues): SearchTerm[];
```

  `searchOverlay.colorsFor(items, settings, _hovered)`.

- [ ] **Step 1: Write the failing test**

```ts
it('answers for a query it is handed without changing the search or firing analytics', async () => {
  const gtag = vi.fn();
  window.gtag = gtag;
  await searchOverlay.init?.();
  searchOverlay.applyUrlParams?.({ q: 'אור' });
  gtag.mockClear();

  const items = [{ book: 'Genesis', chapter: 1, verse: 3 }];
  searchOverlay.colorsFor!(items, { q: 'אברם' }, null);

  expect(searchOverlay.getUrlParams?.().q).toBe('אור');
  expect(gtag).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/overlays/search.test.ts -t 'handed'`
Expected: FAIL — `colorsFor` is not a function.

- [ ] **Step 3: Split runSearch**

`runSearch()` currently computes the matches, stores them, redraws the results list and
term rows, updates the hit caption, fires `updateCallback`, and calls
`trackSearchExecute` once per active term. Extract the computation into
`matchesForTerms(terms)`, which returns `{ results, matchingTerms }` and does nothing
else — no DOM, no callback, no analytics. `runSearch()` calls it, stores the result, and
keeps the rest, including the analytics: an event is what happens when a reader searches,
not when a colour is computed.

- [ ] **Step 4: Add termsFromSettings and colorsFor**

`applyUrlParams` already turns settings into a term list. Lift those four lines into
`termsFromSettings(settings)` and have `applyUrlParams` call it, so the two paths build a
term list the same way.

```ts
colorsFor(items, settings, _hovered) {
  const terms = termsFromSettings(settings);
  const active = terms.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH);
  if (active.length === 0) return items.map(() => null);
  const { matchingTerms } = matchesForTerms(active);
  return items.map((item) => searchColorAt(item, active, matchingTerms));
}
```

Extract `searchColorAt(verse, terms, matchingTerms)` from the body of `getVerseColor`, and
have `getVerseColor` call it with the module's `terms` and `matchingTerms`, so the rule is
written once.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. Search has the heaviest test coverage in the repo; a failure here is a
real behaviour change, not a stale expectation.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "Search answers for a term list it is handed, without searching for real"
```

---

### Task 10: The two overlays with no settings

**Files:**

- Modify: `src/overlays/text-dating.ts`, `src/overlays/verse-length.ts`
- Test: `src/__tests__/unit/overlays/text-dating.test.ts`,
  `src/__tests__/unit/overlays/verse-length.test.ts`

**Interfaces:**

- Consumes: `colorsFor` from Task 6
- Produces: `colorsFor` on both, ignoring `settings` and `hovered`

- [ ] **Step 1: Write the failing tests**

For each overlay:

```ts
it('gives the same answer through colorsFor as through getVerseColor', async () => {
  await textDatingOverlay.init?.();
  const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];

  expect(textDatingOverlay.colorsFor!(items, {}, null)).toEqual([
    textDatingOverlay.getVerseColor(items[0]),
  ]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/__tests__/unit/overlays/text-dating.test.ts src/__tests__/unit/overlays/verse-length.test.ts`
Expected: FAIL — `colorsFor` is not a function.

- [ ] **Step 3: Implement**

Neither overlay has a setting, so both are one line:

```ts
colorsFor(items, _settings, _hovered) {
  return items.map((item) => this.getVerseColor(item));
}
```

- [ ] **Step 4: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "The settings-free overlays answer through colorsFor too"
```

---

### Task 11: The blender evaluates and never writes

**Files:**

- Modify: `src/scrollytelling/overlayBlender.ts`
- Test: `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**

- Consumes: `colorsFor` from Tasks 6–10
- Produces: `computeBlendedColors(fromStop, toStop, t, verses, hovered)` — unchanged apart
  from the trailing `hovered`, which it passes through.

- [ ] **Step 1: Write the failing test**

```ts
it('leaves the overlay showing what it showed before the blend', () => {
  commentaryOverlay.applyUrlParams?.({ category: 'Midrash' });

  computeBlendedColors(
    { id: 'a', overlay: 'commentary', overlayParams: { category: 'Talmud' } } as ResolvedStoryStop,
    { id: 'b', overlay: 'commentary', overlayParams: { category: 'Mishnah' } } as ResolvedStoryStop,
    0.5,
    verses,
    null,
  );

  expect(commentaryOverlay.getUrlParams?.()).toEqual({ category: 'Midrash' });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/scrollytelling/__tests__/overlayBlender.test.ts -t 'showing'`
Expected: FAIL — the overlay reports `Mishnah`, the destination stop's category.

- [ ] **Step 3: Replace the sample with an evaluation**

`getColorsForStop` stops calling `applyOverlayParams`. It validates the stop's parameters
against the overlay's declaration — `validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {})`,
which now fills defaults — and calls `overlay.colorsFor(verses, settings, hovered)`,
falling back to `getDefaultColor(i)` for a null entry as it does today. Remove the
`applyOverlayParams` import.

- [ ] **Step 4: Memoise on the settings**

Key the memo on the overlay id plus the validated settings serialized with
`new URLSearchParams(settings).toString()`, which is already canonical because it is what
the URL carries. Two stops asking for the same thing share an entry, and nothing in this
module knows what a stop is called or how many there are.

Do not memoise when `hovered` is non-null: only Haftarah reads it, its derivation is a map
lookup, and a key that included the hovered verse would miss every frame.

- [ ] **Step 5: Pass the hovered verse through from main.ts**

The story scroll handler passes `mouseState.hoveredVerse` as the new last argument.

- [ ] **Step 6: Verify the analytics claim**

Open the story with the dev console recording `gtag` calls, scroll through the Abraham
sequence, and confirm no `search_execute` events fire. Before this task, a transition
fires them every frame.

- [ ] **Step 7: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "Blend by evaluating each stop, not by making it current"
```

---

### Task 12: URL restore as one ordered transition

**Files:**

- Modify: `src/main.ts` (`buildCurrentUrlState`, `restoreFromUrlUnguarded`,
  `restoreOverlayFromUrl`, `restoreVerseFromUrl`, `restoreCameraFromUrl`,
  `activateOverlay`)
- Modify: `src/overlays/haftarah.ts` (remove the `#custom-select` workaround)
- Test: `src/__tests__/unit/urlState.test.ts`, `src/__tests__/integration/`

**Interfaces:**

- Consumes: Task 2's defaults
- Produces: inside `main()`,
  - `resolveViewState(urlState: UrlState): ViewState` — every field present
  - `applyViewState(next: ViewState): void` — one ordered pass
  - `ViewState` = `{ mode, storyStop, overlay, overlaySettings, verse, camera }`, where
    `camera` is `{ x, y, zoom }` and `overlay` is `'none'` when the URL says nothing.

- [ ] **Step 1: Write the failing tests**

```ts
it('treats a camera-only hash as an Explore view', () => {
  window.location.hash = '#zoom=4&x=100&y=200';
  const state = parseUrlState();

  expect(state.zoom).toBe(4);
  expect(state.overlay).toBeUndefined();
});
```

The rest are integration tests, because they are about the transition rather than the
parse: a camera-only hash leaves story mode; a back navigation to an empty hash clears the
overlay and the pin; a hash carrying `overlay=commentary&category=Midrash` leaves the
category dropdown reading Midrash; a hash carrying a verse and a zoom leaves the verse on
screen.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run -t 'camera-only'`
Expected: FAIL.

- [ ] **Step 3: Split activateOverlay**

Separate swapping the instance from drawing its UI: `activateOverlay(id)` keeps the swap
and the `onUpdate` wiring, and a new `renderOverlayUi()` draws controls and legend. The
existing call sites that want both call both.

- [ ] **Step 4: Write resolveViewState and applyViewState**

`resolveViewState` fills every absent field with its default: `overlay: 'none'`,
`verse: null`, camera at `DEFAULT_ZOOM` and the initial position. Overlay settings come
from `validateOverlayParams`, so they are complete.

`applyViewState` runs in this order, with no conditionals that skip a field:

1. mode — story when the hash names a stop, Explore for anything else, including a hash
   that carries only camera keys
2. overlay instance
3. overlay settings
4. `renderOverlayUi()` — after the settings, so the controls draw the values that arrived
5. verse — pin it, or unpin whatever is pinned
6. camera — zoom first, then position, and centre on the verse last so it centres at the
   zoom the link asked for
7. paint

- [ ] **Step 5: Replace the restore path**

`restoreFromUrlUnguarded` becomes `applyViewState(resolveViewState(parseUrlState(...)))`.
Delete `restoreOverlayFromUrl`, `restoreVerseFromUrl` and `restoreCameraFromUrl`; their
bodies move into the numbered steps above.

- [ ] **Step 6: Remove haftarah's workaround**

`applyUrlParams` in `src/overlays/haftarah.ts` updates its own `#custom-select` because
controls used to be drawn before settings arrived. Step 4 makes that unnecessary. Delete
it, and delete the comment in `main.ts` explaining why controls are left alone.

- [ ] **Step 7: Verify the four bug repros by hand**

A camera-only link; back to an empty hash; `#overlay=commentary&category=Midrash` showing
Midrash in the dropdown; `#overlay=search&q=אור&verse=Genesis.1.3&zoom=8` painting.

- [ ] **Step 8: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "Restore a link as one complete view state"
```

---

### Task 13: Settings become a value the app owns

The structural finish. After this an overlay holds no settings of its own, so there is no
state for a blend or a restore to disagree with.

**Files:**

- Modify: `src/overlays/types.ts`, all six overlays, `src/main.ts`

**Interfaces:**

- Consumes: `colorsFor` from Tasks 6–10
- Produces: `Overlay.renderControls(container, settings, onChange)`,
  `Overlay.getHoverInfo(item, settings)`,
  `Overlay.getSefariaConnectionParam(settings)`; `getUrlParams`/`applyUrlParams` are
  replaced by `defaultSettings()` and the declared `urlParams`, because settings now
  round-trip through `validateOverlayParams` alone.

- [ ] **Step 1: Move one overlay and see how it reads**

Convert Commentary first: delete `currentCategory`, take the category from the `settings`
argument in every member that needs it, and have `renderControls` call `onChange` instead
of assigning. `main.ts` holds `overlaySettings` per overlay id and passes it in.

- [ ] **Step 2: Stop and look**

This is the task most likely to want a different shape once it is real. Before converting
the other five, read the Commentary diff and decide whether `settings` as a flat
`UrlParamValues` is the right argument or whether each overlay wants its own settings
type. Say which, and why, before continuing.

- [ ] **Step 3: Convert the remaining five**

Trop, Haftarah, Search, Text Dating, Verse Length, in that order — Search last, because it
has the most state and the most tests.

- [ ] **Step 4: Delete what is now unreachable**

`applyOverlayParams` in `src/overlays/applyParams.ts` exists to hand settings to an overlay
and suppress URL writes while it does. If nothing calls it, delete it, and check whether
`applyingExternalState` still has callers.

- [ ] **Step 5: Run the whole suite and commit**

```bash
npx vitest run
npm run format
git add -A
git commit -m "An overlay holds no settings of its own"
```

---

## Landing

- [ ] Clear the assumptions section of the design doc, per Task 1's findings.
- [ ] `npm run build` and load the built app once — the tests do not cover WebGL.
- [ ] Open the PR against main with `Closes #179`, `Closes #177`, `Closes #178`,
      `Closes #74`, `Closes #76`, `Closes #122`, `Closes #56`, and `Closes #169` only if
      Task 1 confirmed it.
- [ ] Note in the PR that #73 — validating parameters on the way out — is still open and
      is now a smaller change.
