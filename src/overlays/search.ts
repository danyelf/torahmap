// Full-text search overlay
import '../styles/overlays/search.css';
import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { tanakhKey } from '../types.ts';
import {
  getMatchingVerseTerms,
  parseSearchTerms,
  stripNikkud,
  isHebrewQuery,
  computeSnippetForMatch,
  resultsForVerseSets,
  verseSetsForTerms,
  type SearchResult,
} from '../search.ts';
import { versesFor, formMatches } from '../search/dictionary.ts';
import {
  addTerm,
  removeTerm,
  setTermText,
  toggleMeaning,
  onlyMeaning,
  allMeanings,
  isNarrowed,
  selectedKeys,
  encodeMeanings,
  applyMeanings,
  MAX_TERMS,
  type SearchTerm,
} from '../search/terms.ts';
import { SEARCH_COLORS } from '../utils/color.ts';
import { MIN_SEARCH_TERM_LENGTH } from '../constants/app.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { trackSearchExecute } from '../analytics.ts';

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

// State
let verses: TanakhLayout[] = [];
// The search is a list of terms, each with its own text, its own meanings and
// its own colour. There is always at least one, possibly empty, so the panel
// always has somewhere to type.
let terms: SearchTerm[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();
let wholeWordEnabled = false;
const HEBREW_SEARCH_MODES = ['substring', 'word', 'root'] as const;

const URL_PARAMS = [
  { key: 'q', kind: 'text' },
  { key: 'ww', kind: 'token', allowed: ['1'] },
  { key: 'hm', kind: 'token', allowed: HEBREW_SEARCH_MODES },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

// Root is the default: substring matches inside longer words that have nothing
// to do with the query, and it is the one mode where the meaning filter cannot
// appear at all.
let hebrewSearchMode: (typeof HEBREW_SEARCH_MODES)[number] = 'root';
let updateCallback: (() => void) | null = null;
let onVerseClickCallback: ((verse: TanakhLayout) => void) | null = null;

/**
 * The terms the search will actually run, in order.
 *
 * Short ones are left out for the same reason parseSearchTerms drops them: a
 * single letter matches most of the corpus and is almost never meant.
 *
 * The answer is kept until the term list is replaced. getVerseColor asks once
 * per verse, so applyOverlay asks 23,000 times, and it runs on every hover
 * change — filtering the list that often was enough work to show in a frame.
 * Every function in terms.ts returns a new list rather than editing one, so
 * the identity of `terms` is a sound thing to hang the answer on.
 */
let activeTermsCache: { of: SearchTerm[]; value: SearchTerm[] } | null = null;

function activeTerms(): SearchTerm[] {
  if (activeTermsCache?.of !== terms) {
    activeTermsCache = {
      of: terms,
      value: terms.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH),
    };
  }
  return activeTermsCache.value;
}

/**
 * The colour slot a term occupies, given its position among the searched terms.
 *
 * A result, a snippet and a highlight all name a term by its position in the
 * searched list; the swatch and the map ask the term itself. Those were the
 * same number until a term gained a colour that survives its neighbours being
 * edited — delete the first of two terms and the survivor keeps colour 1 while
 * moving to position 0 — so the translation belongs in one place.
 */
function termColorIndex(position: number): number {
  return activeTerms()[position]?.colorIndex ?? 0;
}

/** Terms holding something, including ones too short to search on. */
function typedTerms(): SearchTerm[] {
  return terms.filter((t) => t.text.trim().length > 0);
}

function currentQuery(): string {
  return activeTerms()
    .map((t) => t.text)
    .join(', ');
}

/** Each term's own language, decided by its own text. */
function termIsHebrew(term: SearchTerm): boolean {
  return isHebrewQuery(term.text.trim());
}

/**
 * Does the search involve Hebrew at all? Only the two language-specific
 * controls consult this — whether to show the Hebrew modes or the English
 * whole-word box. What each term matches is decided per term.
 */
function searchIsHebrew(): boolean {
  return activeTerms().some(termIsHebrew);
}

/** Root mode over Hebrew is the only place meanings are consulted. */
function meaningsApply(): boolean {
  return searchIsHebrew() && hebrewSearchMode === 'root';
}

// Incremental rendering state
const RESULTS_BATCH_SIZE = 50;
let renderedCount = 0;
let scrollHandler: (() => void) | null = null;

// DOM references (for cleanup)
let searchResults: HTMLDivElement | null = null;
let searchTermsContainer: HTMLDivElement | null = null;
let searchHitCaption: HTMLDivElement | null = null;
let addTermButton: HTMLButtonElement | null = null;
let wholeWordCheckbox: HTMLInputElement | null = null;
let hebrewModeContainer: HTMLDivElement | null = null;
let documentClickHandler: ((e: MouseEvent) => void) | null = null;

export function configure(config: {
  verses: TanakhLayout[];
  callbacks?: { onVerseClick?: (verse: TanakhLayout) => void };
}): void {
  verses = config.verses;
  if (config.callbacks?.onVerseClick) {
    onVerseClickCallback = config.callbacks.onVerseClick;
  }
}

/**
 * Run the search the current terms describe, and repaint.
 *
 * Two paths, because the modes genuinely differ. In root mode over Hebrew each
 * term contributes the verses of the meanings the reader has left checked, so
 * the choice is what drives the result. Every other mode still matches text,
 * and search() does that as it always has.
 */
function runSearch(): void {
  const active = activeTerms();

  if (active.length === 0) {
    currentResults = [];
    matchingTerms = new Map();
    renderResults();
    renderTermRows();
    updateOptionVisibility();
    updateHitCaption();
    updateCallback?.();
    return;
  }

  // Every term is matched on its own, in its own language. Only a Hebrew term
  // in root mode consults the chosen meanings; everything else is text.
  // Matching text scans the corpus, so it is done only for the terms that need
  // it — a Hebrew term answered from the dictionary never pays for it.
  const textVerses = (term: SearchTerm): Set<string> =>
    verseSetsForTerms([term.text.trim()], {
      wholeWordEnglish: wholeWordEnabled,
      hebrewMode: hebrewSearchMode === 'root' ? 'word' : hebrewSearchMode,
    })[0];

  currentResults = resultsForVerseSets(
    active.map((term) => {
      if (!termIsHebrew(term) || hebrewSearchMode !== 'root') return textVerses(term);
      // A term the dictionary does not know falls back to whole-word matching,
      // as root mode always has. Root is the default now, so a lexeme index
      // that failed to load must not mean Hebrew silently finds nothing.
      return term.meanings.length > 0 ? versesFor(selectedKeys(term)) : textVerses(term);
    }),
    active.map((term) => (termIsHebrew(term) ? 'he' : 'en')),
  );

  matchingTerms = getMatchingVerseTerms(currentResults);

  for (const term of active) {
    const hebrew = termIsHebrew(term);
    const mode = hebrew ? hebrewSearchMode : wholeWordEnabled ? 'word' : 'substring';
    trackSearchExecute(term.text, hebrew ? 'he' : 'en', mode, currentResults.length);
  }

  renderResults();
  renderTermRows();
  updateOptionVisibility();
  updateHitCaption();
  updateCallback?.();
}

/**
 * How many verses one term accounts for on its own.
 *
 * Takes the term, not a row number. Results are indexed by a term's position
 * among the terms actually being searched, which is not its position among the
 * rows on screen — a row holding nothing, or one letter, occupies a row but no
 * search slot. Emptying the first of two rows used to hand the second row the
 * first one's count, which was zero.
 */
function termHitCount(term: SearchTerm): number {
  const index = activeTerms().indexOf(term);
  if (index === -1) return 0;

  let count = 0;
  for (const result of currentResults) {
    if (result.matchingTerms.some((m) => m.termIndex === index)) count++;
  }
  return count;
}

/**
 * ETCBC's parts of speech, short enough to sit beside a gloss.
 */
const POS_LABELS: Record<string, string> = {
  subs: 'n.',
  nmpr: 'n.pr.',
  verb: 'v.',
  adjv: 'adj.',
  advb: 'adv.',
  intj: 'interj.',
  prep: 'prep.',
  prps: 'pron.',
  inrg: 'interrog.',
  prde: 'dem.',
  conj: 'conj.',
  nega: 'neg.',
  prin: 'interrog.pron.',
  art: 'art.',
};

/**
 * The tag beside a meaning: its part of speech, and its language when that is
 * not Hebrew. The language is not decoration — 304 written forms offer two
 * candidates identical in spelling, gloss and part of speech, differing only in
 * being Hebrew or Aramaic. ויאמר is one of them.
 */
function meaningTag(pos: string, language: 'heb' | 'arc'): string {
  const posLabel = POS_LABELS[pos] ?? pos;
  return language === 'arc' ? `(aram., ${posLabel})` : `(${posLabel})`;
}

function buildMeaningRow(
  term: SearchTerm,
  meaning: SearchTerm['meanings'][number],
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'meaning-row';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.addEventListener('change', () => {
    terms = toggleMeaning(terms, term.id, meaning.keys[0]);
    runSearch();
  });
  row.appendChild(box);

  for (const [cls, text] of [
    ['meaning-form', meaning.form],
    ['meaning-tag', meaningTag(meaning.pos, meaning.language)],
    ['meaning-gloss', meaning.gloss],
  ] as const) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    row.appendChild(span);
  }

  // Unchecking the others is fine for the two or three meanings most ambiguous
  // words have, and tedious past that — אלה offers ten. This is the legend
  // isolate gesture, on its own target so it is not competing with the box for
  // what a click means.
  const only = document.createElement('button');
  only.className = 'meaning-only';
  only.type = 'button';
  only.textContent = 'only';
  only.title = `Show only ${meaning.gloss}`;
  only.addEventListener('click', (e) => {
    // The row is a label, so the click would otherwise reach the checkbox too.
    e.preventDefault();
    e.stopPropagation();
    terms = onlyMeaning(terms, term.id, meaning.keys[0]);
    runSearch();
  });
  row.appendChild(only);

  const count = document.createElement('span');
  count.className = 'meaning-count';
  count.textContent = String(meaning.verseCount);
  row.appendChild(count);

  return row;
}

