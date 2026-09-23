# Where everything lives: menus, modes and the panel

**Date:** 2026-09-23
**Status:** Designed, not built.
**Issues:** #236 (the phone), #234 (search beside an overlay), #235 (more than
one story), #237 (what an overlay is), and the "share a view" half of #232

## The problem

Four issues arrived separately and turned out to be one. The interface grew a
control at a time, and every control ended up in the same container: the 380px
right panel on desktop, the bottom sheet on a phone. That container now holds
the story, the overlay picker, the chosen overlay's options, its legend, a line
summarising all of it, and a footer of links. Two of those things are modes and
the rest are tools, but nothing on screen says so.

The visible symptoms:

- A reader on a phone sees a strip of colour above the story and cannot tell
  what it is (#236). It is the overlay summary and legend, and nothing labels
  it.
- Picking a search replaces the overlay and picking an overlay clears the
  search, because Text Search is an entry in the overlay list (#234).
- Leaving or resuming the story is a link in a footer, so the mode switch is
  the least visible control on the page.
- An overlay's one-sentence description exists but is only shown in the help
  window, where nobody reads it while using the overlay (#237).
- There is one story and no way to offer a second (#235).

## The shape

![The settled shape](images/2026-09-23-ui-hierarchy/settled-shape.png)

Three ideas carry the whole design.

**A story is a mode, not a drawer.** While a story runs there are no tools on
screen: a column of text on desktop, a sheet on a phone, the map, and one ☰.
There is no exit button, because "leave" was two different things wearing one
word. Moving the map during a story — panning, zooming, pinning a verse — takes
the camera from the story and gives it back at the next stop; that already
works and is not leaving. Leaving is wanting a tool the story does not offer,
so it happens through the menu, or when the story runs out and hands you the
map. A story keeps its place, so Stories always offers to resume.

**The menu drops into the panel the story already owns.** ☰ slides the menu
down over the top of the column, leaving the current stop visible below it,
dimmed. The first item is "Continue the story · 7/21"; then Search, Overlays,
Stories, Share this view, and Settings & About. Closing it returns to the
story; choosing a tool ends the story and leaves the reader standing on the
view it had reached, with its colours still on.

**Outside a story, anything on but not open is a folded line at the bottom edge
of the panel.** On desktop the panel is a column beside an icon rail; on a
phone it is the sheet. A folded line names the thing and shows its legend in
one row — "Commentary ▬▬ to 1,734 ⌃", or a swatch, the search word and its hit
count. Tapping it expands it in place, and whatever was open folds down to take
its place. Nothing travels across the screen, and nothing colours the map
without a label somewhere on it. Since a story is a mode rather than a tool, at
most two lines can be folded at once.

## Search and an overlay together (#234)

Search stops being an overlay and becomes its own tool: its own rail icon on
desktop, its own icon in the top bar on a phone. The overlay picker then only
chooses how the map is coloured.

When both are on, the search hits take the fill in their term colours and the
overlay stays behind them, dimmed. This reads at every zoom and keeps the five
term colours working. The alternative of ringing each hit was rejected: ring
thickness is measured in map units, so at the zoom where you want to see a
word's distribution across the Tanakh the rings are thinner than the squares.

The overlay becomes context rather than a value you can read off a hit. For
"which of these verses is in the prayerbook", the shape of the dimmed
background answers roughly and the pinned verse answers exactly. A stricter
answer — dim every non-matching verse, and let the overlay colour only the
matches — is worth offering later as a switch beside the search box, but it is
not the default, because it throws away the map of everything.

## The two layouts

**Desktop** gets an icon rail: Stories, Search, Overlay, Share, and ☰ Menu at
the foot. The rail is only present outside a story — its absence is what makes
a story a mode. Clicking an icon opens that tool's panel in the column beside
it.

**Phone** gets a top bar — ☰, the name, search, share — that hides as soon as
the map moves, leaving a floating ☰ behind. At rest the sheet is nothing but
the folded lines, one per active thing. The ☰ menu lists the same items as the
desktop menu.

Neither layout has a story strip, a summary line, or a footer of links any
more. The footer's contents move: Hide Hebrew into Settings, About & credits
into the menu, and the story links into the mode itself.

## What each overlay says about itself (#237)

The description each overlay already carries is shown at the top of its panel,
above its options, on both sizes. The help window's Overlays tab keeps being
built from the same strings, so there is still one source. An overlay with
sub-options (Commentary's category, Haftarah's custom) describes the sub-option
on the same line it is chosen from, since "Liturgy" alone does not say what it
counts.

## Stories as a list (#235, #232a)

Stories move from one file to several under `public/data/stories/`, each with a
title and a one-line description the app can read for the menu. The URL names
the story and the stop. Today's `#story=<stopId>` assumes a single story, and
#235 says back-compatibility is not needed, so the hash carries both: story and
stop.

A story shows its progress while it runs and remembers where it got to, which
is what makes "Continue the story" and "Resume" honest. Where that memory lives
— the session, or the address — is an implementation question, not a design
one.

Nothing here hosts other people's stories; that is #232c and stays out of
scope.

## Sharing a view (#232b)

"Share this view" in the menu copies a link to exactly what is on screen: the
overlay and its settings, the search terms and their modes, the pinned verse,
the camera. On a phone it opens the system share sheet. Inside a story it
shares the stop instead, since that is what the reader is looking at. The URL
already carries all of this; the work is a control, a copy, and a confirmation
that something was copied.

## What this leaves open

- Whether the "dim everything that doesn't match" switch ships with this or
  later.
- Whether the resting sheet on a phone with nothing on says "No overlay" or
  disappears. The decision was "No overlay", but it is worth looking at once it
  is real.
- The rail's icons, which are a design job of their own. The emoji in the
  mockup are stand-ins and look like it. What replaces them has to survive
  being small and unlabelled, read at a glance against a dark background, and
  sit with the rest of the site rather than borrowing a generic icon set. Five
  are needed on desktop, plus search, share and ☰ on the phone bar. Worth
  settling before the frame ships, since the rail is the first thing a reader
  meets outside a story.
- Whether search results on desktop belong in the panel, as they are today, or
  deserve more room now that the panel is narrower.

## Order of work

Each step should be a branch that stands on its own, and each changes what the
reader sees, so each wants your eyes before the next.

1. **The frame.** The rail, the panel, folded lines, the ☰ menu, the phone top
   bar that hides. Story mode is still the existing single story; the overlay
   list still contains Text Search. Nothing about the map changes.
2. **Search leaves the overlay list** and becomes a tool, with hits drawn over
   a dimmed overlay. This is the only step that touches colouring.
3. **Descriptions and share.** Each overlay's sentence in its panel, "Share
   this view" in the menu.
4. **More than one story.** The stories directory, the menu list, the URL, and
   resume.
