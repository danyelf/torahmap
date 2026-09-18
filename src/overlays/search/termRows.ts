// The term rows: one row per word, the open row's mode control, and its
// meanings.
//
// The rows read and write the term list and decide which row the reader is
// working in, but they hold none of it. Everything comes through the host
// below, which is what keeps the term list in one place and makes the
// direction of the dependency visible.
import { isHebrewQuery } from '../../search.ts';
import { stripNikkud } from '../../hebrew.ts';
import {
  removeTerm,
  setTermText,
  toggleMeaning,
  onlyMeaning,
  allMeanings,
  isNarrowed,
  setMode,
  effectiveMode,
  modesOffered,
  meaningsApply,
  termIsHebrew,
  MAX_TERMS,
  type SearchTerm,
  type SearchMode,
} from '../../search/terms.ts';
import { SEARCH_COLORS, colorToCss } from '../../utils/color.ts';

/** What the rows ask of whoever owns the search. */
export interface TermRowsHost {
  /** The rows to draw, always at least one so there is somewhere to type. */
  terms(): SearchTerm[];
  /** The row the reader is working in. */
  openId(): string | null;
  /** Verses this term accounts for on its own, or null when it is not being searched. */
  hitCount(term: SearchTerm): number | null;
  /** Take this term list and rerun the search on it. */
  setTerms(next: SearchTerm[]): void;
  /** Work in this row from now on. */
  openRow(id: string): void;
  /** Add an empty row and work in that. Nothing to search for, so nothing reruns. */
  addRow(): void;
}

let host: TermRowsHost | null = null;
let container: HTMLElement | null = null;
let addTermButton: HTMLButtonElement | null = null;
/**
 * Held so unmount can take it off again. Today's caller rebuilds its elements
 * before every mount, so the button a listener sits on is discarded anyway —
 * but that is a fact about the caller, and whatever adds a listener should be
 * the thing that removes it.
 */
let onAddClick: (() => void) | null = null;

export function mountTermRows(
  elements: { container: HTMLElement | null; addTermButton: HTMLButtonElement | null },
  rowsHost: TermRowsHost,
): void {
  host = rowsHost;
  container = elements.container;
  addTermButton = elements.addTermButton;

  onAddClick = () => {
    host?.addRow();
    focusOpenInput();
  };
  addTermButton?.addEventListener('click', onAddClick);
}

export function unmountTermRows(): void {
  if (addTermButton && onAddClick) {
    addTermButton.removeEventListener('click', onAddClick);
  }
  onAddClick = null;
  host = null;
  container = null;
  addTermButton = null;
}

/**
 * The number a row shows for itself, blank for a row the search is not running
 * — an empty box, or a single letter. A row that matches nothing still shows 0.
 */
function hitCountText(term: SearchTerm): string {
  const hits = host?.hitCount(term);
  return hits == null ? '' : String(hits);
}

/** The caret belongs in the row the reader just opened. */
function focusOpenInput(): void {
  container?.querySelector<HTMLInputElement>('.term-row[data-open="true"] .term-input')?.focus();
}

/** ETCBC's parts of speech, short enough to sit beside a gloss. */
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
 * The tag beside a meaning: its part of speech, and its language when that
 * isn't Hebrew — otherwise-identical Hebrew and Aramaic readings would look
 * like duplicates (see the dictionary seam in search/dictionary.ts).
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
    host?.setTerms(toggleMeaning(host.terms(), term.id, meaning.keys[0]));
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

  // The legend's isolate gesture, on its own target so it is not competing
  // with the checkbox for what a click means.
  const only = document.createElement('button');
  only.className = 'meaning-only';
  only.type = 'button';
  only.textContent = 'only';
  only.title = `Show only ${meaning.gloss}`;
  only.addEventListener('click', (e) => {
    // The row is a label, so the click would otherwise reach the checkbox too.
    e.preventDefault();
    e.stopPropagation();
    host?.setTerms(onlyMeaning(host.terms(), term.id, meaning.keys));
  });
  row.appendChild(only);

  const count = document.createElement('span');
  count.className = 'meaning-count';
  count.textContent = String(meaning.verseCount);
  row.appendChild(count);

  return row;
}

const MODE_LABELS: Record<SearchMode, string> = {
  substring: 'substring',
  word: 'word',
  meanings: 'meanings',
};

/**
 * What a collapsed row says about itself: the mode, then the narrowing.
 *
 * Both are named even when unremarkable. Two rows holding עלה in meanings mode are
 * otherwise identical, and telling those apart is the point of the feature.
 */
