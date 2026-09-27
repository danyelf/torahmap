# The Camera Names the Centre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `camera.x`, `camera.y` become the map point at the centre of the canvas, so links name what is in the middle of the screen and glides keep the middle on a straight path, with zoom blended by its logarithm.

**Architecture:** `src/camera.ts` owns every conversion between map and screen. Everything that positions by the old top-left offset (the shaders, the book labels, the map title) gets that offset from one function, `viewOffset`, and needs no other change. The Talmud page changes only enough to compile.

**Tech Stack:** TypeScript, Vite, WebGL 2, Vitest.

**Spec:** `docs/plans/2026-09-26-camera-centre.md`

## Global Constraints

- `Camera` stays `{ x, y, zoom }`; `x`, `y` are the map point at the centre of the canvas, in map units.
- The canvas centre on every device, phone included. The canvas is `#canvas`, whose CSS size is `canvas.clientWidth × canvas.clientHeight` (desktop: window width minus the 380 px panel).
- URL keys stay `x`, `y`, `zoom`. No reading of old links.
- `createCamera` keeps today's opening placement exactly: Genesis 1:1's right edge at screen x `windowWidth − 320`, the map's top at screen y 40. (On desktop this sits 60 px under the 380 px panel. That is existing behaviour, reported to Danyel, not fixed here.)
- Comments in the present tense; no ticket or stage references in code (AGENTS.md).
- `npm test`, the typecheck and Prettier run in the pre-commit hook; every commit must pass it.

## Review Focus

1. **Canvas narrower than the window (desktop).** Hover and click must use the canvas size, not the window's; with the centre model a wrong width shifts every hit by half the panel. Pinned by the hit-detection test in Task 2 that uses an 800-wide viewport.
2. **Phone focus point.** A story verse lands at the raised focus (below centre), not at the centre. Pinned by the `centreForFocus` off-centre test in Task 1.
3. **Zoom buttons.** Zooming about the canvas centre leaves `x`, `y` unchanged. Pinned in Task 1.
4. **Resize.** The same camera at a new canvas size keeps the same map point in the middle. Pinned by the `viewOffset` test in Task 1; checked by eye in Task 4.
5. **Pinned verse on load.** A link with both a verse and a zoom puts the verse at the focus at that zoom. Pinned by the `view-state-restore` test in Task 2.

---

### Task 1: Conversion functions in `camera.ts`

Additive: new functions beside the old ones, so everything still compiles and runs unchanged.

**Files:**
- Modify: `src/camera.ts`
- Test: `src/__tests__/unit/camera.test.ts`

**Interfaces:**
- Produces:
  - `interface Viewport { width: number; height: number }` — the canvas, in CSS pixels
  - `worldToScreen(p: { x: number; y: number }, camera: Camera, viewport: Viewport): ScreenPoint`
  - `screenToWorld(p: ScreenPoint, camera: Camera, viewport: Viewport): { x: number; y: number }`
  - `viewOffset(camera: Camera, viewport: Viewport): { x: number; y: number }` — what the shaders and labels call `pan`
  - `zoomAtPoint(camera: Camera, newZoom: number, point: ScreenPoint, viewport: Viewport): Camera`
  - `centreForFocus(item: { x: number; y: number; size: number }, zoom: number, focus: ScreenPoint, viewport: Viewport): { x: number; y: number }`

- [ ] **Step 1: Write the failing tests** — append to `src/__tests__/unit/camera.test.ts`, and add the new names to its import from `'../../camera'`:

```ts
describe('map and screen', () => {
  const view = { width: 800, height: 600 };
  const camera = { x: 1000, y: 400, zoom: 2 };

  it('puts the camera’s point at the middle of the canvas', () => {
    expect(worldToScreen({ x: 1000, y: 400 }, camera, view)).toEqual({ x: 400, y: 300 });
  });

  it('round-trips a point', () => {
    const p = { x: 1234.5, y: -87 };
    const back = screenToWorld(worldToScreen(p, camera, view), camera, view);
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });

  it('gives the offset the shaders position by', () => {
    const offset = viewOffset(camera, view);
    const p = { x: 1100, y: 350 };
    const screen = worldToScreen(p, camera, view);
    expect((p.x + offset.x) * camera.zoom).toBeCloseTo(screen.x, 10);
    expect((p.y + offset.y) * camera.zoom).toBeCloseTo(screen.y, 10);
  });

  it('keeps the same point in the middle when the canvas is resized', () => {
    const wider = { width: 1200, height: 900 };
    expect(worldToScreen({ x: 1000, y: 400 }, camera, wider)).toEqual({ x: 600, y: 450 });
  });
});

describe('zoomAtPoint', () => {
  const view = { width: 800, height: 600 };
  const camera = { x: 1000, y: 400, zoom: 1 };

  it('holds the map point under the cursor still', () => {
    const cursor = { x: 120, y: 510 };
    const before = screenToWorld(cursor, camera, view);
    const zoomed = zoomAtPoint(camera, 3.5, cursor, view);
    const after = screenToWorld(cursor, zoomed, view);
    expect(zoomed.zoom).toBe(3.5);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('leaves the centre alone when zooming about the middle', () => {
    const zoomed = zoomAtPoint(camera, 0.4, { x: 400, y: 300 }, view);
    expect(zoomed.x).toBeCloseTo(1000, 10);
    expect(zoomed.y).toBeCloseTo(400, 10);
  });
});

describe('centreForFocus', () => {
  const view = { width: 800, height: 600 };
  const item = { x: 400, y: 300, size: 6 };

  it('puts the item at a focus away from the middle', () => {
    // The phone centres verses above the middle, clear of the story sheet.
    const focus = { x: 400, y: 228 };
    const centre = centreForFocus(item, 2.5, focus, view);
    const screen = worldToScreen({ x: 403, y: 303 }, { ...centre, zoom: 2.5 }, view);
    expect(screen.x).toBeCloseTo(focus.x, 10);
    expect(screen.y).toBeCloseTo(focus.y, 10);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/__tests__/unit/camera.test.ts`
Expected: FAIL — `worldToScreen` (and the rest) is not exported.

- [ ] **Step 3: Implement** — in `src/camera.ts`, after the `ScreenPoint` interface:

```ts
/** The map's canvas, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

export function worldToScreen(
  p: { x: number; y: number },
  camera: Camera,
  viewport: Viewport,
): ScreenPoint {
  return {
    x: (p.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (p.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function screenToWorld(
  p: ScreenPoint,
  camera: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (p.x - viewport.width / 2) / camera.zoom + camera.x,
    y: (p.y - viewport.height / 2) / camera.zoom + camera.y,
  };
}

/**
 * The offset that puts a map point on screen at `(point + offset) × zoom`,
 * which is how the shaders and the labels position what they draw.
 */
export function viewOffset(camera: Camera, viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.width / (2 * camera.zoom) - camera.x,
    y: viewport.height / (2 * camera.zoom) - camera.y,
  };
}

/** The camera at `newZoom` that keeps the map point under `point` where it is. */
export function zoomAtPoint(
  camera: Camera,
  newZoom: number,
  point: ScreenPoint,
  viewport: Viewport,
): Camera {
  const anchor = screenToWorld(point, camera, viewport);
  return {
    x: anchor.x - (point.x - viewport.width / 2) / newZoom,
    y: anchor.y - (point.y - viewport.height / 2) / newZoom,
    zoom: newZoom,
  };
}

/**
 * The centre that puts an item at `focus`.
 *
 * Takes the zoom rather than reading it, because moving and zooming at once
 * has to aim at where the item will be, not where it is now.
 */
export function centreForFocus(
  item: { x: number; y: number; size: number },
  zoom: number,
  focus: ScreenPoint,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: item.x + item.size / 2 - (focus.x - viewport.width / 2) / zoom,
    y: item.y + item.size / 2 - (focus.y - viewport.height / 2) / zoom,
  };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/__tests__/unit/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/camera.ts src/__tests__/unit/camera.test.ts
git commit -m "Add map-to-screen conversions for a camera that names the centre"
```

