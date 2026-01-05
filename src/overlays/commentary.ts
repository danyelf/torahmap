// src/overlays/commentary.ts
import type { Overlay, Color } from './types.ts';
import type { Verse, CommentaryData } from '../types.ts';
import { heatmapColor } from '../utils/color.ts';

let data: CommentaryData = {};
let currentCategory = 'total';
let updateCallback: (() => void) | null = null;

// Cache max values per category to avoid recalculating
let cachedMaxValues: Record<string, number> = {};
let verses: Verse[] = [];

function getCount(book: string, chapter: number, verse: number): number {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (currentCategory === 'total') return verseData.total;
  return verseData.categories[currentCategory] || 0;
}

function getMaxValue(): number {
  if (cachedMaxValues[currentCategory] !== undefined) {
    return cachedMaxValues[currentCategory];
  }
  let max = 0;
  for (const v of verses) {
    const count = getCount(v.book, v.chapter, v.verse);
    if (count > max) max = count;
  }
  cachedMaxValues[currentCategory] = max;
  return max;
}

export const commentaryOverlay: Overlay = {
  id: 'commentary',
  name: 'Commentary Density',

  async init() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/commentary-counts.json`);
      if (!res.ok) {
        console.error(`Failed to load commentary-counts.json: ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (e) {
      console.error('Failed to parse commentary-counts.json:', e);
    }
  },

  destroy() {
    currentCategory = 'total';
    cachedMaxValues = {};
    updateCallback = null;
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: Verse): Color | null {
    // Store reference to verses for max calculation
    // This is a bit awkward - we'll improve this in integration
    const count = getCount(verse.book, verse.chapter, verse.verse);
    const maxValue = getMaxValue();
    return heatmapColor(count, maxValue);
  },

  renderControls(container: HTMLElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'commentary-controls';
    wrapper.innerHTML = `
      <label for="category-select">Category:</label>
      <select id="category-select">
        <option value="total">All Commentary</option>
        <option value="Tanakh">Tanakh</option>
        <option value="Talmud">Talmud</option>
        <option value="Midrash">Midrash</option>
        <option value="Halakhah">Halakhah</option>
        <option value="Kabbalah">Kabbalah</option>
      </select>
    `;
    const select = wrapper.querySelector('select')!;
    select.value = currentCategory;
    select.addEventListener('change', () => {
      currentCategory = select.value;
      cachedMaxValues = {}; // Clear cache on category change
      updateCallback?.();
    });
    container.appendChild(wrapper);
  },

  renderLegend(container: HTMLElement) {
    const maxValue = getMaxValue();
    const logMax = Math.log(maxValue + 1);

    // Calculate tick values (powers of 10)
    const ticks: number[] = [0];
    let tickVal = 1;
    while (tickVal <= maxValue) {
      ticks.push(tickVal);
      tickVal *= 10;
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = `
      <div class="legend-gradient"></div>
      <div class="legend-ticks">
        ${ticks.map(val => {
          const pos = val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100;
          const label = val >= 1000 ? `${val / 1000}k` : String(val);
          return `<span class="tick" style="left: ${pos}%">${label}</span>`;
        }).join('')}
      </div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    const verseData = data[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
    if (!verseData) return null;
    if (currentCategory === 'total') {
      return `${verseData.total} links`;
    }
    const count = verseData.categories[currentCategory];
    return count ? `${count} ${currentCategory}` : null;
  },
};

export function configure(config: { verses: Verse[] }): void {
  verses = config.verses;
  cachedMaxValues = {};
}

// Get total linked texts count for a verse (used by sidebar)
export function getVerseLinkCount(book: string, chapter: number, verse: number): number | null {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  return verseData?.total ?? null;
}
