# Data Regeneration Guide

Most data comes from [Sefaria](https://www.sefaria.org/):

- **Verse texts**: the Sefaria export bucket, `gs://sefaria-export`
- **Structure data**: Sefaria `/api/shape/` endpoint
- **Commentary links**: Sefaria Links CSV exports, from the same bucket

Sefaria used to serve its whole corpus out of the
[Sefaria-Export](https://github.com/Sefaria/Sefaria-Export) git repository. In
September 2026 the texts moved to a public Google Cloud Storage bucket and the
repository was reduced to an index (`books.json`) and some helper scripts, so
the old `raw.githubusercontent.com` URLs now return 404. Everything below reads
from the bucket, which needs no credentials.

The Hebrew lexeme index behind root-mode search comes from the
[ETCBC BHSA](https://github.com/ETCBC/bhsa) database instead.

## Verse Texts

```bash
# Download all verse texts (~10MB)
bash scripts/download-texts.sh

# Bundle verse texts into single file (required after downloading)
npx tsx scripts/bundle-texts.ts
```

### Which editions

Both editions are named explicitly in `scripts/download-texts.sh`:

| Language | Edition | License |
|---|---|---|
| Hebrew | Miqra according to the Masorah | CC BY-SA |
| English | THE JPS TANAKH: Gender-Sensitive Edition | CC BY-NC |

We do not use Sefaria's `merged` files. A merged file is not an edition: it
fills each verse from whichever version ranks highest for that verse. That
means its contents can change with no change on our side, and it can hand you a
different edition from one book to the next. The map used to ship merged
English, which was three different JPS editions stitched together at invisible
seams, with a Portuguese translation sitting in the pool as an eligible
candidate.

Because the edition is pinned, `scripts/bundle-texts.ts` checks each downloaded
file's `versionTitle` against the expected name and stops the build if it does
not match. If you want to change editions, change the names in both files. The
bucket strips the colon out of filenames, so the English download URL says
`THE JPS TANAKH Gender-Sensitive Edition` while the name inside the file keeps
it — the two files differ on purpose.

Switching the English edition changes search results, since the English index is
built from this text at load time. Saved search links will not mean the same
thing afterwards.

## Structure Data

```bash
# Regenerate structure from Sefaria API
node scripts/fetch-tanakh-structure.js > public/data/tanakh-structure.json
```

## Hebrew Lexeme Index

Root-mode search needs to know which dictionary word each written form can be.
That comes from the ETCBC BHSA database, read through Text-Fabric.

The four files live in `public/data/search/`, and
**[public/data/search/README.md](public/data/search/README.md)** is the full
account: where BHSA comes from, what each file holds, and how to set up
Text-Fabric the first time. Once that setup is done:

```bash
.venv/bin/python scripts/search/generate-lexeme-index.py
```

## Text Dating Data

```bash
# Regenerate text dating data (requires data/text-dating-source.json)
npm run generate:text-dating
```

## Commentary Counts

### First-time setup (download CSV files):

```bash
mkdir -p data/sefaria-links
cd data/sefaria-links
for i in {0..12}; do
  curl -O "https://storage.googleapis.com/sefaria-export/links/links$i.csv"
done
cd ../..
```

This downloads ~470MB of CSV files.

### Generate commentary counts:

```bash
python3 scripts/process_sefaria_links.py
```

### What the script does:

- **Drops the "Tanakh" category** - verse cross-references were confusing
- **Filters Talmud** - shows only direct text references (not Steinsaltz, Rashi on Talmud, etc.)
- **Reads local CSV files** from `data/sefaria-links/` rather than downloading on each run
- **Result:** Closer match to Sefaria's website counts (e.g., Exodus 23:5 shows 24 Talmud vs 28 on Sefaria)

### Data Staleness

The CSV files in the export bucket are regenerated monthly. Our commentary counts will be behind Sefaria's live website by however long since the last CSV export.

This is an acceptable trade-off for having fast, offline-capable data. To update to the latest counts, re-download the CSV files and re-run the script.
