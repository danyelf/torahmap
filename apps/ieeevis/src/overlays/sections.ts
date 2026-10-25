// Colours each piece by the section of its paper it falls in. Placeholders stay dark.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, escapeHtml, type Color } from '@torahmap/utils';
import { PLACEHOLDER, hex, isPlaceholder, jittered } from '../baseColor.ts';
import type { Section } from '../data.ts';
import type { PieceItem } from '../layout.ts';

export const SECTIONS: Readonly<Record<Exclude<Section, 'x'>, { color: Color; name: string }>> = {
  a: { color: hex('#e6c229'), name: 'Abstract' },
  i: { color: hex('#4aa3df'), name: 'Introduction' },
  r: { color: hex('#8e7cc3'), name: 'Related work' },
  m: { color: hex('#3fb68b'), name: 'Method or design' },
  e: { color: hex('#e8833a'), name: 'Evaluation or results' },
  d: { color: hex('#d95f8a'), name: 'Discussion' },
  c: { color: hex('#c8483c'), name: 'Conclusion' },
  f: { color: hex('#6b7480'), name: 'References' },
  o: { color: hex('#a08a64'), name: 'Other' },
};

const colorOf = (item: PieceItem): Color =>
  isPlaceholder(item)
    ? PLACEHOLDER
    : jittered(SECTIONS[item.section as keyof typeof SECTIONS].color, item);

export const sectionsOverlay: Overlay<PieceItem> = {
  id: 'sections',
  name: 'Sections',
  description:
    'Colors each piece by the section of its paper it falls in, so the shape of every paper shows. Dark squares have no text yet.',
  getItemColor: (item) => colorOf(item),
  colorsFor: (items) => items.map(colorOf),
  renderLegend(container) {
    container.innerHTML = Object.values(SECTIONS)
      .map(
        ({ color, name }) =>
          `<div class="legend-row"><span class="swatch" style="background: ${colorToCss(color)}"></span><span>${escapeHtml(name)}</span></div>`,
      )
      .join('');
  },
};
