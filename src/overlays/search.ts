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
  setMode,
  effectiveMode,
  encodeModes,
  applyModes,
  MAX_TERMS,
  type SearchTerm,
  type SearchMode,
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
// The search is a list of terms, each with its own text, its own meanings, its
// own colour and its own way of being matched. There is always at least one,
// possibly empty, so the panel always has somewhere to type.
let terms: SearchTerm[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();

const URL_PARAMS = [
  { key: 'q', kind: 'text' },
  // Positional across the terms in q, one letter each, and an empty entry for
  // a term still on its default. Letters rather than words because a token is
  // capped at 50 characters and five spelled-out modes would be 49 of them.
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

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

/** Root mode over Hebrew is the only place meanings are consulted. */
function meaningsApply(term: SearchTerm): boolean {
  return termIsHebrew(term) && effectiveMode(term) === 'root';
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
    trackSearchExecute(term.text, hebrew ? 'he' : 'en', effectiveMode(term), currentResults.length);
  }

  renderResults();
  renderTermRows();
  updateOptionVisibility();
  updateHitCaption();
  updateCallback?.();
}

/**
 * Search for a word a reader clicked, narrowed to one of its meanings.
 *
 * Adds a term rather than replacing the search: the existing words keep their
 * colours, which is what makes two words comparable on one map. Returns false
 * when the palette is full, so the caller can say so rather than dropping the
 * click silently.
 *
 * Either way the click settles the Hebrew mode. A meaning can only be
 * searched for in root mode - "the
 * burnt-offering reading" cannot be expressed as a substring. The written form
 * is the opposite request, for this spelling and no other, so it goes to whole
 * word: substring mode would match it inside longer words, and root mode would
 * resolve a known spelling to its dictionary entry and find the readings the
 * reader just declined.
 *
 * The meaning arrives as every lexeme its row stands for, not as one key. The
 * reader chose from a list the verse built, and a row the verse built can be
 * headed by a different lexeme than the same row in the term's own list, so a
 * single key would be a key this term does not answer to.
 */
export function searchForMeaning(text: string, meaningKeys: readonly string[] | null): boolean {
  const typed = typedTerms();
  if (typed.length >= MAX_TERMS) return false;

  // The list always holds one empty row to type into. Fill it rather than
  // leaving an empty row above the new word. setTermText replaces a term in
  // place, so the filled row keeps its position - track it by id rather than
  // assuming it lands last, which is wrong whenever the empty row was not the
  // last one (a reader who cleared an earlier box while a later one still
  // held a word).
  const empty = terms.find((term) => term.text.trim() === '');
  let id: string;
  if (empty) {
    id = empty.id;
    terms = setTermText(terms, id, text);
  } else {
    terms = addTerm(terms, text);
    id = terms[terms.length - 1].id;
  }

  if (meaningKeys && meaningKeys.length > 0) {
    terms = setMode(terms, id, 'root');
    terms = onlyMeaning(terms, id, meaningKeys);
  } else {
    terms = setMode(terms, id, 'word');
  }
  syncHebrewModeRadios();

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
    terms = onlyMeaning(terms, term.id, meaning.keys);
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
 * Put the mode radios where the mode actually is.
 *
 * Nothing else keeps them honest. A reader can change the mode without touching
 * them - choosing a meaning from a clicked word moves the search to root - and
 * a radio still filled from before is worse than merely wrong: its `checked`
 * property is already true, so clicking it fires no change event and the reader
 * cannot get back the way they came.
 */
function syncHebrewModeRadios(): void {
  const hebrew = activeTerms().find(termIsHebrew);
  if (hebrewModeContainer) {
    const shown = hebrew ? effectiveMode(hebrew) : 'root';
    for (const radio of hebrewModeContainer.querySelectorAll<HTMLInputElement>(
      'input[name="hebrew-mode"]',
    )) {
      radio.checked = radio.value === shown;
    }
  }

  const english = activeTerms().find((term) => !termIsHebrew(term));
  if (wholeWordCheckbox) {
    wholeWordCheckbox.checked = english ? effectiveMode(english) === 'word' : false;
  }
}

/**
 * Set every term of one language at once.
 *
 * The footer controls are one setting for the whole search, which is the thing
 * being got rid of; they drive the per-term state through here until the row
 * controls replace them.
 */
function setModeForLanguage(hebrew: boolean, mode: SearchMode): void {
  for (const term of terms) {
    if (termIsHebrew(term) === hebrew) terms = setMode(terms, term.id, mode);
  }
  runSearch();
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
  if (!meaningsApply(term) || term.meanings.length < 2) return '';
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
function findAllTermMatches(text: string, searchTerms: SearchTerm[], isHebrew: boolean): Match[] {
  const matches: Match[] = [];
  const normalizedText = isHebrew ? stripNikkud(text) : text.toLowerCase();

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = searchTerms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term.text) : term.text.toLowerCase();
    // The mode belongs to the term. `isHebrew` is the language of the verse
    // text being marked up, which is a different question.
    const mode = effectiveMode(term);

    if (!isHebrew && mode === 'word') {
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
    } else if (isHebrew && mode === 'root') {
      // Mark the words that are one of the meanings this term still stands
      // for. Once a term is narrowed to burnt-offering, a verb meaning
      // "ascend" in the same verse is not a hit and must not be marked.
      const keys = selectedKeys(term);
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
    } else if (isHebrew && mode === 'word') {
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
  const matches = findAllTermMatches(text, active, isHebrew);

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

    wholeWordCheckbox?.addEventListener('change', () => {
      setModeForLanguage(false, wholeWordCheckbox!.checked ? 'word' : 'substring');
    });

    syncHebrewModeRadios();
    if (hebrewModeContainer) {
      for (const radio of hebrewModeContainer.querySelectorAll<HTMLInputElement>(
        'input[name="hebrew-mode"]',
      )) {
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          setModeForLanguage(true, radio.value as SearchMode);
        });
      }
    }

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

    // Each term is named the way that term was searched for. A verse can be
    // claimed by a word narrowed to one meaning and by an exact spelling at
    // once, and saying so is the point of the modes being separate.
    const named = termIndices.map((i) => {
      const term = active[i];
      if (!term) return '';

      if (meaningsApply(term)) {
        // Name the meanings, not the spelling: that is what was searched for.
        const chosen = term.meanings.filter((m) => term.selected.has(m.keys[0]));
        if (chosen.length > 0) return chosen.map((m) => m.gloss).join(' / ');
      }
      return effectiveMode(term) === 'word' ? `word "${term.text}"` : `"${term.text}"`;
    });

    return `Matches: ${named.filter(Boolean).join(', ')}`;
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
    // NOTE: We intentionally DO NOT reset the terms, currentResults,
    // matchingTerms or related state here. These should persist across overlay
    // switches so the user can return to their search — including the mode each
    // term was being matched by.
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const query = currentQuery();
    if (query) {
      params.q = query;
    }
    if (query) {
      // Both are positional over the same list, so they are written together
      // and a term that has chosen nothing contributes an empty entry rather
      // than being skipped — skipping it would shift every later term.
      const modes = encodeModes(activeTerms());
      if (modes) params.mode = modes;

      const meanings = encodeMeanings(activeTerms());
      if (meanings) params.m = meanings;
    }
    return params;
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    // Rebuild the term list from the query, then lay the chosen modes and
    // meanings over it. Positions are safe here: q, mode and m are read as one
    // snapshot. It is editing, not loading, that needs identity.
    terms = parseSearchTerms(params.q ?? '').reduce(addTerm, [] as SearchTerm[]);
    if (terms.length === 0) terms = addTerm([], '');
    if (params.mode) {
      terms = applyModes(terms, params.mode);
    }
    if (params.m) {
      terms = applyMeanings(terms, params.m);
    }

    syncHebrewModeRadios();
    runSearch();
  },

  highlightVerseText(text: string, language: 'he' | 'en'): DocumentFragment | string {
    return highlightSearchTerms(text, language);
  },
};