---

### Task 2: Switch the app to the centre

One commit, because the meaning of `camera.x`/`camera.y` changes for every reader at once; a half-switched tree compiles but draws in the wrong place.

**Files:**
- Modify: `src/camera.ts` — `createCamera`, `cameraToFit`, `viewFocusedOn`; delete `panForZoom` and `panToFocus`
- Modify: `src/hitDetection.ts` — delete its `screenToWorld`; `findItemAtPoint` takes a viewport
- Modify: `src/rendering.ts`, `src/mapTitle.ts`, `src/viewState.ts`, `src/scrollytelling/storyPanel.ts`, `src/main.ts`
- Modify: `src/main-talmud.ts` — only what it needs to compile
- Test: `src/__tests__/unit/camera.test.ts`, `camera-glide.test.ts`, `hitDetection.test.ts`, `rendering.test.ts`, `mapTitle.test.ts`, `src/__tests__/integration/view-state-restore.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced.
- Produces:
  - `createCamera(viewport: Viewport, bounds: Bounds, windowWidth: number = viewport.width): Camera`
  - `cameraToFit(box: WorldBox, width: number, height: number, zoom?: number): Camera` — same signature, returns a centre
  - `viewFocusedOn(item, currentZoom: number, minZoom: number, focus: ScreenPoint, viewport: Viewport): Camera`
  - `findItemAtPoint<T>(verses: SpatialItem<T>[], camera: Camera, viewport: Viewport, screenX: number, screenY: number): SpatialItem<T> | null`
  - `updateMapTitlePosition(title: MapTitle, offset: { x: number; y: number }, zoom: number): void`
  - `cameraForView(camera: Camera, verse, focus: ScreenPoint, viewport: Viewport): Camera`

- [ ] **Step 1: Update the tests to the new meaning**

`camera.test.ts`:
- Delete the whole `describe('panForZoom', …)` block; `zoomAtPoint` from Task 1 replaces it. Drop `panForZoom` from the import.
- Replace the `createCamera` tests with:

```ts
describe('createCamera', () => {
  const GENESIS_RIGHT = (bounds: Bounds) => bounds.width;

  it('opens with Genesis 1:1 320 px in from the window’s right edge, below the labels', () => {
    const bounds: Bounds = { width: 1000, height: 800 };
    const view = { width: 1540, height: 1080 };
    const camera = createCamera(view, bounds, 1920);

    expect(camera.zoom).toBe(1);
    const corner = worldToScreen({ x: GENESIS_RIGHT(bounds), y: 0 }, camera, view);
    expect(corner.x).toBeCloseTo(1920 - 320, 10);
    expect(corner.y).toBeCloseTo(40, 10);
  });

  it('measures from the canvas when no window width is given', () => {
    const bounds: Bounds = { width: 500, height: 400 };
    const view = { width: 800, height: 600 };
    const corner = worldToScreen({ x: 500, y: 0 }, createCamera(view, bounds), view);
    expect(corner.x).toBeCloseTo(800 - 320, 10);
  });
});
```

- In `describe('cameraToFit', …)`, replace the `onScreen` helper so the existing expectations stand unchanged:

```ts
const onScreen = (x: number, y: number, c: Camera, width: number, height: number) =>
  worldToScreen({ x, y }, c, { width, height });
