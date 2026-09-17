# Click-to-search implementation plan

**Status:** Shipped — `src/wordMenu.ts`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a Hebrew word in the verse popup opens a small panel naming
the dictionary word it is, with one button that searches for it.

**Architecture:** The verse text is split into one span per written word.
Clicking a span asks the dictionary seam which word this is *in this verse* —
answered today by intersecting the spellings's candidate readings with the
lexemes the verse contains, and later by per-token data from issue #102 without
any caller changing. A popover names the answer; its button adds a search term
already narrowed to that meaning, switching overlays only with the reader's
consent.

**Tech Stack:** TypeScript, Vite, vitest with happy-dom, no runtime
dependencies. WebGL for the map, but nothing in this plan touches it.

**Spec:** GitHub issue #127, which supersedes the click-to-search sections of
`docs/plans/2026-09-04-search-redesign-design.md`. Read both; where they
disagree the issue wins, because the term list and meaning filter it depends on
did not exist when the design was written.

## Global Constraints

- **Stacked branch.** This work sits on `search-meaning-filter` (PR #111).
  `src/search/terms.ts` and the meaning filter exist only there.
- **No runtime dependencies.** The project has none and is not gaining any.
- **Prettier owns formatting.** `npm run format` before committing; the
  pre-commit hook rejects unformatted staged files.
- **Every commit runs the gate.** The pre-commit hook runs format check,
  `npm run typecheck` and the full test suite, about six seconds.
- **No ticket or phase references in code.** Describe behaviour in plain terms
  in comments and docstrings. Issue numbers belong in commit messages.
- **No `@ts-ignore`.** Fix types properly.
- **Tests assert behaviour, not rates.** Corpus-wide coverage numbers move when
  the lexeme index is regenerated, which is a change we want. Assert properties
  that survive regeneration; print coverage rather than gating on it.
- **UI work is not complete until Danyel has looked at it.** That is the last
  step, not an optional one.

---

### Task 1: Stop the grapheme joiner hiding Jerusalem

Sefaria writes ירושל͏ם with U+034F COMBINING GRAPHEME JOINER between the ל and
the ם. `normalizeHebrewForSearch()` strips points and accents (U+0591–U+05C7)
but not U+034F, which sits outside that range, so the normalized word keeps an
invisible character and matches no dictionary key. About 600 occurrences of
Jerusalem and its prefixed forms resolve to nothing purely because of this.

It also affects typed search today: a reader who types ירושלם gets no substring
match against text carrying the joiner.

**Files:**
- Modify: `src/search.ts` (`normalizeHebrewForSearch`, around line 138)
- Test: `src/__tests__/unit/search-normalization.test.ts` (create if absent;
  check first — several normalization tests already exist under
  `src/__tests__/unit/`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `normalizeHebrewForSearch()` now drops U+034F. Every later task
  depends on this, because word lookups go through it.

- [ ] **Step 1: Write the failing test**

```ts
// In src/__tests__/unit/search-normalization.test.ts

import { describe, it, expect } from 'vitest';
import { normalizeHebrewForSearch, findLexemesForWord } from '../../search';
import { loadLexiconData } from '../../search';

describe('the combining grapheme joiner', () => {
  it('is removed, so Jerusalem normalizes to the same word with or without it', () => {
    const withJoiner = 'ירושל͏ם';
    const withoutJoiner = 'ירושלם';

    expect(normalizeHebrewForSearch(withJoiner)).toBe(
      normalizeHebrewForSearch(withoutJoiner),
    );
  });

  it('leaves the word findable in the dictionary', async () => {
    await loadLexiconData();

    expect(findLexemesForWord(normalizeHebrewForSearch('ירושל͏ם'))).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/search-normalization.test.ts`
Expected: FAIL — the two normalizations differ, and the lookup returns `null`.

- [ ] **Step 3: Strip the joiner**

In `normalizeHebrewForSearch()` in `src/search.ts`, add the joiner to the
characters dropped. The existing loop tests `code < NIKKUD_START || code >
NIKKUD_END` to decide what to keep; add an explicit skip before that test:

```ts
// U+034F COMBINING GRAPHEME JOINER. Sefaria writes ירושל͏ם with one inside the
// word, where it renders as nothing and matches nothing; without this, every
// lookup of Jerusalem misses.
const GRAPHEME_JOINER = 0x034f;
```

and inside the loop, before the nikkud test:

```ts
if (code === GRAPHEME_JOINER) continue;
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/search-normalization.test.ts`
Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. If a test asserted the old behaviour, read it before changing
it — it may be pinning something else.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/search.ts src/__tests__/unit/search-normalization.test.ts
git commit -m "Strip the grapheme joiner that hid Jerusalem from every lookup"
```

---

### Task 2: Ask which dictionary word a word is, in its verse

The dictionary seam gains one question: given a written form and a verse, which
dictionary words can it be *here*. Today it answers by intersecting the
spelling's candidates with the lexemes `verse-lexemes.json` records for that
verse. When issue #102 lands, the body is replaced by a per-token lookup and no
caller changes.

`verseToLexemes` is private to `src/search.ts`, so that file gains a narrow
accessor and `dictionary.ts` does the rest — lexeme ids must not escape the
seam.

**Files:**
- Modify: `src/search.ts` (add `getVerseLexemes` near `searchByLexemes`, ~line 472)
- Modify: `src/search/dictionary.ts` (add `meaningsInVerse`; refactor
  `meaningsFor` so both share the row-merging)
- Test: `src/__tests__/unit/search/word-in-verse.test.ts` (create)

**Interfaces:**
- Consumes: `normalizeHebrewForSearch()` from Task 1.
- Produces:
  - `getVerseLexemes(verseKey: string): LexemeId[] | null` in `src/search.ts`
  - `meaningsInVerse(writtenForm: string, verseKey: string): Meaning[]` in
    `src/search/dictionary.ts`. Returns the candidates the verse supports,
    likeliest reading first; an empty array when the verse supports none. The
    verse key is `tanakhKey(book, chapter, verse)`, i.e. `Genesis:1:2`.

- [ ] **Step 1: Write the failing test**

These four cases are verified against the shipped data. Keep the comments —
each one says why that verse was chosen.

```ts
// Which dictionary word is this word, here?
//
// A Hebrew word written without vowels is usually several different words, and
// the spelling alone cannot say which. The verse can: the reading of a word in
// front of you is one the verse contains, and the other candidates usually are
// not.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData } from '../../../search';
import { meaningsInVerse, meaningsFor } from '../../../search/dictionary';

beforeAll(async () => {
  await loadLexiconData();
});

describe('resolving a word against its verse', () => {
  it('reads עלה in Genesis 3:7 as a leaf, not as the commoner "ascend"', () => {
    // The whole feature in one case. By frequency the spelling עלה is most
    // often the verb "ascend" (818 verses) and the fig leaf is its rarest
    // reading (13). The verse settles it the other way.
    const meanings = meaningsInVerse('עלה', 'Genesis:3:7');

    expect(meanings).toHaveLength(1);
    expect(meanings[0].gloss).toBe('leafage');
  });

  it('reads ורוח in Genesis 1:2 as wind, prefix and all', () => {
    // The ו is part of the written word; the index files whole tokens under
    // the lexeme of their stem, so the prefix must not have to be stripped.
    const meanings = meaningsInVerse('ורוח', 'Genesis:1:2');

    expect(meanings).toHaveLength(1);
    expect(meanings[0].gloss).toBe('wind');
  });

  it('offers both readings of עלת in Genesis 8:20, where the verse carries both', () => {
    // Noah offers burnt-offerings (עלת) and the verb "ascend" appears in the
    // same verse as ויעל. The verse cannot choose between them and neither
    // should we.
    const glosses = meaningsInVerse('עלת', 'Genesis:8:20').map((m) => m.gloss);

    expect(glosses).toContain('burnt-offering');
    expect(glosses).toContain('ascend');
  });

  it('offers nothing for an inflected function word', () => {
    // לו "to him" is absent from the index: the generator files a function word
    // only under its own bare spelling. What is left is the unrelated לוּ "if
    // only", which this verse does not contain.
    expect(meaningsInVerse('לו', 'Genesis:2:18')).toEqual([]);
  });

  it('never offers a reading the spelling alone does not allow', () => {
    // The verse narrows; it must never widen.
    const narrowed = meaningsInVerse('עלה', 'Genesis:3:7');
    const fromSpelling = new Set(meaningsFor('עלה').map((m) => m.keys[0]));

    for (const meaning of narrowed) {
      expect(fromSpelling.has(meaning.keys[0])).toBe(true);
    }
  });

  it('returns nothing for a verse it has no data for', () => {
    expect(meaningsInVerse('עלה', 'Nowhere:1:1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/search/word-in-verse.test.ts`
Expected: FAIL with `meaningsInVerse is not a function`.

- [ ] **Step 3: Expose the verse's lexemes from search.ts**

Add beside `searchByLexemes` in `src/search.ts`:

```ts
/**
 * The dictionary words a verse contains.
 *
 * Exposed for the dictionary seam, which uses it to decide which of a
 * spelling's readings is the one in front of the reader. Returns null when the
 * index has not loaded, which callers must treat as "cannot say" rather than
 * as "none".
 */
export function getVerseLexemes(verseKey: string): LexemeId[] | null {
  return verseToLexemes?.[verseKey] ?? null;
}
```

- [ ] **Step 4: Add the seam function**

In `src/search/dictionary.ts`, pull the row-merging out of `meaningsFor` so both
entry points share it, then add the new question. `meaningsFor` keeps its
current behaviour exactly.

```ts
import { findLexemesForWord, getVerseLexemes, /* ...existing... */ } from '../search.ts';

/**
 * Merge a list of lexeme ids into the rows a reader sees.
 *
 * This is the body `meaningsFor` used to hold, unchanged, taking the ids as its
 * input so that both questions about a word share one answer shape.
 */
function rowsFor(ids: LexemeId[]): Meaning[] {
  // Merge as we go, so a merged row keeps the position of its likeliest member
  // and the order stays the order the data gave us.
  const rows = new Map<string, { meaning: Meaning; group: LexemeId[] }>();

  for (const id of ids) {
    const lexeme = getLexeme(id);
    const key = keyOf(id);
    if (!lexeme || key === null) continue;

    const row = rows.get(renderedAs(lexeme));
    if (row) {
      row.meaning.keys.push(key);
      row.group.push(id);
      continue;
    }

    rows.set(renderedAs(lexeme), {
      meaning: {
        keys: [key],
        form: lexeme.form,
        gloss: lexeme.gloss,
        pos: lexeme.pos,
        language: lexeme.language,
        // A merged row's verses are the union of its members', not the sum:
        // the two Shechems share two verses, so adding would report 56 where
        // there are 54. Filled in below, once the group is complete.
        verseCount: 0,
      },
      group: [id],
    });
  }

  return [...rows.values()].map(({ meaning, group }) => ({
    ...meaning,
    verseCount: group.length === 1 ? getLexemeVerseCount(group[0]) : searchByLexemes(group).size,
  }));
}

export function meaningsFor(writtenForm: string): Meaning[] {
  const ids = findLexemesForWord(writtenForm);
  if (!ids) return [];
  return rowsFor(ids);
}

/**
 * Which dictionary word is this written form, in this verse?
 *
 * The spelling alone is ambiguous for half of the words in the text, because
 * Hebrew does not write most vowels. The verse resolves nearly all of it: the
 * reading of the word in front of the reader is one the verse contains, and
 * the spelling's other candidates usually are not.
 *
 * This is inference, not knowledge. BHSA tags every word occurrence with
 * exactly one lexeme, but the index is keyed by spelling, so the link is lost
 * before it reaches the browser and is reconstructed here. When the index
 * carries per-word lexemes, this body becomes a lookup and every caller stays
 * as it is.
 *
 * An empty result means "cannot say", which happens for inflected function
 * words the index deliberately omits. Callers offer a literal search instead
 * rather than treating it as an error.
 */
export function meaningsInVerse(writtenForm: string, verseKey: string): Meaning[] {
  const ids = findLexemesForWord(writtenForm);
  if (!ids) return [];

  const inVerse = getVerseLexemes(verseKey);
  if (!inVerse) return [];

  const present = new Set(inVerse);
  return rowsFor(ids.filter((id) => present.has(id)));
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/search/word-in-verse.test.ts`
Expected: PASS, all six.

- [ ] **Step 6: Add the coverage report, not a gate**

Add to the same file. It prints and asserts only a floor loose enough that only
a catastrophe trips it — a real gate here would fail the day the index improves.

Add `splitVerseText` and `normalizeHebrewForSearch` to the file's imports:

```ts
import { loadLexiconData, normalizeHebrewForSearch } from '../../../search';
import { splitVerseText } from '../../../verseWords';
```

```ts
describe('coverage across the whole text', () => {
  it('resolves most clicks, and reports how many', async () => {
    // The test setup serves public/ from disk, so this is the same path the
    // app itself fetches.
    const texts = await (await fetch('/data/all-texts.json')).json();

    let resolved = 0;
    let ambiguous = 0;
    let unknown = 0;

    for (const [book, chapters] of Object.entries(texts)) {
      for (const [chapter, verses] of Object.entries(chapters)) {
        for (const [verse, text] of Object.entries(verses)) {
          const key = `${book}:${chapter}:${verse}`;
          for (const word of splitVerseText(text.he).filter((p) => p.kind === 'word')) {
            const n = meaningsInVerse(normalizeHebrewForSearch(word.text), key).length;
            if (n === 1) resolved++;
            else if (n > 1) ambiguous++;
            else unknown++;
          }
        }
      }
    }

    const total = resolved + ambiguous + unknown;
    console.log(
      `click resolution: ${((resolved / total) * 100).toFixed(1)}% one meaning, ` +
        `${((ambiguous / total) * 100).toFixed(1)}% several, ` +
        `${((unknown / total) * 100).toFixed(1)}% none`,
    );

    // A floor, not a target. It catches a resolution path that has stopped
    // working; it must not fail when the lexeme index gets better.
    expect(resolved / total).toBeGreaterThan(0.5);
  });
});
```

Note: this needs `splitVerseText` from Task 3. If Task 3 is not done yet, leave
this step until it is, and say so in the commit. Do not inline a second word
splitter here — two splitters that disagree is the bug this test would be
written to catch.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/search.ts src/search/dictionary.ts src/__tests__/unit/search/word-in-verse.test.ts
git commit -m "Ask the verse which dictionary word a spelling is"
```

---

### Task 3: Split displayed verse text into words

One pure function over a string, so it can be tested without a DOM. It has to
agree with `normalizeHebrewForSearch()` about where words end — maqaf (U+05BE)
separates words in both — because the generator built the index on the same
rule, and a disagreement puts every lookup on the wrong word.

Two things in the displayed text are not words. `{ס}` and `{פ}` are paragraph
markers, 3,552 of them, and must never be clickable. Sefaria also writes
parenthesised alternates such as `(לא)`, which are words and stay clickable
with the parentheses stripped for lookup.

**Files:**
- Create: `src/verseWords.ts`
- Test: `src/__tests__/unit/verseWords.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface VersePiece {
  /** Exactly as it appears in the verse, points and accents included. */
  text: string;
  /** Offsets into the original string, so a caller can rebuild it unchanged. */
  start: number;
  end: number;
  kind: 'word' | 'separator' | 'marker';
}

export function splitVerseText(text: string): VersePiece[];
```

Concatenating every piece's `text` in order reproduces the input exactly. Later
tasks rely on that.

- [ ] **Step 1: Write the failing test**

```ts
// Splitting a verse into the words a reader can click.
//
// Word boundaries here must match the ones normalizeHebrewForSearch() uses,
// because the dictionary index was built on that rule. If the two drift, a
// click looks up a word the reader did not click.

import { describe, it, expect } from 'vitest';
import { splitVerseText } from '../../verseWords';

const words = (text: string) =>
  splitVerseText(text)
    .filter((p) => p.kind === 'word')
    .map((p) => p.text);

describe('splitting a verse', () => {
  it('splits on spaces', () => {
    expect(words('בראשית ברא אלהים')).toEqual(['בראשית', 'ברא', 'אלהים']);
  });

  it('treats maqaf as a separator, so על־פני is two clickable words', () => {
    // The dictionary index does the same, and a maqaf-joined pair is two
    // dictionary words. Clicking should reach whichever one was hit.
    expect(words('עַל־פְּנֵי')).toEqual(['עַל', 'פְּנֵי']);
  });

  it('keeps points and accents on the word, since they are what is displayed', () => {
    expect(words('בְּרֵאשִׁ֖ית')).toEqual(['בְּרֵאשִׁ֖ית']);
  });

  it('marks {פ} and {ס} as markers rather than words', () => {
    const pieces = splitVerseText('אֶחָֽד׃ {פ}');

    expect(pieces.filter((p) => p.kind === 'word').map((p) => p.text)).toEqual(['אֶחָֽד']);
    expect(pieces.filter((p) => p.kind === 'marker').map((p) => p.text)).toEqual(['{פ}']);
  });

  it('keeps a parenthesised alternate as a word', () => {
    expect(words('(לא) אליו')).toEqual(['(לא)', 'אליו']);
  });

  it('reproduces the original text when the pieces are joined', () => {
    // Every later task rebuilds the verse from these pieces. Losing a
    // character here would silently corrupt the displayed text.
    const verse = 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ עַל־פְּנֵ֣י תְה֑וֹם׃ {פ}';

    expect(splitVerseText(verse).map((p) => p.text).join('')).toBe(verse);
  });

  it('handles an empty verse without inventing a piece', () => {
    expect(splitVerseText('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/verseWords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the splitter**

```ts
// Splitting displayed verse text into the words a reader can click.
//
// The rule has to match normalizeHebrewForSearch() in src/search.ts, which is
// what the dictionary index was built on: whitespace and maqaf separate words,
// and points and accents belong to the word they sit on. If the two drift
// apart, a click resolves the wrong word and nothing says so.

/** Maqaf, paseq, sof pasuq, nun hafukha - the separators search folds to spaces. */
const SEPARATORS = new Set([0x05be, 0x05c0, 0x05c3, 0x05c6]);

/** {פ} and {ס}: paragraph markers Sefaria leaves in the text. Not words. */
const MARKER = /^\{[פס]\}$/;

export interface VersePiece {
  text: string;
  start: number;
  end: number;
  kind: 'word' | 'separator' | 'marker';
}

function isSeparator(char: string): boolean {
  return /\s/.test(char) || SEPARATORS.has(char.codePointAt(0)!) || char === '-';
}

export function splitVerseText(text: string): VersePiece[] {
  const pieces: VersePiece[] = [];
  let index = 0;

  while (index < text.length) {
    const start = index;
    const separator = isSeparator(text[index]);
    while (index < text.length && isSeparator(text[index]) === separator) index++;

    const slice = text.slice(start, index);
    pieces.push({
      text: slice,
      start,
      end: index,
      kind: separator ? 'separator' : MARKER.test(slice) ? 'marker' : 'word',
    });
  }

  return pieces;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/verseWords.test.ts`
Expected: PASS, all seven.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/verseWords.ts src/__tests__/unit/verseWords.test.ts
git commit -m "Split verse text into the words a reader can click"
```

- [ ] **Step 6: Finish Task 2's coverage report**

Now that `splitVerseText` exists, add the step-6 test from Task 2 if it was
deferred, run it, and commit separately.

---

### Task 4: Wrap words in spans without disturbing highlighting

The verse popup does not always hold plain text. Two overlays return a
`DocumentFragment` from `highlightVerseText()`: search wraps matches in
`<mark class="term-N">`, and trop wraps single accent characters. Word spans
have to coexist with both without changing the overlay interface.

The approach: let the overlay build its fragment as it does now, then walk the
fragment's text nodes in order, tracking the offset into the original string,
and wrap each word piece in a span. A word interrupted by a `<mark>` — which is
what trop does to almost every word — yields more than one span, and both carry
the same word index, so a click still resolves one word. That is the reason the
span carries an index rather than its own text.

**Files:**
- Modify: `src/verseWords.ts` (add `wrapWordsInFragment`)
- Test: `src/__tests__/unit/verseWords-dom.test.ts`

**Interfaces:**
- Consumes: `splitVerseText`, `VersePiece` from Task 3.
- Produces:

```ts
export function wrapWordsInFragment(
  fragment: DocumentFragment,
  text: string,
): DocumentFragment;
```

Mutates and returns the fragment. Each word gets one or more
`<span class="verse-word" data-word-index="N">` elements; markers and
separators are left alone. `N` indexes the word pieces of `text`, counting
words only.

- [ ] **Step 1: Write the failing test**

```ts
// Word spans and overlay highlighting in the same text.
//
// The verse popup may hold plain text, search highlights, or trop highlights.
// Words have to become clickable in all three without changing what the
// overlays produce.

import { describe, it, expect } from 'vitest';
import { splitVerseText, wrapWordsInFragment } from '../../verseWords';

function fragmentOf(...nodes: Node[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const node of nodes) fragment.appendChild(node);
  return fragment;
}

function mark(text: string): HTMLElement {
  const element = document.createElement('mark');
  element.textContent = text;
  return element;
}

describe('wrapping words in a highlighted fragment', () => {
  it('gives each word its own span', () => {
    const text = 'בראשית ברא אלהים';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    const spans = [...wrapped.querySelectorAll('.verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['בראשית', 'ברא', 'אלהים']);
    expect(spans.map((s) => s.getAttribute('data-word-index'))).toEqual(['0', '1', '2']);
  });

  it('leaves the text itself unchanged', () => {
    const text = 'עַל־פְּנֵי תְה֑וֹם׃ {פ}';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    expect(wrapped.textContent).toBe(text);
  });

  it('does not make a paragraph marker clickable', () => {
    const text = 'אֶחָֽד׃ {פ}';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    const spans = [...wrapped.querySelectorAll('.verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['אֶחָֽד']);
  });

  it('keeps a highlight that covers a whole word', () => {
    // Search highlighting a matched word: the mark survives and the word is
    // still one clickable span.
    const text = 'ברא אלהים';
    const wrapped = wrapWordsInFragment(
      fragmentOf(mark('ברא'), document.createTextNode(' אלהים')),
      text,
    );

    expect(wrapped.querySelector('mark')).not.toBeNull();
    expect(wrapped.textContent).toBe(text);
    expect([...wrapped.querySelectorAll('.verse-word')].length).toBeGreaterThanOrEqual(2);
  });

  it('gives both halves of an interrupted word the same index', () => {
    // Trop marks a single accent inside a word, so the word arrives as three
    // nodes. A click on either half must still mean one word.
    const text = 'ברא אלהים';
    const wrapped = wrapWordsInFragment(
      fragmentOf(document.createTextNode('ב'), mark('ר'), document.createTextNode('א אלהים')),
      text,
    );

    const first = [...wrapped.querySelectorAll('[data-word-index="0"]')];
    expect(first.map((s) => s.textContent).join('')).toBe('ברא');
    expect(wrapped.textContent).toBe(text);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/verseWords-dom.test.ts`
Expected: FAIL — `wrapWordsInFragment` is not exported.

- [ ] **Step 3: Write it**

Add to `src/verseWords.ts`:

```ts
/**
 * Make every word in an already-built fragment clickable.
 *
 * The fragment may come from an overlay that has wrapped parts of the text in
 * <mark> elements - search marks whole matches, trop marks single accents
 * inside words. Rather than fight that, this walks the text nodes in order,
 * keeps count of where it is in the original string, and wraps each word's
 * text in a span.
 *
 * A word broken up by a mark becomes more than one span. They share a word
 * index, which is why the index is what a click reads rather than the span's
 * own text: one word, one answer, however many pieces it arrived in.
 */
export function wrapWordsInFragment(
  fragment: DocumentFragment,
  text: string,
): DocumentFragment {
  const words = splitVerseText(text).filter((piece) => piece.kind === 'word');

  // Which word covers a given offset, or null between words.
  const wordAt = (offset: number): number | null => {
    for (let i = 0; i < words.length; i++) {
      if (offset >= words[i].start && offset < words[i].end) return i;
    }
    return null;
  };

  let offset = 0;

  const walk = (node: Node): void => {
    // Copy the child list first: wrapping replaces nodes as we go.
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const content = child.textContent ?? '';
        const replacement = document.createDocumentFragment();
        let cursor = 0;

        while (cursor < content.length) {
          const index = wordAt(offset + cursor);
          let run = cursor + 1;
          while (run < content.length && wordAt(offset + run) === index) run++;

          const slice = content.slice(cursor, run);
          if (index === null) {
            replacement.appendChild(document.createTextNode(slice));
          } else {
            const span = document.createElement('span');
            span.className = 'verse-word';
            span.dataset.wordIndex = String(index);
            span.textContent = slice;
            replacement.appendChild(span);
          }
          cursor = run;
        }

        offset += content.length;
        child.parentNode?.replaceChild(replacement, child);
      } else {
        walk(child);
      }
    }
  };

  walk(fragment);
  return fragment;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/verseWords-dom.test.ts`
Expected: PASS, all five.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/verseWords.ts src/__tests__/unit/verseWords-dom.test.ts
git commit -m "Make words clickable without disturbing overlay highlighting"
```

---

### Task 5: The verse popup renders words and reports clicks

`updateSidebar()` currently sets the Hebrew as one text node, or replaces it
with whatever `highlightVerseText()` returned. It gains one step: run the result
through `wrapWordsInFragment()`, and listen for clicks on the spans.

The sidebar does not decide what a click means. It reports which word was
clicked, in which verse, and where on screen — the popover and the search are
later tasks. That keeps `sidebar.ts` independent of which overlay is active.

**Files:**
- Modify: `src/sidebar.ts`
- Modify: `src/styles/verse-popup.css`
- Test: `src/__tests__/unit/sidebar-word-clicks.test.ts`

**Interfaces:**
- Consumes: `splitVerseText`, `wrapWordsInFragment` from Tasks 3 and 4.
- Produces:

```ts
export interface WordClick {
  /** The word exactly as displayed, points and all. */
  text: string;
  /** Its position among the verse's words. */
  index: number;
  book: string;
  chapter: number;
  verse: number;
  /** The span that was clicked, for anchoring a popover. */
  element: HTMLElement;
}

export function setWordClickHandler(handler: ((click: WordClick) => void) | null): void;
```

- [ ] **Step 1: Write the failing test**

```ts
// Clicking a word in the verse popup.
//
// The sidebar turns the Hebrew into clickable words and reports which one was
// hit. It does not decide what the click means - that belongs to whatever is
// listening.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSidebarElements, updateSidebar, setWordClickHandler } from '../../sidebar';
import { createVerse } from '../helpers/fixtures';
import type { VerseTexts } from '../../verseTexts';

const texts: VerseTexts = {
  Genesis: { 1: { 2: { he: 'וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת', en: 'a wind from God sweeping' } } },
};

const getVerseText = (
  all: VerseTexts,
  book: string,
  chapter: number,
  verse: number,
) => all[book]?.[chapter]?.[verse] ?? null;

function mountPopup(): void {
  document.body.innerHTML = `
    <div id="verse-popup">
      <div class="verse-ref"><span class="ref-text"></span><button class="close-btn"></button></div>
      <div class="overlay-info"></div>
      <div class="verse-hebrew"></div>
      <div class="verse-english"></div>
      <a class="sefaria-link"><span class="link-subtitle"></span></a>
    </div>`;
}

beforeEach(() => {
  mountPopup();
  setWordClickHandler(null);
});

describe('words in the verse popup', () => {
  it('renders one clickable span per word', () => {
    const elements = getSidebarElements();
    updateSidebar(elements, createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), texts, null, getVerseText, true);

    const spans = [...document.querySelectorAll('.verse-hebrew .verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['וְר֣וּחַ', 'אֱלֹהִ֔ים', 'מְרַחֶ֖פֶת']);
  });

  it('reports the word that was clicked, and its verse', () => {
    const handler = vi.fn();
    setWordClickHandler(handler);

    const elements = getSidebarElements();
    updateSidebar(elements, createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), texts, null, getVerseText, true);

    document.querySelector<HTMLElement>('[data-word-index="0"]')!.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      text: 'וְר֣וּחַ',
      index: 0,
      book: 'Genesis',
      chapter: 1,
      verse: 2,
    });
  });

  it('leaves the English alone', () => {
    const elements = getSidebarElements();
    updateSidebar(elements, createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), texts, null, getVerseText, true);

    expect(document.querySelectorAll('.verse-english .verse-word')).toHaveLength(0);
  });

  it('says nothing when there is no handler', () => {
    const elements = getSidebarElements();
    updateSidebar(elements, createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), texts, null, getVerseText, true);

    expect(() => document.querySelector<HTMLElement>('[data-word-index="0"]')!.click()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/sidebar-word-clicks.test.ts`
Expected: FAIL — `setWordClickHandler` is not exported.

- [ ] **Step 3: Render words and report clicks**

In `src/sidebar.ts`, add the handler registry and rewrite the Hebrew branch of
`updateSidebar()`. The English branch is untouched.

```ts
import { splitVerseText, wrapWordsInFragment } from './verseWords.ts';

export interface WordClick {
  text: string;
  index: number;
  book: string;
  chapter: number;
  verse: number;
  element: HTMLElement;
}

let wordClickHandler: ((click: WordClick) => void) | null = null;

/**
 * Listen for clicks on words in the verse popup.
 *
 * The sidebar reports which word was clicked and leaves the meaning of that to
 * the caller, so that the Hebrew stays clickable whatever overlay is active.
 */
export function setWordClickHandler(handler: ((click: WordClick) => void) | null): void {
  wordClickHandler = handler;
}
```

Replace the `if (hebrew) { ... }` block with:

```ts
  if (hebrew) {
    const hebrewText = text?.he || 'Loading...';
    const highlighted = currentOverlay?.highlightVerseText?.(hebrewText, 'he');

    // Whatever the overlay produced, words are wrapped afterwards, so a click
    // finds a word whether or not anything is highlighting the text.
    const fragment = document.createDocumentFragment();
    if (highlighted && highlighted !== hebrewText) {
      if (typeof highlighted === 'string') {
        const holder = document.createElement('div');
        holder.innerHTML = highlighted;
        fragment.append(...holder.childNodes);
      } else {
        fragment.appendChild(highlighted);
      }
    } else {
      fragment.appendChild(document.createTextNode(hebrewText));
    }

    hebrew.replaceChildren(wrapWordsInFragment(fragment, hebrewText));
    attachWordClicks(hebrew as HTMLElement, hebrewText, verse);
  }
```

and add:

```ts
/** One listener on the container, so re-rendering the verse cannot pile them up. */
function attachWordClicks(container: HTMLElement, text: string, verse: TanakhLayout): void {
  const words = splitVerseText(text).filter((piece) => piece.kind === 'word');

  container.onclick = (event) => {
    if (!wordClickHandler) return;

    const span = (event.target as HTMLElement)?.closest?.('.verse-word');
    if (!(span instanceof HTMLElement)) return;

    const index = Number(span.dataset.wordIndex);
    const word = words[index];
    if (!word) return;

    wordClickHandler({
      text: word.text,
      index,
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      element: span,
    });
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/sidebar-word-clicks.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Give a word a hover affordance**

In `src/styles/verse-popup.css`, after the `.verse-hebrew` rule:

```css
#verse-popup .verse-hebrew .verse-word {
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.12s ease;
}

#verse-popup .verse-hebrew .verse-word:hover {
  background: rgba(106, 176, 243, 0.22);
}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. The verse popup's DOM changed shape, so any test asserting
`.verse-hebrew` text content is worth reading — `textContent` is unchanged, but
`innerHTML` assertions will differ.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/sidebar.ts src/styles/verse-popup.css src/__tests__/unit/sidebar-word-clicks.test.ts
git commit -m "Make the words in a verse clickable, and say which one was hit"
```

---

### Task 6: The popover that names the word

A small panel anchored to the clicked word. It has three shapes, and which one
appears is decided by what `meaningsInVerse()` returned:

- **one meaning** — the dictionary form, its gloss, its verse count, a Search
  button, and an "other readings" link that expands the full candidate list for
  the spelling. That link is the escape hatch for the fraction we get wrong.
- **two or three meanings** — each listed with its own Search button and no
  default, because the verse could not choose and nor should we.
- **none** — says the word is not in the dictionary and offers to search the
  spelling as written.

The popover owns no search logic. It is handed the meanings and a callback.

**Files:**
- Create: `src/wordMenu.ts`
- Create: `src/styles/wordMenu.css`
- Test: `src/__tests__/unit/wordMenu.test.ts`

**Interfaces:**
- Consumes: `Meaning` from `src/search/dictionary.ts`, `WordClick` from Task 5.
- Produces:

```ts
export interface WordMenuOptions {
  word: string;
  meanings: Meaning[];
  anchor: HTMLElement;
  /** Named when picking will destroy another overlay; null when it will not. */
  replacesOverlay: string | null;
  /** True when five words are already searched and no colour is left. */
  paletteFull: boolean;
  /** null for "search the spelling as written". */
  onChoose: (meaning: Meaning | null) => void;
}

export function openWordMenu(options: WordMenuOptions): void;
export function closeWordMenu(): void;
```

- [ ] **Step 1: Write the failing test**

```ts
// The panel that opens when a word is clicked.
//
// It names the word the reader clicked before anything happens, because a
// search replaces whatever overlay is showing and a click is too ordinary a
// gesture to do that on its own.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openWordMenu, closeWordMenu } from '../../wordMenu';
import type { Meaning } from '../../search/dictionary';

const leaf: Meaning = {
  keys: ['<LH=/@heb'],
  form: 'עָלֶה',
  gloss: 'leafage',
  pos: 'subs',
  language: 'heb',
  verseCount: 13,
};

const ascend: Meaning = {
  keys: ['<LH[@heb'],
  form: 'עלה',
  gloss: 'ascend',
  pos: 'verb',
  language: 'heb',
  verseCount: 818,
};

function anchor(): HTMLElement {
  const span = document.createElement('span');
  document.body.appendChild(span);
  return span;
}

beforeEach(() => {
  document.body.innerHTML = '';
  closeWordMenu();
});

describe('one certain meaning', () => {
  it('names the word and offers to search it', () => {
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });

    const menu = document.querySelector('.word-menu')!;
    expect(menu.textContent).toContain('עָלֶה');
    expect(menu.textContent).toContain('leafage');
    expect(menu.textContent).toContain('13');
    expect(menu.querySelectorAll('.word-menu-choice')).toHaveLength(1);
  });

  it('hands back the meaning that was chosen', () => {
    const onChoose = vi.fn();
    openWordMenu({ word: 'עלה', meanings: [leaf], anchor: anchor(), replacesOverlay: null, paletteFull: false, onChoose });

    document.querySelector<HTMLElement>('.word-menu-choice')!.click();

    expect(onChoose).toHaveBeenCalledWith(leaf);
  });
});

describe('when the verse cannot choose', () => {
  it('offers each reading with no default', () => {
    openWordMenu({
      word: 'עלת',
      meanings: [leaf, ascend],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });

    const choices = [...document.querySelectorAll('.word-menu-choice')];
    expect(choices).toHaveLength(2);
    expect(choices.some((c) => c.textContent?.includes('leafage'))).toBe(true);
    expect(choices.some((c) => c.textContent?.includes('ascend'))).toBe(true);
  });
});

describe('a word the dictionary does not know', () => {
  it('offers to search the spelling as written', () => {
    const onChoose = vi.fn();
    openWordMenu({ word: 'לו', meanings: [], anchor: anchor(), replacesOverlay: null, paletteFull: false, onChoose });

    const choice = document.querySelector<HTMLElement>('.word-menu-choice')!;
    expect(choice.textContent).toContain('לו');

    choice.click();
    expect(onChoose).toHaveBeenCalledWith(null);
  });
});

describe('when searching costs the current view', () => {
  it('says which view will be lost', () => {
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: 'Haftarah',
      paletteFull: false,
      onChoose: vi.fn(),
    });

    expect(document.querySelector('.word-menu')!.textContent).toContain('Haftarah');
  });
});

describe('when the palette is full', () => {
  it('says so instead of offering a choice that would do nothing', () => {
    const onChoose = vi.fn();
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: true,
      onChoose,
    });

    const menu = document.querySelector('.word-menu')!;
    expect(menu.textContent).toContain('Five words are already on the map');
    expect(menu.querySelectorAll('.word-menu-choice')).toHaveLength(0);
  });
});

describe('dismissing', () => {
  it('leaves nothing behind and chooses nothing', () => {
    const onChoose = vi.fn();
    openWordMenu({ word: 'עלה', meanings: [leaf], anchor: anchor(), replacesOverlay: null, paletteFull: false, onChoose });

    closeWordMenu();

    expect(document.querySelector('.word-menu')).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('replaces an open menu rather than stacking a second one', () => {
    openWordMenu({ word: 'עלה', meanings: [leaf], anchor: anchor(), replacesOverlay: null, paletteFull: false, onChoose: vi.fn() });
    openWordMenu({ word: 'רוח', meanings: [ascend], anchor: anchor(), replacesOverlay: null, paletteFull: false, onChoose: vi.fn() });

    expect(document.querySelectorAll('.word-menu')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/wordMenu.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the popover**

Create `src/wordMenu.ts`. Build the DOM programmatically rather than with
`innerHTML`, as the highlighting code does, since the text includes verse
content.

```ts
// The panel that opens when a reader clicks a word.
//
// Clicking a word never searches by itself. Search is an overlay, and
// setOverlay() destroys the outgoing one along with its settings, so a stray
// click on a verse would silently cost a reader their Haftarah view. The panel
// is where that becomes deliberate - and it doubles as the confirmation that
// we found the word the reader meant, since Hebrew words run together and a
// misfire should be visible before it costs anything.

import './styles/wordMenu.css';
import type { Meaning } from './search/dictionary.ts';

export interface WordMenuOptions {
  word: string;
  meanings: Meaning[];
  anchor: HTMLElement;
  replacesOverlay: string | null;
  onChoose: (meaning: Meaning | null) => void;
}

let open: HTMLElement | null = null;
let dismiss: ((event: MouseEvent | KeyboardEvent) => void) | null = null;

export function closeWordMenu(): void {
  open?.remove();
  open = null;
  if (dismiss) {
    document.removeEventListener('mousedown', dismiss as EventListener);
    document.removeEventListener('keydown', dismiss as EventListener);
    dismiss = null;
  }
}

function choice(label: HTMLElement, onPick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'word-menu-choice';
  button.appendChild(label);
  button.addEventListener('click', onPick);
  return button;
}

function meaningLabel(meaning: Meaning): HTMLElement {
  const label = document.createElement('span');

  const form = document.createElement('span');
  form.className = 'word-menu-form';
  form.textContent = meaning.form;

  const gloss = document.createElement('span');
  gloss.className = 'word-menu-gloss';
  gloss.textContent = meaning.gloss;

  const count = document.createElement('span');
  count.className = 'word-menu-count';
  count.textContent = `${meaning.verseCount} verses`;

  label.append(form, gloss, count);
  return label;
}

export function openWordMenu(options: WordMenuOptions): void {
  closeWordMenu();

  const menu = document.createElement('div');
  menu.className = 'word-menu';
  menu.setAttribute('role', 'dialog');

  if (options.paletteFull) {
    // Five colours, five words. A sixth would repeat a colour and the map could
    // no longer say which word is which, so this says so rather than offering a
    // button that would decline.
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Five words are already on the map. Remove one to add another.';
    menu.appendChild(note);
  } else if (options.meanings.length === 0) {
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Not in the dictionary.';
    menu.appendChild(note);

    const label = document.createElement('span');
    label.textContent = `Search for ${options.word} as written`;
    menu.appendChild(
      choice(label, () => {
        options.onChoose(null);
        closeWordMenu();
      }),
    );
  } else {
    if (options.meanings.length > 1) {
      const note = document.createElement('div');
      note.className = 'word-menu-note';
      note.textContent = 'This verse carries more than one of these.';
      menu.appendChild(note);
    }

    for (const meaning of options.meanings) {
      menu.appendChild(
        choice(meaningLabel(meaning), () => {
          options.onChoose(meaning);
          closeWordMenu();
        }),
      );
    }
  }

  if (options.replacesOverlay) {
    const warning = document.createElement('div');
    warning.className = 'word-menu-warning';
    warning.textContent = `Searching replaces the ${options.replacesOverlay} view.`;
    menu.appendChild(warning);
  }

  // Anchored to the word, then nudged back inside the viewport.
  const box = options.anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + 6}px`;
  menu.style.left = `${box.left}px`;

  document.body.appendChild(menu);
  open = menu;

  const width = menu.getBoundingClientRect().width;
  if (box.left + width > window.innerWidth - 8) {
    menu.style.left = `${Math.max(8, window.innerWidth - width - 8)}px`;
  }

  // A menu that cannot be dismissed is worse than no menu: the reader who did
  // not mean to click has to be able to get back to exactly where they were.
  dismiss = (event) => {
    if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
    if (event instanceof MouseEvent && menu.contains(event.target as Node)) return;
    closeWordMenu();
  };
  document.addEventListener('mousedown', dismiss as EventListener);
  document.addEventListener('keydown', dismiss as EventListener);
}
```

- [ ] **Step 4: Style it**

Create `src/styles/wordMenu.css`, following the dark panel styling the rest of
the app uses (see `src/styles/verse-popup.css` for the palette):

```css
.word-menu {
  position: fixed;
  z-index: 200;
  min-width: 200px;
  max-width: 320px;
  padding: 6px;
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #444;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font-size: 13px;
  color: #eee;
}

.word-menu-note,
.word-menu-warning {
  padding: 6px 8px;
  font-size: 12px;
  color: #aaa;
}

.word-menu-warning {
  border-top: 1px solid #333;
  color: #e0b0b0;
}

.word-menu-choice {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background: none;
  border: none;
  border-radius: 3px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.word-menu-choice:hover {
  background: rgba(106, 176, 243, 0.18);
}

.word-menu-form {
  font-family: 'SBL Hebrew', 'Ezra SIL', 'Times New Roman', serif;
  font-size: 16px;
  direction: rtl;
}

.word-menu-gloss {
  flex: 1;
}

.word-menu-count {
  color: #888;
  font-size: 11px;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/wordMenu.test.ts`
Expected: PASS, all seven.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/wordMenu.ts src/styles/wordMenu.css src/__tests__/unit/wordMenu.test.ts
git commit -m "Add the panel that names the word before anything happens"
```

---

### Task 7: A chosen meaning becomes a search term

The search overlay gains one entry point: search for this word, narrowed to
this meaning. It adds a term rather than replacing the search, keeping the
terms and colours already there, because two words in two colours on one map is
the comparison this app exists for.

A click searches by meaning, which is root mode. If the reader had set
substring or whole-word mode, the click switches it — searching for a meaning
in substring mode is not a thing that can be expressed.

**Files:**
- Modify: `src/overlays/search.ts`
- Test: `src/__tests__/unit/overlays/search-from-click.test.ts`

**Interfaces:**
- Consumes: `Meaning` from the dictionary seam; `addTerm`, `onlyMeaning`,
  `MAX_TERMS` from `src/search/terms.ts`.
- Produces:

```ts
export function searchForMeaning(text: string, meaningKey: string | null): boolean;
export function canAddTerm(): boolean;
```

`searchForMeaning` returns false when the palette is full (`MAX_TERMS` terms
already), true otherwise. `meaningKey` is a meaning's `keys[0]`; `null`
searches the spelling as written. `canAddTerm()` answers the same question
before a click is offered, so the panel can say the palette is full rather than
presenting a button that would do nothing.

- [ ] **Step 1: Write the failing test**

```ts
// Turning a clicked word into a search term.
//
// Clicking adds to the search rather than replacing it: the map is for
// comparing, and two words in two colours is the comparison.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, searchForMeaning } from '../../../overlays/search';
import { meaningsInVerse } from '../../../search/dictionary';
import { loadLexiconData, buildSearchIndex } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import { applyOverlayParams } from '../../helpers/overlayUrlParams';
import type { VerseTexts } from '../../../verseTexts';

registerAllOverlays();
const searchOverlay = getOverlay('search')!;

const texts: VerseTexts = {
  Genesis: {
    3: { 7: { he: 'ויתפרו עלה תאנה', en: 'they sewed fig leaves' } },
    8: { 20: { he: 'ויעל עלת במזבח', en: 'offered burnt offerings' } },
  },
};

const verses = [
  createVerse({ book: 'Genesis', chapter: 3, verse: 7 }),
  createVerse({ book: 'Genesis', chapter: 8, verse: 20 }),
];

function render(): HTMLDivElement {
  const container = document.createElement('div');
  searchOverlay.renderControls?.(container);
  return container as HTMLDivElement;
}

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(texts);
});

beforeEach(() => {
  configure({ verses });
  applyOverlayParams(searchOverlay, { q: '', hm: undefined, m: undefined });
});

describe('searching for a clicked word', () => {
  it('creates a term narrowed to the chosen meaning', () => {
    const container = render();
    const leaf = meaningsInVerse('עלה', 'Genesis:3:7')[0];

    expect(searchForMeaning('עלה', leaf.keys[0])).toBe(true);

    const rows = [...container.querySelectorAll('.term-row')];
    expect(rows).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('.term-input')!.value).toBe('עלה');

    const params = searchOverlay.getUrlParams!();
    expect(params.q).toBe('עלה');
    expect(params.m).toContain(leaf.keys[0]);
  });

  it('adds a second word rather than replacing the first', () => {
    const container = render();
    searchForMeaning('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys[0]);
    searchForMeaning('רוח', null);

    expect(container.querySelectorAll('.term-row')).toHaveLength(2);
  });

  it('switches Hebrew mode to root, since a meaning cannot be matched as a substring', () => {
    render();
    applyOverlayParams(searchOverlay, { q: '', hm: 'substring', m: undefined });

    searchForMeaning('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys[0]);

    expect(searchOverlay.getUrlParams!().hm).toBeUndefined(); // root is the default, so it is not written
  });

  it('searches the spelling as written when there is no meaning', () => {
    const container = render();

    expect(searchForMeaning('לו', null)).toBe(true);
    expect(container.querySelector<HTMLInputElement>('.term-input')!.value).toBe('לו');
  });

  it('refuses a sixth word, because the palette holds five', () => {
    render();
    for (const word of ['עלה', 'רוח', 'מלך', 'בית', 'ארץ']) {
      expect(searchForMeaning(word, null)).toBe(true);
    }

    expect(searchForMeaning('שלום', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/unit/overlays/search-from-click.test.ts`
Expected: FAIL — `searchForMeaning` is not exported.

- [ ] **Step 3: Add the entry point**

In `src/overlays/search.ts`, after `runSearch()`:

```ts
/**
 * Search for a word a reader clicked, narrowed to one of its meanings.
 *
 * Adds a term rather than replacing the search: the existing words keep their
 * colours, which is what makes two words comparable on one map. Returns false
 * when the palette is full, so the caller can say so rather than dropping the
 * click silently.
 *
 * A meaning can only be searched for in root mode - "the burnt-offering
 * reading" cannot be expressed as a substring - so a click moves the mode
 * there. The panel tells the reader before the click is made.
 */
export function searchForMeaning(text: string, meaningKey: string | null): boolean {
  const typed = typedTerms();
  if (typed.length >= MAX_TERMS) return false;

  // The list always holds one empty row to type into. Fill it rather than
  // leaving an empty row above the new word.
  const empty = terms.find((term) => term.text.trim() === '');
  if (empty) {
    terms = setTermText(terms, empty.id, text);
  } else {
    terms = addTerm(terms, text);
  }

  const added = terms[terms.length - 1];
  if (meaningKey) {
    hebrewSearchMode = 'root';
    terms = onlyMeaning(terms, added.id, meaningKey);
  }

  renderTermRows();
  runSearch();
  return true;
}

/**
 * Is there a colour left for another word?
 *
 * Asked before a click is offered, so the panel can say the palette is full
 * rather than showing a button that would quietly do nothing.
 */
export function canAddTerm(): boolean {
  return typedTerms().length < MAX_TERMS;
}
```

Check `typedTerms()` and `setTermText` are already imported; `setTermText` is,
and `typedTerms` is defined at line 103.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/__tests__/unit/overlays/search-from-click.test.ts`
Expected: PASS, all five. If the mode test fails, check how `getUrlParams`
writes `hm` — root is the default and is deliberately not written.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/overlays/search.ts src/__tests__/unit/overlays/search-from-click.test.ts
git commit -m "Let a chosen meaning become a search term"
```

---

### Task 8: Wire the click to the search

`main.ts` is the only place that knows both which overlay is active and how to
switch. It listens for word clicks, asks the dictionary what the word is, opens
the panel, and on a choice switches to search if needed and adds the term.

**Files:**
- Modify: `src/main.ts`
- Test: manual, plus the test harness. This task is wiring between units that
  are each already tested; an integration test here would mostly assert that
  `main()` calls the functions it calls.

**Interfaces:**
- Consumes: `setWordClickHandler` (Task 5), `meaningsInVerse` (Task 2),
  `openWordMenu` (Task 6), `searchForMeaning` (Task 7).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Wire it**

In `src/main.ts`, after `setOverlay` is defined (around line 676), add:

```ts
  // Clicking a word in the verse popup.
  //
  // The panel is what makes this safe: switching to search destroys whichever
  // overlay is showing, and a click on a word is too ordinary a gesture to be
  // allowed to do that on its own.
  setWordClickHandler((click) => {
    const word = normalizeHebrewForSearch(click.text);
    const meanings = meaningsInVerse(word, tanakhKey(click.book, click.chapter, click.verse));

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      replacesOverlay:
        currentOverlay && currentOverlay.id !== 'search' ? currentOverlay.name : null,
      paletteFull: !canAddTerm(),
      onChoose: (meaning) => {
        if (currentOverlayId !== 'search') {
          setOverlay('search');
          if (overlaySelect) overlaySelect.value = 'search';
        }

        if (!searchForMeaning(word, meaning?.keys[0] ?? null)) return;

        applyOverlay();
        render();
        saveUrlState(true);
      },
    });
  });
```

Add the imports at the top of `main.ts`:

```ts
import { getSidebarElements, updateSidebar, setWordClickHandler } from './sidebar.ts';
import { meaningsInVerse } from './search/dictionary.ts';
import { openWordMenu } from './wordMenu.ts';
import { searchForMeaning, canAddTerm } from './overlays/search.ts';
```

`normalizeHebrewForSearch` and `tanakhKey` may already be imported; check before
adding.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. `npm run typecheck` cannot see test files (issue #75), so
run the suite too.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Look at it in the real app**

Start a dev server yourself rather than assuming one is running, and read the
port it picks rather than guessing:

```bash
npm run dev
```

Then check, in a fresh tab:

1. Click a verse to pin it. Click ורוח in Genesis 1:2 — the panel should say
   wind, 348 verses.
2. Click עלה in Genesis 3:7 — leafage, 13 verses. This is the case that proves
   the feature: by frequency alone the answer would have been "ascend".
3. Click עלת in Genesis 8:20 — two readings offered, no default.
4. Click לו in Genesis 2:18 — offers to search the spelling as written.
5. Press Escape, and click elsewhere — the panel goes away and nothing changed.
6. Switch to the Haftarah overlay, pin a verse, click a word — the panel says
   the Haftarah view will be replaced. Dismiss it; the view is still there.
7. Search for one word, then click another — two terms, two colours.
8. Confirm `{פ}` at the end of Genesis 1:5 is not clickable.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/main.ts
git commit -m "Wire a click on a word to the search"
```

---

### Task 9: Land it

- [ ] **Step 1: Update the stale description of the test harness**

`CLAUDE.md` describes the harness as covering "the search input flow (Hebrew
keyboard, transliteration, search)". The keyboard and transliteration were
deleted in PR #97. Rewrite that sentence to describe what the harness actually
does now.

- [ ] **Step 2: Run the full gate**

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

Expected: all four clean.

- [ ] **Step 3: File follow-ups**

Anything found and not fixed goes to an issue rather than a comment. Candidates
seen while planning:

- Sefaria writes parenthesised alternates such as `(לא)` and `(אנתה)`; they are
  treated as words here, and whether the parentheses should be stripped for
  lookup is untested.
- 2,291 empty tokens exist in the displayed Hebrew, from doubled spaces.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin 127-click-to-search
gh pr create --base search-meaning-filter --fill --body "Closes #127"
```

The base is `search-meaning-filter`, not `main`: this stacks on PR #111 and the
term list does not exist without it. Confirm the PR URL is printed.

- [ ] **Step 5: Ask Danyel to look**

A UI change is not complete until he has seen it. Say which port the dev server
is on, which branch, and list the eight checks from Task 8 Step 4 so he can go
through them.
