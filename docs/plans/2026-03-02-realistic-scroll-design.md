# Realistic Torah Scroll Layout Design

## Goal

Replace the abstract Torah verse grid with a physically accurate Torah scroll layout where verse blocks map to their actual positions in a sefer Torah — columns, lines, parsha breaks, and special formatting (Song of the Sea, Ha'azinu).

## Data Source

[tikkun.io](https://github.com/akivajgordon/tikkun.io) provides pre-generated JSON files for all 245 pages (columns) of a Torah scroll, each with ~42 lines of Hebrew text. The data encodes:

- **Verse positions**: which verse starts on each line (via `verses` field)
- **Continuation lines**: lines where no new verse starts (`verses: []`)
- **Parsha breaks**: `isPetucha: true` for petucha (open) sections; setuma encoded as multi-fragment lines
- **Song of the Sea** (Exodus 15): brick/staircase pattern via 3 fragments per line within a single column array
- **Ha'azinu** (Deuteronomy 32): two-column layout via 2 outer column arrays
- **Sof pasuk** (׃): verse-ending marker in the text, used to split shared lines between verses

Key stats:
- 245 pages, ~42 lines each = ~10,290 total lines
- 5,846 Torah verses mapped across these lines
- ~45% of lines are continuations (no new verse starts)
- Estimated ~15,000 verse-line segments total

## Architecture: Approach A — Extend VerseLayout with Segments

Preserve the existing 1:1 `VerseLayout[]` array (one entry per verse). Add an optional `segments` array for Torah verses that need multiple rectangles.

```typescript
interface VerseLayout {
  book: string; chapter: number; verse: number;
  x: number; y: number; size: number;
  // NEW: scroll layout — multiple rectangles per verse
  segments?: Array<{x: number; y: number; width: number; height: number}>;
}
```

Nevi'im and Ketuvim verses have no `segments` and render as before (6×6 squares). Torah verses have `segments` and render as variable-width rectangles.

## Section 1: Build-Time Data Processing

### Script: `scripts/generate-scroll-layout.ts`

Processes all 245 tikkun.io page JSONs into `public/data/scroll-layout.json`.

### Output format

```typescript
interface ScrollLayoutData {
  pages: number;              // 245
  linesPerPage: number[];     // per-page line count (usually 42)
  segments: ScrollSegment[];
}

interface ScrollSegment {
  book: number;               // 1-5
  chapter: number;
  verse: number;
  page: number;               // 1-245
  line: number;               // 0-based line index within page
  startFraction: number;      // 0.0-1.0, left edge position on line
  widthFraction: number;      // 0.0-1.0, fraction of line width
  format: 'normal' | 'shirah' | 'haazinu';
  isPetucha: boolean;
  fragmentIndex?: number;     // which fragment within a shirah/setuma line
}
```

### Processing logic

1. Walk each page line-by-line, tracking "current verse" from the `verses` field
2. Split shared lines at sof pasuk `׃` using character-count ratios for width
3. For multi-fragment lines (shirah), each fragment becomes a separate segment with `startFraction`/`widthFraction` reflecting its position
4. For Ha'azinu (2 outer columns), each column occupies half the line width with a gap
5. Petucha lines naturally have shorter text, so `widthFraction < 1.0`

Estimated output: ~300KB JSON, ~40KB gzipped.

## Section 2: Layout Engine

### New function: `computeTorahScrollLayout()`

Converts `ScrollLayoutData` segments into pixel positions.

### Column arrangement (RTL rows)

- Columns flow right-to-left within rows (reading order: page 245 = top-right, page 1 = bottom-left)
- `COLUMNS_PER_ROW` columns per row (tunable, ~15-20)
- `COLUMN_GAP` between columns, `ROW_GAP` between rows

### Pixel position calculation

```
columnIndex = page - 1
rowIndex = floor(columnIndex / COLUMNS_PER_ROW)
colInRow = COLUMNS_PER_ROW - 1 - (columnIndex % COLUMNS_PER_ROW)  // RTL

x = colInRow * (COLUMN_WIDTH + COLUMN_GAP) + startFraction * COLUMN_WIDTH
y = scrollYOffset + rowIndex * (maxLines * LINE_HEIGHT + ROW_GAP) + line * LINE_HEIGHT
width = widthFraction * COLUMN_WIDTH
height = LINE_HEIGHT
```

### Integration with existing layout

`computeLayout()` calls `computeTorahScrollLayout()` for Torah, then existing algorithms for Nevi'im/Ketuvim offset below. Torah verses get `segments` populated; others don't.

## Section 3: Geometry & Rendering

### geometry.ts changes

`buildVerseGeometry()` updated:

```
for each verse:
  if verse.segments:
    for each segment: emit 2 triangles for rectangle (x, y, width, height)
    all segments share the verse's color
  else:
    emit 2 triangles for 6×6 square (existing)
```

Vertex format unchanged (19 floats/vertex). UV coordinates scale to segment dimensions.

Vertex count: ~15K Torah segments + ~17K other verses = ~192K vertices (vs current ~138K). Well within WebGL limits.

## Section 4: Hit Detection

### hitDetection.ts changes

```
for each verse:
  if verse.segments:
    check point-in-rectangle for each segment
  else:
    existing square check
```

Fuzzy hit detection checks segment rectangles. Any segment hit returns the full verse.

## Section 5: Hover & Outline

- All segments of a hovered/pinned verse highlight together (coloring works per verse index, unchanged)
- Outline draws borders around each individual segment rectangle (not a bounding box)

## Section 6: Special Formatting

All data-driven, no special rendering code:

- **Song of the Sea**: 3-fragment brick pattern → 3 segments per line with gaps = staircase
- **Ha'azinu**: 2-column → 2 segments per line, each half-width
- **Petucha breaks**: shorter `widthFraction` + empty space = visible paragraph break
- **Setuma breaks**: 2-fragment lines with gap between sections

## Files Changed

| File | Change |
|------|--------|
| `scripts/generate-scroll-layout.ts` | **New** — build script |
| `public/data/scroll-layout.json` | **New** — generated data |
| `src/types.ts` | Add `segments?` to `VerseLayout` |
| `src/layout.ts` | New `computeTorahScrollLayout()`, integrate |
| `src/geometry.ts` | Variable-width rectangles for segments |
| `src/hitDetection.ts` | Rectangle hit testing |
| `src/outline.ts` | Multi-segment outlines |
| `src/main.ts` | Load scroll-layout.json, pass to layout |
