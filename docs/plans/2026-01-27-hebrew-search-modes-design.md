# Hebrew Search Modes Design

**Date:** 2026-01-27
**Bead:** tm-773t
**Status:** Approved

## Problem

The current Hebrew search has confusing automatic behavior:
- Attempts lemma-based (root) search automatically if morphhb data is available
- Falls back to substring search if lemma not found
- Users have no visibility into which mode is active
- Users cannot explicitly choose substring-only or whole-word matching
- The automatic lemma search was doing root matching invisibly

## Solution

Add **explicit search mode selection** for Hebrew with three modes:

1. **Substring** - Matches anywhere in words (e.g., "הלכ" matches "הלכה", "להלך")
2. **Whole word** - Matches complete words only (e.g., "הלך" matches "הלך" but not "הלכה" or "ההלך")
3. **Root (שרש)** - Uses morphhb lemma data to match all forms of a root (e.g., "הלך" finds all H1980 forms)

English search remains unchanged (simple checkbox for whole-word matching).

## UI Design

### Hebrew Search Controls

Replace the current checkbox with a **radio button group** when Hebrew is detected:

```
Search mode:
○ Substring         (matches anywhere in words)
○ Whole word        (matches complete words only)
○ Root (שרש)        (matches all forms of the root)
```

- Default: **Substring** (maintains current fallback behavior)
- Radio buttons only appear when Hebrew text is detected
- Term "שרש" (root) is more user-friendly than "lemma"

### English Search Controls

No changes - keep existing checkbox:
```
☐ Match whole words only
```

### Behavior

- Mode selection is language-specific
- Mode is persisted in URL state
- Input direction (RTL/LTR) auto-detects based on content
- Control visibility updates on input change

## Implementation Design

### 1. Search Algorithm Changes

**Function signature update:**

```typescript
export function search(
  query: string,
  wholeWord: boolean = false,
  hebrewMode: 'substring' | 'word' | 'root' = 'substring'
): SearchResult[]
```

**Search logic flow:**

```
1. Parse search terms
2. Detect language (Hebrew vs English)
3. If English:
   - Use existing logic with wholeWord parameter
4. If Hebrew:
   - Branch on hebrewMode:
     a. 'substring' → Simple substring search (skip lemma lookup)
     b. 'word' → Whole-word boundary matching
     c. 'root' → Lemma-based search with whole-word fallback
```

### 2. Whole-Word Search Implementation

**New function:**

```typescript
function searchHebrewWholeWord(
  searchIndex: IndexEntry[],
  term: string,
  termIndex: number
): Map<string, SearchResult>
```

**Algorithm:**
1. Strip nikkud from search term
2. For each verse:
   - Split verse `hebrewText` by whitespace
   - Check for exact word match
   - If match: use `getWordBoundaries()` to find position in original text
   - Create snippet with highlighting
3. Return results map

**Key insight:** Reuse existing `getWordBoundaries()` function, which already handles word position lookup by whitespace splitting.

### 3. Root (שרש) Mode Enhancement

**Current lemma search (lines 285-368):**
- Auto-tries lemma lookup
- Falls back to substring if no lemma found

**Enhanced root mode:**
- Extract existing lemma search into `searchByRootMode()` helper
- Change fallback: If lemma NOT found → use **whole-word** search instead of substring
- Rationale: Root mode implies "match complete units" (better for proper nouns like "אברהם")

**Fallback chain:**
```
Root mode requested
  ↓
Try findLemmasForWord()
  ↓
Lemma found? → searchByLemmas() (existing)
  ↓
Lemma NOT found? → searchHebrewWholeWord() (new, not substring)
```

**No changes needed to:**
- `searchByLemmas()` - already works correctly
- `findLemmasForWord()` - already handles prefix stripping
- `getWordBoundaries()` - already finds word positions

### 4. URL State Management

**New URL parameter:**
- `mode=substring|word|root` - Hebrew search mode

**Existing parameter (unchanged):**
- `ww=1` - English whole-word search

**Example URLs:**
```
?overlay=search&q=הלך&mode=root          # Root search
?overlay=search&q=אברהם&mode=word        # Whole-word search
?overlay=search&q=bread&ww=1             # English whole-word
```

**State handling in `overlays/search.ts`:**

```typescript
// Add state variable
let hebrewSearchMode: 'substring' | 'word' | 'root' = 'substring';

// Update getUrlParams() to include mode
// Update applyUrlParams() to restore mode
```

### 5. Control Rendering Logic

**In `overlays/search.ts` renderControls():**

1. Render search input + keyboard toggle + clear button (existing)
2. Detect current language from input value
3. If English:
   - Show checkbox: "Match whole words only"
   - Hide radio buttons
4. If Hebrew:
   - Hide checkbox
   - Show radio button group with three modes
   - Restore selected mode from state
5. Wire up event handlers:
   - Radio change → update `hebrewSearchMode` → re-run search
   - Input change → update language detection → show/hide controls

## Files to Modify

### 1. `src/search.ts`
- Update `search()` signature
- Add `searchHebrewWholeWord()` function
- Extract `searchByRootMode()` helper
- Update main search logic to branch on Hebrew mode

### 2. `src/overlays/search.ts`
- Add `hebrewSearchMode` state variable
- Update `renderControls()` to render mode selector
- Update `doSearch()` to pass mode parameter
- Update `getUrlParams()` and `applyUrlParams()`

### 3. `src/styles/overlays/search.css`
- Add styles for radio button group
- Ensure proper RTL layout for Hebrew controls

## Testing Strategy

**Unit tests (`search.test.ts`):**
- `searchHebrewWholeWord()` with various inputs
- Mode parameter correctly passed through
- Fallback behavior (lemma not found → whole-word)

**Integration tests:**
- Mode switching updates results correctly
- URL state persistence (navigate away and back)
- Language detection triggers correct controls
- Proper nouns like "אברהם" work in each mode

**Manual testing:**
- Substring mode: "הלכ" matches partial words
- Whole-word mode: "הלך" only matches exact word
- Root mode: "הלך" matches all H1980 forms
- English unchanged: checkbox still works

## Backward Compatibility

- Default Hebrew mode is `substring` (current behavior)
- URLs without `mode` parameter default to substring
- English search completely unchanged
- Existing lemma search code reused (not rewritten)

## Success Criteria

✓ Users can explicitly choose Hebrew search mode
✓ Each mode behaves as documented
✓ Mode selection persists in URL
✓ UI clearly indicates active mode
✓ Fallback handling is predictable (root → whole-word, not substring)
✓ English search unchanged
✓ No breaking changes to existing functionality
