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

/** The finder drawn in `container`, made on first use; `onType` runs when the reader types. */
export function pickFinderIn(
  container: HTMLElement,
  { placeholder, label, onType }: { placeholder: string; label: string; onType(): void },
): PickFinder {
  const known = finders.get(container);
  if (known?.root.isConnected && container.contains(known.root)) return known;
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
  input.addEventListener('input', onType);
  const finder = { root, input, lists };
  finders.set(container, finder);
  return finder;
}

const span = (className: string, text: string): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
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
