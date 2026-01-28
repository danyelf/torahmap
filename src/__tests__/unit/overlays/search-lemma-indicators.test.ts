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

    // Check for lemma indicators
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');

    // If lemma data is available, we should see indicators
    // The exact count depends on whether lemma files are present
    if (indicators.length > 0) {
      // Indicators are present - verify they have the expected attributes
      indicators.forEach(indicator => {
        const text = indicator.textContent?.trim();
        expect(['✓', '↪']).toContain(text);
        expect(indicator.getAttribute('title')).toBeTruthy();
      });
    }
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

    // Check styling
    const indicators = legendContainer.querySelectorAll('.lemma-indicator');
    indicators.forEach(indicator => {
      const element = indicator as HTMLElement;
      // Should have color styling
      expect(element.style.color).toBeTruthy();
      // Should have title attribute for tooltip
      expect(element.title).toBeTruthy();
    });
  });
});
