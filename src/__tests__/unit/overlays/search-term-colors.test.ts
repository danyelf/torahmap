// One term, one colour, everywhere it is drawn.
//
// A term carries a colour of its own that survives its neighbours being edited.
// The swatch and the map ask the term for it; results, snippets and highlights
// name a term by its position in the searched list. Those are the same number
// until a term is removed, and then they are not.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, highlightSearchTerms } from '../../../overlays/search';
import { buildSearchIndex } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import { applyOverlayParams } from '../../helpers/overlayUrlParams';
import { SEARCH_COLORS } from '../../../utils/color';
import type { VerseTexts } from '../../../verseTexts';

registerAllOverlays();
const searchOverlay = getOverlay('search')!;

const texts: VerseTexts = {
  Genesis: {
    1: {
      1: { he: 'בראשית ברא אלהים', en: 'In the beginning God created' },
      2: { he: 'ורוח אלהים מרחפת', en: 'and the spirit of God hovered' },
    },
  },
};

const verses = [
  createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
  createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
];

function render(): HTMLElement {
  const container = document.createElement('div');
  searchOverlay.renderControls?.(container);
  return container;
}

/**
 * Open the nth row and hand back its box.
 *
 * Only the row the reader is working in holds a box; the others fold to a line
 * saying what they are doing. So reaching a row means opening it first, which
 * is what a reader does too.
 */
function rowInput(container: HTMLElement, index: number): HTMLInputElement {
  const row = container.querySelectorAll<HTMLElement>('.term-row')[index];
  if (row.dataset.open !== 'true') row.querySelector<HTMLElement>('.term-summary')!.click();
  return row.querySelector<HTMLInputElement>('.term-input')!;
}

function typeInto(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function css(index: number): string {
  const [r, g, b] = SEARCH_COLORS[index];
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

beforeAll(() => {
  buildSearchIndex(texts);
});

beforeEach(() => {
  configure({ verses });
  applyOverlayParams(searchOverlay, { q: '', mode: undefined, m: undefined });
});

describe('a surviving term keeps one colour', () => {
  it('draws the swatch, the result dot and the highlight in the same colour', () => {
    const container = render();

    // Two terms, then remove the first. The survivor keeps the colour it was
    // given, while moving up into the first position.
    typeInto(rowInput(container, 0), 'created');
    container.querySelector<HTMLButtonElement>('#add-term')!.click();
    typeInto(rowInput(container, 1), 'spirit');
    container.querySelectorAll<HTMLButtonElement>('.term-remove')[0].click();

    const swatch = container.querySelector<HTMLElement>('.term-swatch')!;
    const dot = container.querySelector<HTMLElement>('.term-dot')!;
    expect(dot.style.background).toBe(swatch.style.background);

    // And it is the second colour, not the first: the term was born second.
    expect(swatch.style.background).toBe(css(1));

    const mark = container.querySelector<HTMLElement>('.search-result .snippet mark')!;
    expect(mark.className).toBe('term-1');
  });

  it('marks the verse text in the same colour as the row', () => {
    const container = render();

    typeInto(rowInput(container, 0), 'created');
    container.querySelector<HTMLButtonElement>('#add-term')!.click();
    typeInto(rowInput(container, 1), 'spirit');
    container.querySelectorAll<HTMLButtonElement>('.term-remove')[0].click();

    const fragment = highlightSearchTerms('and the spirit of God hovered', 'en');
    const holder = document.createElement('div');
    holder.appendChild(fragment);

    const mark = holder.querySelector('mark')!;
    expect(mark.textContent).toBe('spirit');
    expect(mark.className).toBe('term-1');
  });
});
