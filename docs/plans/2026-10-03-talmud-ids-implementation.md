# Squares Have Ids — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every square on the map carries a string `id` that is its link form, and the app compares, finds, steps through and links squares by that id instead of by book, chapter and verse.

**Architecture:** First pull request of #342. A `MapItem` is `{id, x, y, size}`; every laid-out square is one. A small module, `src/items.ts`, compares squares and indexes them by id. The renderer, colour layers, story stops, links and arrow keys go through it, and the Tanakh-only identity helpers in `src/types.ts` are deleted. Shared generic types stop defaulting to `TanakhIdentity`. Nothing a reader sees changes.

**Tech Stack:** TypeScript, Vite, Vitest (`npx vitest run <file>`), `npm run typecheck`.

**Spec:** `docs/plans/2026-10-03-talmud-shared-architecture-design.md`, section "Project 1, pull request by pull request", step 1.

**Scope change from the spec:** the spec puts "`@torahmap/link` carries the id under a key the caller names" in this step. Here the link keeps its `verse` key and only stops parsing its value; naming the key moves to step 4, where the Talmud first boots through the shell and needs `at`. Until then nothing would use it.

## Global Constraints

- The Tanakh site behaves exactly as before: same links, same story stops, same arrow-key order, same hover and pin outlines.
- A Tanakh square's id is `verseToUrlFormat(book, chapter, verse)` from `@torahmap/link`: `Genesis.1.1`, `I.Samuel.1.5`, `Song.of.Songs.2.3`.
- A Talmud square's id is `Tractate.<daf><amud>.<segment>` with spaces in the tractate as dots: `Berakhot.2a.1`, `Bava.Kamma.2a.1`.
- No `@ts-ignore`, no `any`, no `as` casts to get past a type error.
- Comments describe the code as it is now; no ticket numbers or "used to" in code (AGENTS.md).
- Tests check behaviour, never shipped-data counts or reader-visible wording (AGENTS.md).
- Prettier formats on commit; the pre-commit hook runs the format check, typecheck and tests.

## Review Focus

