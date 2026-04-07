---
id: tm-zz3f
status: closed
priority: 1
type: bug
created: 2026-01-29
closed: 2026-01-29
---

# Debug: Hebrew search still slow despite optimization (2.7s unexplained)

## Context
Working on tm-6mw3 (Hebrew search performance). Initial optimization added inverted index to speed up lemma-based searches, but performance is still poor.

## What We Know

### Initial Problem
Hebrew search felt laggy when typing. Root mode search was using O(V × L × W) algorithm iterating through all 23,000 verses.

### Optimization Implemented
1. **Inverted Index**: Built `lemmaToVerses: Map<string, Set<string>>` mapping Strong's numbers to verse keys
   - Converts O(V) search to O(1) lookup per lemma
   - Successfully built: 8,640 unique lemmas in ~17-25ms
   - File: src/search.ts, function: buildLemmaInvertedIndex()

2. **Verse Key Map**: Added `verseKeyToEntry: Map<string, IndexEntry>` for O(1) verse lookups
   - Eliminates O(n) searchIndex.find() calls
   - Built during buildSearchIndex()

3. **Critical Bug Fixed**: findLemmasForWord() was using normalizeHebrewForSearch() which converts final forms (ם→מ), but morphhb database keys preserve final forms
   - Fixed by using stripNikkud() instead (commit 80bd24f)
   - Now correctly finds lemmas for words like "אלהים"

### Current State
**INVERTED INDEX IS WORKING** but search is still VERY SLOW:

Test: searching for "אלהים" (God, very common word)
- Expected: ~10-30ms
- **Actual: 2748ms (2.7 SECONDS!)**
- Results: 2,246 matching verses

Console logs show:
```
✓ Built lemma inverted index: 8640 unique lemmas in 17.40ms
findLemmasForWord("אלהים") stripped to "אלהים"
  ✓ Found direct match: 1 lemmas
searchByLemmas (inverted index): 0.20ms for 1 lemmas → 2246 verses
Processing 2246 matching verses...
Timing breakdown for 2246 verses:
  - searchByLemmas: 0.20ms
  - findWordIndexByLemma: 1.50ms
  - getWordBoundaries: 2.90ms
  - createSnippet: 0.40ms
  - Total processing: 2748.80ms
```

**THE MYSTERY**: Measured operations only sum to ~5ms, but total is 2748ms. **2,743ms is unaccounted for!**

## What We Don't Know

**Where is the 2.7 seconds being spent?**

Latest timing instrumentation (commit d4056e5) added tracking for:
- Map lookups (verseKeyToEntry.get, resultMap.get/set)
- Array.some() checks
- All previously measured operations

Next test will show "Unaccounted" time revealing the bottleneck.

### Hypotheses to Test
1. **Set iteration overhead**: `for (const verseKey of matchingVerseKeys)` over 2,246 items?
2. **findWordIndexByLemma internal operations**: Are we measuring it correctly? Does it have hidden costs?
3. **verseLemmas lookups**: Function accesses `verseLemmas[verseKey]` - is this slow?
4. **searchHebrewWholeWord fallback**: Line 528 calls this as fallback - is it being triggered unexpectedly?
5. **Performance.now() overhead**: Are the timing measurements themselves causing slowdown?

## Files Modified
- src/search.ts (main changes)
  - Added lemmaToVerses inverted index
  - Added verseKeyToEntry map
  - Fixed findLemmasForWord normalization bug
  - Added extensive diagnostic logging
- Test files created:
  - test-search-diagnostic.html
  - test-search-only.html
  - test-search-perf.html

## How to Reproduce
1. Start dev server: `npm run dev` (port 5185)
2. Open: http://localhost:5185/test-search-diagnostic.html
3. Type: "אלהים"
4. Check Console tab for timing breakdown
5. Look for "Unaccounted" time in latest logs

## Next Steps
1. Run test with latest timing instrumentation (commit d4056e5)
2. Check console for "Unaccounted: XXXms ← BOTTLENECK" line
3. Based on that, identify which operation is actually taking 2.7s
4. Consider using Playwright to automate testing and capture exact timings
5. Profile with browser DevTools Performance tab to see call stack

## Key Code Locations
- searchByRootMode(): line ~470 (main search function)
- searchByLemmas(): line ~295 (inverted index lookup)
- findWordIndexByLemma(): line ~280 (finds word position in verse)
- buildLemmaInvertedIndex(): line ~155 (builds index on startup)

## Git Commits (in order)
1. bbc7abb - Initial inverted index optimization
2. 80c69cc - Added diagnostic logging
3. 6bb8a2b - More detailed loadLemmaData logging
4. 80bd24f - Fixed findLemmasForWord normalization bug (CRITICAL)
5. 6983be9 - Added findLemmasForWord logging
6. 56dae38 - Added timing breakdown for searchByRootMode
7. d4056e5 - Comprehensive timing to find missing 2.7s (LATEST)

## Data Files
All lemma data files exist and load correctly:
- public/data/word-lemmas.json (1.6MB, 45,182 words)
- public/data/verse-lemmas.json (3.9MB, 23,145 verses)
- public/data/strongs-to-root.json (169KB, 7,991 Strong's numbers)

## Success Criteria
Search for common Hebrew word should complete in < 50ms (ideally < 30ms).
Currently taking 2748ms - need 50-100x speedup.
