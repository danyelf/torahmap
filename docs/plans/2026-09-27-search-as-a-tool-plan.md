# Search as a Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Text Search out of the overlay list and make it a tool of its own, so a search and an overlay can be on the map together, with a match over an overlay drawn as a ring around the overlay's colour.

**Architecture:** A pure function in `src/itemColoring.ts` combines the search's colours and the overlay's into a fill and a ring for each verse. The renderer draws the ring in screen pixels, and fills a square that is too small for a hole whole in its search colour. The app holds the overlay and the search in two slots (`src/tools.ts`), each with its own URL keys, story-stop keys, panel and legend row. Tasks 2 and 3 run with search both in the overlay list and in its own slot; Task 4 takes it out of the list.

**Tech Stack:** TypeScript, Vite, WebGL 2 (instanced drawing), Vitest with jsdom, and the Playwright layout suite (`npm run test:layout`).

**Spec:** `docs/plans/2026-09-27-search-as-a-tool.md`. Read it before starting; it is the authority wherever this plan is silent.

Work only in `/Users/danyel/code/MISC/torahmap/.claude/worktrees/search-tool`, on branch `search-tool`.

## Decisions this plan takes

The spec leaves these open; each is a choice made here.

1. Search keeps the shape of an `Overlay` (so the settings store, the test helper `hostOverlay` and the legend summary serve it unchanged) but is never registered; its export is renamed `searchOverlay` → `searchTool`, and its name becomes "Search".
2. Search's settings live in the same settings store as the overlays', under its id `search`.
3. The search counts as on when it has a term it searches on, by the rule it already has: `MIN_SEARCH_TERM_LENGTH` (2, `src/constants/app.ts`: "Terms shorter than this are dropped"), applied by `parseSearchTerms` in `src/search.ts` and by `searchFor`'s `active` list in `src/overlays/search/index.ts`, and pinned by "handles single-character query in all modes" (`search-hebrew-modes.test.ts`), "resolves a single letter to nothing" (`search-mixed-language.test.ts`) and "shows minimum character warning for short terms" (`overlays/search.test.ts`). `isSearching` reads that same `active` filter, extracted as `activeTerms`, so a lone letter leaves the search off: nothing dims, no legend row, no history entry.
4. With an overlay on, a verse the search does not match is drawn at `NON_MATCH_DIM` = 0.85 of its overlay colour (or of its grey): a smidge, to be tuned by eye at the Task 2 stop. With no overlay, it keeps search's present dark grey (0.18) exactly, so search alone looks as it does today. The one tunable number applies only with an overlay on.
5. A match over an overlay that gives that verse no colour has a grey hole (the ordinary undimmed grey). Agreed by Danyel.
6. The ring starts at 1.5px outside and 1px inside, and falls back to a whole square below 8 CSS pixels a side (zoom 2 on the map's 4-unit squares). All four numbers live in `SEARCH_WITH_OVERLAY` in `src/constants.ts`.
7. A verse with several colours (a multi-word match, or Haftarah's stripes) reaches out by the larger of the multi-colour growth and the ring's outside width, not their sum, and its ring is measured in from that outer edge, so every ring is 2.5px thick (1.5 + 1) whatever the verse's growth.
7a. The spec's "under half the 2-unit gap, so rings never touch" cannot hold: `layout.ts` jitters each square by up to 1 unit (`JITTER_RANGE` 2), so neighbours sit 0 to 4 units apart. Rings can touch where jitter brings squares close, as the multi-colour growth already can; the plan keeps no test that claims otherwise.
8. Each colour in the verse buffer is packed into one float at 8 bits a channel. A fill and a ring of four stripes each, for two pictures, would need 19 attributes and 20 varyings; WebGL 2 promises only 16 and 15.
9. Story blending: since #260 the shader fades between whole pictures, and each picture now carries its rings, so a donut fades in as one picture fading into the next, its outside growing from nothing as the multi-colour growth does. Only `mergePictures`, which collapses a fade in progress when a new one must start from it, mixes rings stripe by stripe. The spec says this (3dd05a7).
10. `layerToRecompute` stays as it is: search's colours never depend on the hovered verse, so asking the overlay is already asking both.
11. Hovering a donut brightens its hole (the fill); the ring keeps its colour.
12. The verse text shows both tools' marks: the overlay's (Trop's) and the search's words (Danyel's answer). `combineMarks` in `src/verseMarks.ts` reads each tool's marked fragment as stretches of the text and lays them into one; where a mark of the overlay's shares any character with one of the search's, the search's is kept and the overlay's dropped. If either fragment's text differs from the verse's, the search's fragment is used alone.
13. The new Clear button has the id `search-clear-all`; `#search-clear` stays on the first word's ×, which many tests use.
14. Clear sits beside "+ add a word" and is disabled while no word is typed.
15. A word clicked in the verse popup opens the Search panel only while exploring; in the story it changes the map and leaves the story open, as today.
16. A link that names a search opens on the Search panel on a desktop; any other explore link opens on Overlay, as now. Agreed by Danyel.
17. The reserved keys are enforced where overlays are registered: `registerOverlay` throws for an overlay that declares `search`, `mode` or `m`.
18. Search's parameter declarations move to `src/urlState.ts` as `SEARCH_URL_PARAMS`, beside the other keys that module owns; the search module uses them.
19. A link writes the search's keys first, then the overlay and the rest, as in the spec's example.
20. The nine story stops change in Task 3, with the parser, rather than last: the story-file test checks every stop against the parser, so leaving them would fail the suite until the end.
21. Until Task 4, search is both in the overlay list and in its own slot; `toolsShown` ignores it in the overlay slot, and a story stop that names `overlay: search` searches (Task 2 only). The prototype links in Task 2 use `q=`, the key before Task 3 renames it.
22. Search's description is dropped: nothing shows it once it leaves the overlay picker.
23. One panel builder (Danyel's answer): `panelHtml(panel, body)` in `src/panel.ts` builds every panel, Search, Overlay, Stories and About, each opening with its phone-only `.panel-title` from `PANEL_TITLES`. Shared controls have one implementation each, in `src/styles/controls.css`, named by `CONTROL`: `control-button` (and `quiet`), drawn as the Stories card's buttons; `control-toggle`, as the Hebrew toggle; `control-select`, as the overlay picker; and `control-icon`, the ×. Each keeps its original's size and look, so the Overlay, Stories and About panels do not change; nothing imposes a size on every control. The search × uses `control-icon` in both its places and is 24×24 (its glyph as today, 16px, #666; its box was 17×20). The mode switches, "+ add a word" and Clear are the search's own and keep their styling in `src/styles/overlays/search.css`: the mode switches stay 17px tall on a mouse and grow to 24px tall on a touch screen (`@media (pointer: coarse)`), their widths (64px and 42px) unchanged; "+ add a word" is unchanged (about 26px), and Clear is drawn like it. Each control keeps its own class as a hook (`term-remove`, `story-card-action`, `setting-toggle`). Inline text buttons (`all`, `only this one`) and an overlay's own chart (Trop's marks) stay as they are.
24. Search's source credit stays in the About panel: `aboutHtml` is handed `searchTool` with the registered overlays.
25. The word-click handler keeps its check that the palette has room (the menu counted words when it opened), and loses the overlay switch and the comment explaining it.

## Global Constraints

- Colouring, top to bottom: "search, the overlay, grey. Each gives a colour for a verse or passes it down."
- Ring: "The ring is 1.5px outside the square and 1px inside it, in screen pixels, so it does not thin as the map zooms out."
- "The outside width must stay under half the 2-unit gap between squares at the zooms where donuts show, so rings never touch." Layout jitter makes the gap 0 to 4 units, so this cannot hold everywhere; see Decision 7a.
- "When the square is too small on screen to leave a hole, the match is filled whole in its search colour."
- "A match with no overlay is filled in its search colour, and non-matches are dimmed grey: search on its own looks as it does today." "With no search on, the overlay's colours pass through unchanged."
- URL: "`search=אברם,אברהם`, with today's `mode=` and `m=` for how each word matches." "`search`, `mode` and `m` are reserved, so no overlay can claim them." "`overlay=search` is an unknown overlay and is ignored. Old search links open with no search; they are not translated."
- Story stops: "A story stop can say `search: …` and, separately, `overlay: …`; each is optional." "The parser sends `search`, `mode` and `m` to the search and every other key to the overlay."
- History: "Turning a tool on or off adds a browser history entry; editing it replaces the current one." "Switching overlays and pinning a verse add entries, as today."
- Menu: "Continue the story, Search, Overlays, Stories, About & settings." Overlay picker: "None, Commentary, Trop, Haftarah, Verse Length."
- Search panel, titled *Search*: "the word rows with their substring/word/meanings switches, '+ add a word', the match count, the results list, and a **Clear** button." Controls under 24px (the × and the three switches) are enlarged.
- Legend: "one row per tool that is on, search first … Each row opens its panel. No card with neither on. The legend has no ×."
- Telemetry: "`overlay_switch` never reports search. `search_execute` is unchanged … `sefaria_click` records the overlay, as now."
- The Talmud page (`composeWithMgBase`) "is left alone."
- Project: comments only for what the code cannot say, in the present tense, with no ticket numbers or stage labels in code; shorter is better. Use `npm`. No runtime dependencies.
- The pre-commit hook checks formatting, typechecks and runs the tests, and is never bypassed (`--no-verify` is forbidden). It only checks formatting, so run `npm run format` before every commit.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
  ```

## Review Focus

1. A search that matches nothing, with an overlay on (`#search=xyzzy&overlay=commentary`): the search is on, so every verse dims a smidge and no verse has a ring; the reader still sees the overlay and can Clear. Pinned in Task 1 ("dims every verse when the search matches nothing").
2. A single letter typed or linked (`#search=א`): the search stays off: no dimming, no legend row, no history entry. Pinned in Task 2 (`toolsShown`) and Task 5 (`togglesSearch`).
3. An old link, `#overlay=search&q=light`: opens in Explore with no overlay and no search, and no error. Pinned in Task 4 (view-state test).
4. Changing the overlay while a search is on keeps the search, and the legend shows both rows. Pinned in Task 6 (layout state `explore-search-overlay-switched`).
5. A verse matched by all five words: its ring shows four stripes, as its fill would, and nothing breaks. Pinned in Task 2 (geometry test "keeps at most four ring stripes").

---

## Files

| File | What changes |
| --- | --- |
| `src/constants.ts` | `SEARCH_WITH_OVERLAY`: the dimming and the ring's three numbers |
| `src/itemColoring.ts` | `combineLayers` (search over overlay into fills and rings), `toolsPicture` |
| `src/geometry.ts` | `Picture.rings`; colours packed one to a float; ring stripes per picture |
| `src/webgl.ts`, `src/rendering.ts` | The donut in the shader; the `u_ring` uniform |
| `src/scrollytelling/colorBlending.ts` | `mergePictures` merges rings |
| `src/overlays/types.ts` | `ToolOnMap`, `Tools` |
| `src/tools.ts` (new) | `toolsShown`, `togglesSearch`: the two slots |
| `src/overlays/search/index.ts` | Renamed `searchTool`; colours a match or nothing; `isSearching`, `searchFromLink`; Clear |
| `src/urlState.ts`, `src/viewState.ts` | `SEARCH_URL_PARAMS`, `SEARCH_KEYS`, `searchParams` in link and view |
| `src/scrollytelling/{types,storyParser,overlayBlender}.ts` | `searchParams` on a stop; pictures for a stop from both tools |
| `src/overlays/{index,registry}.ts` | Search leaves the list; the registry refuses search's keys |
| `src/frame.ts`, `src/menu.ts`, `index.html`, `src/styles/frame.css`, `src/styles/overlays/search.css` | The Search panel, menu item, legend row |
| `src/mapLegend.ts` (new) | `showLegend`: a row per tool that is on |
| `src/panel.ts`, `src/styles/controls.css`, `src/toolPanels.ts` (new) | One builder for every panel, and the controls panels share |
| `src/verseMarks.ts` (new) | `combineMarks`: both tools' marks over one verse text |
| `src/sidebar.ts` | The verse popup shows both tools |
| `src/main.ts` | Wiring |
| `public/data/story.md` | Nine stops say `search: …` |
| `layout/app.ts`, `layout/known.ts` | Search states |
| `test-harness/main.ts`, `CLAUDE.md`, `README.md`, `src/aboutPanel.ts` | Follow the move |

---

### Task 1: Combining the search and the overlay

**Files:**
- Modify: `src/constants.ts` (append after `HIGHLIGHT_CONSTANTS`)
- Modify: `src/geometry.ts` (`Picture` interface, lines 24–32)
- Modify: `src/itemColoring.ts`
- Create: `src/__tests__/unit/combineLayers.test.ts`

**Interfaces:**
- Consumes: `getDefaultColor(i)` in `src/itemColoring.ts`; `HIGHLIGHT_CONSTANTS.DIM_FACTOR` (0.3).
- Produces:
  - `SEARCH_WITH_OVERLAY: { NON_MATCH_DIM: number }` in `src/constants.ts` (Task 2 adds `RING_OUTSIDE_PX`, `RING_INSIDE_PX`, `RING_MIN_SQUARE_PX`).
  - `Picture<C>.rings?: (C | null)[]` in `src/geometry.ts`.
  - `export type VerseColor = Color | Color[]` in `src/itemColoring.ts`.
  - `export function combineLayers(count: number, search: readonly (VerseColor | null)[] | null, overlay: readonly (VerseColor | null)[] | null): Picture<VerseColor | null>`. `search` is null with no search on, `overlay` null with no overlay. `rings` is present only when both are on.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/combineLayers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combineLayers, getDefaultColor } from '../../itemColoring';
import { HIGHLIGHT_CONSTANTS, SEARCH_WITH_OVERLAY } from '../../constants';
import type { Color } from '../../overlays/types';

const CYAN: Color = [0.1, 0.7, 0.8];
const ORANGE: Color = [1, 0.5, 0];
const RED: Color = [1, 0, 0];
const BLUE: Color = [0, 0, 1];
const DIM = SEARCH_WITH_OVERLAY.NON_MATCH_DIM;
const scaled = (c: Color, f: number): Color => [c[0] * f, c[1] * f, c[2] * f];
// What search alone has always drawn a verse it does not match as.
const ALONE = 0.6 * HIGHLIGHT_CONSTANTS.DIM_FACTOR;

describe('combineLayers', () => {
  describe('with no search', () => {
    it('passes the overlay through untouched, with no rings', () => {
      const overlay = [RED, null, [RED, BLUE] as Color[]];
      expect(combineLayers(3, null, overlay)).toEqual({ colors: overlay });
    });

    it('leaves every verse grey with no overlay either', () => {
      expect(combineLayers(2, null, null)).toEqual({ colors: [null, null] });
    });
  });

  describe('search alone', () => {
    it('fills a match with its search colour', () => {
      expect(combineLayers(1, [CYAN], null).colors[0]).toEqual(CYAN);
    });

    it('dims a verse it does not match to the grey search alone has always used', () => {
      expect(combineLayers(1, [null], null).colors[0]).toEqual([ALONE, ALONE, ALONE]);
    });

    it('draws no rings', () => {
      expect(combineLayers(1, [CYAN], null).rings).toBeUndefined();
    });
  });

  describe('search over an overlay', () => {
    it('rings a match in its search colour around the overlay colour', () => {
      const { colors, rings } = combineLayers(1, [CYAN], [RED]);
      expect(colors[0]).toEqual(RED);
      expect(rings![0]).toEqual(CYAN);
    });

    it('leaves the hole grey where the overlay has no colour for the match', () => {
      const { colors, rings } = combineLayers(1, [CYAN], [null]);
      expect(colors[0]).toBeNull();
      expect(rings![0]).toEqual(CYAN);
    });

    it('splits the ring of a verse several words match', () => {
      expect(combineLayers(1, [[CYAN, ORANGE]], [RED]).rings![0]).toEqual([CYAN, ORANGE]);
    });

    it('dims a verse it does not match, and gives it no ring', () => {
      const { colors, rings } = combineLayers(1, [null], [RED]);
      expect(colors[0]).toEqual(scaled(RED, DIM));
      expect(rings![0]).toBeNull();
    });

    it('dims each stripe of a verse the overlay splits', () => {
      expect(combineLayers(1, [null], [[RED, BLUE]]).colors[0]).toEqual([
        scaled(RED, DIM),
        scaled(BLUE, DIM),
      ]);
    });

    it('dims the grey of a verse the overlay leaves uncoloured', () => {
      expect(combineLayers(1, [null], [null]).colors[0]).toEqual(scaled(getDefaultColor(0), DIM));
    });

    it('dims every verse when the search matches nothing', () => {
      const { colors, rings } = combineLayers(2, [null, null], [RED, BLUE]);
      expect(colors).toEqual([scaled(RED, DIM), scaled(BLUE, DIM)]);
      expect(rings).toEqual([null, null]);
    });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/__tests__/unit/combineLayers.test.ts`
Expected: FAIL, `combineLayers` and `SEARCH_WITH_OVERLAY` are not exported.

- [ ] **Step 3: Implement**

In `src/constants.ts`, append:

```ts
/** How a search shows over an overlay. Starting values, to be settled by eye on the map. */
export const SEARCH_WITH_OVERLAY = {
  // What a verse the search does not match keeps of its overlay colour
  NON_MATCH_DIM: 0.85,
} as const;
```

In `src/geometry.ts`, replace the `Picture` interface and its comment with:

```ts
/**
 * One colouring of the map: a colour, or stripes, per verse, and how far each
 * verse has grown towards the size a multi-colour verse is drawn at, 0 to 1.
 * Without `growth`, a verse is fully grown exactly when its fill or its ring
 * has several colours. A verse's ring, where `rings` gives one, surrounds its
 * fill in colours of its own.
 */
export interface Picture<C = Color | Color[]> {
  colors: C[];
  growth?: number[];
  rings?: (C | null)[];
}
```

In `src/itemColoring.ts`, change the imports at the top to:

```ts
import type { SpatialItem, ItemState } from './types';
import type { Overlay, Color } from './overlays/types';
import type { Picture } from './geometry';
import { seededRandom } from './utils/random';
import { HIGHLIGHT_CONSTANTS, SEARCH_WITH_OVERLAY } from './constants';
```

and add, after `getDefaultColor`:

```ts
/** A verse's colour, or its stripes. */
export type VerseColor = Color | Color[];

const ALONE_SHADE = 0.6 * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
const UNMATCHED_ALONE: Color = [ALONE_SHADE, ALONE_SHADE, ALONE_SHADE];

function dim(color: VerseColor, factor: number): VerseColor {
  const one = (c: Color): Color => [c[0] * factor, c[1] * factor, c[2] * factor];
  return Array.isArray(color[0]) ? (color as Color[]).map(one) : one(color as Color);
}

/**
 * The map's colours from its two layers, search over overlay. `search` is null
 * with no search on and `overlay` null with no overlay; a null colour is
 * painted grey by computeItemStates.
 */
export function combineLayers(
  count: number,
  search: readonly (VerseColor | null)[] | null,
  overlay: readonly (VerseColor | null)[] | null,
): Picture<VerseColor | null> {
  const colors: (VerseColor | null)[] = new Array(count);
  const rings: (VerseColor | null)[] = new Array(count).fill(null);

  for (let i = 0; i < count; i++) {
    const under = overlay?.[i] ?? null;
    const match = search?.[i] ?? null;
    if (!search) {
      colors[i] = under;
    } else if (!overlay) {
      colors[i] = match ?? UNMATCHED_ALONE;
    } else if (match) {
      colors[i] = under;
      rings[i] = match;
    } else {
      colors[i] = dim(under ?? getDefaultColor(i), SEARCH_WITH_OVERLAY.NON_MATCH_DIM);
    }
  }

  return search && overlay ? { colors, rings } : { colors };
}
```

- [ ] **Step 4: Run the tests and the type checker**

Run: `npx vitest run src/__tests__/unit/combineLayers.test.ts && npm run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/geometry.ts src/itemColoring.ts src/__tests__/unit/combineLayers.test.ts
git commit -m "$(cat <<'EOF'
Combine the search and the overlay into fills and rings

A match over an overlay keeps the overlay's colour and gains a ring of
its search colour; a verse the search misses dims a little. Search on
its own draws as it always has.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

---

### Task 2: The renderer's donut, painted from the search's own slot

Two parts, each committed: A draws rings; B gives the search a slot of its own, so a link can put a search and an overlay on the map together. The task ends with Danyel judging the ring on the real build. **Tasks 3–6 wait for his verdict.**

**Files:**
- Part A: modify `src/constants.ts`, `src/geometry.ts`, `src/webgl.ts`, `src/rendering.ts`, `src/scrollytelling/colorBlending.ts`, `src/__tests__/helpers/mocks.ts:40-50`; tests `src/__tests__/unit/geometry.test.ts`, `src/__tests__/unit/webgl.test.ts`, `src/__tests__/unit/rendering.test.ts`, `src/scrollytelling/__tests__/colorBlending.test.ts`.
- Part B: modify `src/overlays/types.ts`, `src/urlState.ts`, `src/viewState.ts`, `src/overlays/search/index.ts`, `src/overlays/index.ts`, `src/itemColoring.ts`, `src/scrollytelling/overlayBlender.ts`, `src/main.ts`; create `src/tools.ts`, `src/__tests__/unit/tools.test.ts`; tests `src/__tests__/unit/combineLayers.test.ts`, `src/__tests__/unit/urlState.test.ts`, `src/__tests__/integration/view-state-restore.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`, `src/__tests__/unit/overlays/search.test.ts`, `src/__tests__/unit/overlays/search-meaning-filter.test.ts`, `src/__tests__/unit/search-matching.test.ts`.

**Interfaces:**
- Consumes: `combineLayers`, `VerseColor`, `SEARCH_WITH_OVERLAY`, `Picture.rings` (Task 1).
- Produces:
  - `SEARCH_WITH_OVERLAY.RING_OUTSIDE_PX`, `.RING_INSIDE_PX`, `.RING_MIN_SQUARE_PX` (CSS pixels).
  - `export function packColor(color: Color): number` in `src/geometry.ts`; `VERSE_ATTRIBUTES` names `a_rect`, `a_fill`, `a_ring`, `a_shape` (fill stripes, growth, ring stripes), `a_nextFill`, `a_nextRing`, `a_nextShape`.
  - `ShaderProgram.uniforms.ring` in `src/webgl.ts`.
  - `ToolOnMap<T>`, `Tools<T>` in `src/overlays/types.ts`.
  - `SEARCH_URL_PARAMS` in `src/urlState.ts` (keys `q`, `mode`, `m` here; Task 3 renames `q` to `search`); `UrlState.searchParams?: UrlParamValues`; `ViewState.searchParams: UrlParamValues`.
  - From `src/overlays/search/index.ts`: `searchTool` (was `searchOverlay`), `isSearching(settings: SearchSettings): boolean`, `searchFromLink(raw: LinkParams): SearchSettings`. Search's colour functions give a match's colour or null.
  - `toolsShown(overlay: Overlay | null, overlaySettings: unknown, search: SearchSettings): Tools` in `src/tools.ts`.
  - `toolsPicture<T>(tools: Tools<T>, items: SpatialItem<T>[], hovered: SpatialItem<T> | null): Picture<VerseColor | null>` in `src/itemColoring.ts`.
  - `pictureForStop(stop, verses, hovered): Picture` (was `colorsForStop`) and `stopSearchParams(stop)` in `src/scrollytelling/overlayBlender.ts`.
  - In `src/main.ts`: `applyTools()` (was `applyOverlay()`), `toolsNow(): Tools`.

#### Part A: rings in the renderer

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/geometry.test.ts`, replace everything from the imports through the end of `describe('buildItemGeometry', …)` (lines 1–134) with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildItemGeometry,
  createBuffer,
  packColor,
  FLOATS_PER_VERSE,
  MULTICOLOR_GROWTH,
  VERSE_ATTRIBUTES,
  VERSE_OFFSETS,
  type VerseAttributeName,
} from '../../geometry';
import { createVerse, createVerses, TEST_COLORS, createMockWebGL2Context } from '../helpers';
import type { Color } from '../../overlays/types';

const SIZE = Object.fromEntries(VERSE_ATTRIBUTES.map((a) => [a.name, a.size])) as Record<
  VerseAttributeName,
  number
>;

function field(buffer: Float32Array, verse: number, name: VerseAttributeName): number[] {
  const size = SIZE[name];
  const start = verse * FLOATS_PER_VERSE + VERSE_OFFSETS[name];
  return Array.from(buffer.subarray(start, start + size));
}

/** Four stripes as the buffer holds them: packed, and zero where unused. */
const packed = (...colors: Color[]): number[] =>
  [0, 1, 2, 3].map((s) => (colors[s] ? packColor(colors[s]) : 0));

const { RED, GREEN, BLUE, WHITE } = TEST_COLORS;

describe('packColor', () => {
  it('packs eight bits a channel, red highest', () => {
    expect(packColor([1, 0, 0])).toBe(0xff0000);
    expect(packColor([0, 1, 0])).toBe(0x00ff00);
    expect(packColor([0, 0, 1])).toBe(0x0000ff);
  });

  it('clamps what hover brightening pushes past 1, and rounds', () => {
    expect(packColor([1.5, -0.2, 0.5])).toBe(0xff0080);
  });

  it('survives the float buffer exactly', () => {
    const white = packColor([1, 1, 1]);
    expect(new Float32Array([white])[0]).toBe(white);
  });
});

describe('buildItemGeometry', () => {
  it('holds one entry per verse', () => {
    expect(buildItemGeometry(createVerses(7))).toHaveLength(7 * FLOATS_PER_VERSE);
    expect(buildItemGeometry([])).toHaveLength(0);
  });

  describe('rectangle', () => {
    it('spans the verse, less the 2-unit gap between squares', () => {
      const buffer = buildItemGeometry([createVerse({ x: 100, y: 200, size: 10 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100, 200, 108, 208]);
    });

    it('keeps fractional positions', () => {
      const buffer = buildItemGeometry([createVerse({ x: 100.5, y: 200.75, size: 8 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100.5, 200.75, 106.5, 206.75]);
    });

    it('gives each verse its own rectangle', () => {
      const verses = [createVerse({ x: 10, y: 20 }), createVerse({ x: 30, y: 40 })];
      const buffer = buildItemGeometry(verses);
      expect(field(buffer, 0, 'a_rect').slice(0, 2)).toEqual([10, 20]);
      expect(field(buffer, 1, 'a_rect').slice(0, 2)).toEqual([30, 40]);
    });
  });

  describe('growth', () => {
    it('grows by less than half the gap, so neighbours never touch', () => {
      expect(MULTICOLOR_GROWTH).toBeGreaterThan(0);
      expect(MULTICOLOR_GROWTH).toBeLessThan(1); // the gap between squares is 2
    });

    it('grows a verse with several colours fully, and one with one colour not at all', () => {
      const buffer = buildItemGeometry(createVerses(2), { colors: [[RED, BLUE], RED] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(1);
      expect(field(buffer, 1, 'a_shape')[1]).toBe(0);
    });

    it('grows a verse whose ring has several colours', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [RED], rings: [[GREEN, BLUE]] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(1);
    });

    it('grows a verse by the fraction it is given, whatever its colours', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [[RED, BLUE]], growth: [0.5] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(0.5);
    });
  });

  describe('colours', () => {
    it('packs the verse colour, zero after it, and a count of 1', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [RED] });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(1);
    });

    it('falls back to the base colour, then to the default fill', () => {
      const base: Color = [0.2, 0.3, 0.4];
      const given = buildItemGeometry([createVerse()], undefined, undefined, base);
      expect(field(given, 0, 'a_fill')[0]).toBe(packColor(base));

      const fallback = buildItemGeometry([createVerse()], { colors: [[]] });
      expect(field(fallback, 0, 'a_fill')[0]).toBe(packColor([0.6, 0.6, 0.6]));
    });

    it('keeps several colours in order with their count', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [[RED, GREEN, BLUE]] });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, GREEN, BLUE));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(3);
    });

    it('keeps at most four colours', () => {
      const buffer = buildItemGeometry([createVerse()], {
        colors: [[RED, GREEN, BLUE, WHITE, RED]],
      });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, GREEN, BLUE, WHITE));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(4);
    });

    it('colours each verse independently', () => {
      const buffer = buildItemGeometry(createVerses(3), {
        colors: [RED, [BLUE, GREEN], undefined as never],
      });
      expect([0, 1, 2].map((i) => field(buffer, i, 'a_shape')[0])).toEqual([1, 2, 1]);
    });
  });

  describe('rings', () => {
    it('holds no ring for a verse without one', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [RED], rings: [null] });
      expect(field(buffer, 0, 'a_ring')).toEqual([0, 0, 0, 0]);
      expect(field(buffer, 0, 'a_shape')[2]).toBe(0);
    });

    it('holds a ring in stripes of its own beside the fill', () => {
      const buffer = buildItemGeometry([createVerse()], {
        colors: [GREEN],
        rings: [[RED, BLUE]],
      });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(GREEN));
      expect(field(buffer, 0, 'a_ring')).toEqual(packed(RED, BLUE));
      expect(field(buffer, 0, 'a_shape')).toEqual([1, 1, 2]);
    });

    it('keeps at most four ring stripes', () => {
      const buffer = buildItemGeometry([createVerse()], {
        colors: [GREEN],
        rings: [[RED, GREEN, BLUE, WHITE, RED]],
      });
      expect(field(buffer, 0, 'a_ring')).toEqual(packed(RED, GREEN, BLUE, WHITE));
      expect(field(buffer, 0, 'a_shape')[2]).toBe(4);
    });
  });

  describe('two pictures', () => {
    it('holds the same picture twice when given one', () => {
      const buffer = buildItemGeometry([createVerse()], {
        colors: [[RED, BLUE]],
        rings: [GREEN],
      });
      expect(field(buffer, 0, 'a_nextFill')).toEqual(field(buffer, 0, 'a_fill'));
      expect(field(buffer, 0, 'a_nextRing')).toEqual(field(buffer, 0, 'a_ring'));
      expect(field(buffer, 0, 'a_nextShape')).toEqual(field(buffer, 0, 'a_shape'));
    });

    it('holds each picture whole, with its own stripes, growth and ring', () => {
      const buffer = buildItemGeometry(
        [createVerse()],
        { colors: [[RED, BLUE]] },
        { colors: [[RED, BLUE, GREEN]], growth: [0.25], rings: [RED] },
      );
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, BLUE));
      expect(field(buffer, 0, 'a_shape')).toEqual([2, 1, 0]);
      expect(field(buffer, 0, 'a_nextFill')).toEqual(packed(RED, BLUE, GREEN));
      expect(field(buffer, 0, 'a_nextRing')).toEqual(packed(RED));
      expect(field(buffer, 0, 'a_nextShape')).toEqual([3, 0.25, 1]);
    });
  });
});
```

In `src/__tests__/unit/webgl.test.ts`, change these expectations (find each by its test name):

- "compiles vertex shader with correct source": `'in vec3 a_color'` → `'in vec4 a_fill'`.
- "compiles fragment shader with correct source": `'in vec3 v_color'` → `'flat in highp vec4 v_fill'`.
- "fragment shader includes color interpolation logic": `'v_colorCount'` → `'v_counts'`.
- Replace the three tests "vertex shader passes colors to fragment shader", "fragment shader receives colors from vertex shader" and "fragment shader uses flat interpolation for colorCount" with:

```ts
    it('vertex shader passes both pictures, fill and ring, to the fragment shader', () => {
      createProgram(gl);
      const vertexSource = shaderSourceOf(gl, 0);

      for (const name of ['v_fill', 'v_ring', 'v_nextFill', 'v_nextRing']) {
        expect(vertexSource).toContain(`flat out highp vec4 ${name}`);
      }
      expect(vertexSource).toContain('v_fill = a_fill');
    });

    it('fragment shader receives both pictures, and their stripe counts, unblended', () => {
      createProgram(gl);
      const fragmentSource = shaderSourceOf(gl, 1);

      for (const name of ['v_fill', 'v_ring', 'v_nextFill', 'v_nextRing']) {
        expect(fragmentSource).toContain(`flat in highp vec4 ${name}`);
      }
      expect(fragmentSource).toContain('flat in ivec4 v_counts');
    });

    it('both shaders read the ring widths', () => {
      createProgram(gl);
      expect(shaderSourceOf(gl, 0)).toContain('uniform highp vec3 u_ring');
      expect(shaderSourceOf(gl, 1)).toContain('uniform highp vec3 u_ring');
    });

    it('measures the ring in from the drawn edge', () => {
      createProgram(gl);
      expect(shaderSourceOf(gl, 1)).toContain('float inset = u_ring.x + u_ring.y');
    });
```

- "vertex shader transforms positions correctly": replace its first expectation with `expect(vertexSource).toContain('mix(rect.xy, rect.zw, uv)');` and add `expect(vertexSource).toContain('(world + u_pan) * u_zoom');`.
- "returns all required uniform locations": add `expect(program.uniforms.ring).toBeDefined();`.
- "uniforms contains all 4 uniforms": rename it "uniforms contains all 5 uniforms", change `toHaveLength(4)` to `toHaveLength(5)`, and add `expect(uniformKeys).toContain('ring');`.

In `src/__tests__/unit/rendering.test.ts`:

- In "initializes main shader program with correct attributes", `attribs.a_color` → `attribs.a_fill`.
- Add to the imports:

```ts
import { SEARCH_WITH_OVERLAY } from '../../constants';
```

- Inside `describe('render', …)`, after "sets camera uniforms with dpr scaling", add:

```ts
    it('hands the shader the ring in device pixels', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      const { RING_OUTSIDE_PX, RING_INSIDE_PX, RING_MIN_SQUARE_PX } = SEARCH_WITH_OVERLAY;
      expect(context.gl.uniform3f).toHaveBeenCalledWith(
        context.programs.main.uniforms.ring,
        RING_OUTSIDE_PX * 2,
        RING_INSIDE_PX * 2,
        RING_MIN_SQUARE_PX * 2,
      );
    });
```

- At the end of the file, add:

```ts
describe('the search ring', () => {
  it('leaves a hole in the smallest square that has one', () => {
    // There the square is drawn RING_OUTSIDE_PX larger on every side and the
    // ring is measured in from that edge, so the hole is the square less the
    // inside width twice.
    const { RING_INSIDE_PX, RING_MIN_SQUARE_PX } = SEARCH_WITH_OVERLAY;
    expect(RING_MIN_SQUARE_PX - 2 * RING_INSIDE_PX).toBeGreaterThan(0);
  });
});
```

In `src/scrollytelling/__tests__/colorBlending.test.ts`, add at the end:

```ts
describe('mergePictures with rings', () => {
  const RED: Color = [1, 0, 0];
  const BLUE: Color = [0, 0, 1];

  it('fades a ring in from the fill it grows out of', () => {
    const merged = mergePictures({ colors: [RED] }, { colors: [RED], rings: [BLUE] }, 0.5);
    expect(merged.rings![0]).toEqual([0.5, 0, 0.5]);
  });

  it('leaves a verse with a ring on neither side without one', () => {
    const merged = mergePictures(
      { colors: [RED, RED] },
      { colors: [RED, RED], rings: [BLUE, null] },
      0.5,
    );
    expect(merged.rings![1]).toBeNull();
  });

  it('draws no rings when neither side has any', () => {
    expect(mergePictures({ colors: [RED] }, { colors: [BLUE] }, 0.5).rings).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/unit/geometry.test.ts src/__tests__/unit/webgl.test.ts src/__tests__/unit/rendering.test.ts src/scrollytelling/__tests__/colorBlending.test.ts`
Expected: FAIL: `packColor` is not exported, the attribute names are unknown, and `mergePictures` returns no rings.

- [ ] **Step 3: Implement**

In `src/constants.ts`, replace `SEARCH_WITH_OVERLAY` with:

```ts
/** How a search shows over an overlay. Starting values, to be settled by eye on the map. */
export const SEARCH_WITH_OVERLAY = {
  // What a verse the search does not match keeps of its overlay colour
  NON_MATCH_DIM: 0.85,
  // The ring around a match, in CSS pixels, outside the square and inside it
  RING_OUTSIDE_PX: 1.5,
  RING_INSIDE_PX: 1,
  // A square smaller than this on screen has no room for a hole and is filled
  // with its search colour. Rings can touch where layout jitter brings squares
  // close, as the multi-colour growth already can.
  RING_MIN_SQUARE_PX: 8,
} as const;
```

In `src/geometry.ts`, replace everything after `const NO_COLORS: Picture = { colors: [] };` up to (not including) `export function createBuffer` with:

```ts
/**
 * What the buffer holds for each verse, read once per verse. Each name is a
 * shader input, and rendering.ts points it at its slice.
 *
 * Each verse carries two pictures, which the shader mixes by one fade for the
 * whole map, so moving between them redraws without rebuilding this buffer.
 * At rest the two are the same.
 *
 * A fill and a ring are four stripes each, one colour to a float (packColor):
 * unpacked, two pictures would need 19 attributes and 20 varyings, and WebGL 2
 * promises only 16 and 15.
 */
export const VERSE_ATTRIBUTES = [
  { name: 'a_rect', size: 4 }, // left, top, right, bottom in world units, before growing
  { name: 'a_fill', size: 4 },
  { name: 'a_ring', size: 4 },
  { name: 'a_shape', size: 3 }, // fill stripe count, growth, ring stripe count (0 for none)
  { name: 'a_nextFill', size: 4 },
  { name: 'a_nextRing', size: 4 },
  { name: 'a_nextShape', size: 3 },
] as const;

export type VerseAttributeName = (typeof VERSE_ATTRIBUTES)[number]['name'];

/** Where each entry starts within a verse's slice, in floats. */
export const VERSE_OFFSETS = {} as Record<VerseAttributeName, number>;
let floats = 0;
for (const { name, size } of VERSE_ATTRIBUTES) {
  VERSE_OFFSETS[name] = floats;
  floats += size;
}
export const FLOATS_PER_VERSE = floats;

/** A colour as one float, 8 bits a channel; exact, as a float holds every integer below 2^24. */
export function packColor([r, g, b]: Color): number {
  const byte = (c: number): number => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return byte(r) * 0x10000 + byte(g) * 0x100 + byte(b);
}

const SLOTS = {
  from: { fill: 'a_fill', ring: 'a_ring', shape: 'a_shape' },
  to: { fill: 'a_nextFill', ring: 'a_nextRing', shape: 'a_nextShape' },
} as const;

/** A verse's stripes: at most four, and the base colour for none. */
function stripesOf(color: Color | Color[] | null | undefined, baseColor: Color): Color[] {
  if (isColorArray(color)) return color.slice(0, 4);
  if (Array.isArray(color) && (color as unknown[]).length === 0) return [baseColor];
  return [(color as Color | null | undefined) || baseColor];
}

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  from: Picture = NO_COLORS,
  to: Picture = from,
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  const data = new Float32Array(verses.length * FLOATS_PER_VERSE);

  const writePicture = (picture: Picture, slots: (typeof SLOTS)['from' | 'to'], i: number) => {
    const base = i * FLOATS_PER_VERSE;
    const fill = stripesOf(picture.colors[i], baseColor);
    const ringColor = picture.rings?.[i];
    const ring = ringColor ? stripesOf(ringColor, baseColor) : [];

    // Unused stripes stay zero
    fill.forEach((color, s) => (data[base + VERSE_OFFSETS[slots.fill] + s] = packColor(color)));
    ring.forEach((color, s) => (data[base + VERSE_OFFSETS[slots.ring] + s] = packColor(color)));
    const shape = base + VERSE_OFFSETS[slots.shape];
    data[shape] = fill.length;
    data[shape + 1] = picture.growth?.[i] ?? (Math.max(fill.length, ring.length) > 1 ? 1 : 0);
    data[shape + 2] = ring.length;
  };

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const rect = i * FLOATS_PER_VERSE + VERSE_OFFSETS.a_rect;
    data[rect] = v.x;
    data[rect + 1] = v.y;
    data[rect + 2] = v.x + v.size - 2; // -2 for gap
    data[rect + 3] = v.y + v.size - 2;
    writePicture(from, SLOTS.from, i);
    writePicture(to, SLOTS.to, i);
  }

  return data;
}
```

Also change `isColorArray`'s parameter type to `Color | Color[] | null | undefined`.

In `src/webgl.ts`:

- Add `ring: WebGLUniformLocation | null;` to `ShaderProgram['uniforms']`, and `ring: gl.getUniformLocation(program, 'u_ring'),` to the uniforms `createProgram` returns.
- Replace `VERTEX_SHADER` and `FRAGMENT_SHADER` with:

```ts
const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;
  // How far each verse has gone from its first picture to its second.
  // Shared with the fragment shader, so its precision is stated in both.
  uniform highp float u_fade;
  // A ring's width outside the square and inside it, and the smallest square
  // that keeps a hole, in device pixels. Shared, like u_fade.
  uniform highp vec3 u_ring;

  ${VERSE_INPUTS}

  // The two triangles of a square, as fractions of the way across it. Every
  // verse is drawn from these six corners, picked by gl_VertexID.
  const vec2 CORNERS[6] = vec2[6](
    vec2(0, 0), vec2(1, 0), vec2(0, 1),
    vec2(0, 1), vec2(1, 0), vec2(1, 1)
  );

  flat out highp vec4 v_fill;
  flat out highp vec4 v_ring;
  flat out highp vec4 v_nextFill;
  flat out highp vec4 v_nextRing;
  // Stripe counts: this picture's fill and ring, then the next's. A ring of
  // no stripes is no ring.
  flat out ivec4 v_counts;
  // The drawn square's side in device pixels, growth included, or 0 when the
  // square is too small for a hole.
  flat out float v_side;
  out vec2 v_uv;
  out vec2 v_seed;
  // This point in device pixels from the drawn square's top-left corner.
  out vec2 v_px;

  // How far a picture's verse reaches past its square, in world units.
  float reach(vec3 shape, bool holes) {
    float grow = shape.y * ${MULTICOLOR_GROWTH.toFixed(4)};
    return shape.z > 0.0 && holes ? max(grow, u_ring.x / u_zoom) : grow;
  }

  void main() {
    vec2 uv = CORNERS[gl_VertexID];
    float side = (a_rect.z - a_rect.x) * u_zoom;
    bool holes = side >= u_ring.z;
    float grow = mix(reach(a_shape, holes), reach(a_nextShape, holes), u_fade);
    vec4 rect = a_rect + vec4(-grow, -grow, grow, grow);
    vec2 world = mix(rect.xy, rect.zw, uv);
    vec2 pos = (world + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_fill = a_fill;
    v_ring = a_ring;
    v_nextFill = a_nextFill;
    v_nextRing = a_nextRing;
    v_counts = ivec4(a_shape.x, a_shape.z, a_nextShape.x, a_nextShape.z);
    v_side = holes ? (rect.z - rect.x) * u_zoom : 0.0;
    v_uv = uv;
    v_px = (world - rect.xy) * u_zoom;
    // The square's own corner, which zooming does not move, seeds its dithering noise
    v_seed = a_rect.xy;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  uniform highp float u_fade;
  uniform highp vec3 u_ring;
  flat in highp vec4 v_fill;
  flat in highp vec4 v_ring;
  flat in highp vec4 v_nextFill;
  flat in highp vec4 v_nextRing;
  flat in ivec4 v_counts;
  flat in float v_side;
  in vec2 v_uv;
  in vec2 v_seed;
  in vec2 v_px;
  out vec4 fragColor;

  // Simple hash for dithering noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 unpack(highp float packed) {
    highp int c = int(packed);
    return vec3(float(c >> 16), float((c >> 8) & 255), float(c & 255)) / 255.0;
  }

  // Several colors split the square into bands running corner to corner, one
  // per color. A diagonal cut keeps a two-color verse from reading as two
  // neighbouring verses, as a vertical split does.
  vec3 stripes(highp vec4 colors, int count) {
    if (count <= 1) return unpack(colors.x);
    float d = min((v_uv.x + v_uv.y) * 0.5, 0.999);
    int idx = int(floor(d * float(count)));
    if (idx == 0) return unpack(colors.x);
    if (idx == 1) return unpack(colors.y);
    if (idx == 2) return unpack(colors.z);
    return unpack(colors.w);
  }

  // The ring is measured in from the drawn edge, so a grown verse's ring is
  // as thick as any other's.
  bool inHole() {
    float inset = u_ring.x + u_ring.y;
    return v_side > 0.0 &&
      all(greaterThanEqual(v_px, vec2(inset))) &&
      all(lessThan(v_px, vec2(v_side - inset)));
  }

  // One picture here: its ring, if it has one and this is not the hole;
  // otherwise its fill.
  vec3 picture(highp vec4 fill, highp vec4 ring, int fillCount, int ringCount) {
    if (ringCount == 0 || inHole()) return stripes(fill, fillCount);
    return stripes(ring, ringCount);
  }

  void main() {
    // Each picture is drawn whole and the two are faded, so neither's stripes
    // have to move to meet the other's.
    vec3 color = mix(
      picture(v_fill, v_ring, v_counts.x, v_counts.y),
      picture(v_nextFill, v_nextRing, v_counts.z, v_counts.w),
      u_fade
    );

    // Add subtle dithering noise to break up moiré patterns (UV-based for zoom stability)
    vec2 noiseCoord = floor(v_uv * 12.0);
    float noise = (hash(noiseCoord + v_seed * 0.01) - 0.5) * 0.1;
    color = color + noise;

    fragColor = vec4(color, 1.0);
  }
`;
```

In `src/rendering.ts`, change `import { HIGHLIGHT_CONSTANTS } from './constants';` to `import { HIGHLIGHT_CONSTANTS, SEARCH_WITH_OVERLAY } from './constants';`, and after `gl.uniform1f(programs.main.uniforms.fade, state.fade);` add:

```ts
  const { RING_OUTSIDE_PX, RING_INSIDE_PX, RING_MIN_SQUARE_PX } = SEARCH_WITH_OVERLAY;
  gl.uniform3f(
    programs.main.uniforms.ring,
    RING_OUTSIDE_PX * dpr,
    RING_INSIDE_PX * dpr,
    RING_MIN_SQUARE_PX * dpr,
  );
```

In `src/scrollytelling/colorBlending.ts`, replace everything from `function growthAt` to the end of the file with:

```ts
function growthAt(picture: Picture, i: number, stripes: number): number {
  return picture.growth?.[i] ?? (stripes > 1 ? 1 : 0);
}

/**
 * One picture `t` of the way between two, blended stripe by stripe.
 *
 * The side with fewer stripes is stretched to match, each of its colours
 * covering the stripes nearest where its band lay. A verse whose stripe count
 * differs between the two therefore changes its stripe widths, which the
 * shader's fade between whole pictures avoids; this is only for collapsing a
 * fade in progress when another has to start from it. Rings merge the same
 * way, a verse without one counting its fill as its ring.
 *
 * If a verse ends up with a single slot, the result is returned as a plain
 * Color (not [Color]) so the geometry buffer emits it the same way it would
 * at rest.
 */
export function mergePictures(from: Picture, to: Picture, t: number): Picture {
  const len = Math.max(from.colors.length, to.colors.length);
  const colors: (Color | Color[])[] = new Array(len);
  const growth: number[] = new Array(len);
  const rings: (Color | Color[] | null)[] = new Array(len).fill(null);

  for (let i = 0; i < len; i++) {
    const fillFrom = toColorArray(from.colors[i]);
    const fillTo = toColorArray(to.colors[i]);
    colors[i] = mergeStripes(fillFrom, fillTo, t);

    const ringFrom = toColorArray(from.rings?.[i]);
    const ringTo = toColorArray(to.rings?.[i]);
    if (ringFrom.length > 0 || ringTo.length > 0) {
      rings[i] = mergeStripes(
        ringFrom.length > 0 ? ringFrom : fillFrom,
        ringTo.length > 0 ? ringTo : fillTo,
        t,
      );
    }

    const grownFrom = growthAt(from, i, Math.max(fillFrom.length, ringFrom.length));
    const grownTo = growthAt(to, i, Math.max(fillTo.length, ringTo.length));
    growth[i] = grownFrom + (grownTo - grownFrom) * t;
  }

  return from.rings || to.rings ? { colors, growth, rings } : { colors, growth };
}

function mergeStripes(from: Color[], to: Color[], t: number): Color | Color[] {
  const count = Math.max(from.length, to.length, 1);
  const stripes: Color[] = new Array(count);
  for (let j = 0; j < count; j++) {
    stripes[j] = lerpColor(stretched(from, j, count), stretched(to, j, count), t);
  }
  return count === 1 ? stripes[0] : stripes;
}

const EMPTY_SLOT: Color = [0.15, 0.15, 0.15];

// The colour at slot `j` of `slots` spread over `count` equal bands.
function stretched(slots: Color[], j: number, count: number): Color {
  if (slots.length === 0) return EMPTY_SLOT;
  return slots[Math.floor((j * slots.length) / count)];
}

// A single Color is a 3-tuple of numbers; Color[] is an array of those tuples.
// Tell them apart by the type of the first element.
function toColorArray(c: Color | Color[] | null | undefined): Color[] {
  if (!c) return [];
  return typeof c[0] === 'number' ? [c as Color] : (c as Color[]);
}
```

In `src/__tests__/helpers/mocks.ts`, replace the attribute locations table with:

```ts
      const locations: Record<string, number> = {
        'a_position': 0,
        'a_rect': 0,
        'a_fill': 1,
        'a_ring': 2,
        'a_shape': 3,
        'a_nextFill': 4,
        'a_nextRing': 5,
        'a_nextShape': 6,
      };
```

- [ ] **Step 4: Run the tests and the type checker**

Run: `npm run typecheck && npx vitest run`
Expected: all pass. `src/main.ts` and `src/main-talmud.ts` compile unchanged: pictures without rings draw as before.

- [ ] **Step 5: Check the shaders compile in a real browser**

A unit test only reads shader source. Run `npm run test:layout` (it starts its own server on port 5199). Expected: every state passes, including "a map that actually drew" and "no page errors"; a shader that fails to compile throws on load and fails every state.

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/geometry.ts src/webgl.ts src/rendering.ts src/scrollytelling/colorBlending.ts src/__tests__/helpers/mocks.ts src/__tests__/unit/geometry.test.ts src/__tests__/unit/webgl.test.ts src/__tests__/unit/rendering.test.ts src/scrollytelling/__tests__/colorBlending.test.ts
git commit -m "$(cat <<'EOF'
Draw a ring around a verse that has one

The ring's widths are screen pixels, so it does not thin as the map
zooms out, and a square too small for a hole is filled with the ring's
colour. Colours are packed one to a float to fit a ring beside the fill
for both pictures within WebGL 2's attribute limits.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

#### Part B: the search's own slot

- [ ] **Step 7: Write the failing tests**

Create `src/__tests__/unit/tools.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toolsShown } from '../../tools';
import { searchTool, searchFromLink } from '../../overlays/search/index';
import { commentaryOverlay } from '../../overlays/commentary';

describe('toolsShown', () => {
  it('shows the search once it has a word long enough to search on', () => {
    expect(toolsShown(null, undefined, searchFromLink({ q: 'אור' })).search?.tool).toBe(searchTool);
  });

  it('leaves the search off for a single letter, or for nothing', () => {
    expect(toolsShown(null, undefined, searchFromLink({ q: 'א' })).search).toBeNull();
    expect(toolsShown(null, undefined, searchFromLink({})).search).toBeNull();
  });

  it('shows the overlay with its settings beside the search', () => {
    const settings = { category: 'total' };
    const tools = toolsShown(commentaryOverlay, settings, searchFromLink({ q: 'אור' }));
    expect(tools.overlay).toEqual({ tool: commentaryOverlay, settings });
    expect(tools.search).not.toBeNull();
  });
});
```

In `src/__tests__/unit/combineLayers.test.ts`, add `toolsPicture` to the `itemColoring` import, add

```ts
import type { Overlay } from '../../overlays/types';
import { createVerse } from '../helpers/fixtures';
```

and append:

```ts
describe('toolsPicture', () => {
  it('asks each tool for its colours and combines them, search over overlay', () => {
    const overlay: Overlay = { id: 'o', name: 'O', getVerseColor: () => RED };
    const search: Overlay = {
      id: 's',
      name: 'S',
      getVerseColor: (v) => (v.verse === 1 ? CYAN : null),
    };
    const items = [createVerse({ verse: 1 }), createVerse({ verse: 2 })];

    const picture = toolsPicture(
      {
        overlay: { tool: overlay, settings: undefined },
        search: { tool: search, settings: undefined },
      },
      items,
      null,
    );

    expect(picture.colors).toEqual([RED, scaled(RED, DIM)]);
    expect(picture.rings).toEqual([CYAN, null]);
  });
});
```

In `src/__tests__/unit/urlState.test.ts`, add at the end of the file:

```ts
describe('the search in a link', () => {
  beforeEach(() => {
    mockHistory();
  });

  it('is read whatever overlay is on', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&q=אברם&mode=w');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('commentary');
    expect(state.searchParams).toEqual({ q: 'אברם', mode: 'w' });
  });

  it('is left out of a link that does not search', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary');
    expect(parseUrlState(overlayUrlParams).searchParams).toBeUndefined();
  });

  it('is written first, before the overlay it sits over', () => {
    const hash = buildUrlHash({
      searchParams: { q: 'אברם' },
      overlay: 'commentary',
      overlayParams: { category: 'Liturgy' },
    });
    expect(hash).toBe(`#q=${encodeURIComponent('אברם')}&overlay=commentary&category=Liturgy`);
  });
});
```

In `src/__tests__/integration/view-state-restore.test.ts`:

- In "opens an empty hash as the story, with Explore reset", add `searchParams: {},` after `overlayParams: {},` in the expected object.
- Inside `describe('which mode a link opens in', …)`, add:

```ts
    it('opens a link that only searches in Explore, with its search', () => {
      const view = viewFor('#q=light');
      expect(view.mode).toBe('explore');
      expect(view.overlay).toBe('none');
      expect(view.searchParams).toEqual({ q: 'light' });
    });

    it('keeps the search whatever overlay the link names', () => {
      expect(viewFor('#q=light&overlay=trop').searchParams).toEqual({ q: 'light' });
    });
```

In `src/scrollytelling/__tests__/overlayBlender.test.ts`:

- Change the first import to `import { pictureForStop, computeBlendedColors } from '../overlayBlender';`, and in `describe('colorsForStop', …)` rename the describe to `'pictureForStop'` and replace its expectation with `expect(pictureForStop(stop, verses, null)).toEqual(computeBlendedColors(stop, stop, 0, verses, null).from);`.
- Add these imports:

```ts
import { searchTool } from '../../overlays/search/index';
import { buildSearchIndex } from '../../search';
import { SAMPLE_VERSE_TEXTS } from '../../__tests__/helpers/fixtures';
import { SEARCH_COLORS } from '../../utils/color';
import { HIGHLIGHT_CONSTANTS } from '../../constants';
```

- Append:

```ts
describe('a stop that searches', () => {
  beforeEach(() => {
    buildSearchIndex(SAMPLE_VERSE_TEXTS);
    registerOverlay(searchTool);
  });

  it('fills its matches and dims the rest, as search alone always has', () => {
    // "God" is in Genesis 1:1 and not 1:2.
    const stop: ResolvedStoryStop = {
      id: 'search',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'search',
      overlayParams: { q: 'God' },
    };
    const picture = pictureForStop(stop, verses, null);
    const grey = 0.6 * HIGHLIGHT_CONSTANTS.DIM_FACTOR;

    expect(picture.colors[0]).toEqual(SEARCH_COLORS[0]);
    expect(picture.colors[1]).toEqual([grey, grey, grey]);
    expect(picture.rings).toBeUndefined();
  });
});
```

In `src/__tests__/unit/overlays/search.test.ts`, the search now colours only its matches:

- "returns dimmed color for non-matching verses": rename to `'gives no colour to a verse it does not match'` and replace its body with `expect(searchOverlay.getVerseColor(testVerses[1])).toBeNull();`.
- "dims verses without Hebrew matches": rename to `'gives no colour to a verse without a Hebrew match'`, body `expect(searchOverlay.getVerseColor(testVerses[3])).toBeNull();`.
- "handles query with no matches": replace the loop body with `expect(searchOverlay.getVerseColor(verse)).toBeNull();`.
- "handles verse not in search results": replace the last two lines with `expect(searchOverlay.getVerseColor(verse)).toBeNull();`.
- Delete `const DIM_FACTOR = HIGHLIGHT_CONSTANTS.DIM_FACTOR;` and the `HIGHLIGHT_CONSTANTS` import.

In `src/__tests__/unit/overlays/search-meaning-filter.test.ts`, replace `toEqual(dimmed())` with `toBeNull()` and delete the `dimmed` function.

In `src/__tests__/integration/search-overlay-modes.test.ts`, in the test that switches `אלה` to word mode (around line 137), a verse word mode does not match now has no colour: replace the lines from the comment `// Should be dimmed (not matched as whole word)` through `expect(wc[1]).toBe(wc[2]);` with:

```ts
      // Word mode does not match "אלה" inside "ואלה"
      expect(wordColor).toBeNull();
```

In `src/__tests__/unit/search-matching.test.ts`, line 5: `import { searchOverlay as overlay } from '../../overlays/search';` → `import { searchTool as overlay } from '../../overlays/search';`.

- [ ] **Step 8: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/unit/tools.test.ts src/__tests__/unit/combineLayers.test.ts src/__tests__/unit/urlState.test.ts src/__tests__/integration/view-state-restore.test.ts src/scrollytelling/__tests__/overlayBlender.test.ts src/__tests__/unit/overlays/search.test.ts`
Expected: FAIL: `src/tools.ts`, `toolsPicture`, `searchTool`, `searchFromLink` and `pictureForStop` do not exist; links carry no `searchParams`; search still colours non-matches grey.

- [ ] **Step 9: Implement**

In `src/overlays/types.ts`, append:

```ts
/** A tool on the map, with the settings the app holds for it. */
export interface ToolOnMap<T = TanakhIdentity> {
  tool: Overlay<T>;
  settings: unknown;
}

/** What colours the map: the overlay and the search, each null while off. */
export interface Tools<T = TanakhIdentity> {
  overlay: ToolOnMap<T> | null;
  search: ToolOnMap<T> | null;
}
```

In `src/urlState.ts`:

- After the `UrlParamValues` type, add:

```ts
/** The search's keys, read whatever overlay is on. */
export const SEARCH_URL_PARAMS = [
  { key: 'q', kind: 'text' },
  // Positional across the terms in q, one letter each, and an empty entry for
  // a term still on its default (see MODE_LETTERS in search/terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];
```

- In `UrlState`, after `overlayParams`, add:

```ts
  /** The search's own keys, when the link searches. */
  searchParams?: UrlParamValues;
```

- In `parseUrlState`, before `return state;`, add:

```ts
  const search = validateOverlayParams(SEARCH_URL_PARAMS, params);
  if (Object.keys(search).length > 0) state.searchParams = search;
```

- In `buildUrlHash`, right after `const params = new URLSearchParams();`, add:

```ts
  // The search first, then the overlay it sits over.
  for (const [key, value] of Object.entries(state.searchParams ?? {})) {
    if (value) params.set(key, value);
  }
```

In `src/viewState.ts`:

- Import: `import { parseVerseFromUrl, type OverlayParams, type UrlParamValues, type UrlState } from './urlState.ts';`
- In `ViewState`, after `overlayParams`, add `searchParams: UrlParamValues;`.
- In `resolveViewState`, add `url.searchParams === undefined &&` as the first clause of `namesNothing`, and `searchParams: url.searchParams ?? {},` after `overlayParams`.

In `src/overlays/search/index.ts`:

- Replace the header comment's first two lines with `// The full-text search: the search a term list describes, and the members the` / `// app draws, colours and links it through.`
- Imports: change the `../types.ts` import to `import type { Overlay, Color, UrlParamValues } from '../types.ts';`, delete `import { HIGHLIGHT_CONSTANTS } from '../../constants.ts';`, and add:

```ts
import { SEARCH_URL_PARAMS, validateOverlayParams } from '../../urlState.ts';
import type { LinkParams } from '../settings.ts';
```

- Delete the local `URL_PARAMS` constant (lines 63–69).
- Replace `searchColorAt` with:

```ts
/** A verse's colour given what a term list found: each matching term's own colour, split corner to corner when there are several. */
function searchColorAt(verse: TanakhIdentity, search: Search): Color | Color[] | null {
  const termIndices = search.matchingTerms.get(tanakhKey(verse.book, verse.chapter, verse.verse));
  if (!termIndices || termIndices.length === 0) return null;

  const colors = termIndices.map((i) => SEARCH_COLORS[colorIndexAt(search.active, i)]);
  return colors.length === 1 ? colors[0] : colors;
}
```

- Change `settingsFromUrl`'s parameter type to `UrlParamValues<typeof SEARCH_URL_PARAMS>`, and after it add:

```ts
/** The search a link or a story stop names. */
export function searchFromLink(raw: LinkParams): SearchSettings {
  return settingsFromUrl(validateOverlayParams(SEARCH_URL_PARAMS, raw));
}

/** Whether the search has a term it searches on. */
export function isSearching(settings: SearchSettings): boolean {
  return activeTerms(settings).length > 0;
}
```

- `isSearching` reuses the rule `searchFor` already applies, rather than restating it: above `searchFor`, add

```ts
/**
 * The terms the search runs. Short ones are left out for the same reason
 * parseSearchTerms drops them: a single letter matches most of the corpus and
 * is almost never meant.
 */
function activeTerms(settings: SearchSettings): SearchTerm[] {
  return settings.terms.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH);
}
```

  and in `searchFor`, `const active = settings.terms.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH);` → `const active = activeTerms(settings);`; the doc comment on the `Search` interface's `active` field shrinks to `/** The terms the search actually runs, in order (see activeTerms). */`. `isSearching` does not run the search, so the story blender and the legend can ask it freely.

- `export const searchOverlay: Overlay<TanakhIdentity, SearchSettings> = {` → `export const searchTool: Overlay<TanakhIdentity, SearchSettings> = {`, and `urlParams: URL_PARAMS,` → `urlParams: SEARCH_URL_PARAMS,`.

In `src/overlays/index.ts`: `import { searchOverlay } from './search/index.ts';` → `import { searchTool } from './search/index.ts';`, and `searchOverlay,` in `ALL_OVERLAYS` → `searchTool,`.

Create `src/tools.ts`:

```ts
// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, Tools } from './overlays/types.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';

/**
 * The tools a view shows: the overlay, if one is on, and the search, while it
 * has a word to search on. The search is also still in the overlay list; as
 * the overlay, it shows through its own slot rather than twice.
 */
export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): Tools {
  return {
    overlay: overlay && overlay !== searchTool ? { tool: overlay, settings: overlaySettings } : null,
    search: isSearching(search) ? { tool: searchTool, settings: search } : null,
  };
}
```

In `src/itemColoring.ts`, change the overlays import to `import type { Overlay, Color, ToolOnMap, Tools } from './overlays/types';` and add after `overlayColorsFor`:

```ts
/** The map's colours for the tools a view shows. */
export function toolsPicture<T>(
  tools: Tools<T>,
  items: SpatialItem<T>[],
  hovered: SpatialItem<T> | null,
): Picture<VerseColor | null> {
  const colorsOf = (on: ToolOnMap<T> | null) =>
    on && overlayColorsFor(on.tool, items, on.settings, hovered);
  return combineLayers(items.length, colorsOf(tools.search), colorsOf(tools.overlay));
}
```

Replace `src/scrollytelling/overlayBlender.ts` from the imports through the end of `colorsForStop` with:

```ts
import type { ResolvedStoryStop, StoryStop } from './types';
import type { TanakhLayout } from '../types';
import type { Color, Overlay } from '../overlays/types.ts';
import type { Picture } from '../geometry.ts';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor, toolsPicture } from '../itemColoring';
import { still, type ColorLayer } from './colorBlending';
import { SEARCH_URL_PARAMS, validateOverlayParams, type UrlParamValues } from '../urlState.ts';
import { settingsFromLink } from '../overlays/settings.ts';
import { searchFromLink } from '../overlays/search/index.ts';
import { toolsShown } from '../tools.ts';

// Memoised per verses array by the stop's overlay, its search and their
// validated link parameters. The key is canonical because validateOverlayParams
// writes keys in the order urlParams declares them, so stops that ask for the
// same thing share an entry. Colours that depend on the hover are recomputed
// while a verse is hovered: caching by hover too would add an entry for every
// verse the cursor crosses.
const picturesCache = new WeakMap<TanakhLayout[], Map<string, Picture>>();

// UrlParamValues declares every key optional; validateOverlayParams only ever
// sets present keys to non-empty strings, so this just gives TypeScript proof
// of what's already true at runtime.
function definedEntries(values: UrlParamValues): [string, string][] {
  return Object.entries(values).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
}

function paramsKey(values: UrlParamValues): string {
  return new URLSearchParams(Object.fromEntries(definedEntries(values))).toString();
}

type StopTools = Pick<StoryStop, 'overlay' | 'overlayParams'>;

/** A stop's search. A stop searches by naming the search as its overlay. */
export function stopSearchParams(stop: StopTools): Record<string, string> {
  return stop.overlay === 'search' ? (stop.overlayParams ?? {}) : {};
}

function cacheKeyFor(overlay: Overlay | null, stop: StopTools): string {
  const overlayKey = overlay
    ? `${overlay.id}?${paramsKey(validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {}))}`
    : 'none';
  const searchKey = paramsKey(validateOverlayParams(SEARCH_URL_PARAMS, stopSearchParams(stop)));
  return `${overlayKey}#${searchKey}`;
}

function withDefaults(picture: Picture<Color | Color[] | null>): Picture {
  return { ...picture, colors: picture.colors.map((c, i) => c ?? getDefaultColor(i)) };
}

export function pictureForStop(
  stop: ResolvedStoryStop,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): Picture {
  const named = stop.overlay ? getOverlay(stop.overlay) : undefined;
  // One that doesn't answer as a function of settings is drawn as no overlay.
  const overlay = named?.colorsFor ? named : null;
  const byHover = !!(overlay?.hoverChangesColors && hovered);

  let cache = picturesCache.get(verses);
  if (!cache) {
    cache = new Map();
    picturesCache.set(verses, cache);
  }
  const key = cacheKeyFor(overlay, stop);
  const cached = byHover ? undefined : cache.get(key);
  if (cached) return cached;

  const tools = toolsShown(
    overlay,
    overlay ? settingsFromLink(overlay, stop.overlayParams ?? {}) : undefined,
    searchFromLink(stopSearchParams(stop)),
  );
  const picture = withDefaults(toolsPicture(tools, verses, hovered));
  if (!byHover) cache.set(key, picture);
  return picture;
}
```

and in `computeBlendedColors` replace each `{ colors: colorsForStop(X, verses, hovered) }` with `pictureForStop(X, verses, hovered)`, so it reads:

```ts
  if (fromStop === toStop || t === 0) return still(pictureForStop(fromStop, verses, hovered));
  if (t >= 1) return still(pictureForStop(toStop, verses, hovered));
  return {
    from: pictureForStop(fromStop, verses, hovered),
    to: pictureForStop(toStop, verses, hovered),
    t,
  };
```

In `src/main.ts`:

1. Imports:
   - `import { searchOverlay, searchForMeaning, canAddTerm } from './overlays/search/index.ts';` → `import { searchTool, searchForMeaning, canAddTerm } from './overlays/search/index.ts';`
   - In the `./itemColoring.ts` import, replace `overlayColorsFor,` with `toolsPicture,`.
   - `import { computeBlendedColors } from './scrollytelling/overlayBlender';` → `import { computeBlendedColors, stopSearchParams } from './scrollytelling/overlayBlender';`
   - Add `import { toolsShown } from './tools.ts';` and `import type { Tools } from './overlays/types.ts';`.
2. Replace the function `applyOverlay` with:

```ts
  /** The overlay and the search as they stand, each null while off. */
  function toolsNow(): Tools {
    return toolsShown(currentOverlay, currentSettings(), overlaySettings.get(searchTool));
  }

  function applyTools(): void {
    setColorLayer(still(toolsPicture(toolsNow(), verses, mouseState.hoveredVerse)));
  }
```

   then run `sed -i '' 's/applyOverlay()/applyTools()/g' src/main.ts`, and in the comment above `syncStoryStopState` change "settled paints via applyOverlay" to "settled paints via applyTools". `grep -n applyOverlay src/main.ts` must print nothing.
3. In `composite()`, add `from.rings,` after `from.growth,` and `to?.rings,` after `to?.growth,` in `inputs`, and `rings: picture.rings,` after `growth: picture.growth,` in `shown`.
4. In `withDefaults` (above `beginEase`), replace the body of `fill` so it keeps the rings:

```ts
    const fill = (p: Picture<Color | Color[] | null>): Picture => ({
      ...p,
      colors: p.colors.map((c, i) => c ?? getDefaultColor(i)),
    });
```

5. In `syncStoryStopStateUnguarded`, after `if (currentOverlay) overlaySettings.restore(currentOverlay, stop.overlayParams ?? {});`, add:

```ts
    overlaySettings.restore(searchTool, stopSearchParams(stop));
```

6. In `buildCurrentUrlState`, change the initial state to:

```ts
    const state: UrlState = {
      overlayParams: {},
      searchParams: overlaySettings.toUrl(searchTool),
    };
```

7. In `applyViewState`, after `if (currentOverlay) overlaySettings.restore(currentOverlay, next.overlayParams);`, add:

```ts
    overlaySettings.restore(searchTool, next.searchParams);
```

8. In the word-click handler, replace each `searchOverlay` with `searchTool` (three places).

- [ ] **Step 10: Run the tests and the type checker**

Run: `npm run typecheck && npx vitest run`
Expected: all pass. If a test outside those edited above fails because it expected search's grey for a verse it does not match, change it to expect `null`, as in Step 7.

- [ ] **Step 11: Commit**

```bash
git add -A src
git commit -m "$(cat <<'EOF'
Give the search a slot of its own beside the overlay

A link's search keys are read whatever overlay it names, and the map
draws both: a match over an overlay as a ring around the overlay's
colour. The search stays in the overlay list for now.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

- [ ] **Step 12: Put the ring in front of Danyel, then stop**

1. Start a dev server of your own as a background task: `npm run dev`. Read its output for the port Vite chose, check it with `curl -s http://localhost:PORT/ | head -5`, and tell Danyel the port, the branch (`search-tool`) and the worktree.
2. Push and open a draft pull request, so Cloudflare builds a preview:

```bash
git push -u origin search-tool
gh pr create --draft --base main --title "Search as a tool of its own" --body "$(cat <<'EOF'
Closes #234.

Draft. The ring a search match draws over an overlay is a prototype, waiting to be judged by eye before the rest is built on it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

   Wait for the `cloudflare-workers-and-pages` comment (`gh pr view --json comments`) and take the preview link from it.
3. Send Danyel these views, on the preview link and on `http://localhost:PORT/`. Each pins Genesis 17:5 to centre it; press Escape to unpin before judging, since the pin's outline sits where the ring does. Genesis 17:5 holds both אברם and אברהם, so its ring is split. It is also a multi-colour verse, drawn grown: check that its ring is as thick as a single-word match's beside it (1.5px out, 1px in, measured from the drawn edge).
   - `#overlay=haftarah&q=אברם,אברהם&verse=Genesis.17.5&zoom=6`: close, over strong stripes.
   - `#overlay=commentary&q=אברם,אברהם&verse=Genesis.17.5&zoom=6`: close, over a smooth scale.
   - the same at `zoom=3` and at `zoom=2`, the smallest square that keeps a hole.
   - the same at `zoom=1.9`, just past the fall-back, where matches fill whole.
   - the same at `zoom=0.5`, and `#overlay=commentary&verse=Genesis.17.5&zoom=0.5` beside it, to judge how much the other verses dim.
   - `#story=abraham_rename`: search alone must look as it does on torahmap.org.
4. Ask him to judge: the ring's widths (1.5px out, 1px in), the fall-back size (8px squares), the dimming (0.85), and whether the ring is the right design at all.
5. **Stop. Do not start Task 3 until he answers.** If he changes a number, change it in `SEARCH_WITH_OVERLAY` in `src/constants.ts` only, run `npx vitest run src/__tests__/unit/rendering.test.ts`, and commit the change with the message "Tune the search ring" and the two trailer lines. If he changes the design, rework Parts A and B with him before going on.

---

### Task 3: The URL keys and the story-stop format

**Files:**
- Modify: `src/urlState.ts`, `src/overlays/search/index.ts`, `src/search/terms.ts` (comments), `src/scrollytelling/types.ts`, `src/scrollytelling/storyParser.ts`, `src/scrollytelling/overlayBlender.ts`, `src/main.ts`, `public/data/story.md`
- Test: the search suites (renamed key), `src/__tests__/unit/urlState.test.ts`, `src/__tests__/unit/urlState.security.test.ts`, `src/__tests__/integration/url-state-sync.test.ts`, `src/__tests__/integration/view-state-restore.test.ts`, `src/scrollytelling/__tests__/storyParser.test.ts`, `src/scrollytelling/__tests__/controller.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`, `src/__tests__/unit/story-file.test.ts`

**Interfaces:**
- Consumes: everything Task 2 produced.
- Produces:
  - `SEARCH_URL_PARAMS` keys are `search`, `mode`, `m`; `export const SEARCH_KEYS: ReadonlySet<string>` in `src/urlState.ts`.
  - `StoryStop.searchParams?: Record<string, string>`.
  - `stopSearchParams` is gone; the blender and `main.ts` read `stop.searchParams ?? {}`.

- [ ] **Step 1: Rename the key in every test, and write the new ones**

Run from the worktree root:

```bash
perl -0pi -e "
  s/overlay: 'search',(\s*)overlayParams: \{\s*q: ([^\n]*?),?\s*\},?/searchParams: { search: \$2 },\$1overlayParams: {},/g;
  s/(state|parsed|restored)\.overlayParams\.q\b/\$1.searchParams?.search/g;
  s/expect\((\w+)\.overlay\)\.toBe\('search'\)/expect(\$1.overlay).toBeUndefined()/g;
  s/expect\(hash\)\.toContain\('overlay=search'\)/expect(hash).not.toContain('overlay=')/g;
  s/overlay=search&q=/search=/g;
" src/__tests__/unit/urlState.test.ts src/__tests__/unit/urlState.security.test.ts src/__tests__/integration/url-state-sync.test.ts

perl -pi -e "
  s/\{ q: /{ search: /g;
  s/\{ q \}/{ search: q }/g;
  s/'q=/'search=/g;
  s/#q=/#search=/g;
  s/&q=/&search=/g;
  s/set\('q'/set('search'/g;
  s/(\w|\)|!)\.q\b/\$1.search/g;
" src/__tests__/unit/urlState.test.ts src/__tests__/unit/urlState.security.test.ts \
  src/__tests__/integration/url-state-sync.test.ts src/__tests__/integration/view-state-restore.test.ts \
  src/__tests__/integration/search-overlay-modes.test.ts src/__tests__/unit/overlays/search.test.ts \
  src/__tests__/unit/overlays/search-from-click.test.ts src/__tests__/unit/overlays/search-marks-by-position.test.ts \
  src/__tests__/unit/overlays/search-meaning-filter.test.ts src/__tests__/unit/overlays/search-term-colors.test.ts \
  src/__tests__/unit/search-matching.test.ts src/__tests__/unit/search-meaning-url.test.ts \
  src/__tests__/unit/tools.test.ts
```

Then check what is left: `grep -nE "\bq\b" <the same files>`. Only these may remain: the parameter `q: string` of the two local `colorsFor` helpers in `search.test.ts`, and the test name "writes back the q, mode and m it was read from" in `search-meaning-filter.test.ts`, which you rename to "writes back the search, mode and m it was read from". Fix anything else by hand the same way.

Four tests in `src/__tests__/unit/urlState.test.ts` (the one below and the three rows of the whole-links table) still assert `overlayParams` for a link the perl turned into a search, and move to asserting `searchParams`:

- "reads only the keys the active overlay declares" (in `describe('overlay-supplied parameters')`) needs a real overlay now. Replace its body with:

```ts
    // "category" belongs to commentary, not to trop
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta&category=x');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({ trop: 'etnachta' });
```

- In `describe('whole links, parsed with the real overlay declarations')`, take the three rows that search (now `#search=%D7%91…`, `#search=light&mode=w`, `#search=light,%D7%A2%D7%9C%D7%94&mode=w,r`) out of `links`, and add after that describe:

```ts
describe('whole links that search', () => {
  const links: Array<[string, Record<string, string>]> = [
    ['#search=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA', { search: 'בראשית' }],
    ['#search=light&mode=w', { search: 'light', mode: 'w' }],
    ['#search=light,%D7%A2%D7%9C%D7%94&mode=w,r', { search: 'light,עלה', mode: 'w,r' }],
  ];

  links.forEach(([hash, expected]) => {
    it(`parses ${hash}`, () => {
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const state = parseUrlState(overlayUrlParams);
      expect(state.searchParams).toEqual(expected);
      expect(state.overlayParams).toEqual({});
    });
  });
});
```

In `src/__tests__/integration/view-state-restore.test.ts`, add `import { searchTool } from '../../overlays/search/index';` and replace the test "clears the search query when the link names none" with:

```ts
    it('clears the search when the link names none', () => {
      settings.restore(searchTool, viewFor('#search=light').searchParams);
      expect(settings.toUrl(searchTool).search).toBe('light');

      settings.restore(searchTool, viewFor('#overlay=trop').searchParams);
      expect(settings.toUrl(searchTool)).toEqual({});
    });
```

In `src/scrollytelling/__tests__/storyParser.test.ts`, in "parses stops from comments", change the second stop's comment to `<!-- stop: abraham | camera: initial | search: אברהם -->` and its last two expectations to:

```ts
    expect(data.stops[1].overlay).toBeNull();
    expect(data.stops[1].searchParams).toEqual({ search: 'אברהם' });
```

and add:

```ts
  it('sends the search its own keys and the overlay the rest', () => {
    const md = `<!-- stop: both | camera: initial | search: אברם,אברהם | mode: ,w | overlay: commentary | category: Liturgy -->
# Both

Text.`;
    const [stop] = parseStoryMarkdown(md).stops;
    expect(stop.searchParams).toEqual({ search: 'אברם,אברהם', mode: ',w' });
    expect(stop.overlay).toBe('commentary');
    expect(stop.overlayParams).toEqual({ category: 'Liturgy' });
  });

  it('lets a stop search with no overlay', () => {
    const [stop] = parseStoryMarkdown(
      `<!-- stop: s | camera: initial | search: אברם -->\n# S\n\nText.`,
    ).stops;
    expect(stop.overlay).toBeNull();
    expect(stop.overlayParams).toBeUndefined();
    expect(stop.searchParams).toEqual({ search: 'אברם' });
  });
