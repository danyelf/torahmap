# Wall Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A script, `npm run print`, that writes the two agreed 36×24 wall
prints (haftarah, and a search for five names) as SVG, PDF and 300 dpi PNG,
plus a letter-size proof sheet.

**Architecture:** Node code in `scripts/print/` works out what every verse
shows. It computes the positions with the site's own layout (Psalms rearranged
into three columns), the colours from the agreed palettes, and the titles and
key. The result is a plain JSON input. One self-contained page function,
`draw`, turns that input into an SVG inside headless Chromium, which has the
real fonts to measure text with. Chromium prints the SVG to PDF, and
`pdftoppm` rasterises the PDF to PNG. Nothing under `src/`, `packages/` or
`public/` changes.

**Tech Stack:** TypeScript run by Node 24's type stripping; Playwright's
Chromium; vitest with happy-dom; `pdftoppm` (installed at
`/opt/homebrew/bin/pdftoppm`); Google Fonts (David Libre 700; Inter 400, 600
and 700).

**Spec:** `docs/plans/2026-09-29-wall-print-design.md`. The approved picture
is `docs/plans/images/2026-09-29-wall-print/haftarah-layout.png`. The
prototype that drew it is in `scripts/print/prototype/`. Read
`layoutC-template.html` there before Task 4: the drawing code starts from it.

## Global Constraints

- Nothing under `src/`, `packages/` or `public/` changes. Import from `src/`
  only what runs without the page: `src/layout.ts`,
  `src/overlays/haftarah/readings.ts`, `src/search.ts`, `src/geometry.ts`,
  `src/utils/color.ts`, `src/utils/random.ts`, `src/types.ts`.
- Sheet: 36×24 in landscape, 2592 × 1728 pt trimmed; bleed 9 pt (⅛ in) on
  every side; margin 108 pt (1½ in) inside the trim. With `--marks`, a 36 pt
  slug outside the bleed holds crop marks.
- Paper `#f3ecdc`; ink `#3a2e24`; quieter ink `#7a6a58`.
- Haftarah: unread verses `hsl(31°, 28%, 34–47%)`, varying per verse by
  `seededRandom(verseIndex * 3)`; readings OKLCH L 0.64, C 0.16, hue
  `29 + i/count·360`, chroma lowered in 0.005 steps until the colour is in
  sRGB.
- Search: verses naming no one `hsl(37°, 13%, 66–73%)`, same seed; names
  OKLCH L 0.5, C 0.15, hues Abraham 215, Isaac 50, Jacob 135, Moses 355,
  David 320. Search terms keep only the lexemes glossed exactly Abraham,
  Isaac, Jacob, Moses, David.
- Split verses: bands corner to corner. Band k of n slides along the cut by
  `(k − (n−1)/2) · BAND_OFFSET · side` in direction (+1, −1). The square grows
  by `MULTICOLOR_GROWTH` on every side. Both constants are imported from
  `src/geometry.ts`.
- Psalms in three columns: chapters 1–50, 51–100, 101–150.
- Fonts: Hebrew in David Libre 700, English in Inter. Every Hebrew size is
  1.15 times the English beside it.
- Type and spacing, in pt: book title Hebrew 15 / English 13 bold, 5 apart,
  baseline 9 above the book's first row, Hebrew shrinking to no less than 9;
  section title Hebrew 25.3 / English 22 bold, quieter ink, 8 right of the
  section, starting 26 above its first row, turned to read downward; map top
  34 below the margin, width the trim less both margins and 50, centred;
  hairline 0.75, quieter ink, 50 below the map, across the map's width; key
  title Hebrew 23 bold / English 20 semibold, baseline 56 below the hairline;
  key notes 11, quieter ink, 15 apart; portion columns 170 wide, heading
  Hebrew 12.65 / English 11, rows 15 apart, swatch 9, Hebrew 11.5 / English
  10; occasion columns 270 wide, 20 after the portions, kind headings 10
  semibold; credits 9, quieter ink, right-aligned, baseline 54 above the
  trim's bottom edge.
- Logo: the text of `src/mapTitle.svg`, without its filter, recoloured
  (Hebrew and tagline quieter ink, name ink), tagline in Inter; 929 map units
  wide, centred between the map's left edge and the Torah's, top 28 map units
  above the Torah's first row.
- No signature. Colours are sRGB values; do not convert to CMYK.
- Code style: see `AGENTS.md`. Comments say what the code cannot; no ticket or
  stage labels; tests assert behaviour, never counts taken from the shipped
  data or text a reader sees.

## Review Focus

1. **The fonts fail to load** (no network, a renamed family). The PDF would
   quietly fall back to Times. Expected: the script stops and names the missing
   face. Pinned in Task 5 (`unloadedFaces`).
2. **A reading, or a kind of occasion, has no place in the key.** Expected:
   the script stops rather than leaving it out. Pinned in Task 3.
3. **A name resolves to no dictionary entry** (the index changes, or a gloss
   is spelled differently). Expected: the script stops rather than printing a
   name that marks nothing. Pinned in Task 3 (`nameVerses`).