/**
 * Whole-word applies only to English, the mode radios only to Hebrew. Both
 * follow the text, as they always have.
 */
function updateOptionVisibility(): void {
  // Each control follows the terms it can act on, so a search holding both a
  // Hebrew word and an English one shows both — they apply to different rows.
  // With nothing typed, the English box shows, as it always has.
  const active = activeTerms();
  const anyHebrew = active.some(termIsHebrew);
  const anyEnglish = active.length === 0 || active.some((term) => !termIsHebrew(term));

  const options = wholeWordCheckbox?.closest('#search-options') as HTMLElement | null;
  if (options) options.style.display = anyEnglish ? 'block' : 'none';
  if (hebrewModeContainer) hebrewModeContainer.style.display = anyHebrew ? 'block' : 'none';
}

/**
 * The one number the term rows cannot show: how many verses the search finds
 * altogether. Each row carries its own count; this is their union.
 */
function updateHitCaption(): void {
  if (!searchHitCaption) return;

  const active = activeTerms();
  let message: string;
  if (active.length > 0 && currentResults.length > 0) {
    message = `${currentResults.length} matching verses`;
  } else if (active.length > 0) {
    message = 'No matching verses';
  } else if (typedTerms().length > 0) {
    message = 'Type at least 2 characters per term';
  } else {
    message = 'Type to search';
  }

  searchHitCaption.textContent = message;
}