```

In `src/scrollytelling/__tests__/controller.test.ts`, stop `b` becomes `overlay: null, searchParams: { search: 'test' },`.

In `src/scrollytelling/__tests__/overlayBlender.test.ts`, add `import { SEARCH_WITH_OVERLAY } from '../../constants';` and replace `describe('a stop that searches', …)` with:

```ts
describe('a stop that searches', () => {
  const grey = 0.6 * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
  const DIM = SEARCH_WITH_OVERLAY.NON_MATCH_DIM;

  beforeEach(() => {
    buildSearchIndex(SAMPLE_VERSE_TEXTS);
    registerOverlay(multiColorOverlay);
  });

  function stopWith(extra: Partial<ResolvedStoryStop>): ResolvedStoryStop {
    return { id: 'search', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: null, ...extra };
  }

  it('fills its matches and dims the rest, as search alone always has', () => {
    // "God" is in Genesis 1:1 and not 1:2.
    const picture = pictureForStop(stopWith({ searchParams: { search: 'God' } }), verses, null);

    expect(picture.colors[0]).toEqual(SEARCH_COLORS[0]);
    expect(picture.colors[1]).toEqual([grey, grey, grey]);
    expect(picture.rings).toBeUndefined();
  });

  it('rings its matches over its overlay and dims the rest', () => {
    const stop = stopWith({ overlay: 'test-multi-color', searchParams: { search: 'God' } });
    const picture = pictureForStop(stop, verses, null);

    expect(picture.colors[0]).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);
    expect(picture.rings![0]).toEqual(SEARCH_COLORS[0]);
    expect(picture.colors[1]).toEqual([0.5 * DIM, 0.5 * DIM, 0.5 * DIM]);
    expect(picture.rings![1]).toBeNull();
  });

  it('keeps apart stops that differ only in their search', () => {
    const god = stopWith({ overlay: 'test-multi-color', searchParams: { search: 'God' } });
    const earth = { ...god, id: 'earth', searchParams: { search: 'earth' } };
    expect(pictureForStop(god, verses, null)).not.toEqual(pictureForStop(earth, verses, null));
  });
});
```

and remove the `searchTool` import if nothing else uses it.

In `src/__tests__/unit/story-file.test.ts`, add `import { isSearching, searchFromLink } from '../../overlays/search/index';` and inside `describe('story.md', …)`:

```ts
  it('searches, where a stop searches, for words long enough to search on', () => {
    const idle = stops
      .filter((s) => s.searchParams && !isSearching(searchFromLink(s.searchParams)))
      .map((s) => s.id);
    expect(idle).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run`
Expected: FAIL across the search suites and URL tests (the search still reads `q`), and in the parser tests (`searchParams` does not exist).

- [ ] **Step 3: Implement**

In `src/urlState.ts`, replace `SEARCH_URL_PARAMS` with:

```ts
/** The search's keys, read whatever overlay is on; no overlay may claim them. */
export const SEARCH_URL_PARAMS = [
  { key: 'search', kind: 'text' },
  // Positional across the terms in `search`, one letter each, and an empty
  // entry for a term still on its default (see MODE_LETTERS in search/terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

export const SEARCH_KEYS: ReadonlySet<string> = new Set(SEARCH_URL_PARAMS.map((p) => p.key));
```

In `src/overlays/search/index.ts`: in `settingsFromUrl`, `params.q` → `params.search`; in `settingsToUrl`, `params.q = query;` → `params.search = query;`.

In `src/search/terms.ts`, run `grep -n '`q`' src/search/terms.ts` and change each `` `q` `` in a comment to `` `search` ``.

In `src/scrollytelling/types.ts`, in `StoryStop` after `overlayParams`, add:

```ts
  searchParams?: Record<string, string>; // the search's own keys: search, mode, m
```

In `src/scrollytelling/storyParser.ts`:

- Import: `import { parseVerseFromUrl, SEARCH_KEYS } from '../urlState';`
- Header comment, lines 4–7, becomes:

```ts
// A story is optional YAML frontmatter (currently just `easing`) followed by
// stops, each opened by `<!-- stop: id | camera: ... | search: ... | overlay: ... | key: value -->`
// and a `# Title` heading. The search's keys go to the search; params other
// than camera/overlay/easing/verse/zoom become the overlay's. See
// public/data/story.md for an example.
```

- Next to `const overlayParams: Record<string, string> = {};`, add `const searchParams: Record<string, string> = {};`.
- In the loop, before the final `else`, add:

```ts
      } else if (SEARCH_KEYS.has(key)) {
        searchParams[key] = value;
```

- In `stops.push`, after `overlayParams: …`, add `searchParams: Object.keys(searchParams).length > 0 ? searchParams : undefined,`.

In `src/scrollytelling/overlayBlender.ts`, delete `StopTools` and `stopSearchParams`; `cacheKeyFor` takes `stop: StoryStop` and reads `stop.searchParams ?? {}` where it called `stopSearchParams(stop)`; `pictureForStop` passes `searchFromLink(stop.searchParams ?? {})`.

In `src/main.ts`:

- Remove `stopSearchParams` from the overlayBlender import.
- In `syncStoryStopStateUnguarded`: `overlaySettings.restore(searchTool, stopSearchParams(stop));` → `overlaySettings.restore(searchTool, stop.searchParams ?? {});`
- In the capture tool (Ctrl+Shift+C), replace the `if (currentOverlay) { … }` block with:

```ts
        const { overlay } = toolsNow();
        if (overlay) {
          extraParts += ` | overlay: ${overlay.tool.id}`;
          for (const [key, value] of Object.entries(overlaySettings.toUrl(overlay.tool))) {
            extraParts += ` | ${key}: ${value}`;
          }
        }
        for (const [key, value] of Object.entries(overlaySettings.toUrl(searchTool))) {
          extraParts += ` | ${key}: ${value}`;
        }
```

In `public/data/story.md`, the nine stops become (each value kept as it was, trailing commas included):

```
<!-- stop: abraham_zoom | camera: Genesis.12.1 | zoom: 1.5 | search: אברם -->
<!-- stop: abraham_call | camera: Genesis.12.1 | zoom: 2.5 | verse: Genesis.12.1 | search: אברם -->
<!-- stop: abraham_rename | camera: Genesis.17.5 | zoom: 2.5 | verse: Genesis.17.5 | search: אברם,אברהם -->
<!-- stop: genesis_full | camera: Genesis.24.20 | zoom: 0.8 | verse: Genesis.25.11 | search: אברם,אברהם -->
<!-- stop: gone | camera: everything | search: אברם,אברהם -->
<!-- stop: name_in_list | camera: Exodus.3.15 | zoom: 2.5 | verse: Exodus.3.15 | search: אברם,אברהם, -->
<!-- stop: name_in_list_with_isaac | camera: Exodus.3.15 | zoom: 2.5 | verse: Exodus.3.15 | search: אברם,אברהם,יצחק,יעקב, -->
<!-- stop: name_in_list_worldwide_three_names | camera: everything | verse: Exodus.3.15 | search: אברם,אברהם,יצחק,יעקב -->
<!-- stop: abraham_again | camera: everything | verse: Leviticus.26.42 | search: אברם,אברהם,, -->
```

`grep -n "overlay: search\| q:" public/data/story.md` must print nothing.

- [ ] **Step 4: Run the tests and the type checker**

Run: `npm run typecheck && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src public/data/story.md
git commit -m "$(cat <<'EOF'
Give the search its own link and story-stop keys

A link searches with search=, beside whatever overlay it names, and a
story stop says search: apart from overlay:. The nine stops that named
the search as their overlay now search on their own.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

---

### Task 4: One panel builder, the Search panel and the legend

Part A builds every panel with one builder and one set of controls. Part B: search leaves the overlay list and gets a panel, a menu item, a Clear button and a legend row; a word clicked in the verse popup adds itself without touching the overlay. The legend comes here, before this task's layout run: after Task 3 the story stop `abraham_call` searches with no overlay, and the layout states `story-stop-with-verse` and `story-menu-down` require its legend to show. Task 3 does not run the layout suite; those two states fail between Task 3 and this task.

**Files:**
- Modify (Part A): `src/storiesPanel.ts`, `src/aboutPanel.ts`, `src/overlays/commentary.ts`, `src/overlays/haftarah.ts`, `src/main.ts`, `index.html`, `src/styles/frame.css`, `src/styles/about.css`
- Create (Part A): `src/panel.ts`, `src/styles/controls.css`, `src/toolPanels.ts`, `src/__tests__/unit/panel.test.ts`
- Modify: `src/overlays/index.ts`, `src/overlays/registry.ts`, `src/overlays/search/index.ts`, `src/overlays/search/termRows.ts`, `src/tools.ts`, `src/frame.ts`, `src/menu.ts`, `src/aboutPanel.ts:41`, `src/main.ts`, `index.html`, `src/styles/frame.css`, `src/styles/overlays/search.css`, `test-harness/main.ts`, `layout/app.ts`, `layout/known.ts`, `CLAUDE.md`, `README.md`
- Create: `src/__tests__/unit/overlays/registry.test.ts`, `src/mapLegend.ts`, `src/__tests__/unit/mapLegend.test.ts`
- Test: `src/__tests__/unit/frame.test.ts`, `src/__tests__/unit/menu.test.ts`, `src/__tests__/unit/credits.test.ts`, `src/__tests__/unit/overlays/search.test.ts`, `src/__tests__/unit/urlState.test.ts`, `src/__tests__/integration/view-state-restore.test.ts`, `src/__tests__/integration/overlay-switching.test.ts`, `src/__tests__/integration/url-state-sync.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`, and the six search suites that reach search through the registry

**Interfaces:**
- Consumes: `searchTool`, `isSearching`, `toolsShown`, `toolsNow`, `applyTools`, `SEARCH_KEYS`.
- Produces:
  - `CONTROL` (the shared control classes) and `panelHtml(panel: Panel, body: string): string` in `src/panel.ts`; `overlayPanelHtml()` and `searchPanelHtml()` in `src/toolPanels.ts`.
  - `Panel` includes `'search'`; `PANEL_TITLES.search = 'Search'`; `exploreFrame(phone: boolean, open: Panel = 'overlay'): Frame`.
  - In `src/main.ts`: `searchChanged(fresh: boolean)`, `changeSearch(update: (current: SearchSettings) => SearchSettings)`.
  - DOM: `#search-panel` holding `#search-controls`; the Clear button `#search-clear-all`; legend rows `.map-legend-row[data-panel="search"]` and `[data-panel="overlay"]`.
  - `showLegend(legend: HTMLElement, rows: readonly LegendRow[]): void` and `interface LegendRow { panel: 'search' | 'overlay'; name: string; summary: OverlaySummary }` in `src/mapLegend.ts`; `updateLegend()` in `src/main.ts`.

#### Part A: one panel builder

Every panel is built by `panelHtml` in `src/panel.ts`, and a control panels share has one implementation in `src/styles/controls.css`, drawn exactly as the control it replaces, so no panel changes look. This part moves the three panels that exist today onto it; Part B adds Search.

- [ ] **Step A1: Write the failing tests**

Create `src/__tests__/unit/panel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CONTROL, panelHtml } from '../../panel';
import { PANEL_TITLES, type Panel } from '../../frame';
import { storiesHtml } from '../../storiesPanel';
import { aboutHtml } from '../../aboutPanel';
import { overlayPanelHtml } from '../../toolPanels';

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const SHARED = Object.values(CONTROL).flatMap((names) => names.split(' '));

describe('panelHtml', () => {
  it('heads the body with the panel title', () => {
    const div = parse(panelHtml('stories', '<p>body</p>'));
    expect(div.firstElementChild?.matches('h2.panel-title')).toBe(true);
    expect(div.firstElementChild?.textContent).toBe(PANEL_TITLES.stories);
    expect(div.querySelector('p')?.textContent).toBe('body');
  });
});

describe('every panel is built by panelHtml, with shared controls', () => {
  const panels: [Panel, string][] = [
    ['overlay', overlayPanelHtml()],
    ['stories', storiesHtml({ number: 1, total: 2, label: 'x' })],
    ['about', aboutHtml([])],
  ];

  for (const [panel, html] of panels) {
    it(`${panel} opens with its title`, () => {
      const first = parse(html).firstElementChild;
      expect(first?.matches('h2.panel-title')).toBe(true);
      expect(first?.textContent).toBe(PANEL_TITLES[panel]);
    });

    it(`${panel}'s buttons and selects take a shared control class`, () => {
      const controls = [...parse(html).querySelectorAll('button, select')];
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(SHARED.some((name) => control.classList.contains(name)), control.outerHTML).toBe(
          true,
        );
      }
    });
  }
});
```

In `src/__tests__/unit/overlays/commentary.test.ts`, next to the expectation that `select?.id` is `category-select` (line 322), add `expect(select?.classList.contains('control-select')).toBe(true);`.

- [ ] **Step A2: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/unit/panel.test.ts src/__tests__/unit/overlays/commentary.test.ts`
Expected: FAIL: `src/panel.ts` and `src/toolPanels.ts` do not exist.

