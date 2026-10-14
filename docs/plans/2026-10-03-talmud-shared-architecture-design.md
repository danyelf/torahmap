# One App, Two Texts

**Date:** 2026-10-03
**Status:** Design, approved 2026-10-03; project 1's order revised 2026-10-04 to put the shell first. Project 1 done 2026-10-13 (#342). Project 2 planned step by step 2026-10-13; projects 3 and 4 in outline.

The Talmud map becomes a sibling site of torahmap: the same menu, panels,
stories, popup and links, with its own text, layout and overlays. It may grow
into a separate product, so the drawing code must never depend on the app
around it.

The first Talmud page (`src/main-talmud.ts`) shared only the renderer and
copied everything above it. It got none of the panels, search or stories, fell
behind as `main.ts` improved, and has drawn in the wrong place since the camera
change of 2026-09-26. This design shares the app instead.

## The four projects

1. **Draw the line inside `src/`.** `main.ts` becomes `createApp(text)`, and
   both the Tanakh and the Talmud boot through it. The Talmud page is dev-only
   and plain, and is not built for production until project 3. The Tanakh site
   behaves exactly as before.
2. **Split into components:** `packages/utils`, `packages/engine`,
   `packages/telemetry`, `packages/shell`, and `apps/tanakh`, `apps/talmud`
   and `apps/worker`.
3. **The Talmud's look and feel, and going live** at `/talmud/`. Its own
   design round.
4. **Talmud search.** Its own design round.

Project 1 comes before project 2 so that the interface meets its second user
while it is still one edit in one folder to change.

## What the trial showed

A throwaway branch (`spike/talmud-shell`, local) hacked `main.ts` into
`createApp(text)` and booted both texts through it in about twenty minutes,
using 28 marked shortcuts. Findings:

- The renderer, camera, hit testing, colour layers and cross-fade needed no
  change; the Talmud's 81,793 squares drew through the same code as the
  Tanakh's 23,206. The panels, menu, legend and address-bar handling worked
  untouched.
- String ids made comparing squares, arrow keys and links one line each.
- The real work is in five places: `@torahmap/link` reads `verse` as
  book.chapter.verse; search is imported by name in four modules; the popup
  mixes the text's content with search's marks and word clicks; **the shell
  cannot run without a story**; and the page's markup and site name live in
  `index.html` and `@torahmap/site`, which are the Tanakh's.
- Shared types default their type parameter to `TanakhIdentity`
  (`Overlay`, `MouseState`, `RenderState`, `ToolOnMap`, `Tools`), so code that
  looked generic compiled only because of the default.

## The text

A text is what `createApp` is given. Everything the shell knows about Tanakh or
Talmud arrives through it. The interface below is a sketch; the `createApp`
step settles its exact types.

```ts
interface MapText<I extends MapItem> {
  site: { name; tagline; aboutHtml; credits; describe(link): string };
  firstFiles: string[];
  layout(loaded: Loaded): { items: I[]; bounds: Bounds };
  startCamera(bounds: Bounds, viewport): Camera;
  baseColor?(item: I): Color;
  labels(items: I[], loaded: Loaded, container: HTMLElement): { move(pan, zoom): void };
  link: { key: string; isId(value: string): boolean };
  name(item: I): string;
  popup: { file(item: I): string; content(item: I, file: unknown): { he; en?; sefaria } };
  tools: Overlay<I>[];
  stories: { list; resolve(stops, items, bounds) };
  area(item: I): string;
}
interface MapItem { id: string; x: number; y: number; size: number }
```

| Slot | Tanakh | Talmud |
|---|---|---|
| `site` | today's name, About, credits, `describeLink` | its own |
| `firstFiles`, `layout` | `tanakh-structure.json`, `layout.ts` | `talmud/structure.json`, `talmud/layout.ts` |
| `startCamera` | pinned to the map's right edge | fit the map |
| `baseColor` | none: the shell's grey | Mishnah or Gemara |
| `labels` | `labels.ts`, `mapTitle.ts` | `talmudLabels.ts` |
| `link` | `verse`, `Genesis.1.1` | `at`, `Berakhot.2a.1` |
| `name` | `Genesis 1:1` | `Berakhot 2a:1` |
| `popup` | `all-texts.json` | the tractate's file |
| `overlays` | five overlays | segment length |
| `search` | stems and meanings over the BHSA | a stand-in that finds nothing, until project 4 |
| `stories` | today's stories and place names | its own, once written |
| `area` | book | tractate |

