# Search Receives Its Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search stops holding its text index, dictionary and per-word parse in module state: it names its files, main loads them with everything else, and every reader of search is handed what it reads — with nothing a reader sees changing.

**Architecture:** Search names five files in `data`, the per-word parse as an optional one (`optional(path)`, typed `T | null`, never waited for). Three values are built from the files by plain functions kept per file value: the text index (`buildTextIndex`), the dictionary (`buildDictionary`) and the parse (`buildParse`); every function in `src/search.ts` and `src/search/dictionary.ts` takes the value it reads as an argument. A search term stores `chosen` — the meaning keys the reader or the link gave, never looked up — instead of `meanings` and `selected`. `highlightVerseText` takes the verse first. Recording moves out of the overlay into a recorder main owns. Startup still waits for every file.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Playwright (layout tests), Node 24 type stripping for `scripts/`.

**Spec:** `docs/plans/2026-09-30-search-data-design.md` — all of it. Read it before Task 1. It builds on step 1's design, `docs/plans/2026-09-30-overlay-data-design.md`, whose decision log records what the branch already does.

## Global Constraints

- Nothing a reader sees changes: `npm run test:layout` passes with `layout/known.ts` untouched, and the shots match the Task 0 baseline per `layout-check.md`.
- No data file under `public/data/` changes. The `search`, `mode` and `m` parameters keep their format, and every link opens the view it opens today. Writing `m` is a straight copy of each term's `chosen` and reading it a straight split, so writing a link never needs the dictionary; the address may shift slightly where `chosen` holds keys today's code expanded or dropped (Danyel: fine, as long as the link opens the same view). Task 2's tests pin each case and its round trip; Task 0/Task 7 compare the view the address opens after four actions in the browser, and every address that differs is listed in the PR.
- Startup waits for every file, the per-word parse included (ruling 1).
- `src/search/matching.ts` is untouched: `git diff --quiet worktree-overlay-data -- src/search/matching.ts` exits 0 at the end of every task.
- `chosen` is compared only through `sameMeaning`, never by first keys. Terms keep their ids; hit counts stay per term.
- AGENTS.md's search rules hold: a single letter is never a word; one colour per term; no way over to related words.
- Data is always a member's last argument. `highlightVerseText` takes the verse first, like `getHoverInfo`.
- In a test file converted to the new API only setup lines and call arguments change. An expected value that changes is a change in behaviour: log it (rule 1) and name it in the PR.
- No module-level search state survives: no test depends on another having run first.
- Tests check behaviour: no assertions on wording readers see, on counts taken from the shipped data, or on timings. No download mocks.
- Comments describe the code as it is now; no ticket numbers, dates, step numbers or "used to" in code, test names or comments (AGENTS.md). Shorter is better.
- Use `npm`. Imports reachable from `scripts/print/` and `scripts/search/` use explicit `.ts` extensions, `import type` for types, and no CSS: both run under plain `node`. `src/overlays/search/index.ts` imports CSS, so nothing under `scripts/` may import it.
- Run TypeScript scripts with `node <file>.ts`. `tsx` is not installed and `npx tsx` would download it, so `npm run report:click-resolution` is not used here.

## Review Focus

1. **A panel drawn before search's data, then handed it.** The panel skips a redraw when its settings have not changed; if that check ignores the data, the meanings, counts and results never appear. Expected: drawn again with data, they fill in. Pinned in Task 3 (`search-without-data.test.ts`).
2. **The same settings with another dictionary.** Results are memoised; keyed on settings alone, a new dictionary is handed the old answer. Expected: one settings value, two dictionaries, two answers. Pinned in Task 3 (`search-data.test.ts`).
3. **A reading picked in the word menu whose row the verse heads with another key.** Shechem in Genesis 34:4: the verse's row is `CKM==/@heb`, the term's own merged row `CKM=/@heb|CKM==/@heb`. `chosen` keeps the menu's keys and `m` copies them. Expected: the same checked row and the same verses as picking it in the panel, and a link that reopens to that row and those verses. Pinned in Task 2.
4. **Highlighting without the per-word parse, or with another verse's.** The parse is optional; a verse drawn without it must fall back to the spelling, and a parse for one verse must never name the words of another verse's text. Pinned in Task 5 (marks without the parse) and by `word-by-position.test.ts`'s "ignores a position in text that is not the verse on screen".
5. **A word typed before search's data, and a link opened before it.** Expected: the typed word is recorded when the data lands, with its count; the link's terms are never recorded. Pinned in Task 6.

---

## Standing rules for the unattended run

These bind every task and every subagent.

1. **Decide alone** anything the spec settles, and any small conflict between the plan and the code (a name, an import path, a test that needs a different fixture, a step 1 name changed by its final review). Log each such decision as a dated entry in the section **"Open questions, assumptions and rulings"** at the end of `docs/plans/2026-09-30-search-data-design.md` (Task 0 creates it), and commit the entry with the task it belongs to.
2. **Stop** — commit nothing further and report BLOCKED with the specifics; the controller notifies Danyel — for anything that would change what a reader sees, a link that opens a different view (or changes format), or a data file, or anything the spec does not cover. A layout-test failure or a shot outside the noise in `layout-check.md` counts as "changes what a reader sees". So does any difference in Task 7's before-and-after comparisons, except the addresses `address-check.mjs` records, whose shifts are expected and listed.
3. **Never skip the pre-commit hook** (`--no-verify`) except on a commit that touches only Markdown and images. If the hook fails on a timeout in a file the task did not touch, rerun the commit once and say so in the task report; a second failure is a stop.
4. **Plain shell commands only.** No `cd X && …`, no `;`-chained or `&&`-chained commands, no pipes: the worktree guard rejects them. Output redirection to a file (`> file`) is fine. Run each command on its own from the worktree root `/Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data`, using absolute paths or `git -C`.
5. **Never write to another worktree** or the primary checkout. Reading step 1's scratch files (Task 0) is allowed. Never `git stash`.
6. **Layout tests:** at the end of every task marked *(draws)*, and in Task 7, per `layout-check.md` in the scratch directory (below).
7. **Before each commit:** `node_modules/.bin/prettier --write <the files you changed>`, then `npm run typecheck`, then `npx vitest run`. Fix every type error in one pass. `src/__tests__` is not typechecked; `test-harness/`, `scripts/print/` and the rest of `src` are.
8. Commit messages end with a blank line and `Co-Authored-By: <your model name> <noreply@anthropic.com>`.
9. If you start a dev server, start your own in the background (`npm run dev`), read its port from its output, and stop only that process by PID.
10. Do not push, open PRs or post to GitHub except where Task 0 and Task 7 say to. Everything posted to GitHub starts with `🤖 Claude:`.
11. **Finish** (Task 7): the PR targets `worktree-overlay-data` (stacked on step 1) and says "Step 2 of 3 toward #313". It must **not** say `Closes #313`, `Fixes #313` or `Resolves #313`.

**The scratch directory** is `/Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/` (gitignored), written `<SDD>` below. Scratch scripts live there, never in the repo.

---

## Where every changed function is called today

Line numbers are from step 1's head and drift; the files are what matter.

| Function | Callers outside tests | Test files |
|---|---|---|
| `buildSearchIndex` | `src/main.ts`, `test-harness/main.ts` | search-matching, search-performance, search-meanings-mode, search-hebrew-modes, search-mixed-language, search-final-forms, search-verse-sets, search-wholeword, search-bounds, search-english-snippets, search-lazy-snippets, overlays/search-term-colors, overlays/search, overlays/search-marks-by-position, overlays/search-from-click, overlays/search-meaning-filter, integration/search-overlay-modes, performance/hebrew-search-perf, scrollytelling overlayBlender |
| `loadLexiconData` | `src/main.ts`, `test-harness/main.ts`, `scripts/print/views.ts`, `scripts/search/click-resolution-report.ts` | search-dictionary, search-terms, search-meanings-mode (with a fetch mock), search-mixed-language, search-verse-sets, search-normalization, overlays/search-marks-by-position, overlays/search-meaning-filter, overlays/search-from-click, search/word-in-verse, search/word-by-position, print views |
| `findLexemesForWord` | `src/search.ts` (snippets), `src/search/dictionary.ts`, `scripts/print/views.ts`, click report | search-meanings-mode, search-final-forms (comments only), search-normalization |
| `getLexemeVerseCount` | `src/search/dictionary.ts` only | — |
| `getLexeme` | `src/search/dictionary.ts`, `scripts/print/views.ts` | search-meanings-mode |
| `getVerseLexemes` | `src/search/dictionary.ts`, click report | — |
| `searchByLexemes` | `src/search/dictionary.ts`, `scripts/print/views.ts` | — |
| `versesForTerm` | `src/overlays/search/index.ts` | search-matching, search-performance, search-mixed-language, search-hebrew-modes, search-final-forms, search-wholeword, hebrew-search-perf, helpers/meaningsSearch |
| `resultsForVerseSets` | `src/overlays/search/index.ts` | search-verse-sets, search-english-snippets, helpers/meaningsSearch |
| `computeSnippetForMatch` | `src/overlays/search/resultsList.ts` | search-meanings-mode, search-bounds, search-english-snippets, search-lazy-snippets |
| `meaningsFor` | `src/search/terms.ts` (`resolve`) | search-dictionary, search-mixed-language, overlays/search-meaning-filter, search/word-in-verse |
| `meaningsInVerse` | `src/main.ts` (word click), click report | search-terms, search/word-by-position, overlays/search-from-click, search/word-in-verse |
| `versesFor` | `src/overlays/search/index.ts` (search, hover) | search-dictionary, search-mixed-language, helpers/meaningsSearch |
| `formMatches` | `src/search/dictionary.ts` | search-dictionary |
| `wordMatches` | `src/overlays/search/highlight.ts` | search/word-by-position |
| `prefetchMorphology` | `src/main.ts` (end of `main`) | — |
| `setVerseOnScreen`, `verseOnScreen` | `src/sidebar.ts`, click report | overlays/search-marks-by-position, search/word-by-position |
| `wordsAreNamed` | — | search/word-by-position |
| `toggleMeaning`, `isNarrowed`, `allMeanings` | `src/overlays/search/termRows.ts` | search-terms |
| `selectedKeys` | `highlight.ts`, `terms.ts` | search-terms, search-meaning-url, helpers/meaningsSearch |
| `termQuery` | `recording.ts`, `src/overlays/search/index.ts` | search-mixed-language |
| `applyMeanings`, `encodeMeanings` | `src/overlays/search/index.ts` | search-terms, search-meaning-url |
| `onlyMeaning` | `termRows.ts`, `src/overlays/search/index.ts` (`searchForMeaning`) | search-terms |
| `searchForMeaning` | `src/main.ts` (word menu) | overlays/search-from-click |
| `term.meanings`, `term.selected` | `termRows.ts`, `src/overlays/search/index.ts` (hover), `terms.ts` | search-terms, search-meaning-url, overlays/search-recording, helpers/meaningsSearch |
| `termsToRecord` | `src/overlays/search/index.ts` | overlays/search-recording |
| `highlightSearchTerms` | re-exported by `src/overlays/index.ts`; no caller | mocked (dead) in sidebar |
| `highlightVerseText` | `src/sidebar.ts` (overlay and search) | helpers/overlayHost, sidebar, overlays/search (16 calls), search-matching, overlays/search-marks-by-position, overlays/search-term-colors, overlays/trop (3), overlays/search-meaning-filter (2) |
| `pictureForStop` cache | `src/scrollytelling/overlayBlender.ts` | scrollytelling overlayBlender |
| `filesFor`, `loadNamedFiles`, `overlayFiles` | `src/dataFiles.ts`, `src/tools.ts`, `src/main.ts`, `scripts/print/views.ts`, `test-harness/main.ts` | dataFiles, story-file |

`src/__tests__/performance/interactive-search.manual.html` also imports `buildSearchIndex`; it is already broken (it imports `BOOK_ORDER`, which `src/constants/books.ts` does not export) and is left alone (ruling 16).

## File map

- Create `src/search/data.ts` — `SearchData`, `SEARCH_FILES`, `textIndexOf`, `dictionaryOf`, `parseOf`. CSS-free, so the print and the report can import it.
- Create `src/__tests__/helpers/searchData.ts` — `EMPTY_DICTIONARY_FILES`, `EMPTY_DICTIONARY`, `searchDataFor`, `realSearchData`.
- Create tests `src/__tests__/unit/search-data.test.ts`, `src/__tests__/unit/overlays/search-without-data.test.ts`.
- Modify `src/dataFiles.ts` (optional files), `src/overlays/types.ts`, `src/overlays/types.check.ts`, `src/search.ts`, `src/search/dictionary.ts`, `src/search/terms.ts`, `src/overlays/search/{index,highlight,resultsList,termRows,recording}.ts`, `src/overlays/index.ts`, `src/overlays/trop.ts`, `src/sidebar.ts`, `src/scrollytelling/overlayBlender.ts` (if step 1 has not keyed its cache on `loaded`), `src/main.ts`, `scripts/print/views.ts`, `scripts/search/click-resolution-report.ts`, `test-harness/main.ts`, and the tests in the table above.
- Untouched: `src/search/matching.ts`.

## Shared names (every task relies on these)

