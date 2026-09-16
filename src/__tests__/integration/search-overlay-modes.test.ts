// How a word is matched, driven through the panel the way a reader drives it.
//
// The mode used to be one setting for the whole search, set by three radios in
// the panel footer. It now belongs to a term and is set on that term's row, so
// these tests click the row rather than the footer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../overlays/index';
import { configure } from '../../overlays/search';
import { buildSearchIndex } from '../../search';
import type { TanakhLayout } from '../../types';
import type { VerseTexts } from '../../verseTexts';
import { applyOverlayParams } from '../helpers/overlayUrlParams';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const searchOverlay = getOverlay('search')!;

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

  /** Which mode the open row is showing as the one in force. */
  const markedMode = () =>
    container.querySelector<HTMLElement>('.term-row[data-open="true"] .term-mode-option.on')
      ?.dataset.mode;

  /** Set the open row's mode the way a reader does: by clicking its control. */
  const chooseMode = (mode: string) =>
    container
      .querySelector<HTMLElement>(
        `.term-row[data-open="true"] .term-mode-option[data-mode="${mode}"]`,
      )!
      .click();

  describe('Mode Switching Behavior', () => {
    it('switching mode triggers new search', () => {
      const updateCallback = vi.fn();
      searchOverlay.onUpdate?.(updateCallback);

      searchOverlay.renderControls?.(container);

      // Use applyUrlParams to switch to word mode with a query
      // (applyUrlParams directly sets hebrewSearchMode and calls doSearch)
      updateCallback.mockClear();
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));

      expect(updateCallback).toHaveBeenCalled();
    });

    it('substring mode finds more results than word mode', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      // Search for "אלה" in substring mode (default)
      input.value = 'אלה';
      input.dispatchEvent(new Event('input'));

      // Check results (Exodus 1:1 has "ואלה" - substring match)
      const verse = testVerses.find((v) => v.book === 'Exodus' && v.chapter === 1 && v.verse === 1);
      const substringColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Should be highlighted (matched as substring)
      expect(substringColor).not.toBeNull();
      expect(Array.isArray(substringColor)).toBe(true);

      // Switch to word mode via applyUrlParams (directly sets hebrewSearchMode)
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אלה&mode=w'));

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
      input.dispatchEvent(new Event('input'));
      chooseMode('word');

      // Genesis 17:5 and Exodus 3:6 should match (have אברהם)
      const gen175 = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5,
      );
      const ex36 = testVerses.find((v) => v.book === 'Exodus' && v.chapter === 3 && v.verse === 6);

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
      input.dispatchEvent(new Event('input'));
      chooseMode('word');

      // Genesis 17:5 has אברהם but NOT אברם alone in that form
      // (Actually it has both אברם and אברהם in the verse text)
      // Genesis 12:1 has אברם
      const gen121 = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 12 && v.verse === 1,
      );

      const color121 = searchOverlay.getVerseColor(gen121!);

      // Should match (Genesis 12:1 has אברם)
      expect(color121).not.toBeNull();
      expect(Array.isArray(color121)).toBe(true);
    });

    it('root mode falls back to word mode behavior', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      // Test word mode first
      chooseMode('word');

      const verse = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5,
      );
      const wordColor = searchOverlay.getVerseColor(verse!) as [number, number, number] | null;

      // Now test root mode
      chooseMode('root');

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
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('אברהם');
      expect(params!.mode).toBe('w');
    });

    it('writes nothing while no term has chosen', () => {
      searchOverlay.renderControls?.(container);

      // A term on its default writes no entry at all, so an ordinary link is
      // unchanged. That is what "default" now means: the absence of a choice,
      // rather than a value that happens to match one.
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('אברהם');
      expect(params!.mode).toBeUndefined();
    });

    it('names a mode the reader did choose, even when it matches the default', () => {
      searchOverlay.renderControls?.(container);

      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=r'));

      expect(searchOverlay.getUrlParams?.().mode).toBe('r');
    });

    it('names substring when that is what was chosen', () => {
      searchOverlay.renderControls?.(container);

      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=s'));

      expect(searchOverlay.getUrlParams?.().mode).toBe('s');
    });

    it('writes nothing for a typed English word nobody has chosen a mode for', () => {
      // Start from a term list nobody has touched. A chosen mode survives an
      // edit by design, so a term left over from an earlier test would arrive
      // already carrying one.
      applyOverlayParams(searchOverlay, new URLSearchParams('q='));
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'Abraham'; // English
      input.dispatchEvent(new Event('input'));

      const params = searchOverlay.getUrlParams?.();

      expect(params).toBeDefined();
      expect(params!.q).toBe('Abraham');
      expect(params!.mode).toBeUndefined(); // Nothing chosen, so nothing written
    });

    it('applyUrlParams restores Hebrew word mode', () => {
      searchOverlay.renderControls?.(container);

      const urlParams = new URLSearchParams('q=אברהם&mode=w');
      applyOverlayParams(searchOverlay, urlParams);

      // Check that input has query
      const input = container.querySelector('#search-input') as HTMLInputElement;
      expect(input.value).toBe('אברהם');

      // Verify mode was set via getUrlParams
      const params = searchOverlay.getUrlParams?.();
      expect(params!.mode).toBe('w');

      // Verify search executed in word mode
      const gen175 = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5,
      );
      const color = searchOverlay.getVerseColor(gen175!) as [number, number, number] | null;
      expect(color).not.toBeNull();
    });

    it('applyUrlParams restores a mode that is not the default', () => {
      searchOverlay.renderControls?.(container);

      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));
      searchOverlay.renderControls?.(container);

      expect(markedMode()).toBe('word');
    });

    it('applyUrlParams falls back to root when no mode is given', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם'));
      searchOverlay.renderControls?.(container);

      // An absent entry means whatever the default currently is, which for
      // Hebrew is root.
      expect(markedMode()).toBe('root');
    });

    it('applyUrlParams leaves a term on its default for an unknown entry', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=zzz'));
      searchOverlay.renderControls?.(container);

      // The entry is dropped rather than the search, so nothing was chosen and
      // nothing is written back.
      expect(searchOverlay.getUrlParams?.().mode).toBeUndefined();
      expect(markedMode()).toBe('root');
    });

    it('round-trips URL state correctly', () => {
      searchOverlay.renderControls?.(container);

      // Set initial state via applyUrlParams
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));

      // Get URL params
      const params = searchOverlay.getUrlParams?.();
      expect(params!.q).toBe('אברהם');
      expect(params!.mode).toBe('w');

      // Create new URLSearchParams and apply
      const urlParams = new URLSearchParams();
      urlParams.set('q', params!.q);
      urlParams.set('mode', params!.mode!);

      // Clear and re-render
      searchOverlay.destroy?.();
      configure({ verses: testVerses });
      container = document.createElement('div');
      searchOverlay.renderControls?.(container);

      applyOverlayParams(searchOverlay, urlParams);

      // Verify restored state
      const restoredInput = container.querySelector('#search-input') as HTMLInputElement;
      expect(restoredInput.value).toBe('אברהם');

      // Verify mode persisted via getUrlParams
      const restoredParams = searchOverlay.getUrlParams?.();
      expect(restoredParams!.mode).toBe('w');
    });
  });

  describe('Mode Persistence Across Re-renders', () => {
    it('preserves Hebrew mode when re-rendering controls', () => {
      searchOverlay.renderControls?.(container);

      // Set mode via applyUrlParams (directly sets hebrewSearchMode)
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));

      // Verify mode was set
      const params = searchOverlay.getUrlParams?.();
      expect(params!.mode).toBe('w');

      // Re-render controls
      const newContainer = document.createElement('div');
      searchOverlay.renderControls?.(newContainer);

      // Mode should be preserved via getUrlParams
      const newParams = searchOverlay.getUrlParams?.();
      expect(newParams!.mode).toBe('w');

      // Query should also be preserved
      const newInput = newContainer.querySelector('#search-input') as HTMLInputElement;
      expect(newInput.value).toBe('אברהם');
    });

    it('keeps a chosen whole word through a trip into Hebrew and back', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q='));
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;

      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));
      chooseMode('word');

      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));

      // Whole word means the same thing in both languages, so the choice
      // survives the round trip rather than being reset by it.
      expect(markedMode()).toBe('word');
    });

    it('takes root back up when the text returns to Hebrew', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q='));
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));
      chooseMode('root');

      // English has no dictionary, so root is held as whole word while the
      // text is English — held, not forgotten.
      input.value = 'Abraham';
      input.dispatchEvent(new Event('input'));
      expect(markedMode()).toBe('word');

      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));
      expect(markedMode()).toBe('root');
    });
  });

  describe('Fallback Behavior', () => {
    it('root mode falls back to whole-word for proper nouns', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));
      chooseMode('root');

      // Should find אברהם as whole word (lexeme lookup fails, falls back to whole-word)
      const gen175 = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5,
      );
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
      input.dispatchEvent(new Event('input'));
      chooseMode('root');

      // Exodus 1:1 has "ואלה" - should NOT match in root mode
      const ex11 = testVerses.find((v) => v.book === 'Exodus' && v.chapter === 1 && v.verse === 1);
      const rootColor = searchOverlay.getVerseColor(ex11!) as [number, number, number] | null;

      // Switch to substring mode
      chooseMode('substring');

      const substringColor = searchOverlay.getVerseColor(ex11!) as [number, number, number] | null;

      // Substring should match, root should not (dimmed)
      if (
        Array.isArray(rootColor) &&
        typeof rootColor[0] === 'number' &&
        Array.isArray(substringColor) &&
        typeof substringColor[0] === 'number'
      ) {
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

      // An empty row offers the English pair, since empty text is not Hebrew.
      for (const mode of ['substring', 'word']) {
        chooseMode(mode);

        // All verses should return null (no search active)
        for (const verse of testVerses) {
          const color = searchOverlay.getVerseColor(verse) as [number, number, number] | null;
          expect(color).toBeNull();
        }
      }
    });

    it('handles mode switching without query', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q='));
      searchOverlay.renderControls?.(container);

      for (const mode of ['word', 'substring', 'word']) {
        chooseMode(mode);
      }

      expect(markedMode()).toBe('word');
    });

    it('handles rapid mode switching', () => {
      searchOverlay.renderControls?.(container);

      const input = container.querySelector('#search-input') as HTMLInputElement;
      input.value = 'אברהם';
      input.dispatchEvent(new Event('input'));

      for (const mode of ['word', 'root', 'substring', 'word', 'root']) {
        chooseMode(mode);
      }

      expect(markedMode()).toBe('root');
    });
  });

  describe('the mode control lives on the row', () => {
    const openRow = () => container.querySelector<HTMLElement>('.term-row[data-open="true"]')!;
    const rowFor = (i: number) => container.querySelectorAll<HTMLElement>('.term-row')[i];

    it('offers three modes to a Hebrew row and two to an English one', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה'));
      searchOverlay.renderControls?.(container);
      const hebrew = [...openRow().querySelectorAll<HTMLElement>('.term-mode-option')];
      expect(hebrew.map((b) => b.dataset.mode)).toEqual(['substring', 'word', 'root']);

      applyOverlayParams(searchOverlay, new URLSearchParams('q=light'));
      searchOverlay.renderControls?.(container);
      const english = [...openRow().querySelectorAll<HTMLElement>('.term-mode-option')];
      expect(english.map((b) => b.dataset.mode)).toEqual(['substring', 'word']);
    });

    it('marks the mode the term is actually in', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה&mode=w'));
      searchOverlay.renderControls?.(container);
      expect(openRow().querySelector<HTMLElement>('.term-mode-option.on')!.dataset.mode).toBe(
        'word',
      );
    });

    it('changes only its own term when clicked', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור'));
      searchOverlay.renderControls?.(container);

      openRow().querySelector<HTMLElement>('.term-mode-option[data-mode="word"]')!.click();

      // The second term chose nothing, so it keeps an empty entry.
      expect(searchOverlay.getUrlParams?.().mode).toBe('w,');
    });

    it('has no footer controls left', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה'));
      searchOverlay.renderControls?.(container);
      expect(container.querySelector('#hebrew-mode-container')).toBeNull();
      expect(container.querySelector('#whole-word-checkbox')).toBeNull();
    });

    it('opens the first row and collapses the rest', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור,light'));
      searchOverlay.renderControls?.(container);

      expect(container.querySelectorAll('.term-row[data-open="true"]')).toHaveLength(1);
      expect(rowFor(0).dataset.open).toBe('true');
    });

    it('opens the row you click and collapses the one that was open', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור'));
      searchOverlay.renderControls?.(container);

      rowFor(1).querySelector<HTMLElement>('.term-summary')!.click();

      expect(rowFor(0).dataset.open).toBe('false');
      expect(rowFor(1).dataset.open).toBe('true');
      expect(container.querySelectorAll('.term-row[data-open="true"]')).toHaveLength(1);
    });

    it('names the mode, and the narrowing when there is one', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור&mode=,w'));
      searchOverlay.renderControls?.(container);

      expect(rowFor(1).querySelector('.term-state')!.textContent).toBe('word');
    });

    it('removes a collapsed word without opening its row first', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור'));
      searchOverlay.renderControls?.(container);

      rowFor(1).querySelector<HTMLElement>('.term-remove')!.click();

      expect(container.querySelectorAll('.term-row')).toHaveLength(1);
      expect(rowFor(0).dataset.open).toBe('true');
    });
  });

  // Opening a row is the reader asking about that word, so the list answers
  // for it rather than for the union of every word.
  describe('the list follows the open row', () => {
    const refs = () =>
      [...container.querySelectorAll<HTMLElement>('.search-result .ref')].map((r) =>
        r.textContent?.trim(),
      );
    const dotsOn = (i: number) =>
      container.querySelectorAll(`.search-result:nth-child(${i + 1}) .term-dot`).length;

    it('lists only the verses the open row accounts for', () => {
      // אברהם is in Genesis 17:5 and Exodus 3:6; אברם is in Genesis 12:1 and
      // Genesis 17:5. Together they cover three verses.
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם,אברם&mode=w,w'));
      searchOverlay.renderControls?.(container);

      expect(refs()).toEqual(['Genesis 17:5', 'Exodus 3:6']);

      container
        .querySelectorAll<HTMLElement>('.term-row')[1]
        .querySelector<HTMLElement>('.term-summary')!
        .click();

      // Sorted, because a result keeps the position it was first claimed at:
      // Genesis 17:5 was claimed by אברהם before אברם reached it.
      expect(refs().sort()).toEqual(['Genesis 12:1', 'Genesis 17:5']);
    });

    it('keeps every dot on a verse two words both landed on', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם,אברם&mode=w,w'));
      searchOverlay.renderControls?.(container);

      // Genesis 17:5 holds both names, so it carries both colours even though
      // the list is narrowed to one of them.
      expect(refs()[0]).toBe('Genesis 17:5');
      expect(dotsOn(0)).toBe(2);
      expect(dotsOn(1)).toBe(1);
    });

    it('counts the listed verses and the union, in that order', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם,אברם&mode=w,w'));
      searchOverlay.renderControls?.(container);

      const caption = container.querySelector('#search-hit-caption')!;
      expect(caption.textContent).toBe('2 of 3 matching verses');
    });

    it('says the number once when one word accounts for everything', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם&mode=w'));
      searchOverlay.renderControls?.(container);

      expect(container.querySelector('#search-hit-caption')!.textContent).toBe('2 matching verses');
    });

    it('narrows nothing while the open row has nothing to search on', () => {
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם,אברם&mode=w,w'));
      searchOverlay.renderControls?.(container);

      // Adding a word opens an empty row. The list must not empty itself at
      // the moment the reader reaches for another word.
      container.querySelector<HTMLButtonElement>('#add-term')!.click();

      expect(refs()).toHaveLength(3);
    });
  });

  // The comparison the map exists for is two words on one substrate, and the
  // interesting comparisons are often not like-for-like.
  describe('two terms, two modes', () => {
    it('carries a different mode for each term', () => {
      searchOverlay.renderControls?.(container);
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור&mode=r,w'));

      const params = searchOverlay.getUrlParams?.();
      expect(params!.q).toBe('עלה, אור');
      expect(params!.mode).toBe('r,w');
    });

    it('leaves one term alone when another term changes mode', () => {
      searchOverlay.renderControls?.(container);
      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור&mode=r,w'));

      applyOverlayParams(searchOverlay, new URLSearchParams('q=עלה,אור&mode=r,s'));

      // The first term is still root; only the second moved.
      expect(searchOverlay.getUrlParams?.().mode).toBe('r,s');
    });

    it('matches a Hebrew term and an English term by their own rules at once', () => {
      searchOverlay.renderControls?.(container);
      // Hebrew by root, English as an exact word. Neither setting could reach
      // the other term even if it wanted to.
      applyOverlayParams(searchOverlay, new URLSearchParams('q=אברהם,Abraham&mode=r,w'));

      const params = searchOverlay.getUrlParams?.();
      expect(params!.mode).toBe('r,w');

      const verse = testVerses.find(
        (v) => v.book === 'Genesis' && v.chapter === 17 && v.verse === 5,
      );
      expect(searchOverlay.getVerseColor(verse!)).not.toBeNull();
    });
  });
});
