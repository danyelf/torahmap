# Scrollytelling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a scroll-driven narrative panel that smoothly transitions the Tanakh map between camera positions and overlay states as the user reads through a guided story.

**Architecture:** A `ScrollytellingController` watches scroll position in a right-side panel and interpolates camera + colors between story stops defined in JSON. The right panel always exists — showing story text or explore controls. Verse details move to a bottom-left popup. Zoom +/- buttons float bottom-right on the canvas.

**Tech Stack:** TypeScript, WebGL 2, Vite, no runtime dependencies (keeping existing stack)

**Design doc:** `docs/plans/2026-03-25-scrollytelling-design.md`

---

### Task 1: Story Data Types and Sample Data

Define the TypeScript interfaces for story stops and create a sample story JSON.

**Files:**
- Create: `src/scrollytelling/types.ts`
- Create: `public/data/story.json`

**Step 1: Create story types**

```typescript
// src/scrollytelling/types.ts

export interface StoryStop {
  id: string;
  title: string;
  text: string;
  camera: { x: number; y: number; zoom: number };
  overlay: string | null;
  overlayParams?: Record<string, string>;
  easing?: EasingName;
}

export interface StoryData {
  stops: StoryStop[];
  defaults?: {
    easing?: EasingName;
  };
}

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface InterpolatedState {
  camera: { x: number; y: number; zoom: number };
  fromStop: StoryStop;
  toStop: StoryStop;
  t: number; // 0-1 raw progress between stops
}
```

**Step 2: Create sample story data**

Create `public/data/story.json` with 3-4 stops that exercise different overlays:

```json
{
  "stops": [
    {
      "id": "intro",
      "title": "The Torah Map",
      "text": "Every verse of the Tanakh — the Hebrew Bible's 23,000+ verses — is laid out here as a colored square. Torah on the right, Prophets in the middle, Writings on the left. Scroll down to explore.",
      "camera": { "x": 0, "y": 0, "zoom": 1.0 },
      "overlay": null
    },
    {
      "id": "abraham",
      "title": "Abraham's Journey",
      "text": "Abraham first appears in Genesis 12. Watch how his name lights up across the Torah — and then echoes through the Prophets and Writings.",
      "camera": { "x": 120, "y": 30, "zoom": 3.0 },
      "overlay": "search",
      "overlayParams": { "q": "אברהם" }
    },
    {
      "id": "haftarah",
      "title": "The Haftarah Portions",
      "text": "Each week's Torah reading is paired with a passage from the Prophets. These pairings — the Haftarah — connect the Torah to the rest of the Bible.",
      "camera": { "x": 0, "y": 0, "zoom": 1.0 },
      "overlay": "haftarah"
    }
  ],
  "defaults": {
    "easing": "ease-in-out"
  }
}
```

**Step 3: Commit**

```bash
git add src/scrollytelling/types.ts public/data/story.json
git commit -m "feat: add scrollytelling types and sample story data"
```

---

### Task 2: Easing and Interpolation Utilities

Pure functions for easing and lerping — easy to test.

**Files:**
- Create: `src/scrollytelling/interpolation.ts`
- Create: `src/scrollytelling/__tests__/interpolation.test.ts`

**Step 1: Write failing tests**

```typescript
// src/scrollytelling/__tests__/interpolation.test.ts
import { describe, it, expect } from 'vitest';
import { easingFunctions, lerpCamera, lerpColor } from '../interpolation';

describe('easing functions', () => {
  it('linear is identity', () => {
    expect(easingFunctions.linear(0)).toBe(0);
    expect(easingFunctions.linear(0.5)).toBe(0.5);
    expect(easingFunctions.linear(1)).toBe(1);
  });

  it('ease-in-out is 0 at 0 and 1 at 1', () => {
    expect(easingFunctions['ease-in-out'](0)).toBe(0);
    expect(easingFunctions['ease-in-out'](1)).toBe(1);
  });

  it('ease-in-out is 0.5 at 0.5', () => {
    expect(easingFunctions['ease-in-out'](0.5)).toBe(0.5);
  });

  it('ease-in starts slow', () => {
    expect(easingFunctions['ease-in'](0.25)).toBeLessThan(0.25);
  });

  it('ease-out starts fast', () => {
    expect(easingFunctions['ease-out'](0.25)).toBeGreaterThan(0.25);
  });
});

describe('lerpCamera', () => {
  it('returns from at t=0', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 0)).toEqual(from);
  });

  it('returns to at t=1', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 1)).toEqual(to);
  });

  it('interpolates at t=0.5', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 0.5)).toEqual({ x: 50, y: 25, zoom: 2 });
  });
});

describe('lerpColor', () => {
  it('blends two colors at t=0.5', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 1, g: 1, b: 1 };
    const result = lerpColor(a, b, 0.5);
    expect(result.r).toBeCloseTo(0.5);
    expect(result.g).toBeCloseTo(0.5);
    expect(result.b).toBeCloseTo(0.5);
  });

  it('returns first color at t=0', () => {
    const a = { r: 0.2, g: 0.4, b: 0.6 };
    const b = { r: 0.8, g: 0.6, b: 0.4 };
    expect(lerpColor(a, b, 0)).toEqual(a);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/scrollytelling/__tests__/interpolation.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement interpolation utilities**

```typescript
// src/scrollytelling/interpolation.ts
import type { EasingName } from './types';

type Color = { r: number; g: number; b: number };