Notes on the slots:

- **Ids.** A square's `id` is its link form. The shell compares squares by id,
  steps through them in array order, finds them by a map from id, and writes
  the id under the text's link key. The renderer compares ids itself and loses
  its `itemsEqual` argument. Only text code sees book, chapter, tractate or
  daf.
- **Popup.** The text names the file a square's text is in and reads the
  square's text out of it. The shell downloads that file through the download
  manager on demand, shows the loading or failed notice while it waits, and
  applies the overlay's and search's marks to the text once it arrives. Word
  clicks in the popup belong to search: the search tool supplies them.
- **Search.** Every text has one; the Talmud's finds nothing until project 4.
  The shell sees it through `SearchTool` (`packages/shell/src/app/search.ts`): an overlay whose
  settings and data only the search understands, plus whether it is searching
  and what happens to it, for telemetry. Anything a text opens over the popup,
  such as the word menu, holds the popup through the shell, so a file landing
  does not redraw it out from under the menu. The Tanakh's search, with its stemming
  dictionary, lives in `src/tanakh/search/`, and a test keeps everything outside
  `src/tanakh/` from importing it.
- **Stories.** Every text has them, the Talmud included once its first is
  written; until then its one-stop story stands in. Place names in stops
  ("Torah", "Psalms") are resolved by the text. The story column, where the
  reader is in the stories, lives in `src/scrollytelling/storyColumn.ts` (see
  `2026-10-06-story-mode-design.md`).
- **Generic types** stop at the edge: `createApp` and overlays are typed by the
  text's square; the renderer, camera, hit testing and colour layers see
  `MapItem` only. No shared type defaults to `TanakhIdentity`.

### What the shell takes on

- **Talking back.** The tools a text supplies sometimes act on the shell:
  search pins a result and travels to it, the word menu changes the search.
  They do so through a small set of shell functions handed to the tool, not by
  reaching into `main.ts`.
- **A label container** already clipped to the map, so a text's labels line up
  with its squares whatever the panel does.
- **The page.** One HTML template; the build fills each site's name, tagline,
  description, preview image and no-WebGL message from its text, writing
  `index.html` and `talmud/index.html`.

## Downloads

Every file goes through the download manager (`downloads.ts`,
`dataFiles.ts`): the first files, then each tool's required and optional files
in stages, and a popup's file on demand. The Talmud's 37 tractate files (16 MB
together) load only when a square in that tractate is opened, so a phone never
downloads the whole Bavli to look at one daf.

Segment length needs every segment's length, which today it computes from all
37 files. It instead reads a small file of lengths written by the Talmud's
data script, so the overlay costs one download.

## Telemetry

The verse events (`verse_click`, `sefaria_click`) are replaced by new events
carrying the square's `id` and its `area`. The old ones stop being sent; saved
queries move to the new names. Which site sent an event is settled in
project 3: the dev server sends nothing, and the Talmud is dev-only until then.

## Project 1, pull request by pull request

Each builds, passes the tests, and leaves the Tanakh site as it is.

The shell comes first. Booting the Talmud through `createApp` early means every
later change is shaped by two real texts rather than one text and a guess.

