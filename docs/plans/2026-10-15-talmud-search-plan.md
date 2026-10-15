# Talmud search: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Talmud's map gets the Tanakh's search panel, minus meanings, by
moving that search into two packages that know no particular text.

**Architecture:** `@torahmap/hebrew` holds Hebrew's letter rules and its search
language. `@torahmap/search` holds the term search, `createTermSearch(spec)`,
which matches through the languages a text gives it and takes the Tanakh's
meanings mode as one plug-in object. Each task moves one slice and repoints the
Tanakh at it, so every commit builds and the Tanakh behaves as before.

**Tech stack:** TypeScript, npm workspaces, Vitest, Playwright layout tests.

**Spec:** `docs/plans/2026-10-15-talmud-search-design.md`

## Global constraints

- The Tanakh's search behaves exactly as now. Its tests are repointed, never
  weakened; a test that must change says why in the commit.
- A package imports only the packages its `package.json` lists
  (`test/package-imports.test.ts`). `@torahmap/search` names no text, no
  language but English, and nothing from `apps/`.
- `@torahmap/hebrew` imports no other package. Its search language matches
  `@torahmap/search`'s `SearchLanguage` by shape; the apps' typecheck is what
  checks it.
- Comments follow AGENTS.md: present tense, no ticket numbers, short.
- Commit each task alone; the pre-commit hook runs format, typecheck and tests.
- After adding a package, run `npm install` so the workspace links it.

## Review focus

1. **Tanakh whole-word results move at the section markers.** The new rule
   that any non-letter ends a Hebrew word changes the Tanakh only where its
   text has `{`, `}` (3,552 each, the `{פ}`/`{ס}` markers) or `—` (2).
   Task 2 measures whether any of them touches a letter.
2. **Prefix letters over-match.** With prefixes on, אמר also finds מאמר
   (a noun). Expected and accepted; the test pins that a prefix needs a word
   edge before it, so רבי does not find זרבי.
3. **A typed ״ splits a term.** `TERM_SEPARATORS` holds gershayim, so ק״ו
   becomes two terms. Davidson spells abbreviations out, so ק״ו finds nothing
   either way; the PR says so rather than changing the separator.
4. **The popup marks nothing for an abbreviated match.** A segment found
   through רבי whose Wikisource text writes ר׳ shows the popup unmarked, with
   no error. Task 7 tests it.
5. **A search before the file arrives.** A Talmud link with `search=` opens
   before `search.json` loads: the caption says it is loading and nothing is
   coloured until it lands. Task 7 tests it.

---

### Task 1: `@torahmap/hebrew`

Move Hebrew's letter rules out of the shell and the Tanakh's search.

**Files:**
- Create: `packages/hebrew/package.json`, `packages/hebrew/src/index.ts`
- Move: `packages/shell/src/hebrew.ts` → `packages/hebrew/src/letters.ts`
- Move: `apps/tanakh/src/search/spelling.ts` → `packages/hebrew/src/spelling.ts`
- Move: the tests of those two files to `packages/hebrew/test/`
- Modify: every importer (`grep -rn "shell/hebrew.ts\|spelling.ts" apps packages scripts test test-harness layout`)
- Modify: `package.json` of shell, tanakh, talmud: add `"@torahmap/hebrew": "*"`;
  remove `./hebrew.ts` from shell's exports

**Interfaces:**
- Produces: `@torahmap/hebrew` exporting everything `letters.ts` and
  `spelling.ts` export today, unchanged: `isHebrew`, `isNikkud`,
  `isHebrewSeparator`, `isWordSeparator`, `onlySeparators`, `stripNikkud`,
  `splitIntoWords`, `mapStrippedToOriginal`, `isSearchableWord`, `TextWord`,
  `normalizeHebrewForSearch`.

- [ ] **Step 1:** Create the package.

