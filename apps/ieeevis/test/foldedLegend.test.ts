import { describe, it, expect } from 'vitest';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { PieceItem } from '../src/layout.ts';
import { kindsOverlay } from '../src/overlays/kinds.ts';
import { sectionsOverlay } from '../src/overlays/sections.ts';

/** A CSS colour as the browser writes it back, so two spellings of one colour compare equal. */
function asDrawn(color: string): string {
  const element = document.createElement('span');
  element.style.background = color;
  return element.style.background;
}

describe('the folded legend line', () => {
  it.each([kindsOverlay, sectionsOverlay] as Overlay<PieceItem>[])(
    "shows every colour $name's legend lists",
    (overlay) => {
      const legend = document.createElement('div');
      overlay.renderLegend!(legend, undefined, undefined);
      const listed = [...legend.querySelectorAll<HTMLElement>('.swatch')].map(
        (swatch) => swatch.style.background,
      );
      const folded = (overlay.summary!(undefined, undefined).groups ?? []).flat().map(asDrawn);
      expect(folded).toEqual(listed);
    },
  );
});
