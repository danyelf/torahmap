// The Talmud map's own marks: each tractate's cover, tinted by its seder, and the perek and daf
// labels, which show by zoom level.

import { amudName, type TractateBlock, type PerekAnchor, type DafRowAnchor } from './layout.ts';
import {
  COVER_OPACITY,
  DAF_LABEL,
  DAF_LABEL_ZOOM_ALL,
  PEREK_LABEL_ZOOM,
  PEREK_SIZE,
  SEDARIM,
} from './constants.ts';
import { HEBREW_LABEL_FONT, HEBREW_LABEL_SCALE } from '@torahmap/shell/labelTypography.ts';
import { createBookCovers } from '@torahmap/shell/bookCovers.ts';
import './talmudLabels.css';
import { createRowNumbers, labelGroup, type Placed } from '@torahmap/shell/rowNumbers.ts';

interface Pan {
  x: number;
  y: number;
}

function perekLabel(a: PerekAnchor): Placed {
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute;
    color:#cfd6e6;
    opacity:0.75;
    font-family:${HEBREW_LABEL_FONT};
    font-weight:600;
    text-shadow:0 1px 2px rgba(0,0,0,0.7);
    white-space:nowrap;
    line-height:1;
    direction:rtl;
    transform:translate(-100%, -100%);
  `;
  el.textContent = a.hebrewName;
  // Above its first row, flush with its right edge.
  return { el, x: a.rightX, y: a.topY - 2 };
}

// With the perek names, the first amud of every third daf is numbered: 3a, 6a, 10a, 13a, …
const numberedFirst = ({ daf, amud }: DafRowAnchor) => amud === 'a' && [0, 3, 6].includes(daf % 10);

/** Draws the marks inside `parent`, and returns what moves them with the map. */
export function createTalmudLabels(
  tractateBlocks: TractateBlock[],
  perekAnchors: PerekAnchor[],
  dafRows: DafRowAnchor[],
  parent: HTMLElement,
): (pan: Pan, zoom: number) => void {
  const container = document.createElement('div');
  container.id = 'talmud-labels';

  // First, so the labels and the map's own labels sit on top.
  const tinted = tractateBlocks.flatMap((block) => {
    const tint = SEDARIM.find((s) => s.en === block.section)?.tint;
    return tint ? [{ cover: block.cover, tint }] : [];
  });
  const covers = createBookCovers(
    'talmud-books',
    tinted.map(({ cover }) => cover),
    tinted.map(({ tint }) => tint),
    COVER_OPACITY,
  );

  const pereks = labelGroup('talmud-perek-labels', perekAnchors.map(perekLabel));
  container.append(covers.el, pereks.el);
  parent.appendChild(container);
  const moveDapim = createRowNumbers(
    'talmud-daf-labels',
    dafRows.map((row) => ({
      text: amudName(row),
      x: row.rightX,
      y: row.topY,
      zoom: numberedFirst(row) ? PEREK_LABEL_ZOOM : DAF_LABEL_ZOOM_ALL,
    })),
    parent,
    { ...DAF_LABEL, side: 'right' },
  );

  let pereksAt = NaN;
  return (pan, zoom) => {
    container.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    covers.place(zoom);
    if (zoom !== pereksAt) {
      pereksAt = zoom;
      const { base, min, max } = PEREK_SIZE;
      pereks.el.style.fontSize = `${Math.max(min, Math.min(max, base * zoom)) * HEBREW_LABEL_SCALE}px`;
    }
    pereks.show(zoom >= PEREK_LABEL_ZOOM, zoom);
    moveDapim(pan, zoom);
  };
}
