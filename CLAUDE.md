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
- **Full-text search** with Hebrew/English support, nikkud-insensitive
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

A pre-commit hook runs `npm run typecheck` and the full test suite, and refuses
the commit if either fails. The two together take about six seconds.

The hook lives in `.githooks/pre-commit`, which is tracked in git. Git only
looks there once `core.hooksPath` is set, and that setting is local to your
clone — it cannot travel in a commit. **After cloning, run this once:**

```bash
./scripts/install-hooks.sh          # same as: git config core.hooksPath .githooks
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

A standalone test harness at `http://localhost:5173/test-harness/` provides the search input flow (Hebrew keyboard, transliteration, search) without WebGL. Use this for visual testing of keyboard/search UI in headless browsers like Playwright where WebGL is unavailable. Source lives in `test-harness/`.

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
├── public/data/
│   ├── all-texts.json            # Bundled verse texts (generated)
│   ├── tanakh-structure.json     # Verse counts per chapter per book
│   ├── commentary-counts.json    # Sefaria link counts by category
│   └── text-dating.json          # Estimated composition dates by verse
│
├── data/texts/           # Source Hebrew & English verse texts (78 files)
│
├── scripts/
│   ├── bundle-texts.ts               # Bundle all verse texts into one file
│   ├── download-texts.sh             # Download texts from Sefaria
│   ├── fetch-tanakh-structure.js     # Generate structure JSON from API
│   ├── generate-text-dating.ts       # Generate text dating data from source ranges
│   ├── process_sefaria_links.py      # (Deprecated) Old commentary counts script
│   └── process_sefaria_links_v2.py   # Generate commentary counts (USE THIS)
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

All data comes from [Sefaria](https://www.sefaria.org/). See [DATA_REGENERATION.md](DATA_REGENERATION.md) for instructions on updating data files.

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
