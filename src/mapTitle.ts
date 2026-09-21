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
import type { Camera } from './camera.ts';
import type { TanakhLayout } from './types.ts';

/** How wide the title is on the map, in map units. Its corner is about 1795 wide. */
const TITLE_WIDTH = 929;

/**
 * How far above the Torah's first row the title's top sits, in map units.
 *
 * A map-unit gap, not a screen-pixel one, because that is what holds the title
 * the same distance from the verses at every zoom. It is the gap the book
 * labels happen to leave at the view that fits the whole map, so the title
 * lines up with them there.
 */
const RISE_ABOVE_TORAH = 28;

/** A placed title: the artwork, and where on the map it belongs. */
export interface MapTitle {
  svg: SVGSVGElement;
  /** Midway across the empty corner, in map units. */
  centreX: number;
  /** The artwork's own top edge, in map units. */
  topY: number;
  /** Its height as a fraction of its width, so only the width needs deciding. */
  aspect: number;
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
): MapTitle {
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
  // Every Torah verse is a verse, so finding one settles both corners.
  const haveTorah = Number.isFinite(torahMinX);

  const host = document.createElement('div');
  host.id = 'map-title';
  host.innerHTML = artwork;
  container.appendChild(host);

  const svg = host.querySelector('svg');
  if (!svg) throw new Error('mapTitle.svg has no root <svg>');

  const box = svg.viewBox.baseVal;
  return {
    svg,
    centreX: haveTorah ? (mapMinX + torahMinX) / 2 : 0,
    topY: (haveTorah ? torahTopY : 0) - RISE_ABOVE_TORAH,
    aspect: box.height / box.width,
  };
}

export function updateMapTitlePosition(title: MapTitle, camera: Camera): void {
  const { svg, centreX, topY, aspect } = title;
  // The viewBox does the scaling, so the parts of the artwork keep their
  // proportions exactly. Sizing each line separately instead does not: every
  // line box takes its metrics from the font rounded at whatever size it is
  // asked for, and those roundings do not agree across sizes.
  const width = TITLE_WIDTH * camera.zoom;

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(width * aspect));
  svg.style.left = (centreX + camera.x) * camera.zoom + 'px';
  svg.style.top = (topY + camera.y) * camera.zoom + 'px';
}
