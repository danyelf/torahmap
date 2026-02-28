# Mobile Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Torah Map functional and usable on mobile devices (touch pan, pinch zoom, responsive layout, bottom sheet sidebar) without changing the desktop experience.

**Architecture:** Convert all mouse events to pointer events (backward compatible with mouse), add a touch state tracker for pinch-to-zoom, make controls/sidebar responsive with CSS media queries at 768px breakpoint, and turn the sidebar into a bottom sheet on mobile.

**Tech Stack:** TypeScript, CSS media queries, Pointer Events API, Touch Events API (for pinch), Vitest

---

### Task 1: Add viewport meta tag

**Files:**
- Modify: `index.html:4` (add after charset meta)

**Step 1: Add viewport meta tag**

In `index.html`, add this line after `<meta charset="UTF-8">`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
```

And add `touch-action: none` to the canvas to prevent browser pan/zoom:

In `index.html`, change `<canvas id="canvas"></canvas>` to:
```html
<canvas id="canvas" style="touch-action: none;"></canvas>
```

**Step 2: Add drag handle to sidebar HTML**

In `index.html`, add a drag handle as the first child of `#verse-sidebar`:

```html
<div id="verse-sidebar">
  <div class="bottom-sheet-handle"><span></span></div>
  <div class="verse-ref">...
```

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add viewport meta tag and touch-action for mobile support"
```

---

### Task 2: Create touch state module

**Files:**
- Create: `src/touchState.ts`
- Create: `src/__tests__/unit/touchState.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/unit/touchState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createTouchState,
  trackTouch,
  releaseTouch,
  getPinchDistance,
  getPinchCenter,
  resetTouchState,
} from '../../touchState';

