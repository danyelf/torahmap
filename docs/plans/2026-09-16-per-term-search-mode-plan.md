# Per-Term Search Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the substring/whole-word/root matching mode off the search as a whole and onto each search term, so two words can be matched differently on one map.

**Architecture:** `SearchTerm` gains a nullable `mode` field; `effectiveMode()` resolves it against the term's own language, so the default follows the text as it is typed. The module-level `hebrewSearchMode` and `wholeWordEnabled` are deleted, the footer's radios and checkbox are replaced by a control on each term's row, and rows collapse to a one-line summary so the panel has room for it.

**Tech Stack:** TypeScript, Vite, Vitest with jsdom, plain DOM (no framework), WebGL for the map itself (not touched here).

**Spec:** `docs/plans/2026-09-16-per-term-search-mode-design.md`

## Global Constraints

- **No backward compatibility.** The `ww` and `hm` URL parameters are removed outright — not read, not translated, not warned about. Links carrying them lose those settings.
- **No ticket or stage references in code or test comments.** Describe the behaviour. (`src/__tests__/integration/search-overlay-modes.test.ts:2` currently carries `tm-z8ru`; delete it while rewriting that file.)
- **Prettier owns formatting.** `npm run format` before committing; the pre-commit hook checks staged files, typechecks, and runs all tests.
- **No `@ts-ignore`.** Fix types properly.
- **Mode letters in the URL are `s`, `w`, `r`** — never the full words. The `token` kind caps a value at 50 characters.
- **The default mode is root for Hebrew and substring for English.** English never resolves to root.
- **Every task ends with `npm test` fully green.** No task may leave the suite red for a later task to fix.
- Run everything from the worktree root: `/Users/danyel/code/MISC/torahmap-worktrees/115-per-term-search-mode`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/search/terms.ts` | The term list and everything a term carries, as pure functions | Add `SearchMode`, `mode` field, `setMode`, `effectiveMode`, `modesOffered`, `encodeModes`, `applyModes` |
| `src/overlays/search.ts` | The overlay: running the search, the panel, the URL | Read mode per term; replace footer controls with per-row controls; collapse rows |
| `src/styles/overlays/search.css` | Panel styling | Add collapsed-row and mode-control rules; drop the footer rules |
| `src/search.ts` | Corpus matching | **No signature change.** `verseSetsForTerms` is already called one term at a time |
| `src/__tests__/unit/search-terms.test.ts` | Pure term behaviour | New cases for mode defaulting and the URL codec |
| `src/__tests__/integration/search-overlay-modes.test.ts` | Mode switching through the DOM | Rewritten against per-row controls |
| `src/__tests__/unit/overlays/search.test.ts`, `search-from-click.test.ts`, `search-term-colors.test.ts`, `search-meaning-filter.test.ts`, `unit/search-wholeword.test.ts`, `unit/urlState.test.ts` | Various | Rewritten where they drive the deleted controls |

---

## Task 1: A term carries its own mode

**Files:**
- Modify: `src/search/terms.ts`
- Test: `src/__tests__/unit/search-terms.test.ts`

**Interfaces:**
- Consumes: `isHebrewQuery` from `src/search.ts` (safe: `search.ts` does not import `terms.ts`, so there is no cycle).
- Produces:
  - `type SearchMode = 'substring' | 'word' | 'root'`
  - `const SEARCH_MODES: readonly SearchMode[]`
  - `SearchTerm.mode: SearchMode | null`
  - `setMode(terms: SearchTerm[], id: string, mode: SearchMode): SearchTerm[]`
  - `effectiveMode(term: SearchTerm): SearchMode`
  - `modesOffered(term: SearchTerm): SearchMode[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/search-terms.test.ts` (and add `addTerm` is already imported; add `setMode`, `effectiveMode`, `modesOffered` to the existing import block from `'../../search/terms.ts'`):

```ts
describe('a term matched its own way', () => {
  it('defaults Hebrew to root and English to substring', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(effectiveMode(terms[0])).toBe('root');
    expect(effectiveMode(terms[1])).toBe('substring');
  });

  it('lets the default follow the text when the language changes', () => {
    // The reader has chosen nothing, so retyping an English word in Hebrew
    // should get Hebrew's default rather than the one it was created with.
    let terms = addTerm([], 'light');
    terms = setTermText(terms, terms[0].id, 'עלה');
    expect(terms[0].mode).toBeNull();
    expect(effectiveMode(terms[0])).toBe('root');
  });

  it('keeps a chosen mode across an edit', () => {
    let terms = addTerm([], 'עלה');
    terms = setMode(terms, terms[0].id, 'word');
    terms = setTermText(terms, terms[0].id, 'עלו');
    expect(effectiveMode(terms[0])).toBe('word');
  });

  it('holds root for English but does not forget it', () => {
    let terms = addTerm([], 'עלה');
    terms = setMode(terms, terms[0].id, 'root');
    terms = setTermText(terms, terms[0].id, 'light');
    expect(effectiveMode(terms[0])).toBe('word');
    terms = setTermText(terms, terms[0].id, 'עלה');
    expect(effectiveMode(terms[0])).toBe('root');
  });

  it('changes one term without touching its neighbours', () => {
    let terms = addTerm(addTerm([], 'עלה'), 'אור');
    terms = setMode(terms, terms[1].id, 'word');
    expect(effectiveMode(terms[0])).toBe('root');
    expect(effectiveMode(terms[1])).toBe('word');
  });

  it('offers root only to a term the dictionary could answer', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(modesOffered(terms[0])).toEqual(['substring', 'word', 'root']);
    expect(modesOffered(terms[1])).toEqual(['substring', 'word']);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- src/__tests__/unit/search-terms.test.ts`
Expected: FAIL — `setMode is not a function`, `effectiveMode is not a function`.

- [ ] **Step 3: Implement**

In `src/search/terms.ts`, add to the imports at the top:

```ts
import { isHebrewQuery } from '../search.ts';
```

Add above the `SearchTerm` interface:

```ts
/**
 * How a term is matched. Root resolves a written form to the dictionary words
 * it could be, so it is offered only where there is a dictionary — Hebrew.
 */
export type SearchMode = 'substring' | 'word' | 'root';

export const SEARCH_MODES = ['substring', 'word', 'root'] as const satisfies readonly SearchMode[];
```

Add the field to `SearchTerm`:

```ts
  /**
   * How this term is matched, or null while the reader has not said.
   *
   * Null is not the same as substring. A term's language is worked out from
   * its text, and the text changes on every keystroke, so a term created as
   * English and retyped in Hebrew has to pick up Hebrew's default rather than
   * keep the one it was born with. Holding "has not chosen" apart from "chose
   * substring" is what makes that possible.
   */
  mode: SearchMode | null;
```

Set it in `addTerm` — the object literal becomes:

```ts
  return [
    ...terms,
    { id: `t${nextId++}`, text, ...resolve(text), colorIndex: freeColor(terms), mode: null },
  ];
```

`setTermText` spreads the existing term (`{ ...terms[index], ... }`), so a chosen mode already survives an edit; no change needed there.

Add at the end of the file:

```ts
/** Change how one term is matched. */
export function setMode(terms: SearchTerm[], id: string, mode: SearchMode): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, mode } : t));
}

