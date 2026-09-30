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
  the search data; one naming an overlay waits for that overlay. A bare
  address, a place, a pinned verse or a story stop with neither draws at once.
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

Trop and verse length move their `configure` work into `init`: wait for the
texts, then build the index. Commentary and haftarah keep their `init` as it
is. All of these live in one new module, `src/dataLoading.ts`, so `main` asks
for `ready(overlay)` and `searchReady()` rather than knowing what each needs.

A failed download leaves its tool empty and warns, as today. A failed structure
download still stops the map.

## Startup

1. Fetch `tanakh-structure.json`; lay out the map.
2. Read the link. If it names an overlay, wait for `ready(overlay)`; if it
   carries a search, wait for `searchReady()`. A story stop's overlay and search
   count the same way.
3. Draw the first frame; set `data-map-ready`.
4. Start every other wait.

## Data that arrives after the first frame

Overlays already draw nothing without their data (haftarah's `colorsFor`
returns nulls until its readings load), and search without its index finds
nothing. So before arrival the map is plain with no new code; the work is
redrawing on arrival.

- **Redraw through the cross-fade.** When a wait resolves and the tool it feeds
  is on the map, the map fades from what it shows to the new picture. The fade
  is the one `setFrontTool` runs today, pulled out into its own function so
  both use it.
- **Clear what was computed without the data.** Search results, overlay colour
  memos and the story's cached stop pictures (`picturesCache` in
  `src/scrollytelling/overlayBlender.ts`) were computed empty and must be
  recomputed. A search term's meanings are resolved against the dictionary, so
  a term typed before the dictionary arrived is resolved again.
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
  their data before `data-map-ready`.
- Before and after, time a cold load to `data-map-ready` in headless
  Playwright on a throttled connection, for a bare address and for a search
  link. The bare address should drop to about the structure's download; the
  search link should not get slower.
- In the browser: the bare address, a commentary link, a search link, and
  typing a search in the first second of a throttled load.
