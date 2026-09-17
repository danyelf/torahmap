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
- **Full-text search** with Hebrew/English support, nikkud-insensitive; root
  mode resolves a written form to the dictionary words it can be, so every
  inflected form is found and words that merely share a spelling stay apart.
  How a word is matched — substring, whole word, or root — belongs to that
  word, so one term can be searched by root while another is pinned to an
  exact spelling
- **Pluggable overlays**, in the order the menu offers them: Text Search, Commentary (by source category or a combined total), Trop (cantillation marks), Haftarah (Ashkenazi and Sephardi), Text Dating (6 historical periods), Verse Length. Each overlay carries its own one-sentence description, and the help modal's Overlays tab is built from them.

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
  entry point, and `styles/`.
- `public/data/` — shipped data: bundled verse texts, structure, and one
  directory per overlay for what only it reads (commentary counts, the
  haftarah mapping, the search lexeme index, Talmud text).
- `data/` — sources and downloads behind that shipped data, not itself
  shipped. Largely gitignored; see DATA_REGENERATION.md.
- `scripts/` — tooling to regenerate the data above, one directory per
  overlay for what only it needs, plus `demo/` and `talmud/`.
- `docs/plans/` — design docs, one per feature, each dated and headed with
  its status.
- `experiments/` — prototypes that never shipped.
- `test-harness/` — the search-UI test harness (see Testing, below).

## Tech Stack

- **TypeScript** - Type-safe source code
- **Vite** - Build tool and dev server
- **WebGL 2** - GPU-accelerated rendering
- **No runtime dependencies** - Everything from scratch

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
[Sefaria](https://www.sefaria.org/). The Hebrew lexeme index behind root-mode
search comes from the [ETCBC BHSA](https://github.com/ETCBC/bhsa) database, read
through Text-Fabric. The haftarah readings come from
[hebcal's leyning tables](https://github.com/hebcal/hebcal-leyning). See
[DATA_REGENERATION.md](DATA_REGENERATION.md) for instructions on updating data
files.

## Interactions

- **Mouse wheel** - Zoom (0.1x - 10x)
- **Click + drag** - Pan
- **Hover** - Show verse reference
- **Click verse** - Pin and show sidebar with text
- **Click pinned verse** - Unpin
- **Overlay selector** - Switch between visualization modes
- **Search box** - Type to search Hebrew/English text with live results

## License

MIT