/**
 * How this term will actually be matched: what the reader chose, or the
 * default for the language its text is written in.
 *
 * Root is clamped to whole word for English, which has no dictionary behind
 * it. The clamp is in the reading rather than the field, so a term narrowed to
 * a root and briefly retyped in English is still a root term when the Hebrew
 * comes back.
 */
export function effectiveMode(term: SearchTerm): SearchMode {
  const hebrew = isHebrewQuery(term.text.trim());
  const chosen = term.mode ?? (hebrew ? 'root' : 'substring');
  return !hebrew && chosen === 'root' ? 'word' : chosen;
}

/** The modes this term's own text can be matched by, in the order shown. */
export function modesOffered(term: SearchTerm): SearchMode[] {
  return isHebrewQuery(term.text.trim())
    ? ['substring', 'word', 'root']
    : ['substring', 'word'];
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- src/__tests__/unit/search-terms.test.ts`
Expected: PASS. Then `npm test` — expected fully green, since nothing reads the new field yet.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/search/terms.ts src/__tests__/unit/search-terms.test.ts
git commit -m "Let a term say how it wants to be matched"
```

---

## Task 2: The mode travels in the URL, one entry per term

**Files:**
- Modify: `src/search/terms.ts`
- Test: `src/__tests__/unit/search-terms.test.ts`

**Interfaces:**
- Consumes: `SearchMode`, `setMode`, `SearchTerm` from Task 1.
- Produces:
  - `encodeModes(terms: SearchTerm[]): string`
  - `applyModes(terms: SearchTerm[], encoded: string): SearchTerm[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/search-terms.test.ts`, adding `encodeModes` and `applyModes` to the import block:

```ts
describe('the mode in the URL', () => {
  it('writes nothing while every term is on its default', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(encodeModes(terms)).toBe('');
  });

  it('writes one letter per term, empty for a term that has not chosen', () => {
    let terms = addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'light');
    terms = setMode(terms, terms[1].id, 'word');
    expect(encodeModes(terms)).toBe(',w,');
  });

  it('round-trips every mode', () => {
    let terms = addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'דבר');
    terms = setMode(terms, terms[0].id, 'substring');
    terms = setMode(terms, terms[1].id, 'word');
    terms = setMode(terms, terms[2].id, 'root');
    expect(encodeModes(terms)).toBe('s,w,r');

    const fresh = applyModes(addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'דבר'), 's,w,r');
    expect(fresh.map(effectiveMode)).toEqual(['substring', 'word', 'root']);
  });

  it('leaves a term on its default for an empty or unknown entry', () => {
    const terms = applyModes(addTerm(addTerm([], 'עלה'), 'אור'), ',zzz');
    expect(terms[0].mode).toBeNull();
    expect(terms[1].mode).toBeNull();
    expect(terms.map(effectiveMode)).toEqual(['root', 'root']);
  });

  it('ignores entries past the end of the term list', () => {
    const terms = applyModes(addTerm([], 'עלה'), 'w,r,s');
    expect(terms).toHaveLength(1);
    expect(effectiveMode(terms[0])).toBe('word');
  });

  it('stays well under the 50-character cap at five terms', () => {
    let terms: SearchTerm[] = [];
    for (const word of ['עלה', 'אור', 'דבר', 'מלך', 'ארץ']) terms = addTerm(terms, word);
    for (const term of terms) terms = setMode(terms, term.id, 'substring');
    expect(encodeModes(terms).length).toBeLessThanOrEqual(50);
  });
});
```

(`SearchTerm` needs to be imported as a type in this file if it is not already: `import { ..., type SearchTerm } from '../../search/terms.ts';`)

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- src/__tests__/unit/search-terms.test.ts`
Expected: FAIL — `encodeModes is not a function`.

- [ ] **Step 3: Implement**

Append to `src/search/terms.ts`:

```ts
/**
 * One letter per mode, because the URL layer caps a token at 50 characters and
 * five terms spelled out would be 49 of them.
 */
const MODE_LETTERS: Record<SearchMode, string> = {
  substring: 's',
  word: 'w',
  root: 'r',
};

const MODE_BY_LETTER = new Map<string, SearchMode>(
  SEARCH_MODES.map((mode) => [MODE_LETTERS[mode], mode]),
);

/**
 * The chosen modes, for the URL's `mode` parameter.
 *
 * Positional alongside the comma-separated terms in `q`, exactly as `m` is:
 * one entry per term, and an empty entry for a term still on its default. A
 * search where nobody has chosen writes nothing at all, so an ordinary link is
 * unchanged.
 */
export function encodeModes(terms: SearchTerm[]): string {
  const letters = terms.map((t) => (t.mode ? MODE_LETTERS[t.mode] : ''));
  return letters.some((letter) => letter !== '') ? letters.join(',') : '';
}

/**
 * Apply a `mode` parameter to a freshly built term list.
 *
 * An entry that is empty or unrecognised leaves that term on its default,
 * rather than discarding the term or the search.
 */
export function applyModes(terms: SearchTerm[], encoded: string): SearchTerm[] {
  if (!encoded) return terms;

  const perTerm = encoded.split(',');
  return terms.map((term, i) => {
    const mode = MODE_BY_LETTER.get(perTerm[i]);
    return mode ? { ...term, mode } : term;
  });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- src/__tests__/unit/search-terms.test.ts`
Expected: PASS. Then `npm test` — still fully green.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/search/terms.ts src/__tests__/unit/search-terms.test.ts
git commit -m "Carry each term's mode in its own slot in the URL"
```

---

## Task 3: The search reads each term's mode

This is where the two module-level settings die. The footer radios and checkbox stay on screen and keep working, but they now write onto every term at once — a deliberate two-task bridge, deleted in Task 5, so that nothing is ever left red.

**Files:**
- Modify: `src/overlays/search.ts`
- Test: `src/__tests__/integration/search-overlay-modes.test.ts`, `src/__tests__/unit/urlState.test.ts`

**Interfaces:**
- Consumes: `effectiveMode`, `setMode`, `encodeModes`, `applyModes`, `SearchMode` from Tasks 1–2.
- Produces: `meaningsApply(term: SearchTerm): boolean` (was zero-argument).

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/integration/search-overlay-modes.test.ts`, inside the existing top-level `describe`. It uses the file's existing `container` and `applyOverlayParams` setup:

```ts
describe('two terms, two modes', () => {
  it('matches each term the way that term asks', () => {
    // עלה by root reaches inflected forms; אור as an exact spelling does not.
    applyOverlayParams(searchOverlay, { q: 'עלה,אור', mode: 'r,w' });

    const rootOnly = searchOverlay.getUrlParams!();
    expect(rootOnly.mode).toBe('r,w');
    expect(rootOnly.hm).toBeUndefined();
    expect(rootOnly.ww).toBeUndefined();
  });

  it('keeps one term's mode when another term's changes', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור', mode: 'r,w' });
    expect(searchOverlay.getUrlParams!().mode).toBe('r,w');

    applyOverlayParams(searchOverlay, { q: 'עלה,אור', mode: 'r,s' });
    expect(searchOverlay.getUrlParams!().mode).toBe('r,s');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- src/__tests__/integration/search-overlay-modes.test.ts`
Expected: FAIL — `mode` is not a declared parameter, so `getUrlParams` returns `hm`/`ww` and `mode` is `undefined`.

- [ ] **Step 3: Implement**

All edits in `src/overlays/search.ts`.

**a. Imports.** Add to the `'../search/terms.ts'` import block: `setMode`, `effectiveMode`, `modesOffered`, `encodeModes`, `applyModes`, `type SearchMode`.

**b. Delete the two globals and the old mode list.** Remove `let wholeWordEnabled = false;` (line ~48), `const HEBREW_SEARCH_MODES = [...]` (~49), and `let hebrewSearchMode: ... = 'root';` (~61) together with the comment above it.

**c. Replace the URL parameter declaration:**

```ts
const URL_PARAMS = [
  { key: 'q', kind: 'text' },
  // Positional across the terms in q, one letter each, empty for a term still
  // on its default. Letters rather than words because a token is capped at 50
  // characters and five spelled-out modes would be 49 of them.
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];
```

**d. `meaningsApply` takes a term:**

```ts
/** Root mode over Hebrew is the only place meanings are consulted. */
function meaningsApply(term: SearchTerm): boolean {
  return termIsHebrew(term) && effectiveMode(term) === 'root';
}
```

**e. In `runSearch`, the two mode reads become per term:**

```ts
  const textVerses = (term: SearchTerm): Set<string> => {
    const mode = effectiveMode(term);
    return verseSetsForTerms([term.text.trim()], {
      wholeWordEnglish: mode === 'word',
      // A Hebrew term reaches this path only when the dictionary has nothing
      // for it, and root has always fallen back to whole word there.
      hebrewMode: mode === 'root' ? 'word' : mode,
    })[0];
  };

  currentResults = resultsForVerseSets(
    active.map((term) => {
      if (!meaningsApply(term)) return textVerses(term);
      return term.meanings.length > 0 ? versesFor(selectedKeys(term)) : textVerses(term);
    }),
    active.map((term) => (termIsHebrew(term) ? 'he' : 'en')),
  );
```

**f. The analytics loop simplifies** — it no longer re-derives the mode:

```ts
  for (const term of active) {
    const hebrew = termIsHebrew(term);
    trackSearchExecute(term.text, hebrew ? 'he' : 'en', effectiveMode(term), currentResults.length);
  }
```

**g. `meaningSignature` passes its term:** `if (!meaningsApply(term) || term.meanings.length < 2) return '';`

**h. `findAllTermMatches` takes the terms themselves** so it can ask each one. Change the signature and the branches:

```ts
function findAllTermMatches(text: string, searchTerms: SearchTerm[], isHebrew: boolean): Match[] {
  const matches: Match[] = [];
  const normalizedText = isHebrew ? stripNikkud(text) : text.toLowerCase();

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = searchTerms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term.text) : term.text.toLowerCase();
    // The mode belongs to the term; isHebrew is the language of the verse text
    // being marked up, which is a different question.
    const mode = effectiveMode(term);

    if (!isHebrew && mode === 'word') {
      // ... body unchanged, using normalizedTerm ...
    } else if (isHebrew && mode === 'root') {
      const keys = selectedKeys(term);
      // ... body unchanged; drop the `activeTerms()[termIndex]` lookup ...
    } else if (isHebrew && mode === 'word') {
      // ... body unchanged ...
    } else {
      // ... substring body unchanged ...
    }
  }

  return matches;
}
```

Update the one caller in `highlightSearchTerms`: `findAllTermMatches(text, active, isHebrew)` — delete the `active.map((t) => t.text)`.

**i. `getHoverInfo` decides per matching term:**

```ts
    const named = termIndices.map((i) => {
      const term = active[i];
      if (!term) return '';
      if (meaningsApply(term)) {
        const chosen = term.meanings.filter((m) => term.selected.has(m.keys[0]));
        if (chosen.length > 0) return chosen.map((m) => m.gloss).join(' / ');
      }
      return effectiveMode(term) === 'word' ? `word "${term.text}"` : `"${term.text}"`;
    });
    return `Matches: ${named.filter(Boolean).join(', ')}`;
```

Delete the old `hebrewSearchMode === 'word' && searchIsHebrew()` branch below it.

**j. `getUrlParams`:**

```ts
    if (query) {
      const modes = encodeModes(activeTerms());
      if (modes) params.mode = modes;
    }
    const meanings = encodeMeanings(activeTerms().filter(meaningsApply));
    if (meanings) params.m = meanings;
```

Careful: `encodeMeanings` is positional over the whole list, so filtering would shift positions. Keep it positional over *all* active terms and let a non-root term simply contribute an empty entry — replace the two lines above with:

```ts
    if (query) {
      const modes = encodeModes(activeTerms());
      if (modes) params.mode = modes;
      const meanings = encodeMeanings(activeTerms());
      if (meanings) params.m = meanings;
    }
```

Delete the `params.ww` block and the `params.hm` block.

**k. `applyUrlParams`:**

```ts
    terms = parseSearchTerms(params.q ?? '').reduce(addTerm, [] as SearchTerm[]);
    if (terms.length === 0) terms = addTerm([], '');
    if (params.mode) terms = applyModes(terms, params.mode);
    if (params.m) terms = applyMeanings(terms, params.m);

    runSearch();
```

Delete the `wholeWordEnabled` and `hebrewSearchMode` assignments at the top of the function.

**l. The bridge — the footer controls now write every term.** In `renderControls`, replace the checkbox handler body and the radio handler body:

```ts
    wholeWordCheckbox?.addEventListener('change', () => {
      const mode: SearchMode = wholeWordCheckbox!.checked ? 'word' : 'substring';
      for (const term of terms) {
        if (!termIsHebrew(term)) terms = setMode(terms, term.id, mode);
      }
      runSearch();
    });
```

```ts
          hebrewSearchMode_onChange: for (const term of terms) {
            if (termIsHebrew(term)) {
              terms = setMode(terms, term.id, radio.value as SearchMode);
            }
          }
          runSearch();
```

(Write that as a plain `for` loop inside the existing handler — the label above is only to show where it goes.)

`syncHebrewModeRadios` now has no global to read. Point it at the first Hebrew term so the bridge still reflects reality:

```ts
function syncHebrewModeRadios(): void {
  if (!hebrewModeContainer) return;
  const hebrew = activeTerms().find(termIsHebrew);
  const shown = hebrew ? effectiveMode(hebrew) : 'root';
  for (const radio of hebrewModeContainer.querySelectorAll<HTMLInputElement>(
    'input[name="hebrew-mode"]',
  )) {
    radio.checked = radio.value === shown;
  }
}
```

Call it from `updateOptionVisibility` so it stays honest, and keep the `wholeWordCheckbox.checked` line in `renderControls` reading the first English term the same way. Every one of these lines is deleted in Task 5.

**m. `searchForMeaning`** still writes `hebrewSearchMode`, which no longer exists. For this task only, make it set the new term's mode — Task 4 adds the test that pins the behaviour:

```ts
  if (meaningKeys && meaningKeys.length > 0) {
    terms = setMode(terms, id, 'root');
    terms = onlyMeaning(terms, id, meaningKeys);
  } else {
    terms = setMode(terms, id, 'word');
  }
  syncHebrewModeRadios();
```

- [ ] **Step 4: Fix the tests that drove the deleted parameters**

Run: `npm test`

Every failure will be a test asserting `hm` or `ww` in a URL record. In `src/__tests__/unit/urlState.test.ts` and the six overlay test files, translate each one: `{ hm: 'word' }` over a single Hebrew term becomes `{ mode: 'w' }`; `{ ww: '1' }` over a single English term becomes `{ mode: 'w' }`; `{ hm: 'root' }` becomes either `{ mode: 'r' }` or nothing, since root is the default. Tests that click the radios or the checkbox still work — the bridge keeps them driving the same behaviour.

Re-run until green. Do not add new per-row assertions here; Task 5 owns those.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/overlays/search.ts src/__tests__
git commit -m "Ask each term how it wants to be matched"
```

---

## Task 4: A click settles only the word it was about

**Files:**
- Modify: `src/overlays/search.ts`
- Test: `src/__tests__/unit/overlays/search-from-click.test.ts`

**Interfaces:**
- Consumes: `setMode`, `effectiveMode` from Task 1; `searchForMeaning` as amended in Task 3.
- Produces: nothing new.

This is the defect from the second comment on #115: narrow עלה to leafage, then search תאנה by its written form, and עלה is silently widened back to all four readings.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/unit/overlays/search-from-click.test.ts`:

```ts
it('leaves an already narrowed word narrowed', () => {
  // Take a meaning for the first word, then take a written form for a second.
  // The second click used to move the whole search to whole-word mode, which
  // quietly widened the first word back to all of its readings.
  searchForMeaning('עלה', leafageKeys);
  const afterFirst = searchOverlay.getUrlParams!();

  searchForMeaning('תאנה', null);
  const afterSecond = searchOverlay.getUrlParams!();

  expect(afterSecond.mode).toBe('r,w');
  expect(afterSecond.m).toBe(afterFirst.m + ',');
});
```

Use whatever the file already does to obtain a meaning's keys for עלה — it has a helper or an inline lookup via `meaningsInVerse`; reuse it rather than hard-coding ETCBC keys.

- [ ] **Step 2: Run it and watch it fail or pass**

Run: `npm test -- src/__tests__/unit/overlays/search-from-click.test.ts`
Expected: PASS, because Task 3 already moved the assignment. If it fails, the bug is real and Step 3 is where you fix it; if it passes, Step 3 is only the comment rewrite. Either way the test stays — it is the regression guard for the behaviour the issue was filed about.

- [ ] **Step 3: Rewrite the comment that no longer describes the code**

`searchForMeaning`'s doc comment says "Either way the click settles the Hebrew mode." Replace that paragraph:

```
 * Either way the click settles how that word is matched, and only that word. A
 * meaning can only be searched for in root mode — "the burnt-offering reading"
 * cannot be expressed as a substring. The written form is the opposite
 * request, for this spelling and no other, so it goes to whole word: substring
 * would match it inside longer words, and root would resolve a known spelling
 * back to the readings the reader just declined. Neighbouring terms keep
 * whatever they were doing.
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/overlays/search.ts src/__tests__/unit/overlays/search-from-click.test.ts
git commit -m "A click settles only the word it was about"
```

---

## Task 5: The control moves onto the row, and the row collapses

The largest task, and the one Danyel must see before it can be called done — per `AGENTS.md`, a UI change is not complete until he has looked at it.

**Files:**
- Modify: `src/overlays/search.ts`, `src/styles/overlays/search.css`
- Test: `src/__tests__/integration/search-overlay-modes.test.ts` (rewrite), plus the other five overlay test files where they touch the deleted controls

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: DOM contract the tests rely on —
  - `.term-row[data-term-id][data-open="true"|"false"]`
  - open row: `.term-head > .term-input`, `.term-body > .term-mode > button.term-mode-option[data-mode]`, `.term-meanings`
  - collapsed row: `.term-summary > .term-word`, `.term-summary > .term-state`, `.term-summary > .term-count`, `.term-remove`

- [ ] **Step 1: Write the failing tests**

Rewrite `src/__tests__/integration/search-overlay-modes.test.ts`. Delete the header comment carrying `tm-z8ru` and replace it with a plain description. Keep the existing `beforeEach` fixture wholesale; replace the bodies that queried `#hebrew-mode-container` and `#whole-word-checkbox`. Add:

```ts
const rowFor = (i: number) =>
  container.querySelectorAll<HTMLElement>('.term-row')[i];

const openRow = () => container.querySelector<HTMLElement>('.term-row[data-open="true"]')!;

describe('the mode control lives on the row', () => {
  it('offers three modes to a Hebrew row and two to an English one', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה' });
    searchOverlay.renderControls!(container);
    const hebrew = [...openRow().querySelectorAll<HTMLElement>('.term-mode-option')];
    expect(hebrew.map((b) => b.dataset.mode)).toEqual(['substring', 'word', 'root']);

    applyOverlayParams(searchOverlay, { q: 'light' });
    searchOverlay.renderControls!(container);
    const english = [...openRow().querySelectorAll<HTMLElement>('.term-mode-option')];
    expect(english.map((b) => b.dataset.mode)).toEqual(['substring', 'word']);
  });

  it('marks the mode the term is actually in', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה', mode: 'w' });
    searchOverlay.renderControls!(container);
    const on = openRow().querySelector<HTMLElement>('.term-mode-option.on')!;
    expect(on.dataset.mode).toBe('word');
  });

  it('changes only its own term when clicked', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור' });
    searchOverlay.renderControls!(container);
    openRow()
      .querySelector<HTMLElement>('.term-mode-option[data-mode="word"]')!
      .click();
    expect(searchOverlay.getUrlParams!().mode).toBe('w,');
  });

  it('has no footer controls left', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה' });
    searchOverlay.renderControls!(container);
    expect(container.querySelector('#hebrew-mode-container')).toBeNull();
    expect(container.querySelector('#whole-word-checkbox')).toBeNull();
  });
});

describe('one row is open at a time', () => {
  it('opens the first row and collapses the rest', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור,light' });
    searchOverlay.renderControls!(container);
    const open = container.querySelectorAll('.term-row[data-open="true"]');
    expect(open).toHaveLength(1);
    expect(rowFor(0).dataset.open).toBe('true');
  });

  it('opens the row you click and collapses the one that was open', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור' });
    searchOverlay.renderControls!(container);
    rowFor(1).querySelector<HTMLElement>('.term-summary')!.click();
    expect(rowFor(0).dataset.open).toBe('false');
    expect(rowFor(1).dataset.open).toBe('true');
    expect(container.querySelectorAll('.term-row[data-open="true"]')).toHaveLength(1);
  });

  it('names the mode, and the narrowing when there is one', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור', mode: ',w' });
    searchOverlay.renderControls!(container);
    expect(rowFor(1).querySelector('.term-state')!.textContent).toBe('word');
  });

  it('removes a collapsed word without opening its row first', () => {
    applyOverlayParams(searchOverlay, { q: 'עלה,אור' });
    searchOverlay.renderControls!(container);
    rowFor(1).querySelector<HTMLElement>('.term-remove')!.click();
    expect(container.querySelectorAll('.term-row')).toHaveLength(1);
    expect(rowFor(0).dataset.open).toBe('true');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- src/__tests__/integration/search-overlay-modes.test.ts`
Expected: FAIL — no `.term-mode-option`, no `data-open`, `#hebrew-mode-container` still present.

- [ ] **Step 3: Implement the row**

In `src/overlays/search.ts`:

**a. Track which row is open.** Beside the other module state:

```ts
/**
 * The row the reader is working in. Exactly one row is open; it stays open
 * while they work on the map, so coming back from a click on a verse finds the
 * panel as they left it.
 */
let openTermId: string | null = null;
```

**b. The summary a collapsed row shows:**

```ts
const MODE_LABELS: Record<SearchMode, string> = {
  substring: 'substring',
  word: 'word',
  root: 'root',
};

/**
 * What a collapsed row says about itself: always the mode, then the narrowing
 * when there is one.
 *
 * The mode is named even when it is the default, so the rows read as a column.
 * The narrowing is not decoration — two rows both reading עלה in root mode are
 * otherwise identical, and telling them apart is the point of the feature.
 */
function termSummary(term: SearchTerm): string {
  const mode = MODE_LABELS[effectiveMode(term)];
  if (!meaningsApply(term) || !isNarrowed(term)) return mode;

  const chosen = term.meanings
    .filter((m) => term.selected.has(m.keys[0]))
    .map((m) => m.gloss)
    .join(', ');
  return chosen ? `${mode} · ${chosen}` : mode;
}
```

**c. The mode control:**

```ts
function buildModeControl(term: SearchTerm): HTMLDivElement {
  const control = document.createElement('div');
  control.className = 'term-mode';
  for (const mode of modesOffered(term)) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'term-mode-option';
    option.dataset.mode = mode;
    option.textContent = MODE_LABELS[mode];
    option.addEventListener('click', () => {
      terms = setMode(terms, term.id, mode);
      runSearch();
    });
    control.appendChild(option);
  }
  return control;
}
```

**d. Build each shape.** `buildTermRow` becomes a dispatcher; the existing head-building code moves into `buildOpenRow` unchanged apart from where it appends. Rows carry `data-open`, and `updateTermRow` rebuilds when that flips or when the offered modes change:

```ts
function updateTermRow(row: HTMLElement, term: SearchTerm, index: number, isOpen: boolean): void {
  // The two shapes share no children, so a row that changes state is rebuilt.
  // The modes on offer follow the text's language, so they are part of the
  // signature too — the same trick renderMeanings already uses.
  const shape = `${isOpen}:${isOpen ? modesOffered(term).join(',') : ''}`;
  if (row.dataset.shape !== shape) {
    row.dataset.shape = shape;
    row.dataset.open = String(isOpen);
    row.replaceChildren();
    if (isOpen) buildOpenRow(row, term, index);
    else buildCollapsedRow(row, term);
  }

  if (isOpen) updateOpenRow(row, term, index);
  else updateCollapsedRow(row, term);
}
```

`buildCollapsedRow` builds `.term-summary` holding `.term-swatch`, `.term-word`, `.term-state`, `.term-count` and the existing `.term-remove` button. The summary's click handler opens the row; the remove button's handler calls `e.stopPropagation()` first so the × removes without opening.

```ts
function buildCollapsedRow(row: HTMLElement, term: SearchTerm): void {
  const summary = document.createElement('div');
  summary.className = 'term-summary';
  summary.addEventListener('click', () => {
    openTermId = term.id;
    renderTermRows();
    searchTermsContainer
      ?.querySelector<HTMLInputElement>('.term-row[data-open="true"] .term-input')
      ?.focus();
  });
  // ... swatch, .term-word, .term-state, .term-count appended here ...

  const remove = document.createElement('button');
  remove.className = 'term-remove';
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'Remove this word';
  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    terms = removeTerm(terms, term.id);
    runSearch();
  });
  summary.appendChild(remove);
  row.appendChild(summary);
}
```

`buildOpenRow` is today's `buildTermRow` body, with the mode control inserted as the first child of the block that holds the meanings. Give that block its own element so the control and the checkboxes share one indent:

```ts
  const body = document.createElement('div');
  body.className = 'term-body';
  body.appendChild(buildModeControl(term));
  row.appendChild(body);
```

`renderMeanings` then appends into `.term-body` rather than the row.

**e. `renderTermRows` decides who is open** and passes it down:

```ts
  const list = activeOrEmptyTerms();
  // The open row survives as long as its term does; otherwise the first row
  // takes over, which is also what a fresh panel shows.
  const openId = list.some((t) => t.id === openTermId) ? openTermId : (list[0]?.id ?? null);
  openTermId = openId;
```

and each `updateTermRow(row, term, i, term.id === openId)` / `buildTermRow(term, i, term.id === openId)`.

**f. A new term opens.** In the `#add-term` handler, set `openTermId` to the id of the term just added before calling `renderTermRows()`, then focus its input — replacing the existing `.term-row:last-child` focus line with the `[data-open="true"]` selector.

Do the same in `searchForMeaning`: set `openTermId = id` before `renderTermRows()`, so the word a click just added is the row you are looking at.

**g. Delete the footer.** In `renderControls`, remove the `#search-options` and `#hebrew-mode-container` blocks from the template string, both `querySelector` assignments, both event-listener blocks, `syncHebrewModeRadios` entirely, `updateOptionVisibility` entirely and its four call sites, and the `wholeWordCheckbox` / `hebrewModeContainer` module variables along with their lines in `destroy()`. Update the stale comment in `destroy()` that names `wholeWordEnabled` and `hebrewSearchMode`.

**h. CSS.** In `src/styles/overlays/search.css`, delete the `#search-options`, `.hebrew-mode-*` and `#hebrew-mode-container` rules. Add:

```css
/* A row the reader is not working in: one line saying what it is doing. */
.term-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 3px;
  border-radius: 4px;
  cursor: pointer;
}

.term-summary:hover {
  background: #232323;
}

.term-word {
  font-size: 14px;
  color: #eee;
}

/* The Hebrew reads right to left inside a left-to-right row. */
.term-word.rtl {
  direction: rtl;
  unicode-bidi: isolate;
}

.term-state {
  flex: 1 1 auto;
  font-size: 11px;
  color: #7d7d7d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The open row, and the block holding its mode control and its meanings. */
.term-row[data-open='true'] {
  background: #212121;
  margin: 0 -6px 9px;
  padding: 7px 6px;
  border-radius: 5px;
}

.term-body {
  margin: 6px 0 0 16px;
  border-left: 1px solid #333;
  padding-left: 10px;
}

.term-mode {
  display: inline-flex;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  overflow: hidden;
  background: #202020;
  margin: 3px 0 5px;
}

.term-mode-option {
  font: inherit;
  font-size: 10.5px;
  padding: 2.5px 8px;
  color: #8a8a8a;
  background: none;
  border: none;
  border-right: 1px solid #3d3d3d;
  white-space: nowrap;
  cursor: pointer;
}

.term-mode-option:last-child {
  border-right: none;
}

.term-mode-option:hover {
  color: #fff;
}

.term-mode-option.on {
  background: #2f5f8a;
  color: #fff;
}
```

`.term-meanings` keeps its own rules but loses its `margin`/`border-left`/`padding-left`, which `.term-body` now provides.

- [ ] **Step 4: Run the rewritten file, then everything**

Run: `npm test -- src/__tests__/integration/search-overlay-modes.test.ts`
Expected: PASS.

Run: `npm test`
Expected: failures in the other five overlay test files wherever they query `#whole-word-checkbox`, `#hebrew-mode-container`, or `.term-input` on a row that is now collapsed. Fix each by driving the row control instead, or by opening the row first with `.term-summary` click. Re-run until fully green.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/overlays/search.ts src/styles/overlays/search.css src/__tests__
git commit -m "Put the mode on the row, and let a row you are not using fold away"
```

---

## Task 6: See it work, then open the pull request

**Files:**
- Modify: `docs/plans/2026-09-16-per-term-search-mode-design.md` (the assumptions log)
- Modify: `CLAUDE.md` if the search description no longer matches

- [ ] **Step 1: Start a dev server and confirm it answers**

```bash
npm run dev
```

Let Vite choose the port, read it from the task output, then `curl -s http://localhost:<port>` to confirm before announcing it. Announce the port, the branch (`115-per-term-search-mode`) and the project.

- [ ] **Step 2: Drive the real panel in the browser**

Open the search overlay and check, capturing a screenshot of each:

1. Type `עלה`. The row is open, shows three modes with root marked, and lists its meanings.
2. Narrow it to leafage with the `only` link. Add `אור` — the עלה row collapses and reads `root · leafage`.
3. Set `אור` to whole word. The עלה row still reads `root · leafage` and its count is unchanged. **This is the defect the issue was filed about; confirm it by eye.**
4. Type `light` in a third row. It offers two modes, not three.
5. Click a word in a verse and take its written form. Only that word's row goes to whole word.
6. Copy the URL, reload it, and confirm the panel comes back the same.

- [ ] **Step 3: Read the screenshots**

Actually look at each PNG. A test asserting on the DOM it just built cannot tell you the panel rendered — only the image can.

- [ ] **Step 4: Fill in the assumptions log**

Complete the "Assumptions, open questions and surprises" section at the foot of the design document with what actually happened, and check the three assumptions listed there. Remove any that proved wrong, and say so.

- [ ] **Step 5: Check the prose that describes the search**

`CLAUDE.md` describes the search overlay in its Features list. If the sentence about search modes no longer matches, update it. Do not touch anything else in that file.

- [ ] **Step 6: Commit, push, open the pull request**

```bash
npm run format
git add -A
git commit -m "Record what building it turned up"
git push -u origin 115-per-term-search-mode
gh pr create --base main --fill --body "Closes #115"
```

Embed the screenshots from Step 2 in the pull request body as images, with the decisions as captions — the design decisions belong as pictures, not as paragraphs describing pictures. Confirm the URL is printed and `gh pr view` shows it open against `main`.

**The work is not done until Danyel has looked at the UI and agreed it is ready** (`AGENTS.md`). Leave the pull request open; he merges.

---

## Self-Review

**Spec coverage.** Model and the unset-mode rule → Task 1. URL (`mode` positional, `ww`/`hm` deleted, letters, unknown entries) → Tasks 2 and 3. Engine (`runSearch`, `findAllTermMatches`, `meaningsApply`, `getHoverInfo`, `trackSearchExecute`) → Task 3. `searchForMeaning` and deleting `syncHebrewModeRadios` → Tasks 3 and 5. Panel (collapsed rows, summary text, one row open, click not hover, × without opening, footer removed, row rebuilding) → Task 5. Testing → spread across all tasks. Propagation and per-mode counts are recorded as out of scope and have no task, correctly. Verification and the pull request → Task 6.

**Placeholders.** None: every code step carries the code. Step 4 of Tasks 3 and 5 says "fix the failures" without listing them, which is deliberate — the exact set depends on what the earlier steps changed, and the translation rule is given.

**Type consistency.** `SearchMode`, `setMode`, `effectiveMode`, `modesOffered`, `encodeModes`, `applyModes` are spelled the same in Tasks 1–5. `meaningsApply` takes a term from Task 3 onward and is used that way in Task 5's `termSummary`. `updateTermRow` gains its fourth parameter in Task 5 and every call site listed there passes it.

One thing worth flagging to the reviewer: Task 3 leaves the footer controls writing every term at once for the length of two tasks. That is a bridge, not a second implementation — there is one code path and the old control drives it — and Task 5 deletes it. If Task 5 slips, the branch must not merge in that state.