describe('touchState', () => {
  describe('createTouchState', () => {
    it('creates initial state with no active touches', () => {
      const state = createTouchState();
      expect(state.activeTouches).toEqual(new Map());
      expect(state.lastPinchDistance).toBe(null);
    });
  });

  describe('trackTouch', () => {
    it('stores a touch by identifier', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(state.activeTouches.get(0)).toEqual({ x: 100, y: 200 });
    });

    it('tracks multiple touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      expect(state.activeTouches.size).toBe(2);
    });

    it('updates existing touch position', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 0, 150, 250);
      expect(state.activeTouches.get(0)).toEqual({ x: 150, y: 250 });
    });
  });

  describe('releaseTouch', () => {
    it('removes a touch by identifier', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      releaseTouch(state, 0);
      expect(state.activeTouches.size).toBe(0);
    });

    it('resets lastPinchDistance when fewer than 2 touches remain', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      state.lastPinchDistance = 100;
      releaseTouch(state, 1);
      expect(state.lastPinchDistance).toBe(null);
    });
  });

  describe('getPinchDistance', () => {
    it('returns null with fewer than 2 touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(getPinchDistance(state)).toBe(null);
    });

    it('computes distance between two touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 0, 0);
      trackTouch(state, 1, 300, 400);
      expect(getPinchDistance(state)).toBeCloseTo(500);
    });
  });

  describe('getPinchCenter', () => {
    it('returns null with fewer than 2 touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(getPinchCenter(state)).toBe(null);
    });

    it('computes midpoint between two touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      expect(getPinchCenter(state)).toEqual({ x: 200, y: 300 });
    });
  });

  describe('resetTouchState', () => {
    it('clears all touches and pinch distance', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      state.lastPinchDistance = 500;
      resetTouchState(state);
      expect(state.activeTouches.size).toBe(0);
      expect(state.lastPinchDistance).toBe(null);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/unit/touchState.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/touchState.ts`:

```typescript
// Touch State module - tracks active touches for pinch-to-zoom

export interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchState {
  activeTouches: Map<number, TouchPoint>;
  lastPinchDistance: number | null;
}

export function createTouchState(): TouchState {
  return {
    activeTouches: new Map(),
    lastPinchDistance: null,
  };
}

export function trackTouch(state: TouchState, id: number, x: number, y: number): void {
  state.activeTouches.set(id, { x, y });
}

export function releaseTouch(state: TouchState, id: number): void {
  state.activeTouches.delete(id);
  if (state.activeTouches.size < 2) {
    state.lastPinchDistance = null;
  }
}

export function getPinchDistance(state: TouchState): number | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getPinchCenter(state: TouchState): TouchPoint | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function resetTouchState(state: TouchState): void {
  state.activeTouches.clear();
  state.lastPinchDistance = null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/unit/touchState.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/touchState.ts src/__tests__/unit/touchState.test.ts
git commit -m "feat: add touchState module for pinch-to-zoom tracking"
```

---

### Task 3: Convert mouse events to pointer events and add touch support

**Files:**
- Modify: `src/main.ts:200-395` (replace mouse events with pointer + touch events)

This is the largest task. Replace all `mousedown/mousemove/mouseup/mouseleave/click` with pointer events and add touch handlers for pinch zoom.

**Step 1: Add imports for touchState at top of main.ts**

After the mouseState import (line 24), add:

```typescript
import {
  createTouchState,
  trackTouch,
  releaseTouch,
  getPinchDistance,
  getPinchCenter,
  resetTouchState,
} from './touchState.ts';
```

**Step 2: Create touchState alongside mouseState**

After `const mouseState = createMouseState();` (line 157), add:

```typescript
const touchState = createTouchState();
```

**Step 3: Add touch event handlers for pinch-to-zoom**

After the wheel event handler (after line 218), add touch handlers:

```typescript
// Touch events for pinch-to-zoom
canvas.addEventListener('touchstart', (e: TouchEvent) => {
  for (const touch of e.changedTouches) {
    trackTouch(touchState, touch.identifier, touch.clientX, touch.clientY);
  }
  // Initialize pinch distance when second finger touches down
  if (touchState.activeTouches.size === 2) {
    touchState.lastPinchDistance = getPinchDistance(touchState);
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e: TouchEvent) => {
  for (const touch of e.changedTouches) {
    trackTouch(touchState, touch.identifier, touch.clientX, touch.clientY);
  }

  if (touchState.activeTouches.size >= 2) {
    // Pinch-to-zoom
    const newDist = getPinchDistance(touchState);
    const center = getPinchCenter(touchState);
    if (newDist && center && touchState.lastPinchDistance) {
      const scale = newDist / touchState.lastPinchDistance;
      const newZoom = clampZoom(camera.zoom * scale);
      const newPan = panForZoom(
        { x: camera.x, y: camera.y },
        camera.zoom,
        newZoom,
        center.x,
        center.y
      );
      camera.x = newPan.x;
      camera.y = newPan.y;
      camera.zoom = newZoom;
      render();
      updateLabelPositions(window.bookLabels!, { x: camera.x, y: camera.y }, camera.zoom);
    }
    touchState.lastPinchDistance = newDist;
  }
}, { passive: true });

canvas.addEventListener('touchend', (e: TouchEvent) => {
  for (const touch of e.changedTouches) {
    releaseTouch(touchState, touch.identifier);
  }
  if (touchState.activeTouches.size === 0) {
    debouncedSaveUrlState();
  }
});

canvas.addEventListener('touchcancel', () => {
  resetTouchState(touchState);
});
```

**Step 4: Replace mouse events with pointer events**

Replace `mousedown` handler (lines 220-223) with:

```typescript
canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  startDrag(mouseState, e.clientX, e.clientY);
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(e.pointerId);
});
```

Replace `mousemove` for dragging (lines 225-233) with:

```typescript
canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (mouseState.isDragging && touchState.activeTouches.size < 2) {
    const dx = e.clientX - mouseState.dragStart.x;
    const dy = e.clientY - mouseState.dragStart.y;
    camera.x += dx / camera.zoom;
    camera.y += dy / camera.zoom;
    mouseState.dragStart = { x: e.clientX, y: e.clientY };
    render();
    updateLabelPositions(window.bookLabels!, { x: camera.x, y: camera.y }, camera.zoom);
  }
});
```

Replace `mouseup` handler (lines 236-249) with:

```typescript
canvas.addEventListener('pointerup', (e: PointerEvent) => {
  if (mouseState.isDragging) {
    stopDrag(mouseState);
    debouncedSaveUrlState();

    // Reset cursor after drag
    const verse = findVerseLayoutAtPoint(verses, camera, e.clientX, e.clientY);
    if (pinnedVerse && verse) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});
```

Replace `mouseleave` handler (lines 251-269) with:

```typescript
canvas.addEventListener('pointerleave', () => {
  const wasHovering = mouseState.hoveredVerse !== null;
  clearHover(mouseState);
  canvas.style.cursor = 'default';

  let overlayWantsRerender = false;
  if (currentOverlay?.setHoveredVerse) {
    overlayWantsRerender = currentOverlay.setHoveredVerse(null);
  }

  if (wasHovering || overlayWantsRerender) {
    applyOverlay();
    render();
  }
});
```

Replace the second `mousemove` handler for hover detection (lines 337-376) with:

```typescript
canvas.addEventListener('pointermove', (e: PointerEvent) => {
  // Skip hover logic on touch devices (no hover concept) and during pinch
  if (e.pointerType === 'touch' || touchState.activeTouches.size >= 2) return;

  if (!mouseState.isDragging) {
    const verse = findVerseLayoutAtPoint(verses, camera, e.clientX, e.clientY);
    const previousHover = mouseState.hoveredVerse;
    setHoveredVerse(mouseState, verse);

    const hoverChanged = !versesEqual(previousHover, verse);

    if (pinnedVerse && verse) {
      canvas.style.cursor = 'pointer';
    } else if (mouseState.isDragging) {
      canvas.style.cursor = 'grabbing';
    } else {
      canvas.style.cursor = 'default';
    }

    let overlayWantsRerender = false;
    if (currentOverlay?.setHoveredVerse) {
      overlayWantsRerender = currentOverlay.setHoveredVerse(verse);
    }

    if (hoverChanged || overlayWantsRerender) {
      applyOverlay();
      render();
    }

    if (pinnedVerse) {
      // Keep showing pinned verse
    } else if (verse) {
      updateSidebarWrapper(verse, false);
    } else {
      updateSidebarWrapper(null);
    }
  }
});
```

Replace `click` handler (lines 379-395) — keep `click` for mouse, add tap detection for touch:

The existing `click` event handler stays unchanged (works for mouse). For touch, we need tap detection. Add a `pointerup` handler that detects taps (short press without significant movement):

Add these variables after `const mouseState = createMouseState();`:

```typescript
let pointerDownPos: { x: number; y: number; time: number } | null = null;
const TAP_THRESHOLD = 10; // max px movement to count as tap
const TAP_MAX_DURATION = 300; // max ms to count as tap
```

Modify the `pointerdown` handler to record position:

```typescript
canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  startDrag(mouseState, e.clientX, e.clientY);
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(e.pointerId);
  pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
});
```

Update the `click` handler — replace the existing click handler with a pointerup-based tap detector that works for both mouse and touch:

Remove the old `click` handler entirely. Instead, add tap detection to the `pointerup` handler:

```typescript
canvas.addEventListener('pointerup', (e: PointerEvent) => {
  const wasDragging = mouseState.isDragging;
  if (wasDragging) {
    stopDrag(mouseState);
    debouncedSaveUrlState();
  }

  // Tap detection (works for both mouse and touch)
  if (pointerDownPos) {
    const dx = Math.abs(e.clientX - pointerDownPos.x);
    const dy = Math.abs(e.clientY - pointerDownPos.y);
    const duration = Date.now() - pointerDownPos.time;

    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD && duration < TAP_MAX_DURATION) {
      const verse = findVerseLayoutAtPoint(verses, camera, e.clientX, e.clientY);
      if (verse) {
        if (pinnedVerse && versesEqual(pinnedVerse, verse)) {
          unpinVerse();
        } else {
          pinVerse(verse);
        }
      } else if (pinnedVerse) {
        unpinVerse();
      }
    }
    pointerDownPos = null;
  }

  // Reset cursor
  if (wasDragging) {
    const verse = findVerseLayoutAtPoint(verses, camera, e.clientX, e.clientY);
    if (pinnedVerse && verse) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});
