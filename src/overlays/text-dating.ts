// src/overlays/text-dating.ts
import '../styles/overlays/text-dating.css';
import type { Overlay, Color } from './types.ts';
import type { VerseIdentity } from '../types.ts';
import { dataPath } from '../constants/app.ts';

// Data structure types
interface TextDatingData {
  notes: string[];
  books: {
    [book: string]: Array<Array<{ d: [number, number]; n: number } | null>>;
  };
}

// Era definitions with date ranges (BCE, stored as negative)
interface EraInfo {
  name: string;
  dateRange: [number, number]; // [start BCE, end BCE]
  baseColor: Color;
}

const ERAS: EraInfo[] = [
  {
    name: 'Pre-Monarchic',
    dateRange: [1400, 1000],
    baseColor: [0.60, 0.25, 0.15], // Deep red-brown (oldest layer)
  },
  {
    name: 'Early Monarchic',
    dateRange: [1000, 722],
    baseColor: [0.75, 0.40, 0.20], // Burnt orange
  },
  {
    name: 'Late Monarchic',
    dateRange: [722, 586],
    baseColor: [0.85, 0.55, 0.25], // Bright orange
  },
  {
    name: 'Exilic',
    dateRange: [586, 538],
    baseColor: [0.85, 0.70, 0.35], // Golden yellow
  },
  {
    name: 'Persian Period',
    dateRange: [538, 331],
    baseColor: [0.75, 0.75, 0.50], // Pale gold
  },
  {
    name: 'Hellenistic',
    dateRange: [331, 164],
    baseColor: [0.80, 0.80, 0.70], // Cream/beige (newest layer)
  },
];

let data: TextDatingData = { notes: [], books: {} };

/**
 * Determine which era a date falls into
 */
function getEra(dateBCE: number): EraInfo | null {
  for (const era of ERAS) {
    if (dateBCE >= era.dateRange[1] && dateBCE <= era.dateRange[0]) {
      return era;
    }
  }
  return null;
}

/**
 * Calculate shaded color based on date within era
 * Older texts within an era are lighter, newer texts are darker
 */
function getVerseColorFromDate(dateBCE: number): Color | null {
  const era = getEra(dateBCE);
  if (!era) return null;

  const [rangeStart, rangeEnd] = era.dateRange;

  // Calculate position within era (0 = start, 1 = end)
  const position = (rangeStart - dateBCE) / (rangeStart - rangeEnd);

  // Darken toward end of era (0.7 at start, 1.0 at end)
  const shadeFactor = 0.7 + (position * 0.3);

  return [
    era.baseColor[0] * shadeFactor,
    era.baseColor[1] * shadeFactor,
    era.baseColor[2] * shadeFactor,
  ];
}

/**
 * Get verse dating data
 */
function getVerseData(verse: VerseIdentity): { d: [number, number]; n: number } | null {
  const bookData = data.books[verse.book];
  if (!bookData) return null;

  const chapterData = bookData[verse.chapter - 1];
  if (!chapterData) return null;

  const verseData = chapterData[verse.verse - 1];
  return verseData || null;
}

export const textDatingOverlay: Overlay = {
  id: 'text-dating',
  name: 'Text Dating',

  async init() {
    try {
      const res = await fetch(dataPath("text-dating.json"));
      if (!res.ok) {
        console.error(`Failed to load text-dating.json: ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (e) {
      console.error('Failed to parse text-dating.json:', e);
    }
  },

  getVerseColor(verse: VerseIdentity): Color | null {
    const verseData = getVerseData(verse);
    if (!verseData) return null;

    // Use midpoint of date range for color calculation
    const [startBCE, endBCE] = verseData.d;
    const midpointBCE = Math.abs((startBCE + endBCE) / 2);

    return getVerseColorFromDate(midpointBCE);
  },

  renderLegend(container: HTMLElement) {
    const rows = ERAS.map((era) => {
      const [r, g, b] = era.baseColor;
      const rgb = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
      return `
        <div class="legend-row">
          <span class="swatch" style="background: ${rgb}"></span>
          <span class="label">${era.name} (${era.dateRange[0]}-${era.dateRange[1]} BCE)</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="text-dating-legend">
        ${rows}
        <div class="legend-note">Darker shades = later within period</div>
      </div>
    `;
  },

  getHoverInfo(verse: VerseIdentity): string | null {
    const verseData = getVerseData(verse);
    if (!verseData) return null;

    const [startBCE, endBCE] = verseData.d;
    const midpointBCE = Math.abs((startBCE + endBCE) / 2);
    const era = getEra(midpointBCE);

    if (!era) return null;

    const note = data.notes[verseData.n];
    const dateStr = startBCE === endBCE
      ? `~${Math.abs(startBCE)} BCE`
      : `${Math.abs(startBCE)}-${Math.abs(endBCE)} BCE`;

    return `${era.name} (${dateStr})\n${note}`;
  },

  renderSidebarInfo(verse: VerseIdentity, isPinned: boolean): HTMLElement | string | null {
    // Only show detailed info when verse is pinned
    if (!isPinned) return null;

    const datingInfo = getVerseDatingInfo(verse.book, verse.chapter, verse.verse);
    if (!datingInfo) return null;

    const dateStr = datingInfo.dateRange[0] === datingInfo.dateRange[1]
      ? `~${datingInfo.dateRange[0]} BCE`
      : `${datingInfo.dateRange[0]}-${datingInfo.dateRange[1]} BCE`;

    // Parse citation links from note (format: [text](url))
    const noteHtml = datingInfo.note.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    return `
      <strong>${datingInfo.era}</strong> (${dateStr})
      <br>${noteHtml}
    `;
  },
};

/**
 * Get full dating information for a verse (used by sidebar)
 */
export interface VerseDatingInfo {
  era: string;
  eraDateRange: [number, number];
  dateRange: [number, number];
  note: string;
}

export function getVerseDatingInfo(
  book: string,
  chapter: number,
  verse: number
): VerseDatingInfo | null {
  const verseData = getVerseData({ book, chapter, verse });
  if (!verseData) return null;

  const [startBCE, endBCE] = verseData.d;
  const midpointBCE = Math.abs((startBCE + endBCE) / 2);
  const era = getEra(midpointBCE);

  if (!era) return null;

  return {
    era: era.name,
    eraDateRange: era.dateRange,
    dateRange: [Math.abs(startBCE), Math.abs(endBCE)],
    note: data.notes[verseData.n],
  };
}
