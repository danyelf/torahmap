# Draw the Map From the Structure File Alone

**Date:** 2026-09-29
**Status:** Design, for review. Issue #313.

## The problem

`main` draws nothing until it has downloaded the structure, every verse's text
and the dictionary, about 3.5 MB compressed, and until every overlay's `init`
has fetched its own file. Laying out the map needs only the structure, 2.4 KB.
The bare address opens the tour on the plain map, so most first visits wait for
data their first frame never uses.

Building the search, trop and verse-length indexes also sits in front of the
first frame. That is #311, handled separately.

## Decisions

- **A link waits only for what it names.** A link carrying a search waits for
  the search data; one naming an overlay waits for that overlay; one pinning a
  verse waits for the texts, which the verse popup shows. A bare address, a
  place, or a story stop with none of these draws at once.
  The reader never sees the view they were sent change under them.
- **The reader's early actions show nothing until their data arrives.** A
  search typed or an overlay picked before its data is in is taken as normal;
  the map stays plain and then fades to the result. No loading indicator: the
  wait is a second or two.
- **Each piece of data has its own wait,** so a commentary link waits for the
  commentary file, not for the texts.
- **Download order:** the structure; then whatever the link names; draw; then
  everything else at once.

## The waits

Each is started once and returns the same promise to every caller, as
`loadMorphology` in `src/search/dictionary.ts` does.

| Wait | What it downloads and builds | Who waits on it |
|---|---|---|
| Texts | `all-texts.json` | the verse popup; trop; verse length |
| Search | the texts, the three `search/` lexeme files, then `buildSearchIndex` | the search tool |
| Each overlay | its own `init` | that overlay |

The search tool gets an `init` of its own, so every tool is made ready the same
way. Trop and verse length gain an `init` that waits for the texts and then
runs their existing `configure`. Commentary and haftarah keep theirs. The texts
are one shared load, `allVerseTexts()` in `src/verseTexts.ts`. A new module,
`src/dataLoading.ts`, runs each tool's `init` once (`ready(tool)`) and says
whether it has finished (`isReady(tool)`).

A failed download leaves its tool empty and warns, as today. A failed structure
download still stops the map.

## Startup

1. Fetch `tanakh-structure.json`; lay out the map.
2. Read the link. If it names an overlay, wait for `ready(overlay)`; if it
   carries a search, wait for `ready(searchTool)`; if it pins a verse, wait for
   the texts. The story stop the link opens counts the same way.
3. Draw the first frame; set `data-map-ready`.
4. Start every other wait.

## Data that arrives after the first frame

A tool whose data is not in is left off the map in one place, `toolsShown`
(`src/tools.ts`), which both exploring and the story use. Overlays need not each
know what to draw without data: commentary, for one, would otherwise colour
every verse as never linked. Its legend row stays off too.

- **Redraw through the cross-fade.** When a wait resolves and the tool it feeds
  is on the map, the map fades from what it shows to the new picture. The fade
  is the one `setFrontTool` runs today, pulled out into its own function so
  both use it.
- **Recompute what was worked out without the data.** A search term's meanings
  are looked up when it is typed, so a term typed before the dictionary arrived
  is looked up again; that makes new search settings, which also discards the
  search's remembered results. The story does not keep a stop's picture drawn
  while one of its tools was not ready (`picturesCache` in
  `src/scrollytelling/overlayBlender.ts`).
- **Controls and legends redraw too.** Trop's list of marks, for one, comes
  from its index.
- **Story.** A stop whose overlay is not ready draws as the plain map. At rest
  the story uses the same colour path as exploring, so it gets the same fade;
  mid-scroll the next frame simply picks up the new colours.
- **Verse popup.** Shows the reference at once and its text when the texts
  arrive, if it is still open.

## Testing

- Unit tests for `src/dataLoading.ts`: each wait downloads once however many
  callers ask; a link's needs are the overlay and search it names and nothing
  else.
- A test that a search or overlay set before its data arrives shows its result
  once the data does, rather than staying empty.
- `npm run test:layout` unchanged: its states open from links, which wait for
  their data before `data-map-ready`. One state switches to commentary after
  loading, and must wait for its legend row rather than check at once.
- Before and after, time a cold load to `data-map-ready` in headless
  Playwright on a throttled connection, for a bare address and for a search
  link. The bare address should drop to about the structure's download; the
  search link should not get slower.
- In the browser: the bare address, a commentary link, a search link, and
  typing a search in the first second of a throttled load.
