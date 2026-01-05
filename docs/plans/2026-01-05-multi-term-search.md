# Multi-Term Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable comma-separated multi-term search with distinct colors per term and HSL blending for overlapping matches.

**Architecture:** Parse comma-separated queries into terms, search each term independently, track which terms match each verse, render with per-term colors and HSL-blended colors for multi-matches.

**Tech Stack:** TypeScript, WebGL (colors), vanilla DOM (UI)

---

## Task 1: Add Search Color Palette and HSL Utilities

**Files:**
- Modify: `src/utils/color.ts`

**Step 1: Add the search color palette**

Add after the existing constants (line 6):

```typescript
// Fixed palette for multi-term search (cyan, orange, lime, pink, yellow)
export const SEARCH_COLORS: Color[] = [
  [0.2, 0.9, 1.0],   // Cyan
  [1.0, 0.5, 0.0],   // Orange
  [0.5, 1.0, 0.2],   // Lime
  [1.0, 0.2, 0.8],   // Pink
  [1.0, 1.0, 0.2],   // Yellow
];
```

**Step 2: Add RGB to HSL conversion**

Add at end of file:

```typescript
interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function rgbToHsl(color: Color): HSL {
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s, l };
}

export function hslToRgb(hsl: HSL): Color {
  const { h, s, l } = hsl;

  if (s === 0) {
    return [l, l, l];
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return [
    hueToRgb(p, q, hNorm + 1/3),
    hueToRgb(p, q, hNorm),
    hueToRgb(p, q, hNorm - 1/3),
  ];
}

/**
 * Circular mean for hue values (handles wraparound correctly)
 */
function circularMeanHue(hues: number[]): number {
  let sinSum = 0;
  let cosSum = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  const avgRad = Math.atan2(sinSum / hues.length, cosSum / hues.length);
  let avgDeg = (avgRad * 180) / Math.PI;
  if (avgDeg < 0) avgDeg += 360;
  return avgDeg;
}

/**
 * Blend multiple colors using HSL averaging (circular mean for hue)
 */
export function blendColorsHSL(colors: Color[]): Color {
  if (colors.length === 0) return [0, 0, 0];
  if (colors.length === 1) return colors[0];

  const hslColors = colors.map(rgbToHsl);

  const avgHue = circularMeanHue(hslColors.map(c => c.h));
  const avgSat = hslColors.reduce((sum, c) => sum + c.s, 0) / hslColors.length;
  const avgLight = hslColors.reduce((sum, c) => sum + c.l, 0) / hslColors.length;

  return hslToRgb({ h: avgHue, s: avgSat, l: avgLight });
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/utils/color.ts
git commit -m "feat(search): add color palette and HSL blending utilities"
```

---

## Task 2: Update Search Module for Multi-Term Support

**Files:**
- Modify: `src/search.ts`

**Step 1: Update SearchResult interface**

Replace the existing `SearchResult` interface (lines 7-15) with:

```typescript
export interface TermMatch {
  termIndex: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  language: 'he' | 'en';
  matchingTerms: TermMatch[];
}
```

**Step 2: Add term parsing function**

Add after the `stripNikkud` function (after line 50):

```typescript
/**
 * Parse comma-separated search terms, filtering empty ones
 */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}
```

**Step 3: Rewrite the search function**

Replace the entire `search` function (lines 102-148) with:

```typescript
/**
 * Search for verses matching any of the comma-separated terms
 * Returns ALL matching verses with info about which terms matched
 */
export function search(query: string): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // Determine language from first term (all terms use same language)
  const isHebrew = isHebrewQuery(terms[0]);

  // Map: verseKey -> SearchResult
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

    for (const entry of searchIndex) {
      const text = isHebrew ? entry.hebrewText : entry.englishText;
      const original = isHebrew ? entry.hebrewOriginal : entry.englishOriginal;
      const idx = text.indexOf(normalizedTerm);

      if (idx !== -1) {
        const key = `${entry.book}:${entry.chapter}:${entry.verse}`;
        const snippet = createSnippet(original, idx, normalizedTerm.length);

        let result = resultMap.get(key);
        if (!result) {
          result = {
            book: entry.book,
            chapter: entry.chapter,
            verse: entry.verse,
            language: isHebrew ? 'he' : 'en',
            matchingTerms: [],
          };
          resultMap.set(key, result);
        }

        // Only add if this term hasn't matched this verse yet
        if (!result.matchingTerms.some(m => m.termIndex === termIndex)) {
          result.matchingTerms.push({
            termIndex,
            snippet: snippet.text,
            matchStart: snippet.matchStart,
            matchEnd: snippet.matchEnd,
          });
        }
      }
    }
  }

  return Array.from(resultMap.values());
}
```

