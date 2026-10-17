# English for the Talmud

**Status:** Decided, 2026-10-16 (see Decisions, at the end). The popup is built, on branch
`talmud-english-popup`, from `worktree-talmud-search` (#390). English search is not.

The Talmud's popup has no English, and its search reads only Hebrew and Aramaic. Sefaria's
William Davidson English (the Koren translation, with Rabbi Steinsaltz's explanation woven in)
can supply both. This document checks that the English fits the map, proposes how the popup
shows its bold literal translation, and measures five ways to search it.

All figures were measured on all 37 tractates, by two one-off scripts that are in this
document's first commit and removed since; the bundle now checks the English's shape itself. Timings are Node 24 on an Apple M4 Pro, the median of five runs; a phone
will be slower, by how much I have not measured. Anything not measured is marked as a guess.

## The English fits the map

Every one of the 81,793 segments in the map has its English, in the same place, in all 37
tractates. Two checks:

- **Shape.** Every tractate has the same amudim in both editions, with the same number of
  segments in each. The only gaps are 312 Hadran lines (the line that closes a chapter), which
  have no English: 215 are empty strings, and 97 are the last segment of an amud, which the
  English array simply leaves off.
- **Content.** Where the Hebrew opens a Mishnah or Gemara (`מתני׳`, `גמ׳`), the English segment at
  the same place says MISHNA or GEMARA: 4,207 places agree. The 11 that do not are labelling
  quirks, with the right text in the right place: Tamid's last chapters number each mishnah in
  English but not in Hebrew (8), and three segments where one edition labels a Gemara and the
  other does not (Sotah 49b:4, Keritot 14b:1, Meilah 14a:1).

So the English can be stored segment for segment beside the Hebrew, with an empty string for the
Hadran lines.

The licence is CC-BY-NC, so the credit line the Davidson Aramaic already has (commit 37183eca)
needs to name the English too.

## Showing the bold

The English is HTML. `<b>` marks the literal translation, and plain text is the explanation:
37% of all characters are bold (44% in Berakhot). There are also `<strong>` for the MISHNA and
GEMARA labels, `<i>` for transliterated words (107,588 of them), `<br>`, and six
`<span class="gemarra-regular">` in Berakhot that mark translation the way `<b>` does. One
segment has an unclosed tag (`<strong>MISHNA:<strong>`). There are no HTML entities.

**Proposal: convert at build time; never put the data's HTML into the page.** The bundle script
turns each segment into a list of strings that are plain and bold by turns, starting with plain
(which may be empty):

```json
["", "The Rabbis say:", " The time for the recitation of the evening ", "Shema", " is ", "until midnight."]
```

Plain JSON strings, so nothing in the data can become markup. The builder fails on any tag
outside a short list (`b`, `strong`, `i`, `br`, that one `span`) and on an unclosed tag, so a
change upstream is caught rather than shown. The one unclosed `<strong>` gets fixed in the
converter.

In the popup, the shell joins the strings into the plain text, and the bold stretches become
character ranges. Search marks the plain text exactly as it does today
(`highlightItemText`, `packages/shell/src/sidebar.ts:207`). The bold then goes on over the marks
with `wrapRuns` (`packages/shell/src/textRuns.ts`), the helper `linkStretches` already uses to lay
Tanakh links over search marks in the Hebrew. It walks the text nodes inside each mark, so a hit
that crosses into or out of bold stays one mark, with a `<b>` on each side of the edge. Every node
is made with `createElement` and text nodes.

`PopupText` gets one optional field beside `english`, for the bold ranges, like `hebrewLinks`
beside `hebrew`. Italics could be a third kind of run later; the measurements below drop them.

**Where it lives.** Each tractate's English goes into its popup file,
`public/data/talmud/texts/<tractate>.json`, which only downloads when a reader opens a segment in
that tractate.

| Popup English, per tractate file | All 37, gzip -9 | Largest (Shabbat) |
| --- | --- | --- |
| Markers, `*bold*` and `_italic_` (built; see Decisions) | 12.15 MB | 0.71 MB |
| Alternating strings (proposed) | 12.37 MB | 0.72 MB |
| Text plus bold offsets | 14.26 MB | 0.83 MB |
| Today's Hebrew file, for comparison | | 0.25 MB |

So opening a segment in Shabbat for the first time costs about 0.7 MB more than today.

## Searching it

**What a visitor downloads.** Cloudflare compresses static files itself, at about gzip -9's
ratio. I measured it on the Tanakh's `all-texts.json` from torahmap.org: it served 2.61 MB of
brotli, while gzip -9 gives 2.66 MB and brotli at its highest setting 1.77 MB. So the gzip -9
column is the realistic download. The brotli column is the floor, if we compressed the file
ourselves; I have not checked whether Workers static assets will serve a pre-compressed file.

For scale, the Hebrew search file `public/data/talmud/search.json` is 3.97 MB at gzip -9, and
loads behind the map on every visit.

**The queries.** `shema` (a word), `rabbi yoḥanan` (a two-word phrase), `the` (in 98% of
segments), `bless` as a substring, and `ox that gored` (a phrase).

### The options

| | Download (gzip -9) | Brotli 11 | When it loads | Query | Memory | Whole word | Substring | Phrase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **a.** Full text on the client | 11.01 MB | 7.69 MB | behind the map, or on the first English term | 14–67 ms | 178 MB | yes | yes | yes |
| **b.** Bold translation only, on the client | 4.58 MB | 3.23 MB | same | 10–34 ms | 85 MB | yes | yes | yes |
| **c.** Word index on the client, nothing dropped | 3.30 MB | 2.91 MB | same | under 0.1 ms, 1 ms for substring | about 20 MB (guess, from the next row) | yes | inside a word | all its words in one segment |
| **c.** Word index, 100 commonest words dropped | 2.45 MB | 2.21 MB | same | same | 18 MB | not those 100 words | inside a word | same |
| **d.** Server side: SQLite full-text search in D1 | 0 | | per query | 0.1–68 ms in SQLite, plus a round trip | none on the client | yes | word starts only | yes |

"Memory" is the JavaScript heap after loading and indexing, in Node. For comparison, the Hebrew
search text takes about 73 MB measured the same way. Loading a full-text file also means parsing it: 157 ms for
(a), 62 ms for (b), on the main thread. Decoding (c) takes 27 ms.

**a. Full text on the client.** This is what the Hebrew does now, and the code exists: the
Talmud's `LANGUAGES` gains `english` (it is already in `packages/search`), and each search entry
carries `{ he, en }`. Every mode works, and result snippets come free. The cost is size: almost
three times the Hebrew file, and 178 MB of memory, which is a real risk on a phone.

**b. Bold only.** Less than half of (a), with every mode still working. It searches only the
literal translation, which finds about half as much: `shema` 198 segments against 420, `ox that
gored` 8 against 34, `rabbi yoḥanan` 4,094 against 5,172. Whether that is a loss or a gain is
Danyel's call (see the questions below).

**c. Word index.** Each word, followed by the segments it is in, as gaps between segment numbers
in variable-length bytes. The vocabulary is 31,415 words, a third of them in one segment only.

- *Dropping common words saves less than it costs.* Dropping the top 100 saves 0.85 MB, but the
  top 100 includes `rabbi` (37% of segments), `rav`, `gemara`, `mishna`, `baraita`, `halakha`,
  `sages`, `yehuda`, `offering` and `verse`, and the top 200 includes `shabbat`. Dropping only
  true function words (`the`, `of`, `to`, `is`, `and` ...) from a hand-written list is the better
  cut, if any; I have not measured it.
- *Substring survives inside a word.* Scanning the vocabulary for words containing `bless` and
  joining their segments takes 1 ms and finds exactly the 2,520 segments the full-text scan does.
  What is lost is a substring that crosses a space.
- *Phrases become "all these words in one segment".* For `rabbi yoḥanan` that finds 5,377
  segments against 5,172 that hold the phrase; for `ox that gored` (with `that` dropped), 142
  against 34. An index of every pair of neighbouring words would fix two-word phrases, but it
  measures 12.27 MB, more than the full text.
- *Snippets need the text.* The results list quotes each hit. With only an index, it can quote
  hits in tractates whose popup file is loaded, and list the rest by reference, which the list
  already does when it has no snippet (`packages/search/src/resultsList.ts:54`).
- *New code.* `packages/search` finds hits by scanning every segment; an index needs a second way
  to find them, and the highlighter must still agree with it on what a word is.

**d. Server side.** The Worker would answer `/api/search?q=…` from a D1 database with SQLite's
full-text search (FTS5), which D1 supports. Today `wrangler.jsonc` binds only static assets and
Analytics Engine; there is no D1, KV or R2.

- *Size and limits.* The database, built locally with Node's SQLite, is 80 MB. D1 allows 500 MB
  per database on the free plan and 10 GB on paid. Holding the text in the Worker itself is out:
  (a)'s index takes 178 MB, and a Worker gets 128 MB. Decoding (c) in the Worker takes 27 ms of
  CPU, against the free plan's 10 ms per request (paid allows up to 5 minutes). Static assets cap each file
  at 25 MiB, and KV each value at 25 MiB.
- *Speed.* The SQLite query itself is fast, 0.1–5 ms, except `the`, at 68 ms for 80,265 rows; the
  server must refuse or cap terms that common, since sending 80,000 ids back is itself a large
  download. The round trip per query I have not measured; my guess is 50–200 ms. Every change to
  a term waits on it.
- *Cost.* D1's free plan reads 5 million rows a day, counted by rows scanned. How FTS5 lookups
  count against that is not documented; I have not measured it. Which plan the account is on, I
  do not know.
- *Dev, previews, offline.* The Vite dev server sends nothing to the Worker. Dev would need
  `wrangler dev` running beside Vite, with Vite proxying `/api/search` to it, against a local copy
  of the database. A second, client-side implementation for dev only would be two ways of doing
  one thing. Pull-request previews would query the production database unless one is set up per
  preview. With no connection, English search stops.
- *Build.* The database is loaded with `wrangler d1 execute` whenever the English changes, a step
  outside Cloudflare's build-on-push, so data could drift from the code that reads it.
- *What it gains.* No download, no memory, every mode except substring inside a word (FTS5
  matches word starts with `bless*`), and the server can write the snippets (FTS5's `snippet()`).

**e. Other options.**

- *Load English search on the first English term,* not behind the map. This applies to (a), (b)
  and (c), and is the biggest saving of all for the visitors who never search English, which is
  most of them: they pay nothing. The first English search waits for the file. A term already
  says which language it is in (`claims` in `packages/search/src/language.ts`), so the shell knows
  when to ask.
- *Compress the file ourselves* with brotli at its highest setting: 7.69 MB instead of 11.01 for
  (a). Unchecked whether static assets will serve it with the right header.

### One bug to fix whatever is chosen

The English whole-word rule (`packages/search/src/english.ts`) finds word edges with `\b`, which
counts only ASCII letters, so `ḥ` (21,880 of them in the English) breaks a word in two: a
whole-word search for `yo` matches inside `Yoḥanan`. The rule needs Unicode letters.

## Recommendation

Do the popup first, on its own: build-time conversion to alternating strings, and bold laid over
search marks with `wrapRuns`. It needs no decision about search, and it costs only the tractate
a reader opens.

For search, start with **(a), loaded on the first English term**. It is the simplest that works:
no new search code, every mode the Hebrew has, snippets included, and nothing downloaded by a
visitor who does not search English. What it costs is 11 MB and 178 MB of memory for the one who
does.

Each step beyond it buys something specific:

- **(b) instead of (a)** halves the download and memory, if search should match only the literal
  translation.
- **(c) instead of (a)** cuts the download to 3.3 MB and memory to about a tenth, and makes queries
  instant. It costs new search code, substring across words, and exact phrases.
- **(d)** makes the download zero and keeps phrases. It costs a database, a dev setup with
  `wrangler dev`, a round trip on every query, and a second place the data has to be kept in
  step.

Before choosing between (a) and (c), I would load (a) on a real phone and see whether 178 MB is a
problem.

## Questions for Danyel

1. Should search match the explanation too, or only the bold translation? (a) or (b).
2. Is it acceptable for English search data to load on the first English term rather than behind
   the map?
3. Should the popup show the explanation at all, or only the bold? Bold is 37% of the
   characters, so showing only the bold would shrink the popup files by more than half.
4. Italics: show the transliterated words in italic, or drop them?
5. Is the Cloudflare account on the free or the paid Workers plan? It decides whether (d), or
   any work in the Worker, is possible.
6. Does a phrase need to match exactly, or is "all these words in one segment" enough? It decides
   whether (c) is good enough.

## Decisions

Danyel's answers, 2026-10-16.

1. **Search matches the bold translation only**, option (b).
2. **English search data loads on the first English search, or at idle after startup.** Search is
   a later piece of work; this records the choice.
3. **The popup shows the full English**, translation and explanation.
4. **Italics are kept, and the format is markers rather than alternating strings.** Each segment
   is one string, with `*` opening and closing bold and `_` italic: two characters per change of
   style, so the italic transliterations cost little.
   - Neither `*` nor `_` occurs anywhere in the English, so they need no escape. The converter
     (`scripts/talmud/english.ts`) fails on a segment that holds one.
   - About 20,000 segments have italic inside bold, and 29 bold inside italic (`<i>hokhe’aḥ
     <b>tokhiaḥ</b></i>`); the two markers are independent, so both nest. `<strong>` and the six
     spans count as bold; bold inside bold is marked once.
   - `<br>` becomes a line break, which the popup keeps.
   - Two places leave a tag unbalanced, not one: Berakhot 54a:1 (`<strong>MISHNA:<strong>`), and
     Pesachim 101a:7, whose last `<b>` is closed at the start of 101a:8. The converter fixes both
     by name and fails on any other.
   - One Hadran line, Arakhin 34a:9, has English (a truncated "We will return to you…"). Every
     Hadran line gets an empty string, as decided, so it is dropped.
   - Size, at gzip -9: 12.15 MB for all 37 tractates' English with italics, against 12.37 MB for
     alternating strings without them (row added to the table above). Without the italic markers
     it would be 12.10 MB, so italics cost 0.05 MB.
   - The popup files grow from 3.91 MB to 16.07 MB in all at gzip -9; the largest, Shabbat, from
     0.25 MB to 0.96 MB.
5. **The Cloudflare account is on the free plan.** Traffic is expected to be very low, and Danyel
   will pay a little if needed. No server work for now.
6. **Phrase search is wanted.** Option (b) on the client already matches exact phrases, which is
   why no server is needed for now.
