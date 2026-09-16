# Search data

These four files are the Hebrew dictionary behind root-mode search — the mode
where typing מלך finds every inflected form of the word, not just that spelling.
All four are generated. Do not hand-edit them.

## Where they come from

The source is the **ETCBC BHSA database** (Biblia Hebraica Stuttgartensia
Amstelodamensis), version 2021, read through the Text-Fabric toolchain.

BHSA identifies every word in the Hebrew Bible with a lexeme — a dictionary
entry — and keeps homographs apart, so the preposition "upon" and the verb
"ascend" are separate entries even though they are spelled alike. It also
carries an English gloss for each lexeme and the grammatical parsing of every
occurrence. Nothing else we looked at has all three.

## What each file holds

| File | Contents |
| --- | --- |
| `lexicon.json` | The dictionary. One row per lexeme: vocalized display form, English gloss, part of speech, language, and the derivational root where BHSA supplies one. |
| `word-lexemes.json` | Written form → the lexemes it could be, most frequent reading first. Keys have their points stripped and their final letters folded to the medial shape, matching what the search box does to what you type. |
| `verse-lexemes.json` | Verse key → the distinct lexemes occurring in that verse. This is what search actually queries. |
| `verse-morphology.json` | Every word of every verse in text order with its lexeme and its grammatical parsing, and where each printed word begins and ends. Kept for a future grammatical-form filter; search does not load it. See below — its units are not the words you see on the page. |

Lexemes are referred to throughout by their position in the `lexicon.json`
array rather than by name, which is what keeps the two per-verse files small.

## Morphemes are not words

ETCBC counts in morphemes, not in printed words. The בְּ of בְּרֵאשִׁית, the הַ of
הַשָּׁמַיִם and the וְ of וְאֵת are each a unit of their own, so the seven words of
Genesis 1:1 are eleven units. Over the whole Tanakh there are 426,590 units
against 305,509 printed words. Reading the file as a list of words, which its
old description invited, silently shifts every word after the first prefix.

So each verse in `verse-morphology.json` is three arrays rather than one:

```json
"Genesis:1:1": [ [[0,0],[1,1],[2,2], ...],   // morphemes, in text order
                 [2,1,1,1,2,2,2],          // morphemes per printed word
                 [] ]                      // words a maqaf follows
```

`words` sums to the length of `morphemes`. A **0** means the printed word is a
further part of the dictionary word before it: תּוּבַל קַיִן is one entry in the
dictionary and two words on the page, so the second gets no morphemes of its
own.

A printed word ends at a space **or at a maqaf**, the hyphen in כָּל־הָאָרֶץ. That
keeps "all" and "the earth" apart, which is the point — they are two dictionary
words. `joined` lists the positions a maqaf rather than a space follows, so
anything that wants the whole printed unit back can rejoin them.

### Verses that do not line up

`misaligned` names 64 verses — 0.28% — where the word count here differs from
the Hebrew in `all-texts.json`. Almost all are compound proper names the two
sources divide differently: BHSA writes צוּרִי־שַׁדָּי with a maqaf where Sefaria
writes צוּרִישַׁדָּי solid. Joshua 21:36 and 21:37 are there because Sefaria ships no
Hebrew for them.

Nothing can reconcile these from BHSA alone, so they are named instead. Anything
matching positions in this file against displayed text should skip those verses
and fall back to looking the spelling up in `word-lexemes.json`, rather than
labelling a word confidently wrong.

### Splitting the displayed text the same way

To line up against the Hebrew in `all-texts.json`, fold it the way
`displayed_words()` in the generator does, or the counts will not match:

- drop the scribal paragraph marks `{ס}` and `{פ}` — there are 3,552, and each
  one shifts everything after it;
- drop the ketiv, which Sefaria prints in round brackets beside the qere in
  square ones; BHSA carries only the word that is read;
- split on whitespace and maqaf, and keep only Hebrew letters.

`src/__tests__/unit/search-lexeme-index.test.ts` asserts that every verse not in
`misaligned` lines up under exactly those rules, so a change to either copy of
them fails the test suite with the offending verses named.

The `root` column of `lexicon.json` is written but no longer read. It existed to
group words into root families for a "related words" suggestion that has since
been removed. It is harmless where it is, and the generator still produces it;
drop it if you ever rebuild the index and want the file smaller.

### What counts as a word

Of those 426,590 units, 121,790 are printed with nothing after them, running
straight into the next. Such a unit is part of a word rather than a word, and it
is not indexed — it contributes no written form and puts no lexeme into its
verse. Every printed word is filed under the lexeme of its last unit, its stem,
so בְּרֵאשִׁית is found under רֵאשִׁית and not under the preposition.

That is why `verse-lexemes.json` says which dictionary words a verse *uses*
rather than which morphemes it contains, and why ו "and" and ה "the" match no
verse at all: they are never words. The prepositions that can carry a pronominal
suffix keep exactly those forms — לוֹ, עָלָיו, בּוֹ are words, and are indexed.

The rule needs one test because no bound unit in BHSA 2021 carries a pronominal
suffix. The generator asserts that and stops if a future release breaks it.

## Regenerating them

One-time setup — Text-Fabric is a Python toolchain, so keep it out of your
system Python, and the BHSA download is about 270 MB:

```bash
python3 -m venv .venv
.venv/bin/pip install text-fabric
.venv/bin/text-fabric ETCBC/bhsa        # downloads into ~/text-fabric-data/
```

Then:

```bash
.venv/bin/python scripts/search/generate-lexeme-index.py
```

The script rewrites all four files in this folder. It checks its own work: it
fails if the verse keys it produced disagree with `../tanakh-structure.json`.
BHSA and Sefaria number the verses identically except in Exodus 20,
Deuteronomy 5 and Numbers 25, and the script carries an explicit mapping for
those three chapters.

## One thing to watch

`normalize()` in the generator and `normalizeHebrewForSearch()` in
`src/search.ts` must fold Hebrew the same way. If they drift apart, every
lookup misses and search silently falls back to whole-word matching. Change one
and you have to change the other.

The same goes for which characters separate one word from the next — maqaf,
paseq, sof pasuq and nun hafukha. The generator's `SEPARATORS` and the set
`normalizeHebrewForSearch()` turns into spaces have to hold the same four
codepoints, and the word boundaries above are only true while they do. There is
a test for it now, in `search-lexeme-index.test.ts`.
