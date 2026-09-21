// The map's title, anchored in the map rather than pinned to the window.
//
// The artwork lives in mapTitle.svg and is inlined at build time. This module
// only decides where it goes and how large it is; nothing here knows what the
// title says or how its lines are arranged.

import artwork from './mapTitle.svg?raw';
import { bookLabelRise } from './labels.ts';
import type { TanakhLayout } from './types.ts';

interface Pan {
  x: number;
  y: number;
}

/** The name's size in map units at zoom 1; the artwork sets it at 100 of its own. */
const BASE_FONT_SIZE = 205;
/** Past this the title would tower over the verses it sits beside. */
const MAX_FONT_SIZE = 130;
/** The name's size in the artwork's own units, which its viewBox is drawn against. */
const ARTWORK_FONT_SIZE = 100;

// Measured in plain zoom rather than against the zoom that fits the map: what
// the title must not compete with is legible verse text, and legibility is a
// matter of pixels per verse, which is what zoom already says.
const FADE_FROM_ZOOM = 1.5;
const FADE_TO_ZOOM = 4;

/** How visible the title is: full until the verses themselves are worth reading. */
export function titleOpacity(zoom: number): number {
  if (zoom <= FADE_FROM_ZOOM) return 1;
  if (zoom >= FADE_TO_ZOOM) return 0;
  return (FADE_TO_ZOOM - zoom) / (FADE_TO_ZOOM - FADE_FROM_ZOOM);
}

/** The artwork's own width and height, read from its viewBox. */
export function artworkSize(svg: SVGSVGElement): { width: number; height: number } {
  const [, , width, height] = (svg.getAttribute('viewBox') || '0 0 1 1')
    .split(/[\s,]+/)
    .map(Number);
  return { width: width || 1, height: height || 1 };
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
  let torahMinX = Infinity;
  let torahTopY = Infinity;
  for (const v of verses) {
    mapMinX = Math.min(mapMinX, v.x);
    if (isTorah(v.book)) {
      torahMinX = Math.min(torahMinX, v.x);
      torahTopY = Math.min(torahTopY, v.y);
    }
  }
  const haveCorner = Number.isFinite(mapMinX) && Number.isFinite(torahMinX);

  const title = document.createElement('div');
  title.id = 'map-title';
  title.innerHTML = artwork;

  const svg = title.querySelector('svg');
  if (svg) {
    svg.dataset.centreX = String(haveCorner ? (mapMinX + torahMinX) / 2 : 0);
    svg.dataset.topY = String(Number.isFinite(torahTopY) ? torahTopY : 0);
  }

  container.appendChild(title);
  return title;
}

export function updateMapTitlePosition(title: HTMLElement, pan: Pan, zoom: number): void {
  const svg = title.querySelector('svg');
  if (!svg) return;

  const centreX = parseFloat(svg.dataset.centreX || '0');
  const topY = parseFloat(svg.dataset.topY || '0');

  // The viewBox does the scaling, so the parts of the artwork keep their
  // proportions exactly. Sizing each line separately instead does not: every
  // line box takes its metrics from the font rounded at whatever size it is
  // asked for, and those roundings do not agree across sizes.
  const size = artworkSize(svg);
  const scale = Math.min(BASE_FONT_SIZE * zoom, MAX_FONT_SIZE) / ARTWORK_FONT_SIZE;

  svg.setAttribute('width', String(size.width * scale));
  svg.setAttribute('height', String(size.height * scale));
  svg.style.left = (centreX + pan.x) * zoom + 'px';
  svg.style.top = (topY + pan.y) * zoom - bookLabelRise(zoom) + 'px';
  svg.style.opacity = String(titleOpacity(zoom));
}