4. **A key entry is wider than its column** ("Passover, Intermediate
   Sabbath"). Expected: the run lists every overflowing entry, so it is caught
   before printing. Pinned in Task 4 (`overflows`).
5. **A book too narrow for its title** (the Minor Prophets, Song of Songs).
   Expected: the English goes first, then the Hebrew shrinks, but never below
   9 pt, which is the spec's floor; below that, a title is allowed to be wider
   than its book. Pinned in Task 4.

---

## File structure

| File | Responsibility |
| --- | --- |
| `scripts/print/layout.ts` | The site's layout with Psalms in three columns |
| `scripts/print/colour.ts` | The print palettes |
| `scripts/print/types.ts` | The JSON input `draw` takes (types only) |
| `scripts/print/views.ts` | Builds the haftarah, search and proof inputs |
| `scripts/print/draw.ts` | The page function: input → SVG |
| `scripts/print/print.ts` | Entry point: data, Chromium, files |
| `scripts/print/README.md` | How to run it, and what it writes |
| `scripts/print/__tests__/*.test.ts` | One test file per module above |
| `scripts/print/tsconfig.json` | Typechecks the directory |
| `scripts/print/out/` | Output, gitignored |

---

### Task 1: The print layout, with Psalms in three columns

**Files:**
- Create: `scripts/print/layout.ts`, `scripts/print/tsconfig.json`,
  `scripts/print/__tests__/layout.test.ts`
- Modify: `vitest.config.ts` (include), `package.json` (typecheck script),
  `.gitignore`

**Interfaces:**
- Produces: `PSALMS_COLUMNS: readonly [1, 51, 101]`;
  `threeColumnPsalms(structure: TorahData): TorahData`;
  `printLayout(structure: TorahData): TanakhLayout[]`, the same verses as
  `computeLayout`, in the same order, with Psalms rearranged.

- [ ] **Step 1: Set up the directory**

`scripts/print/tsconfig.json`, as `video/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["."]
}
```

In `vitest.config.ts`, add `'scripts/print/**/*.test.ts'` to `test.include`.
In `package.json`, append
`&& tsc --project scripts/print/tsconfig.json --noEmit` to `typecheck`. In
`.gitignore`, add:

```
# Wall print output (npm run print)
scripts/print/out/
```

- [ ] **Step 2: Write the failing test**

`scripts/print/__tests__/layout.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../../src/layout.ts';
import type { TanakhLayout, TorahData } from '../../../src/types.ts';
import { PSALMS_COLUMNS, printLayout } from '../layout.ts';

const structure: TorahData = JSON.parse(
  readFileSync('public/data/tanakh-structure.json', 'utf8'),
);
const key = (v: TanakhLayout) => `${v.book}:${v.chapter}:${v.verse}`;

function box(vs: TanakhLayout[]) {
  return {
    minX: Math.min(...vs.map((v) => v.x)),
    maxX: Math.max(...vs.map((v) => v.x + v.size)),
    minY: Math.min(...vs.map((v) => v.y)),
    maxY: Math.max(...vs.map((v) => v.y + v.size)),
  };
}
type Box = ReturnType<typeof box>;
const overlap = (a: Box, b: Box) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

describe('printLayout', () => {
  const site = computeLayout(structure);
  const print = printLayout(structure);

  it('holds every verse of the site exactly once', () => {
    expect(print.map(key).sort()).toEqual(site.map(key).sort());
  });

  it('keeps each Psalm whole, with its own verses', () => {
    const psalms = structure.books.find((b) => b.name === 'Psalms')!;
    psalms.chapters.forEach((count, i) => {
      const verses = print.filter((v) => v.book === 'Psalms' && v.chapter === i + 1);
      expect(verses.map((v) => v.verse).sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, j) => j + 1),
      );
    });
  });

  it('sets Psalms in three columns that clear each other and every other book', () => {
    const [, second, third] = PSALMS_COLUMNS;
    const psalms = print.filter((v) => v.book === 'Psalms');
    const columns = [
      psalms.filter((v) => v.chapter < second),
      psalms.filter((v) => v.chapter >= second && v.chapter < third),
      psalms.filter((v) => v.chapter >= third),
    ].map(box);
    const others = [...new Set(print.map((v) => v.book))]
      .filter((b) => b !== 'Psalms')
      .map((b) => box(print.filter((v) => v.book === b)));
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) expect(overlap(columns[i], columns[j])).toBe(false);
      for (const other of others) expect(overlap(columns[i], other)).toBe(false);
    }
  });

  it('makes the map shorter than the site’s', () => {
    const height = (vs: TanakhLayout[]) => box(vs).maxY - box(vs).minY;
    expect(height(print)).toBeLessThan(height(site));
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/layout.test.ts`
Expected: FAIL, cannot resolve `../layout.ts`.

- [ ] **Step 4: Implement**

`scripts/print/layout.ts`:

```ts
// The site's layout with Psalms in three columns, which makes the map short
// enough to fill a 36-inch sheet's width with the key beneath it.

import { computeLayout } from '../../src/layout.ts';
import type { TanakhLayout, TorahData } from '../../src/types.ts';

/** The first chapter of each Psalms column. */
export const PSALMS_COLUMNS = [1, 51, 101] as const;

// computeLayout makes at most two columns of a book, so the third goes in as a
// book of its own, laid right after Psalms, and is renamed afterwards.
const THIRD_COLUMN = 'Psalms, third column';

export function threeColumnPsalms(structure: TorahData): TorahData {
  const [, second, third] = PSALMS_COLUMNS;
  return {
    books: structure.books.flatMap((b) =>
      b.name !== 'Psalms'
        ? [b]
        : [
            { ...b, chapters: b.chapters.slice(0, third - 1) },
            { ...b, name: THIRD_COLUMN, chapters: b.chapters.slice(third - 1) },
          ],
    ),
    layout: {
      ...structure.layout,
      multiColumnBooks: {
        ...structure.layout.multiColumnBooks,
        Psalms: { splitAtChapter: second - 1 },
      },
    },
  };
}

export function printLayout(structure: TorahData): TanakhLayout[] {
  const offset = PSALMS_COLUMNS[2] - 1;
  return computeLayout(threeColumnPsalms(structure)).map((v) =>
    v.book === THIRD_COLUMN ? { ...v, book: 'Psalms', chapter: v.chapter + offset } : v,
  );
}
```

- [ ] **Step 5: Run the test, then the typecheck**

Run: `npx vitest run scripts/print/__tests__/layout.test.ts`, expect PASS.
Then `npm run typecheck`, expect no errors. If `src/constants.ts`'s
`import.meta.env` fails to typecheck under `"types": ["node"]`, set
`"types": ["node", "vite/client"]` in `scripts/print/tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/print/layout.ts scripts/print/tsconfig.json scripts/print/__tests__/layout.test.ts vitest.config.ts package.json .gitignore
git commit -m "Lay the wall print out with Psalms in three columns"
```

---

### Task 2: The print palettes

**Files:**
- Create: `scripts/print/colour.ts`, `scripts/print/__tests__/colour.test.ts`

**Interfaces:**
- Produces: `PAPER`, `INK`, `INK_SOFT: string`;
  `oklch(L: number, C: number, hue: number): string` (hex, in gamut);
  `oklabLightness(hex: string): number`;
  `readingColours(count: number): string[]`;
  `walnut(verseIndex: number): string`;
  `paleTaupe(verseIndex: number): string`;
  `NAME_HUES: readonly number[]`; `nameInk(i: number): string`.

- [ ] **Step 1: Write the failing test**

`scripts/print/__tests__/colour.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  nameInk,
  NAME_HUES,
  oklabLightness,
  oklch,
  paleTaupe,
  readingColours,
  walnut,
} from '../colour.ts';

const HEX = /^#[0-9a-f]{6}$/;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('oklch', () => {
  it('fits every hue into sRGB, even at a chroma sRGB cannot reach', () => {
    for (let h = 0; h < 360; h += 15) expect(oklch(0.64, 0.4, h)).toMatch(HEX);
  });

  it('keeps the lightness it was asked for', () => {
    for (let h = 0; h < 360; h += 15) {
      expect(oklabLightness(oklch(0.64, 0.16, h))).toBeCloseTo(0.64, 2);
    }
  });
});

describe('readingColours', () => {
  const colours = readingColours(83);

  it('gives every reading its own colour, all equally light', () => {
    expect(new Set(colours).size).toBe(83);
    for (const c of colours) expect(oklabLightness(c)).toBeCloseTo(0.64, 2);
  });

  it('starts from red, as the site does', () => {
    const [r, g, b] = rgb(colours[0]);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
});

describe('unread verses', () => {
  it('vary by verse, but the same verse always gets the same colour', () => {
    expect(walnut(7)).toBe(walnut(7));
    expect(new Set([0, 1, 2, 3, 4].map(walnut)).size).toBeGreaterThan(1);
  });

  it('are dark brown on the haftarah print and pale on the search print', () => {
    for (let i = 0; i < 50; i++) {
      expect(oklabLightness(walnut(i))).toBeLessThan(oklabLightness(paleTaupe(i)));
    }
  });
});

describe('nameInk', () => {
  it('gives each name a distinct dark ink', () => {
    const inks = NAME_HUES.map((_, i) => nameInk(i));
    expect(new Set(inks).size).toBe(NAME_HUES.length);
    for (const ink of inks) expect(oklabLightness(ink)).toBeLessThan(0.55);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/colour.test.ts`
Expected: FAIL, cannot resolve `../colour.ts`.

- [ ] **Step 3: Implement**

`scripts/print/colour.ts`:

```ts
// Colours for ink on cream paper. The site's colour wheel is evenly spaced by
// the numbers, so on paper its yellows glare and its blues go dark; the
// readings here are evenly spaced in OKLCH, where equal numbers look equally
// bright.

import { hslToRgb } from '../../src/utils/color.ts';
import { seededRandom } from '../../src/utils/random.ts';

export const PAPER = '#f3ecdc';
export const INK = '#3a2e24';
export const INK_SOFT = '#7a6a58';

function hex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklchToSrgb(L: number, C: number, hue: number): number[] {
  const h = (hue * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toSrgb);
}

/** An OKLCH colour as hex, its chroma lowered until sRGB can show it. */
export function oklch(L: number, C: number, hue: number): string {
  let rgb = oklchToSrgb(L, C, hue);
  while (rgb.some((c) => c < 0 || c > 1) && C > 0) {
    C = Math.max(0, C - 0.005);
    rgb = oklchToSrgb(L, C, hue);
  }
  return hex(rgb);
}

/** OKLab lightness of a hex colour: how light it looks, 0 to 1. */
export function oklabLightness(colour: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(colour.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** The readings in the site's order around the wheel, from red. */
export function readingColours(count: number): string[] {
  return Array.from({ length: count }, (_, i) => oklch(0.64, 0.16, 29 + (i / count) * 360));
}

// Unread verses vary in depth by verse, as the site's grey does, from the same seed.
const vary = (verseIndex: number) => seededRandom(verseIndex * 3);

/** A verse in no reading, on the haftarah print. */
export function walnut(verseIndex: number): string {
  return hex(hslToRgb({ h: 31, s: 0.28, l: 0.34 + vary(verseIndex) * 0.13 }));
}

/** A verse naming no one, on the search print. */
export function paleTaupe(verseIndex: number): string {
  return hex(hslToRgb({ h: 37, s: 0.13, l: 0.66 + vary(verseIndex) * 0.07 }));
}

/**
 * Abraham, Isaac, Jacob, Moses, David. The site gives the fifth term yellow;
 * yellow darkened for print turns olive, too close to Jacob's green, so David
 * is plum.
 */
export const NAME_HUES = [215, 50, 135, 355, 320] as const;

export function nameInk(i: number): string {
  return oklch(0.5, 0.15, NAME_HUES[i]);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/print/__tests__/colour.test.ts`
Expected: PASS. If a lightness assertion fails at the second decimal place,
check the matrices against https://bottosson.github.io/posts/oklab/ before
loosening the test.

- [ ] **Step 5: Commit**

```bash
git add scripts/print/colour.ts scripts/print/__tests__/colour.test.ts
git commit -m "Add the wall print's palettes"
```

---

### Task 3: The inputs for each print

**Files:**
- Create: `scripts/print/types.ts`, `scripts/print/views.ts`,
  `scripts/print/__tests__/views.test.ts`

**Interfaces:**
- Consumes: `printLayout` (Task 1); everything in `colour.ts` (Task 2).
- Produces, in `types.ts` (types only; `draw.ts` imports them with
  `import type`):

```ts
/** Map units, as src/layout.ts gives them. */
export interface PrintVerse {
  x: number;
  y: number;
  /** Side of the drawn square, before any growth. */
  side: number;
  /** One colour, or one per band. */
  fills: string[];
}

export interface BookTitle {
  he: string;
  en: string;
  minX: number;
  maxX: number;
  minY: number;
}

export interface SectionTitle {
  he: string;
  en: string;
  maxX: number;
  minY: number;
}

export interface KeyRow {
  swatch: string;
  he: string;
  en: string;
  /** Beside the English, quieter: the search key's verse counts. */
  note?: string;
}

export interface KeyGroup {
  heading?: string;
  rows: KeyRow[];
}

export interface KeyColumn {
  heading?: { he: string; en: string };
  width: number;
  groups: KeyGroup[];
}

export interface Key {
  he: string;
  en: string;
  notes: string[];
  columns: KeyColumn[];
}

export interface Palette {
  paper: string;
  ink: string;
  inkSoft: string;
}

export interface SheetInput {
  kind: 'sheet';
  palette: Palette;
  verses: PrintVerse[];
  books: BookTitle[];
  sections: SectionTitle[];
  /** The Torah's left edge and first row, which place the logo. */
  torahMinX: number;
  torahTopY: number;
  logoSvg: string;
  key: Key;
  credits: string;
  bandOffset: number;
  growth: number;
  marks: boolean;
}

export interface ProofPatch {
  title: string;
  verses: PrintVerse[];
  /** The map point at the patch's centre. */
  centre: { x: number; y: number };
}

export interface ProofInput {
  kind: 'proof';
  palette: Palette;
  /** Points per map unit, as on the finished sheets. */
  scale: number;
  patches: ProofPatch[];
  swatches: { fill: string; label: string }[];
  bandOffset: number;
  growth: number;
}

export interface DrawResult {
  svg: string;
  /** Page size in points, bleed and slug included. */
  width: number;
  height: number;
  /** Points per map unit. */
  scale: number;
  /** Key entries wider than their column. */
  overflows: string[];
}
```

- Produces, in `views.ts`: `loadStructure(): TorahData`;
  `haftarahSheet(structure: TorahData, marks: boolean): Promise<SheetInput>`;
  `searchSheet(structure: TorahData, marks: boolean): Promise<SheetInput>`;
  `nameVerses(he: string, gloss: string): Set<string>` (after
  `loadLexiconData`); `proofInput(haftarah: SheetInput, search: SheetInput, scale: number): ProofInput`;
  `OCCASION_COLUMNS: string[][]`;
  `haftarahKey(derived: HaftarahDerivation, colours: string[], torah: Book[]): Key`.

- [ ] **Step 1: Write the failing test**

The vitest setup, `src/__tests__/setup.ts`, already serves `public/` to
`fetch`, so the site's loaders work in these tests unchanged.

`scripts/print/__tests__/views.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { deriveHaftarah, loadReadings } from '../../../src/overlays/haftarah/readings.ts';
import { loadLexiconData } from '../../../src/search.ts';
import type { SheetInput } from '../types.ts';
import { haftarahKey, haftarahSheet, loadStructure, nameVerses, searchSheet } from '../views.ts';

const structure = loadStructure();

describe('haftarahSheet', () => {
  let sheet: SheetInput;
  beforeAll(async () => {
    sheet = await haftarahSheet(structure, false);
  });

  it('draws every verse, split where a verse is in more than one reading', () => {
    const total = structure.books.flatMap((b) => b.chapters).reduce((a, b) => a + b, 0);
    expect(sheet.verses).toHaveLength(total);
    expect(sheet.verses.some((v) => v.fills.length > 1)).toBe(true);
  });

  it('lists every reading in the key exactly once, in the colour it has on the map', () => {
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    const derived = deriveHaftarah('ashkenazi');
    expect(rows.map((r) => r.en).sort()).toEqual(derived.items.map((i) => i.name).sort());
    const onMap = new Set(sheet.verses.flatMap((v) => v.fills));
    for (const row of rows) expect(onMap.has(row.swatch)).toBe(true);
  });

  it('refuses a kind of occasion the key has no column for', async () => {
    await loadReadings();
    const derived = deriveHaftarah('ashkenazi');
    const stray = { ...derived.items.at(-1)!, name: 'Stray', category: 'unheard-of' };
    const items = [...derived.items, stray];
    expect(() =>
      haftarahKey(
        { ...derived, items } as typeof derived,
        items.map(() => '#000000'),
        structure.books.filter((b) => b.section === 'torah'),
      ),
    ).toThrow(/unheard-of/);
  });
});

describe('searchSheet', () => {
  beforeAll(async () => {
    await loadLexiconData();
  });

  it('marks only the proper names', () => {
    // יצחק is also the verb "laugh"; the print marks only Isaac.
    const isaac = nameVerses('יצחק', 'Isaac');
    expect(isaac.size).toBeGreaterThan(0);
    // Genesis 21:6, "God has made laughter for me", uses the verb and not the name.
    expect(isaac.has('Genesis:21:6')).toBe(false);
  });

  it('refuses a name with no dictionary entry', () => {
    expect(() => nameVerses('אברהם', 'Abram the Unknown')).toThrow(/Abram the Unknown/);
  });

  it('gives each name one colour and a key row', async () => {
    const sheet = await searchSheet(structure, false);
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    expect(rows.map((r) => r.en)).toEqual(['Abraham', 'Isaac', 'Jacob', 'Moses', 'David']);
    expect(new Set(rows.map((r) => r.swatch)).size).toBe(5);
  });
});
```

Before relying on the Genesis 21:6 case, confirm it: in a scratch script
(`node --input-type=module`), load the lexicon and check that the verse's
lexemes include יצחק's "laugh" entry and not "Isaac". If it does not hold,
pick another verse where the verb appears and the name does not, and say which
in the test's comment.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/views.test.ts`
Expected: FAIL, cannot resolve `../views.ts`.

- [ ] **Step 3: Write `types.ts`**

Exactly the interfaces listed under **Interfaces** above, headed by one line:
`// What draw() takes: plain data, so it can cross into the page as JSON.`

- [ ] **Step 4: Implement `views.ts`**

```ts
// What each print shows: every verse's position and colours, the titles, and
// the key, as plain data for draw().

import { readFileSync } from 'node:fs';
import { BAND_OFFSET, MULTICOLOR_GROWTH, SQUARE_GAP } from '../../src/geometry.ts';
import {
  deriveHaftarah,
  loadReadings,
  type HaftarahDerivation,
  type HaftarahItem,
} from '../../src/overlays/haftarah/readings.ts';
import { findLexemesForWord, getLexeme, loadLexiconData, searchByLexemes } from '../../src/search.ts';
import { tanakhKey, type Book, type TanakhLayout, type TorahData } from '../../src/types.ts';
import { INK, INK_SOFT, nameInk, NAME_HUES, PAPER, paleTaupe, readingColours, walnut } from './colour.ts';
import { printLayout } from './layout.ts';
import type { BookTitle, Key, KeyColumn, KeyRow, ProofInput, SectionTitle, SheetInput } from './types.ts';

const PALETTE = { paper: PAPER, ink: INK, inkSoft: INK_SOFT };

const SECTION_NAMES = {
  torah: { he: 'תורה', en: 'Five Books' },
  neviim: { he: 'נביאים', en: 'Prophets' },
  ketuvim: { he: 'כתובים', en: 'Writings' },
} as const;

export function loadStructure(): TorahData {
  return JSON.parse(readFileSync('public/data/tanakh-structure.json', 'utf8'));
}

function titles(verses: TanakhLayout[], books: Book[]) {
  const bookBox = new Map<string, BookTitle>();
  const sectionBox = new Map<Book['section'], SectionTitle>();
  const sectionOf = new Map(books.map((b) => [b.name, b.section]));
  const hebrew = new Map(books.map((b) => [b.name, b.hebrewName]));
  for (const v of verses) {
    const b = bookBox.get(v.book) ?? {
      he: hebrew.get(v.book)!,
      en: v.book,
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
    };
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    bookBox.set(v.book, b);

    const section = sectionOf.get(v.book)!;
    const s = sectionBox.get(section) ?? { ...SECTION_NAMES[section], maxX: -Infinity, minY: Infinity };
    s.maxX = Math.max(s.maxX, v.x + v.size);
    s.minY = Math.min(s.minY, v.y);
    sectionBox.set(section, s);
  }
  const torah = verses.filter((v) => sectionOf.get(v.book) === 'torah');
  return {
    books: [...bookBox.values()],
    sections: [...sectionBox.values()],
    torahMinX: Math.min(...torah.map((v) => v.x)),
    torahTopY: Math.min(...torah.map((v) => v.y)),
  };
}

function sheet(
  layout: TanakhLayout[],
  structure: TorahData,
  fillsOf: (v: TanakhLayout, i: number) => string[],
  key: Key,
  credits: string,
  marks: boolean,
): SheetInput {
  return {
    kind: 'sheet',
    palette: PALETTE,
    verses: layout.map((v, i) => ({ x: v.x, y: v.y, side: v.size - SQUARE_GAP, fills: fillsOf(v, i) })),
    ...titles(layout, structure.books),
    logoSvg: readFileSync('src/mapTitle.svg', 'utf8'),
    key,
    credits,
    bandOffset: BAND_OFFSET,
    growth: MULTICOLOR_GROWTH,
    marks,
  };
}

const CATEGORY_NAMES: Record<string, string> = {
  'high-holidays': 'High Holy Days',
  sukkot: 'Sukkot',
  other: 'Other occasions',
  'four-shabbatot': 'The four Sabbaths',
  pesach: 'Pesach',
  shavuot: 'Shavuot',
  'fast-days': 'Fast days',
  'rosh-chodesh': 'New moon',
};

/** Two kinds of occasion to a column. */
export const OCCASION_COLUMNS = [
  ['high-holidays', 'sukkot'],
  ['other', 'four-shabbatot'],
  ['pesach', 'shavuot'],
  ['fast-days', 'rosh-chodesh'],
];

export function haftarahKey(derived: HaftarahDerivation, colours: string[], torah: Book[]): Key {
  const row = (item: HaftarahItem): KeyRow => ({
    swatch: colours[derived.items.indexOf(item)],
    he: item.hebrewName,
    en: item.name,
  });
  const portions: KeyColumn[] = torah.map((book) => ({
    heading: { he: book.hebrewName, en: book.name },
    width: 170,
    groups: [{ rows: derived.items.filter((i) => 'torah' in i && i.torah.book === book.name).map(row) }],
  }));
  const occasions = derived.items.filter((i) => !('torah' in i));
  for (const item of occasions) {
    const category = 'category' in item ? item.category : '';
    if (!OCCASION_COLUMNS.flat().includes(category)) {
      throw new Error(`The key has no column for "${category}" (${item.name}).`);
    }
  }
  const occasionColumns: KeyColumn[] = OCCASION_COLUMNS.map((kinds) => ({
    width: 270,
    groups: kinds.map((kind) => ({
      heading: CATEGORY_NAMES[kind],
      rows: occasions.filter((i) => 'category' in i && i.category === kind).map(row),
    })),
  }));
  return {
    he: 'הפטרות',
    en: 'Haftarot · the prophetic readings',
    notes: [
      'Each week’s Torah portion and the passage from the Prophets read after it share a colour; the holidays and special Sabbaths continue around the wheel.',
      'A verse read on more than one occasion is split corner to corner, one band for each reading. Verses in no reading are brown. Ashkenazi custom.',
    ],
    columns: [...portions, ...occasionColumns],
  };
}

export async function haftarahSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  await loadReadings();
  const derived = deriveHaftarah('ashkenazi');
  if (derived.items.length === 0) throw new Error('The haftarah readings did not load.');
  const colours = readingColours(derived.items.length);
  const colourOf = (item: HaftarahItem) => colours[derived.items.indexOf(item)];
  const layout = printLayout(structure);
  // As colorAt in src/overlays/haftarah.ts: a Torah verse shows its portion,
  // any other verse every reading it is part of.
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = tanakhKey(v.book, v.chapter, v.verse);
    const parsha = derived.torahVerseToParsha.get(key);
    const items = parsha ? [parsha] : (derived.haftarahVerseToItem.get(key) ?? []);
    return items.length ? items.map(colourOf) : [walnut(i)];
  };
  return sheet(
    layout,
    structure,
    fillsOf,
    haftarahKey(derived, colours, structure.books.filter((b) => b.section === 'torah')),
    'torahmap.org · Text of the Tanakh from Sefaria · Haftarah tables from hebcal',
    marks,
  );
}

const NAMES = [
  { he: 'אברהם', en: 'Abraham' },
  { he: 'יצחק', en: 'Isaac' },
  { he: 'יעקב', en: 'Jacob' },
  { he: 'משה', en: 'Moses' },
  { he: 'דוד', en: 'David' },
];

/**
 * The verses naming a person: only the dictionary entries for the written
 * form glossed as the name, so יצחק marks Isaac and never "laugh".
 */
export function nameVerses(he: string, gloss: string): Set<string> {
  const ids = (findLexemesForWord(he) ?? []).filter((id) => getLexeme(id)?.gloss === gloss);
  if (ids.length === 0) throw new Error(`No dictionary entry for ${he} glossed "${gloss}".`);
  return searchByLexemes(ids);
}

export async function searchSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  await loadLexiconData();
  const sets = NAMES.map((n) => nameVerses(n.he, n.en));
  const inks = NAME_HUES.map((_, i) => nameInk(i));
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = tanakhKey(v.book, v.chapter, v.verse);
    const named = inks.filter((_, k) => sets[k].has(key));
    return named.length ? named : [paleTaupe(i)];
  };
  const key: Key = {
    he: 'אבות ומנהיגים',
    en: 'Five names',
    notes: [
      'Every verse that names each of them is marked in their colour; a verse naming two is split corner to corner, one band each.',
      'Only the names: יצחק is never “laugh” here, nor דוד “beloved”.',
    ],
    columns: [
      {
        width: 300,
        groups: [
          {
            rows: NAMES.map((n, k) => ({
              swatch: inks[k],
              he: n.he,
              en: n.en,
              note: `${sets[k].size} verses`,
            })),
          },
        ],
      },
    ],
  };
  return sheet(
    printLayout(structure),
    structure,
    fillsOf,
    key,
    'torahmap.org · Text of the Tanakh from Sefaria · Dictionary from the ETCBC BHSA',
    marks,
  );
}

/** Two patches of the map at print scale, and every colour the prints use. */
export function proofInput(haftarah: SheetInput, search: SheetInput, scale: number): ProofInput {
  const readings = haftarah.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  const names = search.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  return {
    kind: 'proof',
    palette: PALETTE,
    scale,
    patches: [
      { title: 'Haftarah · Isaiah 40–60', verses: haftarah.verses, centre: { x: 1400, y: 880 } },
      { title: 'Five names · Genesis 22–32', verses: search.verses, centre: { x: 3200, y: 220 } },
    ],
    swatches: [
      { fill: PAPER, label: `paper ${PAPER}` },
      { fill: INK, label: `ink ${INK}` },
      { fill: INK_SOFT, label: `quiet ${INK_SOFT}` },
      ...[0, 1, 2].map((i) => ({ fill: walnut(i), label: `unread ${walnut(i)}` })),
      ...[0, 1, 2].map((i) => ({ fill: paleTaupe(i), label: `unnamed ${paleTaupe(i)}` })),
      ...names.map((r) => ({ fill: r.swatch, label: `${r.en} ${r.swatch}` })),
      ...readings.map((r) => ({ fill: r.swatch, label: `${r.en} ${r.swatch}` })),
    ],
    bandOffset: haftarah.bandOffset,
    growth: haftarah.growth,
  };
}
```

The key's title and notes for the search print are a first draft. Task 6
shows them to Danyel before anything is final.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/print/__tests__/views.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`, and fix every error in one pass.

```bash
git add scripts/print/types.ts scripts/print/views.ts scripts/print/__tests__/views.test.ts
git commit -m "Build the haftarah and search print inputs"
```

---

### Task 4: Drawing a sheet

**Files:**
- Create: `scripts/print/draw.ts`, `scripts/print/__tests__/draw.test.ts`

**Interfaces:**
- Consumes: `SheetInput`, `ProofInput`, `DrawResult` (Task 3, types only).
- Produces: `draw(input: SheetInput | ProofInput): DrawResult`. It replaces
  the page's body with one `<svg>` and returns it serialised. **It must be
  self-contained:** Playwright's `page.evaluate` sends a function as its
  source text, as in `video/inPage.ts`. So every helper is declared inside
  `draw`, and the module has only `import type` lines. The proof branch is a
  stub here, throwing `'proof: Task 7'`, and Task 7 fills it in.

- [ ] **Step 1: Write the failing test**

`scripts/print/__tests__/draw.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { draw } from '../draw.ts';
import type { SheetInput } from '../types.ts';

const LOGO =
  '<svg viewBox="0 0 453.19 157.3"><filter id="f"/><g filter="url(#f)" font-family="David Libre, system-ui, sans-serif">' +
  '<text x="453.19" y="27">מפת התנ״ך</text><text x="0" y="103.81">Torahmap</text>' +
  '<text x="0" y="151.61" font-family="system-ui, sans-serif">tagline</text></g></svg>';

function input(over: Partial<SheetInput> = {}): SheetInput {
  return {
    kind: 'sheet',
    palette: { paper: '#f3ecdc', ink: '#3a2e24', inkSoft: '#7a6a58' },
    verses: [
      { x: 0, y: 0, side: 4, fills: ['#111111'] },
      { x: 6, y: 0, side: 4, fills: ['#aa0000', '#00aa00'] },
      { x: 12, y: 0, side: 4, fills: ['#aa0000', '#00aa00', '#0000aa'] },
      { x: 3000, y: 1400, side: 4, fills: ['#111111'] },
    ],
    books: [
      { he: 'בראשית', en: 'Genesis', minX: 0, maxX: 300, minY: 0 },
      { he: 'עובדיה', en: 'Obadiah', minX: 400, maxX: 412, minY: 0 },
    ],
    sections: [{ he: 'תורה', en: 'Five Books', maxX: 3006, minY: 0 }],
    torahMinX: 0,
    torahTopY: 0,
    logoSvg: LOGO,
    key: {
      he: 'מפתח',
      en: 'Key',
      notes: ['A note.'],
      columns: [
        {
          width: 170,
          groups: [{ rows: [{ swatch: '#aa0000', he: 'בראשית', en: 'Bereshit' }] }],
        },
      ],
    },
    credits: 'credits',
    bandOffset: 0.08,
    growth: 0.75,
    marks: false,
    ...over,
  };
}

const svgOf = (result: ReturnType<typeof draw>) =>
  new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement;

describe('draw', () => {
  it('makes a 36 × 24 inch page with ⅛ inch of bleed on every side', () => {
    const result = draw(input());
    expect(result.width).toBe(2592 + 18);
    expect(result.height).toBe(1728 + 18);
  });

  it('adds a slug with eight crop marks only when asked', () => {
    expect(svgOf(draw(input())).querySelectorAll('.crop-mark')).toHaveLength(0);
    const marked = draw(input({ marks: true }));
    expect(marked.width).toBe(2592 + 18 + 72);
    expect(svgOf(marked).querySelectorAll('.crop-mark')).toHaveLength(8);
  });

  it('draws one band per colour of a split verse, each slid along the cut', () => {
    const svg = svgOf(draw(input()));
    const bands = [...svg.querySelectorAll('.verses polygon')];
    expect(bands).toHaveLength(5);
    // The two-colour verse grows 0.75 on every side, to a side of 5.5 from
    // (5.25, -0.75). Its first band is the triangle above the cut, slid by
    // -0.5 * 0.08 * 5.5 = -0.22 along (+1, -1).
    const first = bands[0]
      .getAttribute('points')!
      .split(' ')
      .map((p) => p.split(',').map(Number));
    expect(first).toEqual(
      expect.arrayContaining([
        [expect.closeTo(5.25 - 0.22, 5), expect.closeTo(-0.75 + 0.22, 5)],
        [expect.closeTo(10.75 - 0.22, 5), expect.closeTo(-0.75 + 0.22, 5)],
        [expect.closeTo(5.25 - 0.22, 5), expect.closeTo(4.75 + 0.22, 5)],
      ]),
    );
  });

  it('drops the English, then shrinks the Hebrew, of a title too wide for its book', () => {
    const svg = svgOf(draw(input()));
    const [wide, narrow] = [...svg.querySelectorAll('.book-title')];
    expect(wide.textContent).toContain('Genesis');
    expect(narrow.textContent).not.toContain('Obadiah');
    const size = Number(narrow.querySelector('tspan')!.getAttribute('font-size'));
    expect(size).toBeLessThan(15);
    expect(size).toBeGreaterThanOrEqual(9);
  });

  it('reports a key entry wider than its column', () => {
    const long = input({
      key: {
        ...input().key,
        columns: [
          {
            width: 60,
            groups: [
              { rows: [{ swatch: '#aa0000', he: 'שבת חול המועד פסח', en: 'Passover, Intermediate Sabbath' }] },
            ],
          },
        ],
      },
    });
    expect(draw(long).overflows).toEqual(['Passover, Intermediate Sabbath']);
    expect(draw(input()).overflows).toEqual([]);
  });

  it('takes the logo from the site’s artwork, without its shadow', () => {
    const svg = svgOf(draw(input()));
    expect(svg.querySelector('.logo')!.textContent).toContain('Torahmap');
    expect(svg.querySelector('.logo [filter]')).toBeNull();
  });
});
```

The measurement check depends on how text is measured under happy-dom. `draw`
measures with a canvas when the page can give it one. Otherwise it estimates
a width of 0.55 of the font size per character, so the numbers in these tests
hold either way.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/draw.test.ts`
Expected: FAIL, cannot resolve `../draw.ts`.

- [ ] **Step 3: Implement**

`scripts/print/draw.ts`. Port from `scripts/print/prototype/layoutC-template.html`,
with these differences: the input is data, not a global; the band slide and
the growth are new; the logo comes from `input.logoSvg`; English is Inter;
the sizes follow Global Constraints; bleed and marks are new; the key reports
overflows.

```ts
// Draws a print from its input, as SVG in the page, where the real fonts can
// measure text. Playwright sends this function to the page as source text, so
// everything it uses is declared inside it.

import type { DrawResult, Key, ProofInput, SheetInput } from './types.ts';

export function draw(input: SheetInput | ProofInput): DrawResult {
  const NS = 'http://www.w3.org/2000/svg';
  const HEBREW = 'David Libre';
  const LATIN = 'Inter';
  const { paper, ink, inkSoft } = input.palette;

  function el(parent: Element, name: string, attrs: Record<string, string | number> = {}, text?: string) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  // A test DOM may have no canvas; the estimate below stands in.
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  function measure(text: string, family: string, size: number, weight: number): number {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${weight} ${size}px "${family}"`;
    return ctx.measureText(text).width;
  }

  // Clip a polygon to the half-plane a·x + b·y <= c.
  function clip(poly: number[][], a: number, b: number, c: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const pIn = a * p[0] + b * p[1] <= c;
      const qIn = a * q[0] + b * q[1] <= c;
      if (pIn) out.push(p);
      if (pIn !== qIn) {
        const t = (c - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]));
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }

  // Verses in map units. A split verse grows, and band k of n covers the part
  // of the square where (u + v) / 2 lies in [k/n, (k+1)/n), slid along the cut
  // as the site's shader slides it.
  function drawVerses(g: Element, verses: SheetInput['verses'], bandOffset: number, growth: number) {
    for (const v of verses) {
      if (v.fills.length === 1) {
        el(g, 'rect', { x: v.x, y: v.y, width: v.side, height: v.side, fill: v.fills[0] });
        continue;
      }
      const x = v.x - growth;
      const y = v.y - growth;
      const side = v.side + 2 * growth;
      const n = v.fills.length;
      const square = [[x, y], [x + side, y], [x + side, y + side], [x, y + side]];
      v.fills.forEach((fill, k) => {
        let band = clip(square, 1, 1, x + y + (2 * side * (k + 1)) / n);
        band = clip(band, -1, -1, -(x + y + (2 * side * k) / n));
        const slide = (k - (n - 1) / 2) * bandOffset * side;
        const points = band.map(([px, py]) => `${px + slide},${py - slide}`).join(' ');
        el(g, 'polygon', { points, fill });
      });
    }
  }

  function newPage(width: number, height: number) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    return el(document.body, 'svg', {
      xmlns: NS,
      width: `${width}pt`,
      height: `${height}pt`,
      viewBox: `0 0 ${width} ${height}`,
    }) as SVGSVGElement;
  }

  if (input.kind === 'proof') {
    throw new Error('proof: Task 7');
  }

  const TRIM_W = 2592;
  const TRIM_H = 1728;
  const BLEED = 9;
  const SLUG = input.marks ? 36 : 0;
  const M = 108;
  const width = TRIM_W + 2 * (BLEED + SLUG);
  const height = TRIM_H + 2 * (BLEED + SLUG);
  const svg = newPage(width, height);
  const sheet = el(svg, 'g', { transform: `translate(${BLEED + SLUG},${BLEED + SLUG})` });
  el(sheet, 'rect', { x: -BLEED, y: -BLEED, width: TRIM_W + 2 * BLEED, height: TRIM_H + 2 * BLEED, fill: paper });

  if (input.marks) {
    const LEN = 24;
    for (const cx of [0, TRIM_W]) {
      for (const cy of [0, TRIM_H]) {
        const dx = cx === 0 ? -1 : 1;
        const dy = cy === 0 ? -1 : 1;
        const attrs = { class: 'crop-mark', stroke: '#000', 'stroke-width': 0.25 };
        el(sheet, 'line', { ...attrs, x1: cx + dx * BLEED, x2: cx + dx * (BLEED + LEN), y1: cy, y2: cy });
        el(sheet, 'line', { ...attrs, x1: cx, x2: cx, y1: cy + dy * BLEED, y2: cy + dy * (BLEED + LEN) });
      }
    }
  }

  const overflows: string[] = [];

  // The key, drawn with its top at the hairline; returns how tall it is.
  function drawKey(g: Element, key: Key): number {
    const title = el(g, 'text', { y: 56, fill: ink });
    el(title, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 23 }, key.he);
    el(title, 'tspan', { 'font-family': LATIN, 'font-weight': 600, 'font-size': 20, dx: 10 }, key.en);
    key.notes.forEach((note, i) =>
      el(g, 'text', { y: 80 + i * 15, 'font-family': LATIN, 'font-size': 11, fill: inkSoft }, note),
    );
    const top = 80 + (key.notes.length - 1) * 15 + 27;
    let x = 0;
    let bottom = top;
    key.columns.forEach((column, ci) => {
      // The occasion columns start 20 after the portion columns.
      if (ci > 0 && !column.heading && key.columns[ci - 1].heading) x += 20;
      let y = top;
      if (column.heading) {
        const h = el(g, 'text', { x, y, fill: ink });
        el(h, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 12.65 }, column.heading.he);
        el(h, 'tspan', { 'font-family': LATIN, 'font-size': 11, dx: 5, fill: inkSoft }, column.heading.en);
        y += 8;
      }
      column.groups.forEach((group, gi) => {
        if (group.heading) {
          if (gi > 0) y += 21;
          el(g, 'text', { x, y, 'font-family': LATIN, 'font-weight': 600, 'font-size': 10, fill: inkSoft }, group.heading);
        }
        for (const row of group.rows) {
          y += 15;
          el(g, 'rect', { x, y: y - 9, width: 9, height: 9, fill: row.swatch });
          const t = el(g, 'text', { x: x + 14, y, fill: ink });
          el(t, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 11.5 }, row.he);
          el(t, 'tspan', { 'font-family': LATIN, 'font-size': 10, dx: 4, fill: inkSoft }, row.en);
          if (row.note) el(t, 'tspan', { 'font-family': LATIN, 'font-size': 10, dx: 6, fill: inkSoft }, row.note);
          const used =
            14 +
            measure(row.he, HEBREW, 11.5, 700) +
            4 +
            measure(row.en, LATIN, 10, 400) +
            (row.note ? 6 + measure(row.note, LATIN, 10, 400) : 0);
          if (used > column.width) overflows.push(row.en);
        }
      });
      bottom = Math.max(bottom, y);
      x += column.width;
    });
    return bottom + 6;
  }

  // Measure the key off-page first: its height decides how big the map can be.
  const probe = el(sheet, 'g', {});
  const keyHeight = drawKey(probe, input.key);
  probe.remove();
  overflows.length = 0;

  const xs = input.verses.map((v) => v.x);
  const ys = input.verses.map((v) => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const mapW = Math.max(...input.verses.map((v) => v.x + v.side + 2)) - minX;
  const mapH = Math.max(...input.verses.map((v) => v.y + v.side + 2)) - minY;
  const scale = Math.min((TRIM_W - 2 * M - 50) / mapW, (TRIM_H - 2 * M - 34 - 50 - keyHeight) / mapH);
  const ox = (TRIM_W - mapW * scale - 50) / 2;
  const oy = M + 34;
  const map = el(sheet, 'g', { transform: `translate(${ox - minX * scale},${oy - minY * scale})` });
  drawVerses(el(map, 'g', { class: 'verses', transform: `scale(${scale})` }), input.verses, input.bandOffset, input.growth);

  for (const b of input.books) {
    const room = (b.maxX - b.minX) * scale;
    let heSize = 15;
    const t = el(map, 'text', { class: 'book-title', x: b.maxX * scale, y: b.minY * scale - 9, 'text-anchor': 'end', fill: ink });
    const he = el(t, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': heSize }, b.he);
    const en = el(t, 'tspan', { 'font-family': LATIN, 'font-weight': 700, 'font-size': 13, dx: 5 }, b.en);
    if (measure(b.he, HEBREW, heSize, 700) + 5 + measure(b.en, LATIN, 13, 700) > room) {
      en.remove();
      while (measure(b.he, HEBREW, heSize, 700) > room && heSize > 9) heSize -= 0.5;
      he.setAttribute('font-size', String(heSize));
    }
  }

  for (const s of input.sections) {
    const t = el(map, 'text', {
      transform: `translate(${s.maxX * scale + 8},${s.minY * scale - 26}) rotate(90)`,
      fill: inkSoft,
    });
    el(t, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 25.3 }, s.he);
    el(t, 'tspan', { 'font-family': LATIN, 'font-weight': 700, 'font-size': 22, dx: 8 }, s.en);
  }

  // The site's title artwork, recoloured for paper and without its shadow.
  const art = new DOMParser().parseFromString(input.logoSvg, 'image/svg+xml').documentElement;
  const box = art.getAttribute('viewBox')!.split(/\s+/).map(Number);
  const logoW = 929 * scale;
  const k = logoW / box[2];
  const logo = el(map, 'g', {
    class: 'logo',
    transform: `translate(${((minX + input.torahMinX) / 2) * scale - logoW / 2},${(input.torahTopY - 28) * scale}) scale(${k})`,
    'font-family': HEBREW,
    'font-weight': 700,
  });
  const fills = [inkSoft, ink, inkSoft];
  [...art.querySelectorAll('text')].forEach((text, i) => {
    const copy = el(logo, 'text', {}, text.textContent ?? '');
    for (const a of ['x', 'y', 'text-anchor', 'font-size', 'letter-spacing']) {
      const v = text.getAttribute(a);
      if (v !== null) copy.setAttribute(a, v);
    }
    copy.setAttribute('fill', fills[i] ?? ink);
    if (text.getAttribute('font-family')?.startsWith('system-ui')) {
      copy.setAttribute('font-family', LATIN);
      copy.setAttribute('font-weight', '400');
    }
  });

  const hairlineY = oy + mapH * scale + 50;
  el(sheet, 'line', { x1: ox, x2: ox + mapW * scale + 50, y1: hairlineY, y2: hairlineY, stroke: inkSoft, 'stroke-width': 0.75 });
  drawKey(el(sheet, 'g', { transform: `translate(${ox},${hairlineY})` }), input.key);

  el(sheet, 'text', { x: TRIM_W - M, y: TRIM_H - 54, 'text-anchor': 'end', 'font-family': LATIN, 'font-size': 9, fill: inkSoft }, input.credits);

  return { svg: svg.outerHTML, width, height, scale, overflows };
}
```

Two differences from the approved mockup are deliberate. Check both by eye
in Task 5:
- The logo sits at the site's own placement. The mockup lifted it a further
  16 pt.
- The map's size now comes from the key's real height, where the mockup used
  a fixed band.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/print/__tests__/draw.test.ts`
