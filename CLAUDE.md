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
  inflected form is found and words that merely share a spelling stay apart
- **Pluggable overlays**: Search, Commentary (8 categories), Trop (39 cantillation marks), Text Dating (6 historical periods), Haftarah

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

The project has comprehensive test coverage (1000+ tests):

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Coverage report
```

### The pre-commit hook

A pre-commit hook checks that the staged files are formatted, runs
`npm run typecheck` and runs the full test suite, and refuses the commit if any
of the three fails. Together they take about six seconds.

Formatting is checked on the staged files rather than the whole tree, so a
branch that predates the bulk reformat can still commit the files it touches.
When it fails, `npm run format` fixes it.

The hook lives in `.githooks/pre-commit`, which is tracked in git. Git only
looks there once `core.hooksPath` is set, and that setting is local to your
clone — it cannot travel in a commit. **After cloning, run this once:**

```bash
./scripts/install-hooks.sh          # sets core.hooksPath and blame.ignoreRevsFile
```

It is also wired to npm's `prepare` script, so plain `npm install` usually does
it for you. Do not count on that: if your npm config sets `ignore-scripts=true`
(a reasonable supply-chain precaution, and the setting on Danyel's machine),
npm skips `prepare` silently and you must run the script yourself. Running it
twice is harmless — and re-running repairs a hook whose executable bit got
lost, which git would otherwise skip without saying anything.

If `core.hooksPath` is already set to something else, the script refuses rather
than clobber what may be a global or organisation-wide setting. It prints what
is set and tells you to re-run with `--force` if that value is stale.

The path is stored as the relative string `.githooks`, which git resolves
against whichever working tree is committing. One setting therefore covers the
main checkout and every worktree, and each runs the hook checked out on its own
branch. A branch that predates `.githooks` has no hook and commits without
checks — rebase it onto main to get the gate back.

To bypass deliberately (not recommended): `git commit --no-verify`

If the hook stops with "Dependencies are not installed", that is not a problem
with your code — the worktree has no `node_modules`. Run `npm install` and
commit again.

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
rewrapped everything at once. GitHub reads that file by itself;
`install-hooks.sh` applies the local setting along with the hooks path.

One sharp edge, on a branch cut from before the reformat: `blame.ignoreRevsFile`
is repository-wide config, and git fails every `git blame` outright when the
file it names is absent. Rebase the branch, or `git config --unset
blame.ignoreRevsFile` until you do.

Markdown is not formatted. Prettier aligns table columns by counting
characters, and the tables here hold Hebrew and em-dashes, which are not one
column wide; the result is rows that line up worse than the hand-written ones
and run to several hundred characters. `data/` and `public/data/` are also
ignored: large, generated, and not ours to reformat.

## Project Structure

```
├── src/
│   ├── main.ts              # Entry point and application orchestration
│   │
│   ├── Core Modules         # Extracted from main.ts for clarity
│   ├── camera.ts            # Camera state (zoom, pan)
│   ├── mouseState.ts        # Mouse interaction state (dragging, hovering)
│   ├── rendering.ts         # WebGL rendering infrastructure
│   ├── verseColoring.ts     # Verse color computation and highlighting
│   ├── hitDetection.ts      # Screen-to-world coordinates and hit testing
│   ├── sidebar.ts           # Sidebar DOM manipulation and verse details
│   ├── outline.ts           # Outline geometry for highlighted verses
│   │
│   ├── Infrastructure       # Foundation and data loading
│   ├── layout.ts            # Position computation for all verses
│   ├── types.ts             # TypeScript interfaces
│   ├── webgl.ts             # Shader compilation and WebGL setup
│   ├── geometry.ts          # Vertex buffer building
│   ├── labels.ts            # Book label overlay positioning
│   ├── verseTexts.ts        # Verse text loading from Sefaria
│   ├── search.ts            # Full-text search with Hebrew/English support
│   ├── trop.ts              # Cantillation mark parsing and indexing
│   ├── urlState.ts          # URL state management and browser history
│   ├── help.ts              # Help modal system
│   │
│   ├── overlays/            # Modular overlay system
│   │   ├── index.ts         # Public exports
│   │   ├── registry.ts      # Overlay registration
│   │   ├── types.ts         # Overlay interface definitions
│   │   ├── commentary.ts    # Commentary link count heatmap
│   │   ├── trop.ts          # Cantillation mark visualizer
│   │   ├── search.ts        # Full-text search overlay
│   │   ├── haftarah.ts      # Haftarah portions overlay
│   │   └── text-dating.ts   # Text dating visualization
│   │
│   ├── utils/               # Utility functions
│   │   ├── color.ts         # Color manipulation utilities
│   │   └── random.ts        # Seeded random number generation
│   │
│   └── constants/           # Shared constants
│       └── books.ts         # Book names and metadata
│
├── public/data/              # Shipped data. Shared files at the top, and one
│   │                         # directory per overlay for what only it reads.
│   ├── all-texts.json            # Bundled verse texts (generated)
│   ├── tanakh-structure.json     # Verse counts per chapter per book
│   ├── text-dating.json          # Estimated composition dates by verse
│   ├── overlays/
│   │   └── commentary/
│   │       └── counts.json       # Sefaria link counts by category
│   └── search/                   # Lexeme index for root-mode search (see its README)
│       ├── README.md             # Where this data comes from and how to rebuild it
│       ├── lexicon.json          # Hebrew/Aramaic dictionary from ETCBC BHSA
│       ├── word-lexemes.json     # Written form -> the dictionary words it can be
│       ├── verse-lexemes.json    # Verse -> the dictionary words occurring in it
│       └── verse-morphology.json # Grammatical parsing per word (not loaded by search)
│
├── data/                     # Sources and downloads, not shipped. Same shape.
│   ├── texts/                    # Hebrew & English verse texts (78 files)
│   └── overlays/
│       └── commentary/           # Gitignored; see DATA_REGENERATION.md
│           ├── sefaria-links/    # The links export, ~650MB of CSV
│           └── sefaria-index.json # What kind of text each work in the library is
│
├── scripts/                  # Shared tooling at the top, one directory per
│   │                         # overlay for what only it needs.
│   ├── bundle-texts.ts               # Bundle all verse texts into one file
│   ├── download-texts.sh             # Download texts from Sefaria
│   ├── fetch-tanakh-structure.js     # Generate structure JSON from API
│   ├── generate-text-dating.ts       # Generate text dating data from source ranges
│   ├── overlays/
│   │   └── commentary/
│   │       ├── refresh.sh            # The whole procedure: download, count, report
│   │       ├── process_sefaria_links.py     # Turn the links export into counts
│   │       ├── test_process_sefaria_links.py
│   │       ├── verify-against-sefaria.py    # Compare the counts to the live site
│   │       └── compare_counts.py            # Say what a refresh changed
│   └── search/
│       └── generate-lexeme-index.py  # Build the Hebrew lexeme index from ETCBC BHSA
│
```

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
- **verseColoring.ts** uses two-pass design: compute semantic state, then apply colors
- **overlays/** are pluggable and easy to add

## Data

Verse texts, structure and commentary counts come from
[Sefaria](https://www.sefaria.org/). The Hebrew lexeme index behind root-mode
search comes from the [ETCBC BHSA](https://github.com/ETCBC/bhsa) database, read
through Text-Fabric. See [DATA_REGENERATION.md](DATA_REGENERATION.md) for
instructions on updating data files.

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
