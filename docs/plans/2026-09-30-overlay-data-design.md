# Overlays Receive Their Data

**Date:** 2026-09-30
**Status:** Design, for review. Step 1 of three toward #313.

## Why

#313 asks for the map to draw as soon as the structure file is laid out, with
everything else arriving behind it. PR #320 did that, and two reviews of it
showed what went wrong in the doing:

- Loading state lived in module-level variables, so whether a tool's data was
  in became a hidden input to code that had been a plain function of settings
  (`toolsShown`), and tests had to be ordered within a file or fake the load.
- Each overlay pulled its data from shared loaders in an `init`, while tests
  pushed it in through `configure`: two ways for one thing.
- Loading reached into places that are about something else: a search term
  gained a field that existed only because a link can arrive before the
  dictionary, and search's telemetry had to know about loading.
- The code that handles data arriving late lived untested in `main.ts`.

PR #205 made an overlay a function of its settings, which the app holds. This
does the same for an overlay's data, so that "not loaded yet" is a value
(`null`) rather than a time-dependent check, and an overlay never loads
anything itself.

## The three steps

Each is its own pull request, reviewed on its own. Only step 3 changes what a
reader sees.

1. **Overlays receive their data** — commentary, haftarah, trop, verse length
   and text dating. This document.
2. **Search receives its data** — its own design round. Search functions take
   the text index and the dictionary as arguments instead of reading module
   state; every reader of them (the panel, the results list, the term rows,
   the verse highlighting, the verse popup, the word menu, click-to-search) is
   handed what it needs by main. A search term stores what was typed or linked
   — text, mode, chosen meaning keys — and its meanings are looked up from the
   dictionary when needed, so a link's choice of meaning simply waits in the
   term. A search is recorded once the reader has settled and its data is in.
   The per-word parse is declared and loaded the same way.
3. **Draw first** — its own design round. Main draws from the structure alone
   and loads everything behind the first frame, the per-word parse last. Nothing
   waits, overlay links included; as each file lands main updates what has
   loaded and cross-fades whatever newly has its data. The verse popup stays
   closed until the texts arrive. Its definition of done is a committed
   Playwright suite on a throttled connection, written first: the bare address,
   an overlay link, a search link, a narrowed search link, a pinned verse, an
   overlay picked or a search typed before the data, and the story scrolled
   before the data.

## Step 1: how an overlay gets its data

**An overlay names its own files**, as its own short names for paths under
`public/data/`:

```ts
// commentary
data: { counts: 'overlays/commentary/counts.json' }
// trop, verse length
data: { texts: 'all-texts.json' }
// haftarah
data: { mappings: 'overlays/haftarah/mappings.json', structure: 'tanakh-structure.json' }
```

**The overlay owns the shape.** A third type parameter, `D`, says what those
files hold under those names, e.g. `{ texts: VerseTexts }`. Whatever the overlay
derives from them — trop's index, verse length's word counts, commentary's
highest count per category — it works out from `D` and keeps per data value, so
it is dropped with the data.

**An overlay may offer `prebuild(data: D)`**, to work out what it derives ahead
of first use. Main calls it when the browser is idle. A colour asked for before
prebuild has run works out the same thing on demand, so prebuild changes when
the work happens, never the result.

**Members take the data as an argument.** Those that draw the map, and those
that read a verse, get it for certain; those that draw the panel may get `null`:

```ts
colorsFor(items, settings, data: D, hovered): …
getVerseColor(verse, settings, data: D): …
hoverChangesColors?(before, after, settings, data: D): boolean
getHoverInfo?(verse, settings, data: D): …
renderSidebarInfo?(verse, isPinned, settings, data: D): …
highlightVerseText?(text, language, settings, data: D): …
summary?(settings, data: D): …
renderControls?(container, settings, data: D | null, onChange): …
renderLegend?(container, settings, data: D | null): …
```

An overlay that names no files — the Talmud page's — takes no data.

**Gone:** every overlay's `init`, `configure`, module-level data, and the
`destroy` that only reset caches; `loadJson`, since main's loader is the one
place a download is fetched, parsed and its failure handled.

## Step 1: how main uses it

**Main only loads.** It gathers every overlay's paths, fetches each path once
— trop and verse length both naming `all-texts.json` cause one download — and
keeps what has arrived as one value, `loaded`, keyed by path. Main never knows
what a file means. A failed download is warned about once and stays missing.
The loader is a plain function from paths to their parsed contents, so the
print script (`scripts/print/`), which today calls haftarah's `loadReadings`
directly, loads an overlay's files the same way and hands them over.

**`dataFor(overlay, loaded)`** gives an overlay its files under its own names,
or `null` until every file it named is in.

**`toolsShown` takes `loaded`** and returns each tool with its data,
`{ tool, settings, data }`, leaving out a tool whose data is missing. It reads
nothing else, so it is a plain function of what it is handed. Everything that
draws a tool takes the data from that entry: the map colours, the hover check,
the map legend's summary, the verse popup.

**The panel** is drawn with `dataFor(currentOverlay, loaded)`, which may be
`null`.

**The story blender** takes `loaded`, and keeps a stop's picture only when
every tool the stop shows has its data.

**Startup in step 1 waits for everything**, as main does today, so the map
never sees a missing overlay yet. Search keeps its own loading until step 2.
After the first frame, main calls each overlay's `prebuild` at idle, one at a
time, which moves trop's and verse length's index building out of startup.

## Testing

- Overlay unit tests hand each overlay its data directly: no download mocks,
  no `configure`, nothing that depends on the order of tests in a file.
- A test that two overlays naming one path cause a single download, each
  receiving it under its own name; and that a failed download leaves that
  overlay's data `null` without stopping the others.
- A test that `toolsShown` leaves out a tool whose data is missing.
- `npm run test:layout` unchanged: step 1 must not move anything a reader sees.

## The open pull requests

- **#320** stays open as the reference for behaviour until step 3 lands, then
  is closed unmerged.
- **#328** (`loadJson` fails loudly) is closed: `loadJson` goes away in step 1.
  #327 stays open until step 1 lands, since step 1 is what fixes it.
- **#322** (load-timing telemetry) is reworked onto main now, before step 1, so
  it records how today's startup performs and gives a before and after.