**Done:** every square has an id, and the app compares, finds, steps through
and links squares by it (#346); the old Talmud page is deleted (#349); a verse
has one name, its id, everywhere, data files included (#350); `createApp`,
with both texts booting (described below); search as a slot every text fills,
the Tanakh's moved into `src/tanakh/search/`; the story column out of `main.ts`.

**`createApp`, with both texts booting.** `main.ts` becomes
`createApp(text)`, called by `main-tanakh.ts` and a dev-only `main-talmud.ts`.
The Talmud supplies what it already has: its layout, labels, ids, Mishnah and
Gemara as its base colour, and its text in the popup, one tractate at a time
through the download manager. Where a slot isn't built yet, a **shortcut**
stands in: the plainest code that lets the Talmud boot without the slot, with a
comment saying in the present tense what is missing, and a line in #342's
checklist. The layout tests gain the Talmud page, checking that the map drew and
its labels are on screen, so it cannot rot unseen again.

**Next: one pull request per shortcut,** each removing it with both texts
running. The order is decided as we go, starting with whichever shortcut is
most in the way:

- **The popup.** The text supplies a verse's text, reference and link; the
  shell applies the tools' marks; word clicks belong to search.
- **The page and the site per text.** One HTML template; each text's name,
  About copy and credits; each text names its link parameter (`verse`, `at`)
  and describes its own links.
- **Telemetry** by id and area.

**Last: the boundary.** A test fails if a shell or engine module imports Tanakh
or Talmud code. When it passes with no shortcuts left, project 1 is done.

**Checks for every step:** the unit tests, `npm run test:layout`,
`npm run test:loading`, and a production build served locally, with a pinned
verse, a story, an overlay with settings and a search each loaded by link and
compared with the live site.

## Project 2: packages

The code is split into components, each a package that lists what it uses.
Something is a component when more than one thing uses it today: the Worker
describes links without the map, and the wall prints draw the Tanakh's layout
without the app.

A package imports only packages its `package.json` lists, by name, and nothing
outside its own folder by a relative path. npm workspaces do not stop either:
every package is linked into the root `node_modules`. So a test checks every
package's imports, and that check, not the folder layout, keeps the line.

One pull request per step, each built, tested and checked as in project 1.
Tests move with their code into the package's `test/` folder.

1. **Zoom limits per text.** Each text gives its smallest, largest and default
   zoom; the camera clamps to them, and a link's zoom is checked against them,
   handed to the link as its keys are. The Talmud's map is several times the
   Tanakh's, so its limits differ.
2. **`packages/utils`**, which knows nothing of the map or either text:
   `color`, `random`, `scale`, `memo`, `html`, `debounce`, `idle`, `hover`, the
   Sefaria link builder, and the `Color` type. The import check arrives here,
   for every package.
3. **`packages/engine`**, which draws squares and depends on nothing:
   `rendering`, `webgl`, `geometry`, `outline`, `camera`, `hitDetection`,
   `mapPoint`, `touchState`, `items`, and the cross-fade maths
   (`interpolation`, `colorBlending`). It owns the camera position and easing,
   which `@torahmap/stories` then imports from it. `src/types.ts` and
   `src/constants.ts` split: the general types and the drawing numbers go to
   the engine, each text's types to that text, the rest to the shell.
4. **`packages/telemetry`**: the shape of an event, which the page sends and
   the Worker receives (`src/telemetry/schema.ts`). The list of story driver
   kinds it records moves in with it.
5. **`packages/shell`**: `createApp` and the panels, menu, story column,
   links, popup, gestures (`mapGestures`), downloads, overlay machinery, how
   the map is coloured (`itemColoring`: the engine draws a picture, the shell
   decides it) and the page's half of telemetry.
6. **The apps.** `apps/tanakh`, `apps/talmud` and `apps/worker`, and two
   Tanakh components the app shares with others:
   - **its layout and data**: `layout.ts`, its types, the book list and the
     data files' names, used by the app and the wall prints;
   - **its site**: name, tagline, link keys, overlay names and how a link is
     described (today `@torahmap/overlay-catalog` and `@torahmap/site/tanakh`),
     used by the app and the Worker.

   The import check then covers the apps, and the boundary test retires.

`@torahmap/link` and `@torahmap/stories` stay shared, the Tanakh's parts behind
their `/tanakh` entries.

Left for project 3, when the Talmud's layout is redone and its site goes live:
layout helpers both layouts need (today the Talmud's shares only
`seededRandom` with the Tanakh's), the label-placement helper, and the list of
which site is at which address (`src/pages.ts`), which the Worker needs only
then. The general parts of `hebrew.ts` move to utils when the Talmud first
needs them.

## Projects 3 and 4

Project 3: the Talmud's layout, starting view, colours and label behaviour; a
first new overlay; fixing the data, in which about 20 of the 37 tractates tag
their opening Mishnah as Gemara (`scripts/talmud/bundle.ts` starts its walk in
Gemara); serving `/talmud/` from the Worker with its own link previews;
telemetry for both sites. Project 4: Talmud search.

## Not chosen

- **Each site wiring shared parts itself.** How the first Talmud page was
  built, and why it fell behind.
- **One general model of a text's levels** (section → book → chapter → verse).
  Built in April as `CorpusSchema` and deleted: the two layouts differ too
  much. Each text owns what goes in a square.
- **Copying `main.ts` for the Talmud and pulling out what matches,** and **a
  new shell the Tanakh moves into.** Both mean living with two of something.
