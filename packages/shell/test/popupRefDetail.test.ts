// What a text draws under the popup's heading.

import { beforeEach, describe, expect, it } from 'vitest';
import type { MapItem } from '@torahmap/engine';
import { getSidebarElements, updateSidebar, type PopupText } from '../src/sidebar.ts';

const item: MapItem = { id: 'a', x: 0, y: 0, size: 1 };

function show(text: Partial<PopupText>): void {
  updateSidebar(
    getSidebarElements(),
    item,
    () => ({ ref: 'Heading', hebrew: '', english: '', link: '', ...text }),
    { wordsClickable: false, overlay: null, search: null, pinned: true },
  );
}

const detail = () => document.querySelector('.ref-detail')!;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="popup">
      <span class="ref-text"></span>
      <div class="ref-detail"></div>
    </div>`;
});

describe('under the popup heading', () => {
  it('shows what the text draws there', () => {
    const drawn = document.createElement('span');
    show({ refDetail: drawn });
    expect([...detail().childNodes]).toEqual([drawn]);
  });

  it('is emptied for a square whose text draws nothing there', () => {
    show({ refDetail: document.createElement('span') });
    show({});
    expect(detail().childNodes).toHaveLength(0);
  });
});