```json
{
  "name": "@torahmap/hebrew",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

```ts
// packages/hebrew/src/index.ts
export * from './letters.ts';
export * from './spelling.ts';
```

- [ ] **Step 2:** `git mv` both files and their tests; in `spelling.ts`, import
  from `./letters.ts`. Repoint every importer to `@torahmap/hebrew`.
- [ ] **Step 3:** `npm install`, then `npx vitest run` and `npm run typecheck`.
  Expected: both pass, with the same test count as before (2409).
- [ ] **Step 4:** Commit: "Hebrew's letter rules become @torahmap/hebrew".

### Task 2: Languages, and matching through them

**Files:**
- Create: `packages/search/package.json` (depends on `@torahmap/utils`),
  `packages/search/src/language.ts`, `packages/search/src/english.ts`
- Move: `apps/tanakh/src/search/matching.ts` → `packages/search/src/matching.ts`
- Create: `packages/hebrew/src/language.ts`
- Test: `packages/search/test/matching.test.ts`, `packages/hebrew/test/language.test.ts`
- Modify: the Tanakh's importers of `matching.ts`; `search-matching`,
  `search-wholeword` tests repointed

**Interfaces:**
- Produces, in `@torahmap/search`:

```ts
/** How a text in one language is compared with what a reader types. */
export interface SearchLanguage {
  /** The key an item's text in this language is given under, e.g. 'he'. */
  readonly id: string;
  /** Does a typed term belong to this language? The last language a text lists takes the rest. */
  claims(term: string): boolean;
  /** Written right to left. */
  readonly rtl: boolean;
  /** The spelling text is compared under. */
  fold(text: string): string;
  /** Where a position in folded text falls in the text it came from. */
  toOriginal(text: string, foldedAt: number): number;
  /** Every stretch of folded `haystack` where `needle` stands as whole words. */
  wholeWords(haystack: string, needle: string, limit: number): TextRange[];
}
export interface TextRange { start: number; end: number }
export type MatchMode = 'substring' | 'word';
export function matchRanges(haystack: string, needle: string,
  options: { mode: MatchMode; language: SearchLanguage; limit?: number }): TextRange[];
export const english: SearchLanguage; // id 'en', today's lowercasing and \b rule
```

- Produces, in `@torahmap/hebrew`:

```ts
/** Hebrew as search reads it. `prefixes`: letters a whole word may carry in front, e.g. 'דולבכשמה'. */
export function hebrew(options?: { prefixes?: string }): {
  id: 'he'; rtl: true; claims(term: string): boolean; fold(text: string): string;
  toOriginal(text: string, foldedAt: number): number;
  wholeWords(haystack: string, needle: string, limit: number): { start: number; end: number }[];
};
```

`hebrew().wholeWords` is today's `wholeWords` from `matching.ts`, with two
changes: any character that is not a Hebrew letter is a word's edge, and,
given `prefixes`, the first word may be preceded by any run of them, itself
preceded by an edge. The mark starts at the first prefix letter.

- [ ] **Step 1: Measure the Tanakh.** Before changing the edge rule, list every
  `{`, `}` and `—` in `public/data/all-texts.json`'s Hebrew that touches a
  Hebrew letter. Expected: none, in which case the Tanakh's whole-word results
  cannot change. If some do, stop and report them with the words affected.
- [ ] **Step 2: Write the failing tests.**

```ts
// packages/hebrew/test/language.test.ts
import { describe, expect, it } from 'vitest';
import { hebrew } from '../src/index.ts';

const words = (lang: ReturnType<typeof hebrew>, text: string, term: string) =>
  lang.wholeWords(lang.fold(text), lang.fold(term), Infinity).map(r => text.slice(r.start, r.end));

