# Search Receives Its Data

**Date:** 2026-09-30
**Status:** Design, decided 2026-10-01. Planned: docs/plans/2026-09-30-search-data-implementation.md.

Step 2 of three toward #313. It follows step 1
(`2026-09-30-overlay-data-design.md`) and uses its interface as written: search
names its files in `data`, members take `data: D` or `D | null`, main loads
into `loaded`, and `dataFor(searchTool, loaded)` hands search its files.

Like step 1, this changes nothing a reader sees. Startup still waits for every
file; the `null` cases below exist in the types now and are first reached in
step 3.

## Where search keeps its data today

`src/search.ts` holds the text index and the dictionary in module variables,
filled by `buildSearchIndex` and `loadLexiconData`. `src/search/dictionary.ts`
holds the per-word parse, whether it has finished loading, and which verse is in
the popup (`setVerseOnScreen`). Every function reads them, so a test has to fill
them first, and the answer of a plain-looking call such as `meaningsFor('עלה')`
depends on what ran before it.

A search term also stores its meanings, looked up when the term was made. A term
made before the dictionary has none, and stays that way. This is what made #320
add a field for a link's choice of meaning and a function to look terms up again
when the dictionary arrived.

## The files and what is built from them

Search declares:

```ts
data: {
  texts: 'all-texts.json',
  lexicon: 'search/lexicon.json',
  forms: 'search/word-lexemes.json',
  verseLexemes: 'search/verse-lexemes.json',
  parse: optional('search/verse-morphology.json'),
}
```

