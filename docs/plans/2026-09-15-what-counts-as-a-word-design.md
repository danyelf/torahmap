# What counts as a word

**Date:** 2026-09-15
**Status:** accepted 2026-09-15, implemented on the same branch
**Issues:** #132
**Builds on:** #102 / PR #126, merged 2026-09-15, which taught the generator to
divide a verse into the words it is printed as
**Supersedes:** the `indexable()` / `FUNCTION_WORD_POS` mechanism in
`scripts/search/generate-lexeme-index.py`, and the fallback ladder in
`findLexemesForWord()`

## The problem

A reader who types עליו, "upon him", gets Melchizedek.

Root mode returns 57 verses. Two of them contain the word. The other 55 are
about אֵל עֶלְיוֹן, God Most High, because the lookup resolved עליו to the
adjective עֶלְיוֹן. The 368 verses that actually say עליו are almost all missing.
The meaning chooser names the substitution — it offers עֶלְיֹון "upper" and
עֶלְיֹון "most high" — so the reader can see what happened, but there is no
option for the word they typed.

This is not an edge case. עליו is one of the commonest words in the Bible, and
the same happens to בו, לכם, עליהם and the rest of the prepositions and
pronouns that carry a suffix.

## How it happens

Four lookups run in order in `findLexemesForWord()`, and the word falls through
the first three:

1. **The written-form table**, `word-lexemes.json`, built from ETCBC's parse of
   every word in the Bible. עליו is not in it. ETCBC parsed all 368 occurrences
   correctly as עַל plus a third-person suffix; the generator then dropped them
   on purpose, which is the subject of the next section.
2. **The dictionary spelling, exactly.** No lexeme is spelled עליו.
3. **A dictionary spelling that starts with עליו.** עֶלְיֹון folds to `עליונ`,
   which starts with `עליו`. Two lexemes match, and the lookup returns them.
4. **Prefix stripping** — never reached, and it would not have helped: ע is not
   a prefix and the function strips no suffixes. Nothing in it can turn עליו
   into עַל.

Step 3 is doing the damage, and it is worth being precise about how. It does
not rescue a failing lookup. Without it, עליו would resolve to nothing, root
mode would fall back to whole-word matching, and the reader would get all 368
verses — which is exactly what happens today for רבשקה, a name the dictionary
does not carry. Step 3 converts a correct fallback into a confident wrong
answer.

An earlier draft of this document said the fallback shows a marker beside the
term. Checked in the running app: it does not. A term that resolved to a lexeme
and a term that fell through to text matching look exactly alike, and only the
meaning chooser appearing or not hints at the difference. That is worth fixing
and is filed separately; it does not change the argument here, because a wrong
answer is worse than a right one that says nothing about itself.

It is also the behaviour already ruled out on design grounds: offering עֶלְיֹון
for עליו is a path to a neighbouring word that merely shares a spelling prefix.

## Why the table has a hole

`indexable()` in the generator files a function word only under its own bare
consonantal spelling. Any prefixed or suffixed form is dropped. It applies to
ten parts of speech — article, conjunction, preposition, negative,
interrogative, interjection, demonstrative, interrogative pronoun, personal
pronoun, adverb — which is 192 of 9,230 lexemes, 2.1% of the dictionary, but
**188,846 of 426,590 word occurrences, 44.3% of the text**.

The comment above it justifies the rule with עלה: the Aramaic preposition עַל
with a suffix is written the same as the verb עלה "ascend", and indexing it
would "drag in every one of the 5,700 places the preposition occurs."

That example is wrong. The lexeme עלה would gain is the **Aramaic** עַל, which
occurs in 86 verses. The 5,700 belongs to the **Hebrew** עַל — a different
lexeme, which could never attach to that spelling. The real cost of indexing
עלה is 86 verses on top of the 1,028 it already returns.

The concern is real, but it points at words nobody wrote down. Regenerating the
whole index with `indexable()` disabled shows 171 spellings that genuinely
collide with a content word, and 80 of those drag in over a thousand verses:

| spelling | would gain | verses dragged in |
| --- | --- | --- |
| לכ, לכה, לנו, שלי, מלכמ | לְ "to" | 11,649 |
| ידעתה | הַ "the" | 12,831 |
| בנו | בְּ "in" | 10,149 |

So the gate earns its place — for לכ, not for עלה.

Beyond those 171, it withholds **323 spellings entirely**, and every one of the
323 collides with nothing at all. עליו, בו, לכם and ואת are in that set. No
word in Hebrew is spelled עליו except the preposition with its suffix. It was
withheld as collateral damage from a rule aimed at a different word.

## The thing that was actually wrong

Chasing the collisions leads somewhere better than a narrower exclusion list.

לְ is not a word. It is a proclitic — it cannot stand on its own, it is always
printed stuck to what follows. "Every verse containing the letter ל" is not a
query anyone means to run, and the 11,649 verses are not a wrong answer to a
right question; they are a right answer to a question that should not have been
askable.

And BHSA already records this, in a feature the generator reads and throws
away. Every word node carries a trailer: the text printed after it before the
next node. A node whose trailer is empty runs straight into the next one, with
no space and no maqaf between them. It is part of a word rather than a word.

The split is nothing like the part-of-speech list:

| lexeme | occurrences | glued to next | free-standing |
| --- | ---: | ---: | ---: |
| וְ "and" | 50,272 | 50,272 | 0 |
| הַ "the" | 30,386 | 30,385 | 1 |
| כְּ "as" | 2,902 | 2,885 | 17 |
| בְּ "in" | 15,542 | 14,184 | 1,358 |
| לְ "to" | 20,069 | 15,640 | 4,429 |
| עַל "upon" | 5,766 | **0** | 5,766 |
| אֵת | 10,987 | **0** | 10,987 |
| לֹא "not" | 5,167 | **0** | 5,167 |
| כִּי "that" | 4,483 | **0** | 4,483 |

`FUNCTION_WORD_POS` treats all nine identically because they share a label.
Four of them stand alone every single time they occur. They are words.

The mixed rows are not fuzziness. Of לְ's 15,929 glued occurrences, every single
one carries **no** pronominal suffix — the bare proclitic stuck to a noun. Of
its 4,518 free occurrences, every single one **has** one: לוֹ, לָהֶם, לְךָ,
printed words in their own right. Two different things wearing one lexeme, and
the trailer separates them exactly.

## The rule

Walk BHSA's word nodes in text order. Each carries a trailer; where the verse is
corrected, use the qere's trailer, because that is what the page shows.

- A node is **bound** if its printed trailer is empty. Nothing separates it from
  the next node; they are printed as one word.
- A node is **free** otherwise — a space, a maqaf or the end of the verse
  follows it.
- A **printed word** is a run of nodes ending at a free node. Its **stem** is
  that final node.

> **A bound node is not a word.** It is never a search result, never contributes
> a verse to any index, and is never offered as a meaning. Only printed words
> are searchable, and a printed word is indexed under the lexeme of its stem.

The consequence that does the work: a lexeme's verse set holds a verse when that
lexeme is the **stem of a printed word** in it, not when any morpheme in the
verse happens to carry that lexeme.

The rule is one test. It needs no second clause about suffixes, because **no
node in the Bible is both bound and suffixed** — zero out of 426,590.

Measured over the whole text: 121,790 nodes are bound (28.5%), 304,800 are free.
The bound ones are conjunctions (51,141), prepositions (39,505), articles
(30,386), interrogatives (749) and interrogative pronouns (2). Content words
among them: **7 occurrences**, six nouns and one verb, 0.006%. So "bound" is a
definition of *not a word* derived from the text, needing no part-of-speech
list, no threshold, and no judgement about whether adverbs count.

## What it does

Verse counts, computed by applying the rule to the shipped data:

| word | gloss | now | under the rule | |
| --- | --- | ---: | ---: | --- |
| וְ | and | 19,617 | 0 | gone |
| הַ | the | 12,831 | 0 | gone |
| כְּ | as | 2,371 | 14 | −99% |
| בְּ | in | 10,149 | 1,260 | −88% |
| מִן | from | 5,792 | 1,179 | −80% |
| לְ | to | 11,649 | 3,652 | −69% |
| עַל | upon | 4,487 | 4,487 | **±0** |
| אֵת | object marker | 6,783 | 6,783 | **±0** |
| לֹא | not | 3,945 | 3,945 | **±0** |
| כִּי | that | 3,908 | 3,908 | **±0** |
| אֲשֶׁר | relative | 4,438 | 4,438 | **±0** |

The bottom block is the point. The rule touches nothing about real words — not
one verse — while cutting the fragments to zero or near it. What remains for לְ,
בְּ and מִן is exactly their suffixed forms, which are words.

Running the patched generator end to end, against the real search code:

| typed | chooser offered before | chooser offers under the rule |
| --- | --- | --- |
| עליו | עֶלְיֹון "upper", עֶלְיֹון "most high" | **עַל "upon"** |
| בו | nothing; fell through to text matching | **בְּ "in"** |
| לכ | הלך "walk" | **לְ "to", הלך "walk", לְ "to"** (aram.) |
| ואת | אֵת ×2, אַתְּ, אֹות (via prefix stripping) | אֵת ×2, אַתְּ, אַתָּה |

`word-lexemes.json` goes from 45,524 written forms to 45,844: **327 added, 7
removed.** The bound morphemes it stops indexing were single letters, already
below the generator's two-letter minimum, so they cost nothing.

The seven removed forms are not words either. They are what the old walk
produced when it joined a token at the *written* trailer across a boundary the
page prints: שיניהמ filed under רֶגֶל "foot", מאשתמ under תָּם "complete",
ישימות under מָוֶת "death". Checked against `all-texts.json`, **none of the seven
appears anywhere in the printed Bible**, so nothing a reader could copy off the
page became less findable.

`verse-lexemes.json` shrinks 17.7%, from 325,829 entries to 268,177.

### The fallback ladder stops being needed

Which lookup answers each of the 305,451 printed words in the Tanakh:

| branch | before | after, as shipped |
| --- | ---: | ---: |
| written-form table | 289,906 (94.91%) | **304,844 (99.80%)** |
| exact dictionary spelling | 822 | 38 |
| spelling starts with the term | 2,450 | *deleted* |
| strip a prefix and retry | 9,402 | *deleted* |
| nothing matched, fall back | 14,724 (4.82%) | **570 (0.19%)** |

The table answers 99.8% on its own, so the three branches below it go. What they
were covering was not a shortfall in ETCBC's parse but the hole the generator
punched in it: before the rule the commonest unresolved printed words were ואת
(2,242 occurrences), ולא (1,591), לי (749) and עליו (403). Afterwards the
commonest are נגו (14) and ברנע (10) — the second halves of אֲבֵד נְגוֹ and
קָדֵשׁ בַּרְנֵעַ, compound names that BHSA and Sefaria divide differently, which
is the same 64 verses the `misaligned` list already names.

Step 3 is the one that produced Melchizedek. Step 4's prefix stripping was
re-deriving by string surgery what ETCBC's parse already said.

## What it costs

**Six lexemes lose every verse they had**, all proclitics: וְ (Hebrew and
Aramaic), הַ, שַׁ, a second כְּ, and הֲ. Under the rule they are not words and
match nothing. They stay in `lexicon.json` as unreachable rows rather than being
removed, because lexeme ids are array positions and removing a row shifts every
id after it.

**Seven verses lose a content word**, all compounds BHSA writes solid where
Sefaria prints a separator: `הַלְלוּ־יָהּ` (Psalms 106:1), `אֲבִיעַד` (Isaiah
9:5) and five `אַחַר` compounds. BHSA gives הללו an empty trailer — it considers
Hallelujah one word — so "praise" stops being findable in that verse.

