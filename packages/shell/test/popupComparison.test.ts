// The popup with the pinned square and the one it is compared with.

import { beforeEach, describe, expect, it } from 'vitest';
import type { MapItem } from '@torahmap/engine';
import { getSidebarElements, updateSidebar, type PopupComparison } from '../src/sidebar.ts';
import type { Overlay, ToolOnMap } from '../src/overlays/types.ts';

const pinned: MapItem = { id: 'a', x: 0, y: 0, size: 1 };
const other: MapItem = { id: 'b', x: 1, y: 0, size: 1 };
const HEBREW_OF: Record<string, string> = { a: 'אבג דהו', b: 'זחט דהו' };

/** Marks the last word of each text, as the phrase the two share. */
const comparing = {
  id: 'comparing',
  name: 'Comparing',
  colorsFor: () => [],
  compareTexts: (_pinned: MapItem, hebrew: [string, string]) =>
    hebrew.map((text) => {
      const fragment = document.createDocumentFragment();
      const mark = document.createElement('mark');
      mark.textContent = text.slice(4);
      fragment.append(text.slice(0, 4), mark);
      return fragment;
    }) as [DocumentFragment, DocumentFragment],
} as Overlay<MapItem>;

const overlay: ToolOnMap<MapItem> = { tool: comparing, settings: undefined, data: undefined };

function show(comparison: PopupComparison<MapItem> | null): void {
  updateSidebar(
    getSidebarElements(),
    pinned,
    (item) => ({ ref: `Verse ${item.id}`, hebrew: HEBREW_OF[item.id], english: '', link: '' }),
    { wordsClickable: false, overlay, search: null, pinned: true, comparison },
  );
}

const compared = () => document.querySelector('.popup-compared')!;
const marksIn = (selector: string) =>
  [...document.querySelectorAll(`${selector} mark`)].map((mark) => mark.textContent);
const comparison = (held: boolean, did: string[] = []): PopupComparison<MapItem> => ({
  item: other,
  held,
  travel: () => did.push('travel'),
  release: () => did.push('release'),
});

beforeEach(() => {
  document.body.innerHTML = `
    <div id="popup">
      <span class="ref-text"></span>
      <div class="popup-hebrew"></div>
      <div class="popup-compared"></div>
    </div>`;
});

describe('the popup while the pinned square is compared with another', () => {
  it('shows the other square under the pinned one, each marked for the pair', () => {
    show(comparison(false));
    expect(compared().textContent).toContain('Verse b');
    expect(compared().textContent).toContain(HEBREW_OF.b);
    expect(marksIn('.popup-hebrew')).toEqual(['דהו']);
    expect(marksIn('.popup-compared')).toEqual(['דהו']);
  });

  it('offers nothing to press while the comparison is only the pointer passing', () => {
    show(comparison(false));
    expect(compared().querySelectorAll('button')).toHaveLength(0);
  });

  it('offers to go to a held square, or to let it go', () => {
    const did: string[] = [];
    show(comparison(true, did));
    compared()
      .querySelectorAll('button')
      .forEach((button) => button.click());
    expect(did).toEqual(['travel', 'release']);
  });

  it('shows the pinned square alone once the comparison ends', () => {
    show(comparison(true));
    show(null);
    expect(compared().childNodes).toHaveLength(0);
  });
});
