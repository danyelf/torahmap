# Choosing which meaning a Hebrew search term has

**Date:** 2026-09-14
**Status:** Shipped — `src/search/terms.ts`, `src/search/dictionary.ts`.
**Issues:** #94, and the "which default" half of #92
**Supersedes:** the "colour belongs to the word; meaning is a filter inside it"
section of `2026-09-04-search-redesign-design.md`, and that document's
assessment that filtering by meaning needs data we do not have

## The problem

A Hebrew word written without vowels is often several different words. עלה is
four of them: the verb "ascend", the noun "burnt-offering", the noun "leafage",
and an Aramaic noun meaning "pretext". They are not shades of one meaning — they
are separate dictionary entries that happen to share a spelling.

Searching עלה in root mode today paints all 1,028 verses carrying any of the
four, and the legend labels the result with the dictionary form of the first
candidate alone. So the map shows a union while the caption names one word. A
reader looking for burnt-offerings gets 818 verses about climbing mixed in, with
nothing on screen admitting it.

What is wanted is what Dicta offers, over the same ETCBC database:
the meanings listed, and the reader chooses.

    https://search.dicta.org.il/result?text=%D7%A2%D7%9C%D7%94&order=tanach+order

## What this is not

This does not choose between *senses of one word* — the ten senses of שלם.
ETCBC records no sense field, and the dataset that does (MACULA Hebrew) covers
about 38% of tokens. That remains deferred.

The distinction matters because the earlier design document ran the two together
and concluded meaning filtering was out of reach. For homographs it is not: they
are separate lexemes, and the data separating them already ships.

Also out of scope here: clicking a word on the map to search it, and moving
results into the full-height panel. Both stay in the earlier document as
written. The Hebrew keyboard is removed by #97, not by this work. Issue #93,
per-term result columns, is explicitly not being built and the earlier
document's "interleaved in book order" decision stands.

## What the data supports

Verified against the files in `public/data/search/` on 2026-09-14.

The written form עלה resolves to four lexemes, already ordered commonest first:

| lexeme | form | gloss | verses |
|---|---|---|---|
| `<LH[` heb | עָלָה | ascend | 818 |
| `<LH/` heb | עֹלָה | burnt-offering | 260 |
| `<LH=/` heb | עָלֶה | leafage | 13 |
| `<LH/` arc | עִלָּה | pretext | 2 |

Union: 1,028 verses, which is what the app paints today.

Genesis 3:7, where Adam and Eve sew fig *leaves*, carries lexeme 207 (leafage)
and carries neither ascend nor burnt-offering. The data distinguishes the cases
correctly at verse granularity, which is the granularity the map paints at.

Of 45,524 written forms, 40,133 resolve to exactly one meaning. So for 88% of
words there is nothing to choose and no control appears. The remaining 5,391
carry between two and eleven.

### Two traps in the data

**`LexemeId` is an array position, not an identifier.** `src/search.ts:72`
defines it as an index into the loaded dictionary. Regenerating the index shifts
every value. Nothing durable — a URL, a bookmark — may contain one.

**ETCBC ids are not unique either.** 461 of the 9,230 lexemes share an id with
another, always a Hebrew word and an Aramaic word: `<LH/` is both
burnt-offering and pretext. The unique key is the id paired with its language,
`<LH/@heb`, which is distinct for all 9,230. The id alphabet is
`/<=>BCDFGHJKLMNPQRSTVWXYZ[_`, containing no comma, pipe or at-sign, so all
three are available as separators.

**Hebrew in a test file may not equal the same Hebrew in the data.** Found
while writing the merge tests. `lexicon.json` orders a shin's dot before its
sheva, `U+05E9 U+05C1 U+05B0`; a Hebrew keyboard or an editor may emit the marks
the other way round. The two render identically and compare unequal, and the
failure diff shows two lines that look the same. Assert on keys and glosses,
which are ASCII, rather than on pointed forms.

### Why per-word identification is not needed

`verse-morphology.json` lists every word occurrence in text order with its
lexeme, which looks like it would let a click on a word resolve to exactly one
meaning. It would not work, and it is not needed, for two separate reasons.

It would not work because ETCBC's units are morphemes, not written words.
Genesis 1:1 is seven written words but eleven ETCBC tokens, because בְּ+ראשית
and הַ+שמים are each split in two. Across all 23,206 verses the counts agree
in 1.8%, averaging 6.9 extra tokens per verse, and the derived file carries no
grouping with which to undo the split. Filed as #102.

It is not needed because the written-form index already absorbs prefixes and
suffixes. The generator rejoins a token's morphemes and attributes the result to
its content word (`generate-lexeme-index.py`, `token_last_lexeme`):

| searched | resolves to | meanings offered |
|---|---|---|
| בראשית | רֵאשִית beginning, 49 verses | one, so no control appears |
| ובביתו | בַּיִת house, 1,720 verses | one, so no control appears |
| דברו | speak, word, pasture, push back | four |

A form absent from the table falls back to the prefix stripping already in
`findLexemesForWord()`.

