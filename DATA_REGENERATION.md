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

Every source named here is also credited in the app, in the Credits tab of the
help modal. The collection dates shown there are hand-maintained strings in
`src/credits.ts`: no data file carries a generation timestamp, and a git commit
date cannot stand in for one, because a commit that merely moves or refactors a
data file would claim it had been re-collected that month. **Whenever you run
one of the commands below, set that source's `collected` date.** A source with
no `collected` line shows as "collection date not recorded" rather than
guessing; add the field when you are the one collecting.

## Verse Texts

```bash
# Download all verse texts (~10MB)
bash scripts/download-texts.sh

# Bundle verse texts into single file (required after downloading)
npx tsx scripts/bundle-texts.ts
```

Then set `collected` for both editions in `src/credits.ts`.

### Which editions

Both editions are named explicitly in `scripts/download-texts.sh`, which also
explains why we don't use Sefaria's `merged` files.

| Language | Edition | License |
|---|---|---|
| Hebrew | Miqra according to the Masorah | CC BY-SA |
| English | THE JPS TANAKH: Gender-Sensitive Edition | CC BY-NC |

The map used to ship merged English, which turned out to be three different
JPS editions stitched together at invisible seams, with a Portuguese
translation sitting in the pool as an eligible candidate.

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

The verse counts have no credit row of their own, so there is no date to
update here.

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

Then set the BHSA `collected` date in `src/overlays/search.ts`.

Afterwards, check what the new index can name:

```bash
npm run report:click-resolution
```

It walks every word of every verse, asks which dictionary word each one is in
its verse, and prints the split against the baseline in
`scripts/search/click-resolution.json`. A regeneration that quietly drops a part
of speech shows up here as a share that moved and nowhere else. When the move is
one you meant, re-record it with `--save` and commit the baseline alongside the
index.

## Haftarah Readings

Which passage is read on which occasion comes from hebcal's leyning tables,
vendored as three files in `data/overlays/haftarah/hebcal/`.
**[data/overlays/haftarah/hebcal/README.md](data/overlays/haftarah/hebcal/README.md)**
is the full account: the
commit they were taken from, how to read an entry, and the curl commands that
refresh them. Once the files are refreshed:

```bash
npx tsx scripts/overlays/haftarah/generate.ts
```

Then set the hebcal `collected` date in `src/overlays/haftarah.ts`.

The names are not hebcal's, and they live in `data/overlays/haftarah/names.json`
rather
than in the generator: the 54 portions in reading order, then the 29 occasions,
each with the key to find it under in the leyning tables. Edit that file to
change a label; the generator refuses to run on a blank name, an unknown
category or a duplicate, and says which row is at fault.

The portion names come from Sefaria, out of the Parasha structure in its schema
export — `schemas/Genesis.json` and the other four books, under
`https://storage.googleapis.com/sefaria-export/`. Only three rows need to say
what hebcal calls the portion, because everywhere else the two agree. The
occasion names are our own; no source publishes a canonical list of them.

Expect the tests to speak up. `src/__tests__/unit/overlays/haftarah-data.test.ts` pins
several readings by name, so if hebcal has changed its mind about one of them
the test fails and tells you which. That is the intended way to find out;
decide whether to follow the change before editing the test to match.

## Text Dating Data

```bash
# Regenerate text dating data (requires data/text-dating-source.json)
npm run generate:text-dating
```

This reads the hand-curated ranges in `data/text-dating-source.json` rather than
fetching anything, so it does not change when the Wikipedia article behind those
ranges was last consulted. Set `collected` in `src/overlays/text-dating.ts` only
if you actually revisit the article.

## Commentary Counts

### Refreshing

```bash
scripts/overlays/commentary/refresh.sh
```

That is the whole procedure. Everything this overlay downloads lives under
`data/overlays/commentary/`, and what it produces lives under
`public/data/overlays/commentary/`. The script asks the bucket how many files
the export has, downloads any that are missing or stale into `sefaria-links/`,
fetches Sefaria's index of the library to `sefaria-index.json`, regenerates
`counts.json`, and prints what moved. Pass `--force` to re-download files that
are already present.

Sefaria re-exports on the 1st of each month, and the script prints the export
date it found, so there is nothing to gain by running this more than monthly.

Set the `collected` date in `src/overlays/commentary.ts` to the export date the
script printed. That is what the Credits tab shows, and it is the date of the
export rather than of the run.

The CSVs total about 650MB and the index is 4MB. Both live under `data/` and
both are gitignored, so a fresh clone downloads all of it; a second run
re-downloads only the CSVs that changed, and always re-fetches the index, which
is small and has to describe the same library the links describe.

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

```bash
python3 scripts/overlays/commentary/verify-against-sefaria.py
```

Samples verses against Sefaria's live site and reports how close the counts
are; read its own docstring for what a healthy result looks like and what an
outlier means.

The script used to run 7% to 47% *above* the site, varying verse by verse in a
way nobody could explain. That was commentaries being counted under the shelf
they are filed on rather than as commentaries: Sefaria's Mishnah figure for
Genesis 1:1 was 4 and ours was 64, of which 63 were commentaries on Pirkei
Avot. Reading each text's category out of Sefaria's index closed it.

### What the generator does

Two functions in `scripts/overlays/commentary/process_sefaria_links.py` carry
all the judgement, and their docstrings are the full account: `resolve_shelf()`
decides what a work actually is — a commentary is filed under the shelf of
whatever it comments on, not under "Commentary" — and `link_bucket()` decides
whether a link is commentary on the verse or a citation of it in passing. Read
both, and `parse_verse_refs()` for how a range of verses is counted, before
changing anything here.

### Read the totals it prints

The generator prints how many links landed in each category, and names any
category that got none. This is worth a glance every refresh. `Commentary` sat
in the category list for months with zero links in it, because every commentary
was arriving under the Tanakh label and being thrown away, and nothing said so.

### Data staleness

Our counts trail Sefaria's live site by however long it has been since the last
monthly export, plus however long since we last ran the refresh. That is an
accepted trade for fast, offline-capable data.

The gap is not negligible. Between the January 2026 and September 2026 exports
the total link count grew 24%, unevenly: Jewish Thought more than doubled while
Midrash grew 22%. The shape of the heatmap moves, not just its scale.
