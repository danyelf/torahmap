# Search as a tool of its own

**Date:** 2026-09-27
**Status:** Built (#266).
**Issue:** #234. Step 2 of `2026-09-23-ui-information-hierarchy-design.md`.

## The problem

Text Search is an entry in the overlay list, so the map shows a search or an
overlay, never both. Picking a search throws away the overlay the reader had;
picking an overlay clears the search. A question like "which verses with
אברהם are in the haftarot?" cannot be asked on one map.

The code assumes one overlay throughout: the colour pipeline takes one colour
layer, the URL reads only the active overlay's keys, a story stop names one
overlay, and the verse popup, hover and telemetry each ask "the" overlay.

## The decision

Search leaves the overlay list and becomes a tool beside it. Either, both or
neither can be on.

### How a verse is coloured

Three layers, top to bottom: search, the overlay, grey. Each gives a colour
for a verse or passes it down.

- **A match with an overlay on** is a donut: the search colour as a ring, the
  overlay's colour in the hole at full strength. The ring is 1.5px outside the
  square and 1px inside it, in screen pixels, so it does not thin as the map
  zooms out.
- **When the square is too small on screen to leave a hole**, the match is
  filled whole in its search colour, and the overlay's colour for that verse is
  lost. Zoomed out, the search colour does the work; the overlay's value
  matters when zoomed in, where there is room for the hole. A reader who wants
  the overlay back turns the search off.
- **A verse that does not match**, while a search is on, shows the overlay's
  colour (or grey, with no overlay) dimmed by a smidge. The amount is one
  variable, to be tuned by eye.
- **A match with no overlay** is filled in its search colour, and non-matches
  are dimmed grey: search on its own looks as it does today.
- **With no search on**, the overlay's colours pass through unchanged.
- **A verse several words match** splits into corner-to-corner bands and grows
  slightly, as #246 settled (`2026-09-24-multi-hit-verses.md`). As a donut its
  ring splits the same way.

The design document's earlier "overlay dimmed behind filled hits" and its
rejection of rings stand corrected: the rings were rejected for thinning to
nothing zoomed out, which screen-pixel widths and the full-square fallback
answer.

A stricter view, the overlay colouring only the matches, is not part of this
step.

### The URL and story stops

- The search has its own keys, read whatever overlay is on:
  `search=אברם,אברהם`, with today's `mode=` and `m=` for how each word
  matches. `#search=אברם&overlay=commentary&cat=liturgy` has both on.
- `search`, `mode` and `m` are reserved, so no overlay can claim them.
- `overlay=search` is an unknown overlay and is ignored. Old search links open
  with no search; they are not translated.
- A story stop can say `search: …` and, separately, `overlay: …`; each is
  optional. The nine stops in `public/data/story.md` that say
  `overlay: search | q: …` become `search: …`. The parser sends `search`,
  `mode` and `m` to the search and every other key to the overlay.

### History

Turning a tool on or off adds a browser history entry; editing it replaces the
current one. So Clear, and removing the last word, can be undone with Back;
the first word typed adds one entry, and later typing does not add more.
Switching overlays and pinning a verse add entries, as today.

### Panels, menu and legend

- **Menu:** Continue the story, Search, Overlays, Stories, About & settings.
- **Search panel** (a fourth panel, titled *Search*): the word rows with their
  substring/word/meanings switches, "+ add a word", the match count, the
  results list, and a **Clear** button. The results fill the panel as they do
  now. The search controls that miss the 24px touch-target rule (the × and
  the three switches) are enlarged in the move.
- **Overlay panel:** its picker loses Text Search: None, Commentary, Trop,
  Haftarah, Verse Length.
- **Legend:** one row per tool that is on, search first to match the layering
  (*Search · ■ אברם ■ אברהם*, then *Commentary ▬▬*). Each row opens its panel.
  No card with neither on. The legend has no ×; turning search off is Clear, or
  removing the last word.
- **A word clicked in the verse popup** adds itself to the search and leaves
  the overlay alone, opening the Search panel as it opens the search today.
- **Verse popup:** shows both tools: the overlay's line (*680 references*) and
  search's *Matches: …*, with the words highlighted in the verse.
- **Phone:** Search is one more panel in the sheet; typing takes the sheet to
  full height, as now.

### Telemetry

`overlay_switch` never reports search. `search_execute` is unchanged, and now
also covers searches made with an overlay on. `sefaria_click` records the
overlay, as now.

## How it fits the code

- **Search keeps its module** (`src/overlays/search/`: settings, controls,
  results, summary, popup highlighting) but leaves the overlay registry. The
  app holds the current overlay and the search as two slots. Search's colour
  function gives a match's colour or nothing.
- **Each verse has a fill and a ring colour.** A verse without a ring has its
  ring equal to its fill, and draws as today. A pure function in
  `src/itemColoring.ts`, ahead of the existing two passes, combines the search
  and overlay layers into fills and rings, applying the dimming. It takes and
  returns plain arrays, and gets unit tests.
- **The renderer** (`src/rendering.ts`, instanced since #258) takes the ring
  colour per verse and the ring widths as uniforms, draws the donut, and fills
  the square with the ring colour when it is too small on screen for a hole.
  The outside width must stay under half the 2-unit gap between squares at the
  zooms where donuts show, so rings never touch.
- **Story blending** cross-fades whole pictures between stops (#260), and
  each picture carries its rings, so a donut fades in with the rest of the
  picture. A stop's picture comes from its search and its overlay, and the
  per-stop cache is keyed by both.
- **Everything else that asked "the overlay"** asks both: hover recolouring
  (`layerToRecompute`), the verse popup (`src/sidebar.ts`), the URL writer and
  reader (`src/urlState.ts`, `src/viewState.ts`), the dev capture tool, and
  the word-click handler, whose workaround for losing the overlay goes.
- **The frame** gains the `search` panel in `src/frame.ts`; the legend in
  `src/main.ts` renders a row per tool.

The Talmud page combines two overlays its own way (`composeWithMgBase`) and
has no search; it is left alone.

## Order of work

Each piece can be checked on its own before the next depends on it.

1. The fill-and-ring combining, with unit tests.
2. The renderer's donut, as a prototype on the real build: the ring widths, the
   size at which it falls back to a full square, and the dimming are judged by
   eye at several zooms before anything else depends on them.
3. The URL and the story-stop format.
4. The panels, menu, legend, popup and history.
5. The layout tests (a state with search and an overlay both on), then the nine
   story stops.

## Still to settle by eye

- How much non-matching verses dim.
- The ring itself: its widths and fall-back size, starting at 1.5px out and
  1px in, and its design, which the prototype may change.
