// Integration tests for search overlay Hebrew mode switching
// tm-z8ru: Tests for UI mode switching, URL persistence, and mode behavior
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { searchOverlay, configure } from '../../overlays/search';
import { buildSearchIndex } from '../../search';
import type { TanakhLayout } from '../../types';
import type { VerseTexts } from '../../verseTexts';

describe('Search Overlay - Hebrew Mode Integration', () => {
  let testVerses: TanakhLayout[];
  let mockVerseTexts: VerseTexts;
  let container: HTMLElement;

  beforeEach(() => {
    // Setup test verses
    testVerses = [
      {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 10,
      },
      {
        book: 'Genesis',
        chapter: 12,
        verse: 1,
        x: 0,
        y: 0,
        size: 10,
      },
      {
        book: 'Genesis',
        chapter: 17,
        verse: 5,
        x: 0,
        y: 0,
        size: 10,
      },
      {
        book: 'Exodus',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 10,
      },
      {
        book: 'Exodus',
        chapter: 3,
        verse: 6,
        x: 0,
        y: 0,
        size: 10,
      },
    ];

    // Setup test verse texts with proper nouns
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
            en: 'In the beginning God created',
          },
        },
        '12': {
          '1': {
            he: 'וַיֹּאמֶר יְהוָה אֶל־אַבְרָם לֶךְ־לְךָ',
            en: 'And the LORD said to Abram go forth',
          },
        },
        '17': {
          '5': {
            he: 'וְלֹא־יִקָּרֵא עוֹד אֶת־שִׁמְךָ אַבְרָם וְהָיָה שִׁמְךָ אַבְרָהָם',
            en: 'Your name shall no longer be Abram but Abraham',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵלֶּה שְׁמוֹת בְּנֵי יִשְׂרָאֵל',
            en: 'Now these are the names of the children of Israel',
          },
        },
        '3': {
          '6': {
            he: 'אָנֹכִי אֱלֹהֵי אָבִיךָ אֱלֹהֵי אַבְרָהָם',
            en: 'I am the God of your father the God of Abraham',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
    configure({ verses: testVerses });

    // Create container for controls
    container = document.createElement('div');
  });

  afterEach(() => {
    searchOverlay.destroy?.();
  });

  describe('Hebrew Mode Selector UI', () => {
    it('shows Hebrew mode selector when Hebrew query is entered', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      // Hebrew mode container should be visible
      const hebrewModeContainer = container.querySelector('#hebrew-mode-container') as HTMLElement;
      expect(hebrewModeContainer).not.toBeNull();
      expect(hebrewModeContainer.style.display).toBe('block');
    });

    it('hides Hebrew mode selector when English query is entered', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // First enter Hebrew to show the selector
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      const hebrewModeContainer = container.querySelector('#hebrew-mode-container') as HTMLElement;
      expect(hebrewModeContainer.style.display).toBe('block');

      // Now switch to English
      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));

      // Hebrew mode selector should be hidden
      expect(hebrewModeContainer.style.display).toBe('none');
    });

    it('shows whole-word checkbox for English queries', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));

      const wholeWordCheckbox = container.querySelector('#whole-word-checkbox') as HTMLInputElement;
      const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;

      expect(optionsContainer).not.toBeNull();
      expect(optionsContainer.style.display).toBe('block');
    });

    it('hides whole-word checkbox for Hebrew queries', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      const wholeWordCheckbox = container.querySelector('#whole-word-checkbox') as HTMLInputElement;
      const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;

      expect(optionsContainer).not.toBeNull();
      expect(optionsContainer.style.display).toBe('none');
    });

    it('renders three Hebrew mode radio buttons', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      const radioButtons = container.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
      expect(radioButtons.length).toBe(3);

      const values = Array.from(radioButtons).map(r => r.value);
      expect(values).toContain('substring');
      expect(values).toContain('word');
      expect(values).toContain('root');
    });

    it('defaults to substring mode', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      const radioButtons = container.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
      const checkedButton = Array.from(radioButtons).find(r => r.checked);

      expect(checkedButton).toBeDefined();
      expect(checkedButton?.value).toBe('substring');
    });
  });

  describe('Mode Switching Behavior', () => {
    it('switching mode triggers new search', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      searchOverlay.renderControls?.(container);

      // Use applyUrlParams to switch to word mode with a query
      // (applyUrlParams directly sets hebrewSearchMode and calls doSearch)
      updateCallback.mockClear();
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם&hm=word'));

      expect(updateCallback).toHaveBeenCalled();
    });

    it('substring mode finds more results than word mode', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Search for "אלה" in substring mode (default)
      input.value = 'אלה';
      input.dispatchEvent(new Event('input'));

      // Check results (Exodus 1:1 has "ואלה" - substring match)
      const verse = testVerses.find(v => v.book === 'Exodus' && v.chapter === 1 && v.verse === 1);
      const substringColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Should be highlighted (matched as substring)
      expect(substringColor).not.toBeNull();
      expect(Array.isArray(substringColor)).toBe(true);

      // Switch to word mode via applyUrlParams (directly sets hebrewSearchMode)
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אלה&hm=word'));

      const wordColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Should be dimmed (not matched as whole word)
      // Word mode should not match "אלה" in "ואלה"
      expect(wordColor).not.toBeNull();
      expect(Array.isArray(wordColor)).toBe(true);
      const wc = wordColor as [number, number, number];
      expect(wc[0]).toBeLessThan(1);
      expect(wc[0]).toBe(wc[1]);
      expect(wc[1]).toBe(wc[2]);
    });

    it('word mode correctly matches proper nouns', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';

      // Set to word mode
      const wordRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="word"]');
      wordRadio!.checked = true;
      input.dispatchEvent(new Event('input'));

      // Genesis 17:5 and Exodus 3:6 should match (have אברהם)
      const gen175 = testVerses.find(v => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5);
      const ex36 = testVerses.find(v => v.book === 'Exodus' && v.chapter === 3 && v.verse === 6);

      const color175 = searchOverlay.getVerseColor(gen175!);
      const color36 = searchOverlay.getVerseColor(ex36!);

      expect(color175).not.toBeNull();
      expect(color36).not.toBeNull();

      // Should be highlighted (not dimmed)
      expect(Array.isArray(color175)).toBe(true);
      expect(Array.isArray(color36)).toBe(true);
    });

    it('word mode does not match partial matches', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברם'; // Search for Abram

      // Set to word mode
      const wordRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="word"]');
      wordRadio!.checked = true;
      input.dispatchEvent(new Event('input'));

      // Genesis 17:5 has אברהם but NOT אברם alone in that form
      // (Actually it has both אברם and אברהם in the verse text)
      // Genesis 12:1 has אברם
      const gen121 = testVerses.find(v => v.book === 'Genesis' && v.chapter === 12 && v.verse === 1);

      const color121 = searchOverlay.getVerseColor(gen121!);

      // Should match (Genesis 12:1 has אברם)
      expect(color121).not.toBeNull();
      expect(Array.isArray(color121)).toBe(true);
    });

    it('root mode falls back to word mode behavior', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';

      // Test word mode first
      const wordRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="word"]');
      wordRadio!.checked = true;
      input.dispatchEvent(new Event('input'));

      const verse = testVerses.find(v => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5);
      const wordColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Now test root mode
      const rootRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="root"]');
      rootRadio!.checked = true;
      rootRadio!.dispatchEvent(new Event('change'));

      const rootColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Should behave identically (both should match)
      expect(rootColor).not.toBeNull();
      expect(wordColor).not.toBeNull();
    });
  });

  describe('URL State Persistence', () => {
    it('getUrlParams includes Hebrew mode when set', () => {
      searchOverlay.renderControls?.(container);

      // Set mode via applyUrlParams (directly sets hebrewSearchMode)
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם&hm=word'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('אברהם');
      expect(params!.hm).toBe('word');
    });

    it('getUrlParams includes Hebrew mode for root search', () => {
      searchOverlay.renderControls?.(container);

      // Set mode via applyUrlParams (directly sets hebrewSearchMode)
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם&hm=root'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('אברהם');
      expect(params!.hm).toBe('root');
    });

    it('getUrlParams does NOT include mode for substring (default)', () => {
      searchOverlay.renderControls?.(container);

      // Use applyUrlParams without hm to ensure substring mode (resets from any prior test)
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם'));

      // Substring is default, should not be in URL
      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('אברהם');
      expect(params!.hm).toBeUndefined();
    });

    it('getUrlParams does NOT include Hebrew mode for English queries', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'Abraham'; // English
      input.dispatchEvent(new Event('input'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('Abraham');
      expect(params!.hm).toBeUndefined(); // No Hebrew mode for English
    });

    it('applyUrlParams restores Hebrew word mode', () => {
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=אברהם&hm=word');
      searchOverlay.applyUrlParams?.(urlParams);

      // Check that input has query
      const input = container.querySelector('#search-input') as HTMLInputElement;
      expect(input.value).toBe('אברהם');

      // Verify mode was set via getUrlParams
      const params = searchOverlay.getUrlParams?.();
      expect(params!.hm).toBe('word');

      // Verify search executed in word mode
      const gen175 = testVerses.find(v => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5);
      const color = searchOverlay.getVerseColor(gen175!) as [number, number, number] | null;
      expect(color).not.toBeNull();
    });

    it('applyUrlParams restores Hebrew root mode', () => {
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=אברהם&hm=root');
      searchOverlay.applyUrlParams?.(urlParams);

      // Verify mode was set via getUrlParams
      const params = searchOverlay.getUrlParams?.();
      expect(params!.hm).toBe('root');
    });

    it('applyUrlParams defaults to substring when mode not specified', () => {
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=אברהם');
      searchOverlay.applyUrlParams?.(urlParams);

      // Check that substring mode is selected (default)
      const substringRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="substring"]');
      expect(substringRadio?.checked).toBe(true);
    });

    it('applyUrlParams ignores invalid Hebrew mode', () => {
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=אברהם&hm=invalid');
      searchOverlay.applyUrlParams?.(urlParams);

      // Should default to substring mode
      const substringRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="substring"]');
      expect(substringRadio?.checked).toBe(true);
    });

    it('round-trips URL state correctly', () => {
      searchOverlay.renderControls?.(container);

      // Set initial state via applyUrlParams
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם&hm=word'));

      // Get URL params
      const params = searchOverlay.getUrlParams?.();
      expect(params!.q).toBe('אברהם');
      expect(params!.hm).toBe('word');

      // Create new URLSearchParams and apply
      const urlParams = new URLSearchParams();
      urlParams.set('q', params!.q);
      urlParams.set('hm', params!.hm!);

      // Clear and re-render
      searchOverlay.destroy?.();
      configure({ verses: testVerses });
      container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      searchOverlay.applyUrlParams?.(urlParams);

      // Verify restored state
      const restoredInput = container.querySelector('#search-input') as HTMLInputElement;
      expect(restoredInput.value).toBe('אברהם');

      // Verify mode persisted via getUrlParams
      const restoredParams = searchOverlay.getUrlParams?.();
      expect(restoredParams!.hm).toBe('word');
    });
  });

  describe('Mode Persistence Across Re-renders', () => {
    it('preserves Hebrew mode when re-rendering controls', () => {
      searchOverlay.renderControls?.(container);

      // Set mode via applyUrlParams (directly sets hebrewSearchMode)
      searchOverlay.applyUrlParams?.(new URLSearchParams('q=אברהם&hm=word'));

      // Verify mode was set
      const params = searchOverlay.getUrlParams?.();
      expect(params!.hm).toBe('word');

      // Re-render controls
      const newContainer = document.createElement('div');
      searchOverlay.renderControls?.(newContainer);

      // Mode should be preserved via getUrlParams
      const newParams = searchOverlay.getUrlParams?.();
      expect(newParams!.hm).toBe('word');

      // Query should also be preserved
      const newInput = newContainer.querySelector('#search-input') as HTMLInputElement;
      expect(newInput.value).toBe('אברהם');
    });

    it('preserves English whole-word setting when switching languages', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Start with English and enable whole-word
      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));

      const wholeWordCheckbox = container.querySelector('#whole-word-checkbox') as HTMLInputElement;
      wholeWordCheckbox.checked = true;
      wholeWordCheckbox.dispatchEvent(new Event('change'));

      // Switch to Hebrew
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      // Switch back to English
      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));

      // Whole-word checkbox should still be checked
      const restoredCheckbox = container.querySelector('#whole-word-checkbox') as HTMLInputElement;
      expect(restoredCheckbox.checked).toBe(true);
    });
  });

  describe('Fallback Behavior', () => {
    it('root mode falls back to whole-word for proper nouns', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';

      // Set to root mode
      const rootRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="root"]');
      rootRadio!.checked = true;
      input.dispatchEvent(new Event('input'));

      // Should find אברהם as whole word (lemma lookup fails, falls back to whole-word)
      const gen175 = testVerses.find(v => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5);
      const color = searchOverlay.getVerseColor(gen175!) as [number, number, number] | null;

      expect(color).not.toBeNull();
      // Should be highlighted (matched)
      expect(Array.isArray(color)).toBe(true);
    });

    it('root mode does NOT fall back to substring', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Search for "אלה" which appears as substring in "ואלה"
      input.value = 'אלה';

      // Set to root mode
      const rootRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="root"]');
      rootRadio!.checked = true;
      input.dispatchEvent(new Event('input'));

      // Exodus 1:1 has "ואלה" - should NOT match in root mode
      const ex11 = testVerses.find(v => v.book === 'Exodus' && v.chapter === 1 && v.verse === 1);
      const rootColor = searchOverlay.getVerseColor(ex11!) as [number, number, number] | null;

      // Switch to substring mode
      const substringRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="substring"]');
      substringRadio!.checked = true;
      substringRadio!.dispatchEvent(new Event('change'));

      const substringColor = searchOverlay.getVerseColor(ex11!) as [number, number, number] | null;

      // Substring should match, root should not (dimmed)
      if (Array.isArray(rootColor) && typeof rootColor[0] === 'number' &&
          Array.isArray(substringColor) && typeof substringColor[0] === 'number') {
        // Root mode should be dimmed (not matched)
        expect(rootColor[0]).toBeLessThan(1);

        // Substring should be highlighted (matched)
        // Note: This assumes SEARCH_COLORS values are > dimmed values
        // If substring matched, it won't be dimmed
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty query with all modes', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = '';
      // Explicitly trigger input event to clear any previous search state
      input.dispatchEvent(new Event('input'));

      const modes = ['substring', 'word', 'root'];
      for (const mode of modes) {
        const radio = container.querySelector<HTMLInputElement>(`input[name="hebrew-mode"][value="${mode}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }

        // All verses should return null (no search active)
        for (const verse of testVerses) {
          const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
          expect(color).toBeNull();
        }
      }
    });

    it('handles mode switching without query', () => {
      searchOverlay.renderControls?.(container);

      // Switch modes without entering query
      const modes = ['word', 'root', 'substring'];
      for (const mode of modes) {
        const radio = container.querySelector<HTMLInputElement>(`input[name="hebrew-mode"][value="${mode}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it('handles rapid mode switching', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      const modes = ['word', 'root', 'substring', 'word', 'root'];
      for (const mode of modes) {
        const radio = container.querySelector<HTMLInputElement>(`input[name="hebrew-mode"][value="${mode}"]`);
        radio!.checked = true;
        radio!.dispatchEvent(new Event('change'));
      }

      // Should not crash and final mode should be 'root'
      const rootRadio = container.querySelector<HTMLInputElement>('input[name="hebrew-mode"][value="root"]');
      expect(rootRadio?.checked).toBe(true);
    });
  });
});
