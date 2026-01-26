import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSidebarElements,
  getSefariaUrl,
  positionSidebar,
  updateSidebar,
  type SidebarElements,
} from '../../sidebar';
import type { Overlay } from '../../overlays/types';
import type { VerseTexts } from '../../verseTexts';
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
}));

describe('sidebar', () => {
  describe('getSidebarElements', () => {
    let sidebar: HTMLElement;

    beforeEach(() => {
      sidebar = document.createElement('div');
      sidebar.id = 'verse-sidebar';
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
    it('builds URL for Genesis verse', () => {
      const url = getSefariaUrl('Genesis', 1, 1);
      expect(url).toBe('https://www.sefaria.org/Genesis.1.1');
    });

    it('builds URL for Exodus verse', () => {
      const url = getSefariaUrl('Exodus', 20, 2);
      expect(url).toBe('https://www.sefaria.org/Exodus.20.2');
    });

    it('replaces spaces with underscores in book names', () => {
      const url = getSefariaUrl('Song of Songs', 1, 1);
      expect(url).toBe('https://www.sefaria.org/Song_of_Songs.1.1');
    });

    it('handles multiple spaces in book names', () => {
      const url = getSefariaUrl('I Samuel', 1, 1);
      expect(url).toBe('https://www.sefaria.org/I_Samuel.1.1');
    });

    it('handles large chapter numbers', () => {
      const url = getSefariaUrl('Psalms', 119, 1);
      expect(url).toBe('https://www.sefaria.org/Psalms.119.1');
    });

    it('handles large verse numbers', () => {
      const url = getSefariaUrl('Psalms', 119, 176);
      expect(url).toBe('https://www.sefaria.org/Psalms.119.176');
    });

    it('handles book names with special characters', () => {
      const url = getSefariaUrl('II Kings', 1, 1);
      expect(url).toBe('https://www.sefaria.org/II_Kings.1.1');
    });
  });

  describe('positionSidebar', () => {
    let sidebar: HTMLElement;
    let controlsPanel: HTMLElement;

    beforeEach(() => {
      sidebar = document.createElement('div');
      sidebar.id = 'verse-sidebar';
      sidebar.style.position = 'fixed';
      controlsPanel = document.createElement('div');
      controlsPanel.id = 'controls';
      document.body.append(sidebar, controlsPanel);
    });

    afterEach(() => {
      document.body.removeChild(sidebar);
      document.body.removeChild(controlsPanel);
    });

    it('positions sidebar below controls panel', () => {
      // Mock getBoundingClientRect
      vi.spyOn(controlsPanel, 'getBoundingClientRect').mockReturnValue({
        bottom: 100,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      positionSidebar(sidebar, controlsPanel);

      expect(sidebar.style.top).toBe('110px'); // bottom (100) + 10
    });

    it('handles large control panel heights', () => {
      vi.spyOn(controlsPanel, 'getBoundingClientRect').mockReturnValue({
        bottom: 500,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      positionSidebar(sidebar, controlsPanel);

      expect(sidebar.style.top).toBe('510px');
    });

    it('handles small control panel heights', () => {
      vi.spyOn(controlsPanel, 'getBoundingClientRect').mockReturnValue({
        bottom: 20,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      positionSidebar(sidebar, controlsPanel);

      expect(sidebar.style.top).toBe('30px');
    });

    it('does nothing when sidebar is null', () => {
      expect(() => {
        positionSidebar(null, controlsPanel);
      }).not.toThrow();
    });

    it('does nothing when controlsPanel is null', () => {
      expect(() => {
        positionSidebar(sidebar, null);
      }).not.toThrow();
    });

    it('does nothing when both are null', () => {
      expect(() => {
        positionSidebar(null, null);
      }).not.toThrow();
    });
  });

  describe('updateSidebar', () => {
    let elements: SidebarElements;
    let verseTexts: VerseTexts;
    let mockGetVerseText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const sidebar = document.createElement('div');
      sidebar.id = 'verse-sidebar';
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

        expect(elements.link?.href).toBe('https://www.sefaria.org/Genesis.1.1');
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
      it('highlights trop marks when trop overlay is active', async () => {
        const { getSelectedTrop, highlightTropInText } = await import('../../overlays/trop.ts');
        vi.mocked(getSelectedTrop).mockReturnValue({
          unicode: '\u0591',
          name: 'Etnachta',
          hebrewName: 'אתנחתא',
          totalCount: 100,
          verses: [],
        });
        vi.mocked(highlightTropInText).mockReturnValue('<span>highlighted</span>');

        const mockOverlay: Overlay = {
          id: 'trop',
          name: 'Trop Overlay',
          getVerseColor: () => null,
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(highlightTropInText).toHaveBeenCalledWith('בְּרֵאשִׁית', '\u0591');
        expect(elements.hebrew?.innerHTML).toBe('<span>highlighted</span>');
      });

      it('highlights search terms when search overlay is active', async () => {
        const { highlightSearchTerms } = await import('../../overlays/search.ts');

        const mockOverlay: Overlay = {
          id: 'search',
          name: 'Search Overlay',
          getVerseColor: () => null,
        };

        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        updateSidebar(elements, verse, verseTexts, mockOverlay, mockGetVerseText, false);

        expect(highlightSearchTerms).toHaveBeenCalledWith('בְּרֵאשִׁית', 'he');
        expect(highlightSearchTerms).toHaveBeenCalledWith('In the beginning', 'en');
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
        expect(elements.link?.href).toBe('https://www.sefaria.org/Song_of_Songs.1.1');
      });
    });
  });
});