function termSummary(term: SearchTerm): string {
  const mode = MODE_LABELS[effectiveMode(term)];

  // Only a Hebrew term in meanings mode has readings to report, and only a word
  // with at least two of them has anything to report about them. One meaning
  // is not a choice, and a word the dictionary does not know has none at all —
  // both of those are the rows that show no checkboxes either.
  if (!meaningsApply(term) || term.meanings.length < 2) return mode;

  // Saying how many there are rather than leaving the mode bare: meanings over
  // a word with four readings is searching for all four, and a row that said
  // only "meanings" gave no sign of it.
  if (!isNarrowed(term)) return `${mode} · all ${term.meanings.length} meanings`;

  const chosen = term.meanings
    .filter((m) => term.selected.has(m.keys[0]))
    .map((m) => m.gloss)
    .join(', ');
  return chosen ? `${mode} · ${chosen}` : mode;
}

/** The ways this term's own text can be matched, as one control. */
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
      host?.setTerms(setMode(host.terms(), term.id, mode));
    });
    control.appendChild(option);
  }
  return control;
}

/**
 * Replace only the control when the choices change, never the row: the choices
 * follow the text's language, and the reader is typing that text.
 */
function renderModeControl(body: HTMLElement, term: SearchTerm): void {
  const offered = modesOffered(term).join(',');
  if (body.dataset.modes !== offered) {
    body.dataset.modes = offered;
    body.querySelector('.term-mode')?.remove();
    body.prepend(buildModeControl(term));
  }

  const current = effectiveMode(term);
  for (const option of body.querySelectorAll<HTMLElement>('.term-mode-option')) {
    option.classList.toggle('on', option.dataset.mode === current);
  }
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
    // Locked with a class rather than the disabled attribute: a disabled
    // checkbox is drawn grey, so the one meaning still chosen would look like
    // the least chosen one.
    const locked = box.checked && term.selected.size === 1;
    box.closest('.meaning-row')?.classList.toggle('locked', locked);
    box.title = locked ? 'The last meaning cannot be unchecked' : '';
  });
}

/** Make this row the one the reader is working in, and put the caret in it. */
function openRow(id: string): void {
  host?.openRow(id);
  focusOpenInput();
}

/** Remove a word, or clear the box when it is the only one left. */
function removeOrClear(id: string): void {
  const terms = host?.terms() ?? [];
  host?.setTerms(terms.length > 1 ? removeTerm(terms, id) : setTermText(terms, id, ''));
}

/** A row the reader is not working in: one line saying what it is doing. */
function buildCollapsedRow(row: HTMLElement, term: SearchTerm): void {
  const summary = document.createElement('div');
  summary.className = 'term-summary';
  // Click, never hover: hover does not exist on touch, and a control that
  // appears under the pointer is a control you cannot aim at.
  summary.addEventListener('click', () => openRow(term.id));

  const swatch = document.createElement('span');
  swatch.className = 'term-swatch';
  summary.appendChild(swatch);

  const word = document.createElement('span');
  word.className = 'term-word';
  summary.appendChild(word);

  const state = document.createElement('span');
  state.className = 'term-state';
  summary.appendChild(state);

  const count = document.createElement('span');
  count.className = 'term-count';
  summary.appendChild(count);

  const remove = document.createElement('button');
  remove.className = 'term-remove';
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'Remove this word';
  remove.addEventListener('click', (e) => {
    // The × sits inside the summary, so without this the word would be removed
    // and its row opened in the same gesture.
    e.stopPropagation();
    removeOrClear(term.id);
  });
  summary.appendChild(remove);

  row.appendChild(summary);
}

function updateCollapsedRow(row: HTMLElement, term: SearchTerm): void {
  const swatch = row.querySelector<HTMLElement>('.term-swatch')!;
  swatch.style.background = colorToCss(SEARCH_COLORS[term.colorIndex]);
  swatch.style.visibility = term.text.trim() ? 'visible' : 'hidden';

  const word = row.querySelector<HTMLElement>('.term-word')!;
  word.textContent = term.text;
  word.classList.toggle('rtl', termIsHebrew(term));

  row.querySelector<HTMLElement>('.term-state')!.textContent = term.text.trim()
    ? termSummary(term)
    : '';

  const count = row.querySelector<HTMLElement>('.term-count')!;
  count.textContent = hitCountText(term);
}

