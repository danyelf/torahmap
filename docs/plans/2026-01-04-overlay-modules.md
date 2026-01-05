# Overlay Module System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor overlays from monolithic if/else branches into self-contained modules with a registry pattern.

**Architecture:** Each overlay is a separate module implementing the `Overlay` interface. A registry manages registration and lookup. Main.ts becomes orchestration-only with no overlay-specific logic.

**Tech Stack:** TypeScript, vanilla DOM

---

## Task 1: Create Overlay Types

**Files:**
- Create: `src/overlays/types.ts`

**Step 1: Create the overlay types file**

```typescript
// src/overlays/types.ts
import type { Verse } from '../types.ts';

export type Color = [number, number, number];

export interface Overlay {
  id: string;
  name: string;

  // Lifecycle - called once when app starts
  init?(): Promise<void>;
  destroy?(): void;

  // Core - called for each verse during applyOverlay
  // Return null to use default gray
  getVerseColor(verse: Verse): Color | null;

  // UI - called when overlay becomes active
  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  // Hover - called when user hovers a verse
  getHoverInfo?(verse: Verse): string | null;

  // For dynamic overlays - register callback to trigger re-render
  onUpdate?(callback: () => void): void;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/overlays/types.ts
git commit -s -m "feat(overlays): add Overlay interface and Color type"
```

---

## Task 2: Create Overlay Registry

**Files:**
- Create: `src/overlays/registry.ts`

**Step 1: Create the registry file**

```typescript
// src/overlays/registry.ts
import type { Overlay } from './types.ts';

const overlays = new Map<string, Overlay>();

export function registerOverlay(overlay: Overlay): void {
  overlays.set(overlay.id, overlay);
}

export function getOverlay(id: string): Overlay | undefined {
  return overlays.get(id);
}

export function getAllOverlays(): Overlay[] {
  return Array.from(overlays.values());
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/overlays/registry.ts
git commit -s -m "feat(overlays): add overlay registry"
```

---

## Task 3: Extract Divine Names Overlay

**Files:**
- Create: `src/overlays/divine-names.ts`
- Reference: `src/main.ts` lines 143-147 (colors), 347-352 (labels), 163-174 (apply logic)

**Step 1: Create divine-names overlay module**

```typescript
// src/overlays/divine-names.ts
import type { Overlay, Color } from './types.ts';
import type { Verse, DivineNamesData } from '../types.ts';

const COLORS: Record<number, Color> = {
  1: [0.3, 0.5, 0.9],  // YHWH only - Blue
  2: [0.9, 0.3, 0.3],  // Elohim only - Red
  3: [0.7, 0.3, 0.8],  // Both - Purple
};

const LABELS: Record<number, string> = {
  1: 'YHWH',
  2: 'Elohim',
  3: 'YHWH + Elohim',
};

let data: DivineNamesData = {};

export const divineNamesOverlay: Overlay = {
  id: 'divine-names',
  name: 'Divine Names',

  async init() {
    const res = await fetch('/data/divine-names.json');
    data = await res.json();
  },

  getVerseColor(verse: Verse): Color | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
    return code > 0 ? COLORS[code] ?? null : null;
  },

  renderLegend(container: HTMLElement) {
    container.innerHTML = `
      <div class="legend-row"><span class="swatch" style="background: rgb(77, 128, 230)"></span><span>YHWH</span></div>
      <div class="legend-row"><span class="swatch" style="background: rgb(230, 77, 77)"></span><span>Elohim</span></div>
      <div class="legend-row"><span class="swatch" style="background: rgb(179, 77, 204)"></span><span>Both</span></div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
    return code > 0 ? LABELS[code] : null;
  },
};
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/overlays/divine-names.ts
git commit -s -m "feat(overlays): extract divine-names overlay module"
```

---

## Task 4: Extract Heatmap Color Utility

**Files:**
- Create: `src/utils/color.ts`
- Reference: `src/main.ts` lines 29-55 (heatmapColor function)

**Step 1: Create color utilities file**

```typescript
// src/utils/color.ts
import type { Color } from '../overlays/types.ts';

/**
 * Heatmap color scale: dark blue -> light blue -> teal -> orange -> red
 * Uses logarithmic scale for better distribution
 */
