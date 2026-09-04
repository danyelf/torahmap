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
the map has nothing to search _for_ until they already know something.

The scrollytelling work answers the third problem. This document covers the
first two.

## What we decided

**Hebrew search is reached by typing Hebrew letters, or by clicking a word on
the map. Nothing else.** The virtual keyboard and the transliteration layer
are removed rather than improved.

(nb. we might bring back the virutal keyboard later, but there will be an explicit choice for that.)

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

Strong's is a placeholder, not the destination. It is an 1894 concordance
index, and it is being asked to do lexical semantics it was never designed for.
The evidence is already visible in this project's own data: `על` resolves to
seven different Strong's numbers spanning 4,607 verses, a fifth of the Tanakh;
`שלם` is offered לבב, "heart", among its senses; and a prototype built over
this data had to discard senses outright because their root was a different
word. Those are not display problems to be styled around. They are the limits
of the source.

The intended direction is a modern linguistic dataset. ETCBC/BHSA is the
target: it carries its own lexeme identification with homograph separation
across 8,769 lexemes, so רוח resolves to "wind" or "be spacious" by context
rather than by inherited Victorian numbering. It also carries sentence
structure — clause and phrase hierarchy, dependency edges, phrase functions —
and a classification of roughly 33,000 proper nouns as person, place, gentilic
or deity, which is an interesting thing to paint on a map in its own right.

Two practical facts about that move, both better than assumed. Its verse
numbering disagrees with Sefaria in three chapters out of 929 — Exodus 20,
Deuteronomy 5 and Numbers 25, seven verses in total — which is a short list of
rules rather than the text-matching subsystem morphhb required. And a derived
index is about 0.89 MB over the wire against the 0.95 MB shipping today, so it
costs nothing to deliver.

Adopting it means giving up Strong's numbers, which the current pipeline is
built on. That is the point of the move, not an obstacle to it, and it is why
the dictionary interface described below is a prerequisite rather than a
nicety.

In the meantime, one cheap thing is worth doing: `scripts/generate-lemma-index.ts`
reads each word from morphhb as a triple of written form, Strong's number, and
morphology code, and never uses the third. Line 361 destructures it and nothing
reads it again. Those codes are complete — `Vqp3ms` is verb, qal, perfect,
third person, masculine, singular — and coverage is total, verified at 20,629
of 20,629 words in Genesis. Recovering them yields grammatical-form filtering
immediately, and it does not compete with the move to ETCBC, because
grammatical form is the one thing the two sources agree on: their verb counts
land within half a percent of each other, both parsing the same Leningrad
Codex.

What ETCBC does not solve is filtering by meaning. Its node features include no
sense field and no semantic domain — only one English gloss per lexeme. The
dataset that does carry real word senses, from the UBS semantic dictionary, is
MACULA Hebrew: a sense number on about 38% of tokens, a lexical domain on 51%,
a core domain on 34%. Partial coverage, but actual senses. If the meanings
facet is wanted, that is where it comes from.

None of this belongs in the first release.

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

This does not exist yet. Checked against `main`, the scrollytelling branch and
the higher-contrast branch: `src/sidebar.ts` contains no word spans and no
word-level click handling, and neither does the Talmud view. Two things are
clickable today and are easy to mistake for it — a search result row, which
pins that verse, and a related-root chip, which runs that root as a search.

Word splitting already exists: `getWordBoundaries()` in `src/search.ts` handles
Hebrew separators including maqaf (U+05BE), which is the fiddly part.
Normalization for lookup already exists as `normalizeHebrewForSearch()`.

This makes root search reachable without typing. Click a word, look it up, and
paint every verse in the Tanakh sharing that root. The related-root chips
already computed by `getRelatedRoots()` become the way a reader walks from one
root to a neighbouring one.

### Clicking a word opens a menu, it does not leap

A click on a word does not run a search. It opens a small menu naming the word
it found:

    Search for אברהם
    Search for the root ברה
    Add אברהם to the search

