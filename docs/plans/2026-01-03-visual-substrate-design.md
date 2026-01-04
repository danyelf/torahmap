# Visual Substrate for Biblical Text Analysis

## Overview

A stable spatial map where every verse of the Torah (and later Tanakh) has a permanent position. Analysis is applied as color overlays on top of this unchanging substrate.

## Design Principles

1. **Position stability** - Verse positions never change regardless of what analysis is displayed
2. **Forest over trees** - See all verses at once; patterns emerge from density and color
3. **Substrate first** - Build the map before plotting data on it

## Layout Structure

### Hierarchy
- **Books as columns** - Side by side (5 columns for Torah)
- **Chapters as rows** - Within each column, each chapter is one horizontal row
- **Verses as squares** - ~10px, flowing left-to-right within each row
- **Ragged right edges** - Chapters end where they end; the silhouette encodes chapter length

### Visual Result
- Genesis: 50 rows, widest is chapter 24 (67 verses)
- Each book has a distinct "shape"
- Full Torah (~5,845 verses) visible on one screen
- Tanakh version (39 columns) grouped by Torah/Nevi'im/Ketuvim

## Technical Approach

### Rendering
- WebGL canvas for performance (handles 23,000+ quads)
- Each verse is a colored quad at a computed position
- Zoom and pan via 2D camera transform
- Positions computed once from structure data

### Data
- Static JSON with verse structure: `{ book, chapter, verseCount }` per chapter
- Layout computed by iterating books → chapters → verses
- Rich data (text, overlays) fetched on demand later

### Interaction (minimal for now)
- Hover shows verse reference ("Genesis 3:15")
- Nothing else initially

## Visual Specification

### Sizing (Torah)
- Verse squares: ~10px
- Longest chapter: 67 verses → ~670px wide
- Tallest book: Genesis, 50 chapters → ~500px tall
- Total: ~3500px wide × ~550px tall

### Spacing
- 2-4px gaps between chapters
- 8-16px gaps between books
- Book labels above columns
- Optional faint chapter numbers

### Initial Appearance
- All verses in neutral base color (light gray)
- Ready to accept per-verse color overlays

## Scope

### Building Now
- Static substrate with all verse positions
- WebGL renderer with zoom/pan
- Hover for verse reference
- Torah view (5 books)

### Future Extensions (design supports)
- Color overlays for analysis
- Text fetching from Sefaria
- Detail panels
- Tanakh view (39 books)
- Multiple simultaneous overlays

## Data Files

- `torah-structure.json` - chapter/verse counts for 5 books
- `tanakh-structure.json` - full 39 books (later)