export function heatmapColor(value: number, maxValue: number): Color {
  if (value === 0) return [0.15, 0.15, 0.2]; // Very dark for no data

  // Log scale: map 1..maxValue to 0..1
  const logMax = Math.log(maxValue + 1);
  const t = Math.log(value + 1) / logMax;

  // Multi-stop gradient
  if (t < 0.25) {
    const s = t / 0.25;
    return [0.1, 0.13 + s * 0.1, 0.18 + s * 0.2];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0.1 + s * 0.1, 0.23 + s * 0.2, 0.38 - s * 0.05];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [0.2 + s * 0.7, 0.43 - s * 0.1, 0.33 - s * 0.2];
  } else {
    const s = (t - 0.75) / 0.25;
    return [0.9 + s * 0.1, 0.33 - s * 0.1, 0.13 + s * 0.05];
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/utils/color.ts
git commit -s -m "refactor: extract heatmapColor to utils/color.ts"
```

---

## Task 5: Extract Commentary Overlay

**Files:**
- Create: `src/overlays/commentary.ts`
- Reference: `src/main.ts` lines 57-68 (getCommentaryCount), 175-213 (apply logic)

**Step 1: Create commentary overlay module**

```typescript
// src/overlays/commentary.ts
import type { Overlay, Color } from './types.ts';
import type { Verse, CommentaryData } from '../types.ts';
import { heatmapColor } from '../utils/color.ts';

let data: CommentaryData = {};
let currentCategory = 'total';
let updateCallback: (() => void) | null = null;

// Cache max values per category to avoid recalculating
let cachedMaxValues: Record<string, number> = {};
let verses: Verse[] = [];

function getCount(book: string, chapter: number, verse: number): number {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (currentCategory === 'total') return verseData.total;
  return verseData.categories[currentCategory] || 0;
}

function getMaxValue(): number {
  if (cachedMaxValues[currentCategory] !== undefined) {
    return cachedMaxValues[currentCategory];
  }
  let max = 0;
  for (const v of verses) {
    const count = getCount(v.book, v.chapter, v.verse);
    if (count > max) max = count;
  }
  cachedMaxValues[currentCategory] = max;
  return max;
}

export const commentaryOverlay: Overlay = {
  id: 'commentary',
  name: 'Commentary Density',

  async init() {
    const res = await fetch('/data/commentary-counts.json');
    data = await res.json();
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: Verse): Color | null {
    // Store reference to verses for max calculation
    // This is a bit awkward - we'll improve this in integration
    const count = getCount(verse.book, verse.chapter, verse.verse);
    const maxValue = getMaxValue();
    return heatmapColor(count, maxValue);
  },

  renderControls(container: HTMLElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'commentary-controls';
    wrapper.innerHTML = `
      <label for="category-select">Category:</label>
      <select id="category-select">
        <option value="total">All Commentary</option>
        <option value="Rashi">Rashi</option>
        <option value="Ramban">Ramban</option>
        <option value="Ibn Ezra">Ibn Ezra</option>
        <option value="Sforno">Sforno</option>
        <option value="Or HaChaim">Or HaChaim</option>
        <option value="Targum">Targum</option>
        <option value="Talmud">Talmud</option>
        <option value="Midrash">Midrash</option>
      </select>
    `;
    const select = wrapper.querySelector('select')!;
    select.value = currentCategory;
    select.addEventListener('change', () => {
      currentCategory = select.value;
      cachedMaxValues = {}; // Clear cache on category change
      updateCallback?.();
    });
    container.appendChild(wrapper);
  },

  renderLegend(container: HTMLElement) {
    const maxValue = getMaxValue();
    const logMax = Math.log(maxValue + 1);

    // Calculate tick values (powers of 10)
    const ticks: number[] = [0];
    let tickVal = 1;
    while (tickVal <= maxValue) {
      ticks.push(tickVal);
      tickVal *= 10;
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = `
      <div class="legend-gradient"></div>
      <div class="legend-ticks">
        ${ticks.map(val => {
          const pos = val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100;
          const label = val >= 1000 ? `${val / 1000}k` : String(val);
          return `<span class="tick" style="left: ${pos}%">${label}</span>`;
        }).join('')}
      </div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    const verseData = data[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
    if (!verseData) return null;
    if (currentCategory === 'total') {
      return `${verseData.total} links`;
    }
    const count = verseData.categories[currentCategory];
    return count ? `${count} ${currentCategory}` : null;
  },
};

// Allow main.ts to pass verses reference for max calculation
export function setVerses(v: Verse[]): void {
  verses = v;
  cachedMaxValues = {};
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/overlays/commentary.ts
git commit -s -m "feat(overlays): extract commentary overlay module"
```

---

## Task 6: Create Overlay Index

**Files:**
- Create: `src/overlays/index.ts`

**Step 1: Create index file that exports and registers overlays**

```typescript
// src/overlays/index.ts
export type { Overlay, Color } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export { commentaryOverlay, setVerses as setCommentaryVerses } from './commentary.ts';
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/overlays/index.ts
git commit -s -m "feat(overlays): add overlay index with exports"
```

---

## Task 7: Refactor main.ts to Use Overlay System

**Files:**
- Modify: `src/main.ts`

This is the largest task - we'll remove overlay-specific code and use the registry.

**Step 1: Add imports and setup at top of main.ts**

After line 11 (the imports), add:

```typescript
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  divineNamesOverlay,
  commentaryOverlay,
  setCommentaryVerses,
  type Overlay,
} from './overlays/index.ts';
```

**Step 2: Remove old heatmapColor function**

Delete lines 29-55 (the `heatmapColor` function) - now in utils/color.ts.

**Step 3: Remove old getCommentaryCount function**

Delete lines 57-68 (the `getCommentaryCount` function) - now in commentary overlay.

**Step 4: Replace overlay state variables**

Find around line 133-147 and replace:

```typescript
// Current overlay state
let currentOverlay = 'none';
let currentCategory = 'total';
```

With:

```typescript
// Current overlay state
let currentOverlayId = 'none';
let currentOverlay: Overlay | null = null;
```

**Step 5: Remove DIVINE_NAME_COLORS constant**

Delete the DIVINE_NAME_COLORS object (was around lines 143-147).

**Step 6: Rewrite applyOverlay function**

Replace the entire `applyOverlay` function with:

```typescript
// Seeded random for consistent gray variation
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Function to apply overlay colors
function applyOverlay(): void {
  verses.forEach((v, i) => {
    const color = currentOverlay?.getVerseColor(v) ?? null;
    if (color) {
      v.color = color;
    } else {
      const brightness = 0.4 + seededRandom(i * 3) * 0.4;
      v.color = [brightness, brightness, brightness];
    }
  });

  // Rebuild geometry buffer
  const geometry = buildVerseGeometry(verses, [0.6, 0.6, 0.6], hasActiveSearch);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
}
```

**Step 7: Remove DIVINE_NAME_LABELS constant**

Delete the DIVINE_NAME_LABELS object (was around lines 347-352).

**Step 8: Rewrite hover info logic**

Find the mousemove handler that updates hoverInfo (around line 414-443) and replace the overlay-specific section with:

```typescript
if (verse) {
  let info = `${verse.book} ${verse.chapter}:${verse.verse}`;
  const overlayInfo = currentOverlay?.getHoverInfo?.(verse);
  if (overlayInfo) {
    info += ` (${overlayInfo})`;
  }
  hoverInfo.textContent = info;
} else {
  hoverInfo.textContent = '';
}
```

**Step 9: Add overlay initialization and registration**

After `buildSearchIndex(verseTexts);` (around line 112), add:

```typescript
// Register and initialize overlays
registerOverlay(divineNamesOverlay);
registerOverlay(commentaryOverlay);
setCommentaryVerses(verses);

await Promise.all(getAllOverlays().map(o => o.init?.()));
```

**Step 10: Add overlay switching function**

Before the overlay select event listener, add:

```typescript
// Overlay controls container (will be populated by overlays)
const overlayControlsContainer = document.getElementById('overlay-controls');
const overlayLegendContainer = document.getElementById('overlay-legend');

function setOverlay(id: string): void {
  currentOverlay?.destroy?.();
  currentOverlayId = id;
  currentOverlay = getOverlay(id) ?? null;

  // Wire up update callback for dynamic overlays
  currentOverlay?.onUpdate?.(() => {
    applyOverlay();
    render();
  });

  // Clear and render overlay's UI
  if (overlayControlsContainer) {
    overlayControlsContainer.innerHTML = '';
    currentOverlay?.renderControls?.(overlayControlsContainer);
  }
  if (overlayLegendContainer) {
    overlayLegendContainer.innerHTML = '';
    currentOverlay?.renderLegend?.(overlayLegendContainer);
  }

  applyOverlay();
  render();
}
```

**Step 11: Simplify overlay select handler**

Replace the overlay select event listener with:

```typescript
overlaySelect?.addEventListener('change', () => {
  setOverlay(overlaySelect.value);
});
```

**Step 12: Remove category select handler and old UI visibility logic**

Delete:
- The categorySelect event listener
- The commentaryControls, legend, divineNamesLegend visibility toggling code
- The const declarations for categorySelect, commentaryControls, legend, divineNamesLegend

**Step 13: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 14: Test manually in browser**

Run: `npm run dev`
Expected:
- Overlay dropdown works
- Divine names overlay shows colors and legend
- Commentary overlay shows heatmap, controls, and legend
- Hover info shows overlay-specific details

**Step 15: Commit**

```bash
git add src/main.ts
git commit -s -m "refactor: integrate overlay module system into main.ts"
```

---

## Task 8: Update HTML to Support Dynamic Controls

**Files:**
- Modify: `index.html`

**Step 1: Simplify overlay controls section**

Find the overlay controls HTML and replace the hardcoded legend/controls with generic containers:

```html
<div id="overlay-controls"></div>
<div id="overlay-legend"></div>
```

Remove:
- The hardcoded `#commentary-controls` div
- The hardcoded `#legend` div with gradient
- The hardcoded `#divine-names-legend` div

**Step 2: Test in browser**

Run: `npm run dev`
Expected: Overlays still work, controls/legends render dynamically

**Step 3: Commit**

```bash
git add index.html
git commit -s -m "refactor: simplify HTML for dynamic overlay controls"
```

---

## Task 9: Clean Up Unused Code

**Files:**
- Modify: `src/main.ts`

**Step 1: Remove any remaining dead code**

Search for and remove:
- Any unused imports
- Any commented-out overlay code
- Any orphaned helper functions

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no warnings

**Step 3: Test full functionality**

Run: `npm run dev`
Test:
- [ ] "None" overlay shows gray variation
- [ ] Divine Names overlay shows colors, legend, hover info
- [ ] Commentary overlay shows heatmap, category dropdown, legend, hover info
- [ ] Switching overlays clears previous controls/legend
- [ ] Search highlighting still works with overlays

**Step 4: Commit**

```bash
git add -A
git commit -s -m "chore: clean up unused overlay code"
```

---

## Task 10: Final Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors

**Step 2: Verify file structure**

Expected structure:
```
src/
├── main.ts                 # Slimmed down, ~100 fewer lines
├── types.ts                # Unchanged
├── overlays/
│   ├── types.ts            # Overlay interface
│   ├── registry.ts         # Registration functions
│   ├── divine-names.ts     # Divine names module
│   ├── commentary.ts       # Commentary module
│   └── index.ts            # Exports
└── utils/
    └── color.ts            # Heatmap color function
```

**Step 3: Manual testing checklist**

- [ ] Load app, verify no console errors
- [ ] Select "Divine Names" - verify colors, legend
- [ ] Hover verses - verify divine name labels
- [ ] Select "Commentary" - verify heatmap, controls
- [ ] Change category - verify colors update
- [ ] Hover verses - verify commentary counts
- [ ] Select "None" - verify gray, no legend/controls
- [ ] Search - verify highlighting works with each overlay

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -s -m "chore: final cleanup for overlay modules"
```

---

## Summary

After completing all tasks:

1. **Overlay interface** in `src/overlays/types.ts`
2. **Registry** in `src/overlays/registry.ts`
3. **Divine names overlay** in `src/overlays/divine-names.ts`
4. **Commentary overlay** in `src/overlays/commentary.ts`
5. **Color utilities** in `src/utils/color.ts`
6. **Main.ts** refactored to use registry, no overlay-specific logic
7. **HTML** simplified to use dynamic containers

Adding new overlays now requires:
1. Create `src/overlays/my-overlay.ts` implementing `Overlay`
2. Add export to `src/overlays/index.ts`
3. Add `registerOverlay(myOverlay)` in main.ts
4. Add `<option value="my-overlay">My Overlay</option>` to HTML dropdown
