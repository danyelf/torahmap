import type { Overlay, Color } from './types.ts';
import type { TanakhIdentity } from '../types.ts';
import { tanakhKey } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { interpolateGradient, buildLegendGradient, type ColorStop } from '../utils/color.ts';
import { legendCaption } from './legend.ts';

// Perceptually uniform and colorblind-friendly: purple -> pink -> orange -> yellow.
const PLASMA_STOPS: ColorStop[] = [
  { t: 0.0, color: [13 / 255, 8 / 255, 135 / 255] }, // dark purple
  { t: 0.25, color: [126 / 255, 3 / 255, 168 / 255] }, // magenta
  { t: 0.5, color: [204 / 255, 71 / 255, 120 / 255] }, // pink/red
  { t: 0.75, color: [248 / 255, 149 / 255, 64 / 255] }, // orange
  { t: 1.0, color: [240 / 255, 249 / 255, 33 / 255] }, // yellow
];

let verseTexts: VerseTexts | null = null;
let wordCountCache: Map<string, number> = new Map();
let minWordCount = 0;
let maxWordCount = 0;

// A word must contain at least one letter, so punctuation-only tokens
// (e.g. em dashes) don't count.
function countHebrewWords(text: string): number {
  if (!text) return 0;
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  return words.length;
}

export function configure(config: { verseTexts: VerseTexts }): void {
  verseTexts = config.verseTexts;
  wordCountCache.clear();

  let min = Infinity;
  let max = 0;

  for (const book in verseTexts) {
    for (const chapter in verseTexts[book]) {
      for (const verse in verseTexts[book][chapter]) {
        const verseText = verseTexts[book][chapter][verse];
        const hebrewText = verseText.he;
        const wordCount = countHebrewWords(hebrewText);

        const key = tanakhKey(book, parseInt(chapter), parseInt(verse));
        wordCountCache.set(key, wordCount);

        if (wordCount > 0) {
          min = Math.min(min, wordCount);
          max = Math.max(max, wordCount);
        }
      }
    }
  }

  minWordCount = min === Infinity ? 0 : min;
  maxWordCount = max;
}

function getVerseColorForWordCount(verse: TanakhIdentity): Color | null {
  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  const wordCount = wordCountCache.get(key);

  if (wordCount === undefined || wordCount === 0) {
    return [0.15, 0.15, 0.2];
  }

  // Square root scale so a few very long verses don't compress everything
  // else toward one end of the palette.
  const sqrtMin = Math.sqrt(minWordCount);
  const sqrtMax = Math.sqrt(maxWordCount);
  const sqrtValue = Math.sqrt(wordCount);
  const t = (sqrtValue - sqrtMin) / (sqrtMax - sqrtMin);

  return interpolateGradient(t, PLASMA_STOPS);
}

export const verseLengthOverlay: Overlay = {
  id: 'verse-length',
  name: 'Verse Length',
  description:
    'Shades each verse by how many Hebrew words it has, the shortest dark and the ' +
    'longest bright.',

  getVerseColor(verse: TanakhIdentity): Color | null {
    return getVerseColorForWordCount(verse);
  },

  renderLegend(container: HTMLElement): void {
    const gradient = buildLegendGradient(10, (i) => interpolateGradient(i / 9, PLASMA_STOPS));

    const paletteName = 'Plasma';
    const lowColor = 'Purple';
    const highColor = 'Orange/yellow';

    container.innerHTML = `
      <div class="legend-row">
        <div style="
          width: 100%;
          height: 12px;
          background: ${gradient};
          border-radius: 2px;
          margin-bottom: 6px;
        "></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
          <span>${minWordCount} words</span>
          <span>${maxWordCount} words</span>
        </div>
      </div>
      ${legendCaption(`${lowColor} = shorter verses`, { marginTop: 8 })}
      ${legendCaption(`${highColor} = longer verses`)}
      ${legendCaption(`Square root scale · ${paletteName} palette`)}
    `;
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const wordCount = wordCountCache.get(key);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';
    return `${wordCount} ${plural}`;
  },

  renderSidebarInfo(verse: TanakhIdentity): HTMLElement | string | null {
    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const wordCount = wordCountCache.get(key);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';

    const div = document.createElement('div');
    div.style.cssText =
      'margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 4px;';
    label.textContent = 'Verse Length:';

    const value = document.createElement('div');
    value.style.cssText = 'font-size: 13px; color: #ddd;';
    value.textContent = `${wordCount} ${plural}`;

    div.appendChild(label);
    div.appendChild(value);

    return div;
  },
};