- [ ] **Step A3: Implement**

Create `src/panel.ts`:

```ts
// Every panel: its title, which a phone shows and a desktop leaves to the
// column's header, then its body. Controls in a panel take a shared class.
import './styles/controls.css';
import { PANEL_TITLES, type Panel } from './frame.ts';
import { escapeHtml } from './utils/html.ts';

/** The control classes every panel shares (src/styles/controls.css). */
export const CONTROL = {
  button: 'control-button',
  quiet: 'control-button quiet',
  toggle: 'control-toggle',
  icon: 'control-icon',
  select: 'control-select',
} as const;

export function panelHtml(panel: Panel, body: string): string {
  return `<h2 class="panel-title">${escapeHtml(PANEL_TITLES[panel])}</h2>${body}`;
}
```

Create `src/styles/controls.css`:

```css
/* The controls panels share (src/panel.ts): one implementation of each, drawn
   as the control it was first written for. */

/* The Stories card's buttons. */
.control-button {
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.control-button.quiet {
  border-color: #444;
  color: #ddd;
}

/* The Hebrew toggle. */
.control-toggle {
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
  color: #fff;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

/* The overlay picker. color-scheme matters as much as the colours: without it
   the popup list keeps the system's light theme. */
.control-select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #222;
  color: #fff;
  color-scheme: dark;
  font-size: 14px;
  cursor: pointer;
}

/* A glyph alone, such as ×: the search's ×, on the 24px square the layout
   suite asks of a touch target. */
.control-icon {
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: none;
  background: none;
  color: #666;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.control-icon:hover {
  color: #fff;
}
```

