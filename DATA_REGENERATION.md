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

### Refreshing

```bash
scripts/refresh-commentary-counts.sh
```

That is the whole procedure. The script asks the bucket how many files the
export has, downloads any that are missing or stale into `data/sefaria-links/`,
regenerates `public/data/commentary-counts.json`, and prints what moved. Pass
`--force` to re-download files that are already present.

Sefaria re-exports on the 1st of each month, and the script prints the export
date it found, so there is nothing to gain by running this more than monthly.

The CSVs total about 650MB. `data/sefaria-links/` is gitignored, so a fresh
clone downloads all of it; a second run re-downloads only what changed.

### Do not hardcode the file count

The export had thirteen files (`links0`–`links12`) for a long time and now has
seventeen. The old instructions here looped over `{0..12}`, and after the count
grew that fetched a partial corpus — which still processed cleanly and produced
a counts file that looked entirely normal.

It was not normal. The CSVs are split alphabetically by source text, so the
missing files were a coherent slice of the library rather than a random sample.
Kabbalah counts in Psalms fell by 87% while Genesis was barely touched, because
the Zohar sorts near the end of the alphabet. Nothing in the output said so.

This is why the script discovers the count instead of assuming it. If you fetch
the files by hand, count them first.

### Checking the result is sane

The counts we generate are not expected to match Sefaria's live site exactly —
the script drops Tanakh cross-references and filters Talmud by design, and the
export is up to a month behind. What they should be is *consistently* close.

A healthy refresh sits at or slightly above the live `/api/related` totals for
the categories that map cleanly onto ours, across verses from all three
sections. Counts scattered in both directions — some verses far under live,
others far over — mean something is wrong with the inputs, not that the data is
stale. Staleness is uniform and always undercounts; a partial corpus is not.

### What the generator does

- **Drops the "Tanakh" category** — verse cross-references were confusing
- **Filters Talmud** — direct text references only, not Steinsaltz or Rashi on Talmud
- **Reads local CSVs** from `data/sefaria-links/` rather than downloading each run
- **Counts each link once**, deduplicating the two directions of a bidirectional link
- **Spreads short ranges, drops long ones** — see below

### How a range of verses is counted

A citation can name one verse (`Genesis 1:2`), a passage (`Deuteronomy 6:4-9`),
or a sweep of text so large it is really an index entry (`Genesis 1:1-6:8`, the
whole of Bereshit).

A citation covering **ten verses or fewer** counts towards every verse it
covers, so a comment on the Shema credits all six of its verses. A longer one is
ignored completely: "all of Psalm 76" is no more a claim about a particular
verse than "all of Bereshit" is, and crediting it anywhere invents a
concentration of commentary that is not there.

The cutoff is not delicate. Half of all ranges are five verses or fewer and a
fifth cover more than a hundred, so anything between five and twenty produces
essentially the same map; ten sits in the empty middle.

The generator used to credit a whole range to its first verse. That put 46,000
citations on the opening verses of weekly portions, and after the September
refresh it made Deuteronomy 11:26 the brightest point on the map at 2,525 links
— purely because Re'eh begins there. Since the heatmap is normalised to its
maximum, that one verse flattened everything else.

### Data staleness

Our counts trail Sefaria's live site by however long it has been since the last
monthly export, plus however long since we last ran the refresh. That is an
accepted trade for fast, offline-capable data.

The gap is not negligible. Between the January 2026 and September 2026 exports
the total link count grew 24%, unevenly: Jewish Thought more than doubled while
Midrash grew 22%. The shape of the heatmap moves, not just its scale.
