# Draw First

**Date:** 2026-09-30
**Status:** Draft, for Danyel's design round.

Step 3 of three toward #313, after step 1 (`2026-09-30-overlay-data-design.md`)
and step 2 (`2026-09-30-search-data-design.md`). It is the only step a reader
sees.

## What is decided

Main draws from the structure file alone and loads everything else behind the
first frame, the per-word parse last. Nothing waits, overlay links included. As
each file lands, main updates `loaded` and cross-fades whatever newly has its
data, through the renderer's picture cross-fade, the one the front tool and the
story's ease use. The verse popup stays closed until the texts arrive. The
definition of done is a committed Playwright suite on a throttled connection,
written first.

## Startup

1. Fetch `tanakh-structure.json` (17 KB) and lay out the map. Its failure stops
   the map, as today.
2. Read the link, set up the overlay, the search, the pin and the story from it,
   draw the first frame, and set `data-map-ready` on `<html>`.
3. Start the downloads, in the order below.
4. When every download has landed or failed, set `data-loaded` on `<html>`.

With `loaded` empty, `toolsShown` leaves out every tool, so the first frame is
the plain map whatever the link says. Settings are not touched: the overlay
picker, the search box and the address show what the link asked for from the
first frame.

## The order of downloads

The sizes, compressed: the texts 2.7 MB, the three dictionary files 0.84 MB
together, the per-word parse 0.98 MB, commentary 0.32 MB, haftarah 4 KB.

**The simplest order**: everything but the parse at once, then the parse once
those have settled. The browser shares the connection between them, so on a
slow one a 0.32 MB commentary link waits about as long as the 2.7 MB texts.

**Proposed**: the files the opening view needs first and alone, then the rest
together, then the parse.

- The opening view is what the link shows, or the story stop it opens: the files
  of its overlay, search's files if it searches, and the texts if it pins a
  verse. The bare address opens the tour's first stop, which needs nothing, so
  it goes straight to the second group.
- What this buys: on a bandwidth-bound connection a commentary link colours in
  the time of its own 0.32 MB rather than of 3.9 MB. For a search link it buys
  little, since search needs the texts.
- The choice of files is a plain function, `filesFirst(view, overlays)`, tested
  on its own.

`fetch`'s `priority` option would get much of this without ordering anything,
but browsers differ in whether they honour it.

## When a file lands

One function in main, `fileLanded(path, value)`:

1. `loaded` becomes a new value with the file in it.
2. A plain function decides what is now out of date:

   ```ts
   staleAfterLanding(before: Loaded, after: Loaded, view: {
     overlay: Overlay | null;   // the one picked, whether or not its data is in
     search: boolean;           // whether the search has a word
     panel: Overlay | null;     // the overlay whose controls are drawn
     popup: boolean;            // whether the popup shows a verse
     source: 'overlay' | 'blend' | 'ease';   // colorSource(driver)
   }): { map: 'fade' | 'blend' | 'ease' | null; overlayPanel: boolean; searchPanel: boolean; popup: boolean }
   ```

   A tool is out of date when `dataFor(tool, before) !== dataFor(tool, after)`.
   The map is, when a tool it shows is; the panels, when their tool is; the
   popup, when the texts, search's data or a shown tool's data changed.
3. Main does what it says, with code it already has:
   - **`fade`** (exploring, or the story at rest on a stop): cross-fade from the
     map as it is to `toolsPicture` of the tools now. This is `setFrontTool`'s
     fade, taken out into `fadeMap(to)` so both use it.
   - **`blend`** (the story resting between two stops, partway through a
     scroll): cross-fade from the blend as it is to the blend recomputed with the
     new data, then hand back to the blend. Any story frame cancels the fade, as
     it cancels the front tool's today (`setDriver`), so a reader who scrolls
     during it gets the scroll.
   - **`ease`** (the story easing between stops on a timer): start the ease
     again from where it is, for the time left (`beginEase`), so it ends on the
     picture with the data rather than snapping to it at the end.
   - The panels redraw into what is there (`overlayChanged(false)`,
     `searchChanged(false)`), so a box being typed in keeps its focus and its
     text. The legend redraws with them.
   - The popup redraws for the verse it shows.
4. Hand search's data to the recorder (step 2), and schedule the `prebuild` of
   any tool whose data just became complete.

Under reduced motion each fade is a snap, as the front tool's is today.

**How this is tested without unit tests of `main.ts`.** `staleAfterLanding` and
`filesFirst` are plain and unit-tested, the way `layerToRecompute` is today: a
landing file nobody shown reads changes nothing; the texts landing with trop on
redraw the map and the popup; the parse landing with search on redraws the popup
and not the panels; commentary landing while the story is between stops gives
`blend`. What remains in `fileLanded` is a short sequence of calls to code the
Playwright suite drives.

## The story

