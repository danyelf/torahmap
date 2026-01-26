@AGENTS.md

# Torah Map

An interactive spatial visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position, enabling analytical overlays to reveal patterns across the 39 books and 23,000+ verses.

## Philosophy: Forest Over Trees

The core design principle is **position stability** - each verse occupies a permanent location regardless of which analysis is displayed. This allows:

- Pattern recognition through color and density
- Comparison across different analyses on the same substrate
- The "ragged edge" of chapters naturally encodes chapter length

## Features

### Visualization
- **23,000+ verses** rendered as colored squares using WebGL
- **Three sections**: Torah → Nevi'im → Ketuvim (stacked vertically)
- **Smooth zoom/pan** with mouse wheel and drag
- **Verse details** on hover/click with Hebrew text, English translation, and Sefaria link

### Overlays

| Overlay | Description |
|---------|-------------|
| **None** | Gray with subtle brightness variation |
| **Divine Names** | Colors by divine name usage: Blue (YHWH), Red (Elohim), Purple (both), Gray (neither). Torah only. |
| **Commentary** | Logarithmic heatmap of Sefaria commentary link counts, filterable by 9 categories |
| **Trop** | Cantillation mark (trope) visualizer - select any of the 39 trop marks to see where they appear across Tanakh, with rarity-based coloring (gold for rare marks, heatmap for common ones) |
| **Search** | Full-text search with Hebrew/English support - highlights matching verses on the map |

Commentary categories: Talmud, Midrash, Halakhah, Chasidut, Kabbalah, Jewish Thought, Musar, Responsa, Tanakh (cross-references)

### Search

- **Word-wheeling**: Results appear as you type
- **Bilingual**: Searches both Hebrew and English text
- **Nikkud-insensitive**: Hebrew searches ignore vowel marks
- **Visual integration**: Matching verses highlighted on the map via Search overlay

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

The project has comprehensive test coverage with **831 tests** covering all major functionality:

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Pre-commit Hook

A pre-commit hook automatically runs all tests before allowing commits. This ensures:
- All 831 tests pass before code enters the repository
- No broken commits
- Immediate feedback on test failures

The hook is installed automatically via `bd hooks` (beads issue tracker). If you need to bypass it (not recommended):

```bash
git commit --no-verify
```

### Test Coverage

