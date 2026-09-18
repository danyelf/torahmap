# The Story Panel

**Date:** 2026-09-17
**Status:** Agreed with Danyel. Revised after trying the first build (#198):
the fixed band became a summary line and an accordion.

Settles issues #84, #85, #86, #87 and #135 as one design, because each of them
was waiting on the answer to another.

## Problem

The story scroll and the overlay controls take turns in `#right-panel`.
`switchToExplore` and `switchToStory` set `display` on one and clear it on the
other, so leaving the story replaces the panel's contents wholesale.

That costs the story its best teaching moment. Nine of the fourteen stops drive
an overlay — five run a search, two the haftarah map, two commentary — and the
reader sees none of the controls doing it. They finish knowing a great deal
about the Tanakh and nothing about the tool, having watched it used the whole
time.

Two smaller faults follow from the same swap. The legend lives inside
`#explore-panel`, so the story hides it while narrating it: the commentary stop
recites "The Hasidic masters wrote a hundred commentaries on it. The Midrash,
ninety-two" next to a map coloured by exactly that, with the key switched off.
And the haftarah stop tells the reader to "switch the overlay" — an instruction
to do something the story is already doing for them.

## The shape

One panel, always present: an accordion of two sections, controls above the
story, with a footer holding **About & credits**, which opens the existing
modal. Exactly one section is open at a time.

**Controls closed** is a single summary line styled as a form field, with a
chevron: the overlay's name, what is selected (the search terms in their
colours, the chosen trop mark), and the legend's colours as swatches. The story
fills the rest of the column.

**Controls open** is the full panel — picker, the overlay's controls, the
legend, search results scrolling in their own list. The story folds to a
one-line strip showing the current stop's title.

Opening and closing animate. There is no story mode and no explore mode, and
`AppMode` goes with them.

## Who drives

The story drives the map *and* the controls while the reader lets it. The
picker visibly lands on Haftarah; the search box visibly fills with
`אברם,אברהם`. That is the teaching.

Touching any control hands over, and so does any map interaction that changes
what is shown — dragging, zooming, clicking a verse to pin it. Hovering does
not. Everything stays live — nothing is disabled or read-only — and the story
stops asserting itself.

Who drives and which section is open are separate. Opening the controls folds
the story, but dragging or zooming the map does not: panning should not fold
away the prose being read.

Tapping the folded story strip unfolds it and eases the reader back at once.
Scrolling the open story deliberately eases the reader back onto the story's
line over 700ms and carries on from wherever the scroll landed. Deliberately
means past a 60px threshold measured in scrolled distance, so a stray trackpad
nudge over the panel does not yank a view the reader just built. Distance, not
event count: a trackpad fires many small scroll events where a wheel fires few
large ones, and counting events makes the threshold behave differently on
different hardware.

Two facts make this work, and both were checked rather than assumed. The wheel
is bound to the canvas for zoom while the story scroll is bound to
`#story-content`, so "scroll the story" is unambiguous and cannot be confused
with driving the map. And returning the reader to the story's state is the
transition the story already performs between stops — `lerpCamera` for the
view, the overlay blender for the colours — with its start replaced by wherever
the reader left things. It reuses that path rather than adding a second one.

## Why a summary line

The story's top edge must not move while the story drives: the overlay changes
at stops, so anything that resizes with the overlay shifts the prose under the
reader. The summary line is one line for every overlay, so it cannot.

A fixed-height band of full controls holds the edge still too, and the first
build used one. It fails because the controls vary from 53px (None) to 426px
(Trop's grid of cantillation marks), measured at the panel's 380px width. At
None stops the band is a large empty box that reads as the most important thing
on screen; at search stops the controls are cut off at its edge.

## The small controls

**Zoom buttons (#87)** stay at the bottom right of the map on desktop. The
verse popup is bottom *left*, so the collision the issue describes does not
happen. Their offset comes from a `--panel-width` custom property shared with
`#right-panel` and the `#canvas` width calculation, replacing three
hand-maintained copies of the same number.

On mobile they are not rendered. Pinch is already implemented — two-finger
distance and centre tracking feeding the same `zoomAt` the buttons call — and
it is the gesture people reach for on a phone. Today the mobile rule moves them
to `bottom: 60px`, which puts them on top of the panel sheet, 286px below the
map they control.

**Help (#84)** loses its first-visit auto-open. The story is the front door;
two competing ones was the actual fault. The modal itself stays, reached from a
labelled **About & credits** control in the footer rather than a 24px dot hung
off the panel corner at `top: -8px; right: -8px`, where on a phone it is
clipped by the screen edge. Credits to Sefaria, ETCBC and hebcal are an
obligation, so the modal cannot simply go.

**Leaving the story (#85)** is opening the controls; the folded strip is the
hidden state, and tapping it brings the story back. There is no separate `×` or
"Show the story". "Explore freely" described a mode that this design no longer
has.

## Mobile

The panel stays a bottom sheet at 50vh and holds the same accordion. With the
controls closed, the story gets the sheet below one summary line.

## Folding and links

A story folded by the reader stays folded on a return visit. It is only
remembered from the reader opening or closing a section — a shared link that
opens folded does not change what the reader's next visit shows. A link that
names an overlay but no story stop opens with the controls open, the story
folded and that overlay showing, as explore-mode links do today.

## Open questions

Written down because they were not settled, not because they are unimportant.

- **The 60px threshold and the 700ms ease-back are unmeasured.** Both came out
  of building the prototype rather than out of evidence. Danyel drove all four
  rejoin behaviours and picked this one, but the trigger is what he was judging;
  neither number has been tuned.
- **How the summary line gets each overlay's selection and legend colours.**
  The prototype built it from the overlay's name and the story stop's params,
  without changing the `Overlay` interface. An overlay refactor is coming;
  whether the summary becomes part of that interface is decided there.
- **How a continuous scale shows as swatches** — a thin gradient strip is the
  likely answer.

## Prototypes

Throwaway, not app code. Four rejoin behaviours over a stand-in 2D map live in
`.superpowers/brainstorm/` (gitignored). The summary-line and floating-card
layouts were built against the real app on an unpushed branch,
`worktree-agent-ab2445c74545a8a84`; Danyel chose the summary line. The floating
card worked on desktop placed right and a few hundred pixels down, but taking
control from it was awkward, and on a phone it covered the map.
