# The EU AI Act as a Third Text

**Date:** 2026-10-15
**Status:** Design, awaiting review. Builds on the exploration in
`2026-10-13-eu-ai-act-map-design.md` (#372), which settled the layout.

The Act becomes a third text beside the Tanakh and the Talmud, through
`createApp(text)`. It may later ship as a site of its own. Until Danyel says
so, it is not on torahmap.org.

A second aim is to learn where the shared machinery assumes a Tanakh or Talmud.
The Talmud found the first batch; the Act is a stranger text, so it should find
more. Each one is logged below as it is met.

## Shape

`apps/euaiact`, parallel to `apps/talmud`, with the same files: `text.ts`,
`layout.ts`, `data.ts`, `page.ts`, `site.ts`, `search.ts`, `baseColor.ts`,
`main.ts`. The layout is the exploration's: recitals over articles over annexes,
chapters as columns, Chapters III and IX split by section, a square a paragraph,
a list's lead-in, or a point.

The parsed Act and its cross-references ship as JSON under
`public/data/euaiact/`. The Python that produces them stays in `experiments/`
until it is moved beside the data it generates, as `scripts/` mirrors
`public/data/`. The app only reads the JSON.

## Not live until released

A build from `main` holds only the Tanakh's page and leaves the Talmud's data
out of what Cloudflare publishes (`build.ts`). That is all-or-nothing: when the
Talmud goes live, everything unpublished would go with it.

Each page carries its own flag for whether it is live. The Talmud's and the
Act's flip separately, and the Act's stays off until Danyel flips it. A test
checks that a live build holds no page and no data folder of an unpublished
text. The page is at `/euaiact/`, a placeholder for whatever address it gets.

A separate domain later would be a second deployment serving the same build
with a different page. The flag does not prevent it, and nothing here prepares
for it.

## First version

Enough to prove the shell takes the Act:

- the whole layout, drawn;
- labels for the three parts and the chapters;
- a popup with the paragraph's text and a link to its source;
- two overlays, **Amendment** (inserted and replaced in 2026) and **What points
  here** (one unit's references out and in), because their data exists;
- plain-word search;
- one story stop showing the whole map, as the Talmud's.

Not in it: the other overlays in the exploration, defined-term search, the
mapping from recitals to articles, and the 2026 amendment's own recitals.

## One engine change: squares of any width

A recital is a 2×1 tile, so `MapItem` gains an optional `width`, defaulting to
`size`. The GPU already takes a full rectangle per square, so the drawing needs
nothing. Six places turn `size` into a rectangle by assuming a square, and each
reads `width ?? size` instead: `geometry.ts` (the rectangle), `hitDetection.ts`
(the click test, and the centre used for nearest-square lookups), `camera.ts`
(centring on a square, in two functions) and `outline.ts` (the pinned ring).

The Tanakh and the Talmud set no `width`, and a test pins that their rectangles,
hits and centres are unchanged.

## Where the machinery assumed something else

A running list. Each is confirmed or dropped as the work reaches it, and what
is found is written here, not in a code comment.

| # | Assumption | Status |
|---|---|---|
| 1 | A square is square (`MapItem.size`) | Found; fixed by `width` above |
| 2 | A popup has Hebrew and English (`PopupText`); "Hide Hebrew", the Hebrew label font and Hebrew word handling follow | To check: how much of it the Act can leave empty, and whether the toggle should vanish |
| 3 | A section label has a Hebrew name and an English one (`mapLabels.ts`) | To check |
| 4 | A text has at least one story | The Talmud's one-stop story is a stopgap; the Act copies it |
| 5 | Overlays and link keys come from `overlay-catalog`, which is the Tanakh's | The Talmud has no overlays; the Act is the first other text to have them |
| 6 | Telemetry's area and section are a book and a part of the canon (`area(item)`) | To check that the columns and mode values accept a third text |

## Testing

The text's layout is tested for what it must hold: no two squares share an id,
every cross-reference names a square that exists, every square lies inside the
bounds. The popup, links and overlays are tested as the Talmud's are. The
layout tests (`npm run test:layout`) and loading tests
(`npm run test:loading`) run before the pull request, since it changes the
interface and startup. Pictures of the map, taken from the running page, go in
the pull request.

## Open questions

- The page's address, and what the site calls itself.
- Whether "What points here" is an overlay in the menu or a mode of the pinned
  square. The Tanakh has nothing like it.
