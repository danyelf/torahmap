# Realistic Torah Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the abstract Torah verse grid with a physically accurate scroll layout using tikkun.io line-by-line data.

**Architecture:** Extend `VerseLayout` with an optional `segments` array for Torah verses. A build script pre-processes 245 tikkun.io page JSONs into `scroll-layout.json`. The layout engine converts segments to pixel positions in RTL column rows. Geometry, hit detection, and outline rendering all check for segments and fall back to existing square behavior.

**Tech Stack:** TypeScript, Vitest, WebGL 2, Node.js (build script)

---

### Task 1: Build Script — Generate scroll-layout.json

**Files:**
- Create: `scripts/generate-scroll-layout.ts`
- Create: `public/data/scroll-layout.json` (generated output)

**Context:** The tikkun.io data lives at `~/code/thirdparty/tikkun.io/src/data/pages/torah/{1..245}.json` with a table of contents at `~/code/thirdparty/tikkun.io/src/data/tables-of-contents/torah.json`. Each page JSON is an array of line objects with `text`, `verses`, `aliyot`, `isPetucha` fields. See design doc at `docs/plans/2026-03-02-realistic-scroll-design.md` for data format details.

**Step 1: Write the build script**

Create `scripts/generate-scroll-layout.ts` that:

1. Loads all 245 page JSONs from `~/code/thirdparty/tikkun.io/src/data/pages/torah/`
2. Loads the table of contents from `~/code/thirdparty/tikkun.io/src/data/tables-of-contents/torah.json`
3. For each page, walks lines top-to-bottom:
   - Tracks "current verse" — set from the `verses` field when a new verse starts, persists through continuation lines
   - For each line, uses the sof pasuk marker `׃` to find verse boundaries within the text
   - For lines with text BEFORE the sof pasuk: that's the end of the current verse
   - For lines with text AFTER the sof pasuk: that's the start of the next verse (confirmed by the next line's `verses` field)
   - Computes `startFraction` and `widthFraction` by character-count ratio of each segment relative to the full line text length
   - For multi-fragment lines (shirah brick pattern where `text[0].length > 1`): each fragment is a separate segment, with fractions computed from character counts
   - For multi-column lines (Ha'azinu where `text.length > 1`): each outer column is a segment taking half the line
   - Sets `format` based on: `'haazinu'` if `text.length > 1`, `'shirah'` if `text[0].length > 1` and fragments follow the 3/2 alternating pattern, `'normal'` otherwise
4. Writes `public/data/scroll-layout.json` with the structure:

```typescript
interface ScrollLayoutData {
  pages: number;
  linesPerPage: number[];      // line count per page (index 0 = page 1)
  segments: ScrollSegmentData[];
}

interface ScrollSegmentData {
  b: number;    // book (1-5)
  c: number;    // chapter
  v: number;    // verse
  p: number;    // page (1-245)
  l: number;    // line (0-based within page)
  s: number;    // startFraction (0.0-1.0)
  w: number;    // widthFraction (0.0-1.0)
  f: string;    // format: 'n' | 's' | 'h' (normal/shirah/haazinu)
  pe: boolean;  // isPetucha
}
```

Use short keys to minimize JSON size.

**Step 2: Run the build script**

```bash
npx tsx scripts/generate-scroll-layout.ts
```

Verify: `ls -la public/data/scroll-layout.json` — should be ~200-400KB.

**Step 3: Validate the output**

Write a quick validation check at the end of the script that:
- Asserts 5,846 unique verses are covered (all Torah verses)
- Asserts all pages 1-245 are represented
- Asserts no verse has 0 segments
- Prints summary stats (total segments, avg segments per verse, segment count by format)

**Step 4: Commit**

```bash
git add scripts/generate-scroll-layout.ts public/data/scroll-layout.json
git commit -m "feat: add build script to generate scroll-layout.json from tikkun.io data"
```

---

### Task 2: Extend VerseLayout Type with Segments

**Files:**
- Modify: `src/types.ts:54-58` (VerseLayout interface)
- Modify: `src/__tests__/helpers/fixtures.ts:7-17` (createVerse helper)
- Test: `src/__tests__/unit/types.test.ts` (new or existing)

**Step 1: Add LayoutSegment interface and extend VerseLayout**

In `src/types.ts`, add before the VerseLayout interface:

```typescript
/**
 * A rectangular segment of a verse in the scroll layout.
 * Torah verses may have multiple segments (one per line they span).
 * Nevi'im/Ketuvim verses have no segments and use x/y/size as before.
 */
export interface LayoutSegment {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Then add to VerseLayout:

```typescript
export interface VerseLayout extends VerseIdentity {
  x: number;
  y: number;
  size: number;
  segments?: LayoutSegment[];
}
```

**Step 2: Run existing tests to verify backwards compat**

```bash
npm test
```

Expected: all existing tests pass (segments is optional, nothing reads it yet).

**Step 3: Update createVerse helper to support segments**

In `src/__tests__/helpers/fixtures.ts`, the `createVerse` function already uses `Partial<VerseLayout>` spread, so it automatically supports `segments` — no change needed. But add a helper:

```typescript
export function createVerseWithSegments(
  overrides: Partial<VerseLayout> = {},
  segments: LayoutSegment[]
): VerseLayout {
  return {
    ...createVerse(overrides),
    segments,
  };
}
```

**Step 4: Commit**

```bash
git add src/types.ts src/__tests__/helpers/fixtures.ts
git commit -m "feat: add LayoutSegment type and extend VerseLayout with optional segments"
```

---

### Task 3: Update Geometry Builder for Segments

**Files:**
- Modify: `src/geometry.ts:13-92` (buildVerseGeometry)
- Test: `src/__tests__/unit/geometry.test.ts`

**Context:** Currently `buildVerseGeometry()` allocates `verses.length * 6 * 19` floats and emits one 6-vertex quad per verse. With segments, a verse can produce multiple quads. The render draw call at `src/rendering.ts:161` uses `verses.length * 6` as vertex count — this must also change.

**Step 1: Write failing tests for segment geometry**

Add to `src/__tests__/unit/geometry.test.ts`:

```typescript
import { createVerseWithSegments } from '../helpers';
import type { LayoutSegment } from '../../types';

describe('segment geometry', () => {
  it('generates vertices for each segment instead of one square', () => {
    const segments: LayoutSegment[] = [
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 0, y: 10, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const buffer = buildVerseGeometry([verse]);
    // 2 segments * 6 vertices * 19 floats = 228
    expect(buffer.length).toBe(228);
  });

  it('uses segment bounds for vertex positions', () => {
    const segments: LayoutSegment[] = [
      { x: 100, y: 200, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const buffer = buildVerseGeometry([verse]);
    // First vertex x should be 100 (segment x, no bleed for single color)
    expect(buffer[0]).toBe(100);
    // First vertex y should be 200
    expect(buffer[1]).toBe(200);
  });

  it('mixes segment and non-segment verses correctly', () => {
    const segmentVerse = createVerseWithSegments(
      { book: 'Genesis', verse: 1 },
      [
        { x: 0, y: 0, width: 50, height: 10 },
        { x: 0, y: 10, width: 50, height: 10 },
        { x: 0, y: 20, width: 30, height: 10 },
      ]
    );
    const squareVerse = createVerse({ book: 'Isaiah', verse: 1, x: 500, y: 500 });
    const buffer = buildVerseGeometry([segmentVerse, squareVerse]);
    // 3 segments + 1 square = 4 quads * 6 vertices * 19 floats = 456
    expect(buffer.length).toBe(456);
  });

  it('returns totalVertexCount alongside buffer', () => {
    const segments: LayoutSegment[] = [
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 0, y: 10, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const squareVerse = createVerse({ verse: 2 });
    const result = buildVerseGeometry([verse, squareVerse]);
    // 2 segments + 1 square = 3 quads * 6 = 18 vertices
    // Buffer length = 18 * 19 = 342
    expect(result.length).toBe(342);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/geometry.test.ts
```

Expected: FAIL — segment verses still produce 1 quad each.

**Step 3: Implement segment support in buildVerseGeometry**

Modify `src/geometry.ts`:

1. **Count total quads first** (before allocating the buffer):
```typescript
let totalQuads = 0;
for (const v of verses) {
  totalQuads += v.segments ? v.segments.length : 1;
}
const data = new Float32Array(totalQuads * verticesPerQuad * floatsPerVertex);
```

2. **In the loop**, when a verse has segments, iterate segments instead of using `v.x`/`v.y`/`v.size`:
```typescript
for (let i = 0; i < verses.length; i++) {
  const v = verses[i];
  const verseColor = colors?.[i];
  // ... color extraction (unchanged) ...

  const rects = v.segments
    ? v.segments.map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height }))
    : [{ x: v.x, y: v.y, w: v.size, h: v.size }];

  for (const rect of rects) {
    const bleed = isMulticolor ? HIGHLIGHT_CONSTANTS.BLEED_PIXELS : 0;
    const x0 = rect.x - bleed;
    const y0 = rect.y - bleed;
    const x1 = rect.x + rect.w - 2 + bleed;
    const y1 = rect.y + rect.h - 2 + bleed;
    // ... UV, seed, writeVertex, triangles (same as before) ...
  }
}
```

The seed should use the verse's primary position (`v.x`, `v.y`) for all segments so stipple patterns are consistent across segments of the same verse.

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/unit/geometry.test.ts
```

Expected: all tests pass.

**Step 5: Update RenderState and render draw call**

In `src/rendering.ts`:

1. Add `vertexCount: number` to `RenderState` interface (line 29-35):
```typescript
export interface RenderState {
  buffer: WebGLBuffer;
  outlineBuffer: WebGLBuffer | null;
  hoverOutlineBuffer: WebGLBuffer | null;
  verses: VerseLayout[];
  dpr: number;
  vertexCount: number;  // NEW: total vertices (may differ from verses.length * 6)
}
```

2. In `createRenderState()` (line 63-78), compute vertex count:
```typescript
const geometry = buildVerseGeometry(verses);
const vertexCount = geometry.length / 19; // 19 floats per vertex
```

3. In `rebuildGeometry()` (line 87-95), update vertex count:
```typescript
export function rebuildGeometry(
  gl: WebGL2RenderingContext,
  state: RenderState,
  colors?: ...
): void {
  const geometry = buildVerseGeometry(state.verses, colors);
  state.vertexCount = geometry.length / 19;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
}
```

4. In `renderFrame()` (line 161), use `state.vertexCount`:
```typescript
gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
```

**Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/geometry.ts src/rendering.ts src/__tests__/unit/geometry.test.ts
git commit -m "feat: geometry builder supports variable-width segments per verse"
```

---

### Task 4: Update Hit Detection for Segments

**Files:**
- Modify: `src/hitDetection.ts:34-45` (isPointInVerseLayout), `55-66` (findExactHit), `77-104` (findFuzzyHit)
- Test: `src/__tests__/unit/hitDetection.test.ts`

**Step 1: Write failing tests**

Add to `src/__tests__/unit/hitDetection.test.ts`:

```typescript
import { createVerseWithSegments } from '../helpers';

describe('segment hit detection', () => {
  it('detects hit on first segment of multi-segment verse', () => {
    const verse = createVerseWithSegments(
      { x: 0, y: 0, size: 6 },
      [
        { x: 0, y: 0, width: 50, height: 10 },
        { x: 0, y: 10, width: 50, height: 10 },
      ]
    );
    expect(isPointInVerseLayout(25, 5, verse)).toBe(true);
  });

  it('detects hit on second segment', () => {
    const verse = createVerseWithSegments(
      { x: 0, y: 0, size: 6 },
      [
        { x: 0, y: 0, width: 50, height: 10 },
        { x: 0, y: 10, width: 50, height: 10 },
      ]
    );
    expect(isPointInVerseLayout(25, 15, verse)).toBe(true);
  });

  it('misses between segments', () => {
    const verse = createVerseWithSegments(
      { x: 0, y: 0, size: 6 },
      [
        { x: 0, y: 0, width: 50, height: 10 },
        { x: 0, y: 20, width: 50, height: 10 },  // gap at y=10-20
      ]
    );
    expect(isPointInVerseLayout(25, 15, verse)).toBe(false);
  });

  it('findExactHit returns verse when hitting any segment', () => {
    const verse = createVerseWithSegments(
      { x: 0, y: 0, size: 6 },
      [
        { x: 100, y: 200, width: 50, height: 10 },
        { x: 100, y: 210, width: 50, height: 10 },
      ]
    );
    const hit = findExactHit([verse], 125, 215);
    expect(hit).toBe(verse);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/hitDetection.test.ts
```

**Step 3: Implement segment hit detection**

Update `isPointInVerseLayout` in `src/hitDetection.ts`:

```typescript
export function isPointInVerseLayout(
  worldX: number,
  worldY: number,
  verse: VerseLayout
): boolean {
  if (verse.segments) {
    return verse.segments.some(seg =>
      worldX >= seg.x &&
      worldX < seg.x + seg.width &&
      worldY >= seg.y &&
      worldY < seg.y + seg.height
    );
  }
  return (
    worldX >= verse.x &&
    worldX < verse.x + verse.size &&
    worldY >= verse.y &&
    worldY < verse.y + verse.size
  );
}
```

Update `findFuzzyHit` to compute distance to nearest segment center:

```typescript
export function findFuzzyHit(
  verses: VerseLayout[],
  worldX: number,
  worldY: number
): VerseLayout | null {
  let nearestVerseLayout: VerseLayout | null = null;
  let nearestDistSq =
    HIGHLIGHT_CONSTANTS.FUZZY_RADIUS * HIGHLIGHT_CONSTANTS.FUZZY_RADIUS;

  for (const v of verses) {
    let bestDistSq = Infinity;

    if (v.segments) {
      for (const seg of v.segments) {
        const centerX = seg.x + seg.width / 2;
        const centerY = seg.y + seg.height / 2;
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        bestDistSq = Math.min(bestDistSq, dx * dx + dy * dy);
      }
    } else {
      const centerX = v.x + v.size / 2;
      const centerY = v.y + v.size / 2;
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      bestDistSq = dx * dx + dy * dy;
    }

    if (bestDistSq < nearestDistSq) {
      nearestVerseLayout = v;
      nearestDistSq = bestDistSq;
    }
  }

  return nearestVerseLayout;
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/unit/hitDetection.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/hitDetection.ts src/__tests__/unit/hitDetection.test.ts
git commit -m "feat: hit detection supports multi-segment verses"
```

---

### Task 5: Update Outline Rendering for Segments

**Files:**
- Modify: `src/outline.ts:7-11` (OutlineBounds), `26-94` (buildOutlineGeometry)
- Modify: `src/rendering.ts:210-264` (renderOutline)
- Test: `src/__tests__/unit/outline.test.ts`

**Step 1: Write failing tests**

Add to `src/__tests__/unit/outline.test.ts`:

```typescript
describe('multi-segment outline', () => {
  it('builds outline for multiple bounds', () => {
    const bounds: OutlineBounds[] = [
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 0, y: 10, width: 50, height: 10 },
    ];
    const geometry = buildOutlineGeometry(bounds);
    // 2 bounds * 4 borders * 6 vertices * 19 floats = 912
    expect(geometry.length).toBe(912);
  });
});
```

**Step 2: Run tests to verify failure**

```bash
npx vitest run src/__tests__/unit/outline.test.ts
```

**Step 3: Update OutlineBounds and buildOutlineGeometry**

Change `OutlineBounds` to support rectangles:

```typescript
export interface OutlineBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Update `buildOutlineGeometry` to accept an array of bounds:

```typescript
export function buildOutlineGeometry(
  bounds: OutlineBounds | OutlineBounds[],
  options: OutlineOptions = {}
): Float32Array {
  const boundsArray = Array.isArray(bounds) ? bounds : [bounds];
  const thickness = options.thickness ?? 2;
  const color = options.color ?? HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

  const floatsPerVertex = 19;
  const verticesPerBorder = 6;
  const borderCount = 4;
  const data = new Float32Array(boundsArray.length * borderCount * verticesPerBorder * floatsPerVertex);

  let offset = 0;
  // ... writeVertex and writeRect helpers (same as before) ...

  for (const b of boundsArray) {
    const x0 = b.x - thickness;
    const y0 = b.y - thickness;
    const x1 = b.x + b.width - 2 + thickness;
    const y1 = b.y + b.height - 2 + thickness;

    writeRect(x0, y0, x1, y0 + thickness);       // top
    writeRect(x1 - thickness, y0, x1, y1);        // right
    writeRect(x0, y1 - thickness, x1, y1);        // bottom
    writeRect(x0, y0, x0 + thickness, y1);        // left
  }

  return data;
}
```

**Step 4: Update renderOutline to handle segments**

In `src/rendering.ts`, update `renderOutline` (line 210+):

```typescript
export function renderOutline(
  context: RenderContext,
  state: RenderState,
  verse: VerseLayout,
  color: [number, number, number],
  buffer: WebGLBuffer | null,
  camera: Camera
): WebGLBuffer {
  // Build bounds from segments or from the verse square
  const bounds: OutlineBounds[] = verse.segments
    ? verse.segments.map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height }))
    : [{ x: verse.x, y: verse.y, width: verse.size, height: verse.size }];

  const geometry = buildOutlineGeometry(bounds, { thickness: 2, color });

  // ... buffer creation/update (same as before) ...

  // Draw outline — vertex count = bounds.length * 24
  gl.drawArrays(gl.TRIANGLES, 0, bounds.length * 24);

  return currentBuffer;
}
```

**Step 5: Fix existing tests**

Existing outline tests use `{ x, y, size }` — update the `OutlineBounds` type to keep backward compat by checking for `size` property, OR update callers. The simplest approach: keep `size` as an alias. Actually, since `renderOutline` converts from VerseLayout → OutlineBounds already, just update the test fixtures to use the new `width`/`height` format and update any direct calls to `buildOutlineGeometry`.

**Step 6: Run all tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/outline.ts src/rendering.ts src/__tests__/unit/outline.test.ts
git commit -m "feat: outline rendering supports multi-segment verses"
```

---

### Task 6: Scroll Layout Engine

**Files:**
- Create: `src/scrollLayout.ts`
- Modify: `src/layout.ts:514-532` (layoutTorah), `534-597` (computeLayout)
- Test: `src/__tests__/unit/scrollLayout.test.ts`

**Context:** This is the core new module. It reads `scroll-layout.json` data and converts segments into pixel positions arranged in RTL column rows. The existing `computeLayout()` delegates Torah layout to this module and keeps Nevi'im/Ketuvim unchanged.

**Step 1: Create scrollLayout module with types and constants**

Create `src/scrollLayout.ts`:

```typescript
import type { LayoutSegment } from './types';

// Scroll layout constants
export const SCROLL_CONSTANTS = {
  COLUMN_WIDTH: 80,       // pixels per column (page)
  LINE_HEIGHT: 4,         // pixels per line
  COLUMN_GAP: 8,          // gap between columns
  ROW_GAP: 20,            // gap between rows of columns
  COLUMNS_PER_ROW: 20,    // columns per visual row
} as const;

// Data format from scroll-layout.json (short keys for file size)
export interface ScrollSegmentData {
  b: number;    // book (1-5)
  c: number;    // chapter
  v: number;    // verse
  p: number;    // page (1-245)
  l: number;    // line (0-based)
  s: number;    // startFraction
  w: number;    // widthFraction
  f: string;    // format: 'n'|'s'|'h'
  pe: boolean;  // isPetucha
}

export interface ScrollLayoutData {
  pages: number;
  linesPerPage: number[];
  segments: ScrollSegmentData[];
}

// Book number to name mapping (tikkun uses 1-5)
const BOOK_NAMES: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
};

/**
 * Convert a scroll segment from the JSON data into pixel coordinates.
 * Columns flow right-to-left within rows, rows stack top-to-bottom.
 */
export function segmentToPixels(
  seg: ScrollSegmentData,
  scrollYOffset: number = 0
): LayoutSegment {
  const { COLUMN_WIDTH, LINE_HEIGHT, COLUMN_GAP, ROW_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;

  const columnIndex = seg.p - 1; // 0-based
  const rowIndex = Math.floor(columnIndex / COLUMNS_PER_ROW);
  const colInRow = COLUMNS_PER_ROW - 1 - (columnIndex % COLUMNS_PER_ROW); // RTL

  const maxLines = 42; // standard Torah scroll lines per column

  const x = colInRow * (COLUMN_WIDTH + COLUMN_GAP) + seg.s * COLUMN_WIDTH;
  const y = scrollYOffset + rowIndex * (maxLines * LINE_HEIGHT + ROW_GAP) + seg.l * LINE_HEIGHT;
  const width = seg.w * COLUMN_WIDTH;
  const height = LINE_HEIGHT;

  return { x, y, width, height };
}

/**
 * Build a map from "book:chapter:verse" to LayoutSegment[] for all Torah verses.
 */
export function buildScrollSegmentMap(
  data: ScrollLayoutData,
  scrollYOffset: number = 0
): Map<string, LayoutSegment[]> {
  const map = new Map<string, LayoutSegment[]>();

  for (const seg of data.segments) {
    const bookName = BOOK_NAMES[seg.b];
    if (!bookName) continue;

    const key = `${bookName}:${seg.c}:${seg.v}`;
    const pixel = segmentToPixels(seg, scrollYOffset);

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(pixel);
  }

  return map;
}

/**
 * Compute the total height of the Torah scroll section in pixels.
 */
export function getScrollSectionHeight(data: ScrollLayoutData): number {
  const { LINE_HEIGHT, ROW_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
  const maxLines = 42;
  const totalRows = Math.ceil(data.pages / COLUMNS_PER_ROW);
  return totalRows * (maxLines * LINE_HEIGHT + ROW_GAP) - ROW_GAP;
}
```

**Step 2: Write tests for scrollLayout**

Create `src/__tests__/unit/scrollLayout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  segmentToPixels,
  buildScrollSegmentMap,
  getScrollSectionHeight,
  SCROLL_CONSTANTS,
} from '../../scrollLayout';
import type { ScrollLayoutData, ScrollSegmentData } from '../../scrollLayout';

describe('scrollLayout', () => {
  describe('segmentToPixels', () => {
    it('places page 245 (first page, RTL) at top-right', () => {
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 245, l: 0, s: 0, w: 1, f: 'n', pe: false,
      };
      const pixel = segmentToPixels(seg, 0);
      // Page 245 -> columnIndex 244, rowIndex 244/20=12, colInRow = 19 - (244%20) = 19 - 4 = 15
      // Wait — let's compute: 244 % 20 = 4, so colInRow = 19 - 4 = 15
      // But page 245 should be at the beginning of the scroll (rightmost in first row)
      // Actually the first page of the scroll IS page 1 in tikkun (Genesis 1).
      // But we want RTL reading: page 1 is the LAST column read. Page 245 is Deuteronomy end.
      // In a real scroll, you start reading from the right, which is Bereishit (page 1).
      // So page 1 should be top-right.
      expect(pixel.y).toBe(0); // first row when page 1 is in first row
    });

    it('computes correct x for RTL column placement', () => {
      const { COLUMN_WIDTH, COLUMN_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
      // Page 1 should be rightmost in its row
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1, f: 'n', pe: false,
      };
      const pixel = segmentToPixels(seg, 0);
      // columnIndex=0, rowIndex=0, colInRow=19-0=19
      const expectedX = 19 * (COLUMN_WIDTH + COLUMN_GAP);
      expect(pixel.x).toBe(expectedX);
    });

    it('applies startFraction offset within column', () => {
      const { COLUMN_WIDTH, COLUMN_GAP } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 2, p: 1, l: 2, s: 0.4, w: 0.6, f: 'n', pe: false,
      };
      const pixel = segmentToPixels(seg, 0);
      const colX = 19 * (COLUMN_WIDTH + COLUMN_GAP); // page 1 = rightmost
      expect(pixel.x).toBe(colX + 0.4 * COLUMN_WIDTH);
      expect(pixel.width).toBe(0.6 * COLUMN_WIDTH);
    });

    it('applies scrollYOffset', () => {
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1, f: 'n', pe: false,
      };
      const pixel = segmentToPixels(seg, 500);
      expect(pixel.y).toBe(500);
    });

    it('places different lines at correct y offsets', () => {
      const { LINE_HEIGHT } = SCROLL_CONSTANTS;
      const seg1: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1, f: 'n', pe: false,
      };
      const seg2: ScrollSegmentData = {
        b: 1, c: 1, v: 3, p: 1, l: 5, s: 0, w: 1, f: 'n', pe: false,
      };
      const p1 = segmentToPixels(seg1, 0);
      const p2 = segmentToPixels(seg2, 0);
      expect(p2.y - p1.y).toBe(5 * LINE_HEIGHT);
    });
  });

  describe('buildScrollSegmentMap', () => {
    it('groups segments by verse key', () => {
      const data: ScrollLayoutData = {
        pages: 1,
        linesPerPage: [42],
        segments: [
          { b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1, f: 'n', pe: false },
          { b: 1, c: 1, v: 1, p: 1, l: 1, s: 0, w: 0.5, f: 'n', pe: false },
          { b: 1, c: 1, v: 2, p: 1, l: 1, s: 0.5, w: 0.5, f: 'n', pe: false },
        ],
      };
      const map = buildScrollSegmentMap(data);
      expect(map.get('Genesis:1:1')!.length).toBe(2);
      expect(map.get('Genesis:1:2')!.length).toBe(1);
    });
  });

  describe('getScrollSectionHeight', () => {
    it('computes height for 245 pages', () => {
      const data: ScrollLayoutData = {
        pages: 245,
        linesPerPage: Array(245).fill(42),
        segments: [],
      };
      const height = getScrollSectionHeight(data);
      const { LINE_HEIGHT, ROW_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
      const totalRows = Math.ceil(245 / COLUMNS_PER_ROW);
      expect(height).toBe(totalRows * (42 * LINE_HEIGHT + ROW_GAP) - ROW_GAP);
    });
  });
});
```

**Step 3: Run tests**

```bash
npx vitest run src/__tests__/unit/scrollLayout.test.ts
```

Expected: all pass.

**Step 4: Integrate with layout.ts**

Modify `src/layout.ts`:

1. Add import:
```typescript
import { buildScrollSegmentMap, getScrollSectionHeight, type ScrollLayoutData } from './scrollLayout';
```

2. Update `computeLayout` signature to accept optional scroll data:
```typescript
export function computeLayout(
  torahData: TorahData,
  scrollData?: ScrollLayoutData
): VerseLayout[] {
```

3. In the Torah section of `computeLayout`, if `scrollData` is provided:
   - Build the segment map via `buildScrollSegmentMap(scrollData, 0)`
   - For each Torah verse, look up its segments from the map
   - Set `verse.segments = segments` and `verse.x = segments[0].x`, `verse.y = segments[0].y`
   - Use `getScrollSectionHeight(scrollData)` as the Torah section height for offsetting Nevi'im below
   - If `scrollData` is NOT provided, fall back to the existing `layoutTorah()` function

**Step 5: Run all tests**

```bash
npm test
```

Expected: all pass (scroll data is optional, existing tests don't pass it).

**Step 6: Commit**

```bash
git add src/scrollLayout.ts src/layout.ts src/__tests__/unit/scrollLayout.test.ts
git commit -m "feat: scroll layout engine converts tikkun data to pixel positions"
```

---

### Task 7: Main Integration — Load and Wire Everything

**Files:**
- Modify: `src/main.ts:77-100` (data loading and layout call)

**Step 1: Load scroll-layout.json alongside other data**

In `src/main.ts`, update the `Promise.all` at line 82-86:

```typescript
const [torahResponse, scrollResponse, verseTexts] = await Promise.all([
  fetch(`${import.meta.env.BASE_URL}data/tanakh-structure.json`),
  fetch(`${import.meta.env.BASE_URL}data/scroll-layout.json`),
  loadAllVerseTexts(),
  loadLemmaData()
]);
```

Parse scroll data:

```typescript
let scrollData: ScrollLayoutData | undefined;
if (scrollResponse.ok) {
  scrollData = await scrollResponse.json();
} else {
  console.warn('scroll-layout.json not found, using default layout');
}
```

**Step 2: Pass scroll data to computeLayout**

Update line 100:

```typescript
const verses = computeLayout(torahData, scrollData);
```

**Step 3: Verify the app works**

Start the dev server:

```bash
npm run dev
```

Open the app in a browser. The Torah section should now display as columns of lines instead of the old grid. Nevi'im and Ketuvim should appear below, unchanged.

**Step 4: Run all tests and build**

```bash
npm test
npm run build
```

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: load scroll layout data and wire into rendering pipeline"
```

---

### Task 8: Visual Polish and Constants Tuning

**Files:**
- Modify: `src/scrollLayout.ts` (constants)
- Modify: `src/layout.ts` (section gap between scroll and Nevi'im)

This task is for tuning visual constants after seeing the scroll in the browser:
- `COLUMN_WIDTH`, `LINE_HEIGHT` — adjust for visual density
- `COLUMNS_PER_ROW` — adjust for how many columns fit naturally
- `COLUMN_GAP`, `ROW_GAP` — visual spacing
- Column border/background — consider adding subtle column boundary lines
- Initial camera position — zoom/pan to show the scroll nicely on load

**This is a UI task requiring visual review — do not consider complete until the user has looked at it.**

**Step 1: Start dev server and iterate on constants**

```bash
npm run dev
```

Adjust `SCROLL_CONSTANTS` values and check the browser.

**Step 2: Commit when satisfied**

```bash
git add src/scrollLayout.ts src/layout.ts
git commit -m "feat: tune scroll layout visual constants"
```