Create `src/toolPanels.ts`:

```ts
import { CONTROL, panelHtml } from './panel.ts';

/**
 * The picker, then whatever the chosen overlay draws. main.ts fills the picker
 * from the registry, after None: the registry is the only list of overlays.
 */
export function overlayPanelHtml(): string {
  return panelHtml(
    'overlay',
    `<div class="panel-picker">
      <label for="overlay-select">Overlay</label>
      <select id="overlay-select" class="${CONTROL.select}">
        <option value="none">None</option>
      </select>
      <p id="overlay-description"></p>
    </div>
    <div id="overlay-controls"></div>
    <div id="overlay-legend"></div>`,
  );
}
```

`src/storiesPanel.ts`: import `{ CONTROL, panelHtml } from './panel.ts'` in place of `PANEL_TITLES`, and return:

```ts
  return panelHtml(
    'stories',
    `<div class="story-card">
      <h3>The guided tour</h3>
      <p class="story-card-place">Stop ${place.number} of ${place.total}: ${escapeHtml(place.label)}</p>
      <div class="story-card-actions">
        <button type="button" class="story-card-action ${CONTROL.button}" data-action="story">Continue</button>
        <button type="button" class="story-card-action ${CONTROL.quiet}" data-action="restart">Start from the beginning</button>
      </div>
    </div>`,
  );
```