Expected: PASS. If happy-dom lacks `DOMParser` for SVG or
`createElementNS` serialisation, say so and stop. Do not switch the test
environment for the whole suite.

- [ ] **Step 5: Format, typecheck, commit**

```bash
npm run format && npm run typecheck
git add scripts/print/draw.ts scripts/print/__tests__/draw.test.ts
git commit -m "Draw a wall print sheet as SVG"
```

---

### Task 5: The entry point, and the first real prints

**Files:**
- Create: `scripts/print/print.ts`, `scripts/print/fonts.ts`,
  `scripts/print/__tests__/fonts.test.ts`
- Modify: `package.json` (add `"print": "node scripts/print/print.ts"`)

**Interfaces:**
- Consumes: `loadStructure`, `haftarahSheet`, `searchSheet` (Task 3); `draw`
  (Task 4).
- Produces: `FACES: string[]`;
  `unloadedFaces(faces: string[], check: (face: string) => boolean): string[]`;
  files `scripts/print/out/{haftarah,search}.{svg,pdf,png}`.

- [ ] **Step 1: Write the failing test**

`scripts/print/__tests__/fonts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FACES, unloadedFaces } from '../fonts.ts';

describe('unloadedFaces', () => {
  it('names every face the page could not load', () => {
    const loaded = new Set([FACES[0]]);
    expect(unloadedFaces(FACES, (f) => loaded.has(f))).toEqual(FACES.slice(1));
  });

  it('is empty when every face loaded', () => {
    expect(unloadedFaces(FACES, () => true)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/fonts.test.ts`
