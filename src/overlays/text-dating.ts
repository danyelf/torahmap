import '../styles/overlays/text-dating.css';
import type { Overlay, Color } from './types.ts';
import type { TanakhIdentity } from '../types.ts';
import { loadJson } from './loadJson.ts';
import { legendRow } from './legend.ts';

interface TextDatingData {
  notes: string[];
  books: {
    [book: string]: Array<Array<{ d: [number, number]; n: number } | null>>;
  };
}

interface EraInfo {
  name: string;
  dateRange: [number, number]; // [start BCE, end BCE]
  baseColor: Color;
}

const ERAS: EraInfo[] = [
  {
    name: 'Pre-Monarchic',
    dateRange: [1400, 1000],
    baseColor: [0.6, 0.25, 0.15], // Deep red-brown (oldest layer)
  },
  {
    name: 'Early Monarchic',
    dateRange: [1000, 722],
    baseColor: [0.75, 0.4, 0.2], // Burnt orange
  },
  {
    name: 'Late Monarchic',
    dateRange: [722, 586],
    baseColor: [0.85, 0.55, 0.25], // Bright orange
  },
  {
    name: 'Exilic',
    dateRange: [586, 538],
    baseColor: [0.85, 0.7, 0.35], // Golden yellow
  },
  {
    name: 'Persian Period',
    dateRange: [538, 331],
    baseColor: [0.75, 0.75, 0.5], // Pale gold
  },
  {
    name: 'Hellenistic',
    dateRange: [331, 164],
    baseColor: [0.8, 0.8, 0.7], // Cream/beige (newest layer)
  },
];

let data: TextDatingData = { notes: [], books: {} };

function getEra(dateBCE: number): EraInfo | null {
  for (const era of ERAS) {
    if (dateBCE >= era.dateRange[1] && dateBCE <= era.dateRange[0]) {
      return era;
    }
  }
  return null;
}

function getVerseColorFromDate(dateBCE: number): Color | null {
  const era = getEra(dateBCE);
  if (!era) return null;

  const [rangeStart, rangeEnd] = era.dateRange;

  // position: 0 at the era's start date, 1 at its end date
  const position = (rangeStart - dateBCE) / (rangeStart - rangeEnd);
  const shadeFactor = 0.7 + position * 0.3;

  return [
    era.baseColor[0] * shadeFactor,
    era.baseColor[1] * shadeFactor,
    era.baseColor[2] * shadeFactor,
  ];
}

/** "~500 BCE" for a single date, "500-400 BCE" for a range. Takes positive BCE numbers. */
function formatBceRange(startBCE: number, endBCE: number): string {
  return startBCE === endBCE ? `~${startBCE} BCE` : `${startBCE}-${endBCE} BCE`;
}

function getVerseData(verse: TanakhIdentity): { d: [number, number]; n: number } | null {
  const bookData = data.books?.[verse.book];
  if (!bookData) return null;

  const chapterData = bookData[verse.chapter - 1];
  if (!chapterData) return null;

  const verseData = chapterData[verse.verse - 1];
  return verseData || null;
}

export const textDatingOverlay: Overlay = {
  id: 'text-dating',
  name: 'Text Dating',
  description:
    'Colours each passage by the period scholars date it to, from before the monarchy ' +
    'through the Hellenistic era. A pinned verse shows the estimate it was given and ' +
    'the reasoning behind it.',
  credits: [
    {
      source: 'Wikipedia, "Dating the Bible"',
      url: 'https://en.wikipedia.org/wiki/Dating_the_Bible',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      collected: 'January 2026',
    },
  ],

  async init() {
    try {
      const result = await loadJson<TextDatingData>('text-dating.json');
      if (result) data = result;
    } catch (e) {
      console.error('Failed to parse text-dating.json:', e);
    }
  },

  getVerseColor(verse: TanakhIdentity): Color | null {
    const verseData = getVerseData(verse);
    if (!verseData) return null;

    const [startBCE, endBCE] = verseData.d;
    const midpointBCE = Math.abs((startBCE + endBCE) / 2);

    return getVerseColorFromDate(midpointBCE);
  },

  renderLegend(container: HTMLElement) {
    const rows = ERAS.map((era) => {
      const [r, g, b] = era.baseColor;
      const rgb = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
      return legendRow(rgb, `${era.name} (${era.dateRange[0]}-${era.dateRange[1]} BCE)`, 'label');
    }).join('');

    container.innerHTML = `
      <div class="text-dating-legend">
        ${rows}
        <div class="legend-note">Darker shades = later within period</div>
      </div>
    `;
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const datingInfo = getVerseDatingInfo(verse.book, verse.chapter, verse.verse);
    if (!datingInfo) return null;

    const dateStr = formatBceRange(datingInfo.dateRange[0], datingInfo.dateRange[1]);

    return `${datingInfo.era} (${dateStr})\n${datingInfo.note}`;
  },

  renderSidebarInfo(verse: TanakhIdentity, isPinned: boolean): HTMLElement | string | null {
    if (!isPinned) return null;

    const datingInfo = getVerseDatingInfo(verse.book, verse.chapter, verse.verse);
    if (!datingInfo) return null;

    const dateStr = formatBceRange(datingInfo.dateRange[0], datingInfo.dateRange[1]);

    // Parse citation links from note (format: [text](url))
    const noteHtml = datingInfo.note.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );

    return `
      <strong>${datingInfo.era}</strong> (${dateStr})
      <br>${noteHtml}
    `;
  },
};

export interface VerseDatingInfo {
  era: string;
  eraDateRange: [number, number];
  dateRange: [number, number];
  note: string;
}

// Used by the sidebar.
export function getVerseDatingInfo(
  book: string,
  chapter: number,
  verse: number,
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
    note: data.notes?.[verseData.n],
  };
}