All seven are already in the `misaligned` list that #102 / PR #126 shipped, the
verses where BHSA and Sefaria divide words differently — checked one by one
against `public/data/search/verse-morphology.json` rather than assumed. Two
independent measurements landing on the same verses is a good sign: the rule's
only casualties are ones already known to be unreliable for word-level work.

**No verse is left with no lexemes at all.**

**עלה gains the Aramaic preposition** — 86 verses on top of 1,028. This is the
collision `indexable()` was written to prevent, and it is now simply allowed,
because עלה written with a suffix is a word and 8% is not a reason to hide it.

## What gets built

The rule needs no new machinery. PR #126 already put it in the generator.

To fill `verse-morphology.json`'s new word arrays, #126 taught the walk to close
a printed word at `is_token_break(printed_trailer)` — which is this rule's
question, asked and answered on every node. It wired that only to the new
arrays, deliberately, so that `word-lexemes.json` would come out byte-identical
and the boundary work could land on its own. That reason has expired.

So the generator today holds **two walks with two ideas of where a word ends**:
the older one breaks `token_forms` at the *written* trailer to build
`word-lexemes.json`, and beside it `verse_lexemes[key].add(lexeme)` fires on
every morpheme with no notion of words at all; #126's breaks at the *printed*
trailer. The work is to delete the older one and derive all three files from the
one that is left.

The two disagree about **23 nodes out of 426,590**, all of them qere
corrections — Genesis 30:11, Exodus 4:2, 1 Samuel 24:9 and twenty more. That is
the entire price of having one definition instead of two:

| | written trailer | printed trailer |
| --- | ---: | ---: |
| bound nodes | 121,801 | 121,790 |
| lexemes emptied | 5 | 6 |
| `verse-lexemes` entries | 268,172 | 268,183 |

The printed trailer wins, because it is what the reader sees and what #126's
word arrays already follow. Every figure in this document was computed on it.

1. **One walk.** At each printed-word break the generator files the joined form
   and the stem's own written form under the stem's lexeme, adds the stem to
   that verse's lexeme set, and records the word's length. A node that is not a
   stem contributes nothing to any index. Filing the stem's own form is what
   keeps ראשית findable as well as בראשית.
2. **`indexable()` and `FUNCTION_WORD_POS` are deleted.** The collision they
   guarded cannot arise: לכ cannot gain "ל", because ל is never a word to gain.
   `functionWordPos` in `lexicon.json` is already written-but-unread, and the
   data README says so; it comes out with the rest.
3. **The generator asserts what the rule rests on.** It reads BHSA's `prs` and
   exits loudly if any bound node carries a pronominal suffix, so a future BHSA
   release cannot quietly invalidate the one-test rule.
4. **`lookupFormOrSpelling()` loses its "spelling starts with the term" branch**,
   and `findLexemesForWord()` loses its prefix-stripping loops. What is left is
   the table lookup, the exact-spelling lookup, and the existing honest fallback
   to whole-word matching. `HEBREW_PREFIXES`, `HEBREW_PREFIX_COMBOS` and
   `MIN_COMPLETION_LENGTH` have no other callers and go with them.
5. **The meaning chooser drops rows with no verses behind them.** That is the
   six emptied proclitics, which would otherwise read וְ "and" against a count
   of nothing.
6. **`lexicon.json` gains nothing and loses nothing.** Lexeme ids do not move,
   so the meaning-filter URLs from #111 keep resolving.

## What this unblocks

#127, click a word in a verse to search for it, is built on the hole this rule
closes. Its `meaningsInVerse()` cannot ask which dictionary word a clicked word
is, so it guesses: it takes the candidates for the spelling and keeps those that
occur anywhere in the verse. Its own comment names the fix —

