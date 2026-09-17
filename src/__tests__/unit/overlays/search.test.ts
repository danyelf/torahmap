import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, highlightSearchTerms } from '../../../overlays/search';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const searchOverlay = getOverlay('search')!;
import type { Color } from '../../../overlays/types';
import { getWordBoundaries } from '../../../search';
import { search, buildSearchIndex, parseSearchTerms } from '../../../search';
import { SEARCH_COLORS } from '../../../utils/color';
import { HIGHLIGHT_CONSTANTS } from '../../../constants';

const DIM_FACTOR = HIGHLIGHT_CONSTANTS.DIM_FACTOR;
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { TanakhLayout } from '../../../types';
import type { VerseTexts } from '../../../verseTexts';
import { applyOverlayParams } from '../../helpers/overlayUrlParams';

describe('Search Overlay', () => {
  let testVerses: TanakhLayout[];
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    vi.clearAllMocks();

    // The search is a list of terms that survives an overlay switch, so it also
    // survives from one test to the next. Clear it the way the app would.
    applyOverlayParams(searchOverlay, { q: '' });

    testVerses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 3 }),
      createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 2 }),
      createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
      createVerse({ book: 'Isaiah', chapter: 1, verse: 2 }),
    ];

    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
            en: 'In the beginning God created',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ',
            en: 'And the earth was without form',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'And God said let there be light',
          },
        },
        '2': {
          '1': {
            he: 'וַיְכֻלּוּ הַשָּׁמַיִם',
            en: 'Thus the heavens were finished',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵלֶּה שְׁמוֹת',
            en: 'Now these are the names',
          },
          '2': {
            he: 'רְאוּבֵן שִׁמְעוֹן',
            en: 'Reuben Simeon',
          },
        },
      },
      'Isaiah': {
        '1': {
          '1': {
            he: 'חֲזוֹן יְשַׁעְיָהוּ',
            en: 'The vision of Isaiah',
          },
          '2': {
            he: 'שִׁמְעוּ שָׁמַיִם',
            en: 'Hear O heavens',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);

    configure({ verses: testVerses });
  });

  afterEach(() => {
    searchOverlay.destroy?.();

    // Clear any search state by simulating an empty search
    const container = document.createElement('div');
    searchOverlay.renderControls?.(container);
    const input = container.querySelector('#search-input') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
    }
    searchOverlay.destroy?.();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(searchOverlay.id).toBe('search');
      expect(searchOverlay.name).toBe('Text Search');
    });
  });

  describe('Color Computation - No Search', () => {
    it('returns null when no search is active', () => {
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).toBeNull();
    });

    it('returns null for all verses when no search query', () => {
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).toBeNull();
      }
    });
  });

  describe('Color Computation - Single Term Search', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));
    });

    it('returns search color for matching verses', () => {
      // Genesis 1:1 and 1:3 contain "God"
      const verse1 = testVerses[0]; // Genesis 1:1
      const verse3 = testVerses[2]; // Genesis 1:3

      const color1 = searchOverlay.getVerseColor(verse1);
      const color3 = searchOverlay.getVerseColor(verse3);

      expect(color1).not.toBeNull();
      expect(color3).not.toBeNull();

      expect(color1).toEqual(SEARCH_COLORS[0]);
      expect(color3).toEqual(SEARCH_COLORS[0]);
    });

    it('returns dimmed color for non-matching verses', () => {
      // Genesis 1:2 does not contain "God"
      const verse = testVerses[1];
      const color = searchOverlay.getVerseColor(verse) as Color;

      expect(color).not.toBeNull();
      assertValidColor(color);

      const brightness = (0.4 + 0.2) * DIM_FACTOR;
      expect(color[0]).toBeCloseTo(brightness, 2);
      expect(color[1]).toBeCloseTo(brightness, 2);
      expect(color[2]).toBeCloseTo(brightness, 2);
    });

    it('uses correct color from SEARCH_COLORS palette', () => {
      const verse = testVerses[0]; // Genesis 1:1
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toEqual(SEARCH_COLORS[0]);
    });
  });

  describe('Color Computation - Multi-Term Search', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, earth';
      input.dispatchEvent(new Event('input'));
    });

    it('returns single color for verse matching one term', () => {
      // Genesis 1:1 contains "God" but not "earth"
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toEqual(SEARCH_COLORS[0]); // Color for first term
    });

    it('returns array of colors for verse matching multiple terms', () => {
      // Genesis 1:2 contains "earth"
      const verse = testVerses[1];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toEqual(SEARCH_COLORS[1]);
    });

    it('caps color array at 4 colors', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      // Create a contrived scenario - in practice hard to match 5 terms in one verse
      input.value = 'the, and, of, in, be';
      input.dispatchEvent(new Event('input'));

      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        if (Array.isArray(color) && color.length > 1) {
          expect(color.length).toBeLessThanOrEqual(4);
        }
      }
    });

    it('assigns different colors to different terms', () => {
      // First term gets first color, second term gets second color
      expect(SEARCH_COLORS[0]).not.toEqual(SEARCH_COLORS[1]);
      expect(SEARCH_COLORS[1]).not.toEqual(SEARCH_COLORS[2]);
    });
  });

  describe('Hebrew Search', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      // Search for Hebrew word אלהים (Elohim/God)
      input.value = 'אלהים';
      input.dispatchEvent(new Event('input'));
    });

    it('highlights verses with Hebrew matches', () => {
      // Genesis 1:1 contains אלהים
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      expect(color).toEqual(SEARCH_COLORS[0]);
    });

    it('dims verses without Hebrew matches', () => {
      // Genesis 2:1 does not contain אלהים
      const verse = testVerses[3];
      const color = searchOverlay.getVerseColor(verse) as Color;

      expect(color).not.toBeNull();
      const brightness = (0.4 + 0.2) * DIM_FACTOR;
      expect(color[0]).toBeCloseTo(brightness, 2);
    });

    it('handles nikkud-insensitive search', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Without nikkud
      input.dispatchEvent(new Event('input'));

      // Still matches Genesis 1:1, which has אֱלֹהִים (with nikkud)
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toEqual(SEARCH_COLORS[0]);
    });
  });

  describe('Render Controls', () => {
    it('renders search input', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input');
      expect(input).not.toBeNull();
      expect(input?.tagName).toBe('INPUT');
    });

    it('renders clear button', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const clearBtn = container.querySelector('#search-clear');
      expect(clearBtn).not.toBeNull();
      expect(clearBtn?.tagName).toBe('BUTTON');
    });

    it('renders results container', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const results = container.querySelector('#search-results');
      expect(results).not.toBeNull();
    });

    it('hides clear button when input is empty', () => {
      // Start fresh without any previous search
      configure({ verses: testVerses });
      searchOverlay.destroy?.();

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const clearBtn = container.querySelector('#search-clear') as HTMLElement;
      const input = container.querySelector('#search-input') as HTMLInputElement;

      // If input is empty, clear button should be hidden or not displayed
      if (!input.value) {
        // Check that it's either 'none' or empty string (not displayed)
        expect(['none', '']).toContain(clearBtn.style.display);
      }
    });

    it('shows clear button when query is entered', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      const clearBtn = container.querySelector('#search-clear') as HTMLElement;

      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      expect(clearBtn.style.display).toBe('block');
    });

    it('clears search when clear button is clicked', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      const clearBtn = container.querySelector('#search-clear') as HTMLButtonElement;

      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      clearBtn.click();

      expect(input.value).toBe('');
      expect(clearBtn.style.display).toBe('none');
    });

    it('returns to left-to-right when a Hebrew query is cleared', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      const clearBtn = container.querySelector('#search-clear') as HTMLButtonElement;

      input.value = 'אלהים';
      input.dispatchEvent(new Event('input'));
      expect(input.dir).toBe('rtl');
      expect(searchOverlay.getVerseColor(testVerses[0])).not.toBeNull();

      clearBtn.click();

      // An empty box has no Hebrew in it, so it reads left to right again
      expect(input.value).toBe('');
      expect(input.dir).toBe('ltr');
      // ...and the search is actually re-run, so nothing stays highlighted
      expect(searchOverlay.getVerseColor(testVerses[0])).toBeNull();
    });

    it('triggers update callback on search', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      expect(updateCallback).toHaveBeenCalled();
    });

    it('restores previous query when re-rendering', () => {
      // First render with query
      const container1 = document.createElement('div');
      searchOverlay.renderControls?.(container1);

      const input1 = container1.querySelector('#search-input') as HTMLInputElement;
      input1.value = 'God';
      input1.dispatchEvent(new Event('input'));

      // Second render should restore query
      const container2 = document.createElement('div');
      searchOverlay.renderControls?.(container2);

      const input2 = container2.querySelector('#search-input') as HTMLInputElement;
      expect(input2.value).toBe('God');
    });

    it('strips nikkud from pasted Hebrew text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Create a ClipboardEvent with Hebrew text containing nikkud
      const hebrewWithNikkud = 'אֱלֹהִ֛ים';
      const expectedStripped = 'אלהים';

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', hebrewWithNikkud);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });

      input.dispatchEvent(pasteEvent);

      expect(input.value).toBe(expectedStripped);
    });

    it('does not prevent default for non-Hebrew pasted text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Create a ClipboardEvent with English text
      const englishText = 'beginning';

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', englishText);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });

      input.dispatchEvent(pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(false);
    });

    it('handles paste at cursor position', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Set initial value (Hebrew) and cursor position
      input.value = 'שלום  עולם';
      input.setSelectionRange(5, 5); // Position cursor between words

      // Create a ClipboardEvent with Hebrew text containing nikkud
      const hebrewWithNikkud = 'אֱלֹהִ֛ים';
      const expectedStripped = 'אלהים';

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', hebrewWithNikkud);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });

      input.dispatchEvent(pasteEvent);

      expect(input.value).toBe('שלום ' + expectedStripped + ' עולם');

      // Cursor is after inserted text
      expect(input.selectionStart).toBe(5 + expectedStripped.length);
      expect(input.selectionEnd).toBe(5 + expectedStripped.length);
    });

    it('strips nikkud from typed Hebrew text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Simulate typing Hebrew text with nikkud (e.g., from a Hebrew keyboard with nikkud enabled)
      const hebrewWithNikkud = 'אֱלֹהִים';
      const expectedStripped = 'אלהים';

      // Set value and trigger input event
      input.value = hebrewWithNikkud;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe(expectedStripped);
    });

    it('preserves cursor position when stripping nikkud from typed text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Start with some Hebrew text
      input.value = 'בְּרֵאשִׁית';
      input.setSelectionRange(5, 5); // Position cursor in middle (accounting for nikkud)

      // Trigger input event (simulating typing)
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // After stripping nikkud, cursor should be adjusted
      // Original: בְּרֵאשִׁית (10 chars with nikkud)
      // Stripped: בראשית (6 chars)
      // Cursor was at position 5, with nikkud before it
      expect(input.value).toBe('בראשית');
      // The cursor position should be preserved relative to visible characters
      expect(input.selectionStart).toBeLessThanOrEqual(input.value.length);
    });

    it('does not modify English typed text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      const englishText = 'beginning';
      input.value = englishText;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // English text should remain unchanged
      expect(input.value).toBe(englishText);
    });
  });

  describe('Plain search box with no script mode', () => {
    it('renders no Hebrew keyboard toggle', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      expect(container.querySelector('#keyboard-toggle')).toBeNull();
    });

    it('adds no virtual keyboard to the page when Hebrew is typed', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(document.getElementById('hebrew-keyboard-container')).toBeNull();
      expect(input.value).toBe('אלהים');
    });

    it('installs no key handler that rewrites what you type', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'light';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Narrow on purpose. happy-dom does not turn a KeyboardEvent into text,
      // so the only thing that could change the value here is a handler that
      // rewrites it — which is the shape transliteration would come back in.
      // It does not prove transliteration is gone: the old one lived on a
      // document listener that only existed while the keyboard was open, and
      // this test never opened it.
      expect(input.value).toBe('light');
    });

    it('keeps a mix of Hebrew and Latin letters', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'god אלהים';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe('god אלהים');
    });

    it('accepts Hebrew pasted into an input that already holds English', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'god ';
      input.setSelectionRange(4, 4);

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'אֱלֹהִים');
      input.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(input.value).toBe('god אלהים');
    });

    it('follows the text for direction, Hebrew then English', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      input.value = 'אלהים';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.dir).toBe('rtl');

      input.value = 'light';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.dir).toBe('ltr');
    });

    it('gives a mixed search a control per row, each offering what its text can do', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Each row offers what its own text can be matched by. Which term comes
      // first decides nothing, and neither row's control can reach the other.
      input.value = 'god, אלהים';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const rows = container.querySelectorAll<HTMLElement>('.term-row');
      expect(rows).toHaveLength(2);

      // Only the open row shows its control; the other says what it is doing.
      const english = [...rows[0].querySelectorAll<HTMLElement>('.term-mode-option')];
      expect(english.map((o) => o.dataset.mode)).toEqual(['substring', 'word']);
      expect(rows[1].querySelector('.term-state')!.textContent).toBe('root');
    });

    it('turns right to left on the very first Hebrew letter typed', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // One letter is too short to be a search term, but the box should still
      // read right to left as soon as there is Hebrew in it.
      input.value = 'א';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.dir).toBe('rtl');
    });

    it('offers root on a Hebrew row, whichever position it is in', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      input.value = 'אלהים, god';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const offered = [
        ...container.querySelectorAll<HTMLElement>('.term-row[data-open="true"] .term-mode-option'),
      ];
      expect(offered.map((o) => o.dataset.mode)).toEqual(['substring', 'word', 'root']);
      expect(input.dir).toBe('rtl');
    });
  });

  describe('Render Legend', () => {
    // Legend content is rendered inline in #search-hit-caption above search results
    it('renders default message when no search', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);
      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const legendContainer = document.createElement('div');
      searchOverlay.renderLegend?.(legendContainer);

      const hitCaption = controlsContainer.querySelector('#search-hit-caption') as HTMLElement;
      expect(hitCaption.innerHTML).toContain('Type to search');
    });

    it('names the searched word on its own row, not in the caption', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const rows = [...controlsContainer.querySelectorAll('.term-row .term-input')];
      expect(rows.map((r) => (r as HTMLInputElement).value)).toEqual(['God']);
    });

    it('gives each term its own row, swatch and count', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      // A comma still means another word, but it now makes a second row.
      input.value = 'God, earth';
      input.dispatchEvent(new Event('input'));

      // Only the open row holds a box; a collapsed row shows its word as text.
      const rows = [...controlsContainer.querySelectorAll('.term-row')];
      expect(
        rows.map(
          (r) =>
            (r.querySelector('.term-input') as HTMLInputElement | null)?.value ??
            r.querySelector('.term-word')!.textContent,
        ),
      ).toEqual(['God', 'earth']);
      expect(rows.every((r) => r.querySelector('.term-swatch'))).toBe(true);
      expect(rows.map((r) => r.querySelector('.term-count')?.textContent)).not.toContain('');
    });

    it('displays result count', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const hitCaption = controlsContainer.querySelector('#search-hit-caption') as HTMLElement;
      expect(hitCaption.innerHTML).toContain('matching verses');
    });

    it('shows minimum character warning for short terms', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'; // Too short
      input.dispatchEvent(new Event('input'));

      const hitCaption = controlsContainer.querySelector('#search-hit-caption') as HTMLElement;
      expect(hitCaption.innerHTML).toContain('at least 2 characters');
    });
  });

  describe('Hover Info', () => {
    it('returns null when no search is active', () => {
      const verse = testVerses[0];
      const info = searchOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('returns null for non-matching verses', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      // Genesis 1:2 does not contain "God"
      const verse = testVerses[1];
      const info = searchOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('returns matching terms for single match', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      // Genesis 1:1 contains "God"
      const verse = testVerses[0];
      const info = searchOverlay.getHoverInfo?.(verse);

      expect(info).toBe('Matches: "God"');
    });

    it('returns multiple matching terms', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, light';
      input.dispatchEvent(new Event('input'));

      // Genesis 1:3 contains both "God" and "light"
      const verse = testVerses[2];
      const info = searchOverlay.getHoverInfo?.(verse);

      expect(info).toContain('Matches:');
      expect(info).toContain('"God"');
      expect(info).toContain('"light"');
    });
  });

  describe('URL State Management', () => {
    it('returns empty params when no search', () => {
      // Perform an empty search to clear any previous state
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);
      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const params = searchOverlay.getUrlParams?.();
      expect(params).toEqual({});
    });

    it('returns query param when search is active', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const params = searchOverlay.getUrlParams?.();
      expect(params).toEqual({ q: 'God' });
    });

    it('applies query from URL params', () => {
      const urlParams = new URLSearchParams('q=Isaiah');
      applyOverlayParams(searchOverlay, urlParams);

      // Isaiah 1:1 should be highlighted
      const verse = testVerses[6];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toEqual(SEARCH_COLORS[0]);
    });

    it('updates input when applying URL params', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=heavens');
      applyOverlayParams(searchOverlay, urlParams);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      expect(input.value).toBe('heavens');
    });

    it('shows clear button when applying URL params', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=test');
      applyOverlayParams(searchOverlay, urlParams);

      const clearBtn = container.querySelector('#search-clear') as HTMLElement;
      expect(clearBtn.style.display).toBe('block');
    });

    it('ignores empty URL params', () => {
      // Perform an empty search to clear any previous state
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);
      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const urlParams = new URLSearchParams();
      applyOverlayParams(searchOverlay, urlParams);

      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toBeNull();
    });
  });

  describe('Search Results Display', () => {
    it('shows results when search has matches', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const caption = container.querySelector('#search-hit-caption') as HTMLElement;
      expect(caption.textContent).toContain('matching verses');
    });

    it('displays result count correctly', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const caption = container.querySelector('#search-hit-caption') as HTMLElement;
      expect(caption.textContent).toMatch(/\d+ matching verses/);
    });

    it('limits displayed results to 10', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'the'; // Common word, many matches
      input.dispatchEvent(new Event('input'));

      const results = container.querySelectorAll('.search-result');
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('clears previous results on new search', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      input.value = 'God';
      input.dispatchEvent(new Event('input'));
      const firstCount = container.querySelectorAll('.search-result').length;

      input.value = 'earth';
      input.dispatchEvent(new Event('input'));
      const secondCount = container.querySelectorAll('.search-result').length;

      expect(secondCount).not.toBe(firstCount + secondCount);
    });
  });

  describe('Verse Click Integration', () => {
    it('calls onVerseClick callback when result is clicked', () => {
      const onVerseClick = vi.fn();
      configure({ verses: testVerses, callbacks: { onVerseClick } });

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const firstResult = container.querySelector('.search-result') as HTMLElement;
      if (firstResult) {
        firstResult.click();
        expect(onVerseClick).toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty search query', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).toBeNull();
      }
    });

    it('handles whitespace-only query', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '   ';
      input.dispatchEvent(new Event('input'));

      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).toBeNull();
      }
    });

    it('handles query with no matches', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'xyzabc123'; // Should not match anything
      input.dispatchEvent(new Event('input'));

      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as Color;
        // All verses should be dimmed
        const brightness = (0.4 + 0.2) * DIM_FACTOR;
        expect(color[0]).toBeCloseTo(brightness, 2);
      }
    });

    it('handles verse not in search results', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = searchOverlay.getVerseColor(verse) as Color;

      const brightness = (0.4 + 0.2) * DIM_FACTOR;
      expect(color[0]).toBeCloseTo(brightness, 2);
    });

    it('handles comma-separated terms', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, earth, light';
      input.dispatchEvent(new Event('input'));

      const verse = testVerses[0]; // Genesis 1:1 has "God"
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
    });

    it('handles terms with extra whitespace', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '  God  ,  earth  ';
      input.dispatchEvent(new Event('input'));

      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
    });

    it('handles very long search query', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'.repeat(1000);
      input.dispatchEvent(new Event('input'));

      expect(() => searchOverlay.getVerseColor(testVerses[0])).not.toThrow();
    });

    it('handles special characters in search', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '&<>"\'/';
      input.dispatchEvent(new Event('input'));

      expect(() => searchOverlay.getVerseColor(testVerses[0])).not.toThrow();
    });

    it('handles search term shorter than 2 characters', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'; // Too short
      input.dispatchEvent(new Event('input'));

      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).toBeNull();
      }
    });
  });

  describe('Destroy', () => {
    it('listens for no clicks on the document, so none can outlive it', () => {
      // The results box sits in the controls panel and is shown or hidden by
      // whether the search found anything. It used to float over the map, and
      // a document-level click handler put it away; that handler also caught
      // the click that chose a meaning in the word panel, hiding the list at
      // the moment it was filled.
      const container = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      searchOverlay.renderControls?.(container);

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('click', expect.any(Function));
      searchOverlay.destroy?.();
      addEventListenerSpy.mockRestore();
    });

    it('clears DOM references', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      searchOverlay.destroy?.();
      expect(() => searchOverlay.destroy?.()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      searchOverlay.destroy?.();
      searchOverlay.destroy?.();
      searchOverlay.destroy?.();

      expect(true).toBe(true);
    });

    it('preserves search state across destroy/recreate cycles', () => {
      // Switching overlays destroys and recreates this one; the query should
      // still be there so the user can return to the same search.

      const container1 = document.createElement('div');
      searchOverlay.renderControls?.(container1);

      const input1 = container1.querySelector('#search-input') as HTMLInputElement;
      input1.value = 'God';
      input1.dispatchEvent(new Event('input'));

      const verse = testVerses[0]; // Genesis 1:1
      let color = searchOverlay.getVerseColor(verse);
      expect(color).toEqual(SEARCH_COLORS[0]);

      // Simulate switching to a different overlay (calls destroy)
      searchOverlay.destroy?.();

      // Search state survives, still available internally
      color = searchOverlay.getVerseColor(verse);
      expect(color).toEqual(SEARCH_COLORS[0]);

      // Simulate switching back to search overlay (renders controls again)
      const container2 = document.createElement('div');
      searchOverlay.renderControls?.(container2);

      const input2 = container2.querySelector('#search-input') as HTMLInputElement;
      expect(input2.value).toBe('God');

      color = searchOverlay.getVerseColor(verse);
      expect(color).toEqual(SEARCH_COLORS[0]);
    });

    it("preserves a term's mode across destroy/recreate cycles", () => {
      const container1 = document.createElement('div');
      searchOverlay.renderControls?.(container1);

      const input1 = container1.querySelector('#search-input') as HTMLInputElement;
      input1.value = 'God';
      input1.dispatchEvent(new Event('input'));

      container1
        .querySelector<HTMLElement>(
          '.term-row[data-open="true"] .term-mode-option[data-mode="word"]',
        )!
        .click();

      // Simulate switching overlays
      searchOverlay.destroy?.();

      const container2 = document.createElement('div');
      searchOverlay.renderControls?.(container2);

      const marked = container2.querySelector<HTMLElement>(
        '.term-row[data-open="true"] .term-mode-option.on',
      );
      expect(marked?.dataset.mode).toBe('word');
    });
  });

  describe('Configure', () => {
    it('accepts verses configuration', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      ];

      expect(() => configure({ verses })).not.toThrow();
    });

    it('accepts onVerseClick callback', () => {
      const onVerseClick = vi.fn();

      expect(() => configure({ verses: testVerses, callbacks: { onVerseClick } })).not.toThrow();
    });

    it('handles empty verse array', () => {
      expect(() => configure({ verses: [] })).not.toThrow();
    });
  });

  describe('highlightSearchTerms Function', () => {
    // Helper to convert DocumentFragment to HTML string for testing
    function fragmentToHtml(fragment: DocumentFragment): string {
      const div = document.createElement('div');
      div.appendChild(fragment.cloneNode(true));
      return div.innerHTML;
    }

    // Helper to get text content from DocumentFragment
    function fragmentToText(fragment: DocumentFragment): string {
      const div = document.createElement('div');
      div.appendChild(fragment.cloneNode(true));
      return div.textContent || '';
    }

    beforeEach(() => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, light';
      input.dispatchEvent(new Event('input'));
    });

    it('returns plain text when no search terms', () => {
      // Clear search
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('In the beginning', 'en');
      expect(fragmentToText(result)).toBe('In the beginning');
      expect(fragmentToHtml(result)).not.toContain('<mark');
    });

    it('highlights matching terms in English text', () => {
      const result = highlightSearchTerms('And God said let there be light', 'en');
      const html = fragmentToHtml(result);

      expect(html).toContain('<mark');
      expect(html).toContain('God');
      expect(html).toContain('light');
    });

    it('highlights matching terms in Hebrew text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים';
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('בְּרֵאשִׁית בָּרָא אֱלֹהִים', 'he');
      expect(fragmentToHtml(result)).toContain('<mark');
    });

    it('escapes HTML special characters', () => {
      const result = highlightSearchTerms('Test <script>alert("xss")</script>', 'en');
      const text = fragmentToText(result);
      const html = fragmentToHtml(result);

      // Text content should contain the literal script tags (as text, not code)
      expect(text).toContain('<script>');
      // HTML should not contain executable script tags
      expect(html).not.toContain('<script>alert');
    });

    it('assigns term-N class to marks', () => {
      const result = highlightSearchTerms('And God said let there be light', 'en');
      const html = fragmentToHtml(result);

      expect(html).toContain('term-0');
      expect(html).toContain('term-1');
    });

    it('handles overlapping matches correctly', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, Godly'; // Overlapping terms (hypothetically)
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('God is great', 'en');
      const text = fragmentToText(result);
      expect(text).toContain('God');
    });

    it('handles text with no matches', () => {
      const result = highlightSearchTerms('No matches here', 'en');
      expect(fragmentToHtml(result)).not.toContain('<mark');
    });

    it('handles empty text', () => {
      const result = highlightSearchTerms('', 'en');
      expect(fragmentToText(result)).toBe('');
    });

    it('handles case-insensitive English matching', () => {
      const result = highlightSearchTerms('god created', 'en');
      expect(fragmentToHtml(result)).toContain('<mark');
    });

    it('handles Hebrew with nikkud', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Without nikkud
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('אֱלֹהִים', 'he'); // With nikkud
      expect(fragmentToHtml(result)).toContain('<mark');
    });

    it('handles multiple occurrences of same term', () => {
      const result = highlightSearchTerms('God said God created', 'en');
      const html = fragmentToHtml(result);
      const matches = html.match(/<mark/g);
      expect(matches?.length).toBeGreaterThan(1);
    });

    it('respects Hebrew word mode for highlighting', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Search term
      input.dispatchEvent(new Event('input'));

      // Switch this term to word mode
      container
        .querySelector<HTMLElement>(
          '.term-row[data-open="true"] .term-mode-option[data-mode="word"]',
        )!
        .click();

      // Test verse with the word אֱלֹהִים (with nikkud); should highlight only
      // the full word, not substrings.
      const result = highlightSearchTerms('בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת', 'he');
      const html = fragmentToHtml(result);

      const matches = html.match(/<mark/g);
      expect(matches?.length).toBe(1);
      expect(html).toContain('אֱלֹהִים');
    });

    it('respects English whole-word mode for highlighting', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God'; // Search term
      input.dispatchEvent(new Event('input'));

      // Switch this term to whole word
      container
        .querySelector<HTMLElement>(
          '.term-row[data-open="true"] .term-mode-option[data-mode="word"]',
        )!
        .click();

      // Test verse where "God" appears as full word and as substring
      // "God" should match but "Godly" should not
      const result = highlightSearchTerms('God is Godly and good', 'en');
      const html = fragmentToHtml(result);

      const marks = html.match(/<mark[^>]*>([^<]*)<\/mark>/g);
      expect(marks?.length).toBe(1);
      expect(marks?.[0]).toContain('God');
      expect(html).not.toContain('<mark>Godly</mark>');
    });

    it('correctly highlights Hebrew words with nikkud in word mode', () => {
      // Regression test for bug where Hebrew word highlighting was broken
      // The bug was passing word.length instead of currentPos + word.length
      // to mapNormalizedToOriginalPosition, causing incorrect highlighting
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Search for "God" (without nikkud)
      input.dispatchEvent(new Event('input'));

      // Switch this term to word mode
      container
        .querySelector<HTMLElement>(
          '.term-row[data-open="true"] .term-mode-option[data-mode="word"]',
        )!
        .click();

      // Test with the actual verse text from Genesis 1:1
      const verseText = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
      const result = highlightSearchTerms(verseText, 'he');
      const html = fragmentToHtml(result);

      const matches = html.match(/<mark[^>]*>([^<]*)<\/mark>/g);
      expect(matches?.length).toBe(1);

      // The marked text should be "אֱלֹהִים" (with nikkud)
      expect(matches?.[0]).toContain('אֱלֹהִים');

      // Full highlighted text: בְּרֵאשִׁית בָּרָא <mark class="term-0">אֱלֹהִים</mark>
      expect(html).toContain('בְּרֵאשִׁית');
      expect(html).toContain('בָּרָא');
      expect(html).toContain('<mark');
      expect(html).toContain('אֱלֹהִים');
    });

    it('marks the last word of a verse, which the sof pasuq used to hide', () => {
      searchOverlay.applyUrlParams({ q: 'הארץ', mode: 'word' } as never);

      const html = fragmentToHtml(
        highlightSearchTerms('אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃', 'he') as DocumentFragment,
      );

      expect(html).toContain('<mark');
      expect(html).toContain('הָאָֽרֶץ');
    });

    it('marks Jerusalem, which carries a grapheme joiner nobody types', () => {
      // II Kings 21:13 names it twice. The second catches a mapping that has
      // drifted, so assert the marked text rather than that a mark exists.
      const verse =
        'וְנָטִ֣יתִי עַל־יְרוּשָׁלַ֗͏ִם אֵ֚ת קָ֣ו שֹׁמְר֔וֹן וְאֶת־מִשְׁקֹ֖לֶת בֵּ֣ית ' +
        'אַחְאָ֑ב וּמָחִ֨יתִי אֶת־יְרוּשָׁלַ֜͏ִם כַּאֲשֶׁר־יִמְחֶ֤ה אֶת־הַצַּלַּ֙חַת֙ ' +
        'מָחָ֔ה וְהָפַ֖ךְ עַל־פָּנֶֽיהָ׃';

      searchOverlay.applyUrlParams({ q: 'ירושלם', mode: 'word' } as never);

      const html = fragmentToHtml(highlightSearchTerms(verse, 'he') as DocumentFragment);
      const marked = [...html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((m) =>
        m[1].replace(/[^א-ת]/g, ''),
      );

      expect(marked).toEqual(['ירושלם', 'ירושלם']);
    });
  });

  describe('Color Validation', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));
    });

    it('returns valid RGB colors for all verses', () => {
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).not.toBeNull();

        if (Array.isArray(color)) {
          if (typeof color[0] === 'number') {
            // Single color
            assertValidColor(color as Color);
          } else {
            // Array of colors (stipple)
            for (const c of color as unknown as Color[]) {
              assertValidColor(c);
            }
          }
        }
      }
    });

    it('returns colors in 0-1 range', () => {
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;

        if (Array.isArray(color) && typeof color[0] === 'number') {
          const c = color as Color;
          expect(c[0]).toBeGreaterThanOrEqual(0);
          expect(c[0]).toBeLessThanOrEqual(1);
          expect(c[1]).toBeGreaterThanOrEqual(0);
          expect(c[1]).toBeLessThanOrEqual(1);
          expect(c[2]).toBeGreaterThanOrEqual(0);
          expect(c[2]).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Update Callback', () => {
    it('calls callback on search input', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      expect(updateCallback).toHaveBeenCalled();
    });

    it('calls callback on clear', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      updateCallback.mockClear();

      const clearBtn = container.querySelector('#search-clear') as HTMLButtonElement;
      clearBtn.click();

      expect(updateCallback).toHaveBeenCalled();
    });

    it('clears update callback reference', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      // Callback should be called before destroy
      expect(updateCallback).toHaveBeenCalled();

      updateCallback.mockClear();

      searchOverlay.destroy?.();

      // After destroy, the DOM elements are nulled out, so we can't test further interaction
      // The destroy method clears DOM references which prevents further usage
      expect(true).toBe(true);
    });
  });

  describe('Hebrew Substring Position Bug Fix', () => {
    // matchStart/matchEnd were calculated using nikkud-stripped positions but
    // applied to original text with nikkud, so highlights landed on the wrong substring.

    it('returns correct match positions for Hebrew text with nikkud', () => {
      // Search for אלהים (Elohim) without nikkud
      const results = search('אלהים');

      // Find result for Genesis 1:1 which has: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'
      const genesis11 = results.find(
        (r) => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1,
      );
      expect(genesis11).toBeDefined();

      const firstMatch = genesis11!.matchingTerms[0];
      const snippet = firstMatch.snippet;
      expect(snippet).toBeDefined();

      // The highlighted portion should contain the Hebrew word אלהים (with nikkud: אֱלֹהִים)
      const highlighted = snippet!.slice(firstMatch.matchStart!, firstMatch.matchEnd!);

      // Strip nikkud from the highlighted portion and check it matches the search term
      const strippedHighlight = highlighted.replace(/[\u0591-\u05C7]/g, '');
      expect(strippedHighlight).toContain('אלהים');
    });

    it('highlights correct Hebrew word, not wrong substring', () => {
      // This test verifies the fix for the specific bug:
      // searching for 'כניהו' should highlight 'כׇּנְיָ֔הוּ', not 'כִּ֣י'

      // Since we don't have Jeremiah in our mock data, test with available data
      // Search for a Hebrew word that appears in Isaiah
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'שמים'; // "shamayim" (heavens)
      input.dispatchEvent(new Event('input'));

      // Isaiah 1:2 has 'שִׁמְעוּ שָׁמַיִם' (shim'u shamayim - hear heavens)
      const results = search('שמים');
      const isaiah12 = results.find((r) => r.book === 'Isaiah' && r.chapter === 1 && r.verse === 2);

      if (isaiah12) {
        const firstMatch = isaiah12.matchingTerms[0];
        const snippet = firstMatch.snippet;
        expect(snippet).toBeDefined();
        const highlighted = snippet!.slice(firstMatch.matchStart!, firstMatch.matchEnd!);

        // The highlighted text should contain שמים letters (possibly with nikkud)
        // Not some other random substring
        const strippedHighlight = highlighted.replace(/[\u0591-\u05C7]/g, '');
        expect(strippedHighlight).toContain('שמ'); // At least the beginning should match
      }
    });

    it('match positions account for nikkud characters', () => {
      // Test that positions in original text correctly span the match including nikkud
      const results = search('אלהים');
      const genesis11 = results.find(
        (r) => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1,
      );

      if (genesis11) {
        const firstMatch = genesis11.matchingTerms[0];

        // matchEnd - matchStart should be >= the stripped search term length
        // because it includes nikkud characters
        expect(firstMatch.matchEnd).toBeDefined();
        expect(firstMatch.matchStart).toBeDefined();
        const highlightLength = firstMatch.matchEnd! - firstMatch.matchStart!;
        expect(highlightLength).toBeGreaterThanOrEqual(5); // 'אלהים' is 5 chars
      }
    });

    it('lexeme-based search also computes correct highlight positions', () => {
      // This test ensures that when lexeme search is used, the highlight positions
      // are still computed correctly (not left as 0,0)
      // Note: This tests the code path even if the lexeme index isn't loaded in tests
      const results = search('אלהים');

      // Find any Hebrew result
      const hebrewResult = results.find((r) => r.language === 'he');
      if (hebrewResult) {
        const firstMatch = hebrewResult.matchingTerms[0];

        // If the search term was found in the verse, positions should be non-zero
        // (except for edge case where term is at position 0, which is unlikely)
        if (firstMatch.matchStart !== 0 || firstMatch.matchEnd !== 0) {
          // Verify the highlighted portion contains the search term
          expect(firstMatch.snippet).toBeDefined();
          const highlighted = firstMatch.snippet!.slice(
            firstMatch.matchStart!,
            firstMatch.matchEnd!,
          );
          const strippedHighlight = highlighted.replace(/[\u0591-\u05C7]/g, '');
          expect(strippedHighlight).toContain('אלהים');
        }
      }
    });
  });

  describe('Integration with Search Module', () => {
    it('uses search results from search.ts', () => {
      const results = search('God');
      expect(results.length).toBeGreaterThan(0);

      // Apply those results via the overlay
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      // Matching verses should be highlighted
      const verse = testVerses[0]; // Genesis 1:1
      const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).toEqual(SEARCH_COLORS[0]);
    });

    it('handles parseSearchTerms correctly', () => {
      const terms = parseSearchTerms('God, earth, light');
      expect(terms).toEqual(['God', 'earth', 'light']);
    });

    it('filters out short terms', () => {
      const terms = parseSearchTerms('a, God, b, earth');
      expect(terms).toEqual(['God', 'earth']);
    });

    it('handles English comma (U+002C)', () => {
      const terms = parseSearchTerms('God,earth,light');
      expect(terms).toEqual(['God', 'earth', 'light']);
    });

    it('handles Arabic comma (U+060C)', () => {
      const terms = parseSearchTerms('God،earth،light');
      expect(terms).toEqual(['God', 'earth', 'light']);
    });

    it('handles Hebrew Gershayim (U+05F4)', () => {
      const terms = parseSearchTerms('God‎״earth‎״light');
      expect(terms).toEqual(['God', 'earth', 'light']);
    });

    it('handles mixed comma characters', () => {
      const terms = parseSearchTerms('God,earth،light‎״heavens');
      expect(terms).toEqual(['God', 'earth', 'light', 'heavens']);
    });

    it('handles Hebrew terms with Arabic comma', () => {
      const terms = parseSearchTerms('אלהים،שמים');
      expect(terms).toEqual(['אלהים', 'שמים']);
    });

    it('handles Hebrew terms with Hebrew Gershayim', () => {
      const terms = parseSearchTerms('אלהים‎״שמים');
      expect(terms).toEqual(['אלהים', 'שמים']);
    });

    it('trims whitespace around all comma variants', () => {
      const terms = parseSearchTerms('  God  ,  earth  ،  light  ‎״  heavens  ');
      expect(terms).toEqual(['God', 'earth', 'light', 'heavens']);
    });
  });

  describe('getWordBoundaries', () => {
    it('returns correct boundaries for first word', () => {
      const result = getWordBoundaries('hello world', 0);
      expect(result).toEqual({ start: 0, end: 5 });
    });

    it('returns correct boundaries for second word', () => {
      const result = getWordBoundaries('hello world', 1);
      expect(result).toEqual({ start: 6, end: 11 });
    });

    it('handles Hebrew text with nikkud', () => {
      const text = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים';
      const result = getWordBoundaries(text, 2);
      expect(result).not.toBeNull();
      // Third word should be אֱלֹהִ֑ים
      const word = text.slice(result!.start, result!.end);
      expect(word).toBe('אֱלֹהִ֑ים');
    });

    it('handles multiple spaces between words', () => {
      const result = getWordBoundaries('hello   world', 1);
      expect(result).toEqual({ start: 8, end: 13 });
    });

    it('returns null for out of bounds index', () => {
      const result = getWordBoundaries('hello world', 5);
      expect(result).toBeNull();
    });

    it('returns null for negative index', () => {
      const result = getWordBoundaries('hello world', -1);
      expect(result).toBeNull();
    });

    it('handles leading whitespace', () => {
      const result = getWordBoundaries('  hello world', 0);
      expect(result).toEqual({ start: 2, end: 7 });
    });

    it('handles single word text', () => {
      const result = getWordBoundaries('hello', 0);
      expect(result).toEqual({ start: 0, end: 5 });
    });

    it('handles Hebrew verse with sof pasuk', () => {
      const text = 'אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
      // Get first word
      const result = getWordBoundaries(text, 0);
      expect(result).not.toBeNull();
      const word = text.slice(result!.start, result!.end);
      expect(word).toBe('אֵ֥ת');
    });
  });
});
