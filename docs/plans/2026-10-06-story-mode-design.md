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

`src/scrollytelling/storyColumn.ts`, where its interface is. Made from the
column's elements, the set of stories, and a function that resolves a story's
stops against the map as it is now (the text's `stories.resolve`, given the
shell's camera, focus and viewport). It answers what the story shows now
(`view`) and where the reader is (`where`, `leftAt`, `position`), and says
when the reader moves it (`onMove`). The
shell opens and folds it, and tells it when the window is resized or the
stories change.

### What it owns

- The story open, where the others were left this visit, the stop held while
  folded.
- Its stops, resolved when it opens and whenever the window changes size, and
  the stop elements drawn for them.
- Reading its own scroll: where between two stops the reader is, whether a
  phone has turned to another stop, which stop is nearer.
- The progress bar, the end-of-story cue and the title above the column,
  moved as the reader goes.
- Keeping the reader's stop when the window crosses between phone and desktop
  width and the stops change axis. Whether the page is laid out for a phone is
  read through `isPhone` (`src/phone.ts`), as the shell reads it.

### What it does not own

- **The set of stories** stays the text's slot. The column is handed it, and
  given a new one when a story is edited on the dev server; the Stories panel
  and the starting points read the list and `leftAt` from it.
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
  camera, the colours between two stops, or the explore picture at rest. On a
  phone a new stop eases in, as a swipe does today.
- **Applying a stop** when the nearer stop changes, and the telemetry for
  reaching one.
- **The flows** that join the pieces: opening a story, leaving it, reading one
  from the Stories panel, following a link to a stop. Each becomes a few
  calls to the column, the driver and the frame.

About 120 lines leave `main.ts` in this step. The rest of story mode is the
map's, and a later step could give the map's driving its own module, taking
views from the story, from glides and from the video harness alike. That is a
separate idea, not part of this one.

## Testing

What a reader sees does not change, and story mode is the most timing-sensitive
code on the site. So:

- **Unit tests for the column**, laid out as on a phone: it opens at the stop
  asked for, holds its stop while folded, remembers where a story was left,
  and says when the reader moves it. Where between two stops a scroll falls
  is `controller.ts`'s, and tested there.
- The scrollytelling unit tests, the layout and loading tests, and the pixel
  comparison against main.
- The opening story scrolled to set places on a desktop, the map taken and
  handed back, and a phone's pages turned, screenshot against main.

## Also in this step

The story blender (`overlayBlender.ts`) looks a stop's overlay up among the
text's overlays, handed in, rather than the Tanakh's registry.