/**
 * Which meanings the list shows — its structure, not which are ticked. The
 * boxes are then synced on every pass, so a refused toggle (unchecking the last
 * one) is put back rather than leaving the page disagreeing with the state.
 */
function meaningSignature(term: SearchTerm): string {
  if (!meaningsApply() || term.meanings.length < 2) return '';
  return term.meanings.map((m) => m.keys[0]).join(',');
}

function renderMeanings(row: HTMLElement, term: SearchTerm): void {
  const signature = meaningSignature(term);

  if (row.dataset.meanings !== signature) {
    row.dataset.meanings = signature;
    row.querySelector('.term-meanings')?.remove();

    if (signature) {
      const list = document.createElement('div');
      list.className = 'term-meanings';
      for (const meaning of term.meanings) {
        list.appendChild(buildMeaningRow(term, meaning));
      }
      row.appendChild(list);
    }
  }

  if (!signature) return;

  const boxes = row.querySelectorAll<HTMLInputElement>('.meaning-row input');
  term.meanings.forEach((meaning, i) => {
    const box = boxes[i];
    if (!box) return;
    box.checked = term.selected.has(meaning.keys[0]);
    // The last checked meaning holds: a term matching nothing by construction
    // is a dead state with no reading. It is locked with a class rather than
    // the disabled attribute, because a disabled checkbox is drawn grey — so
    // the one meaning still chosen would look like the least chosen one.
    const locked = box.checked && term.selected.size === 1;
    box.closest('.meaning-row')?.classList.toggle('locked', locked);
    box.title = locked ? 'The last meaning cannot be unchecked' : '';
  });
}

