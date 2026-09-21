@AGENTS.md

# Torah Map

An interactive spatial visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position, enabling analytical overlays to reveal patterns across the 39 books and 23,000+ verses.

## Philosophy: Forest Over Trees

The core design principle is **position stability** - each verse occupies a permanent location regardless of which analysis is displayed. This allows:

- Pattern recognition through color and density
- Comparison across different analyses on the same substrate
- The "ragged edge" of chapters naturally encodes chapter length

## Features

- **23,000+ verses** rendered as colored squares using WebGL (Torah → Nevi'im → Ketuvim)
- **Smooth zoom/pan** with mouse wheel and drag
- **Verse details** on hover/click with Hebrew text, English translation, and Sefaria link
- **Full-text search** with Hebrew/English support, nikkud-insensitive;
  meanings mode resolves a written form to the dictionary words it can be, so
  every inflected form is found and words that merely share a spelling stay
  apart. How a word is matched — substring, whole word, or meanings — belongs
  to that word, so one term can be searched by meaning while another is pinned
  to an exact spelling.
- **Pluggable overlays**, in the order the menu offers them: Text Search, Commentary (by source category or a combined total), Trop (cantillation marks), Haftarah (Ashkenazi and Sephardi), Verse Length. Each overlay carries its own one-sentence description, and the help modal's Overlays tab is built from them.
  Text Dating is written and tested but off the menu on purpose: it is meant to
  come back as a mode of its own rather than a menu entry. Registering it again
  is one line in `src/overlays/index.ts`.
- **A guided story** in the right panel. Scrolling it moves the map from stop to
  stop; folding it away leaves the overlay controls and free exploration. The
  text is `public/data/story.md`, which the dev server hot-reloads.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The dev server runs at `http://localhost:5173`

## Testing

The project has comprehensive test coverage; `npx vitest run` prints the current count:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Coverage report
```

### The pre-commit hook

`.githooks/pre-commit` checks formatting, typechecks and runs the test suite
before every commit; read the file for what it does and how to bypass it
deliberately. **After cloning, run this once** to point git at it:

```bash
./scripts/install-hooks.sh
```

`npm install` usually does this for you via the `prepare` script, but not if
your npm config sets `ignore-scripts=true` (a reasonable supply-chain
precaution, and the setting on Danyel's machine) — then `prepare` is skipped
silently and you must run the script by hand. See it for what else it checks
and when it refuses to run.

### Test Harness

A standalone test harness at `http://localhost:5173/test-harness/` provides the search input flow without WebGL. Use this for visual testing of the search UI in headless browsers like Playwright where WebGL is unavailable. Source lives in `test-harness/`.

## Formatting

Prettier owns the formatting of the TypeScript, CSS, HTML and JSON in this
repository. The version is pinned exactly in `devDependencies`, because a minor
Prettier release can legitimately change its output, and a formatter that
drifts between contributors is the problem it was brought in to solve.

```bash
npm run format         # rewrite every file
npm run format:check   # report, change nothing
```

Two settings in `.prettierrc.json` were measured against the codebase rather
than chosen by taste, so the reformat moved as few lines as it could:
`singleQuote` because committed source held 6995 single-quoted strings to 1112
double, and `printWidth: 100` because line lengths ran to a p99 of 100.
`quoteProps: preserve` keeps the quotes on Hebrew object keys such as
`'ך': 'כ'` in `src/search.ts`, which Prettier would otherwise strip — they are
valid JavaScript identifiers, so nothing forces the quotes, but the letters are
much easier to pick out with them.

The bulk reformat is listed in `.git-blame-ignore-revs` so that blame keeps
naming whoever last wrote a line, instead of stopping at the commit that
rewrapped everything at once; `install-hooks.sh` applies that setting along
with the hooks path, and explains the one sharp edge it has on an old branch.

Markdown and `data/`/`public/data/` are excluded from formatting; see
`.prettierignore` for why.

## Project Structure

- `src/` — application source, plus `__tests__/` for the test suite. Includes
  a `scrollytelling/` mode, a `talmud/` mode with its own `main-talmud.ts`
  entry point, `styles/`, the `worker/` that serves the deployed site, and the
  `telemetry/` it records through.
- `public/data/` — shipped data: bundled verse texts, structure, the story, and
  a directory for what only one part of the app reads — `overlays/commentary`,
  `overlays/haftarah`, `search/` for the lexeme index, `talmud/` for Talmud
  text.
- `data/` — sources and downloads behind that shipped data, not itself
  shipped. Largely gitignored; see DATA_REGENERATION.md.
- `scripts/` — tooling to regenerate the data above, laid out to match
  `public/data/`, plus `demo/`, `talmud/` and the `telemetry/` queries.
- `docs/plans/` — design docs, one per feature, each dated and headed with
  its status.
- `experiments/` — prototypes that never shipped.
- `test-harness/` — the search-UI test harness (see Testing, below).

## Tech Stack

- **TypeScript** - Type-safe source code
- **Vite** - Build tool and dev server
- **WebGL 2** - GPU-accelerated rendering
- **Cloudflare Workers** - Serves the deployed site and receives its telemetry
- **No runtime dependencies** - Everything from scratch

## Deployment

The map is live at [torahmap.org](https://torahmap.org), served by a Cloudflare
Worker configured in `wrangler.jsonc`. Cloudflare builds and deploys on every
push to main, which takes about a minute; there is no deploy command to run by
hand. Every pull request also gets its own public `workers.dev` link, so a UI
change can be looked at without checking the branch out —
`scripts/prpreview.sh <pr>` serves one locally instead.

Static files are served before the Worker runs. The only route it owns is
`/api/event`, which writes one Analytics Engine data point per event
(`src/worker/index.ts`, with the client half in `src/analytics.ts`). No cookies
and nothing in browser storage; the dev server sends nothing. What each column
means is in `src/telemetry/schema.ts`, and `scripts/telemetry/report.sh` prints
every saved query — it needs a Cloudflare account id and an API token.

## Architecture

The codebase follows a **functional, modular design** with clear separation of concerns:

### Design Principles

1. **Separation of concerns** - Each module has a single responsibility
2. **Functional core** - Prefer pure functions over classes and mutation
3. **Immutable vs mutable** - Clear distinction (RenderContext vs RenderState)
4. **Two-pass rendering** - Separate "compute state" from "apply effects"
5. **Minimal state** - State lives at the right level of abstraction
6. **No circular dependencies** - Clean dependency graph from main.ts down

### Key Concepts

- **main.ts** orchestrates all modules and handles user interactions
- **layout.ts** computes fixed positions for all verses (Torah side-by-side, Nevi'im with prophets, Ketuvim with special groupings)
- **rendering.ts** manages WebGL infrastructure (RenderContext = immutable, RenderState = mutable)
- **itemColoring.ts** uses two-pass design: compute semantic state, then apply colors
- **overlays/** are pluggable and easy to add

## Data

Verse texts, structure and commentary counts come from
[Sefaria](https://www.sefaria.org/). The Hebrew lexeme index behind
meanings-mode search comes from the [ETCBC BHSA](https://github.com/ETCBC/bhsa)
database, read through Text-Fabric. The haftarah readings come from
[hebcal's leyning tables](https://github.com/hebcal/hebcal-leyning). See
[DATA_REGENERATION.md](DATA_REGENERATION.md) for instructions on updating data
files.

## Interactions

The help modal's Controls tab is the list readers see, and it is the one to keep
in step with the code:

- **Mouse wheel, or pinch** - Zoom (0.1x - 10x); the buttons in the corner do
  the same
- **Drag** - Pan
- **Hover** - Preview verse details
- **Click or tap a verse** - Pin it and show the sidebar; again to unpin, or
  Escape
- **Arrow keys** - Move from verse to verse
- **Overlay selector** - Switch between visualization modes
- **Search box** - Type to search Hebrew/English text with live results
- **Story strip** - Fold the story away for the controls, or open it again

The URL carries the overlay, its settings, the pinned verse, the camera and the
story stop (`src/urlState.ts`), so any view can be linked to.

## License

MIT
