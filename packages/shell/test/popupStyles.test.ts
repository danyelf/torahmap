// Bold and italic stretches a text hands the popup for its English.

import { describe, it, expect, beforeEach } from 'vitest';
import type { MapItem } from '@torahmap/engine';
import { getSidebarElements, updateSidebar, type PopupText } from '../src/sidebar.ts';
import type { Overlay, ToolOnMap } from '../src/overlays/types.ts';

const item: MapItem = { id: 'a', x: 0, y: 0, size: 1 };
const ENGLISH = 'Rava said: the Shema is read';
const RAVA = { start: 0, end: 10, style: 'bold' } as const;
const SHEMA = { start: 15, end: 20, style: 'italic' } as const;

function show(text: Partial<PopupText>, search: ToolOnMap<MapItem> | null = null): void {
  updateSidebar(
    getSidebarElements(),
    item,
    () => ({ ref: '', hebrew: '', english: ENGLISH, link: '', ...text }),
    { wordsClickable: false, overlay: null, search, pinned: true },
  );
}

/** A search that marks characters `start` to `end` of whatever English it is shown. */
function marking(start: number, end: number): ToolOnMap<MapItem> {
  const tool = {
    highlightItemText: (_item: MapItem, text: string) => {
      const fragment = document.createDocumentFragment();
      const mark = document.createElement('mark');
      mark.textContent = text.slice(start, end);
      fragment.append(text.slice(0, start), mark, text.slice(end));
      return fragment;
    },
  } as unknown as Overlay<MapItem>;
  return { tool, settings: {}, data: undefined };
}

const english = () => document.querySelector('.popup-english')!;
const texts = (selector: string) =>
  [...english().querySelectorAll(selector)].map((e) => e.textContent);

beforeEach(() => {
  document.body.innerHTML = `
    <div id="popup">
      <span class="ref-text"></span>
      <div class="popup-hebrew"></div>
      <div class="popup-english"></div>
    </div>`;
});

describe('styles in the popup', () => {
  it('sets each stretch in bold or italic', () => {
    show({ englishStyles: [RAVA, SHEMA] });
    expect(texts('b')).toEqual(['Rava said:']);
    expect(texts('i')).toEqual(['Shema']);
    expect(english().textContent).toBe(ENGLISH);
  });

  it('sets a stretch bold and italic at once where the two overlap', () => {
    show({ englishStyles: [RAVA, { start: 5, end: 9, style: 'italic' }] });
    expect(texts('b')).toEqual(['Rava ', 'said', ':']);
    expect(texts('b > i')).toEqual(['said']);
  });

  it('keeps a search hit that crosses a bold edge as one mark, bold on its side of the edge', () => {
    show({ englishStyles: [RAVA] }, marking(5, 14));
    expect(texts('mark')).toEqual(['said: the']);
    expect(texts('mark b')).toEqual(['said:']);
    expect(texts('b')).toEqual(['Rava ', 'said:']);
    expect(english().textContent).toBe(ENGLISH);
  });

  it('shows the text plain where it has no styles', () => {
    show({});
    expect(english().children).toHaveLength(0);
    expect(english().textContent).toBe(ENGLISH);
  });

  it('shows nothing for empty English', () => {
    show({ english: '', englishStyles: [] });
    expect(english().childNodes).toHaveLength(0);
  });

  it('puts the text in as text, never as markup', () => {
    show({ english: '<img src=x>', englishStyles: [{ start: 0, end: 4, style: 'bold' }] });
    expect(english().querySelector('img')).toBeNull();
    expect(english().textContent).toBe('<img src=x>');
  });
});
