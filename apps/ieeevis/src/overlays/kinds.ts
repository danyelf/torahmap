// Colours every square by the kind of its paper, placeholders included.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { hex, type Color } from '@torahmap/utils';
import { jittered } from '../baseColor.ts';
import type { PieceItem } from '../layout.ts';
import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';

const FAMILIES = [
  { name: 'Full VIS paper', color: hex('#4aa3df'), has: (k: string) => k === 'Full VIS Paper' },
  {
    name: 'Journal paper (TVCG, CG&A)',
    color: hex('#3fb6b6'),
    has: (k: string) => k === 'TVCG Paper' || k === 'CG&A Paper',
  },
  { name: 'Short paper', color: hex('#7bc45a'), has: (k: string) => k === 'VIS Short Paper' },
  {
    name: 'Workshop paper',
    color: hex('#8e7cc3'),
    has: (k: string) => k.endsWith('Workshop Paper'),
  },
  { name: 'Poster', color: hex('#e8833a'), has: (k: string) => k === 'Poster' },
  {
    name: 'Challenge contribution',
    color: hex('#e6c229'),
    has: (k: string) => k === 'Challenge Contribution',
  },
  { name: 'Arts program or talk', color: hex('#d95f8a'), has: () => true },
];

const colorOf = (item: PieceItem): Color =>
  jittered(FAMILIES.find((f) => f.has(item.paper.kind))!.color, item);

export const KINDS_ID = 'kinds';

export const kindsOverlay: Overlay<PieceItem> = {
  id: KINDS_ID,
  name: 'Paper type',
  description: 'Colors every square by the kind of paper it belongs to.',
  colorsFor: (items) => items.map(colorOf),
  renderLegend(container) {
    container.replaceChildren(...swatchList(FAMILIES));
  },
};