> This is inference, not knowledge. BHSA tags every word occurrence with exactly
> one lexeme, but the index is keyed by spelling, so the link is lost before it
> reaches the browser and is reconstructed here. When the index carries per-word
> lexemes, this body becomes a lookup and every caller stays as it is.

The index has carried per-word lexemes since #126: `words` gives the length of
each printed word, and the last morpheme of that run is its stem. Genesis 1:1
divides into its seven printed words and names רֵאשִׁית, ברא, אֱלֹהִים, אֵת,
שָׁמַיִם, אֵת, אֶרֶץ.

#127 also measured this rule's problem from the click side, without naming it:

> Of the 11,096 clicks that reach this branch, 87.6% have a true reading that is
> a function word carrying a prefix or a suffix — 6,062 of them the object
> marker את on its own — and the generator leaves those out of the spelling map
> on purpose.

That is `indexable()`, counted in clicks. Two things here change what #127 needs.
The hole closes, so most of those 11,096 start resolving. And `verse-lexemes.json`
comes to hold stems only, where today it holds every morpheme — so the ב of
בְּרֵאשִׁית stops counting as a dictionary word the verse uses, and the set #127
intersects against becomes the right one.

Sequencing: this lands first, and #127 rebases onto it and re-measures rather
than carrying a workaround forward. Whether `meaningsInVerse()` becomes a
position lookup is #127's call; if it does, the 64 verses in `misaligned` are
where BHSA and Sefaria divide words differently, so position must not be trusted
there and the existing "cannot settle" branch is the right home for them.

## Testing

- The existing test `indexes a function word only under its own spelling`
  inverts: עליו and בו must now resolve, to עַל and בְּ.
- Every lexeme that is always bound has an empty verse set; every lexeme that is
  always free has the verse count it has today. The ±0 rows above are the
  assertion — a change there means the rule has reached a real word.
- No node is both bound and suffixed. This is what lets the rule be one test,
  and it should fail loudly if a future BHSA version breaks it.
- עליו resolves to עַל and not to עֶלְיֹון, named as a regression test for the
  branch being removed.
- Nothing that resolves today stops resolving: the written-form count may only
  grow.

## Assumptions, and what is still open

**Checked, no longer assumed:**

- The עלה justification in the generator comment is wrong by roughly 50x, and
  the real collisions are elsewhere. Measured against a full regeneration with
  the gate disabled.
- No bound node carries a pronominal suffix. Zero of 426,590.
- Removing the gate costs no findable word. 327 forms added, 7 removed, and all
  seven of those are strings that are printed nowhere in the Bible.
- The seven content-word losses are all already-misaligned verses.
- The written and printed trailers disagree about 23 nodes, so unifying the two
  walks onto the printed one costs 23 nodes and no promise made here.
- The seven content-word losses are 7, not the 19 an earlier draft of this
  document claimed; that figure contradicted the same document's "seven verses",
  and its part-of-speech breakdown did not sum to its own total.

**Settled on 2026-09-15:**

- **4,487 verses is the right answer for עליו.** Root mode means every inflected
  form of one dictionary word — ואמר already returns all 4,336 verses of אמר,
  and עליו returning all 4,487 of עַל is the same rule in the same shape. The
  chooser already prints the count on the row, so the breadth is visible before
  the reader commits, and word mode is one click away for the narrow 368. No
  extra row, no non-dictionary entry in a chooser that has only held meanings.
- **The six emptied lexemes are not offered as meanings.** A row reading וְ "and"
  against a count of nothing is noise; rows with no verses are dropped.

**Open, and filed rather than built:**

- **Whether `root` is still the right name** for a mode that resolves a written
  form to dictionary words and never analyses a root. It has done no
  derivational walking since `getRelatedRoots()` was removed in #71, and the
  name misleads: it reads as "and everything from this root" when it means "and
  every inflected form of this word". `lexeme.root` is loaded at
  `src/search.ts:231` and read by nothing, which belongs in the same question.
