import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSidebarElements,
  getSefariaUrl,
  updateSidebar,
  type SidebarElements,
} from '../../sidebar';
import type { Overlay } from '../../overlays/types';
import type { VerseTexts, VerseText } from '../../verseTexts';
import { createVerse } from '../helpers';

// Mock the overlay modules
vi.mock('../../overlays/trop.ts', () => ({
  getSelectedTrop: vi.fn(() => null),
  highlightTropInText: vi.fn((text: string) => text),
}));

vi.mock('../../overlays/search.ts', () => ({
  highlightSearchTerms: vi.fn((text: string) => {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
  }),
}));

vi.mock('../../overlays/commentary.ts', () => ({
  getVerseLinkCount: vi.fn(() => 0),
  getCurrentCategory: vi.fn(() => 'total'),
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

    it('returns sidebar element when it exists', () => {
      const elements = getSidebarElements();
      expect(elements.sidebar).toBe(sidebar);
    });

    it('returns null for sidebar when element does not exist', () => {
      document.body.removeChild(sidebar);
      const elements = getSidebarElements();
      expect(elements.sidebar).toBeNull();
    });

    it('returns ref element when it exists', () => {
      const ref = document.createElement('div');
      ref.className = 'ref-text';
      sidebar.appendChild(ref);

      const elements = getSidebarElements();
      expect(elements.ref).toBe(ref);
    });

    it('returns overlayInfo element when it exists', () => {
      const overlayInfo = document.createElement('div');
      overlayInfo.className = 'overlay-info';
      sidebar.appendChild(overlayInfo);

      const elements = getSidebarElements();
      expect(elements.overlayInfo).toBe(overlayInfo);
    });

    it('returns hebrew element when it exists', () => {
      const hebrew = document.createElement('div');
      hebrew.className = 'verse-hebrew';
      sidebar.appendChild(hebrew);

      const elements = getSidebarElements();
      expect(elements.hebrew).toBe(hebrew);
    });

    it('returns english element when it exists', () => {
      const english = document.createElement('div');
      english.className = 'verse-english';
      sidebar.appendChild(english);

      const elements = getSidebarElements();
      expect(elements.english).toBe(english);
    });

    it('returns link element as HTMLAnchorElement when it exists', () => {
      const link = document.createElement('a');
      link.className = 'sefaria-link';
      sidebar.appendChild(link);

      const elements = getSidebarElements();
      expect(elements.link).toBe(link);
      expect(elements.link).toBeInstanceOf(HTMLAnchorElement);
    });

    it('returns linkSubtitle element when it exists', () => {
      const linkSubtitle = document.createElement('div');
      linkSubtitle.className = 'link-subtitle';
      sidebar.appendChild(linkSubtitle);

      const elements = getSidebarElements();
      expect(elements.linkSubtitle).toBe(linkSubtitle);
    });

    it('returns closeBtn element when it exists', () => {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      sidebar.appendChild(closeBtn);

      const elements = getSidebarElements();
      expect(elements.closeBtn).toBe(closeBtn);
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
      const link = document.createElement('a');
      link.className = 'sefaria-link';
      const linkSubtitle = document.createElement('div');
      linkSubtitle.className = 'link-subtitle';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';

      sidebar.append(ref, overlayInfo, hebrew, english, link, linkSubtitle, closeBtn);

      const elements = getSidebarElements();
      expect(elements.sidebar).toBe(sidebar);
      expect(elements.ref).toBe(ref);
      expect(elements.overlayInfo).toBe(overlayInfo);
      expect(elements.hebrew).toBe(hebrew);
      expect(elements.english).toBe(english);
      expect(elements.link).toBe(link);
      expect(elements.linkSubtitle).toBe(linkSubtitle);
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
      expect(elements.linkSubtitle).toBeNull();
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
      const mockOverlay = { id: 'commentary' } as any;
      // When getCurrentCategory returns 'total', should use ?with=all
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

      it('adds ?with=Talmud when Talmud category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Talmud' }),
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Talmud');
      });

      it('adds ?with=Midrash when Midrash category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Midrash' }),
        } as any;
        const url = getSefariaUrl('Exodus', 20, 2, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Exodus.20.2?with=Midrash');
      });

      it('adds ?with=Halakhah when Halakhah category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Halakhah' }),
        } as any;
        const url = getSefariaUrl('Leviticus', 19, 18, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Leviticus.19.18?with=Halakhah');
      });

      it('encodes category names with spaces', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Jewish Thought' }),
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Jewish%20Thought');
      });

      it('adds ?with=Kabbalah when Kabbalah category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Kabbalah' }),
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Kabbalah');
      });

      it('adds ?with=Chasidut when Chasidut category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Chasidut' }),
        } as any;
        const url = getSefariaUrl('Genesis', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Genesis.1.1?with=Chasidut');
      });

      it('adds ?with=Musar when Musar category is selected', () => {
        const mockOverlay = {
          id: 'commentary',
          getUrlParams: () => ({ cat: 'Musar' }),
        } as any;
        const url = getSefariaUrl('Proverbs', 1, 1, mockOverlay);
        expect(url).toBe('https://www.sefaria.org/Proverbs.1.1?with=Musar');
      });
    });
  });

  describe('updateSidebar', () => {
    let elements: SidebarElements;
    let verseTexts: VerseTexts;
    let mockGetVerseText: (texts: VerseTexts, book: string, chapter: number, verse: number) => VerseText | null;

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
      const link = document.createElement('a');
      link.className = 'sefaria-link';
      const linkSubtitle = document.createElement('div');
      linkSubtitle.className = 'link-subtitle';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';

      sidebar.append(ref, overlayInfo, hebrew, english, link, linkSubtitle, closeBtn);
      document.body.appendChild(sidebar);

      elements = {
        sidebar,
        ref,
        overlayInfo,
        hebrew,
        english,
        link,
        linkSubtitle,
        closeBtn,
      };

      verseTexts = {
        'Genesis': {
          '1': {
            '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' }
          }
        }
      };

      mockGetVerseText = vi.fn((texts, book, chapter, verse) => {
        return texts[book]?.[String(chapter)]?.[String(verse)] || null;
      });
    });

    afterEach(() => {
      if (elements.sidebar?.parentNode) {
        document.body.removeChild(elements.sidebar);
      }
    });

    describe('showing verse info', () => {
      it('displays verse reference', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.ref?.textContent).toBe('Genesis 1:1');
      });

      it('displays Hebrew text', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.hebrew?.textContent).toBe('בְּרֵאשִׁית');
      });

      it('displays English text', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.english?.textContent).toBe('In the beginning');
      });

      it('sets Sefaria link href', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.link?.href).toBe('https://www.sefaria.org/Genesis.1.1?with=all');
      });

      it('makes sidebar visible', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.sidebar?.classList.contains('visible')).toBe(true);
      });

      it('handles verse with no text data', () => {
        const verse = createVerse({ book: 'Exodus', chapter: 20, verse: 2 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.hebrew?.textContent).toBe('Loading...');
        expect(elements.english?.textContent).toBe('Loading...');
      });
    });

    describe('pinned state', () => {
      it('adds pinned class when isPinned is true', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, true);

        expect(elements.sidebar?.classList.contains('pinned')).toBe(true);
      });

      it('does not add pinned class when isPinned is false', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.sidebar?.classList.contains('pinned')).toBe(false);
      });

      it('removes pinned class when isPinned changes to false', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.sidebar?.classList.add('pinned');

        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.sidebar?.classList.contains('pinned')).toBe(false);
      });
    });

    describe('hiding sidebar', () => {
      it('removes visible class when verse is null', () => {
        elements.sidebar?.classList.add('visible');
        updateSidebar(elements, null, verseTexts, null, mockGetVerseText, false);

        expect(elements.sidebar?.classList.contains('visible')).toBe(false);
      });

      it('removes pinned class when verse is null', () => {
        elements.sidebar?.classList.add('pinned');
        updateSidebar(elements, null, verseTexts, null, mockGetVerseText, false);

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
          linkSubtitle: null,
          closeBtn: null,
        };

        expect(() => {
          updateSidebar(nullElements, null, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });
    });

    describe('overlay integration', () => {
      it('displays overlay hover info when available', () => {
        const mockOverlay: Overlay = {
          id: 'test',
          name: 'Test Overlay',
          getVerseColor: () => null,
          getHoverInfo: vi.fn(() => 'Test hover info'),
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(mockOverlay.getHoverInfo).toHaveBeenCalledWith(verse);
        expect(elements.overlayInfo?.textContent).toBe('Test hover info');
      });

      it('clears overlay info when overlay has no getHoverInfo', () => {
        const mockOverlay: Overlay = {
          id: 'test',
          name: 'Test Overlay',
          getVerseColor: () => null,
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(elements.overlayInfo?.textContent).toBe('');
      });

      it('clears overlay info when overlay is null', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.overlayInfo?.textContent).toBe('');
      });
    });

    describe('link count display', () => {
      it('displays link count when available', async () => {
        const { getVerseLinkCount } = await import('../../overlays/commentary.ts');
        vi.mocked(getVerseLinkCount).mockReturnValue(42);

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.linkSubtitle?.textContent).toBe('42 linked texts');
      });

      it('clears link subtitle when no links', async () => {
        const { getVerseLinkCount } = await import('../../overlays/commentary.ts');
        vi.mocked(getVerseLinkCount).mockReturnValue(0);

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.linkSubtitle?.textContent).toBe('');
      });
    });

    describe('special text highlighting', () => {
      it('highlights trop marks when trop overlay is active', () => {
        const mockOverlay: Overlay = {
          id: 'trop',
          name: 'Trop Overlay',
          getVerseColor: () => null,
          highlightVerseText: vi.fn((text: string, language: 'he' | 'en') => {
            if (language === 'he') {
              return '<span>highlighted</span>';
            }
            return text;
          }),
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith('בְּרֵאשִׁית', 'he');
        expect(elements.hebrew?.innerHTML).toBe('<span>highlighted</span>');
      });

      it('highlights search terms when search overlay is active', () => {
        const hebrewFragment = document.createDocumentFragment();
        hebrewFragment.appendChild(document.createTextNode('highlighted hebrew'));
        const englishFragment = document.createDocumentFragment();
        englishFragment.appendChild(document.createTextNode('highlighted english'));

        const mockOverlay: Overlay = {
          id: 'search',
          name: 'Search Overlay',
          getVerseColor: () => null,
          highlightVerseText: vi.fn((_text: string, language: 'he' | 'en') => {
            if (language === 'he') return hebrewFragment;
            return englishFragment;
          }),
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith('בְּרֵאשִׁית', 'he');
        expect(mockOverlay.highlightVerseText).toHaveBeenCalledWith('In the beginning', 'en');
      });

      it('uses plain text when no special overlay is active', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.hebrew?.textContent).toBe('בְּרֵאשִׁית');
        expect(elements.english?.textContent).toBe('In the beginning');
      });
    });

    describe('edge cases', () => {
      it('handles missing ref element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.ref = null;

        expect(() => {
          updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });

      it('handles missing hebrew element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.hebrew = null;

        expect(() => {
          updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });

      it('handles missing english element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.english = null;

        expect(() => {
          updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });

      it('handles missing link element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.link = null;

        expect(() => {
          updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });

      it('handles missing linkSubtitle element', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        elements.linkSubtitle = null;

        expect(() => {
          updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);
        }).not.toThrow();
      });

      it('handles verse with spaces in book name', () => {
        verseTexts['Song of Songs'] = {
          '1': {
            '1': { he: 'שיר השירים', en: 'Song of Songs' }
          }
        };
        const verse = createVerse({ book: 'Song of Songs', chapter: 1, verse: 1 });

        updateSidebar(elements, verse, verseTexts, null, mockGetVerseText, false);

        expect(elements.ref?.textContent).toBe('Song of Songs 1:1');
        expect(elements.link?.href).toBe('https://www.sefaria.org/Song_of_Songs.1.1?with=all');
      });
    });
  });
});
