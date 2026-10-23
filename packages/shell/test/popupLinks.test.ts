// Stretches of a square's text that a text hands the popup as links.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MapItem } from '@torahmap/engine';
import {
  getSidebarElements,
  setWordClickHandler,
  updateSidebar,
  type PopupText,
} from '../src/sidebar.ts';
import type { Overlay, ToolOnMap } from '../src/overlays/types.ts';

const item: MapItem = { id: 'a', x: 0, y: 0, size: 1 };
const HEBREW = 'שנאמר תהלים לו ז צדקתך';
const CITED = { start: 6, end: 16, href: '/?verse=Psalms.36.7' };

function show(text: Partial<PopupText>, search: ToolOnMap<MapItem> | null = null): void {
  updateSidebar(
    getSidebarElements(),
    item,
    () => ({ ref: '', hebrew: HEBREW, english: '', link: '', ...text }),
    { wordsClickable: true, overlay: null, search, pinned: true },
  );
}

const hebrew = () => document.querySelector('.popup-hebrew')!;
const anchors = () => [...hebrew().querySelectorAll('a')];

beforeEach(() => {
  document.body.innerHTML = `
    <div id="popup">
      <span class="ref-text"></span>
      <div class="popup-hebrew"></div>
      <div class="popup-english"></div>
    </div>`;
  setWordClickHandler(() => {});
});

afterEach(() => setWordClickHandler(null));

describe('links in the popup', () => {
  it('turns each stretch into a link that opens in a new window', () => {
    show({ hebrewLinks: [CITED] });
    expect(anchors().map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['תהלים לו ז', CITED.href],
    ]);
    expect(anchors()[0].target).toBe('_blank');
    expect(anchors()[0].rel).toBe('noopener');
    expect(hebrew().textContent).toBe(HEBREW);
  });

  it("keeps the words around a link clickable, and a link's own words a link only", () => {
    const heard = vi.fn();
    setWordClickHandler(heard);
    show({ hebrewLinks: [CITED] });
    const words = [...hebrew().querySelectorAll('.popup-word')].map((w) => w.textContent);
    expect(words).toEqual(['שנאמר', 'צדקתך']);
    // Kept from navigating, which the test window would try.
    anchors()[0].addEventListener('click', (event) => event.preventDefault());
    anchors()[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(heard).not.toHaveBeenCalled();
  });

  it('links a stretch the search has marked part of, and keeps the mark', () => {
    const marking = {
      highlightItemText: (_item: MapItem, text: string) => {
        const fragment = document.createDocumentFragment();
        const mark = document.createElement('mark');
        mark.textContent = text.slice(0, 11);
        fragment.append(mark, text.slice(11));
        return fragment;
      },
    } as unknown as Overlay<MapItem>;
    show({ hebrewLinks: [CITED] }, { tool: marking, settings: {}, data: undefined });
    expect(hebrew().textContent).toBe(HEBREW);
    expect(hebrew().querySelector('mark')!.textContent).toBe('שנאמר תהלים');
    expect(
      anchors()
        .map((a) => a.textContent)
        .join(''),
    ).toBe('תהלים לו ז');
  });

  it('shows the text plain where it has no links', () => {
    show({});
    expect(anchors()).toEqual([]);
    expect(hebrew().textContent).toBe(HEBREW);
  });

  it('shows a labelled link as its label, before the word at its place and outside it', () => {
    const heard = vi.fn();
    setWordClickHandler(heard);
    show({
      hebrewLinks: [{ start: 17, end: 17, href: '/?verse=Psalms.36.7', label: '(תהלים לו, ז)' }],
    });
    expect(anchors().map((a) => a.textContent)).toEqual(['(תהלים לו, ז)']);
    expect(hebrew().textContent).toBe('שנאמר תהלים לו ז (תהלים לו, ז)צדקתך');
    expect(anchors()[0].closest('.popup-word')).toBeNull();
    anchors()[0].addEventListener('click', (event) => event.preventDefault());
    anchors()[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(heard).not.toHaveBeenCalled();
  });

  it('shows a label at the end of the text', () => {
    show({ hebrewLinks: [{ start: 22, end: 22, href: '/', label: '(א)' }] });
    expect(hebrew().textContent).toBe(HEBREW + '(א)');
  });
});
