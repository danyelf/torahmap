# Working in the repository

What CLAUDE.md leaves out because most tasks don't need it.

## The pre-commit hook

Read `.githooks/pre-commit` for how to bypass it deliberately. Once per clone, point git at it with
`git config core.hooksPath .githooks`.

## Layout tests

`npm run test:layout` tests the interface for layout in a real browser, at four screen sizes, from
a phone to a desktop. It draws no map (see `test/browser/fakeMap.ts`), and checks every state in `test/layout/app.ts`: no control
off screen; the panel, the zoom buttons and the verse popup clear of each other, and the panel
clear of the map; no clipped text; on the touch screens (tablet and phone), touch targets at least
24×24 (WCAG 2.2 AA); the elements each state must show, shown in full; and, on the few checks
that read pixels, a map that actually drew. Text ending in a deliberate ellipsis counts as fitting. `test/layout/known.ts` lists the
failures accepted for now, what each measures and why. `npm run test:layout:shots` draws the real map with software WebGL and writes
`layout-report/index.html`, every state at every size side by side.

It runs on four workers, and is not part of the pre-commit hook.

## Loading tests

The map draws before its data and fills in as each file lands. `npm run test:loading` tests that
in a real browser at one desktop and one phone size.

## The site a browser suite runs against

Both browser suites build the site once into a temporary folder and serve it from the Playwright
runner itself, on a port the operating system picks (`test/browser/site.ts`, started by
`globalSetup`). The data in `public/` is read in place rather than copied. Nothing outlives the
run, and no other process can stop the server. The first refused connection stops the run. The
built page sends its analytics events to `/api/event`, which the server answers with an empty 204;
`recordEvents` in `test/browser/page.ts` reads them from those requests. Hence a change to
`vite.config.ts` can break either suite.

## Test harness

`http://localhost:5173/test-harness/` (`npm run harness`) provides the search input flow on its
own, without the map. Source lives in `test-harness/`.

## Formatting

Prettier owns the formatting of the TypeScript, CSS, HTML and JSON in this repository. The version
is pinned exactly in `devDependencies`, because a minor Prettier release can legitimately change
its output, and a formatter that drifts between contributors is the problem it was brought in to
solve.

Two settings in `.prettierrc.json` were measured against the codebase rather than chosen by taste,
so the reformat moved as few lines as it could: `singleQuote` because committed source held 6995
single-quoted strings to 1112 double, and `printWidth: 100` because line lengths ran to a p99 of
100. `quoteProps: preserve` keeps the quotes on Hebrew object keys such as `'ך': 'כ'` in
`packages/hebrew/src/spelling.ts`, which Prettier would otherwise strip — they are valid
JavaScript identifiers, so nothing forces the quotes, but the letters are much easier to pick out
with them.

The bulk reformat is listed in `.git-blame-ignore-revs` so that blame keeps naming whoever last
wrote a line, instead of stopping at the commit that rewrapped everything at once. It takes
one setting, once per clone: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

Markdown and `data/`/`public/data/` are excluded from formatting; see `.prettierignore` for why.

## Project structure in detail

- `apps/` — each an npm workspace package with its own `test/`: `tanakh` (the Tanakh's map: its
  layout, labels, title, verse texts, search and `overlays/`), `talmud`, `euaiact` and `worker`.
  Each text's `src/main.ts` is its page's entry, and each text exports every module at its own
  path, as `@torahmap/tanakh/layout.ts`, for the tools that use them.
- `index.html` — the Tanakh's page is at the root, the Talmud's at `/talmud/` and the AI Act's at
  `/euaiact/`. The live site has only the pages whose flag is on in `build.ts`; the dev server and
  every branch's preview have them all.
- `test/` — that each package and app keeps to its imports and each page runs only its own text's
  code, the saved telemetry queries, the shell's tests that need a text's data, and the browser
  suites.
- `packages/`, as npm workspace packages:
  - `link` — reading and writing links, under each text's keys.
  - `utils` — small helpers that depend on nothing else here.
  - `engine` — drawing the squares, the camera, hit testing and the cross-fade, knowing nothing of
    any text. It touches the page only inside its functions and says `"sideEffects": false`, so
    the Worker, which reaches it through links and stories, bundles none of its drawing.
  - `shell` — the app shell, `createApp(text)`: what every text's page runs. The modules a text
    may use are the ones its `package.json` exports, each at its own path, as
    `@torahmap/shell/main.ts`.
  - `search` — a text's term search, `createTermSearch`: terms, matching through the languages a
    text gives it, results, marks and link. It knows no language but English, and the Tanakh's
    meanings mode plugs into it as one extra mode.
  - `hebrew` — Hebrew's letters, points and word breaks, and Hebrew as search reads it.
  - `telemetry` — which column of an event holds what, for the page that sends it and the Worker
    that writes it, and who can have the map, which its mode column records.
  - `overlay-catalog` — each Tanakh overlay's name and link keys, and with the search's,
    `LINK_KEYS`: a Tanakh link's.
  - `stories` — how a story is written, and which are listed and opened by default; the Tanakh's
    own, compiled from Markdown by `generate.mjs`, at `@torahmap/stories/tanakh`.
  - `site` — the address and view titles every text's site shares; at `@torahmap/site/tanakh`,
    what the Tanakh's site calls things: the site's name and tagline, and how a link is described.
    Each text's own copy is its `site` slot, `packages/shell/src/app/text.ts`.

  A package's Tanakh-only code sits behind its `/tanakh` entry, so the app shell can import the
  rest.