```ts
// src/dataFiles.ts (Task 1)
export interface OptionalFile { readonly optional: string }
export type FileName = string | OptionalFile;
export function optional(path: string): OptionalFile;
export function filePaths(files: Readonly<Record<string, FileName>>): string[];
export function filesFor<D>(files: Readonly<Record<string, FileName>>, loaded: Loaded): D | null;
export async function loadNamedFiles<D>(files: Readonly<Record<string, FileName>>): Promise<D>;

// src/search.ts (Task 3)
export interface TextIndex { entries: IndexEntry[]; byKey: Map<string, IndexEntry> }
export interface LexiconFile { source: string; lexemes: LexemeRow[] }
export type FormsFile = Record<string, LexemeId[]>;
export type VerseLexemesFile = Record<string, LexemeId[]>;
export interface Dictionary {
  lexemes: Lexeme[]; formToLexemes: FormsFile; verseToLexemes: VerseLexemesFile;
  lexemeToVerses: Map<LexemeId, Set<string>>; spellingToLexemes: Map<string, LexemeId[]>;
  keyToLexeme: Map<string, LexemeId>;
}
export function lexemeKey(lexeme: Lexeme): string;                 // `${id}@${language}`
export function buildTextIndex(texts: VerseTexts): TextIndex;     // same texts, same object
export function buildDictionary(lexicon: LexiconFile, forms: FormsFile, verseLexemes: VerseLexemesFile): Dictionary;
export function findLexemesForWord(dictionary: Dictionary, word: string): LexemeId[] | null;
export function getLexeme(dictionary: Dictionary, id: LexemeId): Lexeme | null;
export function getVerseLexemes(dictionary: Dictionary, verseKey: string): LexemeId[] | null;
export function searchByLexemes(dictionary: Dictionary, ids: LexemeId[]): Set<string>;
export function versesForTerm(index: TextIndex, text: string, language: TextLanguage, mode: MatchMode): Set<string>;
export function resultsForVerseSets(index: TextIndex, sets: Array<Set<string>>, languages?: TextLanguage[]): SearchResult[];
export function computeSnippetForMatch(index: TextIndex, dictionary: Dictionary, result: SearchResult, term: string): Snippet | null;

// src/search/dictionary.ts (Task 3 for the dictionary, Task 5 for the parse)
export function meaningsFor(dictionary: Dictionary, form: string): Meaning[];   // same objects per dictionary and form
export function meaningsInVerse(dictionary: Dictionary, words: VerseWords | null, form: string, verseKey: string, wordIndex?: number): Meaning[];
export function versesFor(dictionary: Dictionary, keys: readonly string[]): Set<string>;
export function formMatches(dictionary: Dictionary, keys: readonly string[], form: string): boolean;
export function wordMatches(dictionary: Dictionary, words: VerseWords | null, keys: readonly string[], form: string, text: string, start: number): boolean;
export interface MorphologyFile { misaligned: string[]; verses: Record<string, ParsedVerse> }
export interface Parse { verses: Record<string, ParsedVerse>; misaligned: Set<string> }
export function buildParse(file: MorphologyFile): Parse;
export interface VerseWords { verseKey: string; hebrew: string; stems: Map<number, LexemeId> }
export function wordsOfVerse(parse: Parse | null, verseKey: string, hebrew: string): VerseWords | null;

// src/search/data.ts (Task 3; parse in Task 5)
export interface SearchData { texts: VerseTexts; lexicon: LexiconFile; forms: FormsFile; verseLexemes: VerseLexemesFile; parse: MorphologyFile | null }
export const SEARCH_FILES;   // { texts: TEXTS_FILE, lexicon: 'search/lexicon.json', forms: 'search/word-lexemes.json', verseLexemes: 'search/verse-lexemes.json', parse: optional('search/verse-morphology.json') }
export function textIndexOf(data: SearchData): TextIndex;
export function dictionaryOf(data: SearchData): Dictionary;
export function parseOf(data: SearchData): Parse | null;

// src/search/terms.ts (Task 2; the dictionary argument arrives in Task 3)
export interface SearchTerm { id: string; text: string; colorIndex: number; mode: SearchMode | null; chosen: string[] | null }
export function meaningsOf(dictionary: Dictionary, term: SearchTerm): Meaning[];
export function chosenAmong(rows: Meaning[], term: SearchTerm): Meaning[];
export function chosenMeanings(dictionary: Dictionary, term: SearchTerm): Meaning[];
export function toggleMeaning(dictionary: Dictionary, terms: SearchTerm[], id: string, keys: readonly string[]): SearchTerm[];
export function selectedKeys(dictionary: Dictionary, term: SearchTerm): string[];
export function isNarrowed(dictionary: Dictionary, term: SearchTerm): boolean;
export function termQuery(dictionary: Dictionary, term: SearchTerm): TermQuery;
export function onlyMeaning(terms: SearchTerm[], id: string, keys: readonly string[]): SearchTerm[];   // no dictionary
export function allMeanings(terms: SearchTerm[], id: string): SearchTerm[];
export function applyMeanings(terms: SearchTerm[], encoded: string): SearchTerm[];   // straight split, no dictionary
export function encodeMeanings(terms: SearchTerm[]): string;                       // straight copy of `chosen`, no dictionary

// src/overlays/search/index.ts
export const searchTool: Overlay<TanakhIdentity, SearchSettings, SearchData>;   // Task 3
export function activeTerms(settings: SearchSettings): SearchTerm[];
export function termHitCount(data: SearchData, settings: SearchSettings, term: SearchTerm): number | null;

// src/overlays/search/recording.ts (Task 6)
export interface SearchRecorder {
  readerChanged(settings: SearchSettings, data: SearchData | null): void;
  replaced(settings: SearchSettings, data: SearchData | null): void;
  dataChanged(data: SearchData | null): void;
}
export function createSearchRecorder(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): SearchRecorder;

// Overlay member (Task 5)
highlightVerseText?(verse: T, text: string, language: TextLanguage, settings: S, data: D): DocumentFragment;

// src/__tests__/helpers/searchData.ts (Task 3; parse in Task 5)
export const EMPTY_DICTIONARY_FILES: Pick<SearchData, 'lexicon' | 'forms' | 'verseLexemes'>;
export const EMPTY_DICTIONARY: Dictionary;
export function searchDataFor(texts: VerseTexts, files?: Partial<SearchData>): SearchData;
export function realSearchData(): { files: SearchData; index: TextIndex; dictionary: Dictionary; parse: Parse };
```

---

### Task 0: Worktree, baseline, and the decision log

No code. Establishes what "unchanged" means, before anything moves.

- [ ] **Step 1: Make the worktree**

Step 1's work must be finished on `worktree-overlay-data`. If `/Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data` does not exist yet:

Run: `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/overlay-data worktree add /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data -b worktree-search-data worktree-overlay-data`
Then from the new worktree: `npm install`, then `./scripts/install-hooks.sh` (Danyel's npm config sets `ignore-scripts=true`, so `prepare` does not install the hooks).
Expected: `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data status --short --branch` prints `## worktree-search-data` and nothing else.

- [ ] **Step 2: Read the code at the branch head**

Step 1's final reviews may have renamed fixtures (`SAMPLE_*_DATA`), changed `src/dataFiles.ts`, `src/main.ts`'s startup, `test-harness/main.ts` or the story blender since this plan was written. Read `src/dataFiles.ts`, `src/scrollytelling/overlayBlender.ts`, `src/main.ts` (startup and `searchChanged`), `test-harness/main.ts` and `src/__tests__/helpers/fixtures.ts`. Where they differ from what this plan assumes, follow the code and log the difference (rule 1).

- [ ] **Step 3: The scratch directory**

Create `<SDD>`. Copy into it from `/Users/danyel/code/MISC/torahmap/.claude/worktrees/overlay-data/.superpowers/sdd/2026-09-30-overlay-data-implementation/`: `pixel-diff.mjs` and `layout-check.md`. In the copied `layout-check.md`, replace the directory name `2026-09-30-overlay-data-implementation` with `2026-09-30-search-data-implementation` throughout.

- [ ] **Step 4: Suite and typecheck on the untouched branch**

Run: `npm run typecheck`, then `npx vitest run`. Expected: both pass. Record the test count in the report.

- [ ] **Step 5: Layout baseline**

Run: `npm run test:layout`. Expected: PASS. Copy `layout-report/shots/` to `<SDD>/baseline-shots/`. Read the PNGs for `explore-search`, `explore-search-and-overlay-pinned` and `explore-verse-pinned` (desktop) to confirm the map and the popup drew.

- [ ] **Step 6: The before half of the comparisons**

Write these four scripts into `<SDD>` and run each from the worktree root. Task 7 runs their after halves; any difference there is a stop (rule 2).

`<SDD>/serve-public.ts` — the fetch shim the scripts share, as the click report has it:

```ts
// Serve public/ from disk under the site-absolute URLs the loaders ask for.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const publicDir = join(ROOT, 'public');

globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const resolved = normalize(join(publicDir, decodeURIComponent(path)));
  if (!resolved.startsWith(publicDir) || !existsSync(resolved)) {
    return new Response(null, { status: 404 });
  }
  return new Response(readFileSync(resolved, 'utf8'), { status: 200 });
}) as typeof fetch;

export const TEXTS = JSON.parse(readFileSync(join(publicDir, 'data', 'all-texts.json'), 'utf8')) as Record<
  string,
  Record<string, Record<string, { he: string }>>
>;
```

`<SDD>/words-before.ts` — every clickable word's meanings, one line per word, as the word menu would offer them:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TEXTS } from './serve-public.ts';

const { loadLexiconData } = await import('../../../src/search.ts');
const { meaningsInVerse, setVerseOnScreen } = await import('../../../src/search/dictionary.ts');
const { verseWords, lookupForm } = await import('../../../src/verseWords.ts');

await loadLexiconData();
await setVerseOnScreen('Genesis:1:1', TEXTS.Genesis['1']['1'].he);

const lines: string[] = [];
for (const [book, chapters] of Object.entries(TEXTS)) {
  for (const [chapter, verses] of Object.entries(chapters)) {
    for (const [verse, { he }] of Object.entries(verses)) {
      const key = `${book}:${chapter}:${verse}`;
      setVerseOnScreen(key, he);
      for (const [i, { word }] of verseWords(he).entries()) {
        const form = lookupForm(word);
        const rows = meaningsInVerse(form, key, i).map((m) => `${m.keys.join('|')}=${m.verseCount}`);
        lines.push(`${key}\t${i}\t${form}\t${rows.join(' ')}`);
      }
    }
  }
}
writeFileSync(join(ROOT, '.superpowers/sdd/2026-09-30-search-data-implementation/words-before.txt'), `${lines.join('\n')}\n`);
console.log(`${lines.length} words`);
```

`<SDD>/names-before.ts` — the print's search sheet, as the verses each name marks:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve-public.ts';

const { loadLexiconData } = await import('../../../src/search.ts');
const { nameVerses } = await import('../../../scripts/print/views.ts');

await loadLexiconData();
const names = [['אברהם', 'Abraham'], ['יצחק', 'Isaac'], ['יעקב', 'Jacob'], ['משה', 'Moses'], ['דוד', 'David']];
const lines = names.map(([he, en]) => `${en}\t${[...nameVerses(he, en)].sort().join(' ')}`);
writeFileSync(join(ROOT, '.superpowers/sdd/2026-09-30-search-data-implementation/names-before.txt'), `${lines.join('\n')}\n`);
console.log(`${lines.length} names`);
```

`<SDD>/compare-report.mjs` — compares two runs of the click report on their table, ignoring the loader's progress lines, which go in Task 3 (ruling 10):

```js
import { readFileSync } from 'node:fs';
const table = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('Loading') && !line.startsWith('✓'))
    .join('\n');
const [before, after] = process.argv.slice(2).map(table);
if (before === after) console.log('IDENTICAL');
else {
  console.log(`DIFFERENT\n--- before\n${before}\n--- after\n${after}`);
  process.exitCode = 1;
}
```

`<SDD>/popup-check.mjs` — the popup's marks and every word's menu for one narrowed two-term search, as text:

```js
// node <this file> <port> <out-file>
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [port, out] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const search = encodeURIComponent('עלה, עלה');
const m = encodeURIComponent('<LH[@heb,<LH/@heb|<LH=/@heb|<LH/@arc');
await page.goto(`http://localhost:${port}/?search=${search}&m=${m}&verse=Genesis.8.20`);
await page.waitForFunction(() => 'mapReady' in document.documentElement.dataset, null, { timeout: 60000 });
// Long enough for the per-word parse, which the popup asks for once it opens.
await page.waitForTimeout(5000);
const marks = await page.$$eval('#verse-popup .verse-hebrew mark', (ms) =>
  ms.map((m) => `${m.className}:${m.textContent}`),
);
const words = page.locator('#verse-popup .verse-hebrew .verse-word');
const menus = [];
for (let i = 0; i < (await words.count()); i++) {
  await words.nth(i).click();
  const menu = page.locator('.word-menu');
  await menu.waitFor({ timeout: 5000 });
  menus.push(`${i}: ${(await menu.innerText()).replace(/\s+/g, ' ')}`);
  await page.keyboard.press('Escape');
}
writeFileSync(out, [`marks ${marks.join(' ')}`, ...menus, `errors ${errors.length}`].join('\n') + '\n');
console.log(`${menus.length} words, ${errors.length} page errors`);
await browser.close();
```

`<SDD>/address-check.mjs` — the address after each of the four actions that write `m`, and the view that address opens when reopened: the open row's checked meanings and the panel's caption, which counts the verses found:

```js
// node <this file> <port> <address-file> <view-file>
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [port, addressFile, viewFile] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];

async function open(link) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?${link}`);
  await page.waitForFunction(() => 'mapReady' in document.documentElement.dataset, null, { timeout: 60000 });
  await page.waitForTimeout(5000); // the per-word parse, before step 2's startup waits for it
  return page;
}

/** The address's search parameters, once the URL has settled, as a query string. */
async function address(page) {
  await page.waitForTimeout(1000);
  const params = await page.evaluate(() => [...new URLSearchParams(location.search)]);
  await page.close();
  return new URLSearchParams(
    params.filter(([k]) => ['search', 'mode', 'm'].includes(k)).sort(),
  ).toString();
}

/** What reopening an address shows: the open row's checked meanings and the caption. */
async function viewOf(query) {
  const page = await open(query);
  await viaMenu(page, 'search');
  const checked = await page.$$eval('.term-row[data-open="true"] .meaning-row', (rows) =>
    rows.filter((r) => r.querySelector('input').checked).map((r) => r.querySelector('.meaning-gloss').textContent),
  );
  const caption = await page.locator('#search-hit-caption').innerText();
  await page.close();
  return `checked [${checked.join(', ')}] · ${caption}`;
}

/** Click the word of a pinned verse spelled `bare` (no points), and choose its first meaning. */
async function pickFromMenu(page, bare) {
  const words = page.locator('#verse-popup .verse-hebrew .verse-word');
  const index = await words.evaluateAll(
    (spans, bare) => spans.findIndex((s) => s.textContent.replace(/[֑-ׇ]/g, '') === bare),
    bare,
  );
  await words.nth(index).click();
  await page.locator('.word-menu .word-menu-choice').first().click();
}

async function viaMenu(page, action) {
  await page.locator('#menu-toggle').click();
  await page.locator(`.menu-item[data-action="${action}"]:visible`).click();
}

const lines = [];

// A word with one meaning, picked from the menu.
let page = await open('verse=Genesis.10.7');
await pickFromMenu(page, 'כוש');
lines.push(`menu, one meaning: ${await address(page)}`);

// A merged row (Shechem the man), picked from the menu.
page = await open('verse=Genesis.34.4');
await pickFromMenu(page, 'שכם');
lines.push(`menu, merged row: ${await address(page)}`);

// A row picked in the panel: עלה narrowed to burnt-offering with "only".
page = await open(`search=${encodeURIComponent('עלה')}`);
await viaMenu(page, 'search');
await page
  .locator('.meaning-row', { has: page.locator('.meaning-gloss', { hasText: /^burnt-offering$/ }) })
  .locator('.meaning-only')
  .click();
lines.push(`panel, only: ${await address(page)}`);

// A narrowed link naming one key of a merged row, then an overlay switch, which writes the link again.
page = await open(`search=${encodeURIComponent('שכם')}&m=${encodeURIComponent('CKM==/@heb')}`);
await viaMenu(page, 'overlay');
await page.locator('#overlay-select').selectOption('trop');
lines.push(`link, round trip: ${await address(page)}`);

const views = [];
for (const line of lines) {
  const [action, query] = line.split(': ');
  views.push(`${action}: ${await viewOf(query)}`);
}

writeFileSync(addressFile, `${lines.join('\n')}\n`);
writeFileSync(viewFile, [...views, `errors ${errors.length}`].join('\n') + '\n');
console.log([...lines, ...views].join('\n'));
await browser.close();
```

Run:
- `node scripts/search/click-resolution-report.ts > <SDD>/report-before.txt`
- `node <SDD>/words-before.ts` — Expected: about 306,000 words written.
- `node <SDD>/names-before.ts` — Expected: `5 names`.
- Start your own dev server (rule 9), then `node <SDD>/popup-check.mjs <port> <SDD>/popup-before.txt` — Expected: one line per word of Genesis 8:20 and `0 page errors`. Read the file: the marks line must hold one `term-0` mark on the verb and one `term-1` mark on the offering (the parse arrived). If not, raise the wait and run again.
- With the same dev server, `node <SDD>/address-check.mjs <port> <SDD>/address-before.txt <SDD>/view-before.txt` — Expected: four addresses (today: the one-meaning pick has `mode=m` and no `m`; the merged-row pick and the round-tripped link both have `m=CKM=/@heb|CKM==/@heb`; the panel pick `m=<LH/@heb`), four views with a checked row and a caption each, and `errors 0`. If an action cannot be driven as scripted (a selector the page does not have), fix the script, not the app, and log it. Stop your dev server.

- [ ] **Step 7: The decision log, and mark the issue**

Append to `docs/plans/2026-09-30-search-data-design.md`, and change its `**Status:**` line to `Design, decided 2026-10-01. Planned: docs/plans/2026-09-30-search-data-implementation.md.`:

```markdown
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
```

Commit (Markdown only; `--no-verify` allowed by rule 3 but not needed):

```bash
git add docs/plans/2026-09-30-search-data-design.md
git commit -m "Step 2 plan rulings recorded (#313)"
```

Then:

```bash
gh issue comment 313 --body "🤖 Claude: step 2 of 3 (search receives its data) is in progress in branch \`worktree-search-data\`, stacked on step 1; plan: docs/plans/2026-09-30-search-data-implementation.md."
gh issue create --title "interactive-search.manual.html is broken" --label bug,P4 --body "🤖 Claude: src/__tests__/performance/interactive-search.manual.html imports BOOK_ORDER from src/constants/books.ts, which does not export it, and buildSearchIndex, which step 2 of #313 removes. Fix it against buildTextIndex, or delete it."
```

---

### Task 1: Optional files

**Files:**
- Modify: `src/dataFiles.ts`, `src/overlays/types.ts`, `src/overlays/types.check.ts`
- Test: `src/__tests__/unit/dataFiles.test.ts`