Expected: FAIL, cannot resolve `../fonts.ts`.

- [ ] **Step 3: Implement `fonts.ts`**

```ts
// The faces the prints are set in. A face that fails to load leaves Chromium
// to substitute one silently, so the run checks each before drawing.

export const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=David+Libre:wght@700&family=Inter:wght@400;600;700&display=block';

/** As document.fonts.check takes them. */
export const FACES = ['700 20px "David Libre"', '400 20px "Inter"', '600 20px "Inter"', '700 20px "Inter"'];

export function unloadedFaces(faces: string[], check: (face: string) => boolean): string[] {
  return faces.filter((f) => !check(f));
}
```

- [ ] **Step 4: Implement `print.ts`**

```ts
// Writes the wall prints: npm run print [-- --marks]. Output goes to
// scripts/print/out/, as SVG (for Figma), vector PDF, and 300 dpi PNG.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { draw } from './draw.ts';
import { FACES, FONTS_CSS, unloadedFaces } from './fonts.ts';
import type { DrawResult, ProofInput, SheetInput } from './types.ts';
import { haftarahSheet, loadStructure, searchSheet } from './views.ts';

const OUT = 'scripts/print/out';

// The site's loaders fetch from the site root; serve public/ from disk, as
// scripts/search/click-resolution-report.ts does.
const publicDir = normalize('public');
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = normalize(join(publicDir, decodeURIComponent(url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0])));
  if (!path.startsWith(publicDir) || !existsSync(path)) return new Response(null, { status: 404 });
  return new Response(readFileSync(path, 'utf8'), { status: 200 });
}) as typeof fetch;

async function openPage(): Promise<Page> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="${FONTS_CSS}"><style>@page { margin: 0 } body { margin: 0 }</style>
    </head><body></body></html>`);
  const checks = await page.evaluate(async (faces) => {
    await Promise.all(faces.map((f) => document.fonts.load(f, 'אבג abc')));
    return faces.map((f) => document.fonts.check(f, 'אבג abc'));
  }, FACES);
  const missing = unloadedFaces(FACES, (f) => checks[FACES.indexOf(f)]);
  if (missing.length) throw new Error(`These fonts did not load: ${missing.join(', ')}`);
  return page;
}

