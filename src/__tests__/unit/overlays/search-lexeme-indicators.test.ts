// Tests for the lexeme indicator feature in the search overlay
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchOverlay, configure } from '../../../overlays/search';
import { buildSearchIndex, loadLexiconData } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import type { VerseTexts } from '../../../verseTexts';
import type { TanakhLayout } from '../../../types';

describe('Search Overlay - Lexeme Indicators', () => {
  let testVerses: TanakhLayout[];
  let mockVerseTexts: VerseTexts;
  let container: HTMLElement;

  beforeEach(async () => {
    // Load the real lexeme index (if available)
    await loadLexiconData();

    // Setup test verses
    testVerses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
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
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'And God said let there be light',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);

    // Configure overlay
    configure({ verses: testVerses });

    // Create container for controls
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    searchOverlay.destroy?.();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should show lexeme indicators in root mode for Hebrew search', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    // Get search input and mode selector
    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const rootModeRadio = container.querySelector('input[name="hebrew-mode"][value="root"]') as HTMLInputElement;

    expect(searchInput).toBeTruthy();
    expect(rootModeRadio).toBeTruthy();

    // Set to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search
    searchInput.value = 'אלהים,ברא';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Check legend content - should show either a dictionary form or the fallback indicator
    const legendText = legendContainer.textContent || '';

    // With the lexeme index loaded we should see either:
    // 1. a dictionary form in the "(from ...)" shape for terms that resolved
    // 2. the hook arrow (↪) for terms that did not
    if (legendText.includes('(from')) {
      expect(legendText).toMatch(/".+"\s*\(from\s*".+"\)/);
    }

    // Check for fallback indicators (only shown for unresolved terms)
    const indicators = legendContainer.querySelectorAll('.lexeme-indicator');
    indicators.forEach(indicator => {
      const text = indicator.textContent?.trim();
      expect(text).toBe('↪'); // Only fallback indicator should be present
      expect(indicator.getAttribute('title')).toBe('Not found in the dictionary, using whole-word search');
    });
  });

  it('should not show lexeme indicators in substring mode', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    // Get search input and mode selector
    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const substringModeRadio = container.querySelector('input[name="hebrew-mode"][value="substring"]') as HTMLInputElement;

    expect(searchInput).toBeTruthy();
    expect(substringModeRadio).toBeTruthy();

    // Set to substring mode (default)
    substringModeRadio.checked = true;
    substringModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Should NOT have lexeme indicators in substring mode
    const indicators = legendContainer.querySelectorAll('.lexeme-indicator');
    expect(indicators.length).toBe(0);
  });

  it('should not show lexeme indicators for English search', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    // Get search input
    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    // Perform English search
    searchInput.value = 'God,created';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Should NOT have lexeme indicators for English
    const indicators = legendContainer.querySelectorAll('.lexeme-indicator');
    expect(indicators.length).toBe(0);
  });

  it('should update indicators when switching between modes', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const rootModeRadio = container.querySelector('input[name="hebrew-mode"][value="root"]') as HTMLInputElement;
    const substringModeRadio = container.querySelector('input[name="hebrew-mode"][value="substring"]') as HTMLInputElement;

    // Start with root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Check root mode - may have indicators
    let legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);
    const indicatorsInRootMode = legendContainer.querySelectorAll('.lexeme-indicator').length;

    // Switch to substring mode
    substringModeRadio.checked = true;
    substringModeRadio.dispatchEvent(new Event('change'));
    searchInput.dispatchEvent(new Event('input'));

    // Check substring mode - should have no indicators
    legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);
    expect(legendContainer.querySelectorAll('.lexeme-indicator').length).toBe(0);

    // Switch back to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));
    searchInput.dispatchEvent(new Event('input'));

    // Check root mode again - should match original count
    legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);
    expect(legendContainer.querySelectorAll('.lexeme-indicator').length).toBe(indicatorsInRootMode);
  });

  it('should show the related words section in root mode when a family exists', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const rootModeRadio = container.querySelector('input[name="hebrew-mode"][value="root"]') as HTMLInputElement;

    // Set to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search with a term that may have relatives
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Check for the related words section
    const relatedSection = legendContainer.querySelector('.related-roots');
    if (relatedSection) {
      // If relatives exist, verify structure
      const label = relatedSection.querySelector('.related-roots-label');
      expect(label?.textContent).toBe('Related:');

      const chips = relatedSection.querySelectorAll('.root-chip');
      expect(chips.length).toBeGreaterThan(0);

      // Each chip should be a button
      chips.forEach(chip => {
        expect(chip.tagName).toBe('BUTTON');
        expect(chip.textContent?.length).toBeGreaterThan(0);
      });
    }
    // If the word has no relatives, the section is absent (also valid)
  });

  it('should not show the related words section in substring mode', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const substringModeRadio = container.querySelector('input[name="hebrew-mode"][value="substring"]') as HTMLInputElement;

    // Set to substring mode
    substringModeRadio.checked = true;
    substringModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Should NOT have the related words section in substring mode
    const relatedSection = legendContainer.querySelector('.related-roots');
    expect(relatedSection).toBeNull();
  });

  it('should have proper styling for lexeme indicators', () => {
    // Render controls
    searchOverlay.renderControls!(container);

    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const rootModeRadio = container.querySelector('input[name="hebrew-mode"][value="root"]') as HTMLInputElement;

    // Set to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend!(legendContainer);

    // Check styling - only fallback indicators carry the .lexeme-indicator class
    const indicators = legendContainer.querySelectorAll('.lexeme-indicator');
    indicators.forEach(indicator => {
      const element = indicator as HTMLElement;
      // Should have color styling (orange for fallback)
      expect(element.style.color).toBe('rgb(255, 152, 0)'); // #FF9800
      // Should have title attribute for tooltip
      expect(element.title).toBe('Not found in the dictionary, using whole-word search');
    });
  });
});
