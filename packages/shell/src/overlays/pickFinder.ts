// The parts of a box for finding things to pick: a field to type in, suggestions, and the picks
// so far, each in its colour with a button to unpick it. The overlay decides what a row says.

import './pickFinder.css';
import { colorToCss, type Color } from '@torahmap/utils';
import { CONTROL } from '../panel.ts';

export interface PickFinder {
  root: HTMLElement;
  input: HTMLInputElement;
  /** Emptied and redrawn by the overlay after every change. */
  lists: HTMLElement;
}

const finders = new WeakMap<HTMLElement, PickFinder>();

/**
 * The finder drawn in `container`, made on first use by `extend` from the parts it builds, so an
 * overlay keeps its own state on it; `onType` runs when the reader types.
 */
export function pickFinderIn<F extends PickFinder>(
  container: HTMLElement,
  {
    placeholder,
    label,
    extend,
    onType,
  }: {
    placeholder: string;
    label: string;
    extend(parts: PickFinder): F;
    onType(finder: F): void;
  },
): F {
  const known = finders.get(container);
  // A container holds only the finder that its own overlay's `extend` made.
  if (known?.root.isConnected && container.contains(known.root)) return known as F;
  const root = document.createElement('div');
  root.className = 'pick-finder';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = `${CONTROL.input} pick-input`;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', label);
  const lists = document.createElement('div');
  lists.className = 'pick-lists';
  root.append(input, lists);
  container.replaceChildren(root);
  const finder = extend({ root, input, lists });
  input.addEventListener('input', () => onType(finder));
  finders.set(container, finder);
  return finder;
}

/** A span of text, set right to left when `lang` is. */
export const span = (className: string, text: string, lang?: string): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  if (lang) {
    element.lang = lang;
    element.dir = 'rtl';
  }
  return element;
};

export const pickSwatch = (color: Color): HTMLSpanElement => {
  const element = span('swatch', '');
  element.style.background = colorToCss(color);
  return element;
};

/** A small grey line under a row's name. */
export const pickMeta = (text: string): HTMLSpanElement => span('pick-meta', text);

/** A line of explanation among the lists. */
export const pickNote = (text: string): HTMLSpanElement => span('pick-note', text);

/** A suggestion to click, its lines one under another. */
export function pickRow(lines: (Node | string)[], onClick: () => void): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'pick-row';
  row.append(...lines);
  row.addEventListener('click', onClick);
  return row;
}

/** The picks so far: each a swatch, what it says, and a button that unpicks it. */
export function pickedList(
  picks: { color: Color; text: (Node | string)[]; removeTitle: string; onRemove(): void }[],
): HTMLElement {
  const list = document.createElement('div');
  list.className = 'pick-picked';
  for (const { color, text, removeTitle, onRemove } of picks) {
    const row = document.createElement('div');
    row.className = 'pick-picked-row';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = CONTROL.icon;
    remove.textContent = '×';
    remove.title = removeTitle;
    remove.setAttribute('aria-label', removeTitle);
    remove.addEventListener('click', onRemove);
    const body = document.createElement('div');
    body.className = 'pick-picked-text';
    body.append(...text);
    row.append(pickSwatch(color), body, remove);
    list.append(row);
  }
  return list;
}

/** The suggestions for what was typed, one above another. */
export function pickSuggestions(rows: Node[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'pick-suggestions';
  box.append(...rows);
  return box;
}

/** A small button to pick one thing; `on` marks it as already picked. */
export function pickChip(
  label: string,
  {
    title,
    on,
    disabled,
    onClick,
  }: { title: string; on: boolean; disabled: boolean; onClick(): void },
): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'pick-chip';
  chip.textContent = label;
  chip.title = title;
  chip.classList.toggle('on', on);
  chip.disabled = disabled;
  chip.addEventListener('click', onClick);
  return chip;
}

/** Chips side by side, wrapping. */
export function pickChips(chips: Node[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pick-chips';
  row.append(...chips);
  return row;
}