`src/aboutPanel.ts`: import `{ CONTROL, panelHtml } from './panel.ts'` in place of `PANEL_TITLES`; return `panelHtml('about', …)` around the existing sections, without the markup's own `<h2 class="panel-title">…</h2>` line; the toggle becomes `<button type="button" id="hebrew-toggle" class="setting-toggle ${CONTROL.toggle}"></button>`.

`src/overlays/commentary.ts`: `<select id="category-select">` → `<select id="category-select" class="${CONTROL.select}">`. `src/overlays/haftarah.ts`: `<select id="custom-select" style="flex: 1;">` → `<select id="custom-select" class="${CONTROL.select}" style="flex: 1;">`. Both import `{ CONTROL } from '../panel.ts'`.

`index.html`: `#overlay-panel` becomes empty, `<div id="overlay-panel" class="tool"></div>`; its comment about the registry now sits on `overlayPanelHtml`.

`src/main.ts`: import `{ overlayPanelHtml } from './toolPanels.ts'`, and directly after `const aboutPanel = document.getElementById('about-panel')!;` add:

```ts
  document.getElementById('overlay-panel')!.innerHTML = overlayPanelHtml();
```

Delete the per-panel control CSS the shared classes replace:

- `src/styles/frame.css`: the `#panel select` rule and the comment above it; the `.story-card-action` and `.story-card-action.secondary` rules.
- `src/styles/about.css`: the `.setting-toggle` rule. (`#about-panel .panel-title` stays: it is how About's title looks today.)

- [ ] **Step A4: Run the tests, the type checker and the layout suite**

Run: `npm run typecheck && npx vitest run && npm run test:layout`
Expected: all pass, apart from the two story states that Task 3 leaves failing (`story-stop-with-verse`, `story-menu-down`), which Part B fixes. Nothing changes size or look in the Overlay, Stories and About panels; a phone now shows the Overlay panel's title too. Compare the layout shots of `explore-overlay-open`, `stories-panel` and `about-panel` with those from before this part.

- [ ] **Step A5: Commit**

```bash
git add -A src index.html
git commit -m "$(cat <<'EOF'
Build every panel with one builder and shared controls

Each panel opens with its title from PANEL_TITLES, and a button,
toggle or select panels share has one implementation, drawn as the
control it replaces.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

#### Part B: the Search panel and the legend

- [ ] **Step 1: Write the failing tests**

Point the search suites at the search directly:

```bash
perl -0pi -e "
  s#import \{ registerAllOverlays, getOverlay \} from '((?:\.\./)+)overlays/index';#import { searchTool } from '\$1overlays/search/index';#;
  s#\nregisterAllOverlays\(\);\n#\n#;
  s#getOverlay\('search'\)!#searchTool#g;
" src/__tests__/unit/overlays/search.test.ts src/__tests__/unit/overlays/search-term-colors.test.ts \
  src/__tests__/unit/overlays/search-marks-by-position.test.ts src/__tests__/unit/overlays/search-meaning-filter.test.ts \
  src/__tests__/unit/overlays/search-from-click.test.ts src/__tests__/integration/search-overlay-modes.test.ts \
  src/__tests__/unit/search-meaning-url.test.ts
```

`grep -n "getOverlay('search')" src test-harness -r` must then list only `src/__tests__/integration/url-state-sync.test.ts` and `test-harness/main.ts:16` (the harness is fixed in Step 7). In `url-state-sync.test.ts`, in "integrates with search overlay URL params", replace `const overlay = getOverlay('search');` with `const overlay = searchTool;`, delete `await overlay?.init?.();`, and add `import { searchTool } from '../../overlays/search/index';`.

In `src/__tests__/unit/overlays/search.test.ts`:

- "has correct id and name": `toBe('Text Search')` → `toBe('Search')`.
- Add, inside `describe('Search Overlay', …)`:

```ts
  describe('Clear', () => {
    it('is offered only once a word is typed', () => {
      const container = render();
      const clear = container.querySelector<HTMLButtonElement>('#search-clear-all')!;
      expect(clear.disabled).toBe(true);

      type(container, 'God');
      expect(clear.disabled).toBe(false);
    });

    it('takes every word away', () => {
      searchOverlay.restore({ search: 'God,earth' });
      const container = render();

      container.querySelector<HTMLButtonElement>('#search-clear-all')!.click();

      expect(searchOverlay.toUrl()).toEqual({});
      expect(searchOverlay.settings.terms.map((t) => t.text)).toEqual(['']);
    });
  });

  it("draws its × with the shared icon control", () => {
    const container = render();
    type(container, 'אלהים');

    const has = (selector: string, name: string) =>
      [...container.querySelectorAll(selector)].every((el) => el.classList.contains(name));
    expect(has('.term-remove', 'control-icon')).toBe(true);
    expect(container.querySelectorAll('.term-remove').length).toBeGreaterThan(0);
  });
```

Create `src/__tests__/unit/overlays/registry.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { registerOverlay, clearOverlays, getOverlay } from '../../../overlays/registry';
import type { Overlay } from '../../../overlays/types';

function claiming(key: string): Overlay {
  return {
    id: `claims-${key}`,
    name: 'Claims',
    getVerseColor: () => null,
    urlParams: [{ key, kind: 'token' }],
    defaultSettings: () => ({}),
    settingsFromUrl: (params) => params,
    settingsToUrl: () => ({}),
  };
}

describe('registerOverlay', () => {
  afterEach(() => clearOverlays());

  it.each(['search', 'mode', 'm'])("refuses an overlay that claims the search's %s", (key) => {
    expect(() => registerOverlay(claiming(key))).toThrow(key);
    expect(getOverlay(`claims-${key}`)).toBeUndefined();
  });

  it('takes an overlay whose keys are its own', () => {
    registerOverlay(claiming('category'));
    expect(getOverlay('claims-category')).toBeDefined();
  });
});
```

In `src/__tests__/unit/urlState.test.ts`, add `SEARCH_KEYS` to the `../../urlState` import, and in "uses distinct keys that do not clash with the view state", inside the loop, add `expect(SEARCH_KEYS.has(key)).toBe(false);`.

In `src/__tests__/integration/view-state-restore.test.ts`, inside `describe('which mode a link opens in', …)`, add:

```ts
    it('opens an old search link with no search and no overlay', () => {
      const view = viewFor('#overlay=search&q=light');
      expect(view.mode).toBe('explore');
      expect(view.overlay).toBe('none');
      expect(view.searchParams).toEqual({});
    });
```

In `src/__tests__/integration/overlay-switching.test.ts`, search is no longer an overlay:

- "switches through all overlays in sequence": `['commentary', 'trop', 'search']` → `['commentary', 'trop']`.
- "does not leak event listeners when switching": `await switchToOverlay('search');` → `await switchToOverlay('trop');`.
- Delete the test "renders controls for search overlay".
- "handles rapid overlay switching": delete the line `await switchToOverlay('search');`.

In `src/scrollytelling/__tests__/overlayBlender.test.ts`, the test overlays claim `mode`, which the registry now refuses: run `perl -pi -e 's/\bmode\b/state/g' src/scrollytelling/__tests__/overlayBlender.test.ts`.

In `src/__tests__/unit/frame.test.ts`: in the `isPanel` test, `['overlay', 'stories', 'about']` → `['search', 'overlay', 'stories', 'about']`, and add:

```ts
  it('lands on the panel a link asks for, on a desktop', () => {
    expect(exploreFrame(DESKTOP, 'search')).toEqual(explore('search'));
    expect(exploreFrame(PHONE, 'search')).toEqual(explore(null));
  });
```

In `src/__tests__/unit/menu.test.ts`: rename "then the overlays, the stories, and about" to "then the search, the overlays, the stories, and about", expecting `['story', 'search', 'overlay', 'stories', 'about']`.

In `src/__tests__/unit/credits.test.ts`, add `import { searchTool } from '../../overlays/search/index';`, and in `describe('the credits the app ships', …)` use `[searchTool, ...getAllOverlays()]` wherever it reads `getAllOverlays()`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run`
Expected: FAIL: the registry takes search's keys, `'search'` is not a panel, the menu has no Search, the name is still "Text Search", there is no Clear button, and an old link still opens the search overlay.

- [ ] **Step 3: Implement: search leaves the list**

`src/overlays/index.ts`: delete `import { searchTool } from './search/index.ts';` and `searchTool,` from `ALL_OVERLAYS`.

`src/overlays/registry.ts`:

```ts
import { SEARCH_KEYS } from '../urlState.ts';
```

and `registerOverlay` becomes:

```ts
export function registerOverlay(overlay: Overlay): void {
  const claimed = (overlay.urlParams ?? []).map((p) => p.key).filter((k) => SEARCH_KEYS.has(k));
  if (claimed.length > 0) {
    throw new Error(`${overlay.id} claims ${claimed.join(', ')}, which belong to the search`);
  }
  overlays.set(overlay.id, overlay);
}
```

`src/tools.ts`: the overlay slot is now `overlay: overlay ? { tool: overlay, settings: overlaySettings } : null,`, and the doc comment loses its last sentence ("The search is also still in the overlay list; …").

`src/overlays/search/index.ts`:

- `name: 'Text Search',` → `name: 'Search',`; delete `description`.
- Add a module variable beside `searchHitCaption`: `let searchClear: HTMLButtonElement | null = null;`
- In `renderControls`, the template becomes:

```ts
      container.innerHTML = `
        <div id="search-terms"></div>
        <div class="search-actions">
          <button type="button" id="add-term">+ add a word</button>
          <button type="button" id="search-clear-all">Clear</button>
        </div>
        <div id="search-hit-caption"></div>
        <div id="search-results"></div>
      `;
```

  and after `searchResults = container.querySelector('#search-results');` add:

```ts
      searchClear = container.querySelector('#search-clear-all');
      searchClear?.addEventListener('click', () => requestChange?.(() => ({ terms: addTerm([], '') })));
```

  and after the final `renderResults(settings);` add `if (searchClear) searchClear.disabled = typedTerms(settings).length === 0;`.
- In `destroy()`, add `searchClear = null;`.

- [ ] **Step 4: Implement: the panel, the menu and the frame**

`src/frame.ts`:

```ts
const PANELS = ['search', 'overlay', 'stories', 'about'] as const;
```

add `search: 'Search',` first in `PANEL_TITLES`, and:

```ts
/** Where leaving the story, or a link into the explore view, lands. */
export function exploreFrame(phone: boolean, open: Panel = 'overlay'): Frame {
  return explore(phone ? null : open);
}
```

`src/menu.ts`: after the story item, add `item('search', 'Search'),`.

`src/aboutPanel.ts`, the ☰ row: `The menu: continue the story, search, overlays, stories, About &amp; settings`.

`index.html`, first child of `#panel-body`: `<div id="search-panel" class="tool"></div>`.

`src/toolPanels.ts`, beside `overlayPanelHtml`:

```ts
export function searchPanelHtml(): string {
  return panelHtml('search', '<div id="search-controls"></div>');
}
```

In `src/__tests__/unit/panel.test.ts`, import `searchPanelHtml` too and add, inside `describe('every panel is built by panelHtml, with shared controls', …)`:

```ts
  it('search opens with its title', () => {
    const first = parse(searchPanelHtml()).firstElementChild;
    expect(first?.matches('h2.panel-title')).toBe(true);
    expect(first?.textContent).toBe(PANEL_TITLES.search);
  });
```

`src/styles/frame.css`:

- Add `body[data-open='search'] #search-panel,` as the first selector of the rule that shows the open panel.
- Replace the three rules headed "Search's results fill what the open panel has…" (`#overlay-panel:has(#search-results)` and the two `#overlay-controls:has(#search-results)` rules) with:

```css
/* Search's results fill what the panel has, in their own scroll. Every other
   panel keeps its height and #panel-body scrolls it. */
#search-panel,
#search-controls {
  flex: 1 1 auto;
  min-height: 0;
}

#search-controls {
  display: flex;
  flex-direction: column;
}

#search-controls > * {
  flex-shrink: 0;
}
```

`src/styles/overlays/search.css`: the × is drawn by the shared `control-icon` (`termRows.ts` below), and the search's own controls keep their look here:

- `.term-remove`: keep only `flex: 0 0 auto;`; delete the rest of the rule and `.term-remove:hover`.
- After the `.term-mode-option.on` rule, add:

```css
/* On a touch screen each switch is a 24px target; with a mouse it keeps its
   slimmer look. */
@media (pointer: coarse) {
  .term-mode-option {
    min-height: 24px;
  }
}
```

- Replace the `#add-term` rule with the one below, and extend the two rules after it to Clear: `#add-term:hover:not(:disabled), #search-clear-all:hover:not(:disabled)` and `#add-term:disabled, #search-clear-all:disabled`.

```css
/* Adding a word and clearing them all, side by side. */
.search-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

#add-term,
#search-clear-all {
  background: none;
  border-radius: 4px;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  padding: 5px 10px;
}

#add-term {
  flex: 1 1 auto;
  border: 1px dashed #444;
}

#search-clear-all {
  flex: 0 0 auto;
  border: 1px solid #444;
}
```

`src/overlays/search/termRows.ts`: import `{ CONTROL } from '../../panel.ts'`, and in both places the × is built:

```ts
  remove.className = `term-remove ${CONTROL.icon}`;
```

The mode switch, and the inline text buttons `all` and `only this one`, stay as they are.


- [ ] **Step 5: Implement: wiring in `src/main.ts`**

1. Import `type SearchSettings` with `searchTool` from `./overlays/search/index.ts`, and `exploreFrame` is already imported from `./frame.ts`.
   Also import `searchPanelHtml` beside `overlayPanelHtml`, and after the line that fills `#overlay-panel` add `document.getElementById('search-panel')!.innerHTML = searchPanelHtml();`.
2. Beside `const overlayControlsContainer = …`, add `const searchControls = document.getElementById('search-controls')!;`, and after `changeSettings` add:

```ts
  /**
   * Redraw what shows the search. `fresh` clears the controls first, for
   * settings from a link or a story stop; a reader's own edit redraws into
   * them, keeping their focus.
   */
  function searchChanged(fresh: boolean): void {
    if (fresh) searchControls.innerHTML = '';
    searchTool.renderControls?.(searchControls, overlaySettings.get(searchTool), changeSearch);
    refreshVersePopup();
  }

  function changeSearch(update: (current: SearchSettings) => SearchSettings): void {
    overlaySettings.set(searchTool, update(overlaySettings.get(searchTool)));
    applyTools();
    searchChanged(false);
    render();
    syncUrl(false);
  }
```

3. Replace the whole word-click block, from the comment `// Clicking a word in the verse popup.` to the end of `setWordClickHandler(…)`, with:

```ts
  setWordClickHandler((click) => {
    const word = lookupForm(click.text);
    const meanings = meaningsInVerse(
      word,
      tanakhKey(click.book, click.chapter, click.verse),
      click.index,
    );

    const ref = `${click.book} ${click.chapter}:${click.verse}`;
    const paletteFull = !canAddTerm(overlaySettings.get(searchTool));
    trackWordMenuOpen(click.text, ref, meanings.length, paletteFull);

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull,
      onChoose: (meaning) => {
        // The menu counted the words when it opened; a keyboard reader can add one since.
        if (!canAddTerm(overlaySettings.get(searchTool))) return;

        trackWordSearch(click.text, meaning ? `${meaning.form} ${meaning.gloss}` : 'exact', ref);
        takeOver('takeover');
        changeSearch(
          (current) => searchForMeaning(current, word, meaning?.keys ?? null) ?? current,
        );
        if (frame.mode === 'explore' && frame.open !== 'search') {
          dispatch({ type: 'choose', panel: 'search' });
        }
      },
    });
  });
```

4. In `syncStoryStopStateUnguarded` and in `applyViewState`, after the line that restores `searchTool`, add `searchChanged(true);`.
5. In `applyViewState`, `setStoryOpen(false);` becomes:

```ts
      setStoryOpen(false, exploreFrame(phoneLayout.matches, next.searchParams.search ? 'search' : 'overlay'));
```

6. After the `configureSearch({ … });` call, add `searchChanged(true);`, so the panel is drawn even when neither a link nor the story restores a search.
7. In `applyFrame`, `aboutHtml(getAllOverlays())` → `aboutHtml([searchTool, ...getAllOverlays()])`.

- [ ] **Step 6: The legend: a row for each tool that is on**

Create `src/__tests__/unit/mapLegend.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { showLegend, type LegendRow } from '../../mapLegend';

function legend(): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = ['search', 'overlay']
    .map(
      (panel) =>
        `<button class="map-legend-row" data-panel="${panel}" hidden>` +
        `<span class="map-legend-summary"></span></button>`,
    )
    .join('');
  return div;
}

const shownRows = (el: HTMLElement): (string | undefined)[] =>
  [...el.querySelectorAll<HTMLElement>('.map-legend-row')]
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.panel);

const SEARCH: LegendRow = {
  panel: 'search',
  name: 'Search',
  summary: { terms: [{ text: 'אברם', color: 'cyan' }] },
};
const OVERLAY: LegendRow = { panel: 'overlay', name: 'Commentary', summary: {} };

describe('showLegend', () => {
  it('shows a row for each tool that is on, search first', () => {
    const el = legend();
    showLegend(el, [OVERLAY, SEARCH]);
    expect(shownRows(el)).toEqual(['search', 'overlay']);
    expect(el.hidden).toBe(false);
  });

  it('names what each row shows', () => {
    const el = legend();
    showLegend(el, [SEARCH]);
    expect(el.querySelector('[data-panel="search"]')!.textContent).toContain('אברם');
  });

  it('hides a row whose tool goes off', () => {
    const el = legend();
    showLegend(el, [SEARCH, OVERLAY]);
    showLegend(el, [OVERLAY]);
    expect(shownRows(el)).toEqual(['overlay']);
  });

  it('hides the card with neither on', () => {
    const el = legend();
    showLegend(el, []);
    expect(el.hidden).toBe(true);
  });
});
```

Run `npx vitest run src/__tests__/unit/mapLegend.test.ts`; expected FAIL, `src/mapLegend.ts` does not exist. Then create `src/mapLegend.ts`:

```ts
// The legend on the map: a row for each tool that is on, each opening its panel.
import { summaryHtml } from './panelSummary.ts';
import type { OverlaySummary } from './overlays/types.ts';

export interface LegendRow {
  panel: 'search' | 'overlay';
  name: string;
  summary: OverlaySummary;
}

/** Show `rows` in the legend's own order, search above overlay; with none, hide the card. */
export function showLegend(legend: HTMLElement, rows: readonly LegendRow[]): void {
  for (const button of legend.querySelectorAll<HTMLElement>('.map-legend-row')) {
    const row = rows.find((r) => r.panel === button.dataset.panel);
    button.hidden = !row;
    if (row) {
      button.querySelector('.map-legend-summary')!.innerHTML = summaryHtml(row.name, row.summary);
    }
  }
  legend.hidden = rows.length === 0;
}
```

`index.html`, `#map-legend` becomes:

```html
    <div id="map-legend" hidden>
      <button class="map-legend-row" type="button" data-panel="search" hidden>
        <span class="map-legend-summary"></span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <button class="map-legend-row" type="button" data-panel="overlay" hidden>
        <span class="map-legend-summary"></span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
    </div>
```

`src/styles/frame.css`: after the `.map-legend-row` rule add

```css
.map-legend-row[hidden] {
  display: none;
}
```

and change the selector `.map-legend-row + .map-legend-row` to `.map-legend-row:not([hidden]) ~ .map-legend-row:not([hidden])`.

In `src/main.ts`:

1. Add `import { showLegend, type LegendRow } from './mapLegend.ts';`; delete the `summaryHtml` import and `const mapLegendSummary = …`.
2. After `toolsNow`, add:

```ts
  function updateLegend(): void {
    const { overlay, search } = toolsNow();
    const rows: LegendRow[] = [];
    for (const [panel, on] of [
      ['search', search],
      ['overlay', overlay],
    ] as const) {
      if (on) {
        rows.push({ panel, name: on.tool.name, summary: on.tool.summary?.(on.settings) ?? {} });
      }
    }
    showLegend(mapLegend, rows);
  }
```

3. In `overlayChanged`, replace the lines from `mapLegend.hidden = !currentOverlay;` through the end of the `if (currentOverlay) { mapLegendSummary… }` block with `updateLegend();`.
4. In `searchChanged`, add `updateLegend();` before `refreshVersePopup();`.

- [ ] **Step 7: Implement: the test harness, the layout states and the docs**

`test-harness/main.ts`: replace the overlays import and the two lines after it with:

```ts
import { configureSearch, createOverlaySettings } from '../src/overlays/index.ts';
import { searchTool as searchOverlay } from '../src/overlays/search/index.ts';
```

and in `main()` delete `const legendContainer = …` and the two legend lines inside `draw()`.

`layout/app.ts`, the `explore-search` state becomes:

```ts
  {
    name: 'explore-search',
    hash: `search=${encodeURIComponent('אברהם')}`,
    then: (page) => viaMenu(page, 'search'),
    shown: ['#search-input', '#search-clear-all'],
  },
```

`layout/known.ts`: delete the `SEARCH` constant and the two `explore-search/…/touch-targets` entries: the × is now 24×24 everywhere, and the mode switches 24px tall on the tablet and the phone. If the run still reports `button.term-mode-option` under 24px on those screens, the suite's touch emulation is not matching `(pointer: coarse)`: switch the query to `(hover: none)`, which `search.css` already uses for touch screens, and run again. If neither matches, keep the mode switches as they are and restore the two entries with only their `term-mode-option` lines and the reason "The mode switches keep their slim look; touch screens get 24px through a pointer media query the layout suite's emulation does not match."

`CLAUDE.md`:

- The "Pluggable overlays" bullet begins: `**Pluggable overlays**, in the order the menu offers them: Commentary (by source category or a combined total), Trop (cantillation marks), Haftarah (Ashkenazi and Sephardi), Verse Length.` Add a bullet after it: `- **Search beside the overlays**: a tool of its own, so a search and an overlay can be on together. A match over an overlay is a ring of its search colour around the overlay's colour.`
- Interactions, the ☰ line: `The menu: continue the story, search, overlays, stories, About & settings;`.
- "The URL carries the overlay, its settings, the pinned verse…" → "The URL carries the search, the overlay and its settings, the pinned verse…".

`README.md`: move the **Text Search** bullet out of the overlay list, rename it **Search**, and put it above "Overlays, in the order the map offers them:" with this sentence added: "It sits beside the overlays: search with one on, and each match rings the overlay's colour."

- [ ] **Step 8: Run the tests, the type checker and the layout suite**

Run: `npm run typecheck && npx vitest run && npm run test:layout`
Expected: all pass, including `story-stop-with-verse` and `story-menu-down`, whose stop now shows a legend row for its search. The layout suite reports no touch-target failures for `explore-search` on tablet or phone. If it reports another search control under 24px, give it `min-height: 24px` inside the same touch-screen media query in `search.css`, and run it again.

- [ ] **Step 9: Commit**

```bash
git add -A src index.html test-harness layout CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
Move search into a panel of its own

Search leaves the overlay list for its own panel, menu item, Clear
button and legend row. A word clicked in the verse popup adds to the search and leaves
the overlay alone; an old overlay=search link opens with no search.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

---

### Task 5: The verse popup and history

**Files:**
- Create: `src/verseMarks.ts`, `src/__tests__/unit/verseMarks.test.ts`
- Modify: `src/tools.ts`, `src/sidebar.ts`, `src/main.ts`
- Test: `src/__tests__/unit/tools.test.ts`, `src/__tests__/unit/sidebar.test.ts`

**Interfaces:**
- Consumes: `toolsNow()`, `changeSearch`, `searchChanged`, `searchFromLink`, `isSearching`, `ToolOnMap`.
- Produces:
  - `togglesSearch(before: SearchSettings, after: SearchSettings): boolean` in `src/tools.ts`.
  - `updateSidebar(…, isPinned = false, search: ToolOnMap | null = null)`: a new last parameter.
  - `combineMarks(text: string, under: DocumentFragment, over: DocumentFragment): DocumentFragment` in `src/verseMarks.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/verseMarks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combineMarks } from '../../verseMarks';