describe('Hebrew whole words', () => {
  it('ends a word at punctuation', () => {
    expect(words(hebrew(), 'דברי רבי אליעזר. וחכמים', 'אליעזר')).toEqual(['אליעזר']);
  });
  it('takes no prefix unless asked', () => {
    expect(words(hebrew(), 'אמר דרבי יוחנן', 'רבי')).toEqual([]);
  });
  it('takes stacked prefixes, marking them with the word', () => {
    expect(words(hebrew({ prefixes: 'דולבכשמה' }), 'אמר דרבי יוחנן וכשרבי', 'רבי'))
      .toEqual(['דרבי', 'וכשרבי']);
  });
  it('needs an edge before the prefix', () => {
    expect(words(hebrew({ prefixes: 'דולבכשמה' }), 'זרבי', 'רבי')).toEqual([]);
  });
  it('matches a phrase with a prefix on its first word only', () => {
    const lang = hebrew({ prefixes: 'דולבכשמה' });
    expect(words(lang, 'מקל וחומר', 'קל וחומר')).toEqual(['מקל וחומר']);
  });
  it('claims a term with a Hebrew letter', () => {
    expect(hebrew().claims('abc')).toBe(false);
    expect(hebrew().claims('רבי')).toBe(true);
  });
});
```

- [ ] **Step 3:** `npx vitest run packages/hebrew` — Expected: FAIL, `hebrew` is not exported.
- [ ] **Step 4:** Write `language.ts` in both packages; move `matching.ts`, so
  that `matchRanges` does the substring scan itself and hands whole-word
  matching to `language.wholeWords`. `english.wholeWords` is today's `\b`
  regex path, unchanged. The Tanakh calls `matchRanges` with `hebrew()` or
  `english` where it passed `HEBREW`/`ENGLISH`.
- [ ] **Step 5:** `npx vitest run` and `npm run typecheck` — Expected: all pass.
- [ ] **Step 6:** Commit: "Search matches through a language; Hebrew's ends a word at punctuation and may take prefixes".

### Task 3: The term list in `@torahmap/search`

**Files:**
- Move: `apps/tanakh/src/search/terms.ts` → `packages/search/src/terms.ts`,
  without its meanings code
- Move: `apps/tanakh/src/search/constants.ts` → `packages/search/src/constants.ts`
  (`SEARCH_RECORD_DELAY_MS`, `TERM_SEPARATORS`, the snippet lengths)
- Create: `apps/tanakh/src/search/meanings.ts`: `meaningsOf`, `chosenAmong`,
  `chosenMeanings`, `toggleMeaning`, `selectedKeys`, `onlyMeaning`,
  `allMeanings`, `isNarrowed`, `encodeMeanings`, `applyMeanings`,
  `meaningsPossible`
- Create: `packages/search/src/extraMode.ts`
- Test: `packages/search/test/terms.test.ts` (moved from `search-terms`), the
  meanings tests stay in `apps/tanakh` and import `meanings.ts`

**Interfaces:**
- Consumes: `SearchLanguage`, `MatchMode` (Task 2).
- Produces:

```ts
export interface SearchTerm {
  id: string; text: string; colorIndex: number;
  /** A MatchMode, or the extra mode's id; null while the reader has not said. */
  mode: string | null;
  /** The extra mode's choice for this term, as it writes it; null for none. Cleared when the text changes. */
  chosen: string[] | null;
}
export const SEARCH_COLORS: Color[]; export const MAX_TERMS: number;
export function addTerm(terms: SearchTerm[], text: string): SearchTerm[];
export function removeTerm(terms: SearchTerm[], id: string): SearchTerm[];
export function setTermText(terms: SearchTerm[], id: string, text: string): SearchTerm[];
export function setMode(terms: SearchTerm[], id: string, mode: string): SearchTerm[];
export function colorIndexAt(terms: SearchTerm[], position: number): number;
export function languageOf(languages: readonly SearchLanguage[], term: SearchTerm): SearchLanguage;
export function encodeModes(terms: SearchTerm[], extra?: ExtraMode<any>): string;
export function applyModes(terms: SearchTerm[], encoded: string, extra?: ExtraMode<any>): SearchTerm[];
export function parseSearchTerms(query: string): string[];
```

`ExtraMode<X>` (in `extraMode.ts`), where `X` is what the mode builds from the
search's files (the Tanakh's dictionary):

```ts
export interface ExtraMode<X, D = unknown> {
  readonly id: string;        // 'meanings'
  readonly letter: string;    // 'm', in the link's `mode`
  readonly label: string;
  build(data: D): X;
  /** Offered in this term's mode control. */
  offered(term: SearchTerm, language: SearchLanguage): boolean;
  /** Can match this term now; where not, the term falls back to whole word. */
  possible(x: X | null, term: SearchTerm, language: SearchLanguage): boolean;
  /** The term's mode while the reader has not chosen one. */
  isDefault(term: SearchTerm, language: SearchLanguage): boolean;
  itemsFor(x: X, term: SearchTerm): Set<string>;
  ranges(x: X, term: SearchTerm, itemId: string, text: string, data: D): TextRange[];
  /** How many of `ranges`' marks an excerpt joins into one, e.g. a phrase's words. */
  joined(term: SearchTerm): number;
  hoverNote(x: X, term: SearchTerm, itemId: string): string;
  summary(x: X, term: SearchTerm): string | null;
  renderBody(row: HTMLElement, term: SearchTerm, x: X, edit: (change: (terms: SearchTerm[]) => SearchTerm[]) => void): void;
  /** The link key holding each term's choice, and how it is written and read. */
  readonly param: { key: string; write(terms: SearchTerm[]): string; read(terms: SearchTerm[], value: string): SearchTerm[] };
  record(term: SearchTerm): unknown;
}
```

The default mode is: the extra mode if `isDefault`, else substring. The
effective mode is the chosen or default one, with the extra mode replaced by
whole word where not `possible`. This keeps a Hebrew term in the Tanakh
starting in meanings mode and falling back to whole word, as
`effectiveMode` does today (`terms.ts`).

- [ ] **Step 1:** Move the test file first, repointed; add a test that a
  language list `[hebrew(), english]` gives a Hebrew term Hebrew and anything
  else English, and that `encodeModes`/`applyModes` round-trip `'m'` only when
  given the extra mode. Run: Expected: FAIL on the missing module.
- [ ] **Step 2:** Move the code; the Tanakh's meanings functions go to
  `meanings.ts`, and the Tanakh's search builds its `ExtraMode` there.
- [ ] **Step 3:** `npx vitest run`, `npm run typecheck` — Expected: pass.
- [ ] **Step 4:** Commit: "The term list moves to @torahmap/search; meanings is the Tanakh's mode".

### Task 4: The index, results, excerpts and marks

**Files:**
- Create: `packages/search/src/textIndex.ts` from `search.ts`'s index,
  `versesForTerm`, `resultsForVerseSets`, `quoteVerse`, snippets,
  `getMatchingVerseTerms`
- Move: `highlight.ts`, `resultsList.ts` → `packages/search/src/`
- Keep: the lexeme and dictionary code of `search.ts` moves into
  `apps/tanakh/src/search/dictionary.ts`
- Test: repoint `search-verse-sets`, `search-english-snippets`,
  `search-lazy-snippets`, `search-mixed-language`, `search-final-forms`,
  `search-normalization`, `search-marks-by-position`; add
  `packages/search/test/textIndex.test.ts`

**Interfaces:**
- Produces:

```ts
/** One item as search reads it. `text` is keyed by language id. */
export interface SearchEntry { id: string; ref: string; text: Readonly<Record<string, string>> }
export interface TextIndex { entries: IndexedEntry[]; byId: Map<string, IndexedEntry> }
export function buildTextIndex(entries: Iterable<SearchEntry>, languages: readonly SearchLanguage[]): TextIndex;
export interface SearchResult { id: string; ref: string; matchingTerms: { termIndex: number }[] }
export function itemsForTerm(index: TextIndex, text: string, language: SearchLanguage, mode: MatchMode): Set<string>;
export function highlightTerms(text: string, language: SearchLanguage, terms: SearchTerm[],
  rangesOf: (term: SearchTerm) => TextRange[] | null): DocumentFragment;
