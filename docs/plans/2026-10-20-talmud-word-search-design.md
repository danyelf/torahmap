# Searching the Talmud by dictionary word

**Status:** Draft — findings. Issue #382. Nothing here is built, and nothing
derived from Sefaria's table ships until Sefaria says how it may be used.

## The problem

The Tanakh's meanings search finds every form of a word and lets the reader
narrow it by meaning, because ETCBC's BHSA tags each word of the Bible with its
dictionary word. Nothing does that for the Bavli. The candidate is Sefaria's
word-form table (the `word_form` collection in Sefaria's database dump), which
maps a written form to headwords in Jastrow's dictionary. This measures how far
that table goes against the text the Talmud's search reads, `search.json` (the
William Davidson edition, abbreviations spelled out).

## The numbers

`scripts/talmud/word-forms-report.ts` prints all of them; DATA_REGENERATION.md
says how to get the dump. Measured on the dump of 2026-10-19 (2.6 GB, MD5
`ade3745efc93aedcbf9660412f0226d3`); Sefaria rebuilds it every day.

A token is one word in the text; a form is a distinct spelling. The text has
1,853,469 tokens of two letters or more in 92,018 forms. Single letters (2,490)
are left out, as search leaves them out.

| | tokens | forms |
|---|---|---|
| Found in the table as written | **77.5%** | 40.0% |
| …or after taking off up to three prefix letters (ו ד ב ל מ ש ה כ) | 82.6% | 50.4% |

Of the covered tokens:

| | |
|---|---|
| One Jastrow headword | **30.6%** |
| Two to five | 52.0% |
| More than five | 17.3% |
| Come down to one headword by any means the data offers (below) | **56.1%** |

Forms to add by hand, commonest first, to reach a share of tokens:

| share | from the table as written | with prefix letters taken off |
|---|---|---|
| 85% | 315 | 17 |
| 90% | 1,861 | 582 |
| 95% | 8,745 | 4,859 |

## What the table is

130,058 records link a form to a Jastrow headword. What a record means depends
on how Sefaria made it, which its `generated_by` field names:

- **Occurrence lists** (`prefix_adder_1`, 65,286 records). The form as it
  appears in the Bavli, prefixes included (דאמר, ליה), with every segment it
  appears in: 27,124 segments for אמר. One record per headword, and all of a
  form's records usually list the same segments. These lists appear to come
  from matching spellings with prefixes taken off, and so reach headwords that
  are wrong: מאי reaches אִי (as מ + אי) and ליה reaches יָהּ.
- **Headword spellings** (`clean headword`, `alt headwords & plurals`, `binyan
  form` and smaller groups, about 55,000). The headword's own spelling, mostly
  with vowel points, and no Bavli passages.
- **Jastrow's quotations** (`jastrow_jackpot`, 9,866). The form where Jastrow's
  entry quotes it, with the passage quoted.
- **Sefaria's choices** (`adjust_most_common_talmud_words`, 279). The headword
  Sefaria chose by hand for a common Talmud word: רבי → רַבִּי, ליה → לְ־, מאי
  → מַאי, דאמר → אֲמַר. No passages.

## Do the passages say which headword is meant?

Mostly not. An occurrence list names the token's own segment for 73.2% of
covered tokens. This is the measurement behind #382's "62% have a headword
citing that very passage". But the list records where the form appears, not
which headword it is there, and a form's lists are nearly always identical
across its headwords. Jastrow himself quotes the form at that segment for 1.6%
of covered tokens, and at that amud for 2.6%.

Of the 1,061,873 covered tokens with several headwords, each of these picks
out one:

| | |
|---|---|
| Sefaria's choice exists for the form | 28.6% |
| Leaving out headwords reached only through an occurrence list | 12.9% |
| Only one headword's occurrence list names the segment | 4.6% |
| Jastrow quotes it at the amud under one headword | 1.9% |
| Any of these | 56.1% of all covered tokens come down to one |

Sefaria's choice is a default for the form, the same at every occurrence: אי
is always אִי II, wherever it appears. Context picks it only in Jastrow's
quotations, which are rare.

Among the most common forms, the choice decides רבי, ליה, אלא, מאי, דאמר, נמי,
הא, הכי, רבא, להו. It leaves אמר (six headwords, 44,000 tokens), לא, רב, על,
את, הוא and אין open.

