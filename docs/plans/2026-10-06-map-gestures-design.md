# Map Gestures Out of main.ts

**Date:** 2026-10-06
**Status:** Design, for review. A step of #342.

## The problem

The code that turns the reader's hands into map changes is spread across
`main.ts` (lines 740, 816–950, 1082–1135), and each listener reads and writes
the shell's variables directly: the camera, the pinned verse, the driver, the
frame. A tap's rules cannot be tested without building the whole app, and the
shell cannot move into a package with them inside.

## The idea

A **gesture** is one thing the reader does to the map: a drag, a pinch, a
wheel turn, a tap, a key. An **intent** is what the gesture asks for, in
screen terms: pan by so many pixels, zoom by a factor around a point, tap this
square. The gestures module listens, keeps the state a gesture needs between
events, and reports intents. It never touches the camera, the pin or the URL.
The shell answers each intent by its own rules, as it does today.

## The gestures module

`src/mapGestures.ts`. Made from the canvas, the two zoom buttons, the shell's
`onMap` (a client point to a map point; the shell keeps the canvas origin), a
`squareUnder` that does hit detection against the current camera, a `clickable`
rule (would a click here do something worth a pointing cursor; today, a
square while another is pinned), and the intents.

```ts
interface MapIntents<I extends MapItem> {
  /** A pointer went down on the map. */
  grab(): void;
  /** Move the map by a drag of (dx, dy) screen pixels. */
  pan(dx: number, dy: number): void;
  /** Zoom by `factor`, holding the point `at` still. */
  zoom(factor: number, at: ScreenPoint): void;
  /** A wheel turn, button press, drag or pinch has finished: the shell updates the link and may send view_settled. */
  moveEnded(): void;
  /** A mouse moved onto another square, or off every square. */
  hover(square: I | null): void;
  /** The pointer left the map. */
  leave(): void;
  /** A short press that did not move, on a square or on empty map. */
  tap(square: I | null): void;
  /** ArrowRight or ArrowLeft. */
  step(by: 1 | -1): void;
  /** Escape. */
  escape(): void;
}

function createMapGestures<I extends MapItem>(options: {
  canvas: HTMLCanvasElement;
  zoomIn: HTMLElement | null;
  zoomOut: HTMLElement | null;
  onMap: (e: { clientX: number; clientY: number }) => ScreenPoint;
  squareUnder: (p: ScreenPoint) => I | null;
  /** Whether a click on this square, or on empty map, would do something worth a pointing cursor. */
  clickable: (square: I | null) => boolean;
  intents: MapIntents<I>;
}): {
  /** The square under the mouse's last position, for when the map moves under a still cursor. */
  squareUnderMouse(): I | null;
};
```

### What it owns

- Every listener on the canvas and the zoom buttons, and the `keydown`
  listener for the map's keys.
- The input state: active touches and the last pinch distance
  (`touchState.ts`), the drag start (`mouseState.ts`'s `isDragging` and
  `dragStart`), where and when the pointer went down, the last mouse position.
  The two state files become private to the module or fold into it.
- The thresholds: a tap is under `DRAG_PX` in each direction and under 300 ms;
  the wheel's step factors `ZOOM_IN_FACTOR` and `ZOOM_OUT_FACTOR`.
- `preventDefault` on the wheel, pointer capture, and the cursor (`grabbing`
  while dragging, `pointer` or `default` from `clickable` otherwise, `default` on leaving).

### What stays in the shell

- **The camera's rules**: turning a pan in pixels into map units, clamping
  zoom, `zoomAtPoint`, cancelling a glide.
- **Hovered and pinned squares.** `hoveredVerse` moves out of `mouseState` into
  a plain shell variable beside `pinnedVerse`, since render, repaint, the
  popup and the Sefaria link all read it.
- **The driver** (`takeOver`), the frame (`dispatch`), the URL, telemetry, the
  popup and repainting.
- The popup's close button and the dev-only Ctrl+Shift+C capture key, which
  are not gestures on the map.

## Every current behaviour, and its intent

| Today | Intent | Shell answers |
| --- | --- | --- |
| Wheel zooms around the cursor, one fixed step per event | `zoom`, then `moveEnded` | cancel glide, `zoomAt` |
| Zoom buttons zoom around the canvas centre | `zoom`, then `moveEnded` | `zoomAt` |
| Two fingers pinch around their midpoint | `zoom` per move; `moveEnded` when the last finger lifts | `zoomAt` |
| Pointer down lifts the menu, folds a phone's sheet, stops a glide | `grab` | `dispatch({ type: 'map-touched' })`, cancel glide |
| Drag (mouse or one finger) pans; takes the map only if it moved | `pan`, only when non-zero; `moveEnded` on release | `takeOver`, move camera, render |
| Pinch suppresses drag panning | inside the module | — |
| Mouse over a square highlights it and shows its popup unless one is pinned | `hover` | set hover, repaint, popup if nothing pinned |
| Touch moves never hover | inside the module | — |
| Leaving the map clears the highlight but leaves the popup | `leave` | clear hover, repaint |
| Tap a square pins it; tap the pinned one unpins | `tap(square)` | pin or unpin |
| Tap empty map unpins | `tap(null)` | unpin if pinned |
| Cursor after a drag ends | inside the module, via `clickable` | — |
| Story scroll moves the map under a still mouse | `squareUnderMouse()`, called from the frame loop as now | set hover |
| Escape closes the menu, else the panel, else unpins | `escape` | the same order |
| Arrow keys step the pinned verse and centre on it | `step` | step if pinned |
| `touchcancel` forgets every touch | inside the module | — |

### What does not fit cleanly

- **Hover is reported on change only.** Today the popup is redrawn on every
  mouse move over the same square; on change gives the same picture, since a
  file landing redraws the popup anyway.
- **Zoom buttons do not stop a glide**, so a press during one is overwritten
  on the glide's next frame. If the shell's
  `zoom` answer cancels the glide for every source, the buttons are fixed in
  passing. That is a visible change, so it needs a yes; otherwise `zoom`
  carries its source and only the wheel cancels.
- **`leave` and `hover(null)` look alike but differ**: leaving keeps the popup
  so the reader can reach it. Two intents keep that rule visible.

## Testing

`createMapGestures` with a happy-dom canvas, a `squareUnder` over a fixed grid,
and recording intents; events built by hand, no WebGL.

- A press and release in place within 300 ms is `tap(square)`; one that moves
  `DRAG_PX` or lasts longer is not.
- A drag reports `pan` with the pixel deltas, nothing for a zero move, then
  `moveEnded`.
- Two touches report `zoom` with the distance ratio and midpoint, suppress
  `pan`, and `moveEnded` only when both lift; `touchcancel` forgets them.
- A wheel turn reports one step factor at the cursor; its default is prevented.
- Mouse moves report `hover` on change only; touch moves never; leaving
  reports `leave`, and `squareUnderMouse` is then null.
- Keys report `escape` and `step(±1)`.

Then the existing unit, layout and loading tests, and a pass on the branch
preview on a desktop and a phone.

## Size

About 190 lines leave `main.ts`: the listeners and their state (roughly 125
at 740 and 826–950, 25 at 1082–1105, 25 for the keys, 15 of imports and
declarations). About 45 come back as the intent answers, so `main.ts` shrinks
by about 145. The module is about 200 lines with comments.