1. A link whose `verse` is not exactly an id the map holds (`Genesis.01.1`, `genesis.1.1`, a verse past a chapter's end) opens with nothing pinned and the link's camera, without an error. Test in Task 4.
2. A story stop that names a verse the map does not hold falls back to the story's initial camera. Test in Task 4.
3. → on the last square and ← on the first leave the pin where it is. Test in Task 2.
4. Hovering the pinned square draws no hover outline, even when hover and pin are different objects for the same square. Test in Task 3.
5. Two squares with the same id make the index throw rather than silently pin the wrong one. Test in Task 2.

---

### Task 1: Every square has an id

**Files:**
- Modify: `src/types.ts` (the `SpatialItem` block, lines 38–48; delete `TalmudLayout`, line 71)
- Modify: `src/layout.ts:75-82`
- Modify: `src/talmud/format.ts`
- Modify: `src/talmud/layout.ts:261-269`
- Modify: `src/__tests__/helpers/fixtures.ts:11-21`
- Test: `src/__tests__/unit/item-ids.test.ts` (create)

**Interfaces:**
- Produces: `interface MapItem { id: string; x: number; y: number; size: number }` and `type SpatialItem<T> = T & MapItem` in `src/types.ts`; `talmudId(s: TalmudIdentity): string` in `src/talmud/format.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/item-ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseVerseFromUrl } from '@torahmap/link';
import { computeLayout } from '../../layout.ts';
import { computeTalmudLayout } from '../../talmud/layout.ts';
import { talmudId } from '../../talmud/format.ts';
import type { TorahData } from '../../types.ts';
import { talmudFixture } from '../helpers/talmudFixture.ts';

const torahData: TorahData = {
  books: [
    { name: 'Genesis', hebrewName: 'בראשית', section: 'torah', chapters: [3, 2] },
    { name: 'I Samuel', hebrewName: 'שמואל א', section: 'neviim', chapters: [2] },
    { name: 'Song of Songs', hebrewName: 'שיר השירים', section: 'ketuvim', chapters: [2] },
  ],
  layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
};

describe('square ids', () => {
  it('names each Tanakh square by its link form', () => {
    for (const v of computeLayout(torahData)) {
      expect(parseVerseFromUrl(v.id)).toEqual({ book: v.book, chapter: v.chapter, verse: v.verse });
    }
  });

  it('gives every Tanakh square a different id', () => {
    const ids = computeLayout(torahData).map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes a Talmud segment as tractate, page and segment, with dots for spaces', () => {
    expect(talmudId({ tractate: 'Bava Kamma', daf: 2, amud: 'a', segment: 1 })).toBe(
      'Bava.Kamma.2a.1',
    );
  });

  it('gives every Talmud square a different id, matching its segment', () => {
    const { items } = computeTalmudLayout(talmudFixture);
    for (const s of items) expect(s.id).toBe(talmudId(s));
    expect(new Set(items.map((s) => s.id)).size).toBe(items.length);
  });
});
```

Move the `fixture` constant out of `talmud-layout.test.ts` into `src/__tests__/helpers/talmudFixture.ts` as `export const talmudFixture`, and import it in both files. Importing one test file from another would run its tests twice. If `computeLayout` needs a book this structure lacks, add the missing piece to `torahData` rather than loading the shipped structure.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/item-ids.test.ts`
Expected: FAIL. `talmudId` is not exported, and `v.id` is undefined.

- [ ] **Step 3: Add `MapItem` and the ids**

In `src/types.ts`, replace the `SpatialItem` block with:

```ts
/**
 * A square on the map. Its id is its link form, so the app compares, finds
 * and links squares by id without knowing what they hold. Drawing, hit
 * testing and the camera read only this.
 */
export interface MapItem {
  id: string;
  x: number;
  y: number;
  size: number;
}

/** A text's own fields (book, chapter and verse; or a Talmud segment) on a square. */
export type SpatialItem<T> = T & MapItem;
```

Delete the line `export type TalmudLayout = SpatialItem<TalmudIdentity>;`. Nothing uses it.

In `src/layout.ts`, import `verseToUrlFormat` from `@torahmap/link` and add the id where each verse is pushed (line 75):

```ts
      verses.push({
        id: verseToUrlFormat(bookName, chapterIdx + 1, verseIdx + 1),
        book: bookName,
        chapter: chapterIdx + 1,
        verse: verseIdx + 1,
        x: x,
        y: currentY + jitterY,
        size: VERSE_SIZE,
      });
```

In `src/talmud/format.ts`, add:

```ts
/** A segment's id, which is its link form: Bava Kamma 2a:1 is "Bava.Kamma.2a.1". */
export function talmudId(s: TalmudIdentity): string {
  return `${s.tractate.replace(/ /g, '.')}.${s.daf}${s.amud}.${s.segment}`;
}
```

In `src/talmud/layout.ts:261`, build the identity once and add its id:

```ts
        const segment = {
          tractate: tractate.name,
          daf: row.daf,
          amud: row.amud,
          segment: seg.segment,
        };
        colItems.push({ ...segment, id: talmudId(segment), x: baseX + jx, y: y + jy, size: SEGMENT_SIZE });
```

In `src/__tests__/helpers/fixtures.ts`, derive the id from the verse after overrides, so existing callers need no change:

```ts
export function createVerse(overrides: Partial<TanakhLayout> = {}): TanakhLayout {
  const verse = { book: 'Genesis', chapter: 1, verse: 1, x: 10, y: 20, size: 6, ...overrides };
  return { ...verse, id: overrides.id ?? verseToUrlFormat(verse.book, verse.chapter, verse.verse) };
}
```

- [ ] **Step 4: Fix what the typecheck now finds**

Run: `npm run typecheck`
Expected: errors wherever a square is built without an id: test files that write `{x, y, size}` literals typed as `TanakhLayout` (for example `hitDetection.test.ts`, `outline.test.ts`, `geometry.test.ts`, `spatial-layer-generic.test.ts`), and `SAMPLE_VERSES` in `fixtures.ts`. Build each through `createVerse`, or add an `id` in the same link form. Make no other change.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/__tests__/unit/item-ids.test.ts && npm test`
Expected: PASS, all of them.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/layout.ts src/talmud src/__tests__
git commit -m "Every square on the map carries its link form as an id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Comparing and indexing squares by id

**Files:**
- Create: `src/items.ts`
- Test: `src/__tests__/unit/items.test.ts` (create)

**Interfaces:**
- Consumes: `MapItem` from Task 1.
- Produces, in `src/items.ts`:
  - `sameItem(a: MapItem | null, b: MapItem | null): boolean`
  - `interface ItemIndex<I extends MapItem> { find(id: string): I | null; step(from: I, by: 1 | -1): I | null }`
  - `indexItems<I extends MapItem>(items: readonly I[]): ItemIndex<I>`, which throws if two squares share an id.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { indexItems, sameItem } from '../../items.ts';

const square = (id: string) => ({ id, x: 0, y: 0, size: 1 });
const [a, b, c] = ['A.1.1', 'A.1.2', 'A.1.3'].map(square);

describe('sameItem', () => {
  it('compares by id, not by object', () => {
    expect(sameItem(a, square('A.1.1'))).toBe(true);
    expect(sameItem(a, b)).toBe(false);
  });

  it('treats two nulls as the same and one null as different', () => {
    expect(sameItem(null, null)).toBe(true);
    expect(sameItem(a, null)).toBe(false);
    expect(sameItem(null, a)).toBe(false);
  });
});

describe('indexItems', () => {
  const index = indexItems([a, b, c]);

  it('finds a square by id, and nothing for an id the map lacks', () => {
    expect(index.find('A.1.2')).toBe(b);
    expect(index.find('A.01.2')).toBeNull();
    expect(index.find('')).toBeNull();
  });

  it('steps forward and back in layout order', () => {
    expect(index.step(a, 1)).toBe(b);
    expect(index.step(c, -1)).toBe(b);
  });

  it('steps nowhere past either end', () => {
    expect(index.step(c, 1)).toBeNull();
    expect(index.step(a, -1)).toBeNull();
  });

  it('refuses a layout in which two squares share an id', () => {
    expect(() => indexItems([a, square('A.1.1')])).toThrow('A.1.1');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/items.test.ts`
Expected: FAIL, because `../../items.ts` does not exist.

- [ ] **Step 3: Write `src/items.ts`**

```ts
import type { MapItem } from './types.ts';

/** Whether a and b are the same square. Two nulls are. */
export function sameItem(a: MapItem | null, b: MapItem | null): boolean {
  return (a?.id ?? null) === (b?.id ?? null);
}

export interface ItemIndex<I extends MapItem> {
  /** The square with this id, or null if the map holds none. */
  find(id: string): I | null;
  /** The square `by` places from `from` in layout order, or null past either end. */
  step(from: I, by: 1 | -1): I | null;
}

/** Indexes a layout by id. Two squares with one id are a layout bug, so it throws. */
export function indexItems<I extends MapItem>(items: readonly I[]): ItemIndex<I> {
  const at = new Map<string, number>();
  items.forEach((item, i) => {
    if (at.has(item.id)) throw new Error(`Two squares share the id ${item.id}`);
    at.set(item.id, i);
  });
  const nth = (i: number | undefined): I | null => (i === undefined ? null : (items[i] ?? null));
  return {
    find: (id) => nth(at.get(id)),
    step: (from, by) => {
      const i = at.get(from.id);
      return i === undefined ? null : nth(i + by);
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/unit/items.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/items.ts src/__tests__/unit/items.test.ts
git commit -m "Compare squares by id, and index a layout by id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The renderer and colour layers compare ids

**Files:**
- Modify: `src/rendering.ts:126-164` (`render`)
- Modify: `src/itemColoring.ts:100-119` (`layerToRecompute`)
- Modify: `src/main.ts` (calls at ~493-500 and ~771-778)
- Modify: `src/main-talmud.ts` (delete `talmudSegmentsEqual`, lines 35-41; calls at ~111-119 and ~251)
- Test: `src/__tests__/unit/rendering.test.ts`, `src/__tests__/unit/verseColoring.test.ts`

**Interfaces:**
- Consumes: `sameItem` from Task 2.
- Produces:
  - `render<T>(context, state: RenderState<T>, camera, hoveredVerse: SpatialItem<T> | null, pinnedVerse: SpatialItem<T> | null): {x, y}`, with no `itemsEqual` parameter.
  - `layerToRecompute<T>(source, overlay: ToolOnMap<T> | null, before: SpatialItem<T> | null, after: SpatialItem<T> | null)`, with no `itemsEqual` parameter.

- [ ] **Step 1: Write the failing tests**

In `rendering.test.ts`, drop the sixth argument from every `render(...)` call and the `tanakhIdentitiesEqual` import. Then add a test that hovering the pinned square, held as a different object, draws no hover outline. Use the file's existing WebGL mock and its way of observing outline draws (look for how its existing tests check `hoverOutlineBuffer` or `renderOutline`). For example:

```ts
    it('draws no hover outline over the pinned square, even as a different object', () => {
      const pinned = createVerse({ verse: 1 });
      const hoveredCopy = createVerse({ verse: 1 });
      render(context, state, camera, hoveredCopy, pinned);
      expect(state.hoverOutlineBuffer).toBeNull();
    });
```

In `verseColoring.test.ts`, drop the last argument from every `layerToRecompute(...)` call and the `tanakhIdentitiesEqual` import, and add:

```ts
    it('recomputes nothing when the hover moves to another copy of the same square', () => {
      const again = createVerse({ verse: 1 });
      expect(
        layerToRecompute('blend', { tool: hoverSensitive, settings: undefined, data: undefined }, a, again),
      ).toBeNull();
    });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/__tests__/unit/rendering.test.ts src/__tests__/unit/verseColoring.test.ts`
Expected: the typecheck inside Vitest does not fail on arity, so expect the new tests to fail at runtime: `itemsEqual` is undefined and gets called.

- [ ] **Step 3: Change the signatures**

In `src/rendering.ts`, remove the `itemsEqual` parameter from `render` and its doc. Replace the comparison with `if (hoveredVerse && !sameItem(hoveredVerse, pinnedVerse)) {`, importing `sameItem` from `./items.ts`.

In `src/itemColoring.ts`:

```ts
export function layerToRecompute<T>(
  source: ColorSource,
  overlay: ToolOnMap<T> | null,
  before: SpatialItem<T> | null,
  after: SpatialItem<T> | null,
): 'blend' | 'overlay' | null {
  if (sameItem(before, after) || source === 'ease') return null;
```

The rest is unchanged.

In `src/main.ts`, drop `tanakhIdentitiesEqual` from both calls (`repaint` and `render`). In `src/main-talmud.ts`, delete `talmudSegmentsEqual`, drop it from the `renderFrame` call, and replace `talmudSegmentsEqual(pinnedItem, hit)` with `sameItem(pinnedItem, hit)`.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/__tests__/unit/rendering.test.ts src/__tests__/unit/verseColoring.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rendering.ts src/itemColoring.ts src/main.ts src/main-talmud.ts src/__tests__
git commit -m "The renderer and colour layers tell squares apart by id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Links, story stops and arrow keys go through ids

**Files:**
- Modify: `src/viewState.ts` (`verse: string | null`; drop the `parseVerseFromUrl` and `TanakhIdentity` imports)
- Modify: `src/scrollytelling/storyPanel.ts:128-165` (`resolveStops`)
- Modify: `src/main.ts` (lines ~94-97 imports; ~538-547 story stop; ~956 tap; ~998 URL; ~1116 hover; ~1140-1147 arrows; ~1350 dev capture; ~1949 restore; plus one `indexItems` call after the layout is computed)
- Modify: `src/types.ts` (delete `tanakhIdentitiesEqual`, `findTanakhItem`, `nextTanakhItem`, `prevTanakhItem`)
- Test: `src/__tests__/integration/view-state-restore.test.ts`, `src/__tests__/unit/story-stops.test.ts` (create)

**Interfaces:**
- Consumes: `indexItems`, `sameItem` (Task 2); `MapItem.id` (Task 1).
- Produces: `ViewState.verse: string | null`, holding the link's raw value, which `index.find` resolves.

- [ ] **Step 1: Write the failing tests**

In `view-state-restore.test.ts`, change any assertion on `view.verse` from `{book, chapter, verse}` to the string. Then add:

```ts
  it('carries the linked verse as the id it names', () => {
    expect(viewFor('?verse=I.Samuel.1.5').verse).toBe('I.Samuel.1.5');
  });

  it('pins a verse through a written link and back', () => {
    const square = SAMPLE_VERSES[3];
    const view = viewFor(writeLink({ verse: square.id, overlayParams: {} }));
    expect(indexItems(SAMPLE_VERSES).find(view.verse!)).toBe(square);
  });

  it('pins nothing for a verse the map does not hold, and keeps the camera', () => {
    for (const ref of ['Genesis.01.1', 'genesis.1.1', 'Genesis.1.999']) {
      const view = viewFor(`?verse=${ref}&zoom=3`);
      expect(indexItems(SAMPLE_VERSES).find(view.verse ?? '')).toBeNull();
      expect(view.camera.zoom).toBe(3);
    }
  });
```

Import `writeLink` from `@torahmap/link` and `indexItems` from `../../items`. If `writeLink` returns a query string without `?`, prefix it the way the file's other links are written.

Create `src/__tests__/unit/story-stops.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveStops } from '../../scrollytelling/storyPanel.ts';
import { createVerses } from '../helpers/fixtures.ts';
import type { StoryStop } from '@torahmap/stories';

const verses = createVerses(5);
const initial = { x: 1, y: 2, zoom: 1 };
const focus = { x: 50, y: 50 };
const mapSize = { width: 100, height: 100 };
const stop = (fields: Partial<StoryStop>): StoryStop =>
  ({ id: 's', camera: 'initial', ...fields }) as StoryStop;

describe('resolveStops', () => {
  it('puts a stop that pins a verse on that verse', () => {
    const [resolved] = resolveStops([stop({ verse: verses[2].id })], initial, verses, focus, mapSize);
    expect(resolved.camera).not.toEqual(initial);
  });

  it('falls back to the initial camera for a verse the map does not hold', () => {
    const [resolved] = resolveStops([stop({ verse: 'Genesis.99.1' })], initial, verses, focus, mapSize);
    expect(resolved.camera).toEqual(initial);
  });
});
```

Before relying on the `stop` helper, read `StoryStop`'s required fields in `packages/stories/src/types.ts`, and replace the `as StoryStop` with a complete literal. The cast is only a placeholder for fields this test doesn't care about; the plan's no-casts rule applies to tests too.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/__tests__/integration/view-state-restore.test.ts src/__tests__/unit/story-stops.test.ts`
Expected: FAIL. `view.verse` is still an object.

- [ ] **Step 3: Carry the id**

In `src/viewState.ts`: `verse: string | null;` and `verse: url.verse ?? null,`. Remove the two imports that are now unused.

In `src/scrollytelling/storyPanel.ts`, build `const index = indexItems(verses);` at the top of `resolveStops`. Replace both parse-and-find pairs:

```ts
      const verseLayout = index.find(cam.ref);
```
```ts
      const verseLayout = index.find(stop.verse);
```

Drop `findTanakhItem` and `parseVerseFromUrl` from its imports. `bookFromUrl` stays.

In `src/main.ts`:
- Right after `const verses = computeLayout(...)` (line 268), add `const squares = indexItems(verses);`. It is `squares`, not `index`, because `placeIn` already has a parameter named `index`.
- Story stop (~538):
  ```ts
      if (stop.verse) {
        if (pinnedVerse?.id !== stop.verse) {
          const verse = squares.find(stop.verse);
          if (verse) {
            pinnedVerse = verse;
            updateSidebarWrapper(verse, true);
          }
        }
      } else if (pinnedVerse) {
  ```
- Tap (~956): `if (pinnedVerse && sameItem(pinnedVerse, verse)) {`
- URL (~998) and dev capture (~1350): `pinnedVerse.id` in place of `verseToUrlFormat(pinnedVerse.book, pinnedVerse.chapter, pinnedVerse.verse)`.
- Hover (~1116): `if (!sameItem(previousHover, verse)) repaint(previousHover);`
- Arrows (~1143):
  ```ts
      if (e.key === 'ArrowRight') {
        targetVerse = squares.step(pinnedVerse, 1);
      } else if (e.key === 'ArrowLeft') {
        targetVerse = squares.step(pinnedVerse, -1);
      }
  ```
- Restore (~1949): `const verse = next.verse ? squares.find(next.verse) : null;`
- Remove the imports that are now unused: `tanakhIdentitiesEqual`, `findTanakhItem`, `nextTanakhItem`, `prevTanakhItem`, `parseVerseFromUrl`, `verseToUrlFormat`. Check each with a search first, since some may still be used elsewhere in the file.

In `src/types.ts`, delete the four functions. `tanakhKey` stays: it is the Tanakh's data-file key, not a square's id.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS. If a test still imports a deleted helper, rewrite it against `indexItems` or `sameItem`.

- [ ] **Step 5: Commit**

```bash
git add src/viewState.ts src/scrollytelling/storyPanel.ts src/main.ts src/types.ts src/__tests__
git commit -m "Links, story stops and arrow keys find squares by id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shared types stop defaulting to the Tanakh

**Files:**
- Modify: `src/overlays/types.ts:30` (`Overlay`), `:163` (`ToolOnMap`), `:170` (`Tools`)
- Modify: `src/rendering.ts:48` (`RenderState`), and its doc comment at lines 40-47
- Modify: `src/mouseState.ts`
- Modify: whichever files the typecheck then names (about 30 bare uses, listed by `grep -rnE "\b(Overlay|ToolOnMap|Tools|RenderState)\b([^<A-Za-z]|$)" src`)
- Test: `src/__tests__/unit/mouseState.test.ts`

**Interfaces:**
- Produces: `Overlay<T, S = unknown, D = unknown>`, `ToolOnMap<T>`, `Tools<T>`, `RenderState<T>`, and `MouseState<I extends MapItem>` with `createMouseState<I extends MapItem>(): MouseState<I>` and `setHoveredVerse<I extends MapItem>(state: MouseState<I>, verse: I | null)`, all with no default type.

- [ ] **Step 1: Remove the defaults**

Delete `= TanakhIdentity` from the four declarations. Make `MouseState` generic over `I extends MapItem` in place of `TanakhLayout`, along with `createMouseState` and `setHoveredVerse`. Update `RenderState`'s doc comment so it no longer mentions a default.

- [ ] **Step 2: Watch the typecheck fail**

Run: `npm run typecheck`
Expected: errors at each bare `Overlay`, `ToolOnMap`, `Tools`, `RenderState` and `createMouseState()`.

- [ ] **Step 3: Name the type at each use**

Follow one rule at each use:
- **Code that holds the Tanakh's own overlays, search or layout** names `TanakhIdentity` (or `TanakhLayout`) explicitly. That is `overlays/index.ts`, `overlays/registry.ts`, `main.ts`, `sidebar.ts`, `tools.ts`, `downloads.ts` and `scrollytelling/overlayBlender.ts`. Later pull requests in #342 take the Tanakh out of these.
- **Code that never reads a square's fields** takes a type parameter: `dataFiles.ts` (`requiredFiles<T>(overlay: Overlay<T>)`, and likewise for the others), `overlays/prebuild.ts`, and `overlays/settings.ts`.
- `main.ts` calls `createMouseState<TanakhLayout>()`. `main-talmud.ts` names `TalmudIdentity` wherever it needs to.
- `overlays/types.check.ts` names whatever type its checks already use.

No `any`, no casts. If a parameter will not infer, name it at the call site.

- [ ] **Step 4: Run everything**

Run: `npm run typecheck && npm test`
Expected: PASS. `mouseState.test.ts` may need `createMouseState<TanakhLayout>()`.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Shared types name the text they hold instead of defaulting to the Tanakh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Check the site is unchanged, and open the pull request

**Files:** none changed, unless a check fails.

- [ ] **Step 1: Run the browser test suites**

Run: `npm run test:layout && npm run test:loading`
Expected: both pass. If either fails, read the failure, fix the cause in the task that owns it, and run them again.

- [ ] **Step 2: Compare a production build with the live site**

Run `npm run build`, then `npx vite preview` in the background. Read the port it prints, and confirm with `curl -s http://localhost:<port>/ | head -c 200`. Load each of these links on the local build and on https://torahmap.org with the Chrome tools, and compare:
- `/?verse=I.Samuel.1.5`: the popup shows I Samuel 1:5. Press → and then ←. The popup moves to 1:6 and back. The URL updates.
- the first story's second stop (`/?story=<first story id>&stop=<its second stop id>`, taken from `packages/stories/markdown/`): it lands on the same view as on the live site, with the same pinned verse if the stop has one.
- an overlay with settings, e.g. `/?overlay=commentary&...` (copy a working link from the live site's Share).
- a search link (`/?q=...`, again from the live site's Share).
- `/?verse=Genesis.01.1&zoom=3`: nothing pinned, no console error.

Stop the preview server by its PID. Do not kill other listeners on the port.

- [ ] **Step 3: Check the old Talmud page still boots**

Run `npm run dev` in the background, load `/talmud.html`, and check the console. It has drawn in the wrong place since an earlier camera change, and that is expected. A new exception is not. Stop the server.

- [ ] **Step 4: Push and open the pull request**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "Squares carry their link form as an id" --body "First of four steps in #342 (design: docs/plans/2026-10-03-talmud-shared-architecture-design.md).

Every square on the map has a string id that is its link form (Genesis.1.1; Berakhot.2a.1). The app compares, finds, steps through and links squares by id; the Tanakh-only identity helpers are gone, and shared types no longer default to the Tanakh's. Nothing a reader sees changes.

Naming the link key per text moves to step 4, where the Talmud first needs it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then tick the first box in #342.