function buildTermRow(term: SearchTerm, index: number): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'term-row';
  row.dataset.termId = term.id;

  const head = document.createElement('div');
  head.className = 'term-head';

  const swatch = document.createElement('span');
  swatch.className = 'term-swatch';
  head.appendChild(swatch);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'term-input';
  // The first row keeps the old ids: it is still the search box, and its
  // button is still what clears the search.
  if (index === 0) input.id = 'search-input';
  input.value = term.text;
  input.addEventListener('input', () => onTermInput(term.id, input));
  input.addEventListener('paste', (e) => onTermPaste(e, input));
  head.appendChild(input);

  const count = document.createElement('span');
  count.className = 'term-count';
  head.appendChild(count);

  const all = document.createElement('button');
  all.className = 'term-all';
  all.type = 'button';
  all.textContent = 'all';
  all.title = 'Put every meaning back';
  all.addEventListener('click', () => {
    terms = allMeanings(terms, term.id);
    runSearch();
  });
  head.appendChild(all);

  const remove = document.createElement('button');
  remove.className = 'term-remove';
  remove.type = 'button';
  if (index === 0) remove.id = 'search-clear';
  remove.textContent = '\u00d7';
  remove.addEventListener('click', () => {
    terms = terms.length > 1 ? removeTerm(terms, term.id) : setTermText(terms, term.id, '');
    runSearch();
  });
  head.appendChild(remove);

  row.appendChild(head);
  updateTermRow(row, term, index);
  return row;
}

/** Everything about a row that changes without the row itself changing. */
function updateTermRow(row: HTMLElement, term: SearchTerm, index: number): void {
  const input = row.querySelector<HTMLInputElement>('.term-input')!;
  // Safe to assign unconditionally: a term holds exactly what its box holds.
  if (input.value !== term.text) input.value = term.text;
  input.dir = input.value && isHebrewQuery(input.value) ? 'rtl' : 'ltr';
  input.placeholder = index === 0 ? 'Search Hebrew or English…' : 'another word';

  const swatch = row.querySelector<HTMLElement>('.term-swatch')!;
  swatch.style.background = colorToCss(SEARCH_COLORS[term.colorIndex]);
  swatch.style.visibility = term.text.trim() ? 'visible' : 'hidden';

  const count = row.querySelector<HTMLElement>('.term-count')!;
  count.textContent = activeTerms().includes(term) ? String(termHitCount(term)) : '';

  // Offered only once there is something to undo.
  const all = row.querySelector<HTMLElement>('.term-all')!;
  all.hidden = !isNarrowed(term);

  // Nothing to clear on the only row while it is empty.
  const remove = row.querySelector<HTMLElement>('.term-remove')!;
  remove.style.display = !term.text && terms.length === 1 ? 'none' : 'block';
  remove.title = terms.length > 1 ? 'Remove this word' : 'Clear';

  renderMeanings(row, term);
}

function onTermInput(id: string, input: HTMLInputElement): void {
  const cleaned = stripNikkud(input.value);
  if (cleaned !== input.value) {
    const caret = (input.selectionStart ?? cleaned.length) - (input.value.length - cleaned.length);
    input.value = cleaned;
    input.setSelectionRange(caret, caret);
  }
  terms = setTermText(terms, id, input.value);
  runSearch();
}

