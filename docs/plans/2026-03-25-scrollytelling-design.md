# Scrollytelling Design

## Overview

Add a right-side text panel that drives a guided narrative through the Tanakh map. As the user scrolls through story text, the map smoothly transitions between camera positions and overlay states. The user can exit into free exploration and return to the story.

## Layout

### Right Panel (~350-400px, fixed width)

Always present. Contains either story content or explore controls depending on mode.

- **Story mode**: Scrollable narrative text blocks (one per stop). "Exit story" button near the top.
- **Explore mode**: Overlay selector dropdown, overlay-specific controls, overlay legend. "Back to story" link at the bottom.

### Verse Popup (bottom-left of canvas, floating)

The current verse sidebar (Hebrew text, English text, Sefaria link) relocates here. Appears on hover/click, same pin/unpin behavior as today. Positioned over the canvas, not inside the panel.

### Zoom Buttons (bottom-right of canvas)

`+` and `-` stacked vertically, Google Maps style. Same zoom factors as mouse wheel (1.1x/0.9x), centered on canvas center. Respects existing zoom limits (0.1-10.0). Semi-transparent dark background, light icons. Works in both story and explore modes.

### Canvas

Fills remaining width (left of panel), full height.

### Mobile (<=768px)

Right panel becomes a bottom sheet (reusing existing bottom-sheet pattern). Map fills the top portion. Zoom buttons stay bottom-right, above the sheet.

## Story Data Format

Stories are defined in a JSON file, separate from code:

```json
{
  "stops": [
    {
      "id": "intro",
      "title": "The Torah Map",
      "text": "Every verse of the Tanakh, laid out spatially...",
      "camera": { "x": 0, "y": 0, "zoom": 1.0 },
      "overlay": null
    },
    {
      "id": "abraham",
      "title": "Abraham's Story",
      "text": "Abraham's name appears throughout Genesis...",
      "camera": { "x": 120, "y": 30, "zoom": 3.0 },
      "overlay": "search",
      "overlayParams": { "q": "אברהם" },
      "easing": "ease-in-out"
    },
    {
      "id": "haftarah",
      "title": "The Haftarah Portions",
      "text": "Each week's Torah reading is paired with...",
      "camera": { "x": 0, "y": 0, "zoom": 1.0 },
      "overlay": "haftarah"
    }
  ],
  "defaults": {
    "easing": "ease-in-out"
  }
}
```

Each stop specifies:
- `id`: Unique identifier (used in URL state)
- `title`: Display heading
- `text`: Narrative content (could support markdown)
- `camera`: Target camera state (x, y, zoom)
- `overlay`: Overlay ID or null for no overlay
- `overlayParams`: Parameters for the overlay (search query, category, etc.)
- `easing`: Optional per-stop easing function override

## Scroll Interpolation

### How it works

1. The right panel lays out all stop text blocks vertically with natural content height.
2. A `ScrollytellingController` watches the panel's scroll position.
3. For each scroll event, determine which two stops the position falls between.
4. Compute `t` (0.0-1.0) representing progress between adjacent stops.
5. Apply easing function to `t`.
6. Interpolate camera: lerp `x`, `y`, and `zoom`.
7. Interpolate colors: compute both stops' overlay colors, blend each verse's RGBA by `t`.

### Color crossfading

- **Same overlay, different params** (e.g., two search queries): compute both color arrays, lerp per-verse RGBA.
- **Different overlays** (e.g., search -> haftarah): same approach, lerp between the two color arrays.
- **One side is null overlay**: lerp to/from default gray.
- **Active overlay for UI purposes**: snaps to whichever side has `t > 0.5`.

### Search term color assignment

Current search assigns colors positionally (first term = teal, second = green, etc.). For scrollytelling, colors are assigned globally at story load time:

1. Collect all unique search terms across all stops.
2. Assign each a permanent color from the palette.
3. During crossfade, shared terms keep their color (e.g., "Abraham" stays teal whether fading in or out).
4. Free-explore search keeps its current positional assignment (separate mode).

### Edge behavior

- Before first stop: pinned to first stop's state.
- After last stop: pinned to last stop's state.

### Manual interaction during story mode

Zoom buttons and mouse/touch pan/zoom work during story mode, overriding the scroll-driven camera. When the user scrolls the narrative again, the scroll-driven state smoothly resumes control.

## Mode Switching

### Story -> Explore

- "Exit story" button in the right panel.
- Panel content swaps to explore controls (overlay selector, controls, legend).
- Map stays at its current state (camera position and overlay preserved).
- Verse popup continues working.

### Explore -> Story

- "Back to story" link at the bottom of the explore panel.
- Panel swaps back to narrative text.
- Map animates to the nearest/last-read stop's state.
- Scroll position restores to where the user left off.

### URL State

- Story mode: `#story=abraham` (current stop ID)
- Explore mode: same as current (`#overlay=search&q=...&zoom=...`)
- Landing with no hash: story mode, first stop

## What Changes

### Removed
- `#controls` floating panel (top-left) -- content moves to right panel explore mode
- `#verse-sidebar` floating panel (top-right) -- content moves to verse popup (bottom-left of canvas)

### New
- Right panel component (story + explore modes)
- `ScrollytellingController` (scroll position tracking, interpolation)
- Story data file (JSON)
- Zoom buttons (+/- overlay on canvas)
- Verse popup (bottom-left floating)
- Global search term color assignment for story mode

### Modified
- `main.ts` -- orchestrate modes, wire up scrollytelling controller
- `rendering.ts` -- support blended color arrays for crossfade
- `camera.ts` -- support animated transitions and lerp
- `urlState.ts` -- add story mode URL format
- CSS -- new layout with persistent right panel