Nothing happens until the reader picks one. The menu is what makes the
interaction safe, and it does three jobs at once: it confirms which word was
hit, since Hebrew words run together and a misfire should be visible before it
costs anything; it is where the choice between the written form and the root
lives, rather than a separate control elsewhere; and it is the moment the
reader consents to a change of view.

That last point matters more than it looks. Search is an overlay, and overlays
are mutually exclusive. `setOverlay()` in `src/main.ts` calls `destroy()` on the
outgoing overlay and empties its controls and legend. So a reader studying the
Haftarah map who clicks a word would, without a menu, silently lose the
Haftarah view and its settings — likewise a chosen cantillation mark, a
commentary category, a dating period. A click is an ordinary gesture and must
not be able to do that on its own.

This is not solved with an undo button. The fix is that the leap never happens
unasked. A reader who opens the menu and does not want it dismisses it and is
exactly where they were.

The menu's wording carries the warning where a reader will actually see it. If
picking an item will replace the current view, the item says so.

Adding a word to an existing search does not change overlays at all, since
search is already the active overlay, so that item is offered whenever it
applies.

### Results get room

Results move out of the floating `#search-results` box, which is capped at 60%
of viewport height, and into the full-height right panel introduced by the
scrollytelling work. They are grouped by book.

### Searching more than one word at a time

Clicking a word adds it to the search rather than replacing what is there.

Most of this already works. `parseSearchTerms()` splits a multi-term query,
each term is painted its own colour, and result rows already carry a coloured
dot per matching term. Clicking a word is a new caller for machinery that
exists, not new machinery. Adding rather than replacing is also the behaviour
that suits a map: two roots in two colours on one substrate is the comparison
the app is for.

Replacing the search needs to stay available and obvious, since add-by-default
is only pleasant if it is easy to undo. Individual terms are removable.

Results for a multi-term search are interleaved in book order, not separated
by term and not ranked. Splitting terms into tabs is a later question; the
colour coding already distinguishes them without it.

The existing per-term colour palette holds five terms. That is the practical
ceiling on how many words can be added before the map stops being readable,
and the interface should not pretend otherwise.

The result list is not currently truncated — `renderResults()` already paints
in batches of 50 with infinite scroll. The feeling of truncation comes from the
size of the container, so this is a layout change and not a search change.

### Filters act on the map, not just the list

Search is primarily an overlay: the reader types or clicks to _see_ where
something occurs. Any filter must therefore change what is painted, not merely
what is listed.

Two filters come from data already on disk: which root is selected, and which
related roots are included. Both change the painting and the list together.

### Colour belongs to the word; meaning is a filter inside it

Each search term gets its own colour, as it does today. Senses do not get
colours. Within a single term, the reader may optionally narrow which of its
verses are painted by choosing among that word's meanings.

This matters because the two models behave completely differently at the edges.
Colouring by sense exhausts the palette immediately — שלם carries ten senses
against five available colours. Filtering within a term does not: ten senses
still paint one colour, and the filter only decides which verses that colour
covers. The palette limit applies to how many words can be compared at once,
which is the thing it should limit.

The filter is optional and off by default. 87.4% of written forms carry exactly
one sense, so for most words there is nothing to choose and the control simply
does not appear.

Verse-level data is the right granularity for this. `verse-lemmas.json` records
which senses occur in each verse, so narrowing to a sense is a set intersection:
restricting עלה to its burnt-offering sense yields 262 verses, and Genesis 3:7 —
which uses the word for a fig leaf — is correctly excluded, because it does not
carry that lemma.

What verse-level data cannot do is say which word in a verse carries which
sense. A verse's lemma count matches its word count in only about a quarter of
verses. That limits highlighting the right word inside a result snippet; it does
not limit painting the map, because the map colours whole verses. Per-token
identification would remove the limit, which is one more reason the move off
Strong's is worth making.

An earlier prototype appeared to show this filtering was impossible, painting
474 verses when 261 were selected. That was a defect in the prototype, which
anchored its hits on the written form rather than intersecting with the chosen
sense. The data supports the filter correctly.

