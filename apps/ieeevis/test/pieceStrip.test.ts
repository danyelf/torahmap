import { describe, expect, it } from 'vitest';
import { colorToCss } from '@torahmap/utils';
import { PLACEHOLDER_RING } from '../src/baseColor.ts';
import { gapPx, pieceStrip } from '../src/pieceStrip.ts';
import { SECTIONS } from '../src/overlays/sections.ts';

const pieces = (strip: HTMLElement) =>
  [...strip.children].filter((e) => !e.classList.contains('piece-pointer')) as HTMLElement[];
const shade = (css: string) => {
  const probe = document.createElement('span');
  probe.style.background = css;
  return probe.style.background;
};

describe('pieceStrip', () => {
  it('draws one piece for each of the paper’s, in its section’s colour', () => {
    const strip = pieceStrip('aif', 1);
    expect(pieces(strip).map((p) => p.style.background)).toEqual(
      [SECTIONS.a.color, SECTIONS.i.color, SECTIONS.f.color].map((c) => shade(colorToCss(c))),
    );
  });

  it('draws a paper with no text in the placeholder ring’s colour', () => {
    expect(pieces(pieceStrip('xx', 0))[0].style.background).toBe(
      shade(colorToCss(PLACEHOLDER_RING)),
    );
  });

  it('has one pointer', () => {
    expect(pieceStrip('aiif', 2).querySelectorAll('.piece-pointer')).toHaveLength(1);
  });

  it('closes the gaps between pieces as a paper grows long', () => {
    expect(gapPx(15)).toBeGreaterThan(gapPx(60));
    expect(gapPx(84)).toBe(0);
  });
});