const TEXT = 'In the beginning';

/** TEXT with each [start, end, class] wrapped in a mark of that class. */
function marked(...marks: [number, number, string][]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let at = 0;
  for (const [start, end, cls] of marks) {
    fragment.append(TEXT.slice(at, start));
    const mark = document.createElement('mark');
    mark.className = cls;
    mark.textContent = TEXT.slice(start, end);
    fragment.append(mark);
    at = end;
  }
  fragment.append(TEXT.slice(at));
  return fragment;
}

function describeMarks(fragment: DocumentFragment): string[] {
  expect(fragment.textContent).toBe(TEXT);
  return [...fragment.querySelectorAll('mark')].map((m) => `${m.className}:${m.textContent}`);
}

describe('combineMarks', () => {
  it("keeps the overlay's marks where the search marks nothing", () => {
    const combined = combineMarks(TEXT, marked([0, 2, 'trop']), marked());
    expect(describeMarks(combined)).toEqual(['trop:In']);
  });

  it("keeps the search's marks where the overlay marks nothing", () => {
    const combined = combineMarks(TEXT, marked(), marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['term-0:beginning']);
  });

  it('keeps both where they mark different words', () => {
    const combined = combineMarks(TEXT, marked([0, 2, 'trop']), marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['trop:In', 'term-0:beginning']);
  });

  it("keeps the search's mark where both mark the same word", () => {
    const combined = combineMarks(
      TEXT,
      marked([0, 2, 'trop'], [8, 9, 'trop']),
      marked([7, 16, 'term-0']),
    );
    expect(describeMarks(combined)).toEqual(['trop:In', 'term-0:beginning']);
  });

  it("falls back to the search's marks when a fragment is not this text", () => {
    const other = document.createDocumentFragment();
    other.append('something else');
    const combined = combineMarks(TEXT, other, marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['term-0:beginning']);
  });
});
```

In `src/__tests__/unit/tools.test.ts`
, add `togglesSearch` to the `../../tools` import and append:

```ts
describe('togglesSearch', () => {
  const at = (words: string) => searchFromLink({ search: words });

  it('turns the search on with the first word long enough to search on', () => {
    expect(togglesSearch(at('א'), at('אב'))).toBe(true);
  });

  it('does not count a lone letter', () => {
    expect(togglesSearch(at(''), at('א'))).toBe(false);
  });

  it('edits, rather than toggles, as a word grows or another joins it', () => {
    expect(togglesSearch(at('אב'), at('אבר'))).toBe(false);
    expect(togglesSearch(at('אברם'), at('אברם,אברהם'))).toBe(false);
  });

  it('turns the search off when the last word goes', () => {
    expect(togglesSearch(at('אברם'), at(''))).toBe(true);
  });
});
```

In `src/__tests__/unit/sidebar.test.ts`, add `import type { ToolOnMap } from '../../overlays/types';`, and inside `describe('updateSidebar', …)`, in the same block as "highlights search terms when search overlay is active", add:

```ts
      describe('with a search on', () => {
        function searchOn(info: string | null): ToolOnMap {
          return {
            tool: {
              id: 'search',
              name: 'Search',
              getVerseColor: () => null,
              getHoverInfo: () => info,
              highlightVerseText: vi.fn((text: string) => {
                const fragment = document.createDocumentFragment();
                const mark = document.createElement('mark');
                mark.textContent = text;
                fragment.appendChild(mark);
                return fragment;
              }),
            },
            settings: {},
          };
        }

        it("shows the overlay's line, then the search's", () => {
          const overlay: Overlay = {
            id: 'commentary',
            name: 'Commentary',
            getVerseColor: () => null,
            getHoverInfo: () => '680 references',
          };
          const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
          updateSidebar(elements, verse, verseTexts, overlay, undefined, mockGetVerseText, false, searchOn('Matches: אברם'));

          expect([...elements.overlayInfo!.children].map((c) => c.textContent)).toEqual([
            '680 references',
            'Matches: אברם',
          ]);
        });

        /** A marker that wraps text[start, end) in a mark of class `cls`. */
        function marking(cls: string, start: number, end: number) {
          return vi.fn((text: string) => {
            const fragment = document.createDocumentFragment();
            const mark = document.createElement('mark');
            mark.className = cls;
            mark.textContent = text.slice(start, end);
            fragment.append(text.slice(0, start), mark, text.slice(end));
            return fragment;
          });
        }

        function markedEnglish(overlayMarks: [number, number], searchMarks: [number, number]): string[] {
          const overlay: Overlay = {
            id: 'trop',
            name: 'Trop',
            getVerseColor: () => null,
            highlightVerseText: marking('trop-highlight', ...overlayMarks),
          };
          const search: ToolOnMap = {
            tool: {
              id: 'search',
              name: 'Search',
              getVerseColor: () => null,
              highlightVerseText: marking('term-0', ...searchMarks),
            },
            settings: {},
          };
          const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
          updateSidebar(elements, verse, verseTexts, overlay, undefined, mockGetVerseText, false, search);
          expect(elements.english?.textContent).toBe('In the beginning');
          return [...elements.english!.querySelectorAll('mark')].map(
            (m) => `${m.className}:${m.textContent}`,
          );
        }

        it("marks the overlay's stretches and the search's together", () => {
          expect(markedEnglish([0, 2], [7, 16])).toEqual(['trop-highlight:In', 'term-0:beginning']);
        });

        it("keeps the search's mark where both mark the same word", () => {
          expect(markedEnglish([7, 9], [7, 16])).toEqual(['term-0:beginning']);
        });
      });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/unit/verseMarks.test.ts src/__tests__/unit/tools.test.ts src/__tests__/unit/sidebar.test.ts`
Expected: FAIL: `src/verseMarks.ts` and `togglesSearch` do not exist; `updateSidebar` ignores a search.

- [ ] **Step 3: Implement**

In `src/tools.ts`, append:

```ts
/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch(before: SearchSettings, after: SearchSettings): boolean {
  return isSearching(before) !== isSearching(after);
}
```

Create `src/verseMarks.ts`:

```ts
// Two tools each hand back a verse's text with some stretches wrapped in a
// mark; this lays both sets of marks over the one text.

