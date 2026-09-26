# The Camera Names the Centre of the Screen

**Date:** 2026-09-26
**Status:** Design agreed; not yet built.

## The problem

The camera's `x` and `y` are an offset that puts the map's origin at the
top-left corner of the canvas: a map point lands on screen at
`(mapX + camera.x) × zoom`. What sits in the middle of the screen is
`width / (2 × zoom) − camera.x`, so it depends on the zoom and on the window
size. Two things follow.

- A link says where the top-left corner was, not what the sender was looking
  at. Open it in a window of a different size and the view is somewhere else.
- A glide blends the offset and the zoom each in a straight line, so the middle
  of the screen wanders on the way. Zooming 1× to 4× on a fixed point pulls the
  middle about 11% of the screen width off it at the halfway mark. Every story
  stop, search-result glide and return to the story does this.

## The decision

`Camera` stays `{ x, y, zoom }`, and `x`, `y` become **the map point at the
centre of the canvas**. The canvas already ends at the panel's edge, so this is
the middle of the visible map on every device, phone included.

The URL keeps its `x` and `y` keys with the new meaning. Links shared before
this change will open somewhere else; that was accepted.

Two alternatives were set aside. Converting only at the URL fixes links but
leaves glides drifting. Converting to centres only inside the glide fixes both
but leaves two meanings of "camera position" side by side.

## The conversion lives in one place

`src/camera.ts` gets the pair of functions between map and screen:

    screenX = (mapX − camera.x) × zoom + width / 2
    mapX    = (screenX − width / 2) / zoom + camera.x

and the same for y with the height. Everything that computes
`(mapX + camera.x) × zoom` today goes through them.

- **Rendering** (`src/rendering.ts`). The shaders keep their offset uniform;
  the renderer derives the top-left offset from the centre and canvas size once
  a frame and hands it to the shaders, the book labels (`src/labels.ts`) and
  the map title (`src/mapTitle.ts`).
- **Hit detection** (`src/hitDetection.ts`) takes the canvas size.
- **Drag** moves the centre against the pointer: `camera.x −= dx / zoom`.
- **Zoom at a point** (`panForZoom`) keeps the map point under the cursor or
  pinch fixed, with the formula rewritten for centres.
- **`panToFocus`, `cameraToFit`, `viewFocusedOn`** return centres.
  `panToFocus` still puts a verse at the phone's raised focus point; the centre
  then sits below the verse.
- **`createCamera`** still opens with Genesis 1:1 320 px in from the right
  edge, expressed as a centre.
- **Telemetry** (`src/main.ts`, the settled-view report) reads the centre from
  the camera instead of computing it.

The Talmud page (`src/main-talmud.ts`) keeps its own pan code; it is due a
larger rework of its own.

## Glides

`lerpCamera` blends centres in a straight line, so the middle of the screen
travels straight from one stop to the next.

It also blends zoom by its logarithm, `from^(1−t) × to^t`, so each doubling
takes the same time. A straight-line blend of 1× to 10× covers most of the
change in the first half and creeps through the second.

## A behaviour that changes on purpose

A window resize holds the centre fixed instead of the top-left corner. Rotating
a phone or resizing the panel keeps what you were looking at in the middle.

## Testing

- A map point survives a round trip through the two conversion functions.
- Zooming at a point leaves the map point under it fixed.
- A glide between two cameras with the same centre keeps that centre at every
  step. This fails on main.
- A log-zoom glide from 1× to 4× is at 2× halfway.
- The existing camera, hit-detection, URL-state and view-restore tests are
  updated for the new meaning.
- `npm run test:layout`, then a look in a browser at a story glide and at one
  link opened at two window sizes.