So the first word of Genesis resolves to one meaning and the reader sees no
control at all. What per-word data would add is knowing which word *inside* a
matched verse carries the chosen meaning, which matters for highlighting a
result snippet and for nothing here. The map colours whole verses and never asks
the question.


## What gets built

### The dictionary seam

A new module, `src/search/dictionary.ts`, standing between search and ETCBC.
The earlier design document asks for this and the argument holds: the project
has changed its word index once already.

```ts
export interface Meaning {
  key: string;                 // stable: "<LH/@heb"
  form: string;                // עֹלָה
  gloss: string;               // "burnt-offering"
  pos: string;                 // "subs"
  language: 'heb' | 'arc';
  verseCount: number;
}

export interface Dictionary {
  /** What could this written form be? Commonest first; empty if unknown. */
  meaningsFor(writtenForm: string): Meaning[];
  /** Which verses carry any of these meanings? */
  versesFor(keys: string[]): Set<string>;
}
```

The ETCBC implementation wraps `findLexemesForWord`, `getLexeme` and
`searchByLexemes`, which already exist and are unchanged. Translation between
`key` and `LexemeId` happens here and nowhere else, so the unstable array
position never escapes the module.

### Terms become objects

Today a search is a string that `parseSearchTerms()` re-splits on every
keystroke, with `termLexemes[]`, `termForms[]` and `termHasLexeme[]` held
parallel to the result and keyed by position. A meaning selection keyed the same
way would follow an edit onto the wrong word: narrow the second term, edit the
first, and the selection stays on index 1 while the word underneath it changes.

So terms get identity:

```ts
interface SearchTerm {
  id: string;            // stable for the term's lifetime
  text: string;          // what the reader typed
  meanings: Meaning[];   // resolved candidates, commonest first
  selected: Set<string>; // meaning keys currently checked
  colorIndex: number;    // allocated, not derived from position
}
```

`selected` always holds the checked keys explicitly, so "all of them" is
`selected.size === meanings.length` rather than an empty-set convention that
would read as "none".

`colorIndex` is allocated from the unused entries of `SEARCH_COLORS` and held
for the term's life, so removing a term does not recolour the map beneath the
surviving ones.

`parseSearchTerms()` survives as the URL deserializer. Positional addressing is
safe in a URL because `q` and `m` are parsed together from one snapshot; it is
only live editing that needs identity.

### One row per term

Each term is a row carrying its colour swatch, its input, its verse count and a
button to remove it, with its meanings nested beneath. Every meaning carries its
dictionary form, its part of speech, its gloss and its own verse count:

```
● עלה                              1028  ×
    ☑ עָלָה   (v.)          ascend            818
    ☑ עֹלָה   (n.)          burnt-offering    260
    ☑ עָלֶה   (n.)          leafage            13
    ☑ עִלָּה   (aram., n.)   pretext             2

[ + add a word ]
```

Every meaning starts checked, so a reader who ignores the control sees exactly
what the app shows today. The filter only ever narrows.

**The count is verses. The order is likeliest reading, which is the order the
data already arrives in.** These are two different numbers and the difference is
worth stating, because the list can look mis-sorted. `word-lexemes.json` orders
candidates by how often *that spelling* is read as that lexeme; the count beside
each row is how many verses the lexeme occurs in across all its spellings. They
disagree for 36% of ambiguous forms.

Sorting by the displayed count was considered and rejected, because it
misrepresents what the reader typed:

```
דברות     1. דֹּבְרוֹת raft      1v     ← what דברות actually is
           2. דבר    speak  1045v     ← the lexeme across every spelling
```

That spelling really is the plural of "raft". Count order would hoist "speak" to
the top of a search for a word that is almost never "speak". Likelihood order is
also right 96% of the time on its own terms: the largest count sits in the top
two rows for 5,177 of the 5,391 ambiguous forms.

**Nothing marks the dominant meaning.** This was considered and dropped.
Likelihood order does bury a much larger meaning at row three or below for 75
forms — אמרי shows "Amorite, 86" on top with "say, 4,336" at row three, and אלה
puts אֱלֹהִים at 2,248 verses at row seven of ten, under "Elah" at 12. But the
count sits on the row already, so a second signal restates what the first one
says. Danyel's judgement on 2026-09-14: the only shape where a number genuinely
hides is one like (1, 1, 1, 1, 1, 1, 1, 2033), and that is worth seeing in the
real thing before styling for it.

Deep burial without a size gap needs nothing either — יצר hides its biggest at
row 8 of 9, but every count is between 2 and 61.

**Language is marked, Hebrew is not.** Aramaic reads `(aram., n.)`. This is not
decoration: 304 written forms have two candidates that are identical in form,
gloss and part of speech and differ *only* by language. ויאמר is one — it offers
Hebrew "say" and Aramaic "say", both spelled אמר, both verbs.

