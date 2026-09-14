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
| `verse-morphology.json` | Every word occurrence in text order with its lexeme and its grammatical parsing. Kept for a future grammatical-form filter; search does not load it. |

Lexemes are referred to throughout by their position in the `lexicon.json`
array rather than by name, which is what keeps the two per-verse files small.

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