**Step 4: Update getMatchingVerseKeys to return term indices**

Replace the existing function (lines 193-199) with:

```typescript
/**
 * Get map of verse keys to their matching term indices
 */
export function getMatchingVerseTerms(results: SearchResult[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const r of results) {
    const key = getVerseKey(r.book, r.chapter, r.verse);
    map.set(key, r.matchingTerms.map(m => m.termIndex));
  }
  return map;
}

// Keep old function for backwards compatibility during transition
export function getMatchingVerseKeys(results: SearchResult[]): Set<string> {
  return new Set(getMatchingVerseTerms(results).keys());
}
```

**Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (overlay will have type errors, that's expected)

**Step 6: Commit**

```bash
git add src/search.ts
git commit -m "feat(search): support multi-term comma-separated queries"
```

---

## Task 3: Update Search Overlay for Multi-Term Colors

**Files:**
- Modify: `src/overlays/search.ts`

**Step 1: Update imports**

Replace line 5-6:

```typescript
import { search, getMatchingVerseTerms, parseSearchTerms, type SearchResult } from '../search.ts';
import { SEARCH_COLORS, DIM_FACTOR, blendColorsHSL } from '../utils/color.ts';
```

**Step 2: Update state variables**

Replace lines 10-12:

```typescript
let currentQuery = '';
let currentTerms: string[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();
```

**Step 3: Update doSearch function**

Replace the `doSearch` function (lines 29-42):

```typescript
function doSearch(query: string): void {
  currentQuery = query;
  currentTerms = parseSearchTerms(query);

  if (currentTerms.length === 0) {
    currentResults = [];
    matchingTerms = new Map();
  } else {
    currentResults = search(query);
    matchingTerms = getMatchingVerseTerms(currentResults);
  }

  renderResults();
  updateCallback?.();
}
```

**Step 4: Update getVerseColor method**

Replace the `getVerseColor` method (lines 108-122):

```typescript
  getVerseColor(verse: Verse): Color | null {
    // No active search - use default colors
    if (currentTerms.length === 0) {
      return null;
    }

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);

    if (termIndices && termIndices.length > 0) {
      // Get colors for all matching terms
      const colors = termIndices.map(i => SEARCH_COLORS[i % SEARCH_COLORS.length]);
      // Blend if multiple, otherwise use single color
      return colors.length === 1 ? colors[0] : blendColorsHSL(colors);
    }

    // Dim non-matching verses
    const brightness = (0.4 + 0.2) * DIM_FACTOR;
    return [brightness, brightness, brightness];
  },
```

**Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/overlays/search.ts
git commit -m "feat(search): color verses by matching terms with HSL blending"
```

---

## Task 4: Update Results Panel UI

**Files:**
- Modify: `src/overlays/search.ts`

**Step 1: Add helper to get CSS color string**

Add after the imports (around line 8):

```typescript
function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}
```

**Step 2: Update renderResults function**

Replace the entire `renderResults` function (lines 44-88):

```typescript
function renderResults(): void {
  if (!searchResults) return;

  // Clear previous results (keep count div)
  const existingResults = searchResults.querySelectorAll('.search-result');
  existingResults.forEach(el => el.remove());

  const searchCount = searchResults.querySelector('#search-count') as HTMLDivElement;

  if (currentResults.length === 0) {
    searchResults.classList.remove('visible');
    if (searchCount) searchCount.textContent = '';
    return;
  }

  // Update count with term info
  if (searchCount) {
    const termInfo = currentTerms.length > 1 ? ` (${currentTerms.length} terms)` : '';
    searchCount.textContent = `${currentResults.length}${currentResults.length >= 100 ? '+' : ''} results${termInfo}`;
  }

  // Show up to 10 results
  const displayResults = currentResults.slice(0, 10);
  for (const result of displayResults) {
    const div = document.createElement('div');
    div.className = 'search-result';

    // Build term indicator dots
    const dots = result.matchingTerms
      .map(m => {
        const color = SEARCH_COLORS[m.termIndex % SEARCH_COLORS.length];
        return `<span class="term-dot" style="background: ${colorToCss(color)}"></span>`;
      })
      .join('');

    // Use first match's snippet for display
    const firstMatch = result.matchingTerms[0];
    const snippetHtml = escapeAndHighlight(
      firstMatch.snippet,
      firstMatch.matchStart,
      firstMatch.matchEnd,
      firstMatch.termIndex
    );

    div.innerHTML = `
      <div class="ref">
        <span class="term-indicators">${dots}</span>
        ${result.book} ${result.chapter}:${result.verse}
      </div>
      <div class="snippet ${result.language === 'he' ? 'rtl' : ''}">${snippetHtml}</div>
    `;
    div.addEventListener('click', () => {
      const verse = verses.find(v =>
        v.book === result.book &&
        v.chapter === result.chapter &&
        v.verse === result.verse
      );
      if (verse && onVerseClickCallback) {
        onVerseClickCallback(verse);
      }
    });
    searchResults.appendChild(div);
  }

  searchResults.classList.add('visible');
}
```

**Step 3: Update escapeAndHighlight function**

Replace the function (lines 90-95):

```typescript
function escapeAndHighlight(text: string, start: number, end: number, termIndex: number): string {
  const before = escapeHtml(text.slice(0, start));
  const match = escapeHtml(text.slice(start, end));
  const after = escapeHtml(text.slice(end));
  return `${before}<mark class="term-${termIndex % 5}">${match}</mark>${after}`;
}
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/overlays/search.ts
git commit -m "feat(search): add colored term indicators and per-term highlights"
```

---

## Task 5: Update Legend for Multi-Term Display

**Files:**
- Modify: `src/overlays/search.ts`

**Step 1: Update renderLegend method**

Replace the `renderLegend` method (lines 183-191):

```typescript
  renderLegend(container: HTMLElement): void {
    if (currentTerms.length > 0 && currentResults.length > 0) {
      const termLabels = currentTerms
        .map((term, i) => {
          const color = SEARCH_COLORS[i % SEARCH_COLORS.length];
          return `<span class="legend-term">
            <span class="color-swatch" style="background: ${colorToCss(color)}"></span>
            "${term}"
          </span>`;
        })
        .join(' ');
      container.innerHTML = `<div class="search-legend">${termLabels}</div>
        <div style="color: #888; font-size: 11px; margin-top: 4px;">${currentResults.length} matching verses</div>`;
    } else if (currentQuery.length > 0 && currentTerms.length === 0) {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type at least 2 characters per term</div>`;
    } else {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type to search (comma-separate multiple terms)</div>`;
    }
  },
