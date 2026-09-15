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
scripts/refresh-commentary-counts.sh
```

That is the whole procedure. The script asks the bucket how many files the
export has, downloads any that are missing or stale into `data/sefaria-links/`,
fetches Sefaria's index of the library to `data/sefaria-index.json`,
regenerates `public/data/commentary-counts.json`, and prints what moved. Pass
`--force` to re-download files that are already present.

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
python3 scripts/verify-against-sefaria.py
```

This samples twenty-six verses across Torah, Nevi'im and Ketuvim and compares
each against Sefaria's live site. It reports rather than judges: read the shape
of the numbers, not any one of them.

The counts we generate are not expected to match Sefaria's live site exactly —
the script drops translations, dictionary lookups and cross-references by
design, and the export is up to a month behind. What they should be is
*consistently* close.

A healthy refresh sits at or just below the live `/api/related` totals on every
category, across verses from all three sections — within a few percent, since
the only thing separating us from the site on those categories is how old the
export is.

What is worth chasing is a verse that has come adrift from its neighbours, which
the script names for you. The export is split alphabetically by source text, so
an incomplete download takes out a coherent slice of the library rather than a
random sample: a few verses land far from the site while the ones beside them
sit at zero. If several outliers share a part of the library, suspect the
download before the data.

The script used to run 7% to 47% *above* the site, varying verse by verse in a
way nobody could explain. That was commentaries being counted under the shelf
they are filed on rather than as commentaries: Sefaria's Mishnah figure for
Genesis 1:1 was 4 and ours was 64, of which 63 were commentaries on Pirkei
Avot. Reading each text's category out of Sefaria's index closed it.

### What the generator does

Two functions in `scripts/process_sefaria_links.py` carry all the judgement.
Read them before changing anything here.

**`resolve_shelf()` asks what a text actually is.** The links export labels
each side of a link with the shelf the text is filed on — and a commentary is
filed on the shelf of whatever it comments on. Rashi comes back as Tanakh. Ben
Yehoyada on Sanhedrin comes back as Talmud. Derekh Chayyim, the Maharal on
Pirkei Avot, comes back as Mishnah. Counting those under the shelf they are
filed on means a category called Mishnah is mostly not the Mishnah.

Sefaria publishes the answer. `data/sefaria-index.json` gives every text a
`primary_category` — `Commentary`, `Targum`, `Talmud`, `Mishnah` and so on —
and it is the same field the website itself uses. The export usually names a
node inside a book (`Midrash Lekach Tov, Genesis`) where the index names the
book, so trailing section names come off one at a time until something matches.

One shelf needs a correction the index does not make. Sefaria keeps the
thirty-nine books and a handful of modern commentaries together under Tanakh,
and marks only some of the commentaries as commentaries — David Zvi Hoffmann on
Exodus, Steinsaltz's introductions and Nechama Leibowitz arrive as plain
Tanakh. A title on that shelf that is not simply a book's name is one of those.
What is left is the books themselves, so a link from a verse to one of them is
a cross-reference between two verses, and is dropped.

The test is the whole title, never its opening words. Several books are named
after people, and other works begin with those names without being them:
`Esther Rabbah` is a midrash on Esther, `Ruth Rabbah` a midrash on Ruth, and
`Ezra ben Solomon` a kabbalist who wrote about Song of Songs. Matching on a
prefix would pull 2,569 links out of Midrash and Commentary.

A string test on the title was tried and rejected. Reading `X on Y` as "a
commentary on Y" misclassifies about 166,000 links: it wrongly catches
`Yalkut Shimoni on Torah` (16,190 links — a midrash in its own right),
`Midrash Tannaim on Deuteronomy` and every `Targum Jonathan on <book>`, while
missing Rabbeinu Bahya, Chizkuni, Siftei Chakhamim, Mizrachi, Malbim and
Derekh Chayyim, none of which have "on" in the title.

**`link_bucket()` decides what a link means.** A commentary can either be
writing about this verse or citing it in passing, and the export's connection
type says which — the same column Sefaria reads to split its own Commentary and
Quoting Commentary sections:

| the work is | connection type | bucket |
|---|---|---|
| a commentary | `commentary` | **Commentary** — written about this verse |
| a commentary | anything else | **Quoting Commentary** — cited while writing about something else |
| a translation | — | dropped |
| anything else | — | its own shelf: Talmud, Midrash, Mishnah, … |

When Abarbanel, in the middle of his commentary on Amos, reaches for Genesis
49:28, that is a real fact about Genesis 49:28 — but it is not commentary on
it, and a map of which verses commentators reach for is a different map from
one of which verses they write about. Both count towards the total.

Quoting Commentary is not confined to commentaries on the Tanakh: a Zohar
commentary, a Talmud commentary and a commentary on Pirkei Avot can all cite a
verse, and all of them land here.

Dropped on purpose:

- **Translations.** Nearly every verse has one, the Torah has three, and the
  books already written partly in Aramaic have none — so counting them maps
  which books were translated rather than anything about the verses.
- **Dictionary lookups**, the `Reference` shelf: BDB, Jastrow, Klein, Sefer
  HaShorashim. A quarter of all links to verses, recording which words a verse
  contains rather than what anyone wrote about it.
- **Verse-to-verse cross-references**, which is what the original rule was
  aimed at. About twelve thousand of them — against six hundred thousand
  commentary links that were being discarded alongside, until this was fixed.
- **Citations covering more than ten verses**, which name a whole portion
  rather than a passage — see below.

There used to be a hand-written list of Talmud commentaries here, so that the
Talmud figure would mean Talmud text. It has been deleted. A list maintained by
hand is wrong the moment Sefaria adds a text, and this one was: `Ben Yehoyada
on Sanhedrin` was never on it, so 1,406 links were counted as Talmud. The index
knows without being told.

Also:

- **Reads local files** from `data/` rather than downloading each run
- **Counts each link once**, deduplicating the two directions of a bidirectional link
- **Spreads short ranges, drops long ones** — see below

### Read the totals it prints

The generator prints how many links landed in each category, and names any
category that got none. This is worth a glance every refresh. `Commentary` sat
in the category list for months with zero links in it, because every commentary
was arriving under the Tanakh label and being thrown away, and nothing said so.

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