```

**Step 5: Run all tests**

Run: `npm test`
Expected: All existing tests still pass (mouse-based integration tests may need adjustments if they test click events specifically)

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: convert mouse events to pointer events and add pinch-to-zoom"
```

---

### Task 4: Responsive CSS for controls panel

**Files:**
- Modify: `src/styles/main.css` (add media queries)

**Step 1: Add mobile breakpoint for controls panel**

Append to `src/styles/main.css`:

```css
/* Mobile responsive layout */
@media (max-width: 768px) {
  #controls {
    width: calc(100vw - 20px);
    top: 6px;
    left: 10px;
    padding: 8px 10px;
    border-radius: 6px;
  }
  #controls label {
    display: none;
  }
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "feat: responsive controls panel for mobile viewports"
```

---

### Task 5: Bottom sheet sidebar styles

**Files:**
- Modify: `src/styles/main.css` (add bottom sheet styles for mobile)

**Step 1: Add bottom sheet CSS**

Append to the mobile media query in `src/styles/main.css`:

```css
@media (max-width: 768px) {
  /* ... existing controls rules ... */

  /* Bottom sheet sidebar */
  #verse-sidebar {
    position: fixed;
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 50vh;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
    overflow-y: auto;
    z-index: 20;
  }
  #verse-sidebar.visible {
    transform: translateY(0);
  }

  /* Drag handle */
  .bottom-sheet-handle {
    display: flex;
    justify-content: center;
    padding: 10px 0 6px;
    cursor: grab;
  }
  .bottom-sheet-handle span {
    width: 36px;
    height: 4px;
    background: #555;
    border-radius: 2px;
  }
}
```

