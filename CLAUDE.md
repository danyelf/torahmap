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

## Project Structure

```
├── src/
│   ├── main.ts          # Entry point, interactions, overlay switching
│   ├── layout.ts        # Position computation for all verses
│   ├── types.ts         # TypeScript interfaces
│   ├── webgl.ts         # Shader compilation and WebGL setup
│   ├── geometry.ts      # Vertex buffer building
│   ├── labels.ts        # Book label overlay positioning
│   ├── verseTexts.ts    # Verse text loading from Sefaria
│   ├── search.ts        # Full-text search with Hebrew/English support
│   ├── trop.ts          # Cantillation mark parsing and indexing
│   └── overlays/        # Modular overlay system
│       ├── index.ts     # Public exports
│       ├── registry.ts  # Overlay registration
│       ├── types.ts     # Overlay interface definitions
│       ├── divine-names.ts
│       ├── commentary.ts
│       ├── trop.ts
│       └── search.ts
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
└── docs/plans/           # Design documents
```

## Tech Stack

- **TypeScript** - Type-safe source code
- **Vite** - Build tool and dev server
- **WebGL 2** - GPU-accelerated rendering
- **No runtime dependencies** - Everything from scratch

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

## Design Documents

See `docs/plans/` for detailed design documents:

- `2026-01-03-visual-substrate-design.md` - Overall vision and philosophy
- `2026-01-03-substrate-implementation.md` - Implementation details
- `2026-01-04-divine-names-overlay-design.md` - Divine names feature specification
- `2026-01-04-fulltext-search-design.md` - Full-text search implementation
- `2026-01-04-trop-visualizer-design.md` - Cantillation mark visualizer
- `2026-01-04-overlay-modules-design.md` - Modular overlay architecture

## License

MIT
