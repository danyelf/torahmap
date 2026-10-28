// The rows of an overlay's legend that pair a colour with what it stands for.

import type { Color } from '@torahmap/utils';
import { pickSwatch } from './pickFinder.ts';

/** A `.legend-row` around `content`. */
export function legendRow(...content: (Node | string)[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'legend-row';
  row.append(...content);
  return row;
}

/** A name over a run of rows. */
export function legendHeading(name: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'legend-heading';
  heading.textContent = name;
  return heading;
}

/** A row of a colour and what it stands for, set apart from the row above if `apart`. */
export function swatchRow(color: Color, label: Node | string, apart = false): HTMLElement {
  const row = legendRow(pickSwatch(color), label);
  row.classList.toggle('apart', apart);
  return row;
}

/** Swatch rows of colours and names, set apart from one another the same way in every legend. */
export function swatchList(entries: readonly { color: Color; name: string }[]): HTMLElement[] {
  return entries.map(({ color, name }, i) => swatchRow(color, name, i > 0));
}