Also add the desktop rule to hide the drag handle by default. Add this **outside** the media query, after the existing sidebar styles:

```css
/* Hide bottom sheet handle on desktop */
.bottom-sheet-handle {
  display: none;
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "feat: bottom sheet sidebar styles for mobile"
```

---

### Task 6: Bottom sheet dismiss behavior

**Files:**
- Modify: `src/sidebar.ts` (add dismissBottomSheet function)
- Modify: `src/main.ts` (wire up dismiss on tap-outside and handle click)

**Step 1: Add isMobile helper**

In `src/main.ts`, after the imports, add a helper:

```typescript
function isMobile(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}
```

**Step 2: Wire up bottom sheet handle dismiss**

In `src/main.ts`, after the close button handler (line 398-400), add:

```typescript
// Bottom sheet handle tap to dismiss
const bottomSheetHandle = document.querySelector('.bottom-sheet-handle');
bottomSheetHandle?.addEventListener('click', () => {
  unpinVerse();
});
```

**Step 3: Commit**

```bash
git add src/main.ts src/sidebar.ts
git commit -m "feat: bottom sheet dismiss via handle tap"
```

---

### Task 7: Responsive Hebrew keyboard

**Files:**
- Modify: `src/styles/hebrewKeyboard.css` (add mobile breakpoint)

**Step 1: Add mobile media query for keyboard**

Append to `src/styles/hebrewKeyboard.css`:

