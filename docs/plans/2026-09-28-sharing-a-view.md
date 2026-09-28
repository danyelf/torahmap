# Sharing a view

**Date:** 2026-09-28
**Status:** Parts 1 (#278) and 2 built; part 3 (the Worker's previews and telemetry) not started.
**Issues:** #232 (second half), #245. Step 3 of
[Where everything lives](2026-09-23-ui-information-hierarchy-design.md).
The per-view preview image is #273.

A reader can send anyone a link to exactly what they are looking at, and the
link previews as what it points to.

## What the reader sees

- The ☰ menu gains **Share this view**, right under *Continue* and above a
  divider, so the two actions come before the tools. While a story is driving
  the map it reads **Share this stop**, since that is what will be sent. It is
  the only Share control.
- **On a touch screen with a system share sheet** (`navigator.share` and a
  coarse pointer), it opens the sheet. The sheet is the confirmation.
- **Otherwise** it copies the link. The item's label becomes *Link copied ✓*
  for about 1.5 seconds, then the menu closes; on failure, *Couldn't copy*.
  This is the one item that does not close the menu at once. No toast.
- **The tab's title follows the view**, from the same description the Worker
  writes (below). Off the live site it keeps its branch name, as now:
  "Genesis 12:1 · Torahmap [share-view-2]".

## The link

The view moves from the hash to the query string: `?verse=Genesis.12.1&…`,
with the keys as they are now. Nothing reads `#` links; the site is not yet
released, so there are none to honour. The Talmud page keeps its own hash
links.

**What is on screen decides the link.** While a story drives the map, the
link is the story and its stop. Once the reader takes over — pans, zooms or
pins — it is an ordinary Explore link to what they see, with no story in it.
The address bar always holds that link, and Share copies it. So taking over
inside a story adds a Back step to the stop, and a reload after taking over
reopens Explore. One function in `main.ts` produces the link for the screen;
`syncUrl`'s two branches become that function.

## Titles and descriptions

The title names what the link points at, most specific first, since tabs and
previews cut from the right and chat apps show the site name
(`og:site_name`) on its own line. A pinned verse leads because the camera and
the popup go to it; the search is its context.

| Link | Title | Description |
|---|---|---|
| Verse + overlay | Genesis 12:1 · Torahmap | Commentary overlay. A Visual Concordance of the Hebrew Bible. |
| Search | Search: אברם · Torahmap | A Visual Concordance of the Hebrew Bible. |
| Verse + search + overlay | Genesis 12:1 · Search: אברם · Torahmap | Commentary overlay. A Visual Concordance of the Hebrew Bible. |
| Story stop | The Guided Tour · Torahmap | The stop's first sentence. A Visual Concordance of the Hebrew Bible. |
| Nothing, or only a camera | Torahmap | A Visual Concordance of the Hebrew Bible. |

"A Visual Concordance of the Hebrew Bible" also replaces the description in
`index.html`. The description never quotes the verse.

## Packages

What sharing needs moves into npm workspace packages under `packages/`, each
with a `package.json` whose `exports` name what others may import. Vite,
Vitest, TypeScript and Wrangler all resolve them by name; no path aliases.

- **`@torahmap/link`** — read a link into a view, write a view as a link,
  describe a view as a title and description. No DOM. `src/urlState.ts` keeps
  what needs the browser: reading `location`, writing history, and
  `applyingExternalState`.
- **`@torahmap/stories`** — the Markdown files, and a generation step that
  compiles them into one module before `dev`, `build` and `test`, replacing
  the Vite-only `import.meta.glob` in `src/stories/index.ts`. Adding a story is
  still adding a file.
- **`@torahmap/overlay-catalog`** — each overlay's id, name, description and
  link keys. The drawing code in `src/overlays/` imports its entry from here.

Only these three. Splitting the rest of the codebase is not part of this.

## The Worker

- Runs first for `/` alone (`assets.run_worker_first`); every other path is
  served as a static file, as now.
- Reads the link with `@torahmap/link` and rewrites `<title>`, the
  description, `og:title`, `og:description` and `og:url` in the page's text.
  `og:url` becomes the full link, because some apps fold every link to its
  `og:url`. `canonical` stays `https://torahmap.org/`, so search engines index
  one page.
- The rewrite edits `index.html` as text rather than parsing it with
  Cloudflare's `HTMLRewriter`: the page is 5 KB, and `HTMLRewriter` exists only
  in Cloudflare's runtime, so the test suite, which runs in Node, could not run
  it without a second test setup. Text matching depends on how `index.html`
  writes those tags, so a test runs the rewrite on the real file; a reformat
  that breaks the match fails the suite instead of shipping plain previews.
- The image stays `og-image.jpg` for every link (#273).
- The dev server does not run the Worker, and Cloudflare Access keeps chat
  apps' fetchers off the PR previews. The Worker's tests cover the rewrite;
  the real check is pasting a link into a chat app on torahmap.org after merge.

## Telemetry

Columns go in `src/telemetry/schema.ts` as usual.

- **`share`** — `how` (`copied`, `share_sheet`, `cancelled`, `failed`),
  `what` (`stop`, `view`), `story`, `stop_id`, `overlay`, and whether a search
  is on and a verse pinned.
- **`page_view`** gains `arrived_with` (`nothing`, `view`, `stop`): what the
  first page's link named. A reload or Back/Forward
  (`PerformanceNavigationTiming.type`) records `nothing`, since it is not an
  arrival. This counts shared links opened, whether from Share or a copied
  address bar, and cannot tell them from bookmarks.
- **`link_preview`**, written by the Worker when a known preview fetcher
  requests a page: `fetcher` (Slackbot, WhatsApp, Discordbot, TelegramBot,
  LinkedInBot, Twitterbot, facebookexternalhit — iMessage uses the last two)
  and `what` (`nothing`, `view`, `stop`). It counts links pasted into a
  conversation. Some apps fetch twice, so it counts a little high.

No marker or id is added to shared links: a marker is lost when someone copies
the address bar instead, and an id per share follows people.

## Testing

- `@torahmap/link`: a view written and read back is unchanged; the
  descriptions match the table above.
- The Worker: a request for a verse link returns the right tags; a request
  from a preview fetcher writes one `link_preview`; a plain browser writes
  none.
- The stories package: every `.md` in the folder is in the generated module.
- The existing URL tests move from hash to query string.
- Layout tests: the menu with Share, and its *Link copied* state.

## How it lands

Three pull requests, each working on its own:

1. The packages, and the move from hash to query string. A reader sees only
   the address bar change.
2. Share, the tab title, and the story's address-bar rule.
3. The Worker's titles and previews, and the three telemetry changes.
