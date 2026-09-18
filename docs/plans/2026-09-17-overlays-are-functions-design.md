# Overlays Are Functions — Design

**Issues:** #179 (shape), #177 and #178 (the P1 bugs that follow from it),
#74, #76, #122, #169, #192
**Date:** 2026-09-17
**Status:** Implemented on `worktree-overlay-as-function`.

## The problem

An overlay's colour rule was `getVerseColor(verse)`, with no settings argument:
the settings lived in module variables (`currentCategory`, `currentCustom`,
`selectedTrop`, search's `terms`) that every other member read and wrote. There
was no function from settings to colours, only "write the settings into the
module, then read the colours back out". Both P1 bugs are that sentence.

**#178.** To sample a story stop, the blender wrote the stop's parameters into
the overlay and read its colours back, so the sampled stop stayed current
afterwards and a hover repainted from the wrong stop. Through the Abraham stops
it also re-ran the full-corpus search, rebuilt the results list and sent an
analytics event for each term on each sample. How often that happened per frame
was read from the code, not measured.

**#177.** Restoring from a link applied only the fields the link mentioned, so
returning to an empty hash left the previous overlay, pin and mode on screen.
The reader and the writer of the URL also disagreed about what made a link
Explore.

## What an overlay is

```
f(items, settings, hovered) -> colours
```

Everything else is the data `f` reads, the settings `f` takes, or presentation
that shows the settings and asks for new ones. The overlay keeps no settings of
its own, and no hovered verse.

## Settings

Each overlay that has settings defines their type (`CommentarySettings`,
`SearchSettings`, ...) and four members: `defaultSettings()`, `urlParams` (the
link keys it reads, each with a default), `settingsFromUrl` and `settingsToUrl`.
An overlay has all four or none; the type makes a half-converted overlay a
compile error. Settings are typed per overlay rather than being the link's
strings because they hold things a link does not: a search term keeps its colour
slot when the reader deletes its neighbour, and that slot is not in the URL.

The app holds every overlay's settings in one store (`src/overlays/settings.ts`),
keyed by overlay id, so switching away and back finds what you left. Every member
that depends on settings is handed them as an argument. A control asks for a
change by passing `onChange` a function from the current settings to the next;
the app applies each such update exactly once, immediately. A link or a story
stop becomes settings through one function, `settingsFromLink`: validate the
parameters against `urlParams` (which fills in defaults), then `settingsFromUrl`.

## Colours

An overlay has two colour members. `getVerseColor(verse, settings)` is required;
`colorsFor(items, settings, hovered)` gives many verses at once and takes the
hovered verse. In every overlay both go through one internal rule, so the rule is
written once. A test requires every registered overlay to implement `colorsFor`.

The map has one colour layer, either the settled overlay's colours or a story
transition's blend. Hover and pin are painted on top of it by one composite step
(`computeItemStates` then `applyItemColors`), which takes a colour array rather
than an overlay, so story and Explore paint the same way.

The settled layer calls `colorsFor` with the hovered verse, exactly as the blend
does, so the two cannot disagree. Only Haftarah's colours depend on the hover:
hovering a reading brightens it and its paired passage and desaturates the rest.
Haftarah declares `hoverChangesColors(before, after, settings)`, which answers
whether moving the hover changes its colours; a verse outside every reading
counts as no hover. That member is also what marks an overlay as hover-dependent.

When the hovered or pinned verse changes, `main.ts` repaints through one
function:

- during a story transition, a hover change re-blends with the new hovered verse;
- otherwise a hover change recomputes the settled layer only if the overlay says
  its colours changed;
- a pin or unpin never recomputes the layer; it only composites.

`main.ts` keeps the current transition (the two stops and how far between them)
while one is on screen, and clears it when the scroll settles on a stop or the
story closes. A scroll fires no pointer event, so each scroll frame re-runs hit
detection under the last cursor position, settled frames included.

## The blender

`computeBlendedColors` calls `colorsFor` for the two stops and blends the arrays.
It imports nothing that writes, so it cannot leave anything behind. Results are
memoised per verses array, keyed by overlay id and the stop's validated link
parameters; the key is canonical because the validator writes keys in the order
`urlParams` declares them. Stops that ask for the same thing share an entry, and
the blender never knows how many stops exist or what they are called. A
hover-dependent overlay is computed fresh while a verse is hovered, since caching
by hover would add an entry for every verse the cursor crosses. A stop whose
overlay has no `colorsFor` blends as the default grey.

## Links

Parsing resolves a complete view state (`resolveViewState` in `viewState.ts`):
mode, story stop, overlay, link parameters, verse and camera, with every absent
field at its default. A link that names a story stop, or names nothing at all,
opens the story; any other link is Explore, including one carrying only a
camera. Applying it is one ordered pass: mode, overlay, settings, controls,
verse, camera, paint. Settings land before the controls that show them, which
fixes a dropdown showing the wrong category (#76, #122). The camera takes the
link's zoom before centring on the verse (`cameraForView`); centring first
put a zoomed link's verse off screen and painted a black canvas (#169).

Nothing a restore does may write the URL; `applyingExternalState` in
`urlState.ts` blocks those writes for its duration.

## What this closes

#179, #177, #178, #74, #76, #122, #169, and #192 (clicking a search result did
nothing after switching overlays, because leaving Search cleared its click
handler). #192 is also a standalone PR; its commit drops out here on rebase once
that merges. #73, validating parameters on the way out, gets easier and stays
open. #56 did not reproduce and is not claimed.

## Testing

- `colorsFor` gives the same colours for given settings whatever else the app
  holds, and the settled map gives the same colours as `colorsFor` for a hovered
  verse.
- Which layer a hover or pin change recomputes is a pure function
  (`layerToRecompute` in `itemColoring.ts`) with its own tests.
- A view state resolves a default for every field a link omits.
- One test per reported bug: a camera-only hash entering Explore, an empty hash
  clearing overlay and pin, a link's category showing in the dropdown, a link
  with a verse and a zoom landing on the verse, a search result clicked after
  switching overlays.

## Findings

- #169 reproduced before the change (`#overlay=search&q=אור&verse=Genesis.1.3&zoom=8`
  loaded to a black canvas; without `zoom=8` it painted) and loads correctly after.
- #56 did not reproduce on `#story=abraham_call`, holding or moving the mouse
  through a transition.
- Found by reading the code, not reproduced: before the hover fix, scrolling onto
  a Haftarah stop with the cursor still lost the pairing highlight when the stop
  settled, and moving the mouse or pinning mid-transition replaced the blend with
  one stop's colours. After the fix, both look right in the browser.
