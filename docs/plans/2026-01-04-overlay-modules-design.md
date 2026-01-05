# Overlay Module System Design

## Problem

The current overlay implementation in `main.ts` has:
- A monolithic `applyOverlay()` function with large if/else branches
- Overlay-aware logic scattered across multiple places (color application, UI visibility, hover info, sidebar)
- Direct mutation of verse color properties
- No plugin system - adding new overlays requires modifying multiple places

## Goals

1. **Extensibility** - Easy to add new overlay types without touching core code
2. **Maintainability** - Each overlay's logic is self-contained
3. **Clarity** - Architecture reflects conceptual separation

## Design

### Overlay Interface

Each overlay implements this interface:

```typescript
// src/overlays/types.ts
export type Color = [number, number, number];

export interface Overlay {
  id: string;
  name: string;

  // Lifecycle
  init?(): Promise<void>;
  destroy?(): void;

  // Core - called for each verse during applyOverlay
  getVerseColor(verse: Verse): Color | null;  // null = use default gray

  // UI - called when overlay becomes active
  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  // Hover - called when user hovers a verse
  getHoverInfo?(verse: Verse): string | null;

  // For dynamic overlays - call this to trigger re-render
  onUpdate?: (callback: () => void) => void;
}
```

### Registry

Simple registry to manage overlays:

```typescript
// src/overlays/registry.ts
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

### Example: Divine Names Overlay

Static overlay with legend, no controls:

```typescript
// src/overlays/divine-names.ts
import type { Overlay, Color } from './types';
import type { Verse } from '../types';

const COLORS: Record<number, Color> = {
  1: [0.2, 0.4, 0.8],   // YHWH - blue
  2: [0.8, 0.2, 0.3],   // Elohim - red
  3: [0.6, 0.2, 0.6],   // Both - purple
};

let data: Record<string, number[][]> = {};

export const divineNamesOverlay: Overlay = {
  id: 'divine-names',
  name: 'Divine Names',

  async init() {
    const res = await fetch('/data/divine-names.json');
    data = await res.json();
  },

  getVerseColor(verse: Verse): Color | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1];
    return code ? COLORS[code] ?? null : null;
  },

  renderLegend(container: HTMLElement) {
    container.innerHTML = `
      <div class="legend-item"><span style="background: rgb(51,102,204)"></span> YHWH</div>
      <div class="legend-item"><span style="background: rgb(204,51,77)"></span> Elohim</div>
      <div class="legend-item"><span style="background: rgb(153,51,153)"></span> Both</div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1];
    if (!code) return null;
    const names = { 1: 'YHWH', 2: 'Elohim', 3: 'YHWH + Elohim' };
    return names[code] ?? null;
  },
};
```

### Example: Commentary Overlay (with controls)

Dynamic overlay with category dropdown:

```typescript
// src/overlays/commentary.ts
import type { Overlay, Color } from './types';
import type { Verse } from '../types';
import { interpolateHeatmap } from '../utils/color';

type CommentaryData = Record<string, Record<number, Record<number, { total: number; [cat: string]: number }>>>;

let data: CommentaryData = {};
let currentCategory = 'total';
let updateCallback: (() => void) | null = null;

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
    const count = data[verse.book]?.[verse.chapter]?.[verse.verse]?.[currentCategory] ?? 0;
    if (count === 0) return null;
    return interpolateHeatmap(count / 100);  // simplified
  },

  renderControls(container: HTMLElement) {
    const select = document.createElement('select');
    select.innerHTML = `
      <option value="total">All Commentary</option>
      <option value="rashi">Rashi</option>
      <option value="ramban">Ramban</option>
    `;
    select.value = currentCategory;
    select.addEventListener('change', () => {
      currentCategory = select.value;
      updateCallback?.();
    });
    container.appendChild(select);
  },

  renderLegend(container: HTMLElement) {
    container.innerHTML = `<div class="heatmap-scale">0 — 100+</div>`;
  },

  getHoverInfo(verse: Verse): string | null {
    const counts = data[verse.book]?.[verse.chapter]?.[verse.verse];
    if (!counts) return null;
    return `${counts.total} commentaries`;
  },
};
```

### Main App Integration

```typescript
// src/main.ts (relevant parts)
import { registerOverlay, getOverlay, getAllOverlays } from './overlays/registry';
import { divineNamesOverlay } from './overlays/divine-names';
import { commentaryOverlay } from './overlays/commentary';

let currentOverlayId = 'none';
let currentOverlay: Overlay | null = null;

// Register overlays
registerOverlay(divineNamesOverlay);
registerOverlay(commentaryOverlay);

// Initialize all overlays at startup
async function initOverlays(): Promise<void> {
  await Promise.all(
    getAllOverlays().map(o => o.init?.())
  );
}

// Populate dropdown from registry
function populateOverlaySelect(select: HTMLSelectElement): void {
  select.innerHTML = '<option value="none">None</option>';
  for (const overlay of getAllOverlays()) {
    select.innerHTML += `<option value="${overlay.id}">${overlay.name}</option>`;
  }
}

// Switch overlay
function setOverlay(id: string): void {
  currentOverlay?.destroy?.();
  currentOverlayId = id;
  currentOverlay = getOverlay(id) ?? null;

  currentOverlay?.onUpdate?.(() => {
    applyOverlay();
    render();
  });

  const controlsContainer = document.getElementById('overlay-controls')!;
  const legendContainer = document.getElementById('overlay-legend')!;
  controlsContainer.innerHTML = '';
  legendContainer.innerHTML = '';

  currentOverlay?.renderControls?.(controlsContainer);
  currentOverlay?.renderLegend?.(legendContainer);

  applyOverlay();
  render();
}

// Simplified applyOverlay - no more if/else branches
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
  rebuildGeometry();
}
```

## File Structure

```
src/
├── main.ts                    # Slimmed down, orchestration only
├── types.ts                   # Shared types (Verse, etc.)
├── overlays/
│   ├── types.ts               # Overlay interface, Color type
│   ├── registry.ts            # registerOverlay, getOverlay, getAllOverlays
│   ├── divine-names.ts        # Divine names overlay
│   ├── commentary.ts          # Commentary overlay
│   └── index.ts               # Exports + registers all overlays
└── utils/
    └── color.ts               # Shared color utilities (heatmap, etc.)
```

## Migration Path

1. Create `src/overlays/types.ts` and `registry.ts`
2. Extract divine-names overlay (simpler, no controls)
3. Extract commentary overlay (has controls)
4. Refactor `main.ts` to use the registry
5. Update hover info to use `currentOverlay.getHoverInfo()`
6. Clean up unused code from main.ts

Each step keeps the app working - no big-bang rewrite.

## Decisions

- **"None" overlay**: Special-cased in main.ts as absence of overlay, not a module
- **No framework**: Vanilla TS with imperative DOM; easy to add React later if needed
- **Dynamic overlays**: Use `onUpdate` callback pattern for overlays that need to trigger re-renders
