# Draw First

**Date:** 2026-09-30
**Status:** Design, decided 2026-10-01. Planned: docs/plans/2026-09-30-draw-first-implementation.md.

Step 3 of three toward #313, after step 1 (`2026-09-30-overlay-data-design.md`)
and step 2 (`2026-09-30-search-data-design.md`). It is the only step a reader
sees.

## What is decided

Main draws from the structure file alone and loads everything else behind the
first frame, the per-word parse last. Nothing waits, overlay links included. As
each file lands, main updates `loaded` and cross-fades whatever newly has its
data, through the renderer's picture cross-fade, the one the front tool and the
story's ease use. The verse popup says "Loading…" until the texts arrive. The
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

Everything at once would share the connection, so on a slow one a 0.32 MB
commentary link would wait about as long as the 2.7 MB texts. Instead, four
stages, each starting when the one before has settled:

1. The structure, always.
2. The files the opening view needs.
3. Every other file.
4. The per-word parse.

- The opening view is what the link shows, or the story stop it opens: the files
  of its overlay, search's files if it searches, and the texts if it pins a
  verse. The bare address opens the tour's first stop, which needs nothing, so
  it goes straight to stage 3.
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
plain map; a failed texts file leaves the popup with the warning in place of the text. Every other file loads as
usual, and `data-loaded` is still set. No retry; the reader is told where they were waiting (below). Search follows the rule for any
tool: a failed dictionary turns it off (step 2).

## While data loads

A small "Loading…" shows wherever the reader is waiting on a file: in the
overlay's legend row while the picked overlay's files are on their way, in the
search caption while search's are, and in the verse popup while the texts are.
It goes when the file lands. Files nobody shown is waiting on say nothing. Main
knows which downloads it has started and not yet heard back from; `loaded`
still holds only what arrived.

If a download fails, the same place shows a small closable warning instead:
"Couldn't load — please reload and try again", with a × that dismisses it.
Closed, it stays closed for that file; the overlay stays plain, as above.

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
| Overlay link | commentary | map drawn and plain; picker shows commentary; legend row says it is loading | map changed; legend row shows the overlay; address unchanged |
| Search link | texts, dictionary | map drawn and plain; search box holds the word | map changed; results listed; address unchanged |
| Narrowed search link | dictionary | address still has `m` | exactly the linked meaning checked; address unchanged |
| Pinned verse | texts | popup says it is loading; map centred on the verse | popup open for the verse |
| Overlay picked early | commentary | pick it in the panel; map stays plain | map changed; picker unchanged; address has the overlay |
| Search typed early | texts, dictionary | type a word; it keeps focus | results listed; box keeps value and focus; address has the search |
| Story scrolled early | texts, dictionary | scroll to a stop with a search | map changed; search legend row shown |
| Failed download | commentary aborted | overlay link | `data-loaded` set; map plain; legend row warns, and its × closes the warning; no page errors |

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

## Open questions, assumptions and rulings

Decisions made while implementing step 3, newest last.

- **2026-10-01 (plan)** The verse popup opens before the texts, as it does
  today, and says "Loading…" where the text goes; a failed texts file shows the
  warning there. The design's later "While data loads" section decides this;
  the three lines that said the popup stays closed are changed to match.
- **2026-10-01 (plan)** The map and the panels are drawn from the files a tool
  requires; the popup also from its optional ones. So the per-word parse
  landing redraws only the popup, as the design's example says, and a reader
  scrolled down the search results keeps their place.
- **2026-10-01 (plan)** `staleAfterLanding` is handed the tools the map shows
  as a list rather than an overlay and a search: in a story blend or ease the
  map shows the tools of the stops it is between, which need not be the picked
  overlay.
- **2026-10-01 (plan)** The optional files are the last stage (that is, the
  per-word parse); `filesFirst` names only required files.
- **2026-10-01 (plan)** "Loading…" shows for a file queued for a later stage as
  well as one downloading: main counts every file it will download as pending
  from the moment the structure lands.
