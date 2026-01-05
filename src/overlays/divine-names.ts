// src/overlays/divine-names.ts
import type { Overlay, Color } from './types.ts';
import type { Verse, DivineNamesData } from '../types.ts';

const COLORS: Record<number, Color> = {
  1: [0.3, 0.5, 0.9],  // YHWH only - Blue
  2: [0.9, 0.3, 0.3],  // Elohim only - Red
  3: [0.7, 0.3, 0.8],  // Both - Purple
};

const LABELS: Record<number, string> = {
  1: 'YHWH',
  2: 'Elohim',
  3: 'YHWH + Elohim',
};

let data: DivineNamesData = {};

export const divineNamesOverlay: Overlay = {
  id: 'divine-names',
  name: 'Divine Names',

  async init() {
    const res = await fetch('/data/divine-names.json');
    data = await res.json();
  },

  getVerseColor(verse: Verse): Color | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
    return code > 0 ? COLORS[code] ?? null : null;
  },

  renderLegend(container: HTMLElement) {
    container.innerHTML = `
      <div class="legend-row"><span class="swatch" style="background: rgb(77, 128, 230)"></span><span>YHWH</span></div>
      <div class="legend-row"><span class="swatch" style="background: rgb(230, 77, 77)"></span><span>Elohim</span></div>
      <div class="legend-row"><span class="swatch" style="background: rgb(179, 77, 204)"></span><span>Both</span></div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
    return code > 0 ? LABELS[code] : null;
  },
};
