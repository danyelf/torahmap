# The Story Panel

**Date:** 2026-09-17
**Status:** Agreed with Danyel. Not yet implemented.

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

One panel, always present, in three zones down a single column.

**Controls** at the top, in both modes: the overlay picker, the search box when
search is active, and the legend. Fixed height while the story shows — see
below.

**The story** beneath them, taking the rest and scrolling. An `×` in its corner
puts it away; the controls then expand into the whole column and a **Show the
story** control appears where the story was.

**A footer** holding **About & credits**, which opens the existing modal.

There is no story mode and no explore mode. There is one panel whose story
section is showing or not, and `AppMode` goes with them.

## Who drives

The story drives the map *and* the controls while the reader lets it. The
picker visibly lands on Haftarah; the search box visibly fills with
`אברם,אברהם`. That is the teaching.

Touching any control hands over, and so does any map interaction that changes
what is shown — dragging, zooming, clicking a verse to pin it. Hovering does
not. Everything stays live — nothing is disabled or read-only — and the story
stops asserting itself.

Scrolling the story panel deliberately eases the reader back onto the story's
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

## The fixed band

The controls occupy a constant height while the story shows, so the story's top
edge never moves. A maximum would not do: the overlay changes at story stops,
so a variable band would shift the prose vertically while the reader is reading
it.

Measured at the panel's real 380px width, header plus overlay controls plus
legend:

| overlay | height |
| --- | ---: |
| None | 53px |
| Commentary | 115px |
| Verse Length | 138px |
| Haftarah | 181px |
| Text Dating | 189px |
| Search | 202px |
| Trop | 426px |

Trop is a grid of cantillation-mark tiles the reader picks from by eye. It is
tall because it has to be, and it will not shrink.

A story may use any overlay, Trop included, so the band cannot be sized to the
ones today's story happens to use. Instead each overlay has two forms. The
**summary** is one line saying what is selected — the search terms, the chosen
trop mark — and is what the band shows. The **full controls** — the trop grid,
search's options — appear when the reader takes the wheel or puts the story
away.

The band is therefore picker, summary line and legend, whatever the overlay.
The legend is now the tall part: Text Dating's is the tallest at 136px, which
puts the band at roughly **225px**. The exact figure waits on the summary line
existing to be measured.

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

**Leaving the story (#85)** is an `×` on the story section, paired with **Show
the story** to bring it back. "Explore freely" described a mode that this
design no longer has.

## Mobile

The panel stays a bottom sheet at 50vh and holds the same three zones. The band
is the picker and a one-line summary of the legend: the picker's measured 53px
plus one line, about 90px, leaving roughly 330px of story on an 844px phone.
The full legend appears when the reader takes the wheel or puts the story
away.

## Open questions

Written down because they were not settled, not because they are unimportant.

- **The 60px threshold and the 700ms ease-back are unmeasured.** Both came out
  of building the prototype rather than out of evidence. Danyel drove all four
  rejoin behaviours and picked this one, but the trigger is what he was judging;
  neither number has been tuned.
- **Whether a hidden story stays hidden on a return visit** is undecided. It is
  the same question as the help modal's `torahMap.helpSeen`, and should probably
  get the same answer.
- **What a one-line legend summary says** is undecided per overlay. A
  continuous scale might become a thin gradient strip; a category legend
  might become its swatches without labels.
- **What the footer costs on mobile** has not been measured. The 330px figure
  above does not account for it.

## Prototype

A throwaway prototype of all four rejoin behaviours lives in
`.superpowers/brainstorm/` (gitignored). It mirrors the rest-zone maths from
`src/scrollytelling/controller.ts` so the pacing matches, over a stand-in 2D
map. It is not app code and nothing should be lifted from it.
