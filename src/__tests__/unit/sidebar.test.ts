import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSidebarElements,
  getSefariaUrl,
  updateSidebar,
  type SidebarElements,
} from '../../sidebar';
import type { ToolOnMap } from '../../overlays/types';
import type { VerseTexts } from '../../verseTexts';
import { createVerse, testOverlay } from '../helpers';

// Mock the overlay modules
vi.mock('../../overlays/trop.ts', () => ({
  highlightTropInText: vi.fn((text: string) => text),
}));

describe('sidebar', () => {
  describe('getSidebarElements', () => {
    let sidebar: HTMLElement;

    beforeEach(() => {
      sidebar = document.createElement('div');
      sidebar.id = 'verse-popup';
      document.body.appendChild(sidebar);
    });

    afterEach(() => {
      if (sidebar.parentNode === document.body) {
        document.body.removeChild(sidebar);
      }
    });

    it('returns null for sidebar when element does not exist', () => {
      document.body.removeChild(sidebar);
      const elements = getSidebarElements();
      expect(elements.sidebar).toBeNull();
    });

    it('returns all elements when fully populated', () => {
      const ref = document.createElement('div');
      ref.className = 'ref-text';
      const overlayInfo = document.createElement('div');
      overlayInfo.className = 'overlay-info';
      const hebrew = document.createElement('div');
      hebrew.className = 'verse-hebrew';
      const english = document.createElement('div');
      english.className = 'verse-english';
      const notice = document.createElement('div');
      notice.className = 'verse-notice';
      const link = document.createElement('a');
      link.className = 'sefaria-link';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';

      sidebar.append(ref, overlayInfo, hebrew, notice, english, link, closeBtn);

      const elements = getSidebarElements();
      expect(elements.sidebar).toBe(sidebar);
      expect(elements.ref).toBe(ref);
      expect(elements.overlayInfo).toBe(overlayInfo);
      expect(elements.hebrew).toBe(hebrew);
      expect(elements.english).toBe(english);
      expect(elements.notice).toBe(notice);
      expect(elements.link).toBeInstanceOf(HTMLAnchorElement);
      expect(elements.link).toBe(link);
      expect(elements.closeBtn).toBe(closeBtn);
    });

    it('returns null for missing child elements', () => {
      const elements = getSidebarElements();
      expect(elements.sidebar).toBe(sidebar);
      expect(elements.ref).toBeNull();
      expect(elements.overlayInfo).toBeNull();
      expect(elements.hebrew).toBeNull();
      expect(elements.english).toBeNull();
      expect(elements.link).toBeNull();
      expect(elements.closeBtn).toBeNull();
    });
  });

  describe('getSefariaUrl', () => {
    it('builds URL with ?with=all by default', () => {
      const url = getSefariaUrl('Genesis', 1, 1);
      expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
    });

    it('builds URL with ?with=all for Exodus verse', () => {
      const url = getSefariaUrl('Exodus', 20, 2);
      expect(url).toBe('https://www.sefaria.org/Exodus.20.2?with=all');
    });

    it('replaces spaces with underscores in book names', () => {
      const url = getSefariaUrl('Song of Songs', 1, 1);
      expect(url).toBe('https://www.sefaria.org/Song_of_Songs.1.1?with=all');
    });

    it('handles multiple spaces in book names', () => {
      const url = getSefariaUrl('I Samuel', 1, 1);
      expect(url).toBe('https://www.sefaria.org/I_Samuel.1.1?with=all');
    });

    it('handles large chapter numbers', () => {
      const url = getSefariaUrl('Psalms', 119, 1);
      expect(url).toBe('https://www.sefaria.org/Psalms.119.1?with=all');
    });

    it('handles large verse numbers', () => {
      const url = getSefariaUrl('Psalms', 119, 176);
      expect(url).toBe('https://www.sefaria.org/Psalms.119.176?with=all');
    });

    it('handles book names with special characters', () => {
      const url = getSefariaUrl('II Kings', 1, 1);
      expect(url).toBe('https://www.sefaria.org/II_Kings.1.1?with=all');
    });

    it('adds ?with=all when no overlay is active', () => {
      const url = getSefariaUrl('Genesis', 1, 1, null);
      expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
    });

    it('adds ?with=all when commentary overlay shows all categories', () => {
      const mockOverlay = { id: 'commentary', getSefariaConnectionParam: () => null } as any;
      // No category filter is set, so the link opens to all commentary
      const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
      expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
    });

    it('adds ?with=all when non-commentary overlay is active', () => {
      const mockOverlay = { id: 'search' } as any;
      const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
      expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
    });

    describe('commentary category filtering', () => {
      beforeEach(() => {
        vi.resetAllMocks();
      });

      it('passes the selected category straight through as ?with=<category>', () => {
        const mockOverlay = {
          id: 'commentary',
          getSefariaConnectionParam: () => 'Talmud',
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Talmud');
      });

      it('encodes category names with spaces', () => {
        const mockOverlay = {
          id: 'commentary',
          getSefariaConnectionParam: () => 'Jewish Thought',
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Jewish%20Thought');
      });
    });
  });

  describe('updateSidebar', () => {
    let elements: SidebarElements;
    let verseTexts: VerseTexts;

    beforeEach(() => {
      const sidebar = document.createElement('div');
      sidebar.id = 'verse-popup';
      const ref = document.createElement('div');
      ref.className = 'ref-text';
      const overlayInfo = document.createElement('div');
      overlayInfo.className = 'overlay-info';
      const hebrew = document.createElement('div');
      hebrew.className = 'verse-hebrew';
      const english = document.createElement('div');
      english.className = 'verse-english';
      const notice = document.createElement('div');
      notice.className = 'verse-notice';
      const link = document.createElement('a');
      link.className = 'sefaria-link';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';

      sidebar.append(ref, overlayInfo, hebrew, notice, english, link, closeBtn);
      document.body.appendChild(sidebar);

      elements = {
        sidebar,
        ref,
        overlayInfo,
        hebrew,
        notice,
        english,
        link,
        closeBtn,
      };

      verseTexts = {
        'Genesis': {
          '1': {
            '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' },
          },
        },
      };
    });

    afterEach(() => {
      if (elements.sidebar?.parentNode) {
        document.body.removeChild(elements.sidebar);
      }
    });

    describe('showing verse info', () => {
      it('displays verse reference', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.ref?.textContent).toBe('Genesis 1:1');
      });

      it('displays Hebrew text', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.hebrew?.textContent).toBe('בְּרֵאשִׁית');
      });

      it('displays English text', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.english?.textContent).toBe('In the beginning');
      });

      it('sets Sefaria link href', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.link?.href).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
      });

      it('makes sidebar visible', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('visible')).toBe(true);
      });

      it('shows nothing for a verse the texts do not hold', () => {
        const verse = createVerse({ book: 'Exodus', chapter: 20, verse: 2 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.hebrew?.textContent).toBe('');
        expect(elements.english?.textContent).toBe('');
      });

      it('shows the notice apart from the text while the texts are not in', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        const loading = document.createElement('span');
        updateSidebar(elements, verse, {
          verseTexts: null,
          overlay: null,
          search: null,
          pinned: true,
          textsNotice: loading,
          wordsClickable: true,
        });

        expect(elements.notice?.contains(loading)).toBe(true);
        expect(elements.hebrew?.textContent).toBe('');
        expect(elements.english?.textContent).toBe('');
        expect(elements.sidebar?.classList.contains('visible')).toBe(true);
      });
    });

    describe('pinned state', () => {
      it('adds pinned class when isPinned is true', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: true,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('pinned')).toBe(true);
      });

      it('does not add pinned class when isPinned is false', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('pinned')).toBe(false);
      });

      it('removes pinned class when isPinned changes to false', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.sidebar?.classList.add('pinned');

        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('pinned')).toBe(false);
      });
    });

    describe('hiding sidebar', () => {
      it('removes visible class when verse is null', () => {
        elements.sidebar?.classList.add('visible');
        updateSidebar(elements, null, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('visible')).toBe(false);
      });

      it('removes pinned class when verse is null', () => {
        elements.sidebar?.classList.add('pinned');
        updateSidebar(elements, null, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.sidebar?.classList.contains('pinned')).toBe(false);
      });

      it('does nothing when sidebar element is null', () => {
        const nullElements: SidebarElements = {
          sidebar: null,
          ref: null,
          overlayInfo: null,
          hebrew: null,
          english: null,
          link: null,
          closeBtn: null,
          notice: null,
        };

        expect(() => {
          updateSidebar(nullElements, null, {
            verseTexts,
            overlay: null,
            search: null,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
        }).not.toThrow();
      });
    });

    describe('overlay integration', () => {
      it('displays overlay hover info when available', () => {
        const mockOverlay = testOverlay({
          id: 'test',
          name: 'Test Overlay',
          getVerseColor: () => null,
          getHoverInfo: vi.fn(() => 'Test hover info'),
        });

        const settings = { category: 'x' };
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: { tool: mockOverlay, settings, data: undefined },
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(mockOverlay.getHoverInfo).toHaveBeenCalledWith(verse, settings, undefined);
        expect(elements.overlayInfo?.textContent).toBe('Test hover info');
      });

      it('clears overlay info when overlay has no getHoverInfo', () => {
        const mockOverlay = testOverlay({
          id: 'test',
          name: 'Test Overlay',
          getVerseColor: () => null,
        });

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: { tool: mockOverlay, settings: undefined, data: undefined },
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.overlayInfo?.textContent).toBe('');
      });

      it('clears overlay info when overlay is null', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.overlayInfo?.textContent).toBe('');
      });
    });

    describe('special text highlighting', () => {
      it('highlights trop marks when trop overlay is active', () => {
        // A real overlay marks up the same text it was given rather than
        // replacing it, so the mock does too - otherwise this test would
        // exercise the wrapWordsInFragment mismatch guard instead of the
        // highlighting path it's named for.
        const mockOverlay = testOverlay({
          id: 'trop',
          name: 'Trop Overlay',
          getVerseColor: () => null,
          highlightVerseText: vi.fn((_verse: unknown, text: string, language: 'he' | 'en') => {
            const fragment = document.createDocumentFragment();
            if (language === 'he') {
              const mark = document.createElement('mark');
              mark.textContent = text;
              fragment.appendChild(mark);
            } else {
              fragment.appendChild(document.createTextNode(text));
            }
            return fragment;
          }),
        });

        const settings = { any: 'value' };
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: { tool: mockOverlay, settings, data: undefined },
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith(
          verse,
          'בְּרֵאשִׁית',
          'he',
          settings,
          undefined,
        );
        // The mark reaches the popup, and the text inside it is still wrapped
        // into a clickable word rather than the guard refusing to touch it.
        expect(elements.hebrew?.querySelector('mark')).not.toBeNull();
        expect(elements.hebrew?.querySelector('mark .verse-word')).not.toBeNull();
        expect(elements.hebrew?.textContent).toBe('בְּרֵאשִׁית');
      });

      it('highlights search terms when search overlay is active', () => {
        const hebrewFragment = document.createDocumentFragment();
        hebrewFragment.appendChild(document.createTextNode('highlighted hebrew'));
        const englishFragment = document.createDocumentFragment();
        englishFragment.appendChild(document.createTextNode('highlighted english'));

        const mockOverlay = testOverlay({
          id: 'search',
          name: 'Search Overlay',
          getVerseColor: () => null,
          highlightVerseText: vi.fn((_verse: unknown, _text: string, language: 'he' | 'en') => {
            if (language === 'he') return hebrewFragment;
            return englishFragment;
          }),
        });

        const settings = { any: 'value' };
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: { tool: mockOverlay, settings, data: undefined },
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith(
          verse,
          'בְּרֵאשִׁית',
          'he',
          settings,
          undefined,
        );
        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith(
          verse,
          'In the beginning',
          'en',
          settings,
          undefined,
        );
      });

      it('uses plain text when no special overlay is active', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.hebrew?.textContent).toBe('בְּרֵאשִׁית');
        expect(elements.english?.textContent).toBe('In the beginning');
      });

      describe('with a search on', () => {
        function searchOn(info: string | null): ToolOnMap {
          return {
            tool: {
              id: 'search',
              name: 'Search',
              getVerseColor: () => null,
              colorsFor: (items) => items.map(() => null),
              getHoverInfo: () => info,
              highlightVerseText: vi.fn((_verse: unknown, text: string) => {
                const fragment = document.createDocumentFragment();
                const mark = document.createElement('mark');
                mark.textContent = text;
                fragment.appendChild(mark);
                return fragment;
              }),
            },
            settings: {},
            data: undefined,
          };
        }

        it("shows the overlay's line, then the search's", () => {
          const overlay = testOverlay({
            id: 'commentary',
            name: 'Commentary',
            getVerseColor: () => null,
            getHoverInfo: () => '680 references',
          });
          const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: { tool: overlay, settings: undefined, data: undefined },
            search: searchOn('Matches: אברם'),
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });

          expect([...elements.overlayInfo!.children].map((c) => c.textContent)).toEqual([
            '680 references',
            'Matches: אברם',
          ]);
        });

        /** A marker that wraps text[start, end) in a mark of class `cls`. */
        function marking(cls: string, start: number, end: number) {
          return vi.fn((_verse: unknown, text: string) => {
            const fragment = document.createDocumentFragment();
            const mark = document.createElement('mark');
            mark.className = cls;
            mark.textContent = text.slice(start, end);
            fragment.append(text.slice(0, start), mark, text.slice(end));
            return fragment;
          });
        }

        function markedEnglish(
          overlayMarks: [number, number],
          searchMarks: [number, number],
        ): string[] {
          const overlay = testOverlay({
            id: 'trop',
            name: 'Trop',
            getVerseColor: () => null,
            highlightVerseText: marking('trop-highlight', ...overlayMarks),
          });
          const search: ToolOnMap = {
            tool: {
              id: 'search',
              name: 'Search',
              getVerseColor: () => null,
              colorsFor: (items) => items.map(() => null),
              highlightVerseText: marking('term-0', ...searchMarks),
            },
            settings: {},
            data: undefined,
          };
          const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: { tool: overlay, settings: undefined, data: undefined },
            search: search,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
          expect(elements.english?.textContent).toBe('In the beginning');
          return [...elements.english!.querySelectorAll('mark')].map(
            (m) => `${m.className}:${m.textContent}`,
          );
        }

        it("marks the overlay's stretches and the search's together", () => {
          expect(markedEnglish([0, 2], [7, 16])).toEqual(['trop-highlight:In', 'term-0:beginning']);
        });

        it("keeps the search's mark where both mark the same word", () => {
          expect(markedEnglish([7, 9], [7, 16])).toEqual(['term-0:beginning']);
        });
      });
    });

    describe('edge cases', () => {
      it('handles missing ref element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.ref = null;

        expect(() => {
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: null,
            search: null,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
        }).not.toThrow();
      });

      it('handles missing hebrew element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.hebrew = null;

        expect(() => {
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: null,
            search: null,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
        }).not.toThrow();
      });

      it('handles missing english element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.english = null;

        expect(() => {
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: null,
            search: null,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
        }).not.toThrow();
      });

      it('handles missing link element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.link = null;

        expect(() => {
          updateSidebar(elements, verse, {
            verseTexts,
            overlay: null,
            search: null,
            pinned: false,
            textsNotice: null,
            wordsClickable: true,
          });
        }).not.toThrow();
      });

      it('handles verse with spaces in book name', () => {
        verseTexts['Song of Songs'] = {
          '1': {
            '1': { he: 'שיר השירים', en: 'Song of Songs' },
          },
        };
        const verse = createVerse({ book: 'Song of Songs', chapter: 1, verse: 1 });

        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.ref?.textContent).toBe('Song of Songs 1:1');
        expect(elements.link?.href).toBe('https://www.sefaria.org/Song_of_Songs.1.1?with=all');
      });
    });
  });
});