/** Hebrew arrives from a system keyboard or from a paste; drop its nikkud. */
function onTermPaste(e: ClipboardEvent, input: HTMLInputElement): void {
  const text = e.clipboardData?.getData('text/plain');
  if (!text || !isHebrewQuery(text)) return;

  e.preventDefault();
  const stripped = stripNikkud(text);
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  input.value = input.value.slice(0, start) + stripped + input.value.slice(end);
  const caret = start + stripped.length;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Bring the rows up to date.
 *
 * Rows are updated in place while the term list keeps its shape, because
 * rebuilding would throw away the input the reader is typing into — along with
 * its caret and any half-finished composition. A full rebuild happens only when
 * a term is added, removed or restored from a URL.
 */
function renderTermRows(): void {
  if (!searchTermsContainer) return;

  const list = activeOrEmptyTerms();
  const existing = new Map(
    [...searchTermsContainer.querySelectorAll<HTMLElement>('.term-row')].map((row) => [
      row.dataset.termId,
      row,
    ]),
  );

  // Rows are matched by term id and moved only when they are actually out of
  // place. Re-attaching a node blurs whatever is focused inside it, so
  // replacing the children wholesale would drop focus on every keystroke.
  for (const row of [...searchTermsContainer.children] as HTMLElement[]) {
    if (!list.some((term) => term.id === row.dataset.termId)) row.remove();
  }

  list.forEach((term, i) => {
    let row = existing.get(term.id);
    if (row) {
      updateTermRow(row, term, i);
    } else {
      row = buildTermRow(term, i);
    }
    if (searchTermsContainer!.children[i] !== row) {
      searchTermsContainer!.insertBefore(row, searchTermsContainer!.children[i] ?? null);
    }
  });

  if (addTermButton) {
    addTermButton.disabled = list.length >= MAX_TERMS;
  }
}

/** The list always has somewhere to type, even before anything is typed. */
function activeOrEmptyTerms(): SearchTerm[] {
  if (terms.length === 0) terms = addTerm([], '');
  return terms;
}

function createResultElement(result: SearchResult): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'search-result';

  // Create ref div with term indicators
  const refDiv = document.createElement('div');
  refDiv.className = 'ref';

  const termIndicators = document.createElement('span');
  termIndicators.className = 'term-indicators';
  for (const m of result.matchingTerms) {
    const dot = document.createElement('span');
    dot.className = 'term-dot';
    const color = SEARCH_COLORS[termColorIndex(m.termIndex)];
    dot.style.background = colorToCss(color);
    termIndicators.appendChild(dot);
  }
  refDiv.appendChild(termIndicators);
  refDiv.appendChild(document.createTextNode(`${result.book} ${result.chapter}:${result.verse}`));

  // Create snippet div with highlighting
  const snippetDiv = document.createElement('div');
  snippetDiv.className = `snippet ${result.language === 'he' ? 'rtl' : ''}`;

  const firstMatch = result.matchingTerms[0];

  // Compute snippet on-demand if not present (for lazy evaluation in root mode)
  let snippet = firstMatch.snippet;
  let matchStart = firstMatch.matchStart;
  let matchEnd = firstMatch.matchEnd;

  if (snippet === undefined || matchStart === undefined || matchEnd === undefined) {
    const snippetData = computeSnippetForMatch(
      result,
      firstMatch.termIndex,
      activeTerms()[firstMatch.termIndex]?.text ?? '',
    );
    if (snippetData) {
      snippet = snippetData.snippet;
      matchStart = snippetData.matchStart;
      matchEnd = snippetData.matchEnd;
    } else {
      snippet = `${result.book} ${result.chapter}:${result.verse}`;
      matchStart = 0;
      matchEnd = 0;
    }
  }

  const snippetContent = createHighlightedText(snippet, matchStart, matchEnd, firstMatch.termIndex);
  snippetDiv.appendChild(snippetContent);

  div.appendChild(refDiv);
  div.appendChild(snippetDiv);

  div.addEventListener('click', () => {
    const verse = verses.find(
      (v) => v.book === result.book && v.chapter === result.chapter && v.verse === result.verse,
    );
    if (verse && onVerseClickCallback) {
      onVerseClickCallback(verse);
    }
  });

  return div;
}

function appendResultsBatch(): void {
  if (!searchResults || renderedCount >= currentResults.length) return;

  const end = Math.min(renderedCount + RESULTS_BATCH_SIZE, currentResults.length);
  for (let i = renderedCount; i < end; i++) {
    searchResults.appendChild(createResultElement(currentResults[i]));
  }
  renderedCount = end;
}

function renderResults(): void {
  if (!searchResults) return;

  // Clear previous results and reset scroll state
  const existingResults = searchResults.querySelectorAll('.search-result');
  existingResults.forEach((el) => el.remove());
  renderedCount = 0;

  // Remove previous scroll handler
  if (scrollHandler) {
    searchResults.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  if (currentResults.length === 0) {
    searchResults.classList.remove('visible');
    return;
  }

  // Render first batch
  appendResultsBatch();

  // Set up infinite scroll if there are more results
  if (renderedCount < currentResults.length) {
    scrollHandler = () => {
      if (!searchResults) return;
      const { scrollTop, scrollHeight, clientHeight } = searchResults;
      // Load more when within 100px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        appendResultsBatch();
      }
    };
    searchResults.addEventListener('scroll', scrollHandler);
  }

  searchResults.classList.add('visible');
}

/**
 * Create a DocumentFragment with highlighted text
 * Safer than innerHTML - builds DOM programmatically
 */
function createHighlightedText(
  text: string,
  start: number,
  end: number,
  termIndex: number,
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (start > 0) {
    fragment.appendChild(document.createTextNode(text.slice(0, start)));
  }

  const mark = document.createElement('mark');
  mark.className = `term-${termColorIndex(termIndex)}`;
  mark.textContent = text.slice(start, end);
  fragment.appendChild(mark);

  if (end < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(end)));
  }

  return fragment;
}