**Rows that would still render identically are merged into one**, confirmed by
Danyel on 2026-09-14 for the עדן case. 71 forms have
two candidates alike in form, gloss, part of speech and language — almost all
proper nouns, where ETCBC gives separate entries to different people bearing the
same name. אור offers two men called Ur; עדנ offers three places called Eden. Two
identical checkboxes are worse than one, so such candidates become a single row
covering both lexemes, and the URL names each member.

Part of speech renders abbreviated: `subs` as `n.`, `verb` as `v.`, `nmpr` as
`n.pr.`, `adjv` as `adj.`, and so on across the fourteen values ETCBC uses.

A term with one meaning shows no list — which is 88% of words, and includes
בראשית. Neither does an English term, nor one that resolved to no lexeme, which
keeps today's ↪ indicator and its fallback to whole-word matching. A term still
being typed shows nothing; that is deliberate and not worth more.

Unchecking the last checked meaning is prevented: when one remains, its checkbox
disables. A term matching nothing by construction is a dead state with no
reading.

**Adding a word disables at five terms.** `SEARCH_COLORS` is indexed modulo its
length, so a sixth term repeats the first one's colour and the map can no longer
say which word is which. The comma box made a sixth term awkward enough to be
rare; a button makes it one click, so the limit now has to be stated rather than
left to friction.

This row layout also settles #39, editing mixed right-to-left and left-to-right
text in one box, because each Hebrew input is wholly right-to-left and no comma
has to be placed inside a right-to-left run.


### Root becomes the Hebrew default

`hebrewSearchMode` starts at `root` rather than `substring`, which is the
"reconsider the default" half of #92. Substring matches inside longer words that
have nothing to do with the query, and it is the one mode where the meaning
filter cannot appear at all.

Substring and whole-word remain available and unchanged. The mode belongs to the
search, not to a term.

The meaning list renders only in root mode. Selections are kept in memory when
the reader switches away, so switching back restores them.

The hit-counts-per-mode half of #92 is not built here. It stays open.

### URL

A new parameter `m` gives the checked meanings per term, positionally aligned
with the comma-separated terms in `q`. Meanings within one term are separated by
`|`, terms by `,`, and a term whose meanings are all checked contributes an
empty entry.

    #overlay=search&q=עלה,מלך&hm=root&m=%3CLH%2F%40heb,

reads as: burnt-offering only for עלה, everything for מלך.

`m` is omitted entirely when no term is narrowed, and when the mode is not
`root`. An unrecognised key is dropped, and if that leaves a term with nothing
selected the term falls back to all its meanings and the legend says so.

Following the decision in this document's questions, an absent `hm` means the
current default, so it now means root. Links shared before this change paint
differently. This is consistent with #74, which holds that an absent parameter
resets to the default.

## Testing

Against the seam, not the UI, wherever a pure function will do:

- `meaningsFor('עלה')` returns four meanings, ascend first, with the counts above.
- `versesFor(['<LH/@heb'])` returns 260 verses; Genesis 3:7 is absent from it and
  present in `versesFor(['<LH=/@heb'])`.
- `<LH/@heb` and `<LH/@arc` resolve to different meanings, which is the
  collision case and the reason the key carries a language.

On the term model:

- Editing one term leaves another term's selection and colour untouched.
- Removing a term does not change the colour of the terms that remain.
- The last checked meaning cannot be unchecked.

On the URL, a round trip through `getUrlParams` and `applyUrlParams`, including
an unknown key falling back to all meanings.

As a corpus property rather than a hand-chosen list — the earlier document
explains why a hand-chosen list is what produced a misleading result before —
for a sample of ambiguous forms, the union of the per-meaning verse sets equals
the unfiltered result set for that form. That is the invariant the filter rests
on, and it holds or fails across the whole corpus rather than for fifteen words.

Because this changes the UI, it is not complete until Danyel has looked at it.

## Assumptions, and what is still open

Recorded as they are made, for a cleanup pass before the PR leaves draft.

**Checked, no longer assumed:**

- The candidate order in `word-lexemes.json` is genuinely commonest-first, by
  occurrences of *that spelling read as that lexeme*. Confirmed in the generator
  (`form_counts`, sorted by descending count) and against the data. It is not
  the same number as the verse count shown on each row, which is why the rows
  are re-sorted — see "One row per term".
- The count on a row is verses, not occurrences. Verses are the unit the map
  paints in.
- Five terms is a cap, not an assumption. `SEARCH_COLORS` is indexed modulo its
  length, so a sixth term repeats the first term's colour and the map stops
  saying which word is which. "Add a word" disables at five.

**Open:**

- Whether a buried count ever genuinely hides. אלה is the worst found: אֱלֹהִים
  at 2,248 verses at row 7 of 10, under "Elah" at 12 and "big tree" at 15. The
  decision is to show it plainly and look at it, not to style around it.
- Whether `nmpr` should render as "name" rather than an abbreviation, since
  proper nouns are the bulk of the cases where two rows look alike.
- The hit-counts-per-mode half of #92.
- Whether `getRelatedRoots()`, removed in #71, is missed. Both the earlier
  design document and #94 assumed walking between related words mattered;
  Danyel's judgement on 2026-09-14 was that it does not.
