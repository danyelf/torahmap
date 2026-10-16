// The term rows: one row per word, the open row's mode control, and whatever
// the extra mode draws beneath it.
//
// The rows read the term list, ask for changes to it and decide which row the
// reader is working in, but they hold none of it. Everything comes through the
// host below, which is what keeps the term list in one place and makes the
// direction of the dependency visible.
import { colorToCss } from '@torahmap/utils';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { SEARCH_BOX_ID } from '@torahmap/shell/app/search.ts';
import type { ExtraMode } from './extraMode.ts';
import type { SearchLanguage } from './language.ts';
import {
  effectiveMode,
  languageOf,
  MAX_TERMS,
  modesOffered,
  removeTerm,
  SEARCH_COLORS,
  setMode,
  setTermText,
  type SearchTerm,
} from './terms.ts';

/** What the rows ask of whoever owns the search. */
export interface TermRowsHost<X> {
  /** The rows to draw, always at least one so there is somewhere to type. For drawing only. */
  terms(): SearchTerm[];
  /** The row the reader is working in. */
  openId(): string | null;
  /** Items this term accounts for on its own, or null when it is not being searched. */
  hitCount(term: SearchTerm): number | null;
  /** What the extra mode works from, or null while search's data is missing or no word is typed. */
  extraData(): X | null;
  /** Ask for a change to the term list, worked out from the list as it is when applied. */
  edit(change: (terms: SearchTerm[]) => SearchTerm[]): void;
  /** Work in this row from now on. */
  openRow(id: string): void;
  /** Add an empty row and work in that. */
  addRow(): void;
}

export interface TermRowsOptions<X> {
  languages: readonly SearchLanguage[];
  extra?: ExtraMode<X>;
  /** The first box's placeholder. */
  placeholder: string;
}

export interface TermRows {
  render(): void;
  unmount(): void;
}

const MODE_LABELS: Record<string, string> = { substring: 'substring', word: 'word' };