```css
@media (max-width: 768px) {
  #hebrew-keyboard-container {
    position: fixed;
    left: 10px;
    right: 10px;
    width: auto;
    max-width: none;
    padding: 10px;
  }
  .hebrew-keyboard-theme .hg-button {
    height: 48px !important;
    min-width: 28px !important;
    font-size: 16px !important;
    padding: 4px 2px !important;
  }
  .hebrew-keyboard-theme .keycap-hebrew {
    font-size: 18px !important;
  }
  .hebrew-keyboard-theme .keycap-english {
    font-size: 10px !important;
  }
  .hebrew-keyboard-theme .hg-row {
    gap: 3px !important;
    margin-bottom: 3px !important;
  }
}
```

**Step 2: Commit**

```bash
git add src/styles/hebrewKeyboard.css
git commit -m "feat: responsive Hebrew keyboard for mobile"
```

---

### Task 8: Responsive search and overlay styles

**Files:**
- Modify: `src/styles/overlays/search.css` (mobile tweaks)

**Step 1: Add mobile search styles**

Append to `src/styles/overlays/search.css`:

```css
@media (max-width: 768px) {
  #search-results {
    max-height: 40vh;
  }
  .search-result {
    padding: 10px;
  }
  .search-result:active {
    background: rgba(106, 176, 243, 0.15);
  }
  .root-chip:active {
    background: #383838;
    border-color: #6ab0f3;
    color: #fff;
  }
}
```

**Step 2: Commit**

```bash
git add src/styles/overlays/search.css
git commit -m "feat: mobile-friendly search results with active states"
```

---

### Task 9: Update help modal for touch controls

**Files:**
- Modify: `src/help.ts:29-39` (add touch controls)

**Step 1: Update controls tab content**

In `src/help.ts`, replace the `controls` tab content (lines 29-39) with a version that shows both desktop and mobile controls:

```typescript
  controls: {
    title: 'Controls',
    content: `
      <table class="controls-table">
        <tr><td>Scroll / Pinch</td><td>Zoom in/out</td></tr>
        <tr><td>Drag</td><td>Pan around</td></tr>
        <tr><td>Hover</td><td>Preview verse details</td></tr>
        <tr><td>Click / Tap</td><td>Pin verse details</td></tr>
        <tr><td>Click pinned / Tap again</td><td>Unpin verse</td></tr>
        <tr><td>&larr; &rarr; arrow keys</td><td>Navigate verses</td></tr>
        <tr><td>Escape</td><td>Unpin verse</td></tr>
      </table>
    `,
  },
```

**Step 2: Commit**

```bash
git add src/help.ts
git commit -m "feat: update help controls for both desktop and mobile"
```

---

### Task 10: Update label positions during pan

**Files:**
- Modify: `src/main.ts` (ensure labels update during drag and resize)

**Step 1: Add label updates to resize handler**

In `src/main.ts`, update the resize handler (lines 473-476) to also update labels:

```typescript
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
  updateLabelPositions(window.bookLabels!, { x: camera.x, y: camera.y }, camera.zoom);
});
```

Note: Label updates during drag and zoom were already added in Task 3. This task ensures resize also updates them.

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "fix: update book labels on window resize"
```

---

### Task 11: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass. If any integration tests relied on specific mouse event constructors, they may need updating to use PointerEvent.

**Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Build for production**

Run: `npm run build`
Expected: Clean build with no errors

**Step 4: Manual mobile testing checklist**

Start dev server and test on a phone or mobile simulator:
- [ ] Page renders at device width (no 980px virtual viewport)
- [ ] Single-finger drag pans the map
- [ ] Two-finger pinch zooms in/out
- [ ] Tapping a verse pins it and shows bottom sheet
- [ ] Tapping the bottom sheet handle dismisses it
- [ ] Controls panel is full-width on narrow viewports
- [ ] Search works on mobile
- [ ] Help modal renders cleanly
- [ ] Desktop mouse interactions still work identically

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test and build issues from mobile support"
```

---

### Task 12: Final push

**Step 1: Push to remote**

```bash
git push -u origin tm-x4r
```
