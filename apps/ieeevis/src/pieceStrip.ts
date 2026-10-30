// Where a piece sits in its paper, for the popup: the paper's pieces as a bar in their sections'
// colours, a pointer under this one.

import { colorToCss } from '@torahmap/utils';
import { PLACEHOLDER_RING } from './baseColor.ts';
import type { Section } from './data.ts';
import { SECTIONS } from './overlays/sections.ts';

const BAR_PX = 5;
const POINTER_PX = 6;

/** The space between pieces: none once a paper is long enough that gaps would swamp them. */
export const gapPx = (pieces: number): number => (pieces <= 45 ? 2 : pieces <= 77 ? 1 : 0);

export function pieceStrip(sections: string, here: number): HTMLElement {
  const gap = gapPx(sections.length);
  const strip = document.createElement('div');
  strip.className = 'piece-strip';
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', `Piece ${here + 1} of ${sections.length}`);
  strip.style.cssText = `position: relative; display: flex; gap: ${gap}px; height: ${BAR_PX + POINTER_PX + 1}px;`;
  for (const section of sections as Iterable<Section>) {
    const piece = document.createElement('span');
    const color = section === 'x' ? PLACEHOLDER_RING : SECTIONS[section].color;
    piece.style.cssText = `flex: 1 1 0; height: ${BAR_PX}px; border-radius: 1px; background: ${colorToCss(color)};`;
    strip.append(piece);
  }
  const pointer = document.createElement('span');
  pointer.className = 'piece-pointer';
  // The centre of piece `here`, each piece an equal share of the width left after the gaps.
  const centre = `calc((100% - ${(sections.length - 1) * gap}px) * ${(here + 0.5) / sections.length} + ${here * gap}px)`;
  pointer.style.cssText =
    `position: absolute; top: ${BAR_PX + 1}px; left: ${centre}; transform: translateX(-50%);` +
    ` border: 4px solid transparent; border-top: 0; border-bottom: ${POINTER_PX}px solid #fff;`;
  strip.append(pointer);
  return strip;
}