// Match interface for search term highlighting
interface Match {
  start: number;
  end: number;
  termIndex: number;
}

/**
 * Check if a character is Hebrew nikkud (diacritical mark)
 */
function isNikkudChar(code: number): boolean {
  return (
    code >= 0x0591 &&
    code <= 0x05c7 &&
    code !== 0x05be &&
    code !== 0x05c0 &&
    code !== 0x05c3 &&
    code !== 0x05c6
  );
}

/**
 * Map position in normalized (no nikkud) text back to original text position
 * Accounts for nikkud characters that were stripped during normalization
 */
function mapNormalizedToOriginalPosition(
  text: string,
  normalizedPos: number,
  startFrom: number = 0,
): number {
  let nikkudCount = 0;
  let currentNormalizedPos = 0;

  for (let i = startFrom; i < text.length && currentNormalizedPos < normalizedPos; i++) {
    const code = text.charCodeAt(i);
    if (isNikkudChar(code)) {
      nikkudCount++;
    } else {
      currentNormalizedPos++;
    }
  }

  return normalizedPos + nikkudCount;
}

/**
 * Split text into words, treating both whitespace and maqaf (־) as separators
 * Returns array of {word, start, end} with positions in the normalized text
 */
function splitIntoWords(
  normalizedText: string,
): Array<{ word: string; start: number; end: number }> {
  const words: Array<{ word: string; start: number; end: number }> = [];
  let start = 0;

  while (start < normalizedText.length) {
    // Skip separators (whitespace and maqaf U+05BE)
    while (
      start < normalizedText.length &&
      (/\s/.test(normalizedText[start]) || normalizedText.charCodeAt(start) === 0x05be)
    ) {
      start++;
    }

    if (start >= normalizedText.length) break;

    // Find end of word (next separator or end of text)
    let end = start;
    while (
      end < normalizedText.length &&
      !(/\s/.test(normalizedText[end]) || normalizedText.charCodeAt(end) === 0x05be)
    ) {
      end++;
    }

    if (end > start) {
      words.push({
        word: normalizedText.slice(start, end),
        start,
        end,
      });
    }

    start = end;
  }

  return words;
}

/**
 * Find all matches for all search terms in the given text
 * Handles Hebrew nikkud stripping and position mapping
 * Respects Hebrew search mode (substring/word/root) and English whole-word setting
 */
function findAllTermMatches(text: string, terms: string[], isHebrew: boolean): Match[] {
  const matches: Match[] = [];
  const normalizedText = isHebrew ? stripNikkud(text) : text.toLowerCase();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

    if (!isHebrew && wholeWordEnabled) {
      // English whole-word matching using regex
      const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text.toLowerCase())) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          termIndex,
        });
      }
    } else if (isHebrew && hebrewSearchMode === 'root') {
      // Mark the words that are one of the meanings this term still stands
      // for. Once a term is narrowed to burnt-offering, a verb meaning
      // "ascend" in the same verse is not a hit and must not be marked.
      const keys = selectedKeys(activeTerms()[termIndex]);
      for (const { word, start } of splitIntoWords(normalizedText)) {
        const hit = keys.length > 0 ? formMatches(keys, word) : word === normalizedTerm;
        if (hit) {
          matches.push({
            start: mapNormalizedToOriginalPosition(text, start),
            end: mapNormalizedToOriginalPosition(text, start + word.length),
            termIndex,
          });
        }
      }
    } else if (isHebrew && hebrewSearchMode === 'word') {
      // Hebrew whole-word matching
      const wordEntries = splitIntoWords(normalizedText);

      for (const { word, start } of wordEntries) {
        if (word === normalizedTerm) {
          // Found a match - map to original text position
          const origStart = mapNormalizedToOriginalPosition(text, start);
          const origEnd = mapNormalizedToOriginalPosition(text, start + word.length);

          matches.push({ start: origStart, end: origEnd, termIndex });
        }
      }
    } else {
      // Substring search (for Hebrew substring mode and English non-whole-word)
      let searchStart = 0;
      while (true) {
        const idx = normalizedText.indexOf(normalizedTerm, searchStart);
        if (idx === -1) break;

        // Map normalized positions back to original text
        let origStart = idx;
        let origEnd = idx + normalizedTerm.length;

        if (isHebrew) {
          origStart = mapNormalizedToOriginalPosition(text, idx);
          origEnd = mapNormalizedToOriginalPosition(text, idx + normalizedTerm.length);
        }

        matches.push({ start: origStart, end: origEnd, termIndex });
        searchStart = idx + 1;
      }
    }
  }

  return matches;
}

