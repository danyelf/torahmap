# A Scripted Video of the Map

**Date:** 2026-09-27
**Status:** Design agreed; not yet built.

## The problem

Danyel is making a video of the map, with a voiceover recorded separately. He
wants the picture to come from a script: a list of scenes that plays the same
way on every take, so the narration can be timed against it. Most scenes show
a finished view — the right overlay, the right settings, the camera in place —
and the map moving smoothly from one to the next. A few act out the interface
as a person would use it: a click, a word typed a letter at a time.

## Decisions

- **The harness is kept apart from the app.** It lives in `video/`, beside
  `layout/`, and drives the app from outside, the way the layout tests do.
  Nothing under `src/` changes. The one place this may not hold is named
  under *Unsolved*.
- **Frames are rendered, not screen-recorded.** A headless browser plays the
  script on a fake clock and screenshots every frame, so the output is smooth
  and the same on every run however slow the machine is.
- **The script is a text file; times are found by rehearsing.** You write the
  scenes and the narration; you rehearse by reading aloud and pressing a key at
  each scene; the key presses become the times the render uses.
- **Story and tool can share a video.** A story scene scrolls the story and
  lets it animate the map itself. A tool scene is explore mode, with the
  harness moving the camera.

## What was measured

Two throwaway tests, with no change to the app, at 1920×1080 in headless
Chromium with software WebGL (the layout tests' settings) and Playwright's fake
clock (`page.clock`), which takes over `requestAnimationFrame`,
`performance.now`, `Date` and timers:

- **The camera, through the URL.** Writing a new `x`, `y` and `zoom` into the
  URL on every frame glided the map from the whole Tanakh down to Genesis 12
  with the Abram search open. The app redrew each frame correctly; no page
  errors.
- **The story, through scrolling.** Setting the scroll position of
  `#story-content` a little further each frame took the story from its first
  stop to the Abram stop, with its own camera glide and colour fade, and the
  app updated the URL to `#story=abraham_zoom` itself.

Each frame costs about 340 ms, almost all of it the screenshot; the URL write
and the clock step take 15 ms. A three-minute video at 60 frames per second is
about an hour to render.

## The script

A markdown file, e.g. `video/scripts/abraham.md`, in the comment syntax of
`public/data/story.md`. The prose under a scene is the narration: the renderer
ignores it, and the rehearsal page shows it as a teleprompter.

```markdown
---
size: 1920x1080
fps: 60
---

<!-- scene: open | story: intro -->
The Tanakh consists of almost twenty-three thousand verses…

<!-- scene: torah | story: intro_fivebooks | over: 3s -->
The Five Books run across the top…

<!-- scene: tool | view: overlay=search&q=אברם&zoom=0.39&x=2832.5&y=500 -->
Outside the story, you can search for yourself.

<!-- scene: zoom_in | view: overlay=search&q=אברם&zoom=2.5&x=3320&y=92 | over: 2.5s -->

<!-- scene: add_isaac | do: click "+ add a word"; type "יצחק" -->
```

Three kinds of scene:

- **`story: <stop id>`** scrolls the story to that stop over `over:`, eased.
  The stop's scroll position is read from its `.story-stop[data-stop-id]`
  element.
- **`view: <URL state>`** is explore mode. A change of overlay or settings is
  applied at the start of the scene, as a cut; the camera then glides to the
  new position over `over:`, one URL write per frame, with zoom eased on a log
  scale so it feels even.
- **`do: <steps>`** acts out the interface: `click "<text>"`,
  `type "<text>"` a letter at a time, `hover <verse>`, `wait <seconds>`.
  These are real mouse and keyboard input.

## Timing

The script holds no times. They live beside it in `abraham.times.json`, a map
from scene name to the second it starts, written by rehearsal and editable by
hand. Kept apart, re-recording the narration never overwrites edits to the
script. A scene's transition plays from its start time; the picture then holds
until the next scene starts.

## Rehearsal page

`video/rehearse.html`, served by the dev server as `test-harness/` is.

- The app runs in an iframe on the left; it is the same origin, so the page
  can set its URL, scroll its story and click in it. The teleprompter is on
  the right: this scene's narration large, the next scene's first line below.
- **Space** moves to the next scene and notes the time. Story and view scenes
  play at their real pace; `do:` steps run quickly, since rehearsal only has to
  look right enough to talk over.
- **Copy timings** puts the times JSON on the clipboard, to save beside the
  script.
- **Capture** reads the iframe's current state and copies a finished scene line
  — `view:` with the URL state, or `story:` with the stop — to paste into the
  script.

## Renderer

`npm run video -- video/scripts/abraham.md`

- Starts its own dev server, opens headless Chromium with the layout tests'
  launch settings, and installs the fake clock before the page loads.
- For each frame: find the active scene and how far into it we are, apply
  that frame's state (a URL write, a scroll position, an input step), advance
  the clock one frame, screenshot, and pipe the image into `ffmpeg`.
- Draft mode — `--fps 10 --scale 0.5 --from 30 --to 45` — renders a rough cut
  of one stretch in a minute or two, to check a change without the full render.
- The mouse stays off the map except in `do:` scenes, so no verse is hovered
  by accident.

## Unsolved

1. **Headless screenshots show no mouse pointer.** In a `do:` scene the viewer
   would see buttons respond to nothing. The harness draws its own: an arrow
   added to the page from outside, gliding to each target before the click.
2. **CSS transitions do not follow the fake clock.** Each frame takes 340 ms
   of real time, so a 200 ms panel slide finishes between two screenshots. The
   browser lists every running CSS animation (`document.getAnimations()`), and
   each can be paused and set to an exact moment; the renderer does that
   before each screenshot. This only matters in `do:` scenes.
3. **Gliding to a pinned verse.** With a verse pinned, the app centres the
   camera on it and leaves `x` and `y` out of the URL
   (`cameraForView` in `src/viewState.ts`), so the harness does not know where
   the glide ends. Try measuring it from outside first. If that proves
   unreliable, the fallback is a one-line change in the app so it always
   writes `x` and `y` — ask Danyel before making it.

## Testing

- The script parser and the timeline — which scene is active at a given
  second, and its state — are plain functions, tested with Vitest. Vitest only
  includes `src/**`, so `video/**` is added to its `include`.
- The renderer is checked by rendering a short sample script in draft mode and
  reading the frames.

## Build order

1. Script parser and timeline.
2. Renderer, with `story:` and `view:` scenes.
3. `do:` scenes, with the drawn pointer and the CSS animations held to the
   clock.
4. Rehearsal page and capture.
