// Where a piece sits in its paper, for the popup: the paper's pieces as a bar in their sections'
// colours, a pointer under this one.

import { colorToCss } from '@torahmap/utils';
import { PLACEHOLDER_RING, PLACEHOLDER_SECTION } from './baseColor.ts';
import type { Section } from './data.ts';
import { SECTIONS } from './overlays/sections.ts';

const BAR_PX = 5;
/** Between the bar and the pointer. */
const SPACE_PX = 1;
const POINTER_HEIGHT_PX = 6;
const POINTER_HALF_WIDTH_PX = 4;

/**
 * The space between pieces, closing as a paper grows: on the popup's 270px strip, a gap of 2px
 * while a piece has 6px, 1px while it has 3.5px, then none.
 */
export const gapPx = (count: number): number => (count <= 45 ? 2 : count <= 77 ? 1 : 0);

/** `pieces` holds one section letter per piece; `here` is this piece's index. */
export function pieceStrip(pieces: string, here: number): HTMLElement {
  const gap = gapPx(pieces.length);
  const strip = document.createElement('div');
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', `Piece ${here + 1} of ${pieces.length}`);
  strip.style.cssText = `position: relative; display: flex; gap: ${gap}px; height: ${BAR_PX + SPACE_PX + POINTER_HEIGHT_PX}px;`;
  for (const section of pieces as Iterable<Section>) {
    const piece = document.createElement('span');
    const color = section === PLACEHOLDER_SECTION ? PLACEHOLDER_RING : SECTIONS[section].color;
    piece.style.cssText = `flex: 1 1 0; height: ${BAR_PX}px; border-radius: 1px; background: ${colorToCss(color)};`;
    strip.append(piece);
  }
  const pointer = document.createElement('span');
  pointer.className = 'piece-pointer';
  // The centre of piece `here`, each piece an equal share of the width left after the gaps.
  const centre = `calc((100% - ${(pieces.length - 1) * gap}px) * ${(here + 0.5) / pieces.length} + ${here * gap}px)`;
  pointer.style.cssText =
    `position: absolute; top: ${BAR_PX + SPACE_PX}px; left: ${centre}; transform: translateX(-50%);` +
    ` border: ${POINTER_HALF_WIDTH_PX}px solid transparent; border-top: 0;` +
    ` border-bottom: ${POINTER_HEIGHT_PX}px solid #fff;`;
  strip.append(pointer);
  return strip;
}