- **Utilities**: 100% coverage (color, random functions)
- **URL State**: 95%+ coverage (parsing, serialization, browser history)
- **Geometry/WebGL**: 85%+ coverage (buffer building, shader compilation)
- **Overlays**: 90%+ coverage (commentary, divine-names, search, trop)
- **Integration**: Full workflow testing (overlay switching, URL sync)

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
│   │   ├── divine-names.ts  # Divine names overlay (YHWH, Elohim)
│   │   ├── commentary.ts    # Commentary link count heatmap
│   │   ├── trop.ts          # Cantillation mark visualizer
│   │   ├── search.ts        # Full-text search overlay
│   │   └── haftarah.ts      # Haftarah portions overlay
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
│   ├── divine-names.json         # Divine name encodings (Torah)
│   └── commentary-counts.json    # Sefaria link counts by category
│
├── data/texts/           # Source Hebrew & English verse texts (78 files)
│
├── scripts/
│   ├── bundle-texts.ts            # Bundle all verse texts into one file
│   ├── download-texts.sh          # Download texts from Sefaria
│   ├── fetch-tanakh-structure.js  # Generate structure JSON from API
│   ├── generate-divine-names.ts   # Generate divine names from Torah text
│   └── process_sefaria_links.py   # Generate commentary counts from Sefaria links
│
```

## Tech Stack

- **TypeScript** - Type-safe source code
- **Vite** - Build tool and dev server
- **WebGL 2** - GPU-accelerated rendering
- **No runtime dependencies** - Everything from scratch

## Architecture

The codebase follows a **functional, modular design** with clear separation of concerns. After a major refactoring (tm-1qi), the monolithic `main.ts` was split into focused modules:

### Core Modules

**main.ts** - Application orchestrator
- Wires together all modules
- Handles user interactions (mouse, keyboard, UI)
- Manages application state (current overlay, pinned verse)
- Coordinates between overlay system and rendering pipeline

**camera.ts** - Camera state management
- Tracks zoom (0.1x - 10x) and pan position
- Provides zoom clamping and pan adjustment for zoom-to-cursor behavior
- Pure functions operating on immutable Camera interface

**mouseState.ts** - Mouse interaction state
- Tracks dragging state and hovered verse
- Provides utilities for drag operations and verse comparison
- Minimal state, clear mutation points

**rendering.ts** - WebGL rendering infrastructure
- **RenderContext**: Immutable WebGL infrastructure (gl context, compiled shaders)
- **RenderState**: Mutable rendering state (vertex buffers, verse data, DPR)
- Separation between "created once" and "changes during lifecycle"
- Main render loop and outline rendering

**verseColoring.ts** - Verse color computation
- **Two-pass design**: First compute semantic state (computeVerseStates), then apply colors (applyVerseColors)
- Handles base colors, overlay colors, and hover highlighting
- Separation of "what is true" from "how to render it"

**hitDetection.ts** - Coordinate transformation and hit testing
- Screen-to-world coordinate conversion
- Exact hit detection (point in bounds)
- Fuzzy hit detection (nearest verse within radius)
- Combined algorithm for robust verse selection

**sidebar.ts** - Verse details sidebar
- DOM manipulation for sidebar display
- Integration with overlays for contextual information
- Positioning logic relative to controls panel
- Clean separation from main.ts

**outline.ts** - Highlight outline geometry
- Generates WebGL geometry for verse borders
- Used for hover and pinned verse highlighting
- 4 border rectangles (24 vertices) per outline

### Design Principles

1. **Separation of concerns**: Each module has a single, well-defined responsibility
2. **Functional core**: Prefer pure functions over classes and mutation
3. **Immutable vs mutable**: Clear distinction (RenderContext vs RenderState)
4. **Two-pass rendering**: Separate "compute state" from "apply effects" for clarity
5. **Minimal state**: State lives at the right level of abstraction
6. **No circular dependencies**: Clean dependency graph from main.ts down

### Module Dependencies

```
main.ts (orchestrator)
  ├─→ camera.ts (zoom/pan state)
  ├─→ mouseState.ts (interaction state)
  ├─→ rendering.ts (WebGL)
  │     ├─→ webgl.ts (shader compilation)
  │     ├─→ geometry.ts (vertex buffers)
  │     ├─→ outline.ts (highlight geometry)
  │     └─→ labels.ts (book labels)
  ├─→ verseColoring.ts (color logic)
  │     └─→ utils/random.ts (seeded randomness)
  ├─→ hitDetection.ts (coordinate transform)
  ├─→ sidebar.ts (verse details UI)
  │     └─→ overlays/*.ts (for contextual info)
  ├─→ layout.ts (verse positioning)
  ├─→ urlState.ts (browser state sync)
  └─→ overlays/ (data visualizations)
        ├─→ registry.ts (overlay management)
        └─→ types.ts (overlay interface)
```

## Layout Algorithm

The layout handles complex arrangement requirements:

- **Torah**: 5 books side-by-side
- **Nevi'im**: Major prophets as columns, 12 minor prophets in 4 sub-columns
- **Ketuvim**: Regular books + Psalms (2-column split) + stacked groups (Five Scrolls, Chronicles, Ezra/Nehemiah)
- **Chapter wrapping**: Long chapters (>50 verses) wrap to multiple lines
- **Widow prevention**: Avoids leaving <3 verses orphaned on a line
- **Visual noise reduction**: Position jitter and brightness variation to reduce moiré patterns

## Data Sources

All data comes from [Sefaria](https://www.sefaria.org/):

- **Verse texts**: [Sefaria-Export](https://github.com/Sefaria/Sefaria-Export) GitHub repository
- **Structure data**: Sefaria `/api/shape/` endpoint
- **Commentary links**: Sefaria Links CSV exports

## Regenerating Data

```bash
# Download all verse texts (~10MB)
bash scripts/download-texts.sh

# Bundle verse texts into single file (required after downloading)
npx tsx scripts/bundle-texts.ts

# Regenerate structure from Sefaria API
node scripts/fetch-tanakh-structure.js > public/data/tanakh-structure.json

# Regenerate divine names data
npx tsx scripts/generate-divine-names.ts

# Regenerate commentary counts
python3 scripts/process_sefaria_links.py > public/data/commentary-counts.json
```

## Interactions

| Action | Effect |
|--------|--------|
| Mouse wheel | Zoom (0.1x - 10x) |
| Click + drag | Pan |
| Hover | Show verse reference |
| Click verse | Pin and show sidebar with text |
| Click pinned verse | Unpin |
| Overlay selector | Switch between None / Divine Names / Commentary / Trop / Search |
| Category filter | Filter commentary heatmap by source type |
| Trop selector | Choose cantillation mark to visualize |
| Search box | Type to search Hebrew/English text with live results |

## License

MIT
