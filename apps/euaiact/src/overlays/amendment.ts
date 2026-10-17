// Colours each article square by whether the 2026 amendment inserted or replaced its text.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, escapeHtml, type Color } from '@torahmap/utils';
import { ANNEX, RECITAL, hex } from '../baseColor.ts';
import type { Origin } from '../data.ts';
import type { ActItem } from '../layout.ts';

export const AMENDED: Readonly<Record<Origin, { plain: Color; lead: Color; name: string }>> = {
  B: { plain: hex('#9aa3ad'), lead: hex('#4f5963'), name: 'Unchanged since 2024' },
  'M1 inserted': { plain: hex('#e8833a'), lead: hex('#b85a17'), name: 'Inserted in 2026' },
  'M1 replaced': { plain: hex('#e6c229'), lead: hex('#b39410'), name: 'Replaced in 2026' },
};
const ANNEX_LEAD = hex('#2f4256');

function colorOf(item: ActItem): Color {
  if (item.layer === 'recital') return RECITAL;
  if (item.layer === 'annex') return item.lead ? ANNEX_LEAD : ANNEX;
  return item.lead ? AMENDED[item.origin].lead : AMENDED[item.origin].plain;
}

export const amendmentOverlay: Overlay<ActItem> = {
  id: 'amendment',
  name: 'Amendment',
  description:
    'Shows which paragraphs the 2026 amendment inserted or replaced. Orange is new, yellow is reworded.',
  getItemColor: (item) => colorOf(item),
  colorsFor: (items) => items.map(colorOf),
  renderLegend(container) {
    container.innerHTML = Object.values(AMENDED)
      .map(
        ({ plain, name }) =>
          `<div class="legend-row"><span class="swatch" style="background: ${colorToCss(plain)}"></span><span>${escapeHtml(name)}</span></div>`,
      )
      .join('');
  },
};