/**
 * Remove overlapping matches, keeping the first/longest match
 * Assumes matches are already sorted by position
 */
function removeOverlappingMatches(matches: Match[]): Match[] {
  const filtered: Match[] = [];
  for (const m of matches) {
    if (filtered.length === 0 || m.start >= filtered[filtered.length - 1].end) {
      filtered.push(m);
    }
  }
  return filtered;
}

/**
 * Build DOM fragment with highlighted matches
 */
function buildHighlightedDomFragment(text: string, matches: Match[]): DocumentFragment {
  const fragment = document.createDocumentFragment();

  let pos = 0;
  for (const m of matches) {
    // Add text before this match
    if (m.start > pos) {
      fragment.appendChild(document.createTextNode(text.slice(pos, m.start)));
    }

    // Add highlighted match
    const mark = document.createElement('mark');
    mark.className = `term-${termColorIndex(m.termIndex)}`;
    mark.textContent = text.slice(m.start, m.end);
    fragment.appendChild(mark);

    pos = m.end;
  }

  // Add remaining text after last match
  if (pos < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(pos)));
  }

  return fragment;
}

/**
 * Highlight all search terms in text with per-term colors
 * Returns DocumentFragment with <mark class="term-N"> elements
 * Safer than innerHTML - builds DOM programmatically
 */
