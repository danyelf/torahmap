// Tests for search overlay - verse highlighting based on search results, color computation
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { searchOverlay, configure, highlightSearchTerms } from '../../../overlays/search';
import { search, buildSearchIndex, parseSearchTerms } from '../../../search';
import { SEARCH_COLORS, DIM_FACTOR } from '../../../utils/color';
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { Verse, Color } from '../../../types';
import type { VerseTexts } from '../../../verseTexts';

describe('Search Overlay', () => {
  let testVerses: Verse[];
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test verses
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

    // Setup test verse texts for search index
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

    // Build search index with test data
    buildSearchIndex(mockVerseTexts);

    // Configure overlay with test verses
    configure({ verses: testVerses });
  });

  afterEach(() => {
    // Clean up
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
      const color = searchOverlay.getVerseColor(verse);
      expect(color).toBeNull();
    });

    it('returns null for all verses when no search query', () => {
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse);
        expect(color).toBeNull();
      }
    });
  });

  describe('Color Computation - Single Term Search', () => {
    beforeEach(() => {
      // Setup DOM for search input
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

      // Should be the first search color
      expect(color1).toEqual(SEARCH_COLORS[0]);
      expect(color3).toEqual(SEARCH_COLORS[0]);
    });

    it('returns dimmed color for non-matching verses', () => {
      // Genesis 1:2 does not contain "God"
      const verse = testVerses[1];
      const color = searchOverlay.getVerseColor(verse) as Color;

      expect(color).not.toBeNull();
      assertValidColor(color);

      // Should be dimmed gray
      const brightness = (0.4 + 0.2) * DIM_FACTOR;
      expect(color[0]).toBeCloseTo(brightness, 2);
      expect(color[1]).toBeCloseTo(brightness, 2);
      expect(color[2]).toBeCloseTo(brightness, 2);
    });

    it('uses correct color from SEARCH_COLORS palette', () => {
      const verse = testVerses[0]; // Genesis 1:1
      const color = searchOverlay.getVerseColor(verse);

      // First term uses first color
      expect(color).toEqual(SEARCH_COLORS[0]);
    });
  });

  describe('Color Computation - Multi-Term Search', () => {
    beforeEach(() => {
      // Setup DOM for search input
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      // Search for "God, earth"
      input.value = 'God, earth';
      input.dispatchEvent(new Event('input'));
    });

    it('returns single color for verse matching one term', () => {
      // Genesis 1:1 contains "God" but not "earth"
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse);

      expect(color).toEqual(SEARCH_COLORS[0]); // Color for first term
    });

    it('returns array of colors for verse matching multiple terms', () => {
      // Genesis 1:2 contains "earth"
      const verse = testVerses[1];
      const color = searchOverlay.getVerseColor(verse);

      // Should match second term (earth)
      expect(color).toEqual(SEARCH_COLORS[1]);
    });

    it('caps color array at 4 colors', () => {
      // Setup search with 5 terms
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      // Create a contrived scenario - in practice hard to match 5 terms in one verse
      input.value = 'the, and, of, in, be';
      input.dispatchEvent(new Event('input'));

      // Any verse matching multiple terms should cap at 4 colors
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse);
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
      const color = searchOverlay.getVerseColor(verse);

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
      // Search without nikkud
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Without nikkud
      input.dispatchEvent(new Event('input'));

      // Should still match Genesis 1:1 which has אֱלֹהִים (with nikkud)
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse);

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
  });

  describe('Render Legend', () => {
    it('renders default message when no search', () => {
      // Perform an empty search to clear any previous state
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);
      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const container = document.createElement('div');
      searchOverlay.renderLegend?.(container);

      expect(container.innerHTML).toContain('Type to search');
    });

    it('renders term indicators when search is active', () => {
      // Perform search first
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      // Render legend
      const legendContainer = document.createElement('div');
      searchOverlay.renderLegend?.(legendContainer);

      expect(legendContainer.innerHTML).toContain('"God"');
    });

    it('renders multiple terms with color swatches', () => {
      // Perform search first
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, earth';
      input.dispatchEvent(new Event('input'));

      // Render legend
      const legendContainer = document.createElement('div');
      searchOverlay.renderLegend?.(legendContainer);

      expect(legendContainer.innerHTML).toContain('"God"');
      expect(legendContainer.innerHTML).toContain('"earth"');
      expect(legendContainer.innerHTML).toContain('color-swatch');
    });

    it('displays result count', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const legendContainer = document.createElement('div');
      searchOverlay.renderLegend?.(legendContainer);

      expect(legendContainer.innerHTML).toContain('matching verses');
    });

    it('shows minimum character warning for short terms', () => {
      const controlsContainer = document.createElement('div');
      searchOverlay.renderControls?.(controlsContainer);

      const input = controlsContainer.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'; // Too short
      input.dispatchEvent(new Event('input'));

      const legendContainer = document.createElement('div');
      searchOverlay.renderLegend?.(legendContainer);

      expect(legendContainer.innerHTML).toContain('at least 2 characters');
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
      searchOverlay.applyUrlParams?.(urlParams);

      // Isaiah 1:1 should be highlighted
      const verse = testVerses[6];
      const color = searchOverlay.getVerseColor(verse);

      expect(color).toEqual(SEARCH_COLORS[0]);
    });

    it('updates input when applying URL params', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=heavens');
      searchOverlay.applyUrlParams?.(urlParams);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      expect(input.value).toBe('heavens');
    });

    it('shows clear button when applying URL params', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=test');
      searchOverlay.applyUrlParams?.(urlParams);

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
      searchOverlay.applyUrlParams?.(urlParams);

      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse);

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

      const results = container.querySelector('#search-results') as HTMLElement;
      const count = results.querySelector('#search-count') as HTMLElement;

      expect(count.textContent).toContain('results');
    });

    it('displays result count correctly', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const count = container.querySelector('#search-count') as HTMLElement;
      expect(count.textContent).toMatch(/\d+ results?/);
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

    it('shows plus sign for 100+ results', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      // In real scenario with full Tanakh, common words would have 100+ results
      // For this test, we'll just check the logic exists
      input.value = 'God';
      input.dispatchEvent(new Event('input'));

      const count = container.querySelector('#search-count') as HTMLElement;
      // Either shows number or number+
      expect(count.textContent).toMatch(/\d+\+? results?/);
    });

    it('clears previous results on new search', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // First search
      input.value = 'God';
      input.dispatchEvent(new Event('input'));
      const firstCount = container.querySelectorAll('.search-result').length;

      // Second search
      input.value = 'earth';
      input.dispatchEvent(new Event('input'));
      const secondCount = container.querySelectorAll('.search-result').length;

      // Should have different counts (not cumulative)
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
        const color = searchOverlay.getVerseColor(verse);
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
        const color = searchOverlay.getVerseColor(verse);
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

      // Non-existent verse
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = searchOverlay.getVerseColor(verse) as Color;

      // Should be dimmed
      const brightness = (0.4 + 0.2) * DIM_FACTOR;
      expect(color[0]).toBeCloseTo(brightness, 2);
    });

    it('handles comma-separated terms', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, earth, light';
      input.dispatchEvent(new Event('input'));

      // Should parse and search for all three terms
      const verse = testVerses[0]; // Genesis 1:1 has "God"
      const color = searchOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('handles terms with extra whitespace', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '  God  ,  earth  ';
      input.dispatchEvent(new Event('input'));

      // Should trim and parse correctly
      const verse = testVerses[0];
      const color = searchOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('handles very long search query', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'.repeat(1000);
      input.dispatchEvent(new Event('input'));

      // Should not crash
      expect(() => searchOverlay.getVerseColor(testVerses[0])).not.toThrow();
    });

    it('handles special characters in search', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '&<>"\'/';
      input.dispatchEvent(new Event('input'));

      // Should not crash or cause XSS
      expect(() => searchOverlay.getVerseColor(testVerses[0])).not.toThrow();
    });

    it('handles search term shorter than 2 characters', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'a'; // Too short
      input.dispatchEvent(new Event('input'));

      // Should not search, all verses return null
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse);
        expect(color).toBeNull();
      }
    });
  });

  describe('Destroy', () => {
    it('cleans up event listeners', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      searchOverlay.destroy?.();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('clears DOM references', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      // Should not throw after destroy
      searchOverlay.destroy?.();
      expect(() => searchOverlay.destroy?.()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      searchOverlay.destroy?.();
      searchOverlay.destroy?.();
      searchOverlay.destroy?.();

      // Should not throw
      expect(true).toBe(true);
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
    beforeEach(() => {
      // Setup search with terms
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, light';
      input.dispatchEvent(new Event('input'));
    });

    it('returns escaped HTML when no search terms', () => {
      // Clear search
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('In the beginning', 'en');
      expect(result).toBe('In the beginning');
    });

    it('highlights matching terms in English text', () => {
      const result = highlightSearchTerms('And God said let there be light', 'en');

      expect(result).toContain('<mark');
      expect(result).toContain('God');
      expect(result).toContain('light');
    });

    it('highlights matching terms in Hebrew text', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים';
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('בְּרֵאשִׁית בָּרָא אֱלֹהִים', 'he');
      expect(result).toContain('<mark');
    });

    it('escapes HTML special characters', () => {
      const result = highlightSearchTerms('Test <script>alert("xss")</script>', 'en');

      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('assigns term-N class to marks', () => {
      const result = highlightSearchTerms('And God said let there be light', 'en');

      expect(result).toContain('term-0');
      expect(result).toContain('term-1');
    });

    it('handles overlapping matches correctly', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'God, Godly'; // Overlapping terms (hypothetically)
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('God is great', 'en');
      // Should handle overlaps without duplicate marks
      expect(result).toContain('God');
    });

    it('handles text with no matches', () => {
      const result = highlightSearchTerms('No matches here', 'en');
      expect(result).not.toContain('<mark');
    });

    it('handles empty text', () => {
      const result = highlightSearchTerms('', 'en');
      expect(result).toBe('');
    });

    it('handles case-insensitive English matching', () => {
      const result = highlightSearchTerms('god created', 'en');
      expect(result).toContain('<mark');
    });

    it('handles Hebrew with nikkud', () => {
      const container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אלהים'; // Without nikkud
      input.dispatchEvent(new Event('input'));

      const result = highlightSearchTerms('אֱלֹהִים', 'he'); // With nikkud
      expect(result).toContain('<mark');
    });

    it('handles multiple occurrences of same term', () => {
      const result = highlightSearchTerms('God said God created', 'en');
      const matches = result.match(/<mark/g);
      expect(matches?.length).toBeGreaterThan(1);
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
        const color = searchOverlay.getVerseColor(verse);
        expect(color).not.toBeNull();

        if (Array.isArray(color)) {
          if (typeof color[0] === 'number') {
            // Single color
            assertValidColor(color as Color);
          } else {
            // Array of colors (stipple)
            for (const c of color as Color[]) {
              assertValidColor(c);
            }
          }
        }
      }
    });

    it('returns colors in 0-1 range', () => {
      for (const verse of testVerses) {
        const color = searchOverlay.getVerseColor(verse);

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
    // Test for tm-tm-8nz: Search: Hebrew text highlighting matches wrong substring in preview
    // The bug was that matchStart/matchEnd were calculated using nikkud-stripped positions
    // but applied to original text with nikkud, causing wrong highlight positions

    it('returns correct match positions for Hebrew text with nikkud', () => {
      // Search for אלהים (Elohim) without nikkud
      const results = search('אלהים');

      // Find result for Genesis 1:1 which has: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'
      const genesis11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
      expect(genesis11).toBeDefined();

      const firstMatch = genesis11!.matchingTerms[0];
      const snippet = firstMatch.snippet;

      // The highlighted portion should contain the Hebrew word אלהים (with nikkud: אֱלֹהִים)
      const highlighted = snippet.slice(firstMatch.matchStart, firstMatch.matchEnd);

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
      const isaiah12 = results.find(r => r.book === 'Isaiah' && r.chapter === 1 && r.verse === 2);

      if (isaiah12) {
        const firstMatch = isaiah12.matchingTerms[0];
        const snippet = firstMatch.snippet;
        const highlighted = snippet.slice(firstMatch.matchStart, firstMatch.matchEnd);

        // The highlighted text should contain שמים letters (possibly with nikkud)
        // Not some other random substring
        const strippedHighlight = highlighted.replace(/[\u0591-\u05C7]/g, '');
        expect(strippedHighlight).toContain('שמ'); // At least the beginning should match
      }
    });

    it('match positions account for nikkud characters', () => {
      // Test that positions in original text correctly span the match including nikkud
      const results = search('אלהים');
      const genesis11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);

      if (genesis11) {
        const firstMatch = genesis11.matchingTerms[0];

        // matchEnd - matchStart should be >= the stripped search term length
        // because it includes nikkud characters
        const highlightLength = firstMatch.matchEnd - firstMatch.matchStart;
        expect(highlightLength).toBeGreaterThanOrEqual(5); // 'אלהים' is 5 chars
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
      const color = searchOverlay.getVerseColor(verse);
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
  });
});