```

`rangesOf` returns the extra mode's ranges for a term in that mode, or null to
match its text. A result's reference is the entry's `ref`, so `resultsList.ts`
drops `verseRef`.

- [ ] **Step 1:** Write `textIndex.test.ts`: two entries in two languages; a
  Hebrew term finds by the Hebrew text, an English one by the English; a
  result carries its entry's `ref`. Run: Expected: FAIL.
- [ ] **Step 2:** Move the code; the Tanakh's `data.ts` builds its entries from
  `VerseTexts` with `ref: verseRef(...)`.
- [ ] **Step 3:** `npx vitest run`, `npm run typecheck` — Expected: pass.
- [ ] **Step 4:** Commit: "The text index, excerpts and marks move to @torahmap/search".

### Task 5: `createTermSearch`

**Files:**
- Create: `packages/search/src/termSearch.ts` from `index.ts`'s orchestration
- Move: `termRows.ts`, `telemetry.ts`, the shared rules of `search.css`
  (rows, results, `#popup mark.term-N`) → `packages/search/src/`
- Modify: `apps/tanakh/src/search/index.ts` becomes the Tanakh's spec and its
  meanings mode; `wordClicks.ts` uses the search's `addTermOrFill`
- Modify: `test-harness/main.ts`, `scripts/print/views.ts`,
  `apps/tanakh/src/text.ts`, the overlay-catalog comment naming `terms.ts`
