# Mobile Support Design: Usable Viewer

## Goal

Make Torah Map functional and usable on mobile devices (phones and tablets) without changing the desktop experience.

## Current State

The app is 100% desktop-only:
- No touch event handlers (mouse events only)
- No viewport meta tag
- No responsive CSS (no media queries)
- Controls (280px) + sidebar (280px) overflow on narrow screens
- Hover-dependent verse preview
- 6px verse squares require ~7x zoom to be tappable
- Hebrew keyboard hardcoded at 650px width

**What already works well:**
- Canvas handles DPR scaling and resize events
- Hit detection is coordinate-agnostic
- Camera zoom math is parameterized
- Help modal has `max-width: 90vw`

## Design

### 1. Foundation

**Viewport meta tag** in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
```
`user-scalable=no` prevents browser-level pinch zoom (we handle it ourselves on the canvas).

**Pointer events** replace mouse events in `main.ts`. PointerEvent works for both mouse and touch, so desktop behavior is preserved. Touch-specific: add `touch-action: none` to canvas to prevent browser scroll/zoom.

**Pinch-to-zoom** via tracking two active touches, computing distance delta, and mapping to zoom factor using existing `panForZoom()`.

### 2. Responsive Layout (< 768px)

**Controls panel** collapses to a compact top bar:
- Overlay `<select>` stays visible (full width)
- Search input stays visible (full width below selector)
- Overlay-specific controls (legend, trop chart) appear below when active
- No fixed 280px width — uses `width: calc(100vw - 20px)` with smaller padding

**Sidebar becomes a bottom sheet:**
- Slides up from bottom when a verse is tapped
- Shows verse reference, Hebrew text, English text, Sefaria link
- Drag handle at top for visual affordance
- Tap outside or tap the handle to dismiss
- Max height: 50vh
- CSS transition for smooth slide animation

**Hebrew keyboard:**
- `max-width: calc(100vw - 20px)` instead of 650px
- Keys scale down proportionally
- Position below search input (not floating)

### 3. Touch Interactions

| Touch gesture | Action | Replaces |
|---|---|---|
| Single finger drag | Pan | Mouse drag |
| Two-finger pinch | Zoom | Mouse wheel |
| Tap | Pin verse, show bottom sheet | Click |
| Tap outside bottom sheet | Dismiss | Click pinned verse |

No hover equivalent on mobile — tap is the only interaction. The help modal updates to show touch controls on mobile.

### 4. Mobile Detection

Use `window.matchMedia('(max-width: 768px)')` for CSS and JS behavior switches. This is viewport-based, not device-based, so resizing a desktop window works correctly.

### 5. Files Modified

| File | Changes |
|---|---|
| `index.html` | Viewport meta tag |
| `src/main.ts` | Pointer events, pinch-to-zoom, mobile detection, bottom sheet logic |
| `src/styles/main.css` | Responsive breakpoints, bottom sheet styles, compact controls |
| `src/styles/overlays/search.css` | Mobile search layout |
| `src/styles/hebrewKeyboard.css` | Responsive keyboard sizing |
| `src/styles/help.css` | Minor mobile adjustments |
| `src/help.ts` | Touch-specific controls help text |
| `src/sidebar.ts` | Bottom sheet show/dismiss API |

### 6. What Doesn't Change

- Desktop experience (pointer events are backward compatible)
- WebGL rendering pipeline
- Verse layout algorithm
- All overlay logic
- Data loading
- URL state management
