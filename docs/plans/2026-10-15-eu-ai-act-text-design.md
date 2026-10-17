# The EU AI Act as a Third Text

**Date:** 2026-10-15
**Status:** Built in branch `euaiact-text`. Builds on the exploration in
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
`size`. Six places turn `size` into a rectangle by assuming a square, and each
reads `width ?? size` instead: `geometry.ts` (the rectangle), `hitDetection.ts`
(the click test, and the centre used for nearest-square lookups), `camera.ts`
(centring on a square, in two functions) and `outline.ts` (the pinned ring).

The GPU takes a full rectangle per square, but the shader measured a search
ring's hole, and whether a square has room for one, from its width alone, so a
recital's ring was thin along its top. It now carries both sides
(`webgl.ts`).

The Tanakh and the Talmud set no `width`, and a test pins that their rectangles,
hits and centres are unchanged.

## Where the machinery assumed something else

What building the Act found. Each row says what the shell assumed and what
became of it.

| # | Assumption | What became of it |
|---|---|---|
| 1 | A square is square (`MapItem.size`) | Fixed: an optional `width`, read in six places, and both sides in the shader's search ring. |
| 2 | A text has Hebrew | The popup copes with empty Hebrew. The real assumptions were the Hide Hebrew control and its stored choice, `torahMap.englishOnly`, which every page on one origin shares. Fixed: `Site.hasHebrew`; a text without it is English only, offers no control, and never reads or writes the choice. |
| 3 | A label has a Hebrew name | `mapLabels.ts` draws a Hebrew span and hides a narrow book's English unless the page is English only. With `hasHebrew: false` the page is English only, so the English always shows; the Hebrew span stays, empty. No change needed. |
| 4 | A text has at least one story | Still true. The Act copies the Talmud's one-stop stopgap. |
| 5 | Overlays and link keys come from `overlay-catalog` | Not so: the shell takes `text.overlays` and `link.overlayParams` and never reads the catalog, which is the Tanakh's own list. The Act's two overlays needed nothing from it. |
| 6 | Telemetry knows which text sent an event | It does not, so the Talmud's page sends none, and the Act's does the same. Telemetry for a second text is its own work. |
| 7 | A square's id looks like the Tanakh's or the Talmud's | Not so: the link takes any id up to 100 characters without `/ \ \| ;` (`SQUARE_ID` in `packages/link/src/params.ts`), so `5(1)(h)` and `Annex.III.1.2` needed nothing. |
| 8 | A text reads right to left | A book's label was always anchored at its right edge, so "Ch. III" sat over the last of its five columns. Fixed: `MapLabelSettings.direction`, right to left unless a text says otherwise. |
| 9 | A text's source is Sefaria | The page said "View on Sefaria" in the popup and linked "Sefaria" when WebGL is missing. Fixed: `PageCopy.textSource`. |
| 10 | A text styles its own text boxes | The search box's look lived in the Tanakh's search CSS, so any other text's box was unstyled. Fixed: a shared `control-input` beside the shell's other controls. |
| 11 | A link with no zoom opens at a fixed zoom | Found, not fixed: a link with no zoom opens at `link.zoom.start` (`main.ts`, `restoreFromUrl`), not the fitted view, so a link such as `?overlay=references` opens the Act zoomed in, its left under the panel. The Talmud shares it. |
| 12 | Each text has its own jitter | Two copies of the position jitter and two different brightness jitters. The Act uses new shared helpers in `@torahmap/utils`; moving the others onto them is #391. |

The source links name the 2024 Official Journal text on EUR-Lex. Its anchors
(`#art_6`, `#rct_12`, `#anx_III`) were checked in a browser: each is there and
names the right article, recital or annex.

The exploration's design doc counts 264 annex squares; its own `render.py`
places 250, as this layout does.

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