interface Marked {
  start: number;
  end: number;
  element: Element;
}

/** The marked stretches of `fragment`, or null when its text is not `text`. */
function marksIn(fragment: DocumentFragment, text: string): Marked[] | null {
  if (fragment.textContent !== text) return null;
  const marks: Marked[] = [];
  let at = 0;
  for (const node of [...fragment.childNodes]) {
    const length = node.textContent?.length ?? 0;
    if (node instanceof Element) marks.push({ start: at, end: at + length, element: node });
    at += length;
  }
  return marks;
}

/**
 * `under`'s marks and `over`'s in one fragment of `text`. A mark of `under`
 * that shares any character with one of `over`'s is dropped: two marks cannot
 * cover one letter, and `over` is the search the reader typed.
 */
export function combineMarks(
  text: string,
  under: DocumentFragment,
  over: DocumentFragment,
): DocumentFragment {
  const top = marksIn(over, text);
  const bottom = marksIn(under, text);
  if (!top || !bottom) return over;

  const kept = bottom.filter((b) => !top.some((t) => b.start < t.end && t.start < b.end));
  const fragment = document.createDocumentFragment();
  let at = 0;
  for (const { start, end, element } of [...top, ...kept].sort((a, b) => a.start - b.start)) {
    if (start > at) fragment.append(text.slice(at, start));
    fragment.append(element);
    at = end;
  }
  if (at < text.length) fragment.append(text.slice(at));
  return fragment;
}
```

In `src/sidebar.ts`:


- Change the overlays import to `import type { Overlay, ToolOnMap } from './overlays/types.ts';`.
- Add after `textFragment`:

```ts
function infoLine(line: HTMLElement | string): HTMLElement {
  if (typeof line !== 'string') return line;
  const div = document.createElement('div');
  div.textContent = line;
  return div;
}
```

- `updateSidebar` gains a last parameter, `search: ToolOnMap | null = null,` after `isPinned: boolean = false,`; the recursive call inside it passes `isPinned, search`.
- Replace the `if (overlayInfo) { … }` block with:

```ts
  if (overlayInfo) {
    const lines = [
      currentOverlay?.renderSidebarInfo?.(verse, isPinned, overlaySettings) ??
        currentOverlay?.getHoverInfo?.(verse, overlaySettings),
      search?.tool.getHoverInfo?.(verse, search.settings),
    ].filter((line): line is HTMLElement | string => !!line);
    overlayInfo.replaceChildren(...lines.map(infoLine));
  }

  // Both tools mark the text; where they mark the same letters, the search's mark is kept.
  const marked = (text: string, language: TextLanguage): DocumentFragment | null => {
    const overlayMarks = currentOverlay?.highlightVerseText?.(text, language, overlaySettings);
    const searchMarks = search?.tool.highlightVerseText?.(text, language, search.settings);
    if (overlayMarks && searchMarks) return combineMarks(text, overlayMarks, searchMarks);
    return searchMarks ?? overlayMarks ?? null;
  };
