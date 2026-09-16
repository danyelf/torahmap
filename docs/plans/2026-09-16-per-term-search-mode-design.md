# How a word is matched belongs to the word

**Date:** 2026-09-16
**Status:** approved, not yet implemented
**Issues:** #115
**Builds on:** `2026-09-14-search-meaning-filter-design.md`, which introduced the
term list, and `2026-09-15-click-to-search-implementation.md` (#133), which
added the two clicks that settle the mode

## The problem

The search matches Hebrew one of three ways — substring, whole word, root — and
that choice is one setting for the entire search. Every Hebrew term obeys it.
English has the same shape in miniature: one "match whole words only" checkbox
governing every English term.

The map exists so two words can be compared on one substrate, and the
comparisons worth making are often not like-for-like. None of these can be asked
for today:

- one word by root and another as an exact spelling, to see how far a root
  spreads past the form you know
- a common word pinned to whole-word while a rarer one stays loose
- the same word twice, narrowed to a different meaning each time — עלה as
  leafage beside עלה as "go up"

That last one matters more than it looks, because it is the shape the panel is
built for: two rows, two colours, one map.

This is the third setting to have the same defect. Language was one value for
the whole search until #111, and was read off the first term, so an English word
beside a Hebrew one was hunted for in the Hebrew text. Hit counts were read off
a row's screen position rather than its position among the searched terms, and
were fixed in the same pull request. The matching mode is the last one.

Click-to-search made it reachable rather than merely untidy. `searchForMeaning`
offers two actions — search this meaning, which requires root mode, and search
this written form exactly, which requires whole-word mode — and each writes the
global. So taking one word's written form silently widens a word you narrowed a
moment earlier. Nothing is lost, and the panel hides the meaning controls rather
than lying about them, but the first word quietly stops meaning what you said.

## What a term carries

`SearchTerm` gains one field:

```ts
export type SearchMode = 'substring' | 'word' | 'root';

export interface SearchTerm {
  // ...
  /** What the reader chose, or null while they have not chosen. */
  mode: SearchMode | null;
}
```

`wholeWordEnabled` and `hebrewSearchMode` are both deleted. There is no separate
English setting: a term has one mode, and its text decides which values are on
offer. English gets substring and whole word; Hebrew also gets root, because
root is the only mode with a dictionary behind it.

### Why the mode can be unset

A term's language is derived from its text, and its text changes on every
keystroke. Storing a real mode when the term is created would mean typing
`light` and then replacing it with `עלה` leaves the term on substring — the
English default — where root is what Hebrew is documented to do.

Keeping "has not chosen" apart from "chose substring" is what lets the default
follow the text. So:

```ts
export function effectiveMode(term: SearchTerm): SearchMode {
  const hebrew = isHebrewQuery(term.text.trim());
  const chosen = term.mode ?? (hebrew ? 'root' : 'substring');
  // An English term has no dictionary to resolve against.
  return !hebrew && chosen === 'root' ? 'word' : chosen;
}
```

A term that has chosen keeps its choice across a language change, since whole
word and substring mean the same thing in both languages. Root is the one value
that cannot survive the trip, so it falls back to whole word while the text is
English and is restored the moment the text is Hebrew again. That restoration is
deliberate: the field still holds `root`, and only the reading of it clamps.

## What runs the search

Four places read the mode, and all four already loop over terms. The work is
moving the read inside the loop, not restructuring anything.

- **`runSearch`** passes each term's own mode to `verseSetsForTerms`. That
  function is already called with a one-element list per term, so `src/search.ts`
  needs no signature change — the issue's guess that it would take a mode per
  term is already satisfied by the call site.
- **`findAllTermMatches`** branches on `effectiveMode(term)` inside its existing
  term loop rather than on the two globals. Its `isHebrew` argument is the
  language of the verse text being highlighted and stays what it is; the mode is
  the term's.
- **`meaningsApply()`** takes a term. A row shows its meaning checkboxes when
  *that row* is in root mode, instead of the whole list appearing and vanishing
  together.
- **`searchForMeaning`** sets the mode of the term it just created. Taking a
  meaning sets that term to root; taking a written form sets that term to whole
  word. Neither touches another term. `syncHebrewModeRadios` has nothing left to
  sync and is deleted.

`getHoverInfo` improves nearly for free. It currently either names glosses for
every matching term or quotes text for every matching term; per term it can say
`Matches: leafage, "light"`.

`trackSearchExecute` already computes a per-term mode string by re-deriving it
from the globals, and simply reads the term instead.

## The URL

`ww` is removed. `hm` is replaced by `mode`, positional across the terms in `q`
in exactly the way `m` already is: one entry per term, comma separated, and an
empty entry for a term that has not chosen. A term's entry is a single letter —
`s`, `w`, `r`.

    #overlay=search&q=עלה,light&mode=r,w

It is written only when at least one term has chosen, so an ordinary search link
is unchanged. Reading is positional against the terms `q` produced, which is
safe for the same reason it is safe for `m`: `q` and `mode` are written and read
as one snapshot, and it is editing, not loading, that needs identity.

An entry that is not one of the three letters is dropped, leaving that term on
its default, rather than discarding the search.

Single letters rather than words because the `token` kind caps a value at 50
characters and `substring,substring,substring,substring,substring` is 49. Five
terms of letters is nine.

**No backward compatibility.** Old links carrying `ww=1` or `hm=word` lose those
settings and paint with the defaults. This was settled explicitly: the parameters
are not read, not translated, and not warned about.

## The panel

The mode control cannot simply be added to every row. Three radios across five
rows is more chrome than the rows themselves, and it would sit beside meaning
checkboxes that are already the tallest thing in the panel.

So the row collapses. Root is the only mode with sub-choices, which makes the
meaning list the thing most worth hiding, and hiding it is what buys the space
for the control.

**A collapsed row is one line:** the colour swatch, the word, a grey summary,
the hit count, and the × that removes it. The summary always names the mode,
then what it is doing about meanings. Naming the mode even when it is the
default is what makes the column scannable, and naming the meanings is
load-bearing rather than decorative — two rows both reading עלה in root mode
are otherwise indistinguishable, and telling them apart is the whole point of
the feature.

A Hebrew row in root mode reads one of three ways:

| The row | Reads |
|---|---|
| narrowed to one or more meanings | `root · leafage` |
| every meaning still checked | `root · all 4 meanings` |
| one meaning, or a word the dictionary does not know | `root` |

Counting the meanings rather than leaving the mode bare is the difference
between "searching for all four readings" and "this word has one reading", which
a bare `root` gave no sign of. It is left bare where there is no choice to
report, which is the same set of rows that show no checkboxes either — saying
"all 1 meanings" would be both ungrammatical and untrue to what the row offers.

Several checked meanings are listed comma separated and cut off with an
ellipsis. Outside root mode the summary is just the mode: `word`, `substring`.

**The open row** is today's row plus a three-segment mode control on its own
line, at the top of the same indented block that holds the meanings. That block
then reads as one statement: this term is matched this way, and if by root,
these are the readings it stands for. An English row's control has two segments.

**Exactly one row is open.** Clicking a collapsed row opens it and collapses the
one that was open. It stays open while you work on the map, so returning from a
click on a verse finds the panel as you left it. A newly added term opens; on
load, the first row is open.

Opening is on click, never on hover — hover does not exist on touch, and a
control that appears under the pointer is a control you cannot aim at.

A collapsed row's × removes the word without opening it first. The `all` link
that undoes a narrowing stays inside the open row, beside the checkboxes it
undoes.

### The results list follows the open row

Opening a row is the reader asking about that word, so the list answers for
that word rather than for the union of every word. With עלה and אור both
searched, opening עלה lists its 1,028 verses; clicking across to אור lists its
55.

A verse the list shows still carries every one of its dots. Genesis 17:5 holds
both אברהם and אברם, and it says so while the list is narrowed to אברהם — the
list reports "these are my word's verses, and here is which of your other words
also landed on them".

Two things follow from it:

- The snippet is drawn for the word the list is answering about, not for
  whichever term claimed the verse first. Otherwise a list narrowed to the
  second word would quote the first word's match.
- The caption above the list counts what the list shows, then the union:
  `55 of 1083 matching verses`. With one term the two numbers are equal and it
  says the number once, as before. The union is worth keeping because no row
  can show it.

A row with nothing to search on narrows nothing, and the list stays whole.
Filtering by an empty row would empty the list at the moment the reader clicks
"add a word", which reads as the search having been lost.

It also, incidentally, puts the list back in book order. A multi-term list was
ordered by which term claimed a verse first, so it ran through the Tanakh once
per term; one term's verses are in book order on their own.

**What leaves:** `#search-options` (the whole-word checkbox) and
`#hebrew-mode-container` (the three radios) are removed from `renderControls`,
along with `updateOptionVisibility`, which existed only to show and hide them as
the text changed language. A row knows its own language, so nothing has to be
shown and hidden any more.

### A note on rebuilding rows

`renderTermRows` matches rows by term id and updates them in place, because
re-attaching a node blurs whatever is focused inside it. Opening and closing
changes a row's internal shape — the open row holds a real `<input>`, a
collapsed row holds a span — so `updateTermRow` rebuilds a row's contents when
its open state changes, in the same way `renderMeanings` already rebuilds on a
change of meaning signature. The open row is the one being typed in, so its
input survives every render that matters.

## Testing

Eight test files hold 58 references that drive the radios and the checkbox
through the real DOM; `integration/search-overlay-modes.test.ts` carries 30 of
them. Those are rewritten against the row controls rather than deleted — what
they assert about matching behaviour is still true, only the control that sets
it has moved.

New coverage:

- `effectiveMode` — the default by language, the clamp that keeps English off
  root, and the restoration when the text goes back to Hebrew
- the `mode` parameter round-tripping, including an empty entry, a short list,
  and an unrecognised letter
- two terms searching in different modes in one search, with each row's count
  describing its own term
- `searchForMeaning` setting only the mode of the term it created, leaving a
  previously narrowed term narrowed — the defect from #115's second comment
- clicking a collapsed row opening it and collapsing the previously open one,
  and a collapsed row's × removing without opening

## Deliberately not in scope

**Propagation.** #115 asks whether changing one row's mode should offer to
change the others. It should not. That offer earned its keep when the radios
were the only control and moving five terms meant five trips through one widget;
now each row's mode is one click on a row already on screen. An offer is a new
mechanism with new ways to be wrong, for a case that now costs very little.

**Per-mode hit counts.** #92 asked for the three totals at the foot of the
panel, and its comment on #115 asked for the two to be designed together. They
are not being built here — the collapsed line leaves an obvious place to put
them later. Danyel is closing #92 on the grounds that clicking between modes is
cheap enough to answer the question directly.

## What building it turned up

### The assumptions held

- `verseSetsForTerms` needed no signature change. The overlay already called it
  one term at a time, so it only had to be handed that term's mode. `src/search.ts`
  is untouched by this work.
- Importing `isHebrewQuery` into `terms.ts` introduces no cycle: `search.ts`
  does not import `terms.ts`.
- The test rewrites were mechanical. 1,752 tests before, 1,771 after.

### One real bug, caught by the suite

The first version made the modes on offer part of the signature that decides
whether a row is rebuilt. That is wrong, and wrong in a way that only shows up
while typing: the offered modes follow the text's language, and a reader typing
their way from English into Hebrew flips it mid-word. The row was rebuilt,
which threw away the box being typed into, along with its caret and its text
direction. Three existing direction tests failed and named it.

Only the mode control is rebuilt now, never the row. `renderModeControl` holds
its own signature on `.term-body`, the way `renderMeanings` already does.

### A consequence worth knowing about

A chosen mode survives an edit, which is right — retyping a word should not
silently reset how it is matched. It also means module state now carries a
choice between tests that share the overlay, and two tests had to start from a
cleared term list rather than assuming a fresh default. That is the tests
catching a real property, not a defect.

### Confirmed in the browser

Driven by hand at 380px against the running app, with no console errors:

- עלה in root mode, narrowed to leafage: 13 verses. Adding אור and setting it
  to whole word left עלה at 13, still reading `root · leafage`. This is the
  defect from #115's second comment, and it is gone.
- A third row holding `light` offered substring and whole word only.
- Reloading the URL restored all three rows with their modes and narrowing.
- עלה beside עלה, one narrowed to leafage and one to ascend, painted the map in
  two colours from one written form — the comparison this change exists for.

### Still open

- Nothing blocking. Propagation and per-mode hit counts remain deliberately out
  of scope, as recorded above.
