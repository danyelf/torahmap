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
export const swatchRow = (color: Color, name: string): HTMLElement =>
  legendRow(pickSwatch(color), name);