```

and pass the same width and height each test gives `cameraToFit`, e.g. `onScreen(box.minX, box.minY, c, 832, 1000)`. Import `type Camera`.

`camera-glide.test.ts`:
- Add `const VIEW = { width: 800, height: 600 };`.
- `screenPosition` becomes `worldToScreen({ x: item.x + item.size / 2, y: 0 }, camera, VIEW).x`.
- The two `panToFocus` tests call `centreForFocus(VERSE, zoom, FOCUS, VIEW)`; rename the block `describe('centreForFocus', …)`.
- Every `viewFocusedOn(…, FOCUS)` gains `, VIEW`.
- Add, inside `describe('animateCameraTo', …)`:

```ts
it('keeps what is in the middle of the screen still while it only zooms', () => {
  mockClock();
  const camera: Camera = { x: 500, y: 200, zoom: 1 };

  animateCameraTo(camera, { x: 500, y: 200, zoom: 4 }, () => {});
  for (const at of [0.25, 0.5, 0.75]) {
    advance(CAMERA_GLIDE_MS * at);
    const middle = worldToScreen({ x: 500, y: 200 }, camera, VIEW);
    expect(middle.x).toBeCloseTo(400, 10);
    expect(middle.y).toBeCloseTo(300, 10);
  }
});
```

`hitDetection.test.ts`:
- Delete `describe('screenToWorld', …)`; Task 1's tests cover it. Drop it from the import.
- Above `describe('findItemAtPoint', …)` add, and import `type Camera` from `'../../camera'`:

```ts
const VIEW = { width: 800, height: 600 };
/** The camera that draws map (0, 0) at screen (ox × zoom, oy × zoom). */
const withOrigin = (ox: number, oy: number, zoom: number): Camera => ({
  x: VIEW.width / (2 * zoom) - ox,
  y: VIEW.height / (2 * zoom) - oy,
  zoom,
});
```

- In that block replace each `camera = { x: A, y: B, zoom: Z }` with `camera = withOrigin(A, B, Z)` and each `findItemAtPoint(verses, camera, sx, sy)` with `findItemAtPoint(verses, camera, VIEW, sx, sy)`. The screen numbers and expected hits stay as written; this is Review Focus 1.

`rendering.test.ts` (canvas 800×600 device pixels, dpr 2, so 400×300 CSS): the `pan` expectation near line 198 becomes

```ts
expect(context.gl.uniform2f).toHaveBeenCalledWith(
  context.programs.main.uniforms.pan,
  400 / (2 * 1.5) - 100,
  300 / (2 * 1.5) - 200,
);
```

Apply the same form to any other `uniforms.pan` expectation in the file.

`mapTitle.test.ts`: change the `at` helper to return the offset and zoom the function now takes — `const at = (zoom: number, x = 0, y = 0) => [{ x, y }, zoom] as const;` — and every call to `updateMapTitlePosition(title, ...at(…))`.

`view-state-restore.test.ts`: `cameraForView(view.camera, verse, { x: 500, y: 400 }, { width: 1000, height: 800 })`, and compute `screenX`/`screenY` with `worldToScreen({ x: verse.x + verse.size / 2, y: verse.y + verse.size / 2 }, camera, { width: 1000, height: 800 })`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/__tests__`
Expected: FAIL — typecheck errors on the new signatures, and wrong screen positions.

- [ ] **Step 3: `src/camera.ts`**

Replace `createCamera` and its comment:

```ts
// Opens with Genesis 1:1, the rightmost verse after the RTL mirror, this far
// in from the window's right edge.
const RIGHT_MARGIN = 320;
// Room for the book labels above the first row.
const TOP_MARGIN = 40;

export function createCamera(
  viewport: Viewport,
  bounds: Bounds,
  windowWidth: number = viewport.width,
): Camera {
  return {
    x: bounds.width - (windowWidth - RIGHT_MARGIN - viewport.width / 2),
    y: viewport.height / 2 - TOP_MARGIN,
    zoom: 1.0,
  };
}
```

Delete `panForZoom` and `panToFocus` with their comments. In `cameraToFit` replace the return:

```ts
  return {
    x: box.minX + boxWidth / 2,
    y: box.minY + boxHeight / 2 - (centreY - height / 2) / z,
    zoom: z,
  };
```

`viewFocusedOn` gains `viewport: Viewport` as its last parameter and returns `{ ...centreForFocus(item, zoom, focus, viewport), zoom }`. Move the `Viewport` interface above `createCamera` so it is declared before use.

- [ ] **Step 4: `src/hitDetection.ts`**

Delete `screenToWorld`. Import `screenToWorld, type Camera, type Viewport` from `'./camera'`. `findItemAtPoint` becomes:

```ts
export function findItemAtPoint<T>(
  verses: SpatialItem<T>[],
  camera: Camera,
  viewport: Viewport,
  screenX: number,
  screenY: number,
): SpatialItem<T> | null {
  const { x: worldX, y: worldY } = screenToWorld({ x: screenX, y: screenY }, camera, viewport);
```

(rest unchanged).

- [ ] **Step 5: `src/rendering.ts` and `src/mapTitle.ts`**

In `rendering.ts` import `viewOffset` from `'./camera'` and add:

```ts
function offsetFor(canvas: HTMLCanvasElement, dpr: number, camera: Camera): { x: number; y: number } {
  return viewOffset(camera, { width: canvas.width / dpr, height: canvas.height / dpr });
}
```

In `render`, compute `const offset = offsetFor(canvas, dpr, camera);` once, then:
- `gl.uniform2f(programs.main.uniforms.pan, offset.x, offset.y);`
- `updateLabelPositions(window.bookLabels, offset, camera.zoom);`
- `updateMapTitlePosition(window.mapTitle, offset, camera.zoom);`

In `renderOutline`: `const offset = offsetFor(canvas, dpr, camera);` and `gl.uniform2f(programs.outline.uniforms.pan, offset.x, offset.y);`.

`mapTitle.ts`: `updateMapTitlePosition(title: MapTitle, offset: { x: number; y: number }, zoom: number)`; replace `camera.zoom` with `zoom` and `camera.x`/`camera.y` with `offset.x`/`offset.y`; drop the now-unused `Camera` import.

- [ ] **Step 6: `src/viewState.ts` and `src/scrollytelling/storyPanel.ts`**

`viewState.ts`: import `centreForFocus, type Camera, type ScreenPoint, type Viewport`; `cameraForView` gains `viewport: Viewport` and returns `{ ...centreForFocus(verse, camera.zoom, focus, viewport), zoom: camera.zoom }`.

`storyPanel.ts`: import `centreForFocus` in place of `panToFocus`. `cameraForVerse` takes `mapSize: MapSize` last and returns `{ ...centreForFocus(verse, zoom, focus, mapSize), zoom }`; its comment becomes `/** The camera that puts a verse at \`focus\`. */`. In `resolveStops`, both verse branches require `mapSize` alongside `focus` (`verseLayout && focus && mapSize`, `stop.verse && verses && focus && mapSize`) and pass it on.

- [ ] **Step 7: `src/main.ts`**

Add, beside `mapFocus()` (hoist it above its first use if needed; it only reads `canvas`):

```ts
function mapViewport(): Viewport {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}
```

Then, by line in today's file:
- 317: `const camera = createCamera(mapViewport(), bounds, window.innerWidth);`
- 493 `centerOnVerse`: `Object.assign(camera, centreForFocus(verse, camera.zoom, mapFocus(), mapViewport()));`
- 518: `viewFocusedOn(verse, camera.zoom, RESULT_CLICK_ZOOM, mapFocus(), mapViewport())`
- 549–557 `zoomAt`: replace the `panForZoom` lines with `Object.assign(camera, zoomAtPoint(camera, clampZoom(camera.zoom * factor), { x: screenX, y: screenY }, mapViewport()));`
- 565–567: `const offset = viewOffset(camera, mapViewport());` then `updateLabelPositions(window.bookLabels, offset, camera.zoom);` and `updateMapTitlePosition(window.mapTitle, offset, camera.zoom);`
- 656–657 drag: `camera.x -= dx / camera.zoom;` and `camera.y -= dy / camera.zoom;`
- Every `findItemAtPoint(verses, camera, …)` (676, 691, 799, 1362): insert `mapViewport()` after `camera`.
- 767: `const book = findNearestItem(verses, camera.x, camera.y)?.book ?? '';` and delete the `centre` line.
- 1420: `cameraForView(next.camera, verse, mapFocus(), mapViewport())`.
- Imports: drop `panForZoom`, `panToFocus`, and `screenToWorld` from `./hitDetection.ts`; add `centreForFocus`, `zoomAtPoint`, `viewOffset`, `type Viewport` from `./camera.ts`.

Run `npx tsc --noEmit` and fix any caller the list above missed the same way.