**The per-word parse is optional.** It is 1 MB compressed, search works without
it (it only tells which of a spelling's readings a word in the popup is), and in
step 3 it loads last. Step 1 has no optional files; this adds them. In `D` an
optional file is `T | null`, and `dataFor` does not wait for it. This is the one
change to step 1's interface besides the `verse` argument below.

Three values are built from the files, each a plain function of them:

| Value | Built by | From | Holds |
|---|---|---|---|
| The text index | `buildTextIndex(texts)` | the texts | each verse folded for matching, and the verse-key lookup |
| The dictionary | `buildDictionary(lexicon, forms, verseLexemes)` | the three dictionary files | the lexemes, written form → lexemes, verse → lexemes, lexeme → verses, spelling → lexemes, key → lexeme |
| The parse | `buildParse(file)` | the per-word parse | the parsed verses and the misaligned set |

Each is kept per value of the file it comes from (a `WeakMap` on the parsed
file), not per `D`. So the parse arriving makes a new `D` without rebuilding the
text index, and trop, verse length and search share one text-file value without
sharing an index they do not need. `prebuild(data)` builds the text index and
the dictionary at idle; a member asked first builds them on demand, with the
same result.

The 23,000-verse search results are memoised per text index and dictionary, then
per settings, so the same settings with a different dictionary are never handed
the old answer.

## Partial data

**Search is all or nothing.** Its data is `null` until the texts and
all three dictionary files are in.

Meanings mode could colour the map from the dictionary alone: the verse sets
come from lexeme → verses, and only the results list's snippets need the texts.
But a search mixing a Hebrew word with an English one, or a Hebrew word the
dictionary does not know, needs the texts, so some terms would colour and
others follow a second or two later, each with its own fade. What this buys is
that a Hebrew-only search link colours about one texts download sooner (2.7 MB
compressed, the largest file). Not worth a second way for search to be half
there. Revisit if step 3's throttled tests show Hebrew search links waiting
noticeably on the texts.

**A failed dictionary download turns search off**, where today search falls back
to matching words by their spelling. Main does not know what a file means, so
it cannot tell search "the dictionary failed" apart from "the dictionary has not
come". Keeping the fallback would need `loaded` to record failures and search a
third state, for a rare failure of a download from our own site.

## A search term

A term stores what the reader typed or the link said, and nothing looked up:

```ts
interface SearchTerm {
  id: string;
  text: string;
  colorIndex: number;
  mode: SearchMode | null;
  /** The meanings chosen, as dictionary keys; null when every meaning is. */
  chosen: string[] | null;
}
```

`meanings` and `selected` go. A term's meanings are `meaningsFor(dictionary,
text)`, memoised per dictionary and text, so the rows a panel draws are the same
objects from one draw to the next.

**"Every meaning checked" is `null`**, so it needs no list of meanings to say it.
A link without `m`, a typed word, and a term whose meanings are not known yet
are all `null`. A row counts as chosen when `chosen` shares a key with it
(`sameMeaning`), the rule the word menu already relies on. Choosing every row
again sets `null` back. If `chosen` names no row the term has, every row counts
as chosen, as `applyMeanings` does today.

**The `m` link parameter keeps its format and becomes a straight copy.** Reading
a link sets each term's `chosen` to its entry, split on `|`; writing one joins
`chosen`. Neither needs the dictionary. A narrowed link opened before the
dictionary keeps its `m` in the address and in the term, and the checkboxes show
it once the dictionary is in. Nothing waits and nothing is applied later: there
is no later step.

**Click-to-search no longer needs the dictionary to make its term.**
`searchForMeaning(settings, text, keys)` sets `chosen` to the keys of the row
picked in the word menu. That row can be headed by a different key than the
term's own row for the same reading, which is why every comparison goes through
`sameMeaning` and never through first keys.

`selected`'s first-key convention goes with it. It was the source of the
mismatch `sameMeaning`'s comment describes, and `chosen` has no first key.

## Who gets what

Main hands each reader of search what it reads; none reaches for it.

| Reader | Gets | Today reads |
|---|---|---|
| Map colours, hover text, legend summary | `data` via `toolsShown` | module state |
| Search panel: term rows, caption, results list, snippets | `data \| null` via `renderControls` | module state |
| Verse highlighting in the popup | `data`, and the verse | module state, and `setVerseOnScreen` |
| Word menu (main's word-click handler) | the dictionary and parse from `dataFor(searchTool, loaded)` | module state |
| Story blender | `loaded`, as step 1 | — |
| Recording | see below | the overlay's module state |

**Highlighting needs the verse, not only its text.** It marks a word by its place
in the verse, through the parse, and the parse is looked up by verse. Today the
popup names the verse in module state (`setVerseOnScreen`) because
`highlightVerseText` is handed only the text. So `highlightVerseText`
takes the verse as its first argument, like `getHoverInfo`. That removes
`setVerseOnScreen`, `verseOnScreen`, the morphology loading flags and the
popup's redraw-when-the-parse-arrives promise from `sidebar.ts`: main redraws the
popup when the parse lands, as it does for any file.

With search's data `null` the panel shows the terms as typed and their modes,
with no meanings, counts, caption or results. The word menu needs the
dictionary; until it is in, words in the popup are not clickable, and the popup
is redrawn with clickable words when it lands (step 3).

## Recording

Today the search overlay records a search one second after the reader stops
changing it, and decides in module state which changes were the reader's.

A recorder made once by main, in `src/overlays/search/recording.ts`
beside `termsToRecord`:

```ts
const recorder = createSearchRecorder({ delayMs: SEARCH_RECORD_DELAY_MS, send: trackSearchExecute });
recorder.readerChanged(settings, data);  // main's changeSearch, the word menu
recorder.replaced(settings, data);       // a link or a story stop; cancels anything pending
recorder.dataChanged(data);              // main, when search's data changes
```

It sends once the search has sat a second since the reader's last change **and**
its data is not `null`, with each term's real hit count. A word typed before the
data is recorded when the data lands, with its count; a link's terms count as
already recorded. It is handed data like every other reader; it does not know
about loading.

A term's record is its text, language, mode and `chosen`, so a link's terms can
be marked recorded before the dictionary. `termQuery`'s chosen meanings follow
from those four, so this records the same changes as today.

The search overlay loses `recorded`, `lastChanged`, `readerChanged`,
`searchOnMap` and the debounce.

## Every export of `src/search.ts` and `src/search/dictionary.ts`

`src/search.ts`

| Export | Becomes |
|---|---|
| `parseSearchTerms(query)` | unchanged |
| `loadLexiconData()` | removed; `buildDictionary(lexicon, forms, verseLexemes): Dictionary` |
| `buildSearchIndex(texts): void` | `buildTextIndex(texts): TextIndex` |
| `findLexemesForWord(word)` | `findLexemesForWord(dictionary, word)` |
| `getLexemeVerseCount(id)` | `(dictionary, id)`, and unexported: only `dictionary.ts` uses it |
| `getLexeme(id)` | `(dictionary, id)` |
| `getVerseLexemes(verseKey)` | `(dictionary, verseKey)`; `null` now means only "not in the dictionary" |
| `searchByLexemes(ids)` | `(dictionary, ids)` |
| `versesForTerm(text, language, mode)` | `(index, text, language, mode)` |
| `resultsForVerseSets(sets, languages)` | `(index, sets, languages)` |
| `computeSnippetForMatch(result, term)` | `(index, dictionary, result, term)` |
| `getMatchingVerseTerms(results)` | unchanged |

`src/search/dictionary.ts`

| Export | Becomes |
|---|---|
| `sameMeaning(meaning, keys)` | unchanged |
| `meaningsFor(form)` | `(dictionary, form)` |
| `meaningsInVerse(form, verseKey, wordIndex?)` | `(dictionary, words, form, verseKey, wordIndex?)`, where `words` is `wordsOfVerse(...)` below or `null` |
| `versesFor(keys)` | `(dictionary, keys)` |
| `formMatches(keys, form)` | `(dictionary, keys, form)` |
| `wordMatches(keys, form, text, start)` | `(dictionary, words, keys, form, text, start)` |
| `prefetchMorphology()` | removed; main loads the file |
| `setVerseOnScreen(verseKey, hebrew)` | removed; `wordsOfVerse(parse, verseKey, hebrew): VerseWords \| null`, plain, memoised per parse and verse |
| `verseOnScreen()` | removed |
| `wordsAreNamed()` | removed; tests ask `wordsOfVerse(...) !== null` |

`VerseWords` is today's `onScreen`: the verse, its Hebrew, and each printed
word's dictionary word by where it starts. `null` when the parse is not in, the
verse is misaligned, or the word counts disagree, exactly as `stemsOf` decides
today.

`src/search/terms.ts` follows: `addTerm`, `setTermText`, `removeTerm`,
`setMode`, `onlyMeaning`, `allMeanings`, `encodeMeanings` and `applyMeanings`
need no dictionary; `toggleMeaning`, `selectedKeys`, `isNarrowed` and
`termQuery` take it, since each needs the term's rows. `meaningsOf(dictionary,
term)` is new.

`buildTextIndex` still asks `getBookOrder()` for the book order, which is module
state filled from the structure before anything else runs. Out of scope here.

## Tests

Twenty-four test files fill search's module state today: 18 call
`buildSearchIndex`, 12 mock `fetch` to run `loadLexiconData`, two call
`setVerseOnScreen`.

- A helper, `realSearchData()` in `src/__tests__/helpers/`, reads the shipped
  files with `fs` and returns them built. Tests on the real data call it; the
  `fetch` mocks go.
- Tests on made-up texts call `buildTextIndex(fixture)` and pass the index.
- Overlay tests hand the data to `hostOverlay`, as step 1 does for the others.
- No test depends on another having run first.

In these files only setup lines and call arguments change. An expected value
that changes is a change in behaviour, and the pull request says which and why.

`test-harness/main.ts`, `scripts/print/views.ts` and
`scripts/search/click-resolution-report.ts` load the files with step 1's loader
and build the same way.

## Guarding against the old search bugs

Search has had a run of subtle matching bugs: a term found by its position in a
re-split string, a row compared by its first key across two lists, the search
and the highlighter matching by two rules, a row's hit count taken from its
neighbour, and Hebrew and Aramaic words sharing an ETCBC id. This design moves
data, not rules. In particular:

- `src/search/matching.ts` is untouched, and the search and the highlighter are
  handed the same dictionary value, so they cannot consult two.
- Terms keep their ids and hit counts stay per term.
- `chosen` is compared only through `sameMeaning`. A new test: a reading picked
  in the word menu from a verse whose list heads it with another key (one of the
  merged same-name rows) gives the same verses, the same checked row and the same
  `m` round trip as picking it in the panel.
- A test that the memoised results follow the dictionary: one settings value,
  two dictionaries, two answers.
- **Before and after, `scripts/search/click-resolution-report.ts` over the whole
  text gives identical output**, and the print script's search sheet the same
  verses. The report walks every word, which the unit tests do not.

## Open questions, assumptions and rulings

Decisions made while implementing step 2, newest last.

- **2026-10-01 (plan)** Startup waits for the per-word parse too: main loads
  every file the tools name, and the idle prefetch goes. It adds about 1 MB
  compressed to the startup wait until step 3 loads it last.
- **2026-10-01 (plan, Danyel)** Writing `m` copies `chosen` and reading it
  splits it, as the design says, so writing a link never needs the dictionary.
  The address may shift slightly — a word of one meaning picked from the menu
  now writes `m`; a merged row picked from the menu writes the key it was given;
  a link's `m` is written back as read — but every link opens the view it opens
  today. Tests pin each case and its round trip; the browser check compares the
  view each address opens, and the PR lists every address that differs.
- **2026-10-01 (plan)** `toggleMeaning` takes the row's keys, as `onlyMeaning`
  does, rather than its first key.
- **2026-10-01 (plan)** `chosenAmong(rows, term)` and
  `chosenMeanings(dictionary, term)` say which rows count as chosen; the panel,
  the hover text and the row summary read them.
- **2026-10-01 (plan)** A term's record for telemetry holds `chosen` only while
  the term is matched by its meanings, as `termQuery`'s meaning keys did.
- **2026-10-01 (plan)** `getLexemeVerseCount` moves into `dictionary.ts`,
  unexported: only `rowsFor` reads it.
- **2026-10-01 (plan)** The lexeme key format has one home, `lexemeKey` in
  `search.ts`, used by the dictionary's key → lexeme map and by `dictionary.ts`.
- **2026-10-01 (plan)** Search's file names, `SearchData` and the functions that
  build from it live in `src/search/data.ts`, which imports no CSS, so the print
  and the click report can use them under plain `node`.
- **2026-10-01 (plan)** The results list is handed a snippet function rather
  than the index and dictionary, so it draws an empty list without data.
- **2026-10-01 (plan)** Building the index and the dictionary logs nothing; the
  loader warns about a failed download. The click report is compared on its
  table.
- **2026-10-01 (plan)** Without search's data the caption is empty, including
  "Type to search": the design says no caption.
- **2026-10-01 (plan)** A word clicked while search's data is missing opens no
  menu: search is off then, and nothing the menu offers could be searched.
- **2026-10-01 (plan)** `highlightSearchTerms`, exported but called by nothing,
  goes with its re-export and the sidebar test's mock of it.
- **2026-10-01 (plan)** The recorder's `dataChanged` is built and tested now;
  main first calls it in step 3, since search's data never changes after
  startup in step 2.
- **2026-10-01 (plan)** The story blender keys its picture cache on `loaded`;
  keyed so, a picture drawn before a file arrived is never found once it has,
  and the separate not-kept check goes.
- **2026-10-01 (plan)** `interactive-search.manual.html` is left as it is: it
  imports `BOOK_ORDER`, which `src/constants/books.ts` does not export, so it is
  broken already. Filed as an issue.
- **2026-10-01 (Task 2)** `search-meaning-url.test.ts` loses "falls back to
  every meaning when the link names nothing it knows": that file has no
  dictionary, and the fallback is a rule of a term's rows, pinned in
  `search-terms.test.ts` ("falls back to every meaning when a key no longer
  resolves" and "writes back a link naming no meaning the word has").
- **2026-10-01 (Task 2)** `search-terms.test.ts`'s "writes only the narrowed
  term" looks the rows up once: it compares rows by identity, and until Task 3
  memoises `meaningsFor`, two calls return different objects. A setup line; the
  expected value is unchanged.
