# Story Mode Out of main.ts

**Date:** 2026-10-06
**Status:** Design, for review. A step of #342, in place of "stories optional".

## The problem

`main.ts` is 2,000 lines, and about 500 of them are story mode: who is moving
the map, painting the story frame by frame, applying a stop, opening, leaving
and switching stories. The pure parts are already modules
(`src/scrollytelling/`: the controller, the driver rules, colour blending, the
story panel). What stays in `main.ts` is the glue, and it reads and writes the
shell's variables freely, so neither side can be understood alone.

Every text will have stories, the Talmud included, so the shell keeps
requiring them. The Talmud's one-stop story stays a marked shortcut until it
has a real one.

## The design

One module, `src/scrollytelling/storyMode.ts`, owns the story's state. The
shell hands it a host of shell functions and gets back a small object. Story
mode touches the shell only through the host, the way a text touches it only
through `Shell`.

### What moves into story mode

- The current story, the stories listed, where each was left this visit.
- Its resolved stops and their elements, the stop held while the story is
  hidden, the stop last applied.
- **The driver**: who is moving the map (the story, an ease back to it, or the
  reader), and the telemetry sent when it changes hands.
- The frame loop: the scroll listener, `paintStoryFrame`, eases, the picture
  at rest, the progress bar, re-resolving stops on resize.
- The Stories panel's cards.

### What stays in the shell

- The frame (story or Explore, which panel, the menu) and `dispatch`. Story
  mode asks whether the story is showing; the shell tells it when it opens or
  folds.
- Applying a stop to the shell's state (`syncStoryStopState`): the overlay
  and its settings, the search, the front tool, the pinned verse. A stop
  changes what the reader can change, and that state is the shell's.
- The camera, the colour layer, fades, rendering, hover, the URL.

### The host: what the shell hands story mode

```ts
interface StoryHost<I> {
  camera: Camera;                     // story mode moves it each frame
  cancelCameraGlide(): void;
  showing(): boolean;                 // the frame is in story mode
  resolve(stops: StoryStop[]): ResolvedStoryStop[];
  /** The map's colours for a point between two stops. */
  colorsBetween(from: ResolvedStoryStop, to: ResolvedStoryStop, t: number, hovered: I | null): ColorLayer;
  shownPicture(): Picture;            // what is on screen, a fade flattened
  setColorLayer(layer: ColorLayer): void;
  cancelFade(): void;
  paintTools(): void;                 // the explore picture, at rest on a stop
  render(): void;
  applyStop(stop: ResolvedStoryStop): void;
  hoverMoved(): void;                 // re-run hit testing after the camera moved
  syncUrlSoon(): void;
  visited(): void;                    // rememberVisit
  viewSettled(): void;                // markViewSettled
}
```

### What story mode hands back

```ts
interface StoryMode {
  /** Where the map's colours come from: colorSource(driver). */
  colorSource(): ColorSource;
  /** The reader did something to the map: they take it from the story. */
  takeOver(how: ExitHow): void;
  /** The stops whose tools the map shows: one at rest, two in a blend or ease. */
  stopsShown(): ResolvedStoryStop[];
  /** A file landed for what the story shows; true if story mode redraws for it. */
  dataLanded(how: ColorSource): boolean;
  /** The story and its stop, for the URL, the menu and the opening downloads. */
  where(): { story: Story; stop: ResolvedStoryStop; place: StoryPlace };
  open(stop: number, arrive: 'ease' | 'cut', how: ReturnHow): void;
  read(id: string, fromStart: boolean): void;   // from the Stories panel or a start row
  openFromLink(storyId: string | null, stopId: string | null): void;
  fold(): void;                       // the shell is closing the story
  listed(): readonly Story[];
  storiesChanged(list: readonly Story[]): void;
  drawStories(panel: HTMLElement): void;
  scheduleFrame(): void;
}
```

The bare driver stays inside story mode. The shell asks what it needs of it
(`colorSource`, `stopsShown`, `takeOver`), so the driver's rules live in one
place.

## What does not change

What a reader sees. Story mode is the most timing-sensitive code on the site
(scroll, eases, rejoining, phone swipes), so the step is checked by:

- the scrollytelling unit tests, and new ones for story mode against a fake
  host: a reader action takes the map, a fold holds the stop, a link cuts to
  its stop;
- the layout and loading tests, and the pixel comparison against main;
- scrolling the main story on the branch preview against torahmap.org, on a
  desktop and a phone, including leaving and rejoining mid-ease.

## Also in this step

The story blender (`overlayBlender.ts`) looks a stop's overlay up among the
text's overlays, handed in, rather than the Tanakh's registry.
