// The parts of a box for finding things to pick: a field to type in, suggestions, and the picks
// so far, each in its colour with a button to unpick it. The overlay decides what a row says.

import './pickFinder.css';
import { colorToCss, type Color } from '@torahmap/utils';
import { CONTROL } from '../panel.ts';
import { windowOf } from './windowOf.ts';

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
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    const first = root.querySelector<HTMLElement>('.pick-suggestions [data-index="0"]');
    if (!first) return;
    event.preventDefault();
    first.focus();
  });
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

const GAP = 4;
const OVERSCAN = 6;
/** Until a row is drawn and measured, a row is taken to be this tall. */
const GUESSED_ROW = 60;

/**
 * The suggestions for what was typed, one above another: `count` rows, each made by `row` only
 * while it is near the scroll box's view, so a long list costs no more than a short one. The box
 * keeps the full height of all of them. The arrow keys move the focus from row to row, and from
 * the field into the first.
 */
export function pickSuggestions(count: number, row: (index: number) => Node): HTMLElement {
  const box = document.createElement('div');
  box.className = 'pick-suggestions';
  const before = document.createElement('div');
  const after = document.createElement('div');
  box.append(before, after);
  const heights = Array<number>(count).fill(GUESSED_ROW + GAP);
  const drawn = new Map<number, HTMLElement>();

  const tops = () => {
    const found: number[] = [];
    let top = 0;
    for (const h of heights) {
      found.push(top);
      top += h;
    }
    return found;
  };

  function draw(): void {
    for (let pass = 0; pass < 3; pass++) {
      const {
        start,
        end,
        before: above,
        after: below,
      } = windowOf(heights, box.scrollTop, box.clientHeight || window.innerHeight, OVERSCAN);
      for (const [index, node] of drawn) {
        if (index >= start && index < end) continue;
        node.remove();
        drawn.delete(index);
      }
      let next: Node = after;
      for (let index = end - 1; index >= start; index--) {
        let node = drawn.get(index);
        if (!node) {
          node = row(index) as HTMLElement;
          node.dataset.index = String(index);
          drawn.set(index, node);
        }
        if (node.nextSibling !== next) box.insertBefore(node, next);
        next = node;
      }
      before.style.height = `${above}px`;
      after.style.height = `${below}px`;
      let moved = false;
      for (const [index, node] of drawn) {
        const height = node.offsetHeight + GAP;
        if (node.offsetHeight && height !== heights[index]) {
          heights[index] = height;
          moved = true;
        }
      }
      if (!moved) return;
    }
  }

  function focusRow(index: number): void {
    const top = tops()[index];
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + heights[index] > box.scrollTop + box.clientHeight)
      box.scrollTop = top + heights[index] - box.clientHeight;
    draw();
    drawn.get(index)?.focus({ preventScroll: true });
  }

  box.addEventListener('scroll', draw);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(box);
  box.addEventListener('keydown', (event) => {
    const at = Number((event.target as HTMLElement).dataset.index);
    if (Number.isNaN(at)) return;
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: count - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    if (to >= 0 && to < count) focusRow(to);
  });
  draw();
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

/** The quick picks under their heading; once `results` list what was picked, they fold behind a "+ heading" link. */
export function pickQuick(heading: string, picks: Node[], results: Node[]): Node[] {
  const box = document.createElement('div');
  box.className = 'pick-quick';
  const body = document.createElement('div');
  body.className = 'pick-quick-body';
  body.append(...picks);
  if (results.length) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'pick-quick-link';
    link.textContent = `+ ${heading}`;
    link.setAttribute('aria-expanded', 'false');
    body.hidden = true;
    link.addEventListener('click', () => {
      body.hidden = !body.hidden;
      link.setAttribute('aria-expanded', String(!body.hidden));
    });
    box.append(link, body);
  } else {
    const title = document.createElement('div');
    title.className = 'panel-section-heading';
    title.textContent = heading;
    box.append(title, body);
  }
  return [box, ...results];
}

/** A heading over a list that fills the panel's remaining height. */
export function pickResultsBox(heading: string): { box: HTMLElement; list: HTMLDivElement } {
  const title = document.createElement('div');
  title.className = 'panel-section-heading';
  title.textContent = heading;
  const list = document.createElement('div');
  list.className = 'results-list results-fill';
  const box = document.createElement('div');
  box.className = 'results-box';
  box.append(title, list);
  return { box, list };
}
