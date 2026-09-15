# What counts as a word

**Date:** 2026-09-15
**Status:** proposed, not yet implemented
**Issues:** #132
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
verses with the honest fallback marker beside the term — which is exactly what
happens today for רבשקה. Step 3 converts a correct fallback into a confident
wrong answer and suppresses the signal that would have flagged it.

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

Measured over the whole text: 121,790 nodes are bound (28.6%), 304,800 are free.
The bound ones are conjunctions (51,141), prepositions (39,500), articles
(30,385) and interrogatives (749). Content-word lexemes among them: **19
occurrences**, 0.016%. So "bound" is a definition of *not a word* derived from
the text, needing no part-of-speech list, no threshold, and no judgement about
whether adverbs count.

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

`word-lexemes.json` goes from 45,524 written forms to 45,846: **322 added, none
removed.** Nothing becomes less findable. The bound morphemes it stops indexing
were already excluded by the generator's two-letter minimum, so the rule costs
no searchability at all — it only adds.

`verse-lexemes.json` shrinks 17.7%, from 325,829 entries to 268,177.

### The fallback ladder stops being needed

Which lookup answers each of the 305,451 printed words in the Tanakh:

| branch | now | under the rule |
| --- | ---: | ---: |
| written-form table | 289,906 (94.91%) | **304,844 (99.80%)** |
| exact dictionary spelling | 801 | 17 |
| spelling starts with the term | 2,450 | **23** |
| strip a prefix and retry | 9,402 | **282** |
| nothing matched, fall back | 2,892 | 285 |

The table answers 99.8% on its own. Everything below it handles 607 words out of
305,451. The three fallback branches exist to patch a hole that this rule
closes, so they go: step 3 with its 23 remaining hits is the one that produced
Melchizedek, and step 4's prefix stripping was re-deriving by string surgery
what ETCBC's parse already said.

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

All seven are already in the `misaligned` list that #102 / PR #126 introduces, the verses
where BHSA and Sefaria divide words differently. Two independent measurements
landing on the same verses is a good sign: the rule's only casualties are ones
already known to be unreliable for word-level work.

**No verse is left with no lexemes at all.**

**עלה gains the Aramaic preposition** — 86 verses on top of 1,028. This is the
collision `indexable()` was written to prevent, and it is now simply allowed,
because עלה written with a suffix is a word and 8% is not a reason to hide it.

## What gets built

1. **`indexable()` and `FUNCTION_WORD_POS` are deleted** from
   `scripts/search/generate-lexeme-index.py`. The collision they guarded cannot
   arise: לכ cannot gain "ל", because ל is never a word to gain.
2. **The generator decides free from bound** at the top of its word loop, from
   the printed trailer, and indexes a written form and adds a verse lexeme only
   for free nodes.
3. **`lookupFormOrSpelling()` loses its "spelling starts with the term" branch**,
   and `findLexemesForWord()` loses its prefix-stripping loops. What is left is
   the table lookup, the exact-spelling lookup, and the existing honest fallback
   to whole-word matching.
4. **`lexicon.json` gains nothing and loses nothing.** Lexeme ids do not move,
   so nothing durable breaks.

`functionWordPos` in `lexicon.json` is already written-but-unread, and the data
README says so; it comes out with the rest.

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
- Removing the gate removes no written forms. 322 added, 0 removed.
- The seven content-word losses are all already-misaligned verses.

**Open:**

- **Is 4,487 verses the right answer for עליו?** The rule makes root mode
  generalise to every occurrence of עַל, which is what root mode means and what
  was asked for, but it is a very wide result. Whether the chooser should show
  the count, or offer the narrow reading alongside, is a separate question about
  the overlay rather than about the index.
- **Whether the six emptied lexemes should be offered as meanings at all.** They
  match nothing, so they cannot mislead, but a chooser row reading וְ "and" with
  no verses behind it is noise.
- **Whether `root` is still the right name** for a mode that resolves a written
  form to dictionary words and never analyses a root.
