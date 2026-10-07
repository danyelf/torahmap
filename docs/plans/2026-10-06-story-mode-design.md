# The Story Column Out of main.ts

**Date:** 2026-10-06
**Status:** Design, for review. A step of #342, in place of "stories optional".

## The problem

`main.ts` is 2,000 lines, and about 500 of them are story mode, reading and
writing the shell's variables freely. No part of it can be understood or
tested alone, and the shell cannot move into a package (project 2) with it
inside.

Every text will have stories, the Talmud included, so the shell keeps
requiring them. The Talmud's one-stop story stays a marked shortcut until it
has a real one.

## The idea

A **view** is what the map shows at a moment: where the camera is, the
overlay and its settings, the search, the pinned verse. A link describes one,
and so does every story stop.

The **story column**, the story in the left column (a strip along the bottom
on a phone), owns where the reader is in the stories, and answers one
question: given where the reader has scrolled, what should the map show? At a
stop, that stop's view; between two, both and how far along. It never touches
the map.

The **shell** asks the column for its view whenever the column says it moved,
and puts it on the map. Who is moving the map (the reader, the story, an ease
back to the story, a search result's glide) is the map's business, and stays
with the shell.

## The story column

`src/scrollytelling/storyColumn.ts`. Made from the column's elements, the set
of stories, and a function that resolves a story's stops against the map as
it is now (the text's `stories.resolve`, given the shell's camera, focus and
viewport).

```ts
interface StoryColumn {
  /** What the story shows where the reader has scrolled: `from` and `to` are the same stop at rest. */
  view(): { camera: CameraPosition; from: ResolvedStoryStop; to: ResolvedStoryStop; t: number };
  /** The reader moved the story: scrolled it, or on a phone turned to another stop. */
  onMove(listener: (how: 'scroll' | 'page') => void): void;
  /** The story open and the stop the reader is at, for the URL and the menu. */
  where(): { story: Story; stop: ResolvedStoryStop; place: StoryPlace };
  /** The stop a story was left at this visit, or undefined if it has not been opened. */
  leftAt(id: string): number | undefined;
  /** Show the column at a story's stop, by default where it was left this visit, or its start. */
  open(storyId: string | null, stop?: string): void;
  /** Hide the column, holding the stop it is at: hidden, it has no height to scroll. */
  fold(): void;
  /** How far along the column is scrolled, for the rule that hands the map back to the story. */
  position(): number;
}
```

### What it owns

- The story open, where the others were left this visit, the stop held while
  folded.
- Its stops, resolved when it opens and when the window changes size while it
  shows, and the stop elements drawn for them.
- Reading its own scroll: where between two stops the reader is (today's
  `currentStoryState`), whether a phone has turned to another stop, which
  stop is nearer.
- The progress bar and the title above the column, moved as the reader goes.
- Re-laying itself out when the window crosses between phone and desktop
  width, keeping the reader's stop.

### What it does not own

- **The set of stories** stays the text's slot. The column is handed it, and
  given a new one when a story is edited on the dev server. The Stories panel
  and the starting points read the set and `leftAt`.
- **The frame**: whether the column is showing, which panel is open, the
  menu. The shell opens and folds the column as the frame changes.
- **The map.** Applying a stop's overlay, settings, search and pin; moving
  the camera; painting, blending and easing; deciding who drives.

## What stays in the shell

The map's side, unchanged apart from where its story values come from:

- **Who drives** (`driver`), and its telemetry. A reader action takes the map
  (`takeOver`); scrolling the column far enough hands it back, by the rules in
  `driver.ts`, reading `position()`.
- **The frame loop.** On a move, the shell asks `view()` and paints it: the
  camera, the colours between two stops, or the explore picture at rest. A
  `'page'` move eases in, as a phone's swipe does today.
- **Applying a stop** when the nearer stop changes, and the telemetry for
  reaching one.
- **The flows** that join the pieces: opening a story, leaving it, reading one
  from the Stories panel, following a link to a stop. Each becomes a few
  calls to the column, the driver and the frame.

About 200 of the 500 lines leave `main.ts` in this step. The rest is the
map's, and a later step could give the map's driving its own module, taking
views from the story, from glides and from the video harness alike. That is a
separate idea, not part of this one.

## Testing

What a reader sees does not change, and story mode is the most timing-sensitive
code on the site. So:

- **Unit tests for the column** against a plain element with set sizes: a
  scroll between two stops gives both and the fraction; a fold then an open
  returns to the held stop; switching stories remembers where the old one was
  left; a phone's page turn is reported as `'page'`.
- The scrollytelling unit tests, the layout and loading tests, and the pixel
  comparison against main.
- Scrolling the main story on the branch preview against torahmap.org, on a
  desktop and a phone, including leaving and rejoining mid-ease.

## Also in this step

The story blender (`overlayBlender.ts`) looks a stop's overlay up among the
text's overlays, handed in, rather than the Tanakh's registry.
