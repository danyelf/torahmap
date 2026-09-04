# Search redesign: click to explore, not type to query

**Date:** 2026-09-04
**Status:** approved, not yet implemented
**Target:** publishable before Simchat Torah

## The problem

Search is the most annoying part of Torah Map, and it is annoying in three
separate ways that were easy to confuse for one problem.

Typing Hebrew is hard for anyone without a Hebrew keyboard. The results
appear in a cramped floating box that makes a large result set feel like a
truncated one. And the app offers no obvious first move: a person who opens
the map has nothing to search *for* until they already know something.

The scrollytelling work answers the third problem. This document covers the
first two.

## What we decided

**Hebrew search is reached by typing Hebrew letters, or by clicking a word on
the map. Nothing else.** The virtual keyboard and the transliteration layer
are removed rather than improved.

This is a deliberate narrowing. Someone who cannot type Hebrew now reaches
Hebrew text only by clicking a word they can see, or by searching the English
translation. We accept that trade because the alternatives all failed on
inspection, and because clicking is a better fit for a map than typing is.

## Why the alternatives were rejected

We considered resolving loose input into a short list of candidate words that
the reader picks from. Two variants were measured against the real corpus of
44,740 surface forms.

**Sound-based matching does not work.** Hebrew does not write most vowels, so
any lookup driven by how a word sounds collapses together every word sharing a
consonant skeleton. Measured over the 2,000 most frequently occurring forms —
the words people would actually search — the median query matches 45 different
words, and only 3.5% resolve to a single answer. Every word built on the
letter resh collapses into a pile of 218. This is a property of the language,
not of the matching rules, and no amount of tuning changes it.

An earlier probe suggested this approach worked, reporting the correct answer
inside the top five for all fifteen test words. That result was worthless: the
same fifteen words were used to tune the rules and to evaluate them, and they
were all long, consonant-rich proper nouns whose skeletons are unusually rare.
The measurement above avoids this by testing a property of the corpus that
cannot be tuned.

**Prefix completion works but was rejected on design grounds.** Completing
real corpus words as the reader types leaves a median of five candidates after
four letters and two after five, because the reader supplies the letters and
no vowel ambiguity arises. It was rejected because it still requires knowing
how a word is spelled, and it keeps alive the keyboard machinery this redesign
exists to delete.

**Two further facts shaped the scope.** 87.4% of surface forms map to exactly
one Strong's number, so choosing between senses is a rare case rather than the
common one — a picker would usually be a formality. And the number of surface
forms per root has a median of 2 and a maximum of 290, so a word-form filter
would usually show two things and occasionally show 290. Neither justifies new
data.

Richer datasets were considered and deferred. ETCBC/BHSA would supply genuine
grammatical facets, but it brings a Python toolchain, a fresh verse-alignment
problem against Sefaria numbering, and a licensing question to confirm. morphhb
already ships morphology codes that `scripts/generate-lemma-index.ts` discards,
which is the cheaper route if we ever want word forms. Both are post-launch.

## What gets removed

- `src/hebrewKeyboard.ts` and `src/hebrewTransliteration.ts`
- `src/styles/hebrewKeyboard.css`
- `src/__tests__/unit/hebrewKeyboard.test.ts` and the transliteration test
- The keyboard toggle and transliteration handling inside `src/overlays/search.ts`
- The `simple-keyboard` dependency

Nothing outside search depends on any of it; the reference in
`src/talmud/talmudLabels.ts` is the word "transliterated" in a comment.

`test-harness/main.ts` imports `createHebrewKeyboard` and must be updated. The
harness exists to exercise search UI without WebGL and should survive, but two
thirds of its stated purpose in CLAUDE.md disappears and its description needs
rewriting.

In-progress keyboard work is preserved on the `hebrew-search` branch and is not
intended to merge.

## What gets built

### Click a word to search it

Hebrew verse text in the verse popup is currently set as a single text node.
It becomes one span per word. Clicking a word searches it.

Word splitting already exists: `getWordBoundaries()` in `src/search.ts` handles
Hebrew separators including maqaf (U+05BE), which is the fiddly part.
Normalization for lookup already exists as `normalizeHebrewForSearch()`.

This makes root search reachable without typing. Click a word, resolve it to
its Strong's number, and paint every verse in the Tanakh sharing that root.
The related-root chips already computed by `getRelatedRoots()` become the way
a reader walks from one root to a neighbouring one.

### Results get room

Results move out of the floating `#search-results` box, which is capped at 60%
of viewport height, and into the full-height right panel introduced by the
scrollytelling work. They are grouped by book.

The result list is not currently truncated — `renderResults()` already paints
in batches of 50 with infinite scroll. The feeling of truncation comes from the
size of the container, so this is a layout change and not a search change.

### Filters act on the map, not just the list

Search is primarily an overlay: the reader types or clicks to *see* where
something occurs. Any filter must therefore change what is painted, not merely
what is listed. Three filters are available from data already on disk: which
root is selected, which related roots are included, and which section of the
Tanakh is in view.

## Architecture

The search module keeps its current shape. `search()` continues to take a
query and a mode, and the three existing Hebrew modes — substring, word, and
root — are unchanged. Click-to-search is a new caller of the same function, not
a new engine.

Data flows one way: a click on a word span yields a normalized surface form,
which yields Strong's numbers from `word-lemmas.json`, which yield matching
verses from the existing inverted index, which yield both the painted overlay
and the grouped result list.

## Testing

Word-splitting and normalization are pure functions over JSON and are unit
tested directly. Click-to-search is tested by asserting that a click on a span
produces the expected query and result set.

The regression gate should assert properties of the corpus rather than a list
of hand-chosen words, since a hand-chosen list is what produced the misleading
result described above.

Because this changes the UI, it is not complete until Danyel has looked at it.

## Assumptions and open questions

- The pre-commit hook described in CLAUDE.md as running all tests does not do
  so. It contains only a dead beads integration, and `bd` is not installed, so
  commits are currently ungated. Worth fixing, out of scope here.
- Grouping results by book is assumed to be more useful than ranking them by
  relevance. Untested.
- Whether clicking a word should search the exact form or its root by default
  is unresolved. Root is the more interesting default for a map; exact is less
  surprising.
- English search is untouched on the assumption it already works well enough.
  It has not been evaluated.

## Out of scope

Morphology and word-form facets, ETCBC/BHSA adoption, English glosses per
Strong's number, and the high-contrast palette work on PR #62.