- **2026-10-01 (plan, Danyel)** A tool's legend row — the overlay's or
  search's alike — reads "<name> · Loading…" while its files are on their way.
  On failure the row goes and a warning line with its × shows below the rows in
  the legend card: a × cannot sit inside the row, which is a button. Search's
  row joins its caption because on a phone with the panel closed the legend is
  the only place a search link's reader sees.
- **2026-10-01 (plan)** Main writes the search caption's notice into the
  search panel's `#search-hit-caption`, which search leaves empty without data.
- **2026-10-01 (plan)** Search names the structure file, and `buildTextIndex`
  takes the book order from it, so the index can never be built in another
  order. `getBookOrder` had no other reader and goes.
- **2026-10-01 (plan)** `dataFor` keeps, per overlay, one data object per set
  of its files' contents, so an overlay's data stays the same object while none
  of its own files changes.
- **2026-10-01 (plan)** The popup's Hebrew words are clickable only once
  search has its data (`PopupView.wordsClickable`).
- **2026-10-01 (plan)** A story stop with a search puts search in front, and
  the story's last "explore" button opens the search panel, by whether the
  search has a word, not by whether its data is in: before the data they would
  otherwise decide differently than after.
- **2026-10-01 (plan)** `load_timing` is sent once, when every download has
  settled and search's index and dictionary have been built. `first_frame`:
  the first frame, now drawn from the structure alone. `texts_in`: when the
  texts file landed, as before. `search_ready`: when search's idle prebuild
  built its index and dictionary after its files landed; 0 if they never
  arrived. `texts_kbps` and `connection`: as before. The event waited for
  every file before as well, so the visits it misses are the same kind.
- **2026-10-01 (plan)** The suite throttles to 150 ms latency and 16 Mbit/s.
  The dev server sends files uncompressed, about four times the bytes the site
  sends, so each file takes about as long as it does on a 4 Mbit/s phone.
- **2026-10-01 (plan)** Main's wiring of search recording is tested by turning
  the dev server's analytics on from the test (a module script importing the
  app's own `/src/analytics.ts`) and collecting what is sent. No app change.
- **2026-10-01 (plan)** The capture shortcut names the picked overlay whether
  or not its data is in; the suite checks it with a stubbed clipboard.
- **2026-10-01 (plan)** `fadeMap(to, settle)` is the front tool's cross-fade
  taken out: `settle` paints the picture the map rests on at the end
  (`applyTools`, or `blendTransition` in a story blend). Landing fades take its
  250 ms; `FRONT_FADE` becomes `MAP_FADE`, and `cancelFrontFade` `cancelFade`.
- **2026-10-01 (plan)** An ease is restarted only while it has time left; at
  its last frame the story paints the stop with the new data anyway.
- **2026-10-01 (plan)** "Plain" in the suite means fewer coloured (non-grey)
  canvas pixels than a small floor; the plain map is grey.
- **2026-10-01 (plan)** `loadFiles` loses its per-file callback;
  `downloadFiles(paths, { landed, failed })` reports each file as it settles.
- **2026-10-01 (plan)** The layout and loading suites share the software-WebGL
  launch arguments from `layout/screens.ts`.
- **2026-10-01 (Task 1)** `loading/files.ts` takes the haftarah path from
  `HAFTARAH_FILES` in `src/overlays/haftarah/readings.ts`, which imports no
  CSS; `haftarah.ts` itself does. The commentary path stays written out:
  `commentary.ts` names it inline and imports CSS through `panel.ts` and
  `legend.ts`.
- **2026-10-01 (Task 1 review)** The overlay-and-search case waits for
  search to be in, with the overlay row still loading, before it takes the
  picture to compare against; otherwise search landing alone would change the
  map and pass the case with commentary never coloured.
- **2026-10-01 (Task 4)** The downloads test takes `HAFTARAH_FILES` from
  `src/overlays/haftarah/readings.ts`, where it lives; `haftarah.ts` imports
  it without exporting it. The `stopTools` test helper defaults `overlay` to
  `null`, since `ResolvedStoryStop` requires it and that test folder is
  typechecked.