**Interfaces:**
- Consumes: `Loaded`, `loadFiles`, `filesFor`, `dataFor`, `overlayFiles`, `loadNamedFiles` (step 1).
- Produces: `OptionalFile`, `FileName`, `optional`, `filePaths`; `filesFor`, `dataFor`, `overlayFiles` and `loadNamedFiles` accept optional files.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/dataFiles.test.ts` (add `optional` to the import from `../../dataFiles`):

```ts
describe('an optional file', () => {
  const texts = { Genesis: {} };
  const parse = { verses: {} };
  const reader = testOverlay({
    id: 'opt',
    name: 'Opt',
    getVerseColor: () => null,
    data: { texts: 'all-texts.json', parse: optional('parse.json') },
  });

  it('is not waited for: the data comes without it, holding null', () => {
    expect(dataFor(reader, new Map([['all-texts.json', texts]]))).toEqual({ texts, parse: null });
  });

  it('is handed over once it is in', () => {
    const loaded = new Map<string, unknown>([
      ['all-texts.json', texts],
      ['parse.json', parse],
    ]);
    expect(dataFor(reader, loaded)).toEqual({ texts, parse });
  });

  it('does not stand in for a file that is not optional', () => {
    expect(dataFor(reader, new Map([['parse.json', parse]]))).toBeNull();
  });

  it('is downloaded with the rest', () => {
    expect(overlayFiles([reader])).toEqual(['all-texts.json', 'parse.json']);
  });

  it('is not named as missing when the files are loaded by name', async () => {
    mockFetch({ '/data/all-texts.json': texts });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      loadNamedFiles({ texts: 'all-texts.json', parse: optional('parse.json') }),
    ).resolves.toEqual({ texts, parse: null });
  });
});
```

If `loadNamedFiles`, `dataFor`, `overlayFiles`, `testOverlay` or `mockFetch` are not yet imported in that file, add them.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts`
Expected: FAIL — `optional` is not exported (`optional is not a function`).

- [ ] **Step 3: Optional files in the loader**

In `src/dataFiles.ts`, after `type Loaded`:

```ts
/** A file its reader can work without: handed over as null until it is in, and never waited for. */
export interface OptionalFile {
  readonly optional: string;
}

/** A file named by its path, or an optional one. */
export type FileName = string | OptionalFile;

export function optional(path: string): OptionalFile {
  return { optional: path };
}

function pathOf(file: FileName): string {
  return typeof file === 'string' ? file : file.optional;
}

/** The paths of a set of named files. */
export function filePaths(files: Readonly<Record<string, FileName>>): string[] {
  return Object.values(files).map(pathOf);
}
```

Replace `filesFor` and `loadNamedFiles`:

```ts
/**
 * Each named file's contents under its name, or null while a file that is not
 * optional is missing. A missing optional file is null.
 */
export function filesFor<D>(files: Readonly<Record<string, FileName>>, loaded: Loaded): D | null {
  const named = Object.entries(files);
  if (!named.every(([, file]) => typeof file !== 'string' || loaded.has(file))) return null;
  return Object.fromEntries(
    named.map(([name, file]) => [name, loaded.get(pathOf(file)) ?? null]),
  ) as D;
}

/** Load the named files and give them under their names; throw naming any required one that is missing. */
export async function loadNamedFiles<D>(files: Readonly<Record<string, FileName>>): Promise<D> {
  const loaded = await loadFiles(filePaths(files));
  const data = filesFor<D>(files, loaded);
  if (!data) {
    const missing = Object.values(files).filter(
      (file): file is string => typeof file === 'string' && !loaded.has(file),
    );
    throw new Error(`Could not load ${missing.join(', ')}`);
  }
  return data;
}
```

In `dataFor`, cast `overlay.data as Record<string, FileName>`. `overlayFiles` becomes:

```ts
export function overlayFiles(overlays: readonly Overlay[]): string[] {
  return overlays.flatMap((overlay) => filePaths((overlay.data ?? {}) as Record<string, FileName>));
}
```

- [ ] **Step 4: Optional files in the overlay type**

In `src/overlays/types.ts` add `import type { OptionalFile } from '../dataFiles.ts';` and change `OverlayWithData`:

```ts
// An overlay that reads files names each by its own short name, as a path under
// public/data/. The app loads every path once and hands the overlay D: each
// file's contents under its name. A file the overlay can work without is typed
// `T | null` in D and named with optional(); it is null until it arrives, and
// the overlay is not kept waiting for it. Whatever the overlay derives from its
// files it keeps per data value, so it goes with the data.
interface OverlayWithData<D> {
  data: FileNames<D>;
  // (prebuild and its comment unchanged)
}

type FileNames<D> = { readonly [K in keyof D]: null extends D[K] ? OptionalFile : string };
```

- [ ] **Step 5: The type-level cases**

Append to `src/overlays/types.check.ts` (and import `optional` from `'../dataFiles.ts'`):

```ts
interface WithParse {
  texts: string[];
  parse: { words: string[] } | null;
}

export const namesAnOptionalFile: Overlay<unknown, void, WithParse> = {
  id: 'e',
  name: 'E',
  data: { texts: 'a.json', parse: optional('b.json') },
  ...colour,
};

export const waitsForAFileItCanDoWithout: Overlay<unknown, void, WithParse> = {
  id: 'f',
  name: 'F',
  // @ts-expect-error A file the overlay takes as T | null is named with optional().
  data: { texts: 'a.json', parse: 'b.json' },
  ...colour,
};

export const doesWithoutAFileItNeeds: Overlay<unknown, void, WithParse> = {
  id: 'g',
  name: 'G',
  // @ts-expect-error A file the overlay cannot do without is named by its path.
  data: { texts: optional('a.json'), parse: optional('b.json') },
  ...colour,
};
```

Add `namesAnOptionalFile` to `anyOverlay`. If `tsc` reports either expected error on another line than the comment's, move the comment to that line; `npm run typecheck` must report no error and no unused `@ts-expect-error`.

- [ ] **Step 6: Run everything**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts` — Expected: PASS.
Run: prettier on the changed files, `npm run typecheck` (no errors), `npx vitest run` (all pass).

- [ ] **Step 7: Commit**

```bash
git add src/dataFiles.ts src/overlays/types.ts src/overlays/types.check.ts src/__tests__/unit/dataFiles.test.ts
git commit -m "Let an overlay name a file it can work without"
```

---

### Task 2: A search term keeps the meanings chosen, not looked up *(draws)*

The term model changes here, on its own, because the bugs search has had live in it. The dictionary is still module state in this task; Task 3 hands it over.

**Files:**
- Modify: `src/search/terms.ts`, `src/overlays/search/termRows.ts`, `src/overlays/search/index.ts` (hover text only), `src/overlays/search/recording.ts`, `src/__tests__/helpers/meaningsSearch.ts`
- Test: `src/__tests__/unit/search-terms.test.ts`, `src/__tests__/unit/search-meaning-url.test.ts`, `src/__tests__/unit/overlays/search-recording.test.ts`

**Interfaces:**
- Consumes: `meaningsFor(form)`, `sameMeaning`, `meaningsInVerse(form, verseKey, wordIndex?)`, `versesFor(keys)` (module-state versions, unchanged here).
- Produces: `SearchTerm.chosen`; `meaningsOf(term)`, `chosenAmong(rows, term)`, `chosenMeanings(term)`, `toggleMeaning(terms, id, keys)`; `selectedKeys`, `isNarrowed`, `termQuery` read `chosen`; `onlyMeaning`, `allMeanings`, `encodeMeanings` (a copy of `chosen`) and `applyMeanings` (a split) need no dictionary. Task 3 adds a leading `dictionary` argument to `meaningsOf`, `chosenMeanings`, `toggleMeaning`, `selectedKeys`, `isNarrowed`, `termQuery`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/search-terms.test.ts` (add `meaningsOf`, `chosenMeanings` to the terms import, and `sameMeaning`, `versesFor` to the dictionary import):

```ts
describe('the meanings a term has chosen', () => {
  it('are every meaning until the reader narrows them', () => {
    const [aleh] = addTerm([], 'עלה');
    expect(aleh.chosen).toBeNull();
    expect(chosenMeanings(aleh)).toEqual(meaningsOf(aleh));
  });

  it('go back to every meaning when the reader checks them all again', () => {
    let terms = addTerm([], 'עלה');
    const leafage = meaningsOf(terms[0]).find((m) => m.gloss === 'leafage')!;
    terms = toggleMeaning(terms, terms[0].id, leafage.keys);
    terms = toggleMeaning(terms, terms[0].id, leafage.keys);
    expect(terms[0].chosen).toBeNull();
  });

  it("keep a link's keys as written, known to the dictionary or not", () => {
    const restored = applyMeanings(addTerm([], 'עלה'), 'GONE@heb|<LH/@heb');
    expect(restored[0].chosen).toEqual(['GONE@heb', '<LH/@heb']);
  });

  it('are forgotten when the text changes', () => {
    let terms = addTerm([], 'עלה');
    terms = onlyMeaning(terms, terms[0].id, ['<LH/@heb']);
    terms = setTermText(terms, terms[0].id, 'שכם');
    expect(terms[0].chosen).toBeNull();
  });
});

describe('a reading picked in the word menu', () => {
  // Genesis 34:4 holds one of ETCBC's two entries for Shechem the man. The
  // spelling's own list merges both into one row; the verse's list heads the
  // same reading with the entry it holds.
  const VERSE = 'Genesis:34:4';
  const fromVerse = () => meaningsInVerse('שכם', VERSE).find((m) => m.gloss === 'Shechem')!;

  function pickedInMenu(): SearchTerm[] {
    const terms = addTerm([], 'שכם');
    return onlyMeaning(terms, terms[0].id, fromVerse().keys);
  }

  function pickedInPanel(): SearchTerm[] {
    const terms = addTerm([], 'שכם');
    const row = meaningsOf(terms[0]).find((m) => sameMeaning(m, fromVerse().keys))!;
    return onlyMeaning(terms, terms[0].id, row.keys);
  }

  const reopened = (terms: SearchTerm[]) => applyMeanings(addTerm([], 'שכם'), encodeMeanings(terms));

  it('is headed by another key in the verse than in the term', () => {
    const own = meaningsOf(addTerm([], 'שכם')[0]).find((m) => sameMeaning(m, fromVerse().keys))!;
    expect(fromVerse().keys[0]).not.toBe(own.keys[0]);
  });

  it('checks the row picking it in the panel checks, and finds its verses', () => {
    const [menu] = pickedInMenu();
    const [panel] = pickedInPanel();
    expect(chosenMeanings(menu)).toEqual(chosenMeanings(panel));
    expect(versesFor(selectedKeys(menu))).toEqual(versesFor(selectedKeys(panel)));
  });

  it('comes back from a link as the same row', () => {
    const [panel] = pickedInPanel();
    expect(chosenMeanings(reopened(pickedInMenu())[0])).toEqual(chosenMeanings(panel));
    expect(chosenMeanings(reopened(pickedInPanel())[0])).toEqual(chosenMeanings(panel));
  });
});

// The `m` each kind of choice writes, and that the link reopens to the same
// search. Where `m` differs from what the code wrote before terms kept their
// choices as keys, the test says what it wrote then; those are the expected
// shifts the pull request lists.
describe('the m a choice writes', () => {
  /** A choice made on `before`, written into a link and read back onto fresh terms of the same words. */
  function reopens(before: SearchTerm[]): void {
    const after = applyMeanings(
      before.map((t) => addTerm([], t.text)[0]),
      encodeMeanings(before),
    );
    after.forEach((term, i) => {
      expect(chosenMeanings(term)).toEqual(chosenMeanings(before[i]));
      expect(versesFor(selectedKeys(term))).toEqual(versesFor(selectedKeys(before[i])));
    });
  }

  it('writes the key of a word of one meaning picked from the menu', () => {
    // Wrote nothing before: the one row was every row.
    const fromVerse = meaningsInVerse('כוש', 'Genesis:10:7')[0];
    const terms = addTerm([], 'כוש');
    const picked = onlyMeaning(terms, terms[0].id, fromVerse.keys);
    expect(encodeMeanings(picked)).toBe(fromVerse.keys.join('|'));
    reopens(picked);
  });

  it('writes the key it was given for part of a merged row picked from the menu', () => {
    // Wrote the term's whole row before, CKM=/@heb|CKM==/@heb.
    const fromVerse = meaningsInVerse('שכם', 'Genesis:34:4').find((m) => m.gloss === 'Shechem')!;
    const terms = addTerm([], 'שכם');
    const picked = onlyMeaning(terms, terms[0].id, fromVerse.keys);
    expect(encodeMeanings(picked)).toBe('CKM==/@heb');
    reopens(picked);
  });

  it('writes the row picked in the panel, and an empty entry for the term beside it', () => {
    // Unchanged.
    const terms = addTerm(addTerm([], 'עלה'), 'שכם');
    const burntOffering = meaningsOf(terms[0]).find((m) => m.gloss === 'burnt-offering')!;
    const picked = onlyMeaning(terms, terms[0].id, burntOffering.keys);
    expect(encodeMeanings(picked)).toBe('<LH/@heb,');
    reopens(picked);
  });

  it('writes a narrowed link back as it was written', () => {
    // Unchanged for a link the app wrote.
    const link = '<LH/@heb,CKM=/@heb|CKM==/@heb';
    const opened = applyMeanings(addTerm(addTerm([], 'עלה'), 'שכם'), link);
    expect(encodeMeanings(opened)).toBe(link);
    reopens(opened);
  });

  it("writes a link's key for part of a merged row back as given", () => {
    // Wrote the whole row before, CKM=/@heb|CKM==/@heb.
    const opened = applyMeanings(addTerm([], 'שכם'), 'CKM==/@heb');
    expect(encodeMeanings(opened)).toBe('CKM==/@heb');
    reopens(opened);
  });

  it('writes back a link naming no meaning the word has, which still means every meaning', () => {
    // Wrote nothing before.
    const opened = applyMeanings(addTerm([], 'עלה'), 'GONE@heb');
    expect(encodeMeanings(opened)).toBe('GONE@heb');
    expect(chosenMeanings(opened[0])).toEqual(meaningsOf(opened[0]));
    reopens(opened);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/search-terms.test.ts`
Expected: FAIL — `meaningsOf is not a function` (and `chosen` undefined).

- [ ] **Step 3: `chosen` in `src/search/terms.ts`**

Replace the `SearchTerm` interface:

```ts
export interface SearchTerm {
  /** Stable for the life of the term; survives edits to its text. */
  id: string;
  /** What the reader typed. */
  text: string;
  /** Position in SEARCH_COLORS, held for the term's life. */
  colorIndex: number;
  /**
   * How this term is matched, or null while the reader has not said.
   *
   * (keep the existing paragraph about null not being substring)
   */
  mode: SearchMode | null;
  /**
   * The meanings chosen, as dictionary keys; null when every meaning is.
   *
   * Kept as the reader or the link gave them and never looked up, so a term
   * made before the dictionary is in loses nothing. A row counts as chosen when
   * it shares a key with this list (sameMeaning); a list naming no row the term
   * has counts every row as chosen.
   */
  chosen: string[] | null;
}
```

Delete `resolve`. In `addTerm` the new term is `{ id: \`t${nextId++}\`, text, colorIndex: freeColor(terms), mode: null, chosen: null }`. In `setTermText`, the doc comment's first sentence becomes "Change a term's text, which chooses every meaning of the new text.", the inline comment's last sentence becomes "Trimming happens where it matters: looking up meanings, and building the query.", and `edited` becomes `{ ...terms[index], text: replacement[0], chosen: null }`.

Replace `toggleMeaning`, `selectedKeys`, `encodeMeanings`, `applyMeanings`, `onlyMeaning`, `allMeanings` and `isNarrowed`, and add `meaningsOf`, `chosenAmong`, `chosenMeanings`, keeping each existing doc comment except where shown:

```ts
/** The dictionary words this term's text could be, likeliest reading first. */
export function meaningsOf(term: SearchTerm): Meaning[] {
  return meaningsFor(term.text.trim());
}

/** Which of `rows`, the term's own meanings, count as chosen. */
export function chosenAmong(rows: Meaning[], term: SearchTerm): Meaning[] {
  const { chosen } = term;
  if (chosen === null) return rows;
  const named = rows.filter((m) => sameMeaning(m, chosen));
  return named.length > 0 ? named : rows;
}

/** The term's meanings that count as chosen. */
export function chosenMeanings(term: SearchTerm): Meaning[] {
  return chosenAmong(meaningsOf(term), term);
}

/**
 * Check or uncheck one meaning of one term, named by any of its keys.
 *
 * Unchecking the last checked meaning does nothing. A term matching nothing by
 * construction is a dead state with no reading, so the last checkbox holds.
 * Checking every meaning again leaves nothing narrowed.
 */
export function toggleMeaning(
  terms: SearchTerm[],
  id: string,
  keys: readonly string[],
): SearchTerm[] {
  return terms.map((t) => {
    if (t.id !== id) return t;

    const rows = meaningsOf(t);
    const row = rows.find((m) => sameMeaning(m, keys));
    if (!row) return t;

    const current = chosenAmong(rows, t);
    const checked = current.includes(row);
    if (checked && current.length === 1) return t;

    const next = rows.filter((m) => (m === row ? !checked : current.includes(m)));
    return { ...t, chosen: next.length === rows.length ? null : next.flatMap((m) => m.keys) };
  });
}

export function selectedKeys(term: SearchTerm): string[] {
  return chosenMeanings(term).flatMap((m) => m.keys);
}
```

`encodeMeanings` keeps its doc comment, with "The keys go in as they are." becoming "The keys go in as `chosen` holds them, so writing a link needs no dictionary.", and becomes:

```ts
export function encodeMeanings(terms: SearchTerm[]): string {
  const narrowed = terms.map((t) => t.chosen?.join('|') ?? '');
  return narrowed.some((entry) => entry !== '') ? narrowed.join(',') : '';
}

/**
 * Apply an `m` parameter to a freshly built term list: each entry becomes that
 * term's `chosen`, as written. An empty entry leaves the term on every meaning.
 */
export function applyMeanings(terms: SearchTerm[], encoded: string): SearchTerm[] {
  if (!encoded) return terms;

  const perTerm = encoded.split(',');
  return terms.map((term, i) => (perTerm[i] ? { ...term, chosen: perTerm[i].split('|') } : term));
}

/**
 * Narrow a term to a single meaning, named by every lexeme its row stands for.
 *
 * Unchecking the others one at a time is fine for the 91% of ambiguous forms
 * that offer two or three, and tedious for the rest — אלה offers ten.
 *
 * The keys can come from a row this term does not hold: a reader choosing from
 * the word panel picks a row the verse built, and the verse's list can head a
 * reading with another lexeme, or hold fewer of a merged row's lexemes, than
 * the term's own list. They are kept as given; wherever the choice is read,
 * sameMeaning finds the term's row by any lexeme the two share.
 */
export function onlyMeaning(
  terms: SearchTerm[],
  id: string,
  keys: readonly string[],
): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, chosen: [...keys] } : t));
}

/** Put every meaning back, undoing a narrowing. */
export function allMeanings(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, chosen: null } : t));
}

export function isNarrowed(term: SearchTerm): boolean {
  const rows = meaningsOf(term);
  return rows.length > 1 && chosenAmong(rows, term).length < rows.length;
}
```

In `termQuery`, `term.meanings.length > 0` becomes `meaningsOf(term).length > 0`.

- [ ] **Step 4: The panel reads `chosen`**

In `src/overlays/search/termRows.ts`, import `type Meaning` from `'../../search/dictionary.ts'` and `meaningsOf`, `chosenAmong` from `'../../search/terms.ts'`. `buildMeaningRow` takes `meaning: Meaning`, and its checkbox handler becomes `host?.edit((terms) => toggleMeaning(terms, term.id, meaning.keys));`. Replace `termSummary`, `meaningSignature` and `renderMeanings` (keep their comments):

```ts
function termSummary(term: SearchTerm): string {
  const mode = MODE_LABELS[effectiveMode(term)];

  // (comment unchanged)
  const rows = meaningsOf(term);
  if (!meaningsApply(term) || rows.length < 2) return mode;

  // (comment unchanged)
  if (!isNarrowed(term)) return `${mode} · all ${rows.length} meanings`;

  const chosen = chosenAmong(rows, term)
    .map((m) => m.gloss)
    .join(', ');
  return chosen ? `${mode} · ${chosen}` : mode;
}

function meaningSignature(term: SearchTerm, rows: Meaning[]): string {
  if (!meaningsApply(term) || rows.length < 2) return '';
  return rows.map((m) => m.keys[0]).join(',');
}

function renderMeanings(row: HTMLElement, term: SearchTerm): void {
  const rows = meaningsOf(term);
  const signature = meaningSignature(term, rows);

  if (row.dataset.meanings !== signature) {
    row.dataset.meanings = signature;
    row.querySelector('.term-meanings')?.remove();

    if (signature) {
      const list = document.createElement('div');
      list.className = 'term-meanings';
      for (const meaning of rows) {
        list.appendChild(buildMeaningRow(term, meaning));
      }
      row.appendChild(list);
    }
  }

  if (!signature) return;

  const chosen = chosenAmong(rows, term);
  const boxes = row.querySelectorAll<HTMLInputElement>('.meaning-row input');
  rows.forEach((meaning, i) => {
    const box = boxes[i];
    if (!box) return;
    box.checked = chosen.includes(meaning);
    // (the "Locked with a class" comment unchanged)
    const locked = box.checked && chosen.length === 1;
    box.closest('.meaning-row')?.classList.toggle('locked', locked);
    box.title = locked ? 'The last meaning cannot be unchecked' : '';
  });
}
```

`rows` is looked up once per call and compared by identity within it; Task 3 makes `meaningsFor` return the same objects every time.

- [ ] **Step 5: The hover text, the record, the helper**

In `src/overlays/search/index.ts`'s `getHoverInfo`, import `chosenMeanings` and replace the `here` computation:

```ts
      const here = chosenMeanings(term)
        .filter((m) => versesFor(m.keys).has(key))
        .map((m) => m.gloss);
```

In `src/overlays/search/recording.ts`, a term's record no longer needs the dictionary:

```ts
import { ENGLISH, HEBREW } from '../../types.ts';
import { effectiveMode, meaningsApply, termIsHebrew, type SearchTerm } from '../../search/terms.ts';

/** What a term is recorded as: what was typed and chosen, none of it looked up. */
function recordOf(term: SearchTerm): string {
  return JSON.stringify({
    text: term.text.trim(),
    language: termIsHebrew(term) ? HEBREW : ENGLISH,
    mode: effectiveMode(term),
    // Chosen meanings narrow a term only while it is matched by its meanings.
    chosen: meaningsApply(term) ? term.chosen : null,
  });
}
```

and `termsToRecord`'s doc comment says "whose record differs from `previous`" instead of naming `termQuery`.

In `src/__tests__/helpers/meaningsSearch.ts`, `term.meanings.length > 0` becomes `meaningsOf(term).length > 0` (import `meaningsOf`).

- [ ] **Step 6: Convert the tests that read `meanings` and `selected`**

`src/__tests__/unit/search-terms.test.ts`, mechanically:
- `X.meanings` → `meaningsOf(X)`.
- `X.selected.size` → `chosenMeanings(X).length`.
- `X.selected.has(k)` → `chosenMeanings(X).some((m) => m.keys.includes(k))`.
- `toggleMeaning(terms, id, m.keys[0])` → `toggleMeaning(terms, id, m.keys)`.
- In "restores what was narrowed", `expect(restored[1].selected.size).toBe(terms[1].selected.size)` → `expect(chosenMeanings(restored[1])).toEqual(chosenMeanings(terms[1]))`.
- Rename "resolves its meanings and starts with all of them selected" to "offers its meanings, all of them chosen".