- `public/data/` — bundled verse texts, structure, and a directory for what only one part of the
  app reads: `overlays/commentary`, `overlays/haftarah`, `search/` for the lexeme index,
  `talmud/` for Talmud text.
- `data/` — see DATA_REGENERATION.md.
- `scripts/` — besides the data tooling, `demo/`, `talmud/` and the `telemetry/` queries.
- `experiments/` — prototypes that never shipped.
- `video/` — scripted video of the map: `npm run rehearse` to time a script against your
  narration, `npm run video -- <script.md>` to render it to MP4, `npm run mix` to lay a recorded
  voiceover under it. `npm run capture` turns views of the map into `story.md` stops or script
  scenes as you explore. See `docs/plans/2026-09-27-video-harness-design.md`.
- `scripts/print/` — `npm run print` writes print-ready PDFs. See its README.

## Tech stack

TypeScript, Vite, WebGL 2, and a Cloudflare Worker that serves the site and receives its
telemetry. No runtime dependencies.

## Deployment and telemetry

The Worker is configured in `wrangler.jsonc`; a deploy takes about a minute after a push to main.
`scripts/prpreview.sh <pr>` serves a pull request's build locally instead of through its preview
link.

What the Worker serves is in `apps/worker/src/index.ts`; telemetry's client half is
`packages/shell/src/analytics.ts`. No cookies; browser storage holds only two settings, which
languages to show and whether this is a return visit. The dev server sends nothing.
`scripts/telemetry/report.sh` prints every saved query, `report-html.sh` beside it writes the same
to `telemetry-report/report.html`, and `usage.sh` writes a chart of page views per day to
`telemetry-report/usage.html`; all three need a Cloudflare account id and an API token.
Cloudflare Access keeps chat apps' fetchers off PR preview links, so a preview is checked on
torahmap.org after merge.

## Data

Verse texts, structure and commentary counts come from [Sefaria](https://www.sefaria.org/). The
Hebrew lexeme index behind meanings-mode search comes from the
[ETCBC BHSA](https://github.com/ETCBC/bhsa) database, read through Text-Fabric. The haftarah
readings come from [hebcal's leyning tables](https://github.com/hebcal/hebcal-leyning). See
[DATA_REGENERATION.md](../DATA_REGENERATION.md) for updating data files.

### IEEE VIS data

The VIS map reads three files in `public/data/ieeevis/`, all from the
[ieeevis-scrape](https://github.com/danyelf/ieeevis-scrape) project's `scripts/build.py`:

- `structure.json`: the program (titles, authors, sessions, times, keywords). Committed.
- `cited.json`: every work the 2026 papers cite, with the papers citing it (titles, authors and years only). Committed.
- `texts.json`: the papers' text, 21 MB. **Never committed** (gitignored): copyright varies and the
  repository is public. The deployed site serves it from the private R2 bucket `torahmap-ieeevis`,
  through the Worker, at the same path (`apps/worker`).

To update, in the scrape's checkout (its raw downloads are in `~/data/ieeevis-scrape/`):

```bash
uv run --no-project python -I scripts/build.py data <torahmap checkout>/public/data/ieeevis
```

It writes the files into the checkout, not under `~/data/ieeevis-scrape/`, which holds only the raw downloads, so the checkout's `texts.json` is the copy to upload. Commit `structure.json` and `cited.json`. Then upload the text, from
the torahmap checkout (needs `wrangler login`):

```bash
npx wrangler r2 object put torahmap-ieeevis/texts.json \
  --file public/data/ieeevis/texts.json --content-type application/json --remote
```

The bucket is the one copy: the live site and every preview build read it, so there is nothing
to redeploy. A browser keeps its copy only until it next asks, since the Worker answers with an
ETag. To check the bucket is current, fetch it and compare:

```bash
npx wrangler r2 object get torahmap-ieeevis/texts.json --remote --file /tmp/texts-remote.json
cmp /tmp/texts-remote.json public/data/ieeevis/texts.json && echo current
```

`wrangler dev` reads a separate local bucket; put a copy there with the upload command and
`--local` in place of `--remote`.

**Keep the text behind Cloudflare Access while it is copyrighted.** Previews are open to the
Cloudflare account's members only. On torahmap.org the Access app "torahmap private preview" must
list `torahmap.org/ieeevis` and `torahmap.org/data/ieeevis`, as it lists the Talmud's and the AI
Act's paths; without them the Worker serves the text to anyone. In the dashboard: Zero Trust,
Access, Applications, "torahmap private preview", add the two public hostnames and leave its
policy as is. By API (a token with Access Edit; `$ACCOUNT` is the account id, `$APP` the app's
id): `GET /accounts/$ACCOUNT/access/apps/$APP`, add the two paths to `destinations`
(`{"type":"public","uri":"torahmap.org/ieeevis"}`) and to `self_hosted_domains`, send the result
back with `PUT` (dropping `id`, `uid`, `aud` and the dates, and listing policies by id). Check
afterwards that `curl -I https://torahmap.org/data/ieeevis/texts.json` answers 302 to Access.
