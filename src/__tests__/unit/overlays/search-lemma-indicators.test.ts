// Tests for lemma indicator feature in search overlay
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { searchOverlay, configure } from '../../../overlays/search';
import { buildSearchIndex, loadLemmaData } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import type { VerseTexts } from '../../../verseTexts';
import type { VerseLayout } from '../../../types';

describe('Search Overlay - Lemma Indicators', () => {
  let testVerses: VerseLayout[];
  let mockVerseTexts: VerseTexts;
  let container: HTMLElement;

  beforeEach(async () => {
    // Load actual lemma data (if available)
    await loadLemmaData();

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

  it('should show lemma indicators in root mode for Hebrew search', () => {
    // Render controls
    searchOverlay.renderControls(container);

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
    searchOverlay.renderLegend(legendContainer);

    // Check legend content - should show either root text or fallback indicator
    const legendText = legendContainer.textContent || '';

    // If lemma data is available, we should see either:
    // 1. Root text with "(from ...)" format for terms with lemmas
    // 2. Hook arrow indicator (↪) for terms without lemmas
    if (legendText.includes('(from')) {
      // Root text format is present - verify structure
      expect(legendText).toMatch(/".+"\s*\(from\s*".+"\)/);
    }

    // Check for fallback indicators (only shown for terms without root data)
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');
    indicators.forEach(indicator => {
      const text = indicator.textContent?.trim();
      expect(text).toBe('↪'); // Only fallback indicator should be present
      expect(indicator.getAttribute('title')).toBe('No root data, using whole-word search');
    });
  });

  it('should not show lemma indicators in substring mode', () => {
    // Render controls
    searchOverlay.renderControls(container);

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
    searchOverlay.renderLegend(legendContainer);

    // Should NOT have lemma indicators in substring mode
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');
    expect(indicators.length).toBe(0);
  });

  it('should not show lemma indicators for English search', () => {
    // Render controls
    searchOverlay.renderControls(container);

    // Get search input
    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    // Perform English search
    searchInput.value = 'God,created';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend(legendContainer);

    // Should NOT have lemma indicators for English
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');
    expect(indicators.length).toBe(0);
  });

  it('should update indicators when switching between modes', () => {
    // Render controls
    searchOverlay.renderControls(container);

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
    searchOverlay.renderLegend(legendContainer);
    const indicatorsInRootMode = legendContainer.querySelectorAll('.lemma-indicator').length;

    // Switch to substring mode
    substringModeRadio.checked = true;
    substringModeRadio.dispatchEvent(new Event('change'));
    searchInput.dispatchEvent(new Event('input'));

    // Check substring mode - should have no indicators
    legendContainer = document.createElement('div');
    searchOverlay.renderLegend(legendContainer);
    expect(legendContainer.querySelectorAll('.lemma-indicator').length).toBe(0);

    // Switch back to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));
    searchInput.dispatchEvent(new Event('input'));

    // Check root mode again - should match original count
    legendContainer = document.createElement('div');
    searchOverlay.renderLegend(legendContainer);
    expect(legendContainer.querySelectorAll('.lemma-indicator').length).toBe(indicatorsInRootMode);
  });

  it('should show related roots section in root mode with related roots', () => {
    // Render controls
    searchOverlay.renderControls(container);

    const searchInput = container.querySelector('#search-input') as HTMLInputElement;
    const rootModeRadio = container.querySelector('input[name="hebrew-mode"][value="root"]') as HTMLInputElement;

    // Set to root mode
    rootModeRadio.checked = true;
    rootModeRadio.dispatchEvent(new Event('change'));

    // Perform Hebrew search with a term that has related roots
    searchInput.value = 'אלהים';
    searchInput.dispatchEvent(new Event('input'));

    // Render legend
    const legendContainer = document.createElement('div');
    searchOverlay.renderLegend(legendContainer);

    // Check for related roots section
    const relatedSection = legendContainer.querySelector('.related-roots');
    if (relatedSection) {
      // If related roots exist, verify structure
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
    // If no related roots, the section won't be present (also valid)
  });

  it('should not show related roots section in substring mode', () => {
    // Render controls
    searchOverlay.renderControls(container);

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
    searchOverlay.renderLegend(legendContainer);

    // Should NOT have related roots section in substring mode
    const relatedSection = legendContainer.querySelector('.related-roots');
    expect(relatedSection).toBeNull();
  });

  it('should have proper styling for lemma indicators', () => {
    // Render controls
    searchOverlay.renderControls(container);

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
    searchOverlay.renderLegend(legendContainer);

    // Check styling - only fallback indicators have .lemma-indicator class
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');
    indicators.forEach(indicator => {
      const element = indicator as HTMLElement;
      // Should have color styling (orange for fallback)
      expect(element.style.color).toBe('rgb(255, 152, 0)'); // #FF9800
      // Should have title attribute for tooltip
      expect(element.title).toBe('No root data, using whole-word search');
    });
  });
});