- Test: repoint `apps/tanakh/test/unit/overlays/search*.test.ts`; add
  `packages/search/test/termSearch.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TermSearchSpec<I extends { id: string }, D, X = never> {
  languages: readonly SearchLanguage[];
  /** The files search downloads, as SearchTool's `data`. */
  data: Record<keyof D & string, string>;
  entries(data: D): Iterable<SearchEntry>;
  noun: { one: string; many: string };     // 'verse'/'verses', 'passage'/'passages'
  placeholder: string;
  description: string;
  credits?: Credit[];
  extra?: ExtraMode<X, D>;
  /** Told when the reader picks a result. */
  onSelect(id: string): void;
  telemetry?: SearchTelemetry<TermSettings, D>;
}
export interface TermSettings { readonly terms: SearchTerm[] }
export function createTermSearch<I extends { id: string }, D, X = never>(
  spec: TermSearchSpec<I, D, X>): SearchTool<I, TermSettings, D>;
export function addTermOrFill(settings: TermSettings, text: string, mode: string,
  chosen: string[] | null): TermSettings | null;
export const TERM_SEARCH_PARAMS: readonly UrlParamSpec[]; // 'search', 'mode'
```

The state now at module level in `index.ts`, `termRows.ts` and
`resultsList.ts` lives inside each `createTermSearch` call. The Tanakh's link
keeps `search`, `mode` and `m`: `TERM_SEARCH_PARAMS` plus its extra mode's
`param.key`, so `SEARCH_URL_PARAMS` in overlay-catalog becomes their union.

- [ ] **Step 1:** Write `termSearch.test.ts` with a two-entry English text and
  no extra mode: settings from `search=gamma&mode=w` round-trip through
  `settingsToUrl`; `colorsFor` colours only the matching item; the caption
  reads with the spec's noun. Run: Expected: FAIL.
- [ ] **Step 2:** Move the code. Before and after, take
  `npm run test:layout`'s search states for the Tanakh.
- [ ] **Step 3:** `npx vitest run`, `npm run typecheck`, `npm run test:layout`.
  Expected: pass, and the Tanakh's search screenshots byte-identical.
