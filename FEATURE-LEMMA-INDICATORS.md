# Lemma Indicator Feature

## Summary

Added visual indicators to the search overlay legend showing which Hebrew search terms have valid lemma (root) data when using root search mode.

## Problem

When searching Hebrew text in root (שרש) mode, users had no way to know:
- Which search terms had valid lemma data available
- Which terms were falling back to whole-word search
- Why some searches might not return expected results

## Solution

Display visual indicators next to each search term in the legend showing the lemma data status:

- **✓ (green checkmark)**: Root data found - using lemma-based search
- **↪ (orange hook arrow)**: No root data - falling back to whole-word search

## Implementation

### Files Modified

1. **src/search.ts**
   - Exported `findLemmasForWord()` function (previously private)
   - This allows the overlay to check lemma availability for each term

2. **src/overlays/search.ts**
   - Added `termLemmaStatus: boolean[]` state variable
   - Import `findLemmasForWord` from search.ts
   - In `doSearch()`: Check each term for lemma data when in root mode
   - In `renderLegend()`: Display indicators next to each term
   - In `destroy()`: Reset `termLemmaStatus` array

3. **src/styles/overlays/search.css**
   - Added `.lemma-indicator` styling for the indicator icons

### Files Created

1. **src/__tests__/unit/overlays/search-lemma-indicators.test.ts**
   - Comprehensive test coverage for the feature
   - Tests indicator display, mode switching, and styling
   - All 5 tests passing

## Behavior

### When Indicators Appear

Indicators only appear when ALL of these conditions are met:
1. Search query contains Hebrew text
2. Hebrew search mode is set to "Root (שרש)"
3. At least one search term exists

### Indicator Meanings

**Green Checkmark (✓)**
- Lemma data found in `word-lemmas.json`
- Search uses morphological analysis
- Finds inflected forms of the root
- Tooltip: "Root data found"

**Orange Hook Arrow (↪)**
- No lemma data available for this term
- Falls back to whole-word matching
- Still nikkud-insensitive
- Tooltip: "No root data, using whole-word search"

### Example Searches

**All terms with lemmas:**
```
אלהים,ברא,אור
```
All three show green ✓

**Mixed availability:**
```
אלהים,xyz,ברא
```
- "אלהים" - green ✓ (lemma found)
- "xyz" - orange ↪ (no lemma)
- "ברא" - green ✓ (lemma found)

**Non-root modes:**
In substring or whole-word modes, no indicators appear (not relevant).

## Technical Notes

### Lemma Data Source

- Data loaded from `/data/word-lemmas.json` and `/data/verse-lemmas.json`
- Generated from MorphHB (morphological Hebrew Bible)
- Contains Strong's numbers for ~8,000 Hebrew words
- Updated via `npm run generate:lemmas` (if available)

### Performance

- Lemma lookups are O(1) Map lookups
- Status computed only when search mode changes or query updates
- Minimal performance impact (< 1ms for typical queries)

### Fallback Behavior

If lemma data files don't exist or fail to load:
- All searches fall back to whole-word mode
- All indicators would show orange ↪
- No errors or crashes - graceful degradation

## Testing

### Unit Tests

```bash
npm test src/__tests__/unit/overlays/search-lemma-indicators.test.ts
```

5 tests covering:
1. Indicators appear in root mode for Hebrew
2. No indicators in substring mode
3. No indicators for English search
4. Indicators update when switching modes
5. Proper styling (color, title attributes)

### Manual Testing

1. Open app at http://localhost:5173
2. Select "Search" overlay
3. Click Hebrew keyboard button (א)
4. Set mode to "Root (שרש)"
5. Type: `אלהים,ברא` (both should show green ✓)
6. Try: `xyz,אור` (xyz shows orange ↪, אור shows green ✓)
7. Switch to "Substring" mode - indicators disappear
8. Switch back to "Root" - indicators reappear

## Future Enhancements

Possible improvements:
- Show count of verses found via root vs. fallback
- Highlight in results which matches used root data
- Link to detailed lemma information (Strong's numbers, definitions)
- Allow disabling fallback (root-only strict mode)

## References

- Issue: (Add issue number here)
- MorphHB: https://github.com/openscriptures/morphhb
- Strong's Concordance: https://en.wikipedia.org/wiki/Strong%27s_Concordance
