// The map's title, painted onto the map rather than laid over it.
//
// Everything here is in map units, and nothing is clamped. The title grows and
// moves exactly as the verses do, so its size against them and its distance
// from them never change — it behaves like paint on the map, not like the book
// and section labels, which clamp their size so as to stay readable and
// therefore drift against the verses as you zoom.
//
// The artwork lives in mapTitle.svg and is inlined at build time. This module
// only decides where it goes and how large it is; nothing here knows what the
// title says or how its lines are arranged.

import artwork from './mapTitle.svg?raw';
import type { TanakhLayout } from './types.ts';

interface Pan {
  x: number;
  y: number;
}

/** The name's size in map units; the artwork sets it at 100 of its own. */
const NAME_SIZE = 205;
/** The name's size in the artwork's own units, which its viewBox is drawn against. */
const ARTWORK_NAME_SIZE = 100;

/**
 * How far above the Torah's first row the title's top sits, in map units.
 *
 * A map-unit gap, not a screen-pixel one, because that is what holds the title
 * the same distance from the verses at every zoom. It is the gap the book
 * labels happen to leave at the view that fits the whole map, so the title
 * lines up with them there.
 */
const RISE_ABOVE_TORAH = 28;

/** The artwork's own width and height, read from its viewBox. */
export function artworkSize(svg: SVGSVGElement): { width: number; height: number } {
  const [, , width, height] = (svg.getAttribute('viewBox') || '0 0 1 1')
    .split(/[\s,]+/)
    .map(Number);
  return { width: width || 1, height: height || 1 };
}

/**
 * Builds the title and gives it a place in map coordinates: centred across the
 * gap between the map's left edge and the Torah's, above the Torah's first row.
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
    svg.dataset.topY = String((Number.isFinite(torahTopY) ? torahTopY : 0) - RISE_ABOVE_TORAH);
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
  const scale = (NAME_SIZE * zoom) / ARTWORK_NAME_SIZE;

  svg.setAttribute('width', String(size.width * scale));
  svg.setAttribute('height', String(size.height * scale));
  svg.style.left = (centreX + pan.x) * zoom + 'px';
  svg.style.top = (topY + pan.y) * zoom + 'px';
}
