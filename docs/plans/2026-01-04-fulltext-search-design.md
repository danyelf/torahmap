# Full-Text Search Design

## Overview

Word-wheeling (instant) full-text search supporting both English and Hebrew, with verse highlighting on the map.

## Requirements

- Instant results as user types (true word-wheeling)
- Partial/substring matching ("lov" matches "love", "loving", "beloved")
- Hebrew search ignores nikkud (vowel marks)
- Search box in controls panel (top-right)
- 10 results shown before scrolling
- Selecting a result: highlights matching verses on map + opens sidebar to first match

## UI Components

### Search Input
- Location: Top of controls panel
- Placeholder: "Search Hebrew or English..."
- Full width of controls panel (~180px)
- Clear button (×) when text is entered

### Results Dropdown
- Max 10 visible results, scrollable beyond
- Each result shows: verse reference + snippet with match highlighted
- Click to select

## Search Index

### Structure
Built at startup after loading verse texts:
- One entry per verse (~23,000 total)
- Fields: book, chapter, verse, hebrewText (nikkud-stripped), englishText (lowercased)

### Matching Logic
1. Detect input language by character codes (Hebrew: 0x0590-0x05FF)
2. Hebrew: strip nikkud from query, substring match against stripped text
3. English: lowercase query, substring match
4. Results sorted by canonical order (Genesis → II Chronicles)

### Performance
- Synchronous search on each keystroke
- ~23k entries with simple substring is fast enough

## Highlighting

- Matched verses get bright highlight color
- Non-matched verses dim slightly
- Highlight clears when search is cleared

## Interaction Flow

1. User types → results appear instantly
2. User clicks result → sidebar opens, all matches stay highlighted
3. User clears search → highlights clear, sidebar stays if pinned

## Implementation

### New Files
- `src/search.ts` - Index building, nikkud stripping, matching

### Modified Files
- `index.html` - Search input and dropdown in controls
- `src/main.ts` - Initialize index, wire events, handle highlighting
- `src/webgl.ts` - Verse highlight capability