Jastrow often has several entries for what a reader takes to be one word:
רבי reaches seven (רִבֵּי, רבי, רְבֵי, *רְבֵי, רְבֵי ², רַבִּי, רָבֵי). A
chooser that lists entries as they are would show all seven.

## Hebrew or Aramaic

Jastrow marks Aramaic entries "ch." (Chaldaic) and biblical Hebrew ones "b. h.";
5,837 of the 32,512 entries carry such a note. For 14.7% of covered tokens
every headword has one. If an entry without a note is read as Hebrew, which is
plausible for Jastrow but not checked, the headwords of 64.9% of covered tokens
agree on one language.

## Vowels

Dicta's vowel points (see #382) could choose between headwords only where the
table's forms carry points. 49,111 of the Jastrow records do, but they are the
headword spellings. The occurrence lists, Jastrow's quotations and Sefaria's
choices have none. So the vowels could be compared only to a headword's own
spelling, which fits uninflected words and little else.

## The gaps

The uncovered 17.4% of tokens are spread thin: 45,636 forms. The 100 commonest
account for a quarter of the gap. Read by hand, they are:

| kind | tokens, of the top 100 | examples |
|---|---|---|
| Verb forms the table lacks | about 36,000 | אומר, אמרו, אומרים, תניא, דתניא, איתמר, היו, עושה, נותן |
| A pronoun ending on a word or preposition | about 26,000 | לה, בה, עליו, אותו, עצמו, חבירו, אשתו, אינה |
| A plural or feminine of a noun or adjective | about 8,000 | חכמים, נשים, טמאה, אסורה, הרבים, טפחים |
| Names and set phrases | about 5,000 | רחמנא, חנינא, (סלקא) דעתך, לישנא |
| Section markers | about 5,000 | גמ׳, מתני׳, וגו׳ |

So the misses are inflected forms of words the table already has, not spelling
variants or Aramaic particles. Abbreviations are 2.3% of the gap, because
Davidson spells them out. The report also guesses which misses are full or
defective spellings, a ו or י added or removed with the result in the table;
that guess catches a third of the gap but also matches different words (תניא to
תנא), so it is an upper bound.

**Taking prefix letters off is half wrong.** Of the 40 commonest forms found
only that way, by tokens about 54% are right (משום as שום, במקום, לעולם, בתוך)
and the rest are not (לומר as ומר, דברים as ברים, כהנא as הנא, בנים as נים).
The table's occurrence lists already hold the text's prefixed forms, so the
77.5% found as written is the figure to trust; the extra 5.2 points are about
half real.

## Options for the search

The search finds the word typed in every form it takes, and narrows it by
meaning (AGENTS.md). The Tanakh does this by tagging each token with one
dictionary word. Here 69% of covered tokens have several, so the question for
every option is what a token with several headwords does when the reader picks
one.

1. **The table as it stands, no stripping.** The reader types a form; the
   chooser lists its headwords; picking one finds every token whose form can
   be that headword. 77.5% of tokens are reachable. Tokens still ambiguous
   (44% of covered ones) appear under each of their headwords, so a pick
   narrows less than it seems to. Cost: building a form-to-headword file from
   the dump, for the 36,800 of the text's forms it covers (its size not yet
   measured), and the license.
2. **Option 1 with Sefaria's choices and the other rules above**, so that 56%
   of covered tokens count under one headword. Cost: small. The choice is a
   default, so it is sometimes wrong in context, and nothing in the data shows
   how often.
3. **Option 2 plus hand entries.** 315 forms to reach 85% of tokens, 1,861 for
   90%. Each entry maps an inflected form to headwords the table already has,
   which is quick for a reader of the Talmud but is still hundreds of decisions.
4. **Option 2 plus generated inflections**: take known endings (ו, ה, יו, ים,
   ין, ות) and prefixes off a missing form and look the rest up. Covers more
   with no hand work, but the prefix measurement above suggests about half the
   guesses would be wrong, and a wrong guess puts a token under the wrong word.
5. **Merge Jastrow's near-duplicate entries in the chooser** (the seven רבי),
   with any of the above. Cost: a rule for which entries are one word, which
   Jastrow's numbering (I, II, ²) does not give.

A tagger of our own (Dicta's vowel points with BEREL, #382's option 2) is what
would do better than 56% on ambiguity; it is a research project and not costed
here.

## Open questions

- The license: Sefaria's table states none. Danyel is asking.
- How often Sefaria's choice is wrong in context. Needs a sample read by hand.
- Whether an entry with no language note in Jastrow is Hebrew.
