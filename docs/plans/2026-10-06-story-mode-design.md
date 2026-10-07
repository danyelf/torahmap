# Story Mode Out of main.ts

**Date:** 2026-10-06
**Status:** Design, for review. A step of #342, in place of "stories optional".

## The problem

`main.ts` is 2,000 lines, and about 500 of them are story mode. The pure parts
are already modules: the driver's rules (`driver.ts`), where the scroll falls
between two stops (`controller.ts`), a stop's colours (`overlayBlender.ts`),
the story panel's HTML (`storyPanel.ts`), the telemetry when the map changes
hands (`telemetry/driverChange.ts`). What stays in `main.ts` is the wiring, and
it reads and writes the shell's variables freely, so no part of it can be
understood or tested alone, and the shell cannot move into a package
(project 2) with it inside.

Every text will have stories, the Talmud included, so the shell keeps
requiring them. The Talmud's one-stop story stays a marked shortcut until it
has a real one.

## Three things, two new modules

1. **The set of stories**: what exists, each story's stops, resolving a stop
   against the map. The text's `stories` slot, unchanged.
2. **The story reader** (`src/scrollytelling/storyReader.ts`): the story
   column and where the reader is in it. Which stop is mostly not stored: it
   is read from the column's scroll. What is stored is small: the story open,
   where the others were left this visit, the stop held while the column is
   folded. It never touches the map.
3. **The story driver** (`src/scrollytelling/storyDriver.ts`): who is moving
   the map, the story, an ease back to it or the reader, and moving it frame by
   frame. It asks the reader where the story is and moves the camera and
   colours through the shell. It is the only one of the three that touches the
   map.

The shell keeps the frame (story or Explore, which panel, the menu), applying
a stop to its own state (the overlay and its settings, the search, the front
tool, the pinned verse), and the flows that join the pieces: opening a story,
leaving it, reading one from the Stories panel, following a link to a stop.
Each flow is a few calls to the reader, the driver and the frame.

### The reader

Made from the story column's elements, the stories listed and a function that
resolves a story's stops against the map as it is now.

```ts
interface StoryReader {
  story(): Story;
  stops(): readonly ResolvedStoryStop[];
  /** Where the column's scroll puts the story: between two stops, or at one. */
  state(): InterpolatedState;
  /** The stop the reader is at: the held one while folded, else the nearer. */
  stopIndex(): number;
  place(): StoryPlace;
  /** How far along the column is scrolled, for the driver's hand-back rules. */
  position(): number;
  sideways(): boolean;                // a phone's stops sit side by side
  onScroll(listener: () => void): void;
  /** Fold the column, holding the stop it is at; or bring it back at `stop`. */
  fold(): void;
  show(stop: number): void;
  switchTo(id: string | null): void;  // remembers where the one it leaves was
  listed(): readonly Story[];
  storiesChanged(list: readonly Story[]): void;
  /** The map's size changed: resolve the stops again. */
  resize(): void;
  arrived(stop: ResolvedStoryStop): void;   // moves the progress bar
  drawStories(panel: HTMLElement): void;
}
```

### The driver

Made from the reader and a host of shell functions.

```ts
interface StoryDriverHost<I> {
  camera: Camera;                     // set each frame while the story drives
  cancelCameraGlide(): void;
  showing(): boolean;                 // the frame is in story mode
  colorsBetween(from: ResolvedStoryStop, to: ResolvedStoryStop, t: number): ColorLayer;
  shownPicture(): Picture;            // what is on screen, a fade flattened
  setColorLayer(layer: ColorLayer): void;
  paintTools(): void;                 // the explore picture, at rest on a stop
  render(): void;
  applyStop(stop: ResolvedStoryStop): void;
  hoverMoved(): void;                 // re-run hit testing after the camera moved
  syncUrlSoon(): void;
  visited(): void;
  viewSettled(): void;
}

interface StoryDriver {
  /** Where the map's colours come from: the explore picture, or the story's blend. */
  colorSource(): ColorSource;
  kind(): DriverKind;                 // for the URL and telemetry's mode
  /** The stops whose tools the map shows: one at rest, two in a blend or ease. */
  stopsShown(): ResolvedStoryStop[];
  /** The reader did something to the map, and takes it from the story. */
  takeOver(how: ExitHow): void;
  /** Hand the map to the story, easing there or cutting, as a link does. */
  giveToStory(arrive: 'ease' | 'cut', how: ReturnHow): void;
  /** A file landed for what the map shows; true if the driver redraws for it. */
  dataLanded(how: ColorSource): boolean;
  scheduleFrame(): void;
  /** From the page view on, changes of hands are sent. */
  startRecording(): void;
}
```

The bare driver value never leaves the driver: the shell asks what it needs of
it, so its rules live in one place.

## What does not change

What a reader sees. Story mode is the most timing-sensitive code on the site
(scroll, eases, rejoining, phone swipes), so the step is checked by:

- the scrollytelling unit tests, and new ones for the driver against a fake
  reader and host: a reader action takes the map, a fold leaves the reader
  driving, a link cuts to its stop, data landing mid-ease re-aims the ease;
- the layout and loading tests, and the pixel comparison against main;
- scrolling the main story on the branch preview against torahmap.org, on a
  desktop and a phone, including leaving and rejoining mid-ease.

## Also in this step

The story blender (`overlayBlender.ts`) looks a stop's overlay up among the
text's overlays, handed in, rather than the Tanakh's registry.