```

- In the Hebrew block, `currentOverlay?.highlightVerseText?.(hebrewText, 'he', overlaySettings)` → `marked(hebrewText, 'he')`; in the English block, `currentOverlay?.highlightVerseText?.(englishText, 'en', overlaySettings)` → `marked(englishText, 'en')`.
- Imports: add `import { combineMarks } from './verseMarks.ts';` and `import type { TextLanguage } from './types.ts';` (merged with the existing `./types.ts` import).


In `src/main.ts`:

1. Change the tools import to `import { toolsShown, togglesSearch } from './tools.ts';`.
2. In `updateSidebarWrapper`, pass `toolsNow().search` as the last argument to `updateSidebar`, after `isPinned`.
3. `changeSearch` becomes:

```ts
  function changeSearch(update: (current: SearchSettings) => SearchSettings): void {
    const before = overlaySettings.get(searchTool);
    const after = update(before);
    overlaySettings.set(searchTool, after);
    applyTools();
    searchChanged(false);
    render();
    syncUrl(togglesSearch(before, after));
  }
```

- [ ] **Step 4: Run the tests, the type checker and the layout suite**

Run: `npm run typecheck && npx vitest run && npm run test:layout`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src index.html
git commit -m "$(cat <<'EOF'
Show both tools in the verse popup

The popup gives the overlay's line and the search's matches. Turning
the search on or off is a step Back can undo; typing is not.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

---

### Task 6: Layout states with both tools on, and the pull request

**Files:**
- Modify: `layout/app.ts`, `layout/known.ts`

**Interfaces:**
- Consumes: the legend rows `.map-legend-row[data-panel="search"]` and `[data-panel="overlay"]` (Task 4), `#overlay-select`, `viaMenu`.
- Produces: layout states `explore-search-and-overlay`, `explore-search-overlay-switched`, `explore-search-and-overlay-pinned`.

- [ ] **Step 1: Add the states**

In `layout/app.ts`, above `STATES`, add:

```ts
const ABRAHAM = encodeURIComponent('אברם,אברהם');
const BOTH_ROWS = [
  '.map-legend-row[data-panel="search"]',
  '.map-legend-row[data-panel="overlay"]',
];
```

and after the `explore-search` state:

```ts
  {
    name: 'explore-search-and-overlay',
    hash: `search=${ABRAHAM}&overlay=haftarah`,
    shown: BOTH_ROWS,
  },
  {
    name: 'explore-search-overlay-switched',
    hash: `search=${ABRAHAM}&overlay=haftarah`,
    then: async (page) => {
      await viaMenu(page, 'overlay');
      await page.locator('#overlay-select').selectOption('commentary');
    },
    shown: ['#overlay-select', ...BOTH_ROWS],
  },
  {
    name: 'explore-search-and-overlay-pinned',
    hash: `search=${ABRAHAM}&overlay=commentary&verse=Genesis.17.5`,
    shown: ['#verse-popup', ...BOTH_ROWS],
  },
```

In `layout/known.ts`, add the popup's accepted failures for the pinned state:

```ts
  'explore-search-and-overlay-pinned/phone/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
  'explore-search-and-overlay-pinned/tablet/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
```

- [ ] **Step 2: Run the layout suite**

Run: `npm run test:layout`
Expected: every state passes. If the pinned state's popup violations differ from the two above only in their measured sizes, copy the measured strings the run prints into `layout/known.ts`. If `.map-legend-summary` is reported as not fitting, add `text-overflow: ellipsis;` to `.map-legend-summary` in `src/styles/frame.css` (a deliberate ellipsis counts as fitting) and run again. Any other failure is a real layout fault: fix it in the CSS, not in `known.ts`.

- [ ] **Step 3: Look at the screenshots**

Open `layout-report/index.html` and read the shots for the three new states and `explore-search` at every size. Check by eye that both legend rows show, that the search row is first, and that on the phone the verse popup sits above the legend.

- [ ] **Step 4: Commit**

```bash
git add layout/app.ts layout/known.ts src/styles/frame.css
git commit -m "$(cat <<'EOF'
Test the layout with a search and an overlay both on

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B2P2TWqMk5BbibTBXgLc37
EOF
)"
```

- [ ] **Step 5: Ready the pull request**

Copy the layout shots for `explore-search`, `explore-search-and-overlay`, `explore-search-overlay-switched` and `explore-search-and-overlay-pinned` (desktop and phone) from `layout-report/shots/` to `docs/plans/images/2026-09-27-search-as-a-tool/`, commit them, and push. Update the draft PR from Task 2: link each image by a commit-pinned URL (`https://raw.githubusercontent.com/danyelf/torahmap/<commit>/docs/plans/images/2026-09-27-search-as-a-tool/<file>`), say what to look at on the `workers.dev` preview (the links from Task 2 Step 12 with `q=` changed to `search=`, plus `#search=אברם&overlay=commentary` with the Search panel and the Overlay panel each opened from the legend), end the body with the two attribution lines, and mark it ready with `gh pr ready`. The work is not complete until Danyel has looked at it and agreed.
