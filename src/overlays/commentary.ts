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
    const res = await fetch('/data/commentary-counts.json');
    data = await res.json();
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
        <option value="Rashi">Rashi</option>
        <option value="Ramban">Ramban</option>
        <option value="Ibn Ezra">Ibn Ezra</option>
        <option value="Sforno">Sforno</option>
        <option value="Or HaChaim">Or HaChaim</option>
        <option value="Targum">Targum</option>
        <option value="Talmud">Talmud</option>
        <option value="Midrash">Midrash</option>
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

// Allow main.ts to pass verses reference for max calculation
export function setVerses(v: Verse[]): void {
  verses = v;
  cachedMaxValues = {};
}
