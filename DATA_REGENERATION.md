# Data Regeneration Guide

Most data comes from [Sefaria](https://www.sefaria.org/):

- **Verse texts**: [Sefaria-Export](https://github.com/Sefaria/Sefaria-Export) GitHub repository
- **Structure data**: Sefaria `/api/shape/` endpoint
- **Commentary links**: Sefaria Links CSV exports

The Hebrew lexeme index behind root-mode search comes from the
[ETCBC BHSA](https://github.com/ETCBC/bhsa) database instead.

## Verse Texts

```bash
# Download all verse texts (~10MB)
bash scripts/download-texts.sh

# Bundle verse texts into single file (required after downloading)
npx tsx scripts/bundle-texts.ts
```

## Structure Data

```bash
# Regenerate structure from Sefaria API
node scripts/fetch-tanakh-structure.js > public/data/tanakh-structure.json
```

## Hebrew Lexeme Index

Root-mode search needs to know which dictionary word each written form can be.
That comes from the ETCBC BHSA database, read through Text-Fabric.

### First-time setup

```bash
# Text-Fabric is a Python toolchain; keep it out of your system Python
python3 -m venv .venv
.venv/bin/pip install text-fabric

# Download BHSA (~270MB) into ~/text-fabric-data/
.venv/bin/text-fabric ETCBC/bhsa
```

### Generate the index

```bash
.venv/bin/python scripts/generate-lexeme-index.py
```

This writes four files into `public/data/`:

| File | What it holds |
| --- | --- |
| `lexicon.json` | one row per dictionary word: display form, English gloss, part of speech, language, root |
| `word-lexemes.json` | written form → the dictionary words it can be, likeliest first |
| `verse-lexemes.json` | verse key → the dictionary words occurring in it |
| `verse-morphology.json` | every word occurrence with its grammatical parsing; not loaded by search |

The script checks its own output: it fails if the verse keys it produced disagree
with `tanakh-structure.json`. BHSA and Sefaria number the verses identically
except in Exodus 20, Deuteronomy 5 and Numbers 25, and the script carries an
explicit mapping for those three chapters.

## Text Dating Data

```bash
# Regenerate text dating data (requires data/text-dating-source.json)
npm run generate:text-dating
```

## Commentary Counts

**IMPORTANT: Use the v2 script** - the old `process_sefaria_links.py` is deprecated.

### First-time setup (download CSV files):

```bash
mkdir -p data/sefaria-links
cd data/sefaria-links
for i in {0..12}; do
  curl -O "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/links/links$i.csv"
done
cd ../..
```

This downloads ~470MB of CSV files.

### Generate commentary counts:

```bash
python3 scripts/process_sefaria_links_v2.py
```

### What v2 does differently:

- **Drops "Tanakh" category** - verse cross-references were confusing
- **Filters Talmud** - shows only direct text references (not Steinsaltz, Rashi on Talmud, etc.)
- **Uses local CSV files** from `data/sefaria-links/` instead of downloading on each run
- **Result:** Closer match to Sefaria's website counts (e.g., Exodus 23:5 shows 24 Talmud vs 28 on Sefaria)

### Data Staleness

The CSV files from Sefaria-Export are updated periodically (typically every few months). Our commentary counts will be behind Sefaria's live website by however long since the last CSV export.

This is an acceptable trade-off for having fast, offline-capable data. To update to the latest counts, re-download the CSV files and re-run the script.