A third, filtering by section of the Tanakh, is listed here as a possibility
rather than a commitment, and an earlier draft of this document described it
carelessly as "which section is in view". That phrasing ran together two
different things:

**A section filter** is a control the reader sets — show only Torah, or only
Ketuvim. It is independent of where the map happens to be scrolled.

**Tying the result list to the viewport** is a different idea: showing only
the hits currently on screen, so that panning the map changes the list. That
is not how the list behaves today, and it should not become automatic. Coupling
a list to the camera silently is disorienting — hits vanish with no explanation
and the reader cannot tell a filter from an absence.

If it is built, it is an explicit switch the reader throws, worded so the
current state is legible: "limit results to what is on screen", with the
converse plainly available. Off by default. This is worth prototyping before
committing to, and is not required for the first release.

## Architecture

The search module keeps its current shape. `search()` continues to take a
query and a mode, and the three existing Hebrew modes — substring, word, and
root — are unchanged. Click-to-search is a new caller of the same function, not
a new engine.

Data flows one way: a click on a word span yields a normalized surface form,
which yields identifiers for the words it could be, which yield matching verses
from the existing inverted index, which yield both the painted overlay and the
grouped result list.

### The dictionary layer must be replaceable

Today those identifiers are Strong's numbers, and that assumption is spread
through `src/search.ts`: `wordLemmas`, `strongsToRoot`, `lemmaToVerses`,
`strongsToSurfaceForm` and `rootToStrongsNumbers` all name it directly, and
`getRelatedRoots()` builds its neighbour map from the shape of Strong's data
specifically.

Strong's is a nineteenth-century concordance index and we will want something
better. ETCBC is the likely successor. So the search code should depend on a
small interface rather than on Strong's itself — given a written form, return
the identifiers it might be; given an identifier, return its display form, its
surface forms, and the verses it occurs in. Strong's becomes one implementation
behind that interface.

This is worth doing now, while the surface being changed is small. Retrofitting
it after a Dicta-style interface is built on top would be considerably worse.
It also makes room for the two things we do not have yet — filtering by meaning
and by grammatical form — because both are additional questions asked of the
same interface rather than new subsystems.

## Testing

Word-splitting and normalization are pure functions over JSON and are unit
tested directly. Click-to-search is tested by asserting that a click on a span
produces the expected query and result set.

The regression gate should assert properties of the corpus rather than a list
of hand-chosen words, since a hand-chosen list is what produced the misleading
result described above.

Because this changes the UI, it is not complete until Danyel has looked at it.

## Assumptions and open questions

Results are ordered by book, never by relevance. This is a decision, not an
assumption: applying a relevance score to scripture is a judgement the app
declines to make. It also settles the multi-term case, which interleaves in
book order for the same reason.

Clicking a word offers a choice between the exact written form and the root
rather than defaulting to either. Which of the two the toggle starts on is
still open.

Remaining open questions:

- The order of the items in the word menu, and which one reads as the obvious
  default. Both the written form and the root are offered; which sits first is
  a judgement to make against the real thing rather than on paper.
- Whether the menu should appear on a plain click or need a deliberate gesture
  such as a long press or a modifier. A plain click is more discoverable and
  more likely to be triggered by accident; a dismissable menu makes the
  accident cheap, which argues for the plain click.
- Whether tying the result list to the viewport is worth building at all, and
  if so how the switch is worded so its state stays legible.
- English search is untouched on the assumption it already works well enough.
  It has not been evaluated.
- Whether a section filter earns its place in the first release.

## Out of scope

Not built in this release: filtering by meaning, filtering by grammatical form,
adopting ETCBC/BHSA, and the high-contrast palette work on PR #62.

The first three are deferred rather than rejected, and the dictionary interface
described above exists so they can be added without another rewrite. A separate
prototype exploring a Dicta-style interface is expected to run alongside this
work on its own branch; nothing here should foreclose what it finds.
