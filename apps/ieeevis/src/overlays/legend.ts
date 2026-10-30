// The rows of an overlay's legend.

import { pickSwatch } from '@torahmap/shell/overlays/pickFinder.ts';
import type { Color } from '@torahmap/utils';

export function legendRow(...content: (Node | string)[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'legend-row';
  row.append(...content);
  return row;
}

/** A row of a colour and what it stands for. */
const swatchRow = (color: Color, name: string): HTMLElement => legendRow(pickSwatch(color), name);

/** Swatch rows of colours and names, set apart from one another the same way in every legend. */
export function swatchList(entries: readonly { color: Color; name: string }[]): HTMLElement[] {
  return entries.map(({ color, name }, i) => {
    const row = swatchRow(color, name);
    row.classList.toggle('apart', i > 0);
    return row;
  });
}
