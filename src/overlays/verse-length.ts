import './verse-length.css';
import type { Overlay, Color } from './types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { verseId } from '@torahmap/link';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import { verseWords } from '../verseWords.ts';
import type { ColorStop } from '../utils/color.ts';
import { scale, SQRT, type Scale } from '../utils/scale.ts';
import { axisGradient, legendCaption, renderAxis } from './legend.ts';
import { VERSE_LENGTH } from '@torahmap/overlay-catalog';
import { NO_DATA } from './colors.ts';
import { memoByValue } from '../utils/memo.ts';

// Perceptually uniform and colorblind-friendly: purple -> pink -> orange -> yellow.
const PLASMA_STOPS: ColorStop[] = [
  { t: 0.0, color: [13 / 255, 8 / 255, 135 / 255] }, // dark purple
  { t: 0.25, color: [126 / 255, 3 / 255, 168 / 255] }, // magenta
  { t: 0.5, color: [204 / 255, 71 / 255, 120 / 255] }, // pink/red
  { t: 0.75, color: [248 / 255, 149 / 255, 64 / 255] }, // orange
  { t: 1.0, color: [240 / 255, 249 / 255, 33 / 255] }, // yellow
];

export interface VerseLengthData {
  texts: VerseTexts;
}

interface WordCounts {
  byVerse: Map<string, number>;
  min: number;
  max: number;
  scale: Scale;
}

/**
 * Every verse's word count, the range of the non-empty ones and their colour
 * scale, once per data value. The scale is square root, so that a few very long
 * verses don't compress everything else toward one end of the palette.
 */
const wordCountsOf = memoByValue(({ texts }: VerseLengthData): WordCounts => {
  const byVerse = new Map<string, number>();
  let min = Infinity;
  let max = 0;
  for (const book in texts) {
    for (const chapter in texts[book]) {
      for (const verse in texts[book][chapter]) {
        const wordCount = verseWords(texts[book][chapter][verse].he).length;
        byVerse.set(verseId(book, parseInt(chapter), parseInt(verse)), wordCount);
        if (wordCount > 0) {
          min = Math.min(min, wordCount);
          max = Math.max(max, wordCount);
        }
      }
    }
  }
  min = min === Infinity ? 0 : min;
  return { byVerse, min, max, scale: scale(min, max, SQRT, PLASMA_STOPS) };
});

function wordCountAt(data: VerseLengthData, verse: TanakhLayout): number | undefined {
  return wordCountsOf(data).byVerse.get(verse.id);
}

function verseColorAt(data: VerseLengthData, verse: TanakhLayout): Color | null {
  const wordCount = wordCountAt(data, verse);
  if (wordCount === undefined || wordCount === 0) return NO_DATA;
  return wordCountsOf(data).scale.colorOf(wordCount);
}

export const verseLengthOverlay: Overlay<TanakhIdentity, void, VerseLengthData> = {
  ...VERSE_LENGTH,
  data: { texts: TEXTS_FILE },

  prebuild(data) {
    wordCountsOf(data);
  },

  getVerseColor(verse, _settings, data) {
    return verseColorAt(data, verse);
  },

  colorsFor(items, _settings, _hovered, data) {
    return items.map((item) => verseColorAt(data, item));
  },

  renderLegend(container, _settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const counts = wordCountsOf(data);
    const paletteName = 'Plasma';
    const lowColor = 'Purple';
    const highColor = 'Orange/yellow';

    container.innerHTML = `
      ${renderAxis(counts.scale, [counts.min, counts.max], (n) => `${n} words`)}
      ${legendCaption(`${lowColor} = shorter verses`)}
      ${legendCaption(`${highColor} = longer verses`)}
      ${legendCaption(`Square root scale · ${paletteName} palette`)}
    `;
  },

  summary(_settings, data) {
    return { colors: [axisGradient(wordCountsOf(data).scale)] };
  },

  getHoverInfo(verse, _settings, data) {
    const wordCount = wordCountAt(data, verse);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';
    return `${wordCount} ${plural}`;
  },

  renderSidebarInfo(verse, _isPinned, _settings, data) {
    const wordCount = wordCountAt(data, verse);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';

    const div = document.createElement('div');
    div.className = 'verse-length-info';

    const label = document.createElement('div');
    label.className = 'verse-length-label';
    label.textContent = 'Verse Length:';

    const value = document.createElement('div');
    value.className = 'verse-length-value';
    value.textContent = `${wordCount} ${plural}`;

    div.appendChild(label);
    div.appendChild(value);

    return div;
  },
};