`src/__tests__/unit/search-meaning-url.test.ts`: `narrowedTerm(keys)` returns `{ ...term, chosen: keys }` (its second parameter goes); `roundTrip` resets with `terms.map((t) => ({ ...t, chosen: null }))`; the first test's assertions become `expect(restored[0].chosen).toEqual(['<LH/@heb'])` and `expect(restored[1].chosen).toEqual(['>MR[@heb'])`; the second test calls `narrowedTerm(['<LH/@heb'])`. Delete "falls back to every meaning when the link names nothing it knows": the fallback is a rule of a term's rows, pinned in `search-terms.test.ts`; this file has no dictionary. Drop the unused `selectedKeys` import. Log the deletion (rule 1).

`src/__tests__/unit/overlays/search-recording.test.ts`: delete the `meaning` helper and the `Meaning` import, and replace the two meaning tests:

```ts
  it('sends a term whose chosen meanings changed', () => {
    const [both] = addTerm([], 'עלה');
    const { recorded } = termsToRecord(none, [both]);
    const narrowed = { ...both, chosen: ['a'] };
    expect(termsToRecord(recorded, [narrowed]).send).toEqual([narrowed]);
  });

  it('does not send a term whose chosen meanings changed while it is matched by its text', () => {
    const [plain] = addTerm([], 'עלה');
    const both: SearchTerm = { ...plain, mode: 'substring' };
    const { recorded } = termsToRecord(none, [both]);
    const narrowed = { ...both, chosen: ['a'] };
    expect(termsToRecord(recorded, [narrowed]).send).toEqual([]);
  });
```

`git grep -nE "\.meanings\b|\.selected\b|selected:" -- src` must then find nothing but `src/analytics.ts`, `src/wordMenu.ts` (the menu's own options), `trop.css`, `trop.test.ts` and `view-state-restore.test.ts` (none about terms).

- [ ] **Step 7: Run everything**

Run: `npx vitest run src/__tests__/unit/search-terms.test.ts src/__tests__/unit/search-meaning-url.test.ts src/__tests__/unit/overlays/search-recording.test.ts` — Expected: PASS.
Run: prettier, `npm run typecheck`, `npx vitest run` — Expected: all pass. Every changed expected value is logged.
Run: `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: per `layout-check.md`.

- [ ] **Step 8: Commit**

```bash
git add src/search/terms.ts src/overlays/search src/__tests__/helpers/meaningsSearch.ts src/__tests__/unit/search-terms.test.ts src/__tests__/unit/search-meaning-url.test.ts src/__tests__/unit/overlays/search-recording.test.ts docs/plans/2026-09-30-search-data-design.md
git commit -m "A search term keeps the meanings chosen, as keys, not the meanings looked up"
```

---

### Task 3: Search receives its text index and dictionary *(draws)*

The widest task: the functions in `src/search.ts` and `src/search/dictionary.ts` take the value they read, so every caller moves at once. The per-word parse stays module state until Task 5; recording stays in the overlay until Task 6.

**Files:**
- Create: `src/search/data.ts`, `src/__tests__/helpers/searchData.ts`, `src/__tests__/unit/search-data.test.ts`, `src/__tests__/unit/overlays/search-without-data.test.ts`
- Modify: `src/search.ts`, `src/search/dictionary.ts`, `src/search/terms.ts`, `src/overlays/search/{index,highlight,resultsList,termRows}.ts`, `src/overlays/index.ts`, `src/dataFiles.ts` (header comment), `src/main.ts`, `scripts/print/views.ts`, `scripts/print/__tests__/views.test.ts`, `scripts/search/click-resolution-report.ts`, `test-harness/main.ts`, `src/__tests__/helpers/{fixtures,meaningsSearch}.ts`, and the tests in Step 10's table
- Test: the two new files and `src/__tests__/unit/tools.test.ts`

**Interfaces:**
- Consumes: `optional`, `FileName`, `loadNamedFiles` (Task 1); `SearchTerm.chosen`, `chosenAmong` and friends (Task 2).
- Produces: everything under "Shared names" for `search.ts`, `dictionary.ts` (dictionary half), `data.ts` (without `parse`), `terms.ts`, `searchTool` with `D = SearchData`, `activeTerms`, `termHitCount`, and the test helpers (without `parse`).

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit/search-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDictionary, buildTextIndex, type LexiconFile } from '../../search';
import { searchTool } from '../../overlays/search/index';
import { settingsFromLink } from '../../overlays/settings';
import { SEARCH_COLORS } from '../../utils/color';
import { createVerse } from '../helpers/fixtures';
import { searchDataFor } from '../helpers/searchData';
import type { VerseTexts } from '../../verseTexts';

const texts: VerseTexts = {
  Genesis: {
    1: {
      1: { he: 'קול גדול', en: 'a great voice' },
      2: { he: 'דבר אחר', en: 'another thing' },
    },
  },
};

/** A dictionary of one word, קול, filed under Genesis 1:2 alone. */
const lexicon: LexiconFile = { source: 'test', lexemes: [['QWL/', 'קוֹל', 'voice', 'subs', 'heb']] };
const forms = { 'קול': [0] };
const verseLexemes = { 'Genesis:1:2': [0] };

describe('what search builds from its files', () => {
  it('builds one text index per texts value', () => {
    expect(buildTextIndex(texts)).toBe(buildTextIndex(texts));
    expect(buildTextIndex({ ...texts })).not.toBe(buildTextIndex(texts));
  });

  it('builds one dictionary per set of files', () => {
    expect(buildDictionary(lexicon, forms, verseLexemes)).toBe(
      buildDictionary(lexicon, forms, verseLexemes),
    );
    expect(buildDictionary(lexicon, { ...forms }, verseLexemes)).not.toBe(
      buildDictionary(lexicon, forms, verseLexemes),
    );
  });
});

describe('one search over two dictionaries', () => {
  it('gives each dictionary its own answer', () => {
    const settings = settingsFromLink(searchTool, { search: 'קול' });
    const verses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
    ];
    const unknown = searchDataFor(texts);
    const known = searchDataFor(texts, { lexicon, forms, verseLexemes });

    // Unknown to the dictionary the word is matched by its spelling; known, by
    // the verses the dictionary files it under.
    expect(searchTool.colorsFor(verses, settings, null, unknown)).toEqual([SEARCH_COLORS[0], null]);
    expect(searchTool.colorsFor(verses, settings, null, known)).toEqual([null, SEARCH_COLORS[0]]);
    expect(searchTool.colorsFor(verses, settings, null, unknown)).toEqual([SEARCH_COLORS[0], null]);
  });
});
```

`src/__tests__/unit/overlays/search-without-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { searchTool } from '../../../overlays/search/index';
import { hostOverlay } from '../../helpers/overlayHost';
import { realSearchData } from '../../helpers/searchData';

describe('the search panel without its data', () => {
  it('shows the terms as typed and their modes, and nothing looked up', () => {
    const host = hostOverlay(searchTool, null);
    host.restore({ search: 'עלה, light', mode: 'm,w' });
    const panel = host.renderControls();

    expect(panel.querySelector<HTMLInputElement>('.term-input')!.value).toBe('עלה');
    expect(panel.querySelector('.term-row[data-open="true"] .term-mode-option.on')).not.toBeNull();
    expect(panel.querySelectorAll('.meaning-row')).toHaveLength(0);
    expect([...panel.querySelectorAll('.term-count')].map((c) => c.textContent)).toEqual(['', '']);
    expect(panel.querySelector('#search-hit-caption')!.textContent).toBe('');
    expect(panel.querySelector('#search-results')!.classList.contains('visible')).toBe(false);
  });

  it('fills in the meanings, counts and results once it is handed the data', () => {
    const host = hostOverlay(searchTool, null);
    host.restore({ search: 'עלה' });
    const panel = host.renderControls();

    host.setData(realSearchData().files);

    expect(panel.querySelectorAll('.meaning-row').length).toBeGreaterThan(1);
    expect(panel.querySelector('.term-count')!.textContent).not.toBe('');
    expect(panel.querySelector('#search-results')!.classList.contains('visible')).toBe(true);
  });
});
```

In `src/__tests__/unit/tools.test.ts`, every `toolsShown` call that expects the search to be shown passes `SAMPLE_LOADED` (import it from `../helpers/fixtures`) instead of `new Map()`, and add:

```ts
  it('leaves the search out while its files are missing', () => {
    expect(
      toolsShown(null, undefined, settingsFromLink(searchTool, { search: 'אור' }), new Map()).search,
    ).toBeNull();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/search-data.test.ts src/__tests__/unit/overlays/search-without-data.test.ts src/__tests__/unit/tools.test.ts`
Expected: FAIL — `buildTextIndex` is not exported and `../helpers/searchData` does not resolve; the new tools test fails because the search names no files yet.

- [ ] **Step 3: `src/search.ts` takes the index and the dictionary**

Change the file header to:

```ts
// Full-text search over Hebrew and English.
// Meanings mode resolves a written form to the ETCBC BHSA lexemes it can be.
//
// Search reads two values built from its files: the text index, from the verse
// texts, and the dictionary, from the three lexeme files. Each is built by a
// plain function of its files and kept per file value, so the same files give
// the same object and every function here is handed the one it reads.
```

Delete the module variables `searchIndex`, `verseKeyToEntry`, `lexicon`, `lexemeSpellings`, `formToLexemes`, `verseToLexemes`, `lexemeToVerses`, `spellingToLexemes`, the `fetchData` import, `loadLexiconData` and `getLexemeVerseCount`. Export `LexiconFile`. Add, after `Lexeme`:

```ts
/** Every verse folded for matching, in book order, and each by its key. */
export interface TextIndex {
  entries: IndexEntry[];
  byKey: Map<string, IndexEntry>;
}

/** Written form (nikkud stripped, finals folded) -> the lexemes it can be, likeliest reading first. */
export type FormsFile = Record<string, LexemeId[]>;

/** Verse key -> the lexemes occurring in that verse. */
export type VerseLexemesFile = Record<string, LexemeId[]>;

/** The three lexeme files, and what is worked out from them. */
export interface Dictionary {
  /** Parallel to lexicon.json's rows: a LexemeId is a position here. */
  lexemes: Lexeme[];
  formToLexemes: FormsFile;
  verseToLexemes: VerseLexemesFile;
  /** Lexeme -> the verses it occurs in: a meanings search is one lookup per lexeme. */
  lexemeToVerses: Map<LexemeId, Set<string>>;
  /** Consonantal dictionary spelling -> lexemes, for a reader who types a bare root. */
  spellingToLexemes: Map<string, LexemeId[]>;
  /** A lexeme's key (lexemeKey) -> the lexeme. */
  keyToLexeme: Map<string, LexemeId>;
}

/**
 * How a lexeme is named outside the dictionary: ETCBC's identifier and its
 * language. See search/dictionary.ts for why the language is part of it.
 */
export function lexemeKey(lexeme: Lexeme): string {
  return `${lexeme.id}@${lexeme.language}`;
}

const dictionaries = new WeakMap<
  LexiconFile,
  WeakMap<FormsFile, WeakMap<VerseLexemesFile, Dictionary>>
>();

/** The dictionary these files describe. The same files give the same object. */
export function buildDictionary(
  lexicon: LexiconFile,
  forms: FormsFile,
  verseLexemes: VerseLexemesFile,
): Dictionary {
  let byForms = dictionaries.get(lexicon);
  if (!byForms) {
    byForms = new WeakMap();
    dictionaries.set(lexicon, byForms);
  }
  let byVerses = byForms.get(forms);
  if (!byVerses) {
    byVerses = new WeakMap();
    byForms.set(forms, byVerses);
  }
  let dictionary = byVerses.get(verseLexemes);
  if (!dictionary) {
    dictionary = dictionaryFrom(lexicon, forms, verseLexemes);
    byVerses.set(verseLexemes, dictionary);
  }
  return dictionary;
}

function dictionaryFrom(
  lexicon: LexiconFile,
  forms: FormsFile,
  verseLexemes: VerseLexemesFile,
): Dictionary {
  const lexemes = lexicon.lexemes.map(([id, form, gloss, pos, language]) => ({
    id,
    form,
    gloss,
    pos,
    language,
  }));
  return {
    lexemes,
    formToLexemes: forms,
    verseToLexemes: verseLexemes,
    lexemeToVerses: buildVerseIndex(verseLexemes),
    spellingToLexemes: buildSpellingIndex(lexemes.map((l) => normalizeHebrewForSearch(l.form))),
    keyToLexeme: new Map(lexemes.map((lexeme, id) => [lexemeKey(lexeme), id])),
  };
}
```

`buildVerseIndex` and `buildSpellingIndex` keep their bodies minus the `performance.now()` timing and the `console.log` lines (ruling 10). Replace `buildSearchIndex` with:

```ts
const textIndexes = new WeakMap<VerseTexts, TextIndex>();

/** The verses folded for matching, in book order. The same texts give the same object. */
export function buildTextIndex(texts: VerseTexts): TextIndex {
  let index = textIndexes.get(texts);
  if (!index) {
    index = textIndexFrom(texts);
    textIndexes.set(texts, index);
  }
  return index;
}

function textIndexFrom(verseTexts: VerseTexts): TextIndex {
  const entries: IndexEntry[] = [];
  const byKey = new Map<string, IndexEntry>();
  // (today's buildSearchIndex body, pushing to `entries` and setting `byKey`)
  return { entries, byKey };
}
```

Each remaining function takes its value first and reads it instead of module state, its body otherwise unchanged:
- `findLexemesForWord(dictionary, hebrewWord)` — no `if (!formToLexemes) return null;`; calls `lookupFormOrSpelling(dictionary, …)`, which reads `dictionary.formToLexemes[term]` and `dictionary.spellingToLexemes.get(term)`.
- `getLexeme(dictionary, id)` → `dictionary.lexemes[id] ?? null`.
- `getVerseLexemes(dictionary, verseKey)` → `dictionary.verseToLexemes[verseKey] ?? null`; its doc comment's last sentence becomes "Null when the dictionary has no entry for the verse, which callers treat as "cannot say" rather than as "none"."
- `searchByLexemes(dictionary, lexemes)` reads `dictionary.lexemeToVerses`.
- `versesForTerm(index, text, language, mode)` loops over `index.entries`.
- `resultsForVerseSets(index, termVerseKeys, termLanguages?)` reads `index.byKey`.
- `computeSnippetForMatch(index, dictionary, result, searchTerm)` reads `index.byKey` and calls `findLexemesForWord(dictionary, …)` both times.

- [ ] **Step 4: `src/search/dictionary.ts` takes the dictionary**

Import `findLexemesForWord, getLexeme, getVerseLexemes, lexemeKey, searchByLexemes, type Dictionary, type Lexeme, type LexemeId` from `'../search.ts'`. Delete `keyToLexeme` and `lexemeForKey`. Then:

```ts
function keyOf(dictionary: Dictionary, id: LexemeId): string | null {
  const lexeme = getLexeme(dictionary, id);
  return lexeme ? lexemeKey(lexeme) : null;
}

/** How many verses a lexeme occurs in: one lookup, cheap enough beside every candidate meaning. */
function verseCountOf(dictionary: Dictionary, id: LexemeId): number {
  return dictionary.lexemeToVerses.get(id)?.size ?? 0;
}
```

`rowsFor(dictionary, ids)` passes the dictionary to `getLexeme`, `keyOf`, `verseCountOf` (for `getLexemeVerseCount`) and `searchByLexemes`. `meaningsFor` keeps the rows it makes:

```ts
const meaningsByForm = new WeakMap<Dictionary, Map<string, Meaning[]>>();

/**
 * (existing doc comment, plus:)
 *
 * Kept per dictionary and form, so a panel drawing a term's rows is handed the
 * same objects every time. Callers must not change them.
 */
export function meaningsFor(dictionary: Dictionary, writtenForm: string): Meaning[] {
  let byForm = meaningsByForm.get(dictionary);
  if (!byForm) {
    byForm = new Map();
    meaningsByForm.set(dictionary, byForm);
  }
  let meanings = byForm.get(writtenForm);
  if (!meanings) {
    const ids = findLexemesForWord(dictionary, writtenForm);
    meanings = ids ? rowsFor(dictionary, ids) : [];
    byForm.set(writtenForm, meanings);
  }
  return meanings;
}
```

`meaningsInVerse(dictionary, writtenForm, verseKey, wordIndex?)`, `rowForStem(dictionary, stem, writtenForm)`, `versesFor(dictionary, keys)`, `formMatches(dictionary, keys, writtenForm)`, `lexemesForKeys(dictionary, keys)` (reading `dictionary.keyToLexeme.get(key)`) and `wordMatches(dictionary, keys, writtenForm, verseText, wordStart)` take the dictionary first and pass it on; their bodies are otherwise unchanged. In `rowForStem`, `rowsFor(candidates)` with `candidates = findLexemesForWord(writtenForm) ?? []` becomes `meaningsFor(dictionary, writtenForm)` — the same list, now the same objects as the term's own rows. The parse code (`loadMorphology` to `stemOfWord`) is unchanged in this task.

- [ ] **Step 5: `src/search/terms.ts` takes the dictionary**

Import `type Dictionary` from `'../search.ts'`. `meaningsOf`, `chosenMeanings`, `toggleMeaning`, `selectedKeys`, `isNarrowed` and `termQuery` take `dictionary: Dictionary` first and pass it to every call of each other and of `meaningsFor(dictionary, …)`. `chosenAmong`, `onlyMeaning`, `allMeanings`, `encodeMeanings`, `applyMeanings` and the rest are unchanged: writing and reading a link need no dictionary.

- [ ] **Step 6: `src/search/data.ts`**

```ts
// Search's files, and the text index and dictionary it builds from them.
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import {
  buildDictionary,
  buildTextIndex,
  type Dictionary,
  type FormsFile,
  type LexiconFile,
  type TextIndex,
  type VerseLexemesFile,
} from '../search.ts';

/** What search reads: the verse texts and the three lexeme files. */
export interface SearchData {
  texts: VerseTexts;
  lexicon: LexiconFile;
  forms: FormsFile;
  verseLexemes: VerseLexemesFile;
}

export const SEARCH_FILES = {
  texts: TEXTS_FILE,
  lexicon: 'search/lexicon.json',
  forms: 'search/word-lexemes.json',
  verseLexemes: 'search/verse-lexemes.json',
} as const;

export function textIndexOf(data: SearchData): TextIndex {
  return buildTextIndex(data.texts);
}

export function dictionaryOf(data: SearchData): Dictionary {
  return buildDictionary(data.lexicon, data.forms, data.verseLexemes);
}
```

- [ ] **Step 7: The overlay is handed its data**

`src/overlays/search/index.ts`. Import `computeSnippetForMatch`, `type Dictionary`, `type TextIndex` from `'../../search.ts'`, `dictionaryOf`, `SEARCH_FILES`, `textIndexOf`, `type SearchData` from `'../../search/data.ts'`, and `chosenMeanings` from terms. Then:

```ts
/** The terms the search runs: those holding a word, not a single letter. */
export function activeTerms(settings: SearchSettings): SearchTerm[] {
  return settings.terms.filter((t) => isSearchableWord(t.text));
}

// Per text index and dictionary, then per settings: the same settings with
// another dictionary are another search. Every function in terms.ts returns a
// new list, so settings are never edited in place.
const searches = new WeakMap<TextIndex, WeakMap<Dictionary, (settings: SearchSettings) => Search>>();

function searchFor(data: SearchData, settings: SearchSettings): Search {
  const index = textIndexOf(data);
  const dictionary = dictionaryOf(data);
  let byDictionary = searches.get(index);
  if (!byDictionary) {
    byDictionary = new WeakMap();
    searches.set(index, byDictionary);
  }
  let search = byDictionary.get(dictionary);
  if (!search) {
    search = memoByValue((s: SearchSettings): Search => {
      const active = activeTerms(s);
      return { active, ...matchesForTerms(index, dictionary, active) };
    });
    byDictionary.set(dictionary, search);
  }
  return search(settings);
}
```

- `openTermIndex(settings)` uses `activeTerms(settings).indexOf(open)` (the same term objects as `searchFor`'s `active`).
- `resultsForOpenRow(data, settings)` uses `searchFor(data, settings)`.
- `matchesForTerms(index, dictionary, active)` calls `termQuery(dictionary, term)`, `versesFor(dictionary, meaningKeys)`, `versesForTerm(index, …)`, `resultsForVerseSets(index, …)`.
- Add `let shownData: SearchData | null = null;` beside `shown`.
- `recordSettledSearch` reads `const data = shownData;`, returns when `!settings || !data`, uses `searchFor(data, settings).active`, `termQuery(dictionaryOf(data), term)` and `termHitCount(data, settings, term)`. `searchOnMap` uses `activeTerms(settings)`.
- `termHitCount(data, settings, term)` is exported and reads `searchFor(data, settings)`.
- `updateHitCaption(settings, data)` begins `if (!data) { searchHitCaption.textContent = ''; return; }` after its existing guard, and reads `searchFor(data, settings)` and `resultsForOpenRow(data, settings)`.
- `renderResults(settings, data)`:

```ts
function renderResults(settings: SearchSettings, data: SearchData | null): void {
  if (!searchResults) return;

  if (!data) {
    renderResultsList(searchResults, {
      results: [],
      terms: [],
      focus: -1,
      onSelect: showVerse,
      snippet: () => null,
    });
    return;
  }

  const index = textIndexOf(data);
  const dictionary = dictionaryOf(data);
  renderResultsList(searchResults, {
    results: resultsForOpenRow(data, settings),
    terms: searchFor(data, settings).active,
    focus: openTermIndex(settings),
    onSelect: showVerse,
    snippet: (result, term) => computeSnippetForMatch(index, dictionary, result, term),
  });
}
```

- `openRow` redraws with `renderResults(shown, shownData)` and `updateHitCaption(shown, shownData)`.
- `termRowsHost` gains `dictionary: () => (shownData ? dictionaryOf(shownData) : null)`, and `hitCount: (term) => (shown && shownData ? termHitCount(shownData, shown, term) : null)`.
- Delete the exported `highlightSearchTerms`; remove it from `src/overlays/index.ts`'s re-export line.

The members:

```ts
export const searchTool: Overlay<TanakhIdentity, SearchSettings, SearchData> = {
  // id, name, credits unchanged

  data: SEARCH_FILES,

  prebuild(data) {
    textIndexOf(data);
    dictionaryOf(data);
  },

  getVerseColor(verse, settings, data) {
    return searchColorAt(verse, searchFor(data, settings));
  },

  colorsFor(items, settings, _hovered, data) {
    const search = searchFor(data, settings);
    return items.map((item) => searchColorAt(item, search));
  },
```

`summary(settings)` and `settingsToUrl(settings)` read `activeTerms(settings)` instead of `searchFor(settings).active`. `renderControls(container, settings, onChange, data)` keeps both what it was last drawn with:

```ts
  renderControls(container, settings, onChange, data) {
    const previous = shown;
    const previousData = shownData;
    shown = settings;
    shownData = data;
    // (searchOnMap, requestChange and the build block unchanged)
    } else if (settings === previous && data === previousData) {
      // Nothing has changed, and redrawing the list would scroll it to the top.
      return;
    }

    renderTermRows();
    updateHitCaption(settings, data);
    renderResults(settings, data);
    if (searchClear) searchClear.disabled = typedTerms(settings).length === 0;
  },
```

`getHoverInfo(verse, settings, data)` reads `searchFor(data, settings)` and, with `const dictionary = dictionaryOf(data);`, filters `chosenMeanings(dictionary, term)` by `versesFor(dictionary, m.keys).has(key)`. `destroy` also sets `shownData = null`. `highlightVerseText(text, language, settings, data)` returns `highlightTerms(text, language, searchFor(data, settings).active, dictionaryOf(data))`.

`src/overlays/search/highlight.ts`: `highlightTerms(text, language, terms, dictionary: Dictionary)` passes the dictionary to `findAllTermMatches(text, terms, isHebrew, dictionary)`, which calls `selectedKeys(dictionary, term)` and `wordMatches(dictionary, keys, word, text, start)`.

`src/overlays/search/resultsList.ts`: drop the `computeSnippetForMatch` import. `ResultsView` gains

```ts
  /** The snippet around `term` in a result's verse, or null for a verse the index lacks. */
  snippet(result: SearchResult, term: string): { snippet: string; matchStart: number; matchEnd: number } | null;
```

and `createResultElement` calls `view.snippet(result, view.terms[firstMatch.termIndex]?.text ?? '')`.

`src/overlays/search/termRows.ts`: `TermRowsHost` gains

```ts
  /** The dictionary the rows' meanings come from, or null while search's data is missing. */
  dictionary(): Dictionary | null;
```

`termSummary(term, dictionary: Dictionary | null)` returns the bare mode when `!dictionary || !meaningsApply(term)`, then reads `meaningsOf(dictionary, term)` and `isNarrowed(dictionary, term)`. `renderMeanings(row, term, dictionary: Dictionary | null)` takes `const rows = dictionary ? meaningsOf(dictionary, term) : [];`. The checkbox handler in `buildMeaningRow` becomes:

```ts
  box.addEventListener('change', () => {
    const dictionary = host?.dictionary();
    if (dictionary) host?.edit((terms) => toggleMeaning(dictionary, terms, term.id, meaning.keys));
  });
```

`updateCollapsedRow` passes `host?.dictionary() ?? null` to `termSummary`; `updateOpenRow` takes `const dictionary = host?.dictionary() ?? null;`, sets `all.hidden = !dictionary || !isNarrowed(dictionary, term);` and calls `renderMeanings(body, term, dictionary)`.

- [ ] **Step 8: Main loads search's files**

In `src/main.ts`:
- Drop the `buildSearchIndex, loadLexiconData` import, `loadLexiconData()` from the startup wait and the `buildSearchIndex(verseTexts);` line. Main's startup `loadFiles` gathers `overlayFiles([searchTool, ...getAllOverlays()])` instead of `overlayFiles(getAllOverlays())`.
- `searchChanged` hands the panel `dataFor(searchTool, loaded)` instead of `undefined`.
- The word-click handler begins:

```ts
  setWordClickHandler((click) => {
    const data = dataFor(searchTool, loaded);
    // Without search's files there is no search to add the word to.
    if (!data) return;
    const word = lookupForm(click.text);
    const meanings = meaningsInVerse(
      dictionaryOf(data),
      word,
      tanakhKey(click.book, click.chapter, click.verse),
      click.index,
    );
```

(import `dictionaryOf` from `'./search/data.ts'`).
- `prebuildAll(getAllOverlays(), loaded)` becomes `prebuildAll([searchTool, ...getAllOverlays()], loaded)`.

In `src/dataFiles.ts` the header comment names search among the loader's users and no longer says search loads its own files.

- [ ] **Step 9: The print, the click report and the harness**

`scripts/print/views.ts`: import `buildDictionary, findLexemesForWord, getLexeme, searchByLexemes, type Dictionary` from `'../../src/search.ts'` and `SEARCH_FILES, type SearchData` from `'../../src/search/data.ts'`; drop `loadLexiconData`. Add, and use in `searchSheet` (`const dictionary = await loadDictionary();` then `nameVerses(dictionary, n.he, n.en)`):

```ts
/** Search's dictionary, from its three files loaded as the site loads them. */
export async function loadDictionary(): Promise<Dictionary> {
  const { lexicon, forms, verseLexemes } = await loadNamedFiles<
    Pick<SearchData, 'lexicon' | 'forms' | 'verseLexemes'>
  >({
    lexicon: SEARCH_FILES.lexicon,
    forms: SEARCH_FILES.forms,
    verseLexemes: SEARCH_FILES.verseLexemes,
  });
  return buildDictionary(lexicon, forms, verseLexemes);
}

export function nameVerses(dictionary: Dictionary, he: string, gloss: string): Set<string> {
  const ids = (findLexemesForWord(dictionary, he) ?? []).filter(
    (id) => getLexeme(dictionary, id)?.gloss === gloss,
  );
  if (ids.length === 0) throw new Error(`No dictionary entry for ${he} glossed "${gloss}".`);
  return searchByLexemes(dictionary, ids);
}
```

`scripts/print/__tests__/views.test.ts`: the `searchSheet` describe's `beforeAll` sets `dictionary = await loadDictionary();` (declared `let dictionary: Dictionary;`), and both `nameVerses` calls take it first.

`scripts/search/click-resolution-report.ts`: add `import type { SearchData } from '../../src/search/data.ts';` at the top; replace the `loadLexiconData`/`getVerseLexemes` dynamic import with

```ts
const { loadNamedFiles } = await import('../../src/dataFiles.ts');
const { SEARCH_FILES, dictionaryOf } = await import('../../src/search/data.ts');
const { findLexemesForWord } = await import('../../src/search.ts');
```

`buildReport(texts, dictionary)` passes the dictionary to `meaningsInVerse` and `findLexemesForWord`. Replace the texts fetch, `await loadLexiconData()` and the "did not load" check with:

```ts
// Throws, naming the file, when one does not load: a report on a missing
// dictionary would print a confident 100% unknown.
const data = await loadNamedFiles<SearchData>(SEARCH_FILES);
const dictionary = dictionaryOf(data);
const texts = data.texts;
```

The parse wait keeps `setVerseOnScreen` and checks `meaningsInVerse(dictionary, 'בראשית', 'Genesis:1:1', 0)`; `buildReport(texts, dictionary)`.

`test-harness/main.ts`: drop the search-index and texts imports and lines; load and hand the data:

```ts
import { dataFor, loadFiles, overlayFiles } from '../src/dataFiles.ts';
// …
  const loaded = await loadFiles(overlayFiles([searchOverlay]));
  const data = dataFor(searchOverlay, loaded);
  logEvent('init', data ? 'Search data loaded' : 'Search data missing: see the console');
// …
      data,   // the renderControls argument that was `undefined`
```

Update its header comment's second line to "Loads search's real files and renders the real search controls".

- [ ] **Step 10: The test helpers, and the tests that built search's state**

`src/__tests__/helpers/searchData.ts`:

```ts
// Search's files for tests: the shipped ones, read from disk, or made-up texts
// with a dictionary that knows no word.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDictionary, type Dictionary, type TextIndex } from '../../search';
import { dictionaryOf, SEARCH_FILES, textIndexOf, type SearchData } from '../../search/data';
import type { VerseTexts } from '../../verseTexts';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data');
const read = <T>(path: string): T => JSON.parse(readFileSync(join(dataDir, path), 'utf8'));

/** The three lexeme files, holding no word: every term is matched by its text. */
export const EMPTY_DICTIONARY_FILES: Pick<SearchData, 'lexicon' | 'forms' | 'verseLexemes'> = {
  lexicon: { source: 'none', lexemes: [] },
  forms: {},
  verseLexemes: {},
};

export const EMPTY_DICTIONARY: Dictionary = buildDictionary(
  EMPTY_DICTIONARY_FILES.lexicon,
  EMPTY_DICTIONARY_FILES.forms,
  EMPTY_DICTIONARY_FILES.verseLexemes,
);

/** Search's files: these texts, with the files given or a dictionary that knows no word. */
export function searchDataFor(texts: VerseTexts, files: Partial<SearchData> = {}): SearchData {
  return { texts, ...EMPTY_DICTIONARY_FILES, ...files };
}

let real: { files: SearchData; index: TextIndex; dictionary: Dictionary } | null = null;

/** The shipped files, read once per test file, and what search builds from them. */
export function realSearchData(): { files: SearchData; index: TextIndex; dictionary: Dictionary } {
  if (!real) {
    const files: SearchData = {
      texts: read(SEARCH_FILES.texts),
      lexicon: read(SEARCH_FILES.lexicon),
      forms: read(SEARCH_FILES.forms),
      verseLexemes: read(SEARCH_FILES.verseLexemes),
    };
    real = { files, index: textIndexOf(files), dictionary: dictionaryOf(files) };
  }
  return real;
}
```

`src/__tests__/helpers/fixtures.ts`: `SAMPLE_LOADED` gains the empty dictionary files under search's paths (import `SEARCH_FILES` from `'../../search/data'` and `EMPTY_DICTIONARY_FILES` from `'./searchData'`):

```ts
  [SEARCH_FILES.lexicon, EMPTY_DICTIONARY_FILES.lexicon],
  [SEARCH_FILES.forms, EMPTY_DICTIONARY_FILES.forms],
  [SEARCH_FILES.verseLexemes, EMPTY_DICTIONARY_FILES.verseLexemes],
```

`src/__tests__/helpers/meaningsSearch.ts`: `searchInMeaningsMode(index: TextIndex, dictionary: Dictionary, query: string)`, passing `index` to `resultsForVerseSets` and `versesForTerm`, and `dictionary` to `meaningsOf`, `versesFor` and `selectedKeys`.

Then convert each test below. In each, the old setup line (`buildSearchIndex(x)`, `await loadLexiconData()`, a fetch mock for the lexicon) goes, and the new value is passed as the first argument wherever a changed function is called. `index` means `buildTextIndex(<that file's texts>)`, kept in a `let` where the texts are rebuilt per test; "real" means `const { files, index, dictionary } = realSearchData();` (only the names used); "empty" means `EMPTY_DICTIONARY`.

| File | Index | Dictionary | Also |
|---|---|---|---|
| search-bounds | its fixture | empty | |
| search-dictionary | — | real | |
| search-english-snippets | `texts` | empty | |
| search-final-forms | `mockVerseTexts` | — | |
| search-hebrew-modes | `mockVerseTexts` | empty | `searchInMeaningsMode(index, EMPTY_DICTIONARY, q)` |
| search-lazy-snippets | `mockVerseTexts` | empty | as above |
| search-matching | `texts` | — | host: `hostOverlay(overlay, searchDataFor({}))`, and `searchOverlay.setData(searchDataFor(texts))` where the index was built |
| search-meanings-mode | real | real | delete the `fs`/`path` imports, the paths, `dataExists`, `mockFetchForLexiconData` and `afterEach`; `describe.skipIf(!dataExists)` becomes `describe` |
| search-mixed-language | `ALL_TEXTS_FIXTURE` | real | `termQuery(dictionary, addTerm([], text)[0])` |
| search-normalization | — | real | |
| search-performance | `buildLargeVerseTexts(23000)` | empty | |
| search-terms | — | real | every `meaningsOf`, `chosenMeanings`, `toggleMeaning`, `selectedKeys`, `isNarrowed`, `meaningsInVerse`, `versesFor` call |
| search-verse-sets | `texts` | — | |
| search-wholeword | `mockVerseTexts`, and line 75's inline texts | — | |
| search/word-by-position | — | real | keep its texts/misaligned fetches and `setVerseOnScreen` until Task 5 |
| search/word-in-verse | — | real | |
| overlays/search | — | — | host: `hostOverlay(searchTool, searchDataFor({}))`; `searchOverlay.setData(searchDataFor(mockVerseTexts))` where the index was built; direct `searchOverlay.overlay.colorsFor!(…, null)` and `renderControls!(container, settings, cb)` calls gain `searchOverlay.data`; `hostOverlay(searchOverlay.overlay, undefined)` gets `searchOverlay.data` |
| overlays/search-marks-by-position | — | — | host data `realSearchData().files`; keep `setVerseOnScreen` until Task 5 |
| overlays/search-from-click | — | real | host data `{ ...realSearchData().files, texts }`; `meaningsInVerse(dictionary, …)` |
| overlays/search-meaning-filter | — | real | host data `{ ...realSearchData().files, texts }`; `meaningsFor(dictionary, …)` |
| overlays/search-term-colors | — | — | host data `searchDataFor(texts)` |
| integration/search-overlay-modes | — | — | host `searchDataFor({})`, `setData(searchDataFor(mockVerseTexts))` |
| performance/hebrew-search-perf | `buildLargeVerseTexts(5000)` | empty | |
| scrollytelling overlayBlender | — | — | delete `buildSearchIndex(SAMPLE_VERSE_TEXTS)`; the "a stop that searches" tests pass `SAMPLE_LOADED` |
| unit/sidebar | — | — | delete the dead `vi.mock('../../overlays/search/index.ts', …)` block |

Afterwards `git grep -nE "buildSearchIndex|loadLexiconData|getLexemeVerseCount|highlightSearchTerms" -- src scripts test-harness` finds only `interactive-search.manual.html`.

- [ ] **Step 11: Run everything**

Run: `npx vitest run src/__tests__/unit/search-data.test.ts src/__tests__/unit/overlays/search-without-data.test.ts src/__tests__/unit/tools.test.ts` — Expected: PASS.
Run: prettier, `npm run typecheck` (no errors — the harness and the print are typechecked), `npx vitest run` (all pass; every changed expected value logged).
Run: `node scripts/search/click-resolution-report.ts > <SDD>/report-task3.txt`, then `node <SDD>/compare-report.mjs <SDD>/report-before.txt <SDD>/report-task3.txt` — Expected: `IDENTICAL`.
Run: `npm run test:layout`, `node <SDD>/pixel-diff.mjs` — Expected: per `layout-check.md`.
Start your own dev server; run `node <SDD>/address-check.mjs <port> <SDD>/address-task3.txt <SDD>/view-task3.txt`, then `cmp <SDD>/view-before.txt <SDD>/view-task3.txt` — Expected: no output (each address opens the same view). Addresses may differ; note each difference for the PR. Keep the server for Step 12.

- [ ] **Step 12: Check the harness in a browser**

Start your own dev server (rule 9). Write `<SDD>/harness-check.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${process.argv[2]}/test-harness/`);
await page.waitForFunction(() => document.getElementById('log-entries')?.textContent?.includes('Ready'), null, { timeout: 60000 });
await page.fill('#search-input', 'עלה');
await page.waitForSelector('.meaning-row', { timeout: 10000 });
console.log(JSON.stringify({
  meanings: await page.locator('.meaning-row').count(),
  listed: await page.locator('#search-results.visible .search-result').count(),
  errors,
}));
await browser.close();
```

Run: `node <SDD>/harness-check.mjs <port>` — Expected: `meanings` above 1, `listed` above 0, `errors` empty. Stop your dev server.

- [ ] **Step 13: Commit**

```bash
git add src scripts test-harness docs/plans/2026-09-30-search-data-design.md
git commit -m "Hand search its text index and dictionary instead of keeping them in module state"
```

---

### Task 4: A story stop drawn before search's files

**Files:**
- Modify: `src/scrollytelling/overlayBlender.ts` (unless already keyed on `loaded`)
- Test: `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**
- Consumes: search naming its files (Task 3), `SAMPLE_LOADED`.
- Produces: `pictureForStop` keeps a picture per `loaded` value.

- [ ] **Step 1: Write the failing test**

Append to `src/scrollytelling/__tests__/overlayBlender.test.ts`:

```ts
describe('a stop that searches, drawn before search has its files', () => {
  const stop: ResolvedStoryStop = {
    id: 'early',
    text: '',
    camera: { x: 0, y: 0, zoom: 1 },
    overlay: null,
    searchParams: { search: 'God' },
  };
  const bare: ResolvedStoryStop = { ...stop, id: 'bare', searchParams: undefined };

  it('is drawn without the search, and with it once the files arrive', () => {
    expect(pictureForStop(stop, verses, null, new Map())).toEqual(
      pictureForStop(bare, verses, null, new Map()),
    );
    expect(pictureForStop(stop, verses, null, SAMPLE_LOADED).colors[0]).toEqual(SEARCH_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/scrollytelling/__tests__/overlayBlender.test.ts`
Expected: FAIL if the cache is keyed on the verses alone (the second call is handed the first picture). If it PASSES, step 1's review has already keyed the cache on `loaded`: skip Step 3, log that (rule 1), and commit the test alone.

- [ ] **Step 3: Key the cache on `loaded`**

```ts
// Memoised per loaded files and verses array, then by the stop's overlay, its
// search and their validated link parameters. (keep the rest of the comment.)
// Files arriving make a new loaded value, so a picture drawn without a file is
// never handed out once it is in.
const picturesCache = new WeakMap<Loaded, WeakMap<TanakhLayout[], Map<string, Picture>>>();

function cacheFor(loaded: Loaded, verses: TanakhLayout[]): Map<string, Picture> {
  let byVerses = picturesCache.get(loaded);
  if (!byVerses) {
    byVerses = new WeakMap();
    picturesCache.set(loaded, byVerses);
  }
  let cache = byVerses.get(verses);
  if (!cache) {
    cache = new Map();
    byVerses.set(verses, cache);
  }
  return cache;
}
```

In `pictureForStop`, `const cache = cacheFor(loaded, verses);` replaces the per-verses lookup, and the store becomes `if (!byHover) cache.set(key, picture);` (the not-kept check and its comment go). In the test file, the memo tests that call twice and count calls ("memoises colours by settings", "only skips the memo for a hover-responsive overlay") pass one shared `const NOTHING_LOADED: Loaded = new Map();` instead of a fresh `new Map()` per call.

- [ ] **Step 4: Run everything** — the file (PASS), prettier, typecheck, full suite.

- [ ] **Step 5: Commit**

```bash
git add src/scrollytelling docs/plans/2026-09-30-search-data-design.md
git commit -m "Draw a story stop again once search's files arrive"
```

---

### Task 5: The per-word parse as an optional file; highlighting takes the verse *(draws)*

**Files:**
- Modify: `src/search/dictionary.ts`, `src/search/data.ts`, `src/overlays/types.ts`, `src/overlays/search/{index,highlight}.ts`, `src/overlays/trop.ts`, `src/sidebar.ts`, `src/main.ts`, `scripts/search/click-resolution-report.ts`, `src/__tests__/helpers/{overlayHost,searchData}.ts`
- Test: `src/__tests__/unit/overlays/search-marks-by-position.test.ts`, `src/__tests__/unit/search/word-by-position.test.ts`, and the conversions in Step 7

**Interfaces:**
- Consumes: `optional` (Task 1), `SearchData`, `dictionaryOf` (Task 3).
- Produces: `MorphologyFile`, `Parse`, `buildParse`, `VerseWords`, `wordsOfVerse`; `meaningsInVerse(dictionary, words, …)`, `wordMatches(dictionary, words, …)`; `SearchData.parse`, `parseOf`; `highlightVerseText(verse, text, language, settings, data)`; `realSearchData().parse`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/overlays/search-marks-by-position.test.ts`: the host is `hostOverlay(searchTool, realSearchData().files)`; delete the `loadLexiconData`/`buildSearchIndex` `beforeAll` (`hebrew` becomes `realSearchData().files.texts['Genesis']['8']['20'].he`) and the two `setVerseOnScreen` lines from `beforeEach`; `marks()` calls `searchOverlay.highlightVerseText(createVerse({ book: 'Genesis', chapter: 8, verse: 20 }), hebrew, 'he')`. Add:

```ts
describe('marking a verse without the per-word parse', () => {
  it('lets the spelling decide, so the verb also claims the offering', () => {
    searchOverlay.setData({ ...realSearchData().files, parse: null });
    searchOverlay.restore({ search: 'עלה', m: ASCEND });

    expect(marks()).toEqual([
      ['term-0', 'ויעל'],
      ['term-0', 'עלת'],
    ]);
    searchOverlay.setData(realSearchData().files);
  });
});
```

In `src/__tests__/unit/search/word-by-position.test.ts`: `const { files, dictionary, parse } = realSearchData();`; `texts` is `files.texts` and `misaligned` is `files.parse!.misaligned`; the `beforeAll` goes. `markedWords` becomes:

```ts
const markedWords = (verseKey: string, keys: string[]): string[] => {
  const hebrew = hebrewOf(verseKey);
  const words = wordsOfVerse(parse, verseKey, hebrew);
  return splitIntoWords(stripNikkud(hebrew))
    .filter(({ word, start }) => wordMatches(dictionary, words, keys, word, hebrew, start))
    .map(({ word }) => word);
};
```

Every `setVerseOnScreen(verse, hebrewOf(verse))` followed by `meaningsInVerse(dictionary, form, verse, i)` becomes `meaningsInVerse(dictionary, wordsOfVerse(parse, verse, hebrewOf(verse)), form, verse, i)`; the call without a position in "falls back to the spelling in a verse that does not line up" passes `null` for the words. "leaves a verse it has no parse for to the spelling" uses `wordsOfVerse(parse, 'Nowhere:1:1', hebrew)`; "ignores a position in text that is not the verse on screen" uses `const words = wordsOfVerse(parse, 'Genesis:8:20', hebrewOf('Genesis:8:20'));` against the other verse's text. The whole-Tanakh test pushes the key when `wordsOfVerse(parse, verseKey, text.he ?? '') === null`. Add:

```ts
describe('the words of a verse', () => {
  it('are not named without the parse', () => {
    expect(wordsOfVerse(null, 'Genesis:8:20', hebrewOf('Genesis:8:20'))).toBeNull();
  });

  it('are the same object for the same parse and verse', () => {
    const hebrew = hebrewOf('Genesis:8:20');
    expect(wordsOfVerse(parse, 'Genesis:8:20', hebrew)).toBe(wordsOfVerse(parse, 'Genesis:8:20', hebrew));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/search-marks-by-position.test.ts src/__tests__/unit/search/word-by-position.test.ts`
Expected: FAIL — `wordsOfVerse` is not exported, and `realSearchData().parse` is undefined.

- [ ] **Step 3: The parse in `src/search/dictionary.ts`**

Replace everything from the "The word in front of the reader" banner to the end. Keep the banner's first paragraph; its second becomes: "It costs 4.5 MB, more than the other three files together, so search works without it: it is an optional file, and until it is in every answer here is the one the spelling gives." Delete `morphology`, `misaligned`, `loading`, `settled`, `loadMorphology`, `prefetchMorphology`, `onScreen`, `setVerseOnScreen`, `verseOnScreen`, `wordsAreNamed`, and the `fetchData` and `whenIdle` imports. Keep `KETIV` and `wordsBhsaParsed`. Add:

```ts
/** morphemes as [lexeme, parsing], morphemes per printed word, maqaf positions. */
type ParsedVerse = [Array<[LexemeId, number]>, number[], number[]];

/** verse-morphology.json. */
export interface MorphologyFile {
  misaligned: string[];
  verses: Record<string, ParsedVerse>;
}

/** The per-word parse, ready to look a verse up in. */
export interface Parse {
  verses: Record<string, ParsedVerse>;
  /** The verses BHSA and Sefaria divide into words differently. */
  misaligned: Set<string>;
}

const parses = new WeakMap<MorphologyFile, Parse>();

/** The parse this file holds. The same file gives the same object. */
export function buildParse(file: MorphologyFile): Parse {
  let parse = parses.get(file);
  if (!parse) {
    parse = { verses: file.verses, misaligned: new Set(file.misaligned) };
    parses.set(file, parse);
  }
  return parse;
}

/** A verse's Hebrew, and the dictionary word each printed word is, by where it starts. */
export interface VerseWords {
  verseKey: string;
  hebrew: string;
  stems: Map<number, LexemeId>;
}

const linedUp = new WeakMap<Parse, Map<string, VerseWords | null>>();

/**
 * The dictionary word each printed word of this verse is, or null when the
 * parse is not in, the verse is one the two sources divide differently, or the
 * word counts disagree. Kept per parse and verse.
 */
export function wordsOfVerse(
  parse: Parse | null,
  verseKey: string,
  hebrew: string,
): VerseWords | null {
  if (!parse) return null;
  let seen = linedUp.get(parse);
  if (!seen) {
    seen = new Map();
    linedUp.set(parse, seen);
  }
  const key = `${verseKey}\u0000${hebrew}`;
  if (!seen.has(key)) {
    const stems = stemsOf(parse, verseKey, hebrew);
    seen.set(key, stems && { verseKey, hebrew, stems });
  }
  return seen.get(key) ?? null;
}
```

`stemsOf(parse, verseKey, hebrew)` reads `parse.verses[verseKey]` and `parse.misaligned`; the rest of its body and comment are unchanged. Then:

```ts
/** The dictionary word at a position in this text, if these are its words. */
function stemAt(words: VerseWords | null, verseText: string, wordStart: number): LexemeId | null {
  if (!words || words.hebrew !== verseText) return null;
  return words.stems.get(wordStart) ?? null;
}

/** The nth printed word of a verse, as BHSA parsed it. */
function stemOfWord(words: VerseWords | null, verseKey: string, wordIndex: number): LexemeId | null {
  if (!words || words.verseKey !== verseKey) return null;
  const word = verseWords(words.hebrew)[wordIndex];
  return word ? (words.stems.get(word.start) ?? null) : null;
}
```

`meaningsInVerse(dictionary, words: VerseWords | null, writtenForm, verseKey, wordIndex?)` calls `stemOfWord(words, verseKey, wordIndex)`; its doc comment's "It needs the verse to be the one `setVerseOnScreen` last named, and its parse to have arrived." becomes "It needs the verse's words (wordsOfVerse)." `wordMatches(dictionary, words: VerseWords | null, keys, writtenForm, verseText, wordStart)` calls `stemAt(words, verseText, mapStrippedToOriginal(verseText, wordStart))`; its doc comment's "or the moments before the parse has loaded" becomes "or a verse drawn without the parse".

- [ ] **Step 4: Search names the parse; highlighting takes the verse**

`src/search/data.ts`: import `optional` from `'../dataFiles.ts'` and `buildParse, type MorphologyFile, type Parse` from `'./dictionary.ts'`. `SearchData` gains `parse: MorphologyFile | null;` (its comment: "What search reads: the verse texts, the three lexeme files, and the per-word parse, which it can work without."), `SEARCH_FILES` gains `parse: optional('search/verse-morphology.json'),`, and:

```ts
export function parseOf(data: SearchData): Parse | null {
  return data.parse && buildParse(data.parse);
}
```

`src/overlays/types.ts`: `highlightVerseText?(verse: T, text: string, language: TextLanguage, settings: S, data: D): DocumentFragment;` with the comment "Marks words by their place in the verse, so it is handed the verse as well as its text."

`src/overlays/search/highlight.ts`: `highlightTerms(text, language, terms, dictionary, words: VerseWords | null)` passes `words` through `findAllTermMatches` to `wordMatches(dictionary, words, keys, word, text, start)`.

`src/overlays/search/index.ts` (import `HEBREW` from `'../../types.ts'`, `wordsOfVerse` from `'../../search/dictionary.ts'`, `parseOf` from `'../../search/data.ts'`):

```ts
  highlightVerseText(verse, text, language, settings, data) {
    const words =
      language === HEBREW
        ? wordsOfVerse(parseOf(data), tanakhKey(verse.book, verse.chapter, verse.verse), text)
        : null;
    return highlightTerms(text, language, searchFor(data, settings).active, dictionaryOf(data), words);
  },
```

`src/overlays/trop.ts`: `highlightVerseText(_verse, text: string, language: TextLanguage, settings, data)`.

`src/sidebar.ts`: both `highlightVerseText` calls pass `verse` first. Delete the `setVerseOnScreen` block and its comment, and the `setVerseOnScreen, verseOnScreen` and (if now unused) `tanakhKey` imports.

`src/main.ts`: drop `prefetchMorphology` (import and call). The word-click handler hands over the verse's words:

```ts
    const verseKey = tanakhKey(click.book, click.chapter, click.verse);
    const hebrew = getVerseText(data.texts, click.book, click.chapter, click.verse)?.he ?? '';
    const meanings = meaningsInVerse(
      dictionaryOf(data),
      wordsOfVerse(parseOf(data), verseKey, hebrew),
      word,
      verseKey,
      click.index,
    );
```

(import `wordsOfVerse` from `'./search/dictionary.ts'`, `parseOf` from `'./search/data.ts'`, `getVerseText` from `'./verseTexts.ts'`). Startup now also waits for the parse, since `overlayFiles` lists optional files (ruling 1).

`scripts/search/click-resolution-report.ts`: import `meaningsInVerse, wordsOfVerse` and `parseOf`; `buildReport(texts, dictionary, parse)` sets `const words = wordsOfVerse(parse, verseKey, text.he);` per verse (replacing `setVerseOnScreen`) and calls `meaningsInVerse(dictionary, words, form, verseKey, wordIndex)`. Replace the parse wait with:

```ts
// Every number below is about what a click finds once the per-word parse is
// here; without it the report would measure the fallback under it.
const parse = parseOf(data);
if (!parse) {
  console.error('The per-word parse did not load. The numbers below would be meaningless.');
  process.exit(1);
}
```

and call `buildReport(texts, dictionary, parse)`.

- [ ] **Step 5: The test helpers**

`src/__tests__/helpers/searchData.ts`: `searchDataFor` returns `{ texts, ...EMPTY_DICTIONARY_FILES, parse: null, ...files }`; `realSearchData` reads `parse: read(SEARCH_FILES.parse.optional)` into `files` and returns `parse: parseOf(files)!` beside `index` and `dictionary` (its return type gains `parse: Parse`).

`src/__tests__/helpers/overlayHost.ts`: `highlightVerseText(verse: TanakhIdentity, text: string, language: TextLanguage): DocumentFragment` in the interface, calling `overlay.highlightVerseText(verse, text, language, store.get(overlay), held)`.

- [ ] **Step 6: Run the new tests** — Expected: PASS.

- [ ] **Step 7: Convert the remaining calls**

- Every `searchOverlay.highlightVerseText(text, language)` and `host.highlightVerseText(text, language)` in `overlays/search.test.ts` (16), `search-matching.test.ts`, `overlays/search-term-colors.test.ts`, `overlays/search-meaning-filter.test.ts` (2) and `overlays/trop.test.ts` (3) takes a verse first: `createVerse()` (Genesis 1:1) unless the test names a verse.
- `unit/sidebar.test.ts`: every `toHaveBeenCalledWith(text, language, settings, data)` on `highlightVerseText` gains the verse first, and every mock implementation of it takes `_verse` first.
- `search-terms.test.ts`, `overlays/search-from-click.test.ts`, `search/word-in-verse.test.ts`: every `meaningsInVerse(dictionary, form, verse…)` passes `null` as the words, the spelling's reading these tests pin.

`git grep -nE "setVerseOnScreen|verseOnScreen|wordsAreNamed|prefetchMorphology" -- src scripts test-harness` must find nothing.

- [ ] **Step 8: Run everything**

Run: prettier, `npm run typecheck`, `npx vitest run` — Expected: all pass.
Run: `node scripts/search/click-resolution-report.ts > <SDD>/report-task5.txt` and `node <SDD>/compare-report.mjs <SDD>/report-before.txt <SDD>/report-task5.txt` — Expected: `IDENTICAL`.
Run: `npm run test:layout`, `node <SDD>/pixel-diff.mjs` — Expected: per `layout-check.md`.
Start your own dev server; run `node <SDD>/popup-check.mjs <port> <SDD>/popup-task5.txt`, then `cmp <SDD>/popup-before.txt <SDD>/popup-task5.txt` — Expected: no output. Stop your dev server.

- [ ] **Step 9: Commit**

```bash
git add src scripts docs/plans/2026-09-30-search-data-design.md
git commit -m "Hand search the per-word parse as an optional file, and the verse to highlight"
```

---

### Task 6: Main records searches *(draws)*

**Files:**
- Modify: `src/overlays/search/recording.ts`, `src/overlays/search/index.ts`, `src/main.ts`
- Test: `src/__tests__/unit/overlays/search-recording.test.ts`, `src/__tests__/unit/overlays/search.test.ts` (its "Recording a search" describe goes)

**Interfaces:**
- Consumes: `activeTerms`, `termHitCount`, `dictionaryOf`, `termQuery(dictionary, term)`, `termsToRecord`.
- Produces: `SearchRecorder`, `createSearchRecorder`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/overlays/search-recording.test.ts` (imports: `afterEach, beforeEach, vi` from vitest; `createSearchRecorder` from `'../../../overlays/search/recording'`; `type SearchSettings` from `'../../../overlays/search'`; `searchDataFor` from `'../../helpers/searchData'`):

```ts
describe('createSearchRecorder', () => {
  const DELAY = 1000;
  const data = searchDataFor({
    Genesis: {
      1: { 1: { he: 'א', en: 'the heavens and the earth' }, 2: { he: 'א', en: 'the heavens' } },
      2: { 1: { he: 'א', en: 'the names' } },
    },
  });
  let sent: [string, number][];
  let recorder: ReturnType<typeof createSearchRecorder>;

  const search = (...words: string[]): SearchSettings => ({ terms: words.reduce(addTerm, []) });

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    recorder = createSearchRecorder({
      delayMs: DELAY,
      send: (text, _language, _mode, hits) => sent.push([text, hits]),
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sends a search once it has sat for the delay, with each term’s count', () => {
    recorder.readerChanged(search('heavens'), data);
    vi.advanceTimersByTime(DELAY - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it('sends only the term added, each with its own count', () => {
    const one = search('heavens');
    recorder.readerChanged(one, data);
    vi.advanceTimersByTime(DELAY);
    recorder.readerChanged({ terms: addTerm(one.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([
      ['heavens', 2],
      ['names', 1],
    ]);
  });

  it('sends nothing for a term too short to search on', () => {
    recorder.readerChanged(search('h'), data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
  });

  it('sends a term again when how it is matched changes', () => {
    const before = search('heavens');
    recorder.readerChanged(before, data);
    vi.advanceTimersByTime(DELAY);
    recorder.readerChanged({ terms: setMode(before.terms, before.terms[0].id, 'word') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent.map(([text]) => text)).toEqual(['heavens', 'heavens']);
  });

  it("does not send a link's terms when the reader adds another", () => {
    const link = search('heavens');
    recorder.replaced(link, data);
    recorder.readerChanged({ terms: addTerm(link.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['names', 1]]);
  });

  it('drops a search a link replaces before it settles', () => {
    recorder.readerChanged(search('hea'), data);
    recorder.replaced(search('earth'), data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
  });

  it('sends a search typed before the data once the data arrives, with its count', () => {
    recorder.readerChanged(search('heavens'), null);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
    recorder.dataChanged(data);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it('waits for the search to settle even when the data arrives first', () => {
    recorder.readerChanged(search('heavens'), null);
    recorder.dataChanged(data);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it("counts a link's terms as sent before the data arrives", () => {
    const link = search('heavens');
    recorder.replaced(link, null);
    recorder.dataChanged(data);
    recorder.readerChanged({ terms: addTerm(link.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['names', 1]]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/search-recording.test.ts`
Expected: FAIL — `createSearchRecorder is not a function`.

- [ ] **Step 3: The recorder**

Change `src/overlays/search/recording.ts`'s header to "Which searched terms are worth an analytics event, and when: once the reader has stopped changing the search and search has its data." and add:

```ts
import type { TextLanguage } from '../../types.ts';
import { termQuery, type SearchMode } from '../../search/terms.ts';
import { dictionaryOf, type SearchData } from '../../search/data.ts';
import { activeTerms, termHitCount, type SearchSettings } from './index.ts';

export interface SearchRecorder {
  /** The reader changed the search: send it once it has sat unchanged and its data is in. */
  readerChanged(settings: SearchSettings, data: SearchData | null): void;
  /** A link or a story stop replaced the search: its terms count as sent, and a search waiting is dropped. */
  replaced(settings: SearchSettings, data: SearchData | null): void;
  /** Search's data changed: a search waiting only for it is sent now. */
  dataChanged(data: SearchData | null): void;
}

export function createSearchRecorder(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): SearchRecorder {
  let recorded: Recorded = new Map();
  /** The reader's last change, not yet sent. */
  let waiting: SearchSettings | null = null;
  let settled = false;
  let data: SearchData | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function sendIfReady(): void {
    if (!waiting || !settled || !data) return;
    const settings = waiting;
    waiting = null;
    const { send, recorded: next } = termsToRecord(recorded, activeTerms(settings));
    recorded = next;
    const dictionary = dictionaryOf(data);
    for (const term of send) {
      const { language, mode } = termQuery(dictionary, term);
      options.send(term.text, language, mode, termHitCount(data, settings, term)!);
    }
  }

  return {
    readerChanged(settings, next) {
      cancel();
      waiting = settings;
      settled = false;
      data = next;
      timer = setTimeout(() => {
        timer = null;
        settled = true;
        sendIfReady();
      }, options.delayMs);
    },
    replaced(settings, next) {
      cancel();
      waiting = null;
      data = next;
      recorded = termsToRecord(new Map(), activeTerms(settings)).recorded;
    },
    dataChanged(next) {
      data = next;
      sendIfReady();
    },
  };
}
```

- [ ] **Step 4: The overlay stops recording**

In `src/overlays/search/index.ts` delete `recorded`, `lastChanged`, `recordSettledSearch`, `searchOnMap`, `readerChanged` and the imports only they used (`debounce`, `termsToRecord`, `Recorded`, `trackSearchExecute`, `SEARCH_RECORD_DELAY_MS`). `searchForMeaning` ends `return { terms };`. In `renderControls`, the `searchOnMap(settings);` call and the "Every change the panel asks for is the reader's." comment go, and `requestChange = onChange;`. `destroy` no longer cancels anything.

Delete the "Recording a search" describe from `src/__tests__/unit/overlays/search.test.ts`: its seven cases are the recorder's tests above. Keep "answers for a query it is handed without changing the search or firing analytics".

- [ ] **Step 5: Main owns the recorder**

In `src/main.ts`, import `createSearchRecorder` from `'./overlays/search/recording.ts'`, `SEARCH_RECORD_DELAY_MS` from `'./search/constants.ts'`, and `trackSearchExecute` with the other analytics imports. Before `searchChanged`:

```ts
  const searchRecorder = createSearchRecorder({
    delayMs: SEARCH_RECORD_DELAY_MS,
    send: trackSearchExecute,
  });
```

In `searchChanged`, the `fresh` branch also calls `searchRecorder.replaced(overlaySettings.get(searchTool), dataFor(searchTool, loaded));` — every search that is not the reader's comes through it (a link, Back/Forward, a story stop, startup). In `changeSearch`, after `overlaySettings.set(searchTool, after);`, call `searchRecorder.readerChanged(after, dataFor(searchTool, loaded));`. `dataChanged` has no caller until step 3 (ruling 14).

- [ ] **Step 6: Run everything**

Run: the recording test file (PASS), prettier, `npm run typecheck`, `npx vitest run`, `npm run test:layout` + `node <SDD>/pixel-diff.mjs`.

Check it in a browser: start your own dev server; with a scratch Playwright script, open `http://localhost:<port>/?search=light`, wait for `mapReady`, click `#add-term`, fill `.term-row[data-open="true"] .term-input` with `heavens`, wait 1.5 s, and collect `pageerror`s. Expected: none. The dev server sends no analytics, so what is sent is pinned by the unit tests above. Stop your dev server.

- [ ] **Step 7: Commit**

```bash
git add src docs/plans/2026-09-30-search-data-design.md
git commit -m "Record a search from main, once it has settled and search has its data"
```

---

### Task 7: Verify the whole branch and open the pull request

- [ ] **Step 1: The spec's "removed" list is gone**

Run each; Expected: no output (the manual page excepted where noted).

```bash
git grep -nE "loadLexiconData|buildSearchIndex|setVerseOnScreen|verseOnScreen|wordsAreNamed|prefetchMorphology|getLexemeVerseCount|highlightSearchTerms" -- src scripts test-harness ':!src/__tests__/performance/interactive-search.manual.html'
git grep -nE "\bselected\b.*Set|meanings: Meaning" -- src/search src/overlays/search
git grep -nE "^let (searchIndex|verseKeyToEntry|lexicon|formToLexemes|verseToLexemes|lexemeToVerses|spellingToLexemes|keyToLexeme|morphology|onScreen|recorded|lastChanged)\b" -- src
```

Run: `git diff --quiet worktree-overlay-data -- src/search/matching.ts` — Expected: exit 0.

- [ ] **Step 2: Full gates**

Run: `npm run typecheck`, `npx vitest run`, `npm run build` — Expected: all pass.
Run: `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: PASS, `git diff --quiet worktree-overlay-data -- layout/known.ts` exits 0, and every shot within `layout-check.md`'s noise.

- [ ] **Step 3: The after half of the comparisons**

Write `<SDD>/words-after.ts`, the same walk through the new API:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TEXTS } from './serve-public.ts';
import type { SearchData } from '../../../src/search/data.ts';

const { loadNamedFiles } = await import('../../../src/dataFiles.ts');
const { SEARCH_FILES, dictionaryOf, parseOf } = await import('../../../src/search/data.ts');
const { meaningsInVerse, wordsOfVerse } = await import('../../../src/search/dictionary.ts');
const { verseWords, lookupForm } = await import('../../../src/verseWords.ts');

const data = await loadNamedFiles<SearchData>(SEARCH_FILES);
const dictionary = dictionaryOf(data);
const parse = parseOf(data);

const lines: string[] = [];
for (const [book, chapters] of Object.entries(TEXTS)) {
  for (const [chapter, verses] of Object.entries(chapters)) {
    for (const [verse, { he }] of Object.entries(verses)) {
      const key = `${book}:${chapter}:${verse}`;
      const words = wordsOfVerse(parse, key, he);
      for (const [i, { word }] of verseWords(he).entries()) {
        const form = lookupForm(word);
        const rows = meaningsInVerse(dictionary, words, form, key, i).map(
          (m) => `${m.keys.join('|')}=${m.verseCount}`,
        );
        lines.push(`${key}\t${i}\t${form}\t${rows.join(' ')}`);
      }
    }
  }
}
writeFileSync(join(ROOT, '.superpowers/sdd/2026-09-30-search-data-implementation/words-after.txt'), `${lines.join('\n')}\n`);
console.log(`${lines.length} words`);
```

and `<SDD>/names-after.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve-public.ts';

const { loadDictionary, nameVerses } = await import('../../../scripts/print/views.ts');

const dictionary = await loadDictionary();
const names = [['אברהם', 'Abraham'], ['יצחק', 'Isaac'], ['יעקב', 'Jacob'], ['משה', 'Moses'], ['דוד', 'David']];
const lines = names.map(([he, en]) => `${en}\t${[...nameVerses(dictionary, he, en)].sort().join(' ')}`);
writeFileSync(join(ROOT, '.superpowers/sdd/2026-09-30-search-data-implementation/names-after.txt'), `${lines.join('\n')}\n`);
console.log(`${lines.length} names`);
```

Run, each Expected as noted (any difference is a stop, rule 2):
- `node scripts/search/click-resolution-report.ts > <SDD>/report-after.txt`, then `node <SDD>/compare-report.mjs <SDD>/report-before.txt <SDD>/report-after.txt` — `IDENTICAL`.
- `node <SDD>/words-after.ts`, then `cmp <SDD>/words-before.txt <SDD>/words-after.txt` — no output.
- `node <SDD>/names-after.ts`, then `cmp <SDD>/names-before.txt <SDD>/names-after.txt` — no output.
- Own dev server; `node <SDD>/popup-check.mjs <port> <SDD>/popup-after.txt`, then `cmp <SDD>/popup-before.txt <SDD>/popup-after.txt` — no output. `node <SDD>/address-check.mjs <port> <SDD>/address-after.txt <SDD>/view-after.txt`, then `cmp <SDD>/view-before.txt <SDD>/view-after.txt` — no output. Then `diff <SDD>/address-before.txt <SDD>/address-after.txt`: the differing addresses are expected shifts (the one-meaning menu pick now writes `m`; the merged-row menu pick and the link naming one key of a merged row write the key given); each goes into the PR, before and after. Any other difference is a stop. `node <SDD>/harness-check.mjs <port>` — as in Task 3. Stop the dev server.
- `npm run print` — Expected: PDFs written without error.

- [ ] **Step 4: Whole-branch review**

Per superpowers:subagent-driven-development, dispatch the final whole-branch reviewer with the spec, this plan and the Review Focus list, and a drift reviewer (anything said in two places that can drift apart). Tell both to push back rather than accept a claim in this plan they cannot verify. Fix what they find that the spec requires; log rulings per rule 1.

- [ ] **Step 5: Commit the screenshots**

Copy the shots of the states search touches — `explore-search`, `explore-search-and-overlay`, `explore-search-and-overlay-pinned`, `explore-search-overlay-switched`, `explore-verse-pinned`, `story-opening` (desktop and phone) — into `docs/plans/images/2026-09-30-search-data/` and commit them:

```bash
git add docs/plans/images/2026-09-30-search-data
git commit -m "Screenshots for the pull request: step 2 changes nothing on screen"
```

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin worktree-search-data
```

Write the PR body to `<SDD>/pr-body.md`, in plain prose (lead with the problem, then the approach; no coined terms):

- First line: `🤖 Claude:`
- What it does: search names its files and is handed them; the text index, dictionary and per-word parse are built from the files and passed to every function that reads them; a term keeps the meanings chosen as keys; highlighting is handed the verse; main records searches. Nothing on screen changes.
- `Step 2 of 3 toward #313.` Stacked on step 1's PR; review that first.
- Links: every link opens the view it opened before. `m` is now a copy of the keys a term was given, so a few addresses shift slightly; list each from `address-before.txt`/`address-after.txt`, before and after, with the view it opens (unchanged).
- Every expected test value that changed, and why (from the decision log).
- The before-and-after checks and their results: the click report's table, every word's meanings, the print's name sheet, the popup's marks and menus, the address after the four actions that write `m`.
- Links: the design doc and its "Open questions, assumptions and rulings" section by blob URL on the branch (`https://github.com/danyelf/torahmap/blob/worktree-search-data/docs/plans/2026-09-30-search-data-design.md#open-questions-assumptions-and-rulings`), and this plan.
- What to look at, and where: the Cloudflare preview link (it arrives as a comment from `cloudflare-workers-and-pages`; check with `gh pr view <n> --json comments` and add it once it lands): a search link, a narrowed search link, a pinned verse with a search, a word clicked in the popup. It should look exactly as on torahmap.org.
- The screenshots, embedded by commit-pinned URL, `![explore-search](https://raw.githubusercontent.com/danyelf/torahmap/<hash>/docs/plans/images/2026-09-30-search-data/explore-search.png)`, each with a one-line caption.
- Last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

```bash
gh pr create --base worktree-overlay-data --title "Search receives its data (step 2 of 3 toward #313)" --body-file <SDD>/pr-body.md
```

If `worktree-overlay-data` has already merged into `main`, use `--base main`. Expected: a PR URL. Confirm with `gh pr view --json number,url,body,baseRefName` that the body says `Step 2 of 3 toward #313` and contains none of `Closes #313`, `Fixes #313`, `Resolves #313`.

- [ ] **Step 7: Mark the issue**

```bash
gh issue comment 313 --body "🤖 Claude: step 2 of 3 is up for review as #<PR>, stacked on step 1. #313 stays open for step 3."
```

Leave #313's `in-progress` label.

- [ ] **Step 8: Report**

Send `team-lead` the PR URL, the test count before and after, every ruling logged, the before-and-after results, anything skipped (and why), and the preview link if it has arrived.

---

## Plan-writer rulings for Danyel to check

Each is also an entry in the design doc's decision log (Task 0).

1. **Startup also waits for the per-word parse.** Main loads every file the tools name, so the parse (4.5 MB, about 1 MB compressed) joins the startup wait and the idle prefetch goes. Until step 3 loads it last, a slow connection waits a little longer for the first frame. The alternative — keep loading it after the first frame — is step 3's mechanism built early.
2. **`m` is a copy of `chosen` (Danyel: minor address shifts are fine if the link opens the same view).** Writing joins `chosen`, reading splits it, and neither needs the dictionary. Shifts from before: a one-meaning word picked from the menu writes its key (was nothing); a merged row picked from the menu writes the key given (`CKM==/@heb`, was `CKM=/@heb|CKM==/@heb`); a link's `m` is written back as read (`CKM==/@heb` stays; `GONE@heb` stays, was nothing). Task 2 pins each case and its round trip to the same rows and verses; the browser check compares the view each address opens and the PR lists every shifted address.
3. `toggleMeaning` takes the row's keys, like `onlyMeaning`, instead of its first key.
4. `chosenAmong(rows, term)` and `chosenMeanings(dictionary, term)` are added to `terms.ts` (not in the design's list): the panel, hover text and row summary need "which rows count as chosen".
5. A term's telemetry record holds `chosen` only while the term is matched by meanings, so it records exactly the changes `termQuery` did.
6. `getLexemeVerseCount` moves into `dictionary.ts`, unexported (the design says unexported, but it lived in `search.ts` and `dictionary.ts` calls it).
7. The lexeme key format gets one home, `lexemeKey` in `search.ts`, used by both modules.
8. Search's paths, `SearchData` and the build-from-data functions live in a new CSS-free `src/search/data.ts`, so the print and the click report can import them under plain `node`.
9. The results list is handed a `snippet` function rather than the index and dictionary, so it can draw an empty list without data.
10. Building the index and dictionary logs nothing (today's "✓ Loaded/Built" console lines go); the click report is compared on its table.
11. Without data the caption is empty, "Type to search" included, as the design says ("no caption").
12. A word clicked with search's data missing opens no menu (today it offers the literal search); reachable only when a search file fails, which now turns search off.
13. `highlightSearchTerms` (exported, no caller) goes with its re-export and the sidebar test's dead mock.
14. The recorder's `dataChanged` is built and tested now; main first calls it in step 3.
15. The story blender keys its cache on `loaded` and drops the separate not-kept check, which the key makes redundant. Step 1's final review planned the same change; if it landed, Task 4 adds only the search test.
16. `interactive-search.manual.html` is left broken as it is (it already imports a `BOOK_ORDER` that does not exist); filed as a P4 issue.
17. Scripts run with `node file.ts`: `npm run report:click-resolution` calls `npx tsx`, which is not installed and would download.