export function mountTermRows<X>(
  elements: { container: HTMLElement | null; addTermButton: HTMLButtonElement | null },
  host: TermRowsHost<X>,
  { languages, extra, placeholder }: TermRowsOptions<X>,
): TermRows {
  const { container, addTermButton } = elements;
  const labelOf = (mode: string) => (mode === extra?.id ? extra.label : MODE_LABELS[mode]);
  const modeOf = (term: SearchTerm) =>
    effectiveMode(term, languages, extra, host.extraData() ?? null);

  const onAddClick = () => {
    host.addRow();
    focusOpenInput();
  };
  addTermButton?.addEventListener('click', onAddClick);

  /**
   * The number a row shows for itself, blank for a row the search is not running
   * — an empty box, or a single letter. A row that matches nothing still shows 0.
   */
  function hitCountText(term: SearchTerm): string {
    const hits = host.hitCount(term);
    return hits == null ? '' : String(hits);
  }

  /** The caret belongs in the row the reader just opened. */
  function focusOpenInput(): void {
    container?.querySelector<HTMLInputElement>('.term-row[data-open="true"] .term-input')?.focus();
  }

  /**
   * What a collapsed row says about itself: the mode, then what the extra mode
   * adds about the term.
   *
   * The mode is named even when unremarkable. Two rows holding עלה in meanings
   * mode are otherwise identical, and telling those apart is the point.
   */
  function termSummary(term: SearchTerm): string {
    const mode = modeOf(term);
    const x = host.extraData();
    const more = mode === extra?.id && x ? extra.summary?.(x, term) : null;
    return more ? `${labelOf(mode)} · ${more}` : labelOf(mode);
  }

  /** The ways this term's own text can be matched, as one control. */
  function buildModeControl(term: SearchTerm): HTMLDivElement {
    const control = document.createElement('div');
    control.className = 'term-mode';

    for (const mode of modesOffered(term, languages, extra)) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'term-mode-option';
      option.dataset.mode = mode;
      option.textContent = labelOf(mode);
      option.addEventListener('click', () => {
        host.edit((terms) => setMode(terms, term.id, mode));
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
    const offered = modesOffered(term, languages, extra).join(',');
    if (body.dataset.modes !== offered) {
      body.dataset.modes = offered;
      body.querySelector('.term-mode')?.remove();
      body.prepend(buildModeControl(term));
    }

    const current = modeOf(term);
    for (const option of body.querySelectorAll<HTMLButtonElement>('.term-mode-option')) {
      option.classList.toggle('on', option.dataset.mode === current);
      if (!extra || option.dataset.mode !== extra.id) continue;
      const language = languageOf(languages, term);
      option.disabled = !extra.possible(host.extraData(), term, language);
      option.title = option.disabled ? (extra.unavailable ?? '') : '';
    }
  }

  /** Make this row the one the reader is working in, and put the caret in it. */
  function openRow(id: string): void {
    host.openRow(id);
    focusOpenInput();
  }

  /** Remove a word, or clear the box when it is the only one left. */
  function removeOrClear(id: string): void {
    host.edit((terms) => (terms.length > 1 ? removeTerm(terms, id) : setTermText(terms, id, '')));
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

    const field = document.createElement('span');
    field.className = 'term-field';
    summary.appendChild(field);

    const word = document.createElement('span');
    word.className = 'term-word';
    field.appendChild(word);

    const state = document.createElement('span');
    state.className = 'term-state';
    field.appendChild(state);

    const chevron = document.createElement('span');
    chevron.className = 'term-chevron';
    field.appendChild(chevron);

    const count = document.createElement('span');
    count.className = 'term-count';
    summary.appendChild(count);

    const remove = document.createElement('button');
    remove.className = `term-remove ${CONTROL.icon}`;
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
    word.classList.toggle('rtl', languageOf(languages, term).rtl);

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
    if (index === 0) input.id = SEARCH_BOX_ID;
    input.value = term.text;
    input.addEventListener('input', () => onTermInput(term.id, input));
    input.addEventListener('paste', (e) => onTermPaste(e, input));
    head.appendChild(input);

    const count = document.createElement('span');
    count.className = 'term-count';
    head.appendChild(count);

    if (extra?.restore) {
      const { label, title, apply } = extra.restore;
      const restore = document.createElement('button');
      restore.className = 'term-all';
      restore.type = 'button';
      restore.textContent = label;
      restore.title = title;
      restore.addEventListener('click', () => host.edit((terms) => apply(terms, term.id)));
      head.appendChild(restore);
    }

    const remove = document.createElement('button');
    remove.className = `term-remove ${CONTROL.icon}`;
    remove.type = 'button';
    if (index === 0) remove.id = 'search-clear';
    remove.textContent = '×';
    remove.addEventListener('click', () => removeOrClear(term.id));
    head.appendChild(remove);

    row.appendChild(head);

    // The mode control and what the extra mode draws share one indented block,
    // so the two read as one statement: this term is matched this way, and if
    // by the extra mode, with these choices.
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
   * row. Nothing else does: the reader types their way between languages
   * mid-word, and rebuilding then would throw away the box they are typing into.
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
    input.dir = input.value && languageOf(languages, term).rtl ? 'rtl' : 'ltr';
    input.placeholder = index === 0 ? placeholder : 'another word';

    const swatch = row.querySelector<HTMLElement>('.term-swatch')!;
    swatch.style.background = colorToCss(SEARCH_COLORS[term.colorIndex]);
    swatch.style.visibility = term.text.trim() ? 'visible' : 'hidden';

    const count = row.querySelector<HTMLElement>('.term-count')!;
    count.textContent = hitCountText(term);

    // Offered only once there is something to undo.
    const x = host.extraData();
    const restore = row.querySelector<HTMLElement>('.term-all');
    if (restore) restore.hidden = !x || !extra?.restore?.shown(x, term);

    // Nothing to clear on the only row while it is empty.
    const remove = row.querySelector<HTMLElement>('.term-remove')!;
    const rowCount = host.terms().length;
    remove.style.display = !term.text && rowCount === 1 ? 'none' : 'block';
    remove.title = rowCount > 1 ? 'Remove this word' : 'Clear';

    const body = row.querySelector<HTMLElement>('.term-body')!;
    renderModeControl(body, term);
    extra?.renderBody?.(body, term, x, (change) => host.edit(change));
  }

  /** What a term keeps of what is typed: its language's own cleaning, if any. */
  function cleaned(text: string): string {
    const language = languages.find((l) => l.claims(text)) ?? languages[languages.length - 1];
    return language.clean?.(text) ?? text;
  }

  function onTermInput(id: string, input: HTMLInputElement): void {
    const clean = cleaned(input.value);
    if (clean !== input.value) {
      const caret = (input.selectionStart ?? clean.length) - (input.value.length - clean.length);
      input.value = clean;
      input.setSelectionRange(caret, caret);
    }
    const text = input.value;
    host.edit((terms) => setTermText(terms, id, text));
  }

  /** Text arrives from a system keyboard or from a paste; clean what is pasted too. */
  function onTermPaste(e: ClipboardEvent, input: HTMLInputElement): void {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    const clean = cleaned(text);
    if (clean === text) return;

    e.preventDefault();
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    input.value = input.value.slice(0, start) + clean + input.value.slice(end);
    const caret = start + clean.length;
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
  function render(): void {
    if (!container) return;

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
      if (container.children[i] !== row) {
        container.insertBefore(row, container.children[i] ?? null);
      }
    });

    if (addTermButton) {
      addTermButton.disabled = list.length >= MAX_TERMS;
    }
  }

  return {
    render,
    unmount() {
      addTermButton?.removeEventListener('click', onAddClick);
    },
  };
}