async function write(page: Page, name: string, input: SheetInput | ProofInput): Promise<DrawResult> {
  const result = await page.evaluate(draw, input);
  for (const entry of result.overflows) console.warn(`${name}: key entry wider than its column: ${entry}`);
  writeFileSync(join(OUT, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${result.svg}\n`);
  await page.pdf({
    path: join(OUT, `${name}.pdf`),
    width: `${result.width / 72}in`,
    height: `${result.height / 72}in`,
    printBackground: true,
  });
  execFileSync('pdftoppm', ['-r', '300', '-png', '-singlefile', join(OUT, `${name}.pdf`), join(OUT, name)]);
  console.log(`${name}: ${(result.width / 72).toFixed(3)} × ${(result.height / 72).toFixed(3)} in`);
  return result;
}

const marks = process.argv.includes('--marks');
mkdirSync(OUT, { recursive: true });
const structure = loadStructure();
const page = await openPage();
try {
  await write(page, 'haftarah', await haftarahSheet(structure, marks));
  await write(page, 'search', await searchSheet(structure, marks));
} finally {
  await page.context().browser()?.close();
}
```

`page.evaluate(draw, input)` sends `draw`'s source text. Node's type stripping
turns the types into spaces, so the source it sends is plain JavaScript.
`video/` relies on the same thing.

- [ ] **Step 5: Run the tests, then the prints**

Run: `npx vitest run scripts/print/__tests__/fonts.test.ts`, expect PASS.
Then run `npm run print`. Expected: two lines, each giving the page size as
`36.250 × 24.250 in`. There should be no key-overflow warnings for the
haftarah print, since the occasion columns are 270 wide. If there are, widen
the column in `views.ts`.

- [ ] **Step 6: Verify the files**

Run: `pdffonts scripts/print/out/haftarah.pdf`
Expected: David Libre and Inter, each `emb yes`.

Downscale the PNG and read it:
`sips -Z 3000 scripts/print/out/haftarah.png --out /tmp/haftarah-small.png`.
Compare it with
`docs/plans/images/2026-09-29-wall-print/haftarah-layout.png`. Check that it
has the same arrangement, Psalms in three columns, the logo in its corner, the
key under the hairline, and no text colliding. Then crop 1:1 patches from the
full PNG, `sips -c 1500 1500 --cropOffset <y> <x>`, at Isaiah, the Minor
Prophets and the key. Read them to check the split verses' slide, the title
shrinking and the key's type. A picture is the only real check here: the
tests cannot see a collision.

- [ ] **Step 7: Commit**

```bash
npm run format && npm run typecheck
git add scripts/print/print.ts scripts/print/fonts.ts scripts/print/__tests__/fonts.test.ts package.json
git commit -m "Write the wall prints as SVG, PDF and PNG"
```

---

### Task 6: Show Danyel the search key

**Files:** none, unless he asks for changes (then `scripts/print/views.ts`).

- [ ] **Step 1: Make the preview**

From `scripts/print/out/search.png`, save a downscaled whole sheet
(`sips -Z 3000`) and a 1:1 crop of the key. Put both in
`docs/plans/images/2026-09-29-wall-print/`, as `search-sheet.png` and
`search-key.png`, and commit them.

- [ ] **Step 2: Stop and ask**

Show Danyel both images: open them in the viewer, and give the paths. Say
that the search key's title (`אבות ומנהיגים · Five names`) and its two notes
are a first draft. Wait for his answer. Do not start Task 7 until he has
approved the search key or said what to change. Make his changes in
`views.ts`, re-run `npm run print`, and show him again.

---

### Task 7: The proof sheet

**Files:**
- Modify: `scripts/print/draw.ts` (the proof branch),
  `scripts/print/print.ts`, `scripts/print/__tests__/draw.test.ts`

**Interfaces:**
- Consumes: `proofInput` (Task 3); the `scale` a sheet's `DrawResult` returns.
- Produces: `scripts/print/out/proof.pdf`, a US-letter landscape page.

- [ ] **Step 1: Write the failing test**

Add to `draw.test.ts`:

```ts
import type { ProofInput } from '../types.ts';

describe('draw, proof', () => {
  const proof: ProofInput = {
    kind: 'proof',
    palette: { paper: '#f3ecdc', ink: '#3a2e24', inkSoft: '#7a6a58' },
    scale: 0.7,
    patches: [
      { title: 'A', verses: [{ x: 100, y: 100, side: 4, fills: ['#aa0000'] }], centre: { x: 100, y: 100 } },
      { title: 'B', verses: [{ x: 100, y: 100, side: 4, fills: ['#00aa00'] }], centre: { x: 100, y: 100 } },
    ],
    swatches: [
      { fill: '#aa0000', label: 'red #aa0000' },
      { fill: '#00aa00', label: 'green #00aa00' },
    ],
    bandOffset: 0.08,
    growth: 0.75,
  };

  it('makes a letter page, landscape', () => {
    const result = draw(proof);
    expect([result.width, result.height]).toEqual([792, 612]);
  });

  it('draws each patch at the sheets’ scale, and labels every swatch', () => {
    const svg = new DOMParser().parseFromString(draw(proof).svg, 'image/svg+xml').documentElement;
    const patches = [...svg.querySelectorAll('.patch .verses')];
    expect(patches).toHaveLength(2);
    for (const p of patches) expect(p.getAttribute('transform')).toContain('scale(0.7)');
    expect(svg.querySelectorAll('.swatch')).toHaveLength(2);
    expect(svg.textContent).toContain('green #00aa00');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/print/__tests__/draw.test.ts`
Expected: the two proof tests FAIL with `proof: Task 7`.

- [ ] **Step 3: Implement the proof branch**

In `draw.ts`, replace `throw new Error('proof: Task 7');` with:

```ts
    const W = 792;
    const H = 612;
    const P = 252; // each patch 3½ in square, at print scale
    const svg = newPage(W, H);
    el(svg, 'rect', { width: W, height: H, fill: paper });
    el(svg, 'text', { x: 36, y: 30, 'font-family': LATIN, 'font-size': 10, fill: ink },
      'Torahmap wall print · proof at full scale · colours as sent to the printer');
    input.patches.forEach((patch, i) => {
      const x = 36 + i * (P + 18);
      const y = 44;
      const g = el(svg, 'g', { class: 'patch' });
      const clipId = `patch-${i}`;
      const cp = el(el(svg, 'defs'), 'clipPath', { id: clipId });
      el(cp, 'rect', { x, y, width: P, height: P });
      const inner = el(g, 'g', { 'clip-path': `url(#${clipId})` });
      const tx = x + P / 2 - patch.centre.x * input.scale;
      const ty = y + P / 2 - patch.centre.y * input.scale;
      drawVerses(
        el(inner, 'g', { class: 'verses', transform: `translate(${tx},${ty}) scale(${input.scale})` }),
        patch.verses,
        input.bandOffset,
        input.growth,
      );
      el(g, 'rect', { x, y, width: P, height: P, fill: 'none', stroke: inkSoft, 'stroke-width': 0.5 });
      el(g, 'text', { x, y: y + P + 12, 'font-family': LATIN, 'font-size': 8, fill: inkSoft }, patch.title);
    });
    const COLS = 16;
    const CELL_W = (W - 72) / COLS;
    input.swatches.forEach((s, i) => {
      const x = 36 + (i % COLS) * CELL_W;
      const y = 44 + P + 30 + Math.floor(i / COLS) * 36;
      el(svg, 'rect', { class: 'swatch', x, y, width: 18, height: 18, fill: s.fill });
      el(svg, 'text', { x, y: y + 26, 'font-family': LATIN, 'font-size': 5, fill: ink }, s.label);
    });
    return { svg: svg.outerHTML, width: W, height: H, scale: input.scale, overflows: [] };
```

With 83 readings, 5 names and 9 other colours, the swatches fill 7 rows,
ending about 44 + 252 + 30 + 7 × 36 = 578 pt down, inside the 612 pt page.

- [ ] **Step 4: Wire it into `print.ts`**

Keep the two `DrawResult`s and write the proof after them. Replace the `try`
block's body with:

```ts
  const haftarah = await haftarahSheet(structure, marks);
  const search = await searchSheet(structure, marks);
  const drawn = await write(page, 'haftarah', haftarah);
  await write(page, 'search', search);
  await write(page, 'proof', proofInput(haftarah, search, drawn.scale));
```

Add `proofInput` to the import from `./views.ts`.

- [ ] **Step 5: Run the tests and the prints; look at the proof**

Run: `npx vitest run scripts/print/__tests__/draw.test.ts`, expect PASS. Then
run `npm run print`, and rasterise and read the proof:
`pdftoppm -r 100 -png -singlefile scripts/print/out/proof.pdf /tmp/proof`,
then read `/tmp/proof.png`. Check two things. Both patches should show verses
at print size, the same size as the 1:1 crops of the sheets. No swatch label
should run into its neighbour.

- [ ] **Step 6: Commit**

```bash
npm run format && npm run typecheck
git add scripts/print/draw.ts scripts/print/print.ts scripts/print/__tests__/draw.test.ts
git commit -m "Add the wall print's proof sheet"
```

---

### Task 8: Tidy up and open the pull request

**Files:**
- Create: `scripts/print/README.md`
- Delete: `scripts/print/prototype/`
- Modify: `docs/plans/2026-09-29-wall-print-design.md` (status line; the
  prototype paragraph under *Type and spacing*), `CLAUDE.md` (one line under
  Project Structure)

- [ ] **Step 1: Write the README**

`scripts/print/README.md`:

````markdown
# Wall prints

Two 36×24 inch prints of the map, the haftarah overlay and a search for
five names, as the design in
`docs/plans/2026-09-29-wall-print-design.md` describes.

```bash
npm run print             # scripts/print/out/: haftarah and search as .svg, .pdf, .png; proof.pdf
npm run print -- --marks  # the same, with crop marks on a slug outside the bleed
```

It needs network access for the fonts (David Libre and Inter, from Google
Fonts) and `pdftoppm` (Poppler) for the PNGs. The PDFs are what go to the
shop; the SVGs open in Figma, which has both faces; `proof.pdf` is a letter
page to print first, on the paper the prints will use.

To print another view, add a function beside `haftarahSheet` in `views.ts`
that returns a `SheetInput`, and call it from `print.ts`.
````

- [ ] **Step 2: Remove the prototype, and update the spec and CLAUDE.md**

`git rm -r scripts/print/prototype`. In the design doc:
- change the status to `**Status:** Built; see scripts/print/.`;
- replace the sentence naming `scripts/print/prototype/` with "The script
  that draws it is in `scripts/print/`."

In `CLAUDE.md`, under *Project Structure*, after the `video/` entry, add:
`- \`scripts/print/\` — wall prints of the map: \`npm run print\` writes print-ready PDFs.`

- [ ] **Step 3: Run the gates**

Run: `npm run typecheck && npm test && npm run format:check`
Expected: all pass. No layout tests are needed, because nothing in the app's
interface changed.

- [ ] **Step 4: Commit, push, open the PR**

Add a downscaled PNG of each print (`sips -Z 3000`) to
`docs/plans/images/2026-09-29-wall-print/` as `haftarah-sheet.png` (unless Task 6
already added `search-sheet.png`, add that too). Commit, then push:

```bash
git add -A scripts/print docs/plans CLAUDE.md
git commit -m "Document the wall print script and retire its prototype"
git push -u origin "$(git branch --show-current)"
```

Open the PR with `gh pr create --base main`. Write the body in plain prose:
what the prints are, how to run the script, and what Danyel should look at.
Embed both sheet PNGs by commit-pinned URL:
`https://raw.githubusercontent.com/danyelf/torahmap/<sha>/docs/plans/images/2026-09-29-wall-print/haftarah-sheet.png`,
using the SHA of the commit that added them. Relative paths 404 until the PR
merges. End the body with the attribution line for pull requests. Confirm
with `gh pr view`.