`pictureForStop` keeps a stop's picture only once every tool the stop shows has
its data (step 1). A story scrolled before the data shows plain stops; the frame
after a file lands picks up the new colours, mid-scroll by the next scroll frame
and at rest through the cases above.

## Failure of a download

Warned once in the console, and the file stays missing. Whatever named it stays
off the map: picking that overlay shows its controls with `null` data and a
plain map; a failed texts file keeps the popup closed. Every other file loads as
usual, and `data-loaded` is still set. No retry, and nothing said to the reader;
see the open questions. Search follows the rule for any tool: a failed
dictionary turns it off (step 2, open question 4).

## How the layout tests and the video harness know

`data-map-ready` keeps its meaning, the first frame, and the throttled suite
uses it. `data-loaded` is new: every download has landed or failed and its
redraw has been asked for. `layout/page.ts`'s `mapReady` and
`video/browser.ts` wait on `data-loaded` instead, so every layout state is
measured with its data in, as today. The video harness's existing one-second
wait after that covers the last fade.

## The Playwright suite

Written first, before the startup change, and failing on main where it should:
on main the first frame waits for the data.

**Where.** `loading/`, beside `layout/`, with its own `playwright.config.ts` and
`npm run test:loading`. It shares `layout/page.ts` (`drawnPixels`, the error
collection) and the same software-WebGL launch options. One desktop screen and
one phone; it is not a layout test. Chromium only, because throttling is through
the Chrome DevTools Protocol (CDP).

**Throttling.** Every case runs on a CDP-throttled connection
(`Network.emulateNetworkConditions`, a slow mobile profile). Throttling alone
would make "before the data" a race the test hopes to win, which fails on a fast
machine, so a case also **holds** the files it needs absent with `page.route`
until it releases them. "Before the data" is then a state the test sets.

**What it asserts.** Whether things show, not their wording and not how long they
took: the map drew (drawn pixels above the floor), the map changed (canvas
screenshots differ), an element is visible or not, an input keeps its value and
focus, the address keeps a parameter, no page errors.

| Case | Held | Before release | After release |
|---|---|---|---|
| Bare address | everything | `data-map-ready` set; map drawn; story open | `data-loaded` set |
| Overlay link | commentary | map drawn and plain; picker shows commentary; no overlay legend row | map changed; legend row shown; address unchanged |
| Search link | texts, dictionary | map drawn and plain; search box holds the word | map changed; results listed; address unchanged |
| Narrowed search link | dictionary | address still has `m` | exactly the linked meaning checked; address unchanged |
| Pinned verse | texts | popup closed; map centred on the verse | popup open for the verse |
| Overlay picked early | commentary | pick it in the panel; map stays plain | map changed; picker unchanged; address has the overlay |
| Search typed early | texts, dictionary | type a word; it keeps focus | results listed; box keeps value and focus; address has the search |
| Story scrolled early | texts, dictionary | scroll to a stop with a search | map changed; search legend row shown |
| Failed download | commentary aborted | overlay link | `data-loaded` set; map plain; no page errors |

## What #320 got wrong here, and how this avoids it

- **The first frame waited for the link's overlay.** Here nothing waits.
- **Whether a tool's data was in was module state** (`isReady`), read inside
  `toolsShown`, the search caption, hit counts and recording. Here it is
  `loaded`, a value handed to each of them.
- **A term was rewritten when the dictionary arrived** (`adoptLoadedMeanings`,
  `linkMeanings`), which made new settings that recording had to chase. Here a
  term holds what was typed or linked, and its meanings are looked up when
  read, so nothing about a term changes on arrival.
- **The late-arrival code, `toolArrived`, special-cased search and was
  untested.** Here the decision is `staleAfterLanding`, plain and tested, and
  treats search as any tool.
- **It was checked by hand in a browser.** Here a committed suite, written
  first, is the definition of done.

## Open questions for Danyel

1. **The opening view's files first**, rather than everything at once. *Recommend
   yes*: it is one tested function, and it is what makes an overlay link quick
   on a slow connection.
2. **Holding files with `page.route` under the throttle**, rather than throttling
   alone. *Recommend holding*: without it the "before the data" cases depend on
   the machine's speed.
3. **The suite outside `test:layout`**, in `loading/` with its own command.
   *Recommend its own*: its throttled cases are slow, and run for the same pull
   requests that run layout tests.
4. **Nothing shown to the reader while data loads**, and nothing on a failed
   download. *Recommend nothing for now*: the wait is seconds, and #322's
   load-timing telemetry will say whether failures happen.
5. **Easing story transitions restart on a landing** rather than snapping at
   their end. *Recommend restarting*: one call to code that exists.
6. **The per-word parse after everything else settles**, rather than at idle as
   today. *Recommend after settling*: idle is a guess at when the network is
   free, and settling is the fact.
