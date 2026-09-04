# Lexeme Indicator Feature

## Summary

The search overlay legend shows, for each Hebrew search term in root mode, which
dictionary word the term was understood as — or a warning that the term could not
be looked up and the search fell back to plain whole-word matching.

## Problem

When searching Hebrew text in root (שרש) mode, readers had no way to know:

- whether a term was recognized as a word at all
- which terms were quietly falling back to whole-word search
- why some searches did not return what they expected

## Solution

Next to each term in the legend, show the vocalized dictionary form the term
resolved to, in the shape `"בָּרָא" (from "ברא")`. Terms that did not resolve get
an orange hook arrow (↪) instead, whose tooltip says the search fell back to
whole-word matching.

## Implementation

### Files Modified

1. **src/search.ts**
   - `findLexemesForWord()` is exported, so the overlay can ask what a term
     resolved to
   - `getLexemeForm()` returns the vocalized dictionary form to display

2. **src/overlays/search.ts**
   - `termHasLexeme: boolean[]` records which terms resolved
   - `termForms: Array<string | null>` records what to show for each
   - `doSearch()` fills both in when the query is Hebrew and the mode is root
   - `updateHitCaption()` renders them into the legend
   - `destroy()` clears them

3. **src/styles/overlays/search.css**
   - `.lexeme-indicator` styles the fallback arrow

### Test Coverage

**src/\_\_tests\_\_/unit/overlays/search-lexeme-indicators.test.ts** covers
indicator display, mode switching, and styling.

## Behavior

### When Indicators Appear

Only when all of these hold:

1. the query contains Hebrew
2. the Hebrew search mode is "Root (שרש)"
3. at least one search term exists

### What They Mean

**Dictionary form, as `"בָּרָא" (from "ברא")`**

- the term resolved to at least one lexeme in `word-lexemes.json`
- the search matches every inflected form of that word
- where a written form could be more than one word, the likeliest reading is
  the one shown

**Orange hook arrow (↪)**

- nothing in the dictionary matched the term
- the search falls back to whole-word matching, still nikkud-insensitive
- tooltip: "Not found in the dictionary, using whole-word search"

### Example Searches

Every term resolves:

```
אלהים,ברא,אור
```

Mixed:

```
אלהים,xyz,ברא
```

- "אלהים" shows its dictionary form
- "xyz" shows the orange ↪
- "ברא" shows its dictionary form

In substring or whole-word mode no indicators appear, because there is nothing
being resolved.

## Technical Notes

### Where the Data Comes From

The lexeme index is built from the ETCBC BHSA database and loaded from
`/data/lexicon.json`, `/data/word-lexemes.json` and `/data/verse-lexemes.json`.
Regenerate it with `python3 scripts/generate-lexeme-index.py`; see
DATA_REGENERATION.md.

### Performance

Lookups are single Map or object reads. Status is recomputed only when the query
or the search mode changes.

### Fallback Behavior

If the index fails to load, every search falls back to whole-word mode and every
term shows the orange arrow. Nothing throws.

## Testing

### Unit Tests

```bash
npm test src/__tests__/unit/overlays/search-lexeme-indicators.test.ts
```

### Manual Testing

1. Open the app at http://localhost:5173
2. Select the "Search" overlay
3. Click the Hebrew keyboard button (א)
4. Set the mode to "Root (שרש)"
5. Type `אלהים,ברא` — both should show a dictionary form
6. Try `xyz,אור` — "xyz" shows the orange ↪
7. Switch to "Substring" mode; the indicators disappear
8. Switch back to "Root"; they reappear

## Future Enhancements

- show how many verses came from the dictionary match versus the fallback
- mark, in the results, which matches used the dictionary
- show the English gloss alongside the dictionary form
- a strict mode that refuses to fall back

## References

- ETCBC BHSA: https://github.com/ETCBC/bhsa
- Text-Fabric: https://annotation.github.io/text-fabric/