function buildOpenRow(row: HTMLElement, term: SearchTerm, index: number): void {
  const head = document.createElement('div');
  head.className = 'term-head';

  const swatch = document.createElement('span');
  swatch.className = 'term-swatch';
  head.appendChild(swatch);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'term-input';
  // The first row carries the well-known ids: it is the search box, and its
  // button is what clears the search.
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
    host?.setTerms(allMeanings(host.terms(), term.id));
  });
  head.appendChild(all);

  const remove = document.createElement('button');
  remove.className = 'term-remove';
  remove.type = 'button';
  if (index === 0) remove.id = 'search-clear';
  remove.textContent = '\u00d7';
  remove.addEventListener('click', () => removeOrClear(term.id));
  head.appendChild(remove);

  row.appendChild(head);

  // The mode control and the meaning checkboxes share one indented block, so
  // the two read as one statement: this term is matched this way, and if by
  // meanings, these are the readings it stands for.
  const body = document.createElement('div');
  body.className = 'term-body';
  row.appendChild(body);
}

function buildTermRow(term: SearchTerm, index: number, isOpen: boolean): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'term-row';
  row.dataset.termId = term.id;
  updateTermRow(row, term, index, isOpen);
  return row;
}

/**
 * Everything about a row that changes without the row itself changing.
 *
 * Open and collapsed rows share no children, so opening or closing rebuilds the
 * row. Nothing else does: the reader types their way between languages mid-word,
 * and rebuilding then would throw away the box they are typing into.
 */
function updateTermRow(row: HTMLElement, term: SearchTerm, index: number, isOpen: boolean): void {
  if (row.dataset.open !== String(isOpen)) {
    row.dataset.open = String(isOpen);
    row.replaceChildren();
    if (isOpen) buildOpenRow(row, term, index);
    else buildCollapsedRow(row, term);
  }

  if (!isOpen) {
    updateCollapsedRow(row, term);
    return;
  }

  updateOpenRow(row, term, index);
}

function updateOpenRow(row: HTMLElement, term: SearchTerm, index: number): void {
  const input = row.querySelector<HTMLInputElement>('.term-input')!;
  // Safe to assign unconditionally: a term holds exactly what its box holds.
  if (input.value !== term.text) input.value = term.text;
  input.dir = input.value && isHebrewQuery(input.value) ? 'rtl' : 'ltr';
  input.placeholder = index === 0 ? 'Search Hebrew or English…' : 'another word';

  const swatch = row.querySelector<HTMLElement>('.term-swatch')!;
  swatch.style.background = colorToCss(SEARCH_COLORS[term.colorIndex]);
  swatch.style.visibility = term.text.trim() ? 'visible' : 'hidden';

  const count = row.querySelector<HTMLElement>('.term-count')!;
  count.textContent = hitCountText(term);

  // Offered only once there is something to undo.
  const all = row.querySelector<HTMLElement>('.term-all')!;
  all.hidden = !isNarrowed(term);

  // Nothing to clear on the only row while it is empty.
  const remove = row.querySelector<HTMLElement>('.term-remove')!;
  const rowCount = host?.terms().length ?? 0;
  remove.style.display = !term.text && rowCount === 1 ? 'none' : 'block';
  remove.title = rowCount > 1 ? 'Remove this word' : 'Clear';

  const body = row.querySelector<HTMLElement>('.term-body')!;
  renderModeControl(body, term);
  renderMeanings(body, term);
}

function onTermInput(id: string, input: HTMLInputElement): void {
  const cleaned = stripNikkud(input.value);
  if (cleaned !== input.value) {
    const caret = (input.selectionStart ?? cleaned.length) - (input.value.length - cleaned.length);
    input.value = cleaned;
    input.setSelectionRange(caret, caret);
  }
  host?.setTerms(setTermText(host.terms(), id, input.value));
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
export function renderTermRows(): void {
  if (!container || !host) return;

  const list = host.terms();
  const openId = host.openId();

  const existing = new Map(
    [...container.querySelectorAll<HTMLElement>('.term-row')].map((row) => [
      row.dataset.termId,
      row,
    ]),
  );

  // Rows are matched by term id and moved only when they are actually out of
  // place. Re-attaching a node blurs whatever is focused inside it, so
  // replacing the children wholesale would drop focus on every keystroke.
  for (const row of [...container.children] as HTMLElement[]) {
    if (!list.some((term) => term.id === row.dataset.termId)) row.remove();
  }

  list.forEach((term, i) => {
    const isOpen = term.id === openId;
    let row = existing.get(term.id);
    if (row) {
      updateTermRow(row, term, i, isOpen);
    } else {
      row = buildTermRow(term, i, isOpen);
    }
    if (container!.children[i] !== row) {
      container!.insertBefore(row, container!.children[i] ?? null);
    }
  });

  if (addTermButton) {
    addTermButton.disabled = list.length >= MAX_TERMS;
  }
}
