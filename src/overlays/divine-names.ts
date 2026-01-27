// src/overlays/divine-names.ts
import '../styles/overlays/divine-names.css';
import type { Overlay, Color } from './types.ts';
import type { VerseIdentity, DivineNamesData } from '../types.ts';

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
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/divine-names.json`);
      if (!res.ok) {
        console.error(`Failed to load divine-names.json: ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (e) {
      console.error('Failed to parse divine-names.json:', e);
    }
  },

  destroy() {
    data = {};
  },

  getVerseColor(verse: VerseIdentity): Color | null {
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

  getHoverInfo(verse: VerseIdentity): string | null {
    const code = data[verse.book]?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
    return code > 0 ? LABELS[code] : null;
  },

  getHelpText(): string {
    return 'Colors Torah verses by divine name usage: YHWH (blue), Elohim (red), both (purple).';
  },
};