```

**Step 2: Update getHoverInfo method**

Replace the `getHoverInfo` method (lines 193-210):

```typescript
  getHoverInfo(verse: Verse): string | null {
    if (currentTerms.length === 0) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);
    if (!termIndices) return null;

    // Show which terms matched
    const matchedTerms = termIndices.map(i => `"${currentTerms[i]}"`).join(', ');
    return `Matches: ${matchedTerms}`;
  },
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/overlays/search.ts
git commit -m "feat(search): update legend and hover info for multi-term display"
```

---

## Task 6: Add CSS Styles for Multi-Term UI

**Files:**
- Modify: `index.html`

**Step 1: Add term dot styles**

Add after line 305 (after `.search-result .snippet mark` rule):

```css
    .term-indicators {
      display: inline-flex;
      gap: 3px;
      margin-right: 6px;
      vertical-align: middle;
    }
    .term-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .search-result .snippet mark.term-0 { background: rgba(51, 230, 255, 0.4); color: #fff; }
    .search-result .snippet mark.term-1 { background: rgba(255, 128, 0, 0.4); color: #fff; }
    .search-result .snippet mark.term-2 { background: rgba(128, 255, 51, 0.4); color: #fff; }
    .search-result .snippet mark.term-3 { background: rgba(255, 51, 204, 0.4); color: #fff; }
    .search-result .snippet mark.term-4 { background: rgba(255, 255, 51, 0.4); color: #000; }
    .search-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 11px;
    }
    .legend-term {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #ccc;
    }
    .color-swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add index.html
git commit -m "style(search): add CSS for multi-term indicators and highlights"
```

---

## Task 7: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test single term search**

- Type "moses" - should show cyan highlights (same as before)
- Type "ירושלם" - should show cyan highlights for Hebrew

**Step 3: Test dual term search**

- Type "moses,pharaoh" - should show:
  - Cyan for moses-only verses
  - Orange for pharaoh-only verses
  - Blended color for verses with both
  - Colored dots in results panel
  - Legend showing both terms with colors

**Step 4: Test triple term search**

- Type "moses,aaron,pharaoh" - should show three distinct colors + blends

**Step 5: Test edge cases**

- "moses," (trailing comma) - should work as single term
- ",moses" (leading comma) - should work as single term
- "a,moses" (short term) - should only search "moses"
- ",,," - should show no results

**Step 6: Stop dev server and commit if any fixes needed**

---

## Task 8: Final Verification and Merge Prep

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds

**Step 2: Verify git status is clean**

Run: `git status`
Expected: Nothing to commit, working tree clean

**Step 3: Review all commits**

Run: `git log --oneline main..HEAD`
Expected: 6 commits for the feature

**Step 4: Ready for merge**

Report: Feature complete, ready to merge to main