export const easingFunctions: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => t * (2 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

export function lerpCamera(
  from: { x: number; y: number; zoom: number },
  to: { x: number; y: number; zoom: number },
  t: number
): { x: number; y: number; zoom: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

export function lerpColor(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/scrollytelling/__tests__/interpolation.test.ts
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/scrollytelling/interpolation.ts src/scrollytelling/__tests__/interpolation.test.ts
git commit -m "feat: add easing and interpolation utilities with tests"
```

---

### Task 3: ScrollytellingController Core Logic

The controller that maps scroll position to interpolated state. Pure logic, no DOM.

**Files:**
- Create: `src/scrollytelling/controller.ts`
- Create: `src/scrollytelling/__tests__/controller.test.ts`

**Step 1: Write failing tests**

```typescript
// src/scrollytelling/__tests__/controller.test.ts
import { describe, it, expect } from 'vitest';
import { computeInterpolatedState } from '../controller';
import type { StoryStop } from '../types';

const stops: StoryStop[] = [
  { id: 'a', title: 'A', text: 'First', camera: { x: 0, y: 0, zoom: 1 }, overlay: null },
  { id: 'b', title: 'B', text: 'Second', camera: { x: 100, y: 50, zoom: 3 }, overlay: 'search', overlayParams: { q: 'test' } },
  { id: 'c', title: 'C', text: 'Third', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
];

// stopOffsets: cumulative top positions of each stop's text block
// e.g., [0, 500, 1000] means stop 0 starts at 0, stop 1 at 500, stop 2 at 1000
// total scrollable height = 1500

describe('computeInterpolatedState', () => {
  const offsets = [0, 500, 1000];
  const totalHeight = 1500;

  it('returns first stop state at scroll=0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, 0);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[0]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('returns last stop state at scroll=totalHeight', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, totalHeight);
    expect(state.fromStop).toBe(stops[2]);
    expect(state.toStop).toBe(stops[2]);
    expect(state.t).toBe(0);
  });

  it('interpolates between stops at midpoint', () => {
    // scrollTop=250 is halfway between stop 0 (offset 0) and stop 1 (offset 500)
    const state = computeInterpolatedState(stops, offsets, totalHeight, 250);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBeCloseTo(0.5);
    expect(state.camera.x).toBeCloseTo(50);
  });

  it('clamps scroll below 0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, -100);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.t).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/scrollytelling/__tests__/controller.test.ts
```

**Step 3: Implement controller**

```typescript
// src/scrollytelling/controller.ts
import type { StoryStop, StoryData, InterpolatedState, EasingName } from './types';
import { lerpCamera, easingFunctions } from './interpolation';

export function computeInterpolatedState(
  stops: StoryStop[],
  stopOffsets: number[],
  totalHeight: number,
  scrollTop: number,
  defaultEasing: EasingName = 'ease-in-out'
): InterpolatedState {
  const clampedScroll = Math.max(0, Math.min(scrollTop, totalHeight));

  // Find which two stops we're between
  let fromIndex = 0;
  for (let i = stopOffsets.length - 1; i >= 0; i--) {
    if (clampedScroll >= stopOffsets[i]) {
      fromIndex = i;
      break;
    }
  }

  const toIndex = Math.min(fromIndex + 1, stops.length - 1);

  if (fromIndex === toIndex) {
    // At or past the last stop
    return {
      camera: { ...stops[fromIndex].camera },
      fromStop: stops[fromIndex],
      toStop: stops[fromIndex],
      t: 0,
    };
  }

  const segmentStart = stopOffsets[fromIndex];
  const segmentEnd = stopOffsets[toIndex];
  const rawT = (clampedScroll - segmentStart) / (segmentEnd - segmentStart);

  const easingName = stops[toIndex].easing ?? defaultEasing;
  const easeFn = easingFunctions[easingName] ?? easingFunctions['ease-in-out'];
  const t = easeFn(rawT);

  return {
    camera: lerpCamera(stops[fromIndex].camera, stops[toIndex].camera, t),
    fromStop: stops[fromIndex],
    toStop: stops[toIndex],
    t,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/scrollytelling/__tests__/controller.test.ts
```

**Step 5: Commit**

```bash
git add src/scrollytelling/controller.ts src/scrollytelling/__tests__/controller.test.ts
git commit -m "feat: add ScrollytellingController core interpolation logic"
```

---

### Task 4: Color Blending for Overlay Crossfade

Add a function that blends two color arrays (one per verse) by a factor `t`. This enables smooth crossfading between overlays.

**Files:**
- Create: `src/scrollytelling/colorBlending.ts`
- Create: `src/scrollytelling/__tests__/colorBlending.test.ts`

**Step 1: Write failing tests**

```typescript
// src/scrollytelling/__tests__/colorBlending.test.ts
import { describe, it, expect } from 'vitest';
import { blendColorArrays } from '../colorBlending';

describe('blendColorArrays', () => {
  it('returns fromColors at t=0', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0);
    expect(result[0]).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('returns toColors at t=1', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 1);
    expect(result[0]).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('blends at t=0.5', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0.5);
    expect(result[0].r).toBeCloseTo(0.5);
    expect(result[0].g).toBeCloseTo(0.5);
  });

  it('handles multi-color arrays (Color[])', () => {
    const from = [[{ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }]];
    const to = [{ r: 0, g: 1, b: 0 }];
    // When blending multi-color with single-color, flatten to single blended color
    const result = blendColorArrays(from, to, 0.5);
    expect(result).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/scrollytelling/__tests__/colorBlending.test.ts
```

**Step 3: Implement color blending**

```typescript
// src/scrollytelling/colorBlending.ts
import { lerpColor } from './interpolation';

type Color = { r: number; g: number; b: number };

/**
 * Average a multi-color value down to a single color.
 * Handles both Color and Color[] inputs.
 */
function toSingleColor(c: Color | Color[]): Color {
  if (!Array.isArray(c)) return c;
  if (c.length === 0) return { r: 0, g: 0, b: 0 };
  if (c.length === 1) return c[0];
  const sum = c.reduce(
    (acc, color) => ({ r: acc.r + color.r, g: acc.g + color.g, b: acc.b + color.b }),
    { r: 0, g: 0, b: 0 }
  );
  return { r: sum.r / c.length, g: sum.g / c.length, b: sum.b / c.length };
}

/**
 * Blend two parallel color arrays by factor t.
 * Each element can be a Color or Color[].
 * Returns single Colors for crossfade rendering.
 */
export function blendColorArrays(
  from: (Color | Color[])[],
  to: (Color | Color[])[],
  t: number
): Color[] {
  const len = Math.max(from.length, to.length);
  const result: Color[] = new Array(len);
  const defaultColor: Color = { r: 0.15, g: 0.15, b: 0.15 }; // default gray

  for (let i = 0; i < len; i++) {
    const a = i < from.length ? toSingleColor(from[i]) : defaultColor;
    const b = i < to.length ? toSingleColor(to[i]) : defaultColor;
    result[i] = lerpColor(a, b, t);
  }

  return result;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/scrollytelling/__tests__/colorBlending.test.ts
```

**Step 5: Commit**

```bash
git add src/scrollytelling/colorBlending.ts src/scrollytelling/__tests__/colorBlending.test.ts
git commit -m "feat: add color blending for overlay crossfade"
```

---

### Task 5: Global Search Term Color Assignment

For scrollytelling, search terms need globally stable colors across all stops.

**Files:**
- Create: `src/scrollytelling/searchColors.ts`
- Create: `src/scrollytelling/__tests__/searchColors.test.ts`

**Step 1: Write failing tests**

```typescript
// src/scrollytelling/__tests__/searchColors.test.ts
import { describe, it, expect } from 'vitest';
import { assignGlobalSearchColors } from '../searchColors';
import type { StoryStop } from '../types';

describe('assignGlobalSearchColors', () => {
  it('assigns unique colors to each search term', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם' } },
      { id: 'b', title: 'B', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'משה' } },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.get('אברהם')).toBeDefined();
    expect(colors.get('משה')).toBeDefined();
    expect(colors.get('אברהם')).not.toEqual(colors.get('משה'));
  });

  it('same term in multiple stops gets same color', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם' } },
      { id: 'b', title: 'B', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם,משה' } },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.get('אברהם')).toBeDefined();
    expect(colors.get('משה')).toBeDefined();
  });

  it('ignores non-search stops', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.size).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/scrollytelling/__tests__/searchColors.test.ts
```

**Step 3: Implement global search color assignment**

Look at the existing search overlay to find the color palette it uses (likely in `src/overlays/search.ts`), then reference those same colors.

```typescript
// src/scrollytelling/searchColors.ts
import type { StoryStop } from './types';

type Color = { r: number; g: number; b: number };

// Same palette as the search overlay, extended
const SEARCH_PALETTE: Color[] = [
  { r: 0, g: 0.9, b: 0.9 },     // cyan/teal
  { r: 1, g: 0.6, b: 0 },       // orange
  { r: 0, g: 0.9, b: 0.4 },     // green
  { r: 0.9, g: 0.2, b: 0.9 },   // magenta
  { r: 1, g: 0.9, b: 0 },       // yellow
  { r: 0.4, g: 0.6, b: 1 },     // blue
  { r: 1, g: 0.4, b: 0.4 },     // red
  { r: 0.6, g: 1, b: 0.6 },     // light green
];

/**
 * Collect all unique search terms across story stops
 * and assign each a stable color from the palette.
 */
export function assignGlobalSearchColors(stops: StoryStop[]): Map<string, Color> {
  const terms = new Set<string>();

  for (const stop of stops) {
    if (stop.overlay === 'search' && stop.overlayParams?.q) {
      // Search queries can be comma-separated multi-term
      for (const term of stop.overlayParams.q.split(',')) {
        const trimmed = term.trim();
        if (trimmed) terms.add(trimmed);
      }
    }
  }

  const colorMap = new Map<string, Color>();
  let i = 0;
  for (const term of terms) {
    colorMap.set(term, SEARCH_PALETTE[i % SEARCH_PALETTE.length]);
    i++;
  }

  return colorMap;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/scrollytelling/__tests__/searchColors.test.ts
```

**Step 5: Commit**

```bash
git add src/scrollytelling/searchColors.ts src/scrollytelling/__tests__/searchColors.test.ts
git commit -m "feat: add global search term color assignment for scrollytelling"
```

---

### Task 6: Zoom Buttons

Add +/- zoom buttons floating bottom-right of the canvas.

**Files:**
- Modify: `index.html` (add zoom button markup)
- Create: `src/styles/zoom-buttons.css`
- Modify: `src/main.ts` (wire up button click handlers)

**Step 1: Add HTML markup**

Add after the `<canvas>` element in `index.html`:

```html
<div id="zoom-controls">
  <button id="zoom-in" aria-label="Zoom in">+</button>
  <button id="zoom-out" aria-label="Zoom out">&minus;</button>
</div>
```

**Step 2: Create CSS**

```css
/* src/styles/zoom-buttons.css */
#zoom-controls {
  position: fixed;
  bottom: 20px;
  right: 420px; /* panel width + gap */
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
}

#zoom-controls button {
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #ccc;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#zoom-controls button:hover {
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
}

#zoom-controls button:first-child {
  border-radius: 4px 4px 0 0;
}

#zoom-controls button:last-child {
  border-radius: 0 0 4px 4px;
}

@media (max-width: 768px) {
  #zoom-controls {
    right: 16px;
    bottom: 60px; /* above bottom sheet */
  }
}
```

**Step 3: Wire up event handlers in main.ts**

Add after the existing canvas event handlers (~line 290 in main.ts):

```typescript
// Zoom buttons
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');

zoomInBtn?.addEventListener('click', () => {
  const centerX = canvas.clientWidth / 2;
  const centerY = canvas.clientHeight / 2;
  const newZoom = clampZoom(camera.zoom * 1.1);
  const newPan = panForZoom(
    { x: camera.x, y: camera.y },
    camera.zoom,
    newZoom,
    centerX,
    centerY
  );
  camera.x = newPan.x;
  camera.y = newPan.y;
  camera.zoom = newZoom;
  render();
  debouncedSaveUrlState();
});

zoomOutBtn?.addEventListener('click', () => {
  const centerX = canvas.clientWidth / 2;
  const centerY = canvas.clientHeight / 2;
  const newZoom = clampZoom(camera.zoom * 0.9);
  const newPan = panForZoom(
    { x: camera.x, y: camera.y },
    camera.zoom,
    newZoom,
    centerX,
    centerY
  );
  camera.x = newPan.x;
  camera.y = newPan.y;
  camera.zoom = newZoom;
  render();
  debouncedSaveUrlState();
});
```

**Step 4: Import the CSS**

Add to `src/main.ts` imports (alongside existing CSS imports):

```typescript
import './styles/zoom-buttons.css';
```

**Step 5: Test manually**

Start the dev server, verify +/- buttons appear bottom-right and zoom in/out.

**Step 6: Commit**

```bash
git add index.html src/styles/zoom-buttons.css src/main.ts
git commit -m "feat: add zoom +/- buttons on canvas"
```

---

### Task 7: Layout Restructure — Right Panel and Verse Popup

This is the biggest layout change. Move from floating panels to a persistent right panel + bottom-left verse popup.

**Files:**
- Modify: `index.html` (restructure DOM)
- Modify: `src/styles/main.css` (new layout)
- Create: `src/styles/right-panel.css`
- Create: `src/styles/verse-popup.css`
- Modify: `src/sidebar.ts` (update DOM queries to find new elements)
- Modify: `src/main.ts` (update references)

**Step 1: Restructure index.html**

Replace the current `#controls` and `#verse-sidebar` with:

```html
<!-- Canvas fills left side -->
<canvas id="canvas" style="touch-action: none"></canvas>

<!-- Zoom buttons on canvas -->
<div id="zoom-controls">
  <button id="zoom-in" aria-label="Zoom in">+</button>
  <button id="zoom-out" aria-label="Zoom out">&minus;</button>
</div>

<!-- Verse popup - bottom left of canvas -->
<div id="verse-popup">
  <div class="verse-ref">
    <span class="ref-text"></span>
    <span class="close-btn">&times;</span>
  </div>
  <div class="overlay-info"></div>
  <div class="verse-hebrew"></div>
  <div class="verse-english"></div>
  <a class="sefaria-link" target="_blank" rel="noopener">
    View on Sefaria
    <span class="link-subtitle"></span>
  </a>
</div>

<!-- Right panel -->
<div id="right-panel">
  <!-- Story mode content -->
  <div id="story-panel">
    <div class="story-header">
      <button id="exit-story">Explore freely</button>
    </div>
    <div id="story-content">
      <!-- Filled dynamically from story.json -->
    </div>
  </div>

  <!-- Explore mode content -->
  <div id="explore-panel" style="display: none;">
    <div class="explore-header">
      <label>Overlay</label>
      <select id="overlay-select">
        <option value="none">None</option>
        <option value="search">Text Search</option>
        <option value="commentary">Commentary</option>
        <option value="trop">Trop</option>
        <option value="haftarah">Haftarah</option>
        <option value="text-dating">Text Dating</option>
        <option value="verse-length">Verse Length</option>
      </select>
    </div>
    <div id="overlay-controls"></div>
    <div id="overlay-legend"></div>
    <div class="explore-footer">
      <a href="#" id="back-to-story">Back to story</a>
    </div>
  </div>
</div>
```

**Step 2: Create right-panel.css**

```css
/* src/styles/right-panel.css */
#right-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.92);
  z-index: 10;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

#story-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.story-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

#exit-story {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #aaa;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

#exit-story:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
}

#story-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.story-stop {
  padding: 40px 24px;
  min-height: 60vh;
}

.story-stop:first-child {
  padding-top: 24px;
}

.story-stop h2 {
  color: #fff;
  font-size: 20px;
  margin: 0 0 16px 0;
  font-weight: 500;
}

.story-stop p {
  color: #ccc;
  font-size: 15px;
  line-height: 1.7;
  margin: 0;
}

/* Explore mode */
#explore-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px;
}

.explore-header {
  margin-bottom: 16px;
}

.explore-footer {
  margin-top: auto;
  padding: 16px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

#back-to-story {
  color: #7ab;
  text-decoration: none;
  font-size: 14px;
}

#back-to-story:hover {
  color: #9cd;
  text-decoration: underline;
}

/* Canvas sizing to accommodate panel */
#canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: calc(100vw - 380px);
  height: 100vh;
}

@media (max-width: 768px) {
  #right-panel {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 50vh;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px 16px 0 0;
  }

  #canvas {
    width: 100vw;
    height: 50vh;
  }
}
```

**Step 3: Create verse-popup.css**

```css
/* src/styles/verse-popup.css */
#verse-popup {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
  z-index: 15;
  display: none;
}

#verse-popup.visible {
  display: block;
}

#verse-popup.pinned {
  border-color: #4a9eff;
}

/* Reuse existing sidebar internal styles for verse content */
#verse-popup .verse-ref {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

#verse-popup .close-btn {
  display: none;
  cursor: pointer;
  color: #888;
  font-size: 18px;
}

#verse-popup.pinned .close-btn {
  display: inline;
}

#verse-popup .verse-hebrew {
  direction: rtl;
  text-align: right;
  font-family: 'SBL Hebrew', 'Ezra SIL', serif;
  font-size: 16px;
  line-height: 1.8;
  color: #e0e0e0;
  margin: 8px 0;
}

#verse-popup .verse-english {
  font-size: 14px;
  line-height: 1.6;
  color: #bbb;
  margin: 8px 0;
}

#verse-popup .sefaria-link {
  display: block;
  color: #7ab;
  text-decoration: none;
  font-size: 13px;
  margin-top: 8px;
}

#verse-popup .overlay-info {
  background: rgba(74, 158, 255, 0.1);
  border-radius: 4px;
  padding: 8px;
  margin: 8px 0;
  font-size: 13px;
  color: #8cf;
}

#verse-popup .overlay-info:empty {
  display: none;
}

@media (max-width: 768px) {
  #verse-popup {
    left: 10px;
    bottom: calc(50vh + 10px);
    width: calc(100vw - 20px);
    max-height: 200px;
  }
}
```

**Step 4: Update sidebar.ts DOM queries**

Change `getSidebarElements()` to query `#verse-popup` instead of `#verse-sidebar`:

```typescript
// In getSidebarElements():
// Change: document.getElementById('verse-sidebar')
// To: document.getElementById('verse-popup')
```

Also update the `visible` and `pinned` class toggling to use the new element.

**Step 5: Update main.ts CSS imports**

```typescript
import './styles/right-panel.css';
import './styles/verse-popup.css';
```

**Step 6: Remove old #controls and #verse-sidebar CSS**

Remove or comment out the old positioning rules in `main.css` for `#controls` and `#verse-sidebar`.

**Step 7: Update main.ts overlay selector reference**

The overlay `<select>` is now inside `#explore-panel` but keeps the same ID `#overlay-select`, so existing code should still find it.

**Step 8: Test manually**

Start dev server. Verify:
- Right panel visible on right side
- Canvas fills remaining width
- Verse popup appears bottom-left on hover/click
- Overlay selector works in explore panel
- Zoom buttons still work

**Step 9: Commit**

```bash
git add index.html src/styles/ src/sidebar.ts src/main.ts
git commit -m "feat: restructure layout with right panel and verse popup"
```

---

### Task 8: Story Panel Rendering

Load the story JSON and render text blocks into the story panel.

**Files:**
- Create: `src/scrollytelling/storyPanel.ts`
- Modify: `src/main.ts` (load story data, render panel)

**Step 1: Implement story panel renderer**

```typescript
// src/scrollytelling/storyPanel.ts
import type { StoryData, StoryStop } from './types';

export async function loadStoryData(): Promise<StoryData> {
  const response = await fetch('/data/story.json');
  return response.json();
}

export function renderStoryPanel(
  container: HTMLElement,
  stops: StoryStop[]
): HTMLElement[] {
  container.innerHTML = '';
  const stopElements: HTMLElement[] = [];

  for (const stop of stops) {
    const el = document.createElement('div');
    el.className = 'story-stop';
    el.dataset.stopId = stop.id;

    const title = document.createElement('h2');
    title.textContent = stop.title;
    el.appendChild(title);

    const text = document.createElement('p');
    text.textContent = stop.text;
    el.appendChild(text);

    container.appendChild(el);
    stopElements.push(el);
  }

  return stopElements;
}

/**
 * Compute the scroll offset for each stop element.
 * Returns array of offsets (top position of each stop relative to scroll container).
 */
export function computeStopOffsets(
  stopElements: HTMLElement[],
  scrollContainer: HTMLElement
): number[] {
  const containerTop = scrollContainer.scrollTop;
  return stopElements.map((el) => el.offsetTop);
}
```

**Step 2: Wire up in main.ts**

In the `main()` function, after overlay registration:

```typescript
import { loadStoryData, renderStoryPanel, computeStopOffsets } from './scrollytelling/storyPanel';
import { computeInterpolatedState } from './scrollytelling/controller';
import type { StoryData } from './scrollytelling/types';

// In main():
const storyData = await loadStoryData();
const storyContent = document.getElementById('story-content')!;
const stopElements = renderStoryPanel(storyContent, storyData.stops);

// Listen for scroll
storyContent.addEventListener('scroll', () => {
  const offsets = computeStopOffsets(stopElements, storyContent);
  const totalHeight = storyContent.scrollHeight;
  const state = computeInterpolatedState(
    storyData.stops,
    offsets,
    totalHeight,
    storyContent.scrollTop,
    storyData.defaults?.easing ?? 'ease-in-out'
  );

  // Apply interpolated camera
  camera.x = state.camera.x;
  camera.y = state.camera.y;
  camera.zoom = state.camera.zoom;

  // TODO: Apply interpolated colors (Task 9)
  render();
});
```

**Step 3: Test manually**

Start dev server. Scroll through the story panel. Camera should smoothly move between stops.

**Step 4: Commit**

```bash
git add src/scrollytelling/storyPanel.ts src/main.ts
git commit -m "feat: render story panel and wire up scroll-driven camera"
```

---

### Task 9: Scroll-Driven Overlay Crossfade

Wire the scroll interpolation to compute blended colors from two overlays.

**Files:**
- Create: `src/scrollytelling/overlayBlender.ts`
- Modify: `src/main.ts` (integrate overlay blending into scroll handler)

**Step 1: Create overlay blender**

This module computes the blended color array for a given interpolation state.

```typescript
// src/scrollytelling/overlayBlender.ts
import type { InterpolatedState, StoryStop } from './types';
import type { Overlay } from '../overlays/types';
import type { VerseLayout } from '../types';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../verseColoring';
import { blendColorArrays } from './colorBlending';

type Color = { r: number; g: number; b: number };

/**
 * Compute the blended color for each verse during a scroll transition.
 */
export function computeBlendedColors(
  state: InterpolatedState,
  verses: VerseLayout[],
  getColorsForStop: (stop: StoryStop, verses: VerseLayout[]) => (Color | Color[])[],
): (Color | Color[])[] {
  // If same stop on both sides (at rest), just return that stop's colors
  if (state.fromStop === state.toStop || state.t === 0) {
    return getColorsForStop(state.fromStop, verses);
  }
  if (state.t === 1) {
    return getColorsForStop(state.toStop, verses);
  }

  const fromColors = getColorsForStop(state.fromStop, verses);
  const toColors = getColorsForStop(state.toStop, verses);

  return blendColorArrays(fromColors, toColors, state.t);
}

/**
 * Get colors for a single stop by activating its overlay.
 */
export function getColorsForStop(
  stop: StoryStop,
  verses: VerseLayout[]
): (Color | Color[])[] {
  if (!stop.overlay) {
    return verses.map((_, i) => getDefaultColor(i));
  }

  const overlay = getOverlay(stop.overlay);
  if (!overlay) {
    return verses.map((_, i) => getDefaultColor(i));
  }

  // Apply overlay params if needed
  if (stop.overlayParams && overlay.applyUrlParams) {
    const params = new URLSearchParams(stop.overlayParams);
    overlay.applyUrlParams(params);
  }

  return verses.map((verse, i) => {
    const color = overlay.getVerseColor(verse);
    return color ?? getDefaultColor(i);
  });
}
```

**Step 2: Integrate into main.ts scroll handler**

Update the scroll handler from Task 8 to apply blended colors:

```typescript
storyContent.addEventListener('scroll', () => {
  const offsets = computeStopOffsets(stopElements, storyContent);
  const totalHeight = storyContent.scrollHeight;
  const state = computeInterpolatedState(
    storyData.stops,
    offsets,
    totalHeight,
    storyContent.scrollTop,
    storyData.defaults?.easing ?? 'ease-in-out'
  );

  // Apply interpolated camera
  camera.x = state.camera.x;
  camera.y = state.camera.y;
  camera.zoom = state.camera.zoom;

  // Apply interpolated colors
  const blendedColors = computeBlendedColors(state, verses, getColorsForStop);
  rebuildGeometry(renderContext.gl, renderState, blendedColors);
  render();
});
```

**Step 3: Test manually**

Scroll through story. Colors should smoothly crossfade between stops.

**Step 4: Commit**

```bash
git add src/scrollytelling/overlayBlender.ts src/main.ts
git commit -m "feat: wire up scroll-driven overlay color crossfade"
```

---

### Task 10: Mode Switching (Story ↔ Explore)

Wire up the "Exit story" and "Back to story" buttons.

**Files:**
- Create: `src/scrollytelling/modeSwitch.ts`
- Modify: `src/main.ts`

**Step 1: Implement mode switching**

```typescript
// src/scrollytelling/modeSwitch.ts
export type AppMode = 'story' | 'explore';

export interface ModeSwitchState {
  mode: AppMode;
  lastStoryScrollTop: number;
}

export function switchToExplore(
  storyPanel: HTMLElement,
  explorePanel: HTMLElement,
): void {
  storyPanel.style.display = 'none';
  explorePanel.style.display = 'flex';
}

export function switchToStory(
  storyPanel: HTMLElement,
  explorePanel: HTMLElement,
  storyContent: HTMLElement,
  lastScrollTop: number,
): void {
  explorePanel.style.display = 'none';
  storyPanel.style.display = 'flex';
  storyContent.scrollTop = lastScrollTop;
}
```

**Step 2: Wire up in main.ts**

```typescript
import { switchToExplore, switchToStory } from './scrollytelling/modeSwitch';
import type { AppMode } from './scrollytelling/modeSwitch';

// In main():
let appMode: AppMode = 'story';
let lastStoryScrollTop = 0;

const storyPanel = document.getElementById('story-panel')!;
const explorePanel = document.getElementById('explore-panel')!;

document.getElementById('exit-story')?.addEventListener('click', () => {
  lastStoryScrollTop = storyContent.scrollTop;
  appMode = 'explore';
  switchToExplore(storyPanel, explorePanel);
  saveUrlState(true); // push new URL state
});

document.getElementById('back-to-story')?.addEventListener('click', (e) => {
  e.preventDefault();
  appMode = 'story';
  switchToStory(storyPanel, explorePanel, storyContent, lastStoryScrollTop);
  // Re-trigger scroll handler to restore map state
  storyContent.dispatchEvent(new Event('scroll'));
  saveUrlState(true);
});
```

**Step 3: Test manually**

Click "Explore freely" → panel switches to explore controls. Click "Back to story" → panel switches back, scroll position restored.

**Step 4: Commit**

```bash
git add src/scrollytelling/modeSwitch.ts src/main.ts
git commit -m "feat: add story/explore mode switching"
```

---

### Task 11: URL State for Story Mode

Extend URL state to support `#story=<stop-id>`.

**Files:**
- Modify: `src/urlState.ts`
- Modify: `src/main.ts`

**Step 1: Extend UrlState interface**

In `src/urlState.ts`, add a `story` field to the `UrlState` interface:

```typescript
export interface UrlState {
  story?: string;  // Story stop ID (story mode)
  overlay?: string;
  verse?: string;
  zoom?: number;
  x?: number;
  y?: number;
  overlayParams: OverlayParams;
}
```

**Step 2: Update parseUrlState()**

Add parsing for `story` parameter:

```typescript
// In parseUrlState():
const story = params.get('story');
// ... existing parsing ...
return { story: story ?? undefined, overlay, verse, zoom, x, y, overlayParams };
```

**Step 3: Update buildUrlHash()**

When in story mode, output `#story=<id>`:

```typescript
// In buildUrlHash():
if (state.story) {
  parts.push(`story=${state.story}`);
  return '#' + parts.join('&');
}
// ... existing overlay/verse/zoom logic ...
```

**Step 4: Update main.ts to save/restore story URL**

In `buildCurrentUrlState()`:
- If `appMode === 'story'`, find current stop ID from scroll position and set `story` field
- If `appMode === 'explore'`, use existing logic

In URL restoration:
- If URL has `story` param, start in story mode and scroll to that stop

**Step 5: Test manually**

- Scroll to "Abraham" stop → URL should show `#story=abraham`
- Copy URL, paste in new tab → should open at that stop
- Switch to explore → URL should show standard overlay params

**Step 6: Commit**

```bash
git add src/urlState.ts src/main.ts
git commit -m "feat: add story mode URL state management"
```

---

### Task 12: Index Module and Cleanup

Create a barrel export for the scrollytelling module and ensure all pieces are wired together.

**Files:**
- Create: `src/scrollytelling/index.ts`

**Step 1: Create index**

```typescript
// src/scrollytelling/index.ts
export type { StoryData, StoryStop, InterpolatedState, EasingName } from './types';
export type { AppMode } from './modeSwitch';
export { loadStoryData, renderStoryPanel, computeStopOffsets } from './storyPanel';
export { computeInterpolatedState } from './controller';
export { computeBlendedColors, getColorsForStop } from './overlayBlender';
export { switchToExplore, switchToStory } from './modeSwitch';
export { assignGlobalSearchColors } from './searchColors';
export { easingFunctions, lerpCamera, lerpColor } from './interpolation';
```

**Step 2: Run full test suite**

```bash
npm test
```

All existing tests should still pass, plus the new scrollytelling tests.

**Step 3: Run typecheck**

```bash
npm run typecheck
```

**Step 4: Commit**

```bash
git add src/scrollytelling/index.ts
git commit -m "feat: add scrollytelling barrel export"
```

---

### Task 13: Polish and Edge Cases

Final pass on behavior details.

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scrollytelling/controller.ts` (if needed)

**Step 1: Handle manual zoom/pan during story mode**

When the user manually zooms/pans during story mode, it should override the scroll-driven camera. When they scroll the narrative again, it resumes.

Add a flag `manualOverride` that gets set on mouse/touch interactions and cleared on scroll events:

```typescript
let manualOverride = false;

// In canvas wheel/pointer handlers:
manualOverride = true;

// In scroll handler:
manualOverride = false;
// ... then apply interpolated camera ...
```

**Step 2: Handle window resize**

On resize, recompute stop offsets and re-render.

**Step 3: Performance — throttle scroll handler**

Use `requestAnimationFrame` to throttle scroll events:

```typescript
let scrollRAF: number | null = null;
storyContent.addEventListener('scroll', () => {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(() => {
    scrollRAF = null;
    // ... scroll handler logic ...
  });
});
```

**Step 4: Test manually**

- Zoom during story mode, then scroll → camera resumes from story
- Resize window → layout adjusts
- Rapid scrolling → no jank

**Step 5: Run full test suite and typecheck**

```bash
npm test && npm run typecheck
```

**Step 6: Commit**

```bash
git add src/main.ts src/scrollytelling/
git commit -m "feat: polish scrollytelling edge cases and performance"
```

---

## Running Log: Open Questions, Assumptions, Surprises

Maintained per `feedback_running_assumptions_log.md` — captures gaps, things I guessed at, and unexpected scope as I worked autonomously through the plan. Triage with Danyel before the PR exits draft.

### Open Questions (decisions I deferred / guessed)

1. **`lastSyncedStopId` reset coverage.** I reset it on `onStoryUpdated()` (hot reload), `switchToExplore`, and the mode switch back to story. The skip is a `lastSyncedStopId === dominantStop.id` equality check — so if the *same* stop's `overlayParams` change at runtime without the stop ID changing (e.g., a future hot-reload that diffs in place), the resync skip would silently miss it. Today nothing mutates a stop's params without re-resolving (which gives fresh objects), so this is fine; flagging in case we add fine-grained hot reload later.
2. **Default zoom for `verse`-ref cameras.** When `camera: Genesis.12.1` is given without an explicit `zoom`, I defaulted to **3**. Pulled out of the air to roughly match a "see the verse and a bit of context" framing. May want to tune per book or carry forward from previous stop.
3. **Mid-scroll URL writes.** Every scroll frame calls `updateUrl({ story: dominantStop.id }, false)` (replace, not push). Cheap but not free — should we throttle, or only write when `dominantStop.id` actually changes from the last-written value?
4. **`manualOverride` is write-only.** Set on canvas wheel/pointer in story mode and never read. Comment in `main.ts` calls it "reserved for future UI hints (e.g., 'scroll to resume')". Either wire up a UI hint or delete the dead flag.
5. **Narrative content judgment.** The `story.md` rewrite (Abram → Abraham → Isaiah → Nehemiah → haftarah) is a real editorial choice, not just a stub. Danyel needs to look at it as a *story*, not just code.

### Assumptions to Verify

1. ~~**Other overlays' `destroy()` contracts.**~~ **Audited — all clear.** The haftarah fix establishes the rule: `destroy()` may only clear ephemeral UI state, never the lookup/data indexes built in `init()`. Pre-unification, story mode rarely fired `destroy()`, so this rule was un-tested. Post-unification it fires on every story-mode overlay switch. Walked all six overlays (`commentary`, `trop`, `search`, `haftarah`, `text-dating`, `verse-length`) — none clear `init()`-loaded state without a rebuild path. `text-dating` and `verse-length` have no `destroy()` at all. `commentary` and `trop` clear caches that self-rebuild on next access (`getMaxValue` and `trop.ts:66-69` respectively). `search` only clears DOM refs (re-set by `renderControls`) and callbacks (re-wired by `onUpdate`); its index lives in `src/search.ts`, built once via `buildSearchIndex` at startup and not owned by the overlay's `init()`. **Note:** trop's `cachedVerseLookup` rebuild on every story-mode overlay swap is now a hot path it wasn't before — correct, just newly exercised. Minor perf footgun: commentary's `getMaxValue()` iterates all 23k verses on first call after each destroy. Could cause jank if a story rapidly toggles overlays; easy fix later by preserving the cache.
2. **Verse-ref camera detection in `parseCamera()`.** I used `parseVerseFromUrl(cameraStr)` truthy as the heuristic to detect verse-ref form (vs `x,y,zoom` triple). If `parseVerseFromUrl` accepts strings that aren't real verses (e.g., is it lenient about ranges or partial refs?), we could mis-route. Worth a targeted look at `parseVerseFromUrl`'s tolerance.
3. **`state.fromStop === state.toStop` as settled detector.** Relies on the controller handing back identical object references at rest. If anything re-resolves stops mid-flight (and our `onStoryUpdated()` does), the equality could fail and we'd treat a settled position as in-progress. The `lastSyncedStopId = null` reset on update masks this for the hot-reload case, but it's a structural assumption worth a comment in the controller.
4. **Stipple slot-by-slot lerp visual quality.** When two stipple verses have different slot *counts* (e.g., 2 colors → 3 colors), short side pads with default gray. The fade looks reasonable in the cases I tested but I haven't seen, e.g., haftarah ↔ search transitions where slot counts differ wildly. Visual review may surface gray-flicker that wants different padding logic.

### Unexpected (Surprises / Scope Creep)

1. **Mode unification surfaced a latent bug in `haftarah.ts`.** Before unification, story mode never called `currentOverlay?.destroy?.()`, so haftarah's `destroy()` clearing all its lookup indexes was harmless. Unification made `destroy()` fire on every story-mode overlay switch, breaking re-activation. Fixed by trimming `destroy()` to UI state only — but it raises the question above about other overlays.
2. **Stipple flattening in the blender.** The original blender reduced any multi-color stipple verse to its average color before lerping, producing visible gray flicker on stippled verses during transitions. Fixed by switching to slot-by-slot lerp with default-color padding for the shorter side, plus carrying `Color[]` through `colorsToTuples` instead of averaging. New test file: `overlayBlender.test.ts`.
3. **Verse-ref camera form (`camera: Genesis.12.1 | zoom: 3`)** wasn't in the original plan — it emerged while writing the Abraham narrative, where authoring cameras as `x,y,zoom` triples turned out to be impractical (you'd need to capture them via `Ctrl+Shift+C` for every stop). Added a `CameraRef` discriminated union to `types.ts`, parser support in `storyParser.ts`, and runtime resolution in `storyPanel.ts`. Reasonable scope but worth a review for whether the type/parser shape is what we want to live with.
4. **Mid-scroll explore-state sync is more invasive than the plan implied.** The plan's Task 9 (Scroll-Driven Overlay Crossfade) framed in-progress scroll as "blender writes the buffer." In practice, hover events firing mid-scroll would call `applyOverlay()` against a stale `currentOverlay` and clobber the blender's buffer. So `syncStoryStopState` now keeps `currentOverlay` / `currentOverlay.applyUrlParams` / `pinnedVerse` synced to the dominant stop *during* the transition too. New invariant: hover composites against the dominant stop, not the pre-scroll one. Captured in `project_scrollytelling_pipeline.md` memory.
5. **Story-mode URL ownership.** I had to add an `if (appMode !== 'story') saveUrlState(...)` guard inside `activateOverlay` so the overlay's own URL writes don't fight with the story-mode writes (`#story=<stop-id>`). Slightly grubby — the cleaner shape would be for `activateOverlay` not to touch URL at all and let callers decide, but that's a wider refactor than this branch.
