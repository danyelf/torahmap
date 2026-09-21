// The map's title, anchored in the map rather than pinned to the window.

import { fitZoom, type WorldBox } from './camera.ts';
import { HEBREW_LABEL_FONT } from './constants/labels.ts';
import { bookLabelRise } from './labels.ts';
import type { TanakhLayout } from './types.ts';

interface Pan {
  x: number;
  y: number;
}

const HEBREW_NAME = 'מפת התנ״ך';
const NAME = 'Torahmap';
const TAGLINE = 'A visual concordance to the Hebrew Bible';

/** The name's size in map units at zoom 1. Everything else is an em of it. */
const BASE_FONT_SIZE = 205;
/** Past this the title would tower over the verses it sits beside. */
const MAX_FONT_SIZE = 130;

// The title belongs to the view that holds the whole Tanakh, so the fade is
// measured against the zoom that fits the map rather than against fixed
// numbers: the fitting zoom is far higher on a large monitor than on a laptop,
// and fixed thresholds would leave the title already faded on the one and
// clipping off the edge on the other.
const FADE_FROM_FIT = 1.05;
const FADE_TO_FIT = 1.7;

/** How visible the title is: full over the whole map, gone once you go exploring. */
export function titleOpacity(zoom: number, fitZoom: number): number {
  const from = fitZoom * FADE_FROM_FIT;
  const to = fitZoom * FADE_TO_FIT;
  if (!(to > from)) return zoom <= from ? 1 : 0;
  if (zoom <= from) return 1;
  if (zoom >= to) return 0;
  return (to - zoom) / (to - from);
}

function line(className: string, text: string, hebrewFace: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  // The name is Latin but shares the Hebrew heading face, so the two lines
  // above the tagline read as one piece of lettering.
  if (hebrewFace) el.style.fontFamily = HEBREW_LABEL_FONT;
  return el;
}

/**
 * Builds the title and gives it a place in map coordinates: centred across the
 * gap between the map's left edge and the Torah's, on the line the book labels
 * start from.
 *
 * It gets a container of its own because `updateLabelPositions` rewrites the
 * position of every child of the book-label container, which would fight this.
 */
export function createMapTitle(
  verses: TanakhLayout[],
  container: HTMLElement,
  isTorah: (book: string) => boolean,
): HTMLDivElement {
  let mapMinX = Infinity;
  let mapMaxX = -Infinity;
  let mapMinY = Infinity;
  let mapMaxY = -Infinity;
  let torahMinX = Infinity;
  let torahTopY = Infinity;
  for (const v of verses) {
    mapMinX = Math.min(mapMinX, v.x);
    mapMaxX = Math.max(mapMaxX, v.x + v.size);
    mapMinY = Math.min(mapMinY, v.y);
    mapMaxY = Math.max(mapMaxY, v.y + v.size);
    if (isTorah(v.book)) {
      torahMinX = Math.min(torahMinX, v.x);
      torahTopY = Math.min(torahTopY, v.y);
    }
  }
  const haveCorner = Number.isFinite(mapMinX) && Number.isFinite(torahMinX);

  const title = document.createElement('div');
  title.id = 'map-title';

  const block = document.createElement('div');
  block.className = 'title-block';
  block.dataset.centreX = String(haveCorner ? (mapMinX + torahMinX) / 2 : 0);
  block.dataset.topY = String(Number.isFinite(torahTopY) ? torahTopY : 0);
  if (haveCorner) {
    // Kept so the fade can be measured against the zoom that fits the map.
    block.dataset.box = JSON.stringify({
      minX: mapMinX,
      maxX: mapMaxX,
      minY: mapMinY,
      maxY: mapMaxY,
    });
  }

  block.appendChild(line('title-he', HEBREW_NAME, true));
  block.appendChild(line('title-name', NAME, true));
  block.appendChild(line('title-tagline', TAGLINE, false));

  title.appendChild(block);
  container.appendChild(title);
  return title;
}

export function updateMapTitlePosition(
  title: HTMLElement,
  pan: Pan,
  zoom: number,
  viewport: { width: number; height: number },
): void {
  const block = title.firstElementChild;
  if (!(block instanceof HTMLElement)) return;

  const centreX = parseFloat(block.dataset.centreX || '0');
  const topY = parseFloat(block.dataset.topY || '0');

  block.style.fontSize = Math.min(BASE_FONT_SIZE * zoom, MAX_FONT_SIZE) + 'px';
  block.style.left = (centreX + pan.x) * zoom + 'px';
  block.style.top = (topY + pan.y) * zoom - bookLabelRise(zoom) + 'px';

  const box = block.dataset.box ? (JSON.parse(block.dataset.box) as WorldBox) : null;
  const fit = box && viewport.width > 0 ? fitZoom(box, viewport.width, viewport.height) : zoom;
  block.style.opacity = String(titleOpacity(zoom, fit));
}
