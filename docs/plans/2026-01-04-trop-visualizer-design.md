# Trop Visualizer Design

## Overview

Add a trop (cantillation marks) visualizer to TorahMap. When a user selects a trop mark from a visual selection chart, the map highlights the density of that trop across the entire Tanakh. This is especially interesting for unusual/rare trop marks.

## Data Pipeline

### Source
Trop marks are already embedded in the existing Sefaria Hebrew texts as Unicode cantillation marks (U+0591 - U+05AF range).

### Extraction
On build (or first load), scan all 23K+ verses and:
1. Extract each cantillation mark from every verse
2. Build an index: `Map<TropMark, VerseRef[]>` - which verses contain which trop
3. Count total occurrences per trop to determine rarity tier
4. Cache as `trop-index.json` (~50-100KB)

### Rarity Tiers
- **Rare**: < 50 occurrences
- **Uncommon**: 50-500 occurrences
- **Common**: 500+ occurrences

## UI: Selection Chart

### Overlay Integration
Add "Trop" as a fourth option in the overlay selector (None / Divine Names / Commentary / Trop). When selected, a trop chart panel appears below the selector.

### Chart Layout
- Compact grid of ~27 trop marks
- Ordered by frequency (rarest first, at top)
- Each cell shows the trop symbol
- Hover tooltip: name + occurrence count + rarity tier
- Selected trop gets highlight ring/border
- Clicking immediately updates visualization

### Visual Style
Clean, minimal - matches existing controls aesthetic. Rare trop may get subtle indicator (star or colored dot) to draw attention.

## Visualization: Adaptive by Rarity

### Rare Trop (< 50 occurrences)
- **Matching verses**: Bright, saturated color (gold/amber)
- **Non-matching**: Very dim gray
- **Effect**: Sparse glowing dots - instantly see all locations

### Uncommon Trop (50-500 occurrences)
- Gradient from dim to medium brightness based on count in verse
- Reveals clustering patterns (e.g., "appears heavily in Psalms")

### Common Trop (500+ occurrences)
- Full heatmap similar to commentary overlay
- Logarithmic scale for wide count ranges
- Shows structural patterns between prose and poetry

### Color Palette
Purple/violet spectrum or gold/amber - distinct from commentary (blue→red).

## Sidebar Interaction

When user clicks a verse while in Trop overlay mode:
- Standard sidebar content (Hebrew, English, Sefaria link)
- Selected trop mark highlighted in the Hebrew text (background color or underline)
- Multiple instances of same trop all highlighted

## Implementation

### Files to Modify
- `types.ts` - Add TropData interface
- `main.ts` - Add trop overlay logic, sidebar highlighting
- `index.html` - Add trop chart UI in controls panel

### New Files
- `trop.ts` - Extraction, indexing, frequency calculation
- `trop-index.json` - Pre-computed index (or generated on first load)

## Out of Scope (YAGNI)
- Multi-select trop
- Trop-to-trop relationship analysis
- Audio playback of trop melody