export function highlightSearchTerms(text: string, language: 'he' | 'en'): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const active = activeTerms();
  if (active.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const isHebrew = language === 'he';

  // Find all matches
  const matches = findAllTermMatches(
    text,
    active.map((t) => t.text),
    isHebrew,
  );

  if (matches.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Sort by position, longest match first for overlaps
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping matches (keep first/longest)
  const filtered = removeOverlappingMatches(matches);

  // Build result with highlights
  return buildHighlightedDomFragment(text, filtered);
}

export const searchOverlay: Overlay = {
  id: 'search',
  name: 'Text Search',
  description:
    'Lights up every verse holding the word you type, in the Hebrew or in the English. ' +
    'Supports exact string search as well as roots.',
  credits: [
    {
      source:
        'Eep Talstra Centre for Bible and Computer, ' +
        'Biblia Hebraica Stuttgartensia Amstelodamensis (2021)',
      url: 'https://doi.org/10.17026/dans-z6y-skyh',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      collected: 'September 2026',
      note: 'Cite 10.17026/dans-z6y-skyh. Available on GitHub at github.com/ETCBC/bhsa.',
    },
  ],

  getVerseColor(verse: TanakhIdentity): Color | Color[] | null {
    // No active search - use default colors
    if (activeTerms().length === 0) {
      return null;
    }

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);

    if (termIndices && termIndices.length > 0) {
      // Get colors for all matching terms
      // Guard the index: results can outlive the term list they came from for
      // one frame, between a term being removed and the search rerunning.
      const active = activeTerms();
      const colors = termIndices
        .filter((i) => i < active.length)
        .map((i) => SEARCH_COLORS[active[i].colorIndex]);
      if (colors.length === 0) return null;
      // Return array for stipple effect if multiple, otherwise single color
      if (colors.length === 1) {
        return colors[0];
      }
      // Return multiple colors for stipple effect (capped at 4)
      return colors.slice(0, 4) as Color[];
    }

    // Dim non-matching verses
    const brightness = (0.4 + 0.2) * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
    return [brightness, brightness, brightness];
  },

  renderControls(container: HTMLElement): void {
    container.innerHTML = `
      <div id="search-terms"></div>
      <button type="button" id="add-term">+ add a word</button>
      <div id="search-options">
        <label>
          <input type="checkbox" id="whole-word-checkbox">
          Match whole words only
        </label>
      </div>
      <div id="hebrew-mode-container" style="display: none;">
        <div class="hebrew-mode-label">Hebrew search mode:</div>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="substring">
          Substring
        </label>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="word">
          Whole word
        </label>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="root">
          Root (שרש)
        </label>
      </div>
      <div id="search-hit-caption"></div>
      <div id="search-results"></div>
    `;

    searchTermsContainer = container.querySelector('#search-terms');
    addTermButton = container.querySelector('#add-term');
    searchHitCaption = container.querySelector('#search-hit-caption');
    searchResults = container.querySelector('#search-results');
    wholeWordCheckbox = container.querySelector('#whole-word-checkbox');
    hebrewModeContainer = container.querySelector('#hebrew-mode-container');

    addTermButton?.addEventListener('click', () => {
      terms = addTerm(terms, '');
      renderTermRows();
      searchTermsContainer
        ?.querySelector<HTMLInputElement>('.term-row:last-child .term-input')
        ?.focus();
    });

    if (wholeWordCheckbox) {
      wholeWordCheckbox.checked = wholeWordEnabled;
    }

    wholeWordCheckbox?.addEventListener('change', () => {
      wholeWordEnabled = wholeWordCheckbox!.checked;
      runSearch();
    });

    if (hebrewModeContainer) {
      for (const radio of hebrewModeContainer.querySelectorAll<HTMLInputElement>(
        'input[name="hebrew-mode"]',
      )) {
        radio.checked = radio.value === hebrewSearchMode;
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          hebrewSearchMode = radio.value as (typeof HEBREW_SEARCH_MODES)[number];
          runSearch();
        });
      }
    }

    // Results sit in a floating box, so a click elsewhere puts them away.
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
    }
    documentClickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchResults && !searchResults.contains(target) && !container.contains(target)) {
        searchResults.classList.remove('visible');
      }
    };
    document.addEventListener('click', documentClickHandler);

    renderTermRows();
    updateOptionVisibility();
    updateHitCaption();
    if (currentResults.length > 0) renderResults();
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const active = activeTerms();
    if (active.length === 0) return null;

    const termIndices = matchingTerms.get(tanakhKey(verse.book, verse.chapter, verse.verse));
    if (!termIndices) return null;

    if (meaningsApply()) {
      // Name the meanings, not the spelling: that is what was searched for.
      const named = termIndices.map((i) => {
        const term = active[i];
        const chosen = term.meanings.filter((m) => term.selected.has(m.keys[0]));
        return chosen.length > 0 ? chosen.map((m) => m.gloss).join(' / ') : term.text;
      });
      return `Matches: ${named.join(', ')}`;
    }

    const quoted = termIndices.map((i) => `"${active[i].text}"`).join(', ');
    return hebrewSearchMode === 'word' && searchIsHebrew()
      ? `Matches word: ${quoted}`
      : `Matches: ${quoted}`;
  },

  onUpdate(callback: () => void): void {
    updateCallback = callback;
  },

  destroy(): void {
    // Clean up event listeners
    if (scrollHandler && searchResults) {
      searchResults.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
      documentClickHandler = null;
    }
    // Clear DOM references (for memory cleanup)
    searchResults = null;
    searchTermsContainer = null;
    searchHitCaption = null;
    addTermButton = null;
    wholeWordCheckbox = null;
    hebrewModeContainer = null;
    // Clear callbacks
    updateCallback = null;
    onVerseClickCallback = null;
    // NOTE: We intentionally DO NOT reset currentQuery, currentTerms, currentResults,
    // matchingTerms, wholeWordEnabled, hebrewSearchMode, or related state here.
    // These should persist across overlay switches so the user can return to their search.
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const query = currentQuery();
    if (query) {
      params.q = query;
    }
    if (wholeWordEnabled) {
      params.ww = '1';
    }
    // Root is the default now, so it is substring and word that are worth
    // saying. A link written before the default changed paints differently,
    // which is the decision recorded in the design: an absent parameter means
    // whatever the default currently is.
    if (query && searchIsHebrew() && hebrewSearchMode !== 'root') {
      params.hm = hebrewSearchMode;
    }
    if (meaningsApply()) {
      const meanings = encodeMeanings(activeTerms());
      if (meanings) params.m = meanings;
    }
    return params;
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    wholeWordEnabled = params.ww === '1';
    if (wholeWordCheckbox) {
      wholeWordCheckbox.checked = wholeWordEnabled;
    }

    hebrewSearchMode = params.hm ?? 'root';
    if (hebrewModeContainer) {
      for (const radio of hebrewModeContainer.querySelectorAll<HTMLInputElement>(
        'input[name="hebrew-mode"]',
      )) {
        radio.checked = radio.value === hebrewSearchMode;
      }
    }

    // Rebuild the term list from the query, then lay the chosen meanings over
    // it. Positions are safe here: q and m are read as one snapshot.
    terms = parseSearchTerms(params.q ?? '').reduce(addTerm, [] as SearchTerm[]);
    if (terms.length === 0) terms = addTerm([], '');
    if (params.m) {
      terms = applyMeanings(terms, params.m);
    }

    runSearch();
  },

  highlightVerseText(text: string, language: 'he' | 'en'): DocumentFragment | string {
    return highlightSearchTerms(text, language);
  },
};
