# Hebrew Search Performance Fix (tm-6mw3)

## Summary

Fixed laggy Hebrew search performance by optimizing the root mode search algorithm with inverted indices. Search is now **3x faster** (16ms vs 50ms for common words).

## Problem Identified

The original search-by-word function used a naive O(V × L × W) algorithm:
- V = number of verses (~23,000)
- L = number of dictionary words the term resolved to (typically 1-5)
- W = average words per verse (~20-30)

For a common word like "אלהים" (God):
- **~1.7 million operations per search**
- Noticeable lag when typing

## Solution Implemented

Added two key optimizations:

### 1. Inverted Index (word → verses)
```typescript
let lexemeToVerses: Map<LexemeId, Set<string>>
```
- Maps each dictionary word to the set of verses it occurs in
- Built once during `loadLexiconData()`
- Enables O(1) lookup per word instead of O(V) iteration

### 2. Verse Key Map (verseKey → entry)
```typescript
let verseKeyToEntry: Map<string, IndexEntry>
```
- Maps verse keys to index entries
- Built during `buildSearchIndex()`
- Replaces O(V) `searchIndex.find()` calls with O(1) Map lookups

## Performance Results

**Before optimization:**
- Common word search: ~50ms
- Algorithm complexity: O(V × L × W)
- ~1.7M operations for "אלהים"

**After optimization:**
- Common word search: ~16ms
- Algorithm complexity: O(L × M) where M = avg matches per word
- ~7,800 operations for "אלהים" (217x reduction!)

**Test results:**
- All 1358 tests pass ✓
- Performance test: root mode < 50ms ✓ (was failing before)

## Testing

### Automated Tests
```bash
npm test  # All tests pass
npm test -- search-performance.test.ts  # Performance regression tests
```

### Manual Testing
1. Start dev server: `npm run dev`
2. Open http://localhost:5185/src/__tests__/performance/interactive-search.manual.html
3. Type Hebrew words (try: אלהים, בראשית, יהוה)
4. Observe search times in real-time metrics

### Expected Results
- Search time: < 50ms for common words (typically 10-30ms)
- No noticeable lag when typing
- Results appear instantly

## Files Changed

- `src/search.ts`:
  - Added the `lexemeToVerses` inverted index
  - Added `verseKeyToEntry` fast lookup map
  - Added the `buildVerseIndex()` function
  - Optimized search-by-word to use the inverted index
  - Optimized `searchByRootMode()` to use verse key map

- New test files:
  - `src/__tests__/unit/search-performance.test.ts` - Performance regression tests
  - `src/__tests__/performance/hebrew-search-perf.test.ts` - Diagnostic tests
  - `src/__tests__/performance/interactive-search.manual.html` - Manual testing tool

## Technical Details

### Inverted Index Build (happens once at startup)
```typescript
function buildVerseIndex(): void {
  lexemeToVerses = new Map();

  for (const [verseKey, lexemes] of Object.entries(verseToLexemes)) {
    for (const lexeme of lexemes) {
      let verses = lexemeToVerses.get(lexeme);
      if (!verses) {
        verses = new Set();
        lexemeToVerses.set(lexeme, verses);
      }
      verses.add(verseKey);
    }
  }
}
```

### Optimized Search (happens on every keystroke)
```typescript
// Before: O(V × L × W) - iterate all 23,000 verses
for (const [verseKey, verseWords] of Object.entries(verseToLexemes)) {
  if (lexemes.some(lexeme => verseWords.includes(lexeme))) {
    matchingVerses.add(verseKey);
  }
}

// After: O(L × M) - lookup only matching verses
for (const lexeme of lexemes) {
  const verses = lexemeToVerses.get(lexeme);  // O(1)
  if (verses) {
    for (const verseKey of verses) {
      matchingVerses.add(verseKey);
    }
  }
}
```

## Next Steps

The fix is ready to merge. To verify in production:

1. Test the app manually at http://localhost:5185
2. Try searching for common Hebrew words with root mode
3. Confirm no lag when typing
4. If satisfied, merge to main using the land-bead.sh script

## Notes

- The optimization maintains 100% backward compatibility
- Fallback logic preserved if inverted index isn't available
- Memory overhead is minimal (~2-3MB for the inverted index)
- Build time impact is negligible (~10ms at startup)
