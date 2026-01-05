# Dual/Multi-Term Search Design

## Overview

Enhance the full text search to support multiple comma-separated search terms, each highlighted in a distinct color. Verses matching multiple terms display a blended color.

## Query Format

Comma-separated terms, whitespace trimmed:
- `"jeru,zio"` → `["jeru", "zio"]`
- `"moses, joseph, david"` → `["moses", "joseph", "david"]`
- Empty terms ignored: `"jeru,,zio"` → `["jeru", "zio"]`

Minimum 2 characters per term to activate search.

## Color Palette

Fixed palette, cycling for 6+ terms:

```typescript
const SEARCH_COLORS: Color[] = [
  [0.2, 0.9, 1.0],   // Cyan
  [1.0, 0.5, 0.0],   // Orange
  [0.5, 1.0, 0.2],   // Lime
  [1.0, 0.2, 0.8],   // Pink
  [1.0, 1.0, 0.2],   // Yellow
];
```

## Color Blending (HSL)

Verses matching multiple terms use HSL-averaged color:

1. Convert each matching term's RGB color to HSL
2. Average H (using circular mean for proper wraparound), S, and L
3. Convert back to RGB

Circular mean for hue: Convert hues to unit vectors, average, convert back to angle.

## Data Structures

```typescript
interface MultiSearchResult {
  verse: VerseResult;
  matchingTerms: number[];  // indices into search terms array
  snippets: TermSnippet[];  // one snippet per matching term
}
```

## UI Changes

### Results Panel

Each result shows colored dot indicators for matched terms:

```html
<div class="search-result">
  <span class="term-indicators">
    <span class="term-dot" style="background: rgb(51,230,255)"></span>
    <span class="term-dot" style="background: rgb(255,128,0)"></span>
  </span>
  <span class="reference">Genesis 14:18</span>
  <span class="snippet">...king of <mark class="term-0">Jeru</mark>salem...</span>
</div>
```

### Snippet Highlighting

Colored `<mark>` tags per term:

```css
.snippet mark.term-0 { background: rgba(51, 230, 255, 0.4); }
.snippet mark.term-1 { background: rgba(255, 128, 0, 0.4); }
.snippet mark.term-2 { background: rgba(128, 255, 51, 0.4); }
.snippet mark.term-3 { background: rgba(255, 51, 204, 0.4); }
.snippet mark.term-4 { background: rgba(255, 255, 51, 0.4); }
```

### Legend

Show each active term with its color swatch and label.

### Results Count

Display: "42 results (2 terms)"

## Files to Modify

1. **`src/search.ts`** - Multi-term parsing, return `matchingTerms[]` per result
2. **`src/overlays/search.ts`** - `getVerseColor` blending, UI rendering updates
3. **`src/utils/color.ts`** - Add palette, HSL conversion, blending functions
4. **`index.html`** - CSS for term dots and colored mark styles