- [ ] **Step 8: `src/main-talmud.ts` — compile only**

The Talmud page is out of scope and due its own rework. It imports `createCamera`, `panForZoom` and `findItemAtPoint`, so change only what the typecheck demands, and accept that it draws in the wrong place until that rework:

- 73: `createCamera({ width: window.innerWidth, height: window.innerHeight }, bounds)`.
- Wheel handler: replace the `panForZoom` block and the three assignments after it with `Object.assign(camera, zoomAtPoint(camera, newZoom, { x: e.clientX, y: e.clientY }, { width: window.innerWidth, height: window.innerHeight }));`; import `zoomAtPoint` in place of `panForZoom`.
- Both `findItemAtPoint` calls: insert `{ width: window.innerWidth, height: window.innerHeight }` after `camera`.

Nothing else in the file changes.

- [ ] **Step 9: Run everything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add -A src
git commit -m "Make the camera name the map point at the centre of the canvas"
```

---

### Task 3: Blend zoom by its logarithm

**Files:**
- Modify: `src/scrollytelling/interpolation.ts`
- Test: `src/__tests__/unit/camera-glide.test.ts`

**Interfaces:**
- Consumes: `lerpCamera(from, to, t)` — signature unchanged.

- [ ] **Step 1: Write the failing test** — append to `camera-glide.test.ts`, importing `lerpCamera` from `'../../scrollytelling/interpolation'`:

```ts
describe('lerpCamera', () => {
  it('takes each doubling of zoom in the same time', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 0, y: 0, zoom: 4 };
    expect(lerpCamera(from, to, 0.5).zoom).toBeCloseTo(2, 10);
    expect(lerpCamera(from, to, 0.25).zoom).toBeCloseTo(Math.SQRT2, 10);
  });

  it('lands exactly on both ends', () => {
    const from = { x: 3, y: 4, zoom: 0.3 };
    const to = { x: 30, y: 40, zoom: 7 };
    expect(lerpCamera(from, to, 0)).toEqual(from);
    expect(lerpCamera(from, to, 1)).toEqual(to);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/__tests__/unit/camera-glide.test.ts`
Expected: FAIL — halfway zoom is 2.5, not 2.

- [ ] **Step 3: Implement** — in `lerpCamera` replace the zoom line:

```ts
    // By ratio, so each doubling takes the same time.
    zoom: from.zoom ** (1 - t) * to.zoom ** t,
```

If the exact-ends test fails on floating point, return `to.zoom` when `t === 1` and `from.zoom` when `t === 0`.

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scrollytelling/interpolation.ts src/__tests__/unit/camera-glide.test.ts
git commit -m "Blend glide zoom by its logarithm"
```

---

### Task 4: Check it by eye and open the PR

**Files:** none changed unless a check fails.

- [ ] **Step 1: Layout tests** — `npm run test:layout`. Expected: pass, or only the failures already listed in `layout/known.ts`. Read two or three PNGs in `layout-report/shots/` to confirm the map drew.

- [ ] **Step 2: Start a dev server** — `npm run dev` as a background task; read the port from its output; `curl -s http://localhost:<port>` responds.

- [ ] **Step 3: Look in a browser** (the extension tab is hidden, so drive scroll by hand; see memory on hidden-tab verification):
  - Story: step through `intro` → `a_book` → `verses`; the stop's target stays on a straight path while zooming, with no swing sideways.
  - Explore: hard-load `/#overlay=none&zoom=3&x=<cx>&y=<cy>` with a verse's map coordinates; that verse is in the middle. Resize the window; it stays in the middle.
  - Drag, wheel zoom, the + and − buttons, hover and click all behave as before.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "The camera names the centre of the screen" --body "…"
```

The body starts with `🤖 Claude:`, explains the change in plain English, links the spec, notes the opening camera sits 60 px under the panel (unchanged, flagged), embeds the layout shots for the story start and one explore state by commit-pinned URL, says what to look at on the `workers.dev` preview (a story glide; one link opened at two window sizes), and ends with the Claude Code attribution line.