- [ ] **Step 4:** Commit: "Search is createTermSearch; the Tanakh's is a spec and its meanings mode".

### Task 6: The Talmud's search file

**Files:**
- Modify: `scripts/talmud/bundle.ts`: write `public/data/talmud/search.json`
- Modify: `apps/talmud/src/data.ts`: `SEARCH_FILE`
- Modify: `DATA_REGENERATION.md`: what the file is
- Test: `scripts/talmud/__tests__/bundle.test.ts`

**Interfaces:**
- Produces: `search.json`, `{ "<segment id>": "<Davidson text, no points or tags>" }`
  for every segment on the map, ids as `TalmudLayoutItem.id` writes them
  (`Berakhot.2a.1`).

- [ ] **Step 1:** Write the failing test: for the fixture tractate, the search
  text of segment 1 of the first amud is the fixture's Davidson segment with its
  points and HTML tags removed, under that segment's id. Run: Expected: FAIL.
- [ ] **Step 2:** Implement: read each tractate's cached `merged.json`, align its
  amudim to Wikisource's by position, as `markers.ts` already does, strip
  points with `stripNikkud` and tags with the bundle's tag rule.
- [ ] **Step 3:** Run the bundle (`npx tsx scripts/talmud/bundle.ts`). Expected:
  one entry per segment on the map (81,793), and the only other change to
  `public/data/talmud/` is the new file.
- [ ] **Step 4:** Commit with the data: "The Talmud's search reads the Davidson text".

### Task 7: The Talmud's search

**Files:**
- Modify: `apps/talmud/src/search.ts`: replace the stand-in
- Modify: `apps/talmud/src/text.ts` if its search wiring changes; `apps/talmud/package.json`
- Test: `apps/talmud/test/search.test.ts`; Talmud search states in `layout/app.ts`

**Interfaces:**
- Consumes: `createTermSearch`, `hebrew({ prefixes })`, `search.json`.

```ts
export const talmudSearch = createTermSearch<TalmudLayoutItem, { text: Record<string, string> }>({
  languages: [hebrew({ prefixes: 'דולבכשמה' })],
  data: { text: SEARCH_FILE },
  entries: ({ text }) => Object.entries(text).map(([id, he]) => ({ id, ref: refOf(id), text: { he } })),
  noun: { one: 'passage', many: 'passages' },
  placeholder: 'A word or phrase, in Hebrew or Aramaic',
  description: 'Any word or phrase of the Talmud.',
  onSelect: (id) => pinAndGlide(id),
});
```

`refOf` is the reference the popup heads a segment with (`talmudRef`), from
the id. `pinAndGlide` is however the Tanakh's result click reaches the shell
today, after Task 5.

- [ ] **Step 1: Write the failing tests**, against a small `search.json` fixture:
  רבי as a whole word finds a segment with דרבי; קל וחומר finds the phrase; the
  link `?search=רבי&mode=w` round-trips; a segment whose popup text writes ר׳
  is coloured on the map and its popup text comes back with no mark and no
  error (review focus 4); with the file not yet loaded, nothing is coloured
  and the caption says it is loading (review focus 5). Run: Expected: FAIL.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Add Talmud search states to `layout/app.ts`: a term typed, two
  terms, a result clicked. `npm run test:layout` — Expected: pass.
- [ ] **Step 4:** `npx vitest run`, `npm run typecheck`, `npm run build`.
- [ ] **Step 5:** Commit: "The Talmud searches its text".

### Task 8: Docs and pull request

- [ ] CLAUDE.md's Project Structure: `hebrew` and `search` among the packages,
  and search's place under `apps/tanakh` described as its spec and meanings.
- [ ] The design doc's status line: implemented, with the PR number.
- [ ] Open the PR (ready, not draft), `Closes #345`, with the layout report's
  Talmud search shots by commit-pinned URL and the Tanakh's before-and-after
  comparison, and what to try on the preview: רבי יוחנן, קל וחומר, סימן.
