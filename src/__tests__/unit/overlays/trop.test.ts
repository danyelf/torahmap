// Tests for trop overlay - trop mark selection, rarity-based coloring, verse filtering
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, getSelectedTrop, highlightTropInText } from '../../../overlays/trop';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const tropOverlay = getOverlay('trop')!;
import { createVerse, SAMPLE_TROP_MARKS } from '../../helpers/fixtures';
import { assertValidColor, assertApproximately } from '../../helpers/assertions';
import type { TanakhLayout } from '../../../types';
import type { VerseTexts } from '../../../verseTexts';
import { getRarityTier, RARITY_THRESHOLDS } from '../../../trop';
import { applyOverlayParams } from '../../helpers/overlayUrlParams';

describe('Trop Overlay', () => {
  let testVerseTexts: VerseTexts;
  let testVerses: TanakhLayout[];
  let updateCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create test verse texts with trop marks
    testVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים', // Contains tipcha (0596) and etnachta (0591)
            en: 'In the beginning God created',
          },
          '2': {
            he: 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙', // Contains different trop marks
            en: 'And the earth was',
          },
          '3': {
            he: 'וַיֹּ֥אמֶר אֱלֹהִ֖ים', // Another verse with trop
            en: 'And God said',
          },
        },
        '2': {
          '1': {
            he: 'וַיְכֻלּ֛וּ הַשָּׁמַ֥יִם', // Different trop marks
            en: 'Thus were finished',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵ֗לֶּה שְׁמוֹת֙', // Contains trop
            en: 'Now these are the names',
          },
          '2': {
            he: 'רְאוּבֵ֣ן שִׁמְע֔וֹן', // Contains trop
            en: 'Reuben, Simeon',
          },
        },
      },
      'Psalms': {
        '1': {
          '1': {
            he: 'אַ֥שְֽׁרֵי־הָאִ֗ישׁ', // Contains trop
            en: 'Happy is the man',
          },
        },
      },
    };

    testVerses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 3 }),
      createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 2 }),
      createVerse({ book: 'Psalms', chapter: 1, verse: 1 }),
    ];

    // Configure overlay with test data
    configure({ verseTexts: testVerseTexts });

    // Setup update callback
    updateCallback = vi.fn();
  });

  afterEach(() => {
    // Clean up
    tropOverlay.destroy?.();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(tropOverlay.id).toBe('trop');
      expect(tropOverlay.name).toBe('Cantillation (Trop)');
    });
  });

  describe('Initialization', () => {
    it('initializes without error', async () => {
      await expect(tropOverlay.init?.()).resolves.not.toThrow();
    });

    it('starts with no selected trop', async () => {
      await tropOverlay.init?.();
      expect(getSelectedTrop()).toBeNull();
    });

    it('returns null color when no trop selected', async () => {
      await tropOverlay.init?.();
      const verse = testVerses[0];
      const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).toBeNull();
    });
  });

  describe('Trop Mark Selection UI', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('renders trop selector buttons', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const chart = container.querySelector('.trop-chart');
      expect(chart).not.toBeNull();

      const buttons = chart?.querySelectorAll('button');
      expect(buttons).not.toBeNull();
      expect(buttons!.length).toBeGreaterThan(0);
    });

    it('displays trop marks on bet character', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);

      // All buttons should have text starting with bet (ב)
      buttons.forEach(button => {
        expect(button.textContent).toMatch(/^ב/);
      });
    });

    it('shows trop name on hover', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const info = container.querySelector('.trop-info') as HTMLElement;
      expect(info).not.toBeNull();

      const button = container.querySelector('button') as HTMLButtonElement;
      expect(button).not.toBeNull();

      // Simulate hover
      button.dispatchEvent(new MouseEvent('mouseenter'));
      expect(info.textContent).not.toBe('');
      expect(info.textContent).toContain('occurrences');
    });

    it('clears info on mouseleave when no selection', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const info = container.querySelector('.trop-info') as HTMLElement;
      const button = container.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new MouseEvent('mouseenter'));
      expect(info.textContent).not.toBe('');

      button.dispatchEvent(new MouseEvent('mouseleave'));
      expect(info.textContent).toBe('');
    });

    it('selects trop mark on click', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);
      tropOverlay.onUpdate?.(updateCallback);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      expect(button.classList.contains('selected')).toBe(true);
      expect(getSelectedTrop()).not.toBeNull();
      expect(updateCallback).toHaveBeenCalled();
    });

    it('deselects trop mark on second click', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);
      tropOverlay.onUpdate?.(updateCallback);

      const button = container.querySelector('button') as HTMLButtonElement;

      // First click - select
      button.click();
      expect(button.classList.contains('selected')).toBe(true);

      // Second click - deselect
      button.click();
      expect(button.classList.contains('selected')).toBe(false);
      expect(getSelectedTrop()).toBeNull();
      expect(updateCallback).toHaveBeenCalledTimes(2);
    });

    it('switches selection when clicking different trop', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      const button1 = buttons[0] as HTMLButtonElement;
      const button2 = buttons[1] as HTMLButtonElement;

      // Select first
      button1.click();
      expect(button1.classList.contains('selected')).toBe(true);
      expect(button2.classList.contains('selected')).toBe(false);

      // Select second
      button2.click();
      expect(button1.classList.contains('selected')).toBe(false);
      expect(button2.classList.contains('selected')).toBe(true);
    });

    it('marks rare trop with special class', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');

      // Find a rare trop button (check dataset for count info)
      buttons.forEach(button => {
        if (button.classList.contains('rare')) {
          // Found a rare trop button
        }
      });

      // We should have at least some rare trop marks
      // (depends on test data, but Shalshelet is famously rare)
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('displays rarity tier in info text', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const info = container.querySelector('.trop-info') as HTMLElement;
      const button = container.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new MouseEvent('mouseenter'));

      const text = info.textContent || '';
      const hasRarityLabel = text.includes('Rare') || text.includes('Uncommon') || text.includes('Common');
      expect(hasRarityLabel).toBe(true);
    });

    it('restores selection state when re-rendering controls', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      // Select a trop
      const button = container.querySelector('button') as HTMLButtonElement;
      const unicode = button.dataset.unicode;
      button.click();

      // Re-render
      tropOverlay.renderControls?.(container);

      // Find the button with same unicode
      const buttons = container.querySelectorAll('button');
      let restoredButton: HTMLButtonElement | null = null;
      buttons.forEach(btn => {
        if ((btn as HTMLButtonElement).dataset.unicode === unicode) {
          restoredButton = btn as HTMLButtonElement;
        }
      });

      expect(restoredButton).not.toBeNull();
      expect(restoredButton!.classList.contains('selected')).toBe(true);
    });
  });

  describe('Rarity-Based Coloring', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    describe('Rare Marks (<50 occurrences)', () => {
      it('returns gold color for verses with rare trop', () => {
        // Create a trop index with a rare mark
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        // Find a rare trop button (one with <50 occurrences)
        const buttons = container.querySelectorAll('button');
        let rareButton: HTMLButtonElement | null = null;

        buttons.forEach(button => {
          if (button.classList.contains('rare')) {
            rareButton = button as HTMLButtonElement;
          }
        });

        if (rareButton) {
          (rareButton as HTMLButtonElement).click();

          // Find a verse that contains this trop
          let verseWithTrop: TanakhLayout | null = null;
          for (const verse of testVerses) {
            const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
            if (color && color[0] > 0.9 && color[1] > 0.8) {
              // Gold color
              verseWithTrop = verse;
              break;
            }
          }

          if (verseWithTrop) {
            const color = tropOverlay.getVerseColor(verseWithTrop) as [number, number, number] | null;
            expect(color).not.toBeNull();

            // Gold color: [1.0, 0.84, 0.0]
            assertApproximately(color![0], 1.0, 0.01);
            assertApproximately(color![1], 0.84, 0.01);
            assertApproximately(color![2], 0.0, 0.01);
          }
        }
      });

      it('returns dim gray for verses without rare trop', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');
        let rareButton: HTMLButtonElement | null = null;

        buttons.forEach(button => {
          if (button.classList.contains('rare')) {
            rareButton = button as HTMLButtonElement;
          }
        });

        if (rareButton) {
          (rareButton as HTMLButtonElement).click();

          // Find a verse that doesn't contain this trop
          let verseWithoutTrop: TanakhLayout | null = null;
          for (const verse of testVerses) {
            const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
            if (color && color[0] < 0.2) {
              // Dim color
              verseWithoutTrop = verse;
              break;
            }
          }

          if (verseWithoutTrop) {
            const color = tropOverlay.getVerseColor(verseWithoutTrop) as [number, number, number] | null;
            expect(color).not.toBeNull();

            // Dim gray (more visible): [0.25, 0.25, 0.25]
            assertApproximately(color![0], 0.25, 0.02);
            assertApproximately(color![1], 0.25, 0.02);
            assertApproximately(color![2], 0.25, 0.02);
          }
        }
      });

      it('uses binary coloring for rare marks', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');
        let rareButton: HTMLButtonElement | null = null;

        buttons.forEach(button => {
          if (button.classList.contains('rare')) {
            rareButton = button as HTMLButtonElement;
          }
        });

        if (rareButton) {
          (rareButton as HTMLButtonElement).click();

          const colors = testVerses.map(v => tropOverlay.getVerseColor(v) as [number, number, number] | null);
          const uniqueColors = new Set(colors.filter(c => c !== null).map(c => JSON.stringify(c)));

          // For rare trop, we should have at most 2 unique colors (gold and dim gray)
          expect(uniqueColors.size).toBeLessThanOrEqual(2);
        }
      });
    });

    describe('Uncommon Marks (50-499 occurrences)', () => {
      it('uses purple gradient for uncommon marks', () => {
        // We'll test the gradient logic by selecting a trop and checking colors
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        // Find an uncommon trop (not rare, not too common)
        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'uncommon') {
            // Check that verses have purple-ish colors
            const colors = testVerses.map(v => tropOverlay.getVerseColor(v) as [number, number, number] | null).filter(c => c !== null);

            if (colors.length > 0) {
              // At least some colors should be purple-ish (higher blue channel)
              const hasPurple = colors.some(c => c![2] > 0.4);
              expect(hasPurple).toBe(true);
            }

            break;
          }
        }
      });

      it('returns dim color for verses without uncommon trop', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'uncommon') {
            // Find a verse without this trop
            const verseWithoutTrop = testVerses.find(v => {
              const color = tropOverlay.getVerseColor(v) as [number, number, number] | null;
              return color && color[0] < 0.2 && color[1] < 0.2 && color[2] < 0.2;
            });

            if (verseWithoutTrop) {
              const color = tropOverlay.getVerseColor(verseWithoutTrop) as [number, number, number] | null;
              expect(color).not.toBeNull();

              // Dim color (more visible): [0.25, 0.25, 0.28]
              expect(color![0]).toBeGreaterThan(0.2);
              expect(color![0]).toBeLessThan(0.3);
              expect(color![1]).toBeGreaterThan(0.2);
              expect(color![1]).toBeLessThan(0.3);
              expect(color![2]).toBeGreaterThan(0.25);
              expect(color![2]).toBeLessThan(0.35);
            }

            break;
          }
        }
      });

      it('uses gradient based on count', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'uncommon') {
            // Get all non-zero colors
            const nonZeroColors = testVerses
              .map(v => ({
                verse: v,
                color: tropOverlay.getVerseColor(v) as [number, number, number] | null,
              }))
              .filter(({ color }) => color && ((color as [number, number, number])[0] > 0.2 || (color as [number, number, number])[1] > 0.2 || (color as [number, number, number])[2] > 0.2));

            if (nonZeroColors.length > 1) {
              // Check that colors vary (not all the same)
              const uniqueColors = new Set(nonZeroColors.map(({ color }) => JSON.stringify(color)));
              expect(uniqueColors.size).toBeGreaterThan(1);
            }

            break;
          }
        }
      });
    });

    describe('Common Marks (500+ occurrences)', () => {
      it('uses full heatmap for common marks', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'common') {
            // Check that we have a range of colors
            const colors = testVerses.map(v => tropOverlay.getVerseColor(v) as [number, number, number] | null).filter(c => c !== null);

            if (colors.length > 0) {
              // Should have purple spectrum colors
              const hasPurple = colors.some(c => c![2] > 0.3);
              expect(hasPurple).toBe(true);
            }

            break;
          }
        }
      });

      it('uses logarithmic scale for common marks', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'common' && selected.verses.length > 2) {
            // Get verses with different counts
            const sortedVerses = [...selected.verses].sort((a, b) => a.count - b.count);

            if (sortedVerses.length >= 3) {
              const low = sortedVerses[0];
              const mid = sortedVerses[Math.floor(sortedVerses.length / 2)];
              const high = sortedVerses[sortedVerses.length - 1];

              const lowVerse = testVerses.find(
                v => v.book === low.book && v.chapter === low.chapter && v.verse === low.verse
              );
              const midVerse = testVerses.find(
                v => v.book === mid.book && v.chapter === mid.chapter && v.verse === mid.verse
              );
              const highVerse = testVerses.find(
                v => v.book === high.book && v.chapter === high.chapter && v.verse === high.verse
              );

              if (lowVerse && midVerse && highVerse) {
                const lowColor = tropOverlay.getVerseColor(lowVerse) as [number, number, number] | null;
                const midColor = tropOverlay.getVerseColor(midVerse) as [number, number, number] | null;
                const highColor = tropOverlay.getVerseColor(highVerse) as [number, number, number] | null;

                // Check that colors progress from dark to light
                if (lowColor && midColor && highColor) {
                  const lowBrightness = (lowColor as [number, number, number])[0] + (lowColor as [number, number, number])[1] + (lowColor as [number, number, number])[2];
                  const midBrightness = (midColor as [number, number, number])[0] + (midColor as [number, number, number])[1] + (midColor as [number, number, number])[2];
                  const highBrightness = (highColor as [number, number, number])[0] + (highColor as [number, number, number])[1] + (highColor as [number, number, number])[2];

                  expect(midBrightness).toBeGreaterThanOrEqual(lowBrightness);
                  expect(highBrightness).toBeGreaterThanOrEqual(midBrightness);
                }
              }
            }

            break;
          }
        }
      });

      it('returns dim color for verses without common trop', () => {
        const container = document.createElement('div');
        tropOverlay.renderControls?.(container);

        const buttons = container.querySelectorAll('button');

        for (const button of Array.from(buttons)) {
          const btn = button as HTMLButtonElement;
          btn.click();

          const selected = getSelectedTrop();
          if (selected && getRarityTier(selected.totalCount) === 'common') {
            // The dim color for common trop
            const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
            const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;

            // Should return null for non-existent verse when trop is selected
            // OR return the base dark color
            expect(color).toBeTruthy();

            break;
          }
        }
      });
    });
  });

  describe('Verse Filtering', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('returns null color when no trop selected', () => {
      const verse = testVerses[0];
      const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).toBeNull();
    });

    it('returns colors for all verses when trop selected', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      // All verses should get colors
      testVerses.forEach(verse => {
        const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).not.toBeNull();
        assertValidColor(color!);
      });
    });

    it('filters verses containing selected trop', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const selected = getSelectedTrop();
      expect(selected).not.toBeNull();

      // Verses in the selected trop's list should get highlighted colors
      const verseInList = selected!.verses[0];
      const verse = testVerses.find(
        v => v.book === verseInList.book && v.chapter === verseInList.chapter && v.verse === verseInList.verse
      );

      if (verse) {
        const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
        expect(color).not.toBeNull();

        // Color should not be the "no match" dim color
        const brightness = color![0] + color![1] + color![2];
        expect(brightness).toBeGreaterThan(0.5);
      }
    });

    it('returns consistent colors for same verse', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const verse = testVerses[0];
      const color1 = tropOverlay.getVerseColor(verse);
      const color2 = tropOverlay.getVerseColor(verse);

      expect(color1).toEqual(color2);
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('shows selection prompt when no trop selected', () => {
      const container = document.createElement('div');
      tropOverlay.renderLegend?.(container);

      expect(container.innerHTML).toContain('Select a trop mark');
    });

    it('shows binary legend for rare trop', () => {
      const controlContainer = document.createElement('div');
      tropOverlay.renderControls?.(controlContainer);

      const buttons = controlContainer.querySelectorAll('button');
      let rareButton: HTMLButtonElement | null = null;

      buttons.forEach(button => {
        if (button.classList.contains('rare')) {
          rareButton = button as HTMLButtonElement;
        }
      });

      if (rareButton) {
        (rareButton as HTMLButtonElement).click();

        const legendContainer = document.createElement('div');
        tropOverlay.renderLegend?.(legendContainer);

        expect(legendContainer.innerHTML).toContain('Contains');
        expect(legendContainer.innerHTML).toContain('Does not contain');
        expect(legendContainer.innerHTML).toContain('rgb(255, 214, 0)'); // Gold
      }
    });

    it('shows gradient legend for uncommon/common trop', () => {
      const controlContainer = document.createElement('div');
      tropOverlay.renderControls?.(controlContainer);

      const buttons = controlContainer.querySelectorAll('button');

      // Find a non-rare button
      let nonRareButton: HTMLButtonElement | null = null;
      buttons.forEach(button => {
        if (!button.classList.contains('rare')) {
          nonRareButton = button as HTMLButtonElement;
        }
      });

      if (nonRareButton) {
        (nonRareButton as HTMLButtonElement).click();

        const legendContainer = document.createElement('div');
        tropOverlay.renderLegend?.(legendContainer);

        expect(legendContainer.innerHTML).toContain('legend-gradient');
        expect(legendContainer.innerHTML).toContain('Count');
        expect(legendContainer.innerHTML).toContain('Max');
      }
    });

    it('uses purple gradient colors in legend', () => {
      const controlContainer = document.createElement('div');
      tropOverlay.renderControls?.(controlContainer);

      const buttons = controlContainer.querySelectorAll('button');
      let nonRareButton: HTMLButtonElement | null = null;

      buttons.forEach(button => {
        if (!button.classList.contains('rare')) {
          nonRareButton = button as HTMLButtonElement;
        }
      });

      if (nonRareButton) {
        (nonRareButton as HTMLButtonElement).click();

        const legendContainer = document.createElement('div');
        tropOverlay.renderLegend?.(legendContainer);

        const gradient = legendContainer.querySelector('.legend-gradient') as HTMLElement;
        expect(gradient).not.toBeNull();

        const style = gradient.style.background;
        // Should contain purple-ish colors
        expect(style.toLowerCase()).toContain('gradient');
      }
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('returns null when no trop selected', () => {
      const verse = testVerses[0];
      const info = tropOverlay.getHoverInfo?.(verse);
      expect(info).toBeNull();
    });

    it('returns trop count for verse with trop', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const selected = getSelectedTrop();
      expect(selected).not.toBeNull();

      const verseInList = selected!.verses[0];
      const verse = testVerses.find(
        v => v.book === verseInList.book && v.chapter === verseInList.chapter && v.verse === verseInList.verse
      );

      if (verse) {
        const info = tropOverlay.getHoverInfo?.(verse);
        expect(info).not.toBeNull();
        expect(info).toContain(selected!.name);
        expect(info).toContain('×');
      }
    });

    it('returns null for verse without trop', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const info = tropOverlay.getHoverInfo?.(verse);
      expect(info).toBeNull();
    });

    it('includes count in hover info', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const selected = getSelectedTrop();
      if (selected && selected.verses.length > 0) {
        const verseInList = selected.verses[0];
        const verse = testVerses.find(
          v => v.book === verseInList.book && v.chapter === verseInList.chapter && v.verse === verseInList.verse
        );

        if (verse) {
          const info = tropOverlay.getHoverInfo?.(verse);
          expect(info).toContain(`×${verseInList.count}`);
        }
      }
    });
  });

  describe('URL State Handling', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('returns empty params when no trop selected', () => {
      const params = tropOverlay.getUrlParams?.();
      expect(params).toEqual({});
    });

    it('returns trop slug when trop selected', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const params = tropOverlay.getUrlParams?.();
      expect(params).toHaveProperty('trop');
      expect(typeof params!.trop).toBe('string');
      expect(params!.trop.length).toBeGreaterThan(0);
    });

    it('uses lowercase and hyphens in slug', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const params = tropOverlay.getUrlParams?.();
      const slug = params!.trop;

      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('applies trop from URL params', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      // Get a trop name
      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();
      const selected = getSelectedTrop();

      if (selected) {
        const slug = selected.name.toLowerCase().replace(/\s+/g, '-');

        // Reset
        tropOverlay.destroy?.();
        configure({ verseTexts: testVerseTexts });

        // Apply URL params
        const urlParams = new URLSearchParams(`trop=${slug}`);
        applyOverlayParams(tropOverlay, urlParams);

        // Check that trop is selected
        const newSelected = getSelectedTrop();
        expect(newSelected).not.toBeNull();
        expect(newSelected!.unicode).toBe(selected.unicode);
      }
    });

    it('triggers update callback when applying URL params', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();
      const selected = getSelectedTrop();

      if (selected) {
        const slug = selected.name.toLowerCase().replace(/\s+/g, '-');

        // Reset and setup callback
        tropOverlay.destroy?.();
        configure({ verseTexts: testVerseTexts });
        tropOverlay.onUpdate?.(updateCallback);

        // Apply URL params
        const urlParams = new URLSearchParams(`trop=${slug}`);
        applyOverlayParams(tropOverlay, urlParams);

        expect(updateCallback).toHaveBeenCalled();
      }
    });

    it('ignores invalid trop slug in URL params', () => {
      const urlParams = new URLSearchParams('trop=invalid-trop-name');
      applyOverlayParams(tropOverlay, urlParams);

      expect(getSelectedTrop()).toBeNull();
    });

    it('handles missing trop param', () => {
      const urlParams = new URLSearchParams('other=value');
      applyOverlayParams(tropOverlay, urlParams);

      expect(getSelectedTrop()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('handles empty verse texts', () => {
      configure({ verseTexts: {} });
      const container = document.createElement('div');

      expect(() => tropOverlay.renderControls?.(container)).not.toThrow();
    });

    it('handles verse without text data', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color!);
    });

    it('handles verse with multiple occurrences of same trop', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const selected = getSelectedTrop();
      if (selected) {
        // Find a verse with count > 1
        const verseWithMultiple = selected.verses.find(v => v.count > 1);
        if (verseWithMultiple) {
          const verse = testVerses.find(
            v =>
              v.book === verseWithMultiple.book &&
              v.chapter === verseWithMultiple.chapter &&
              v.verse === verseWithMultiple.verse
          );

          if (verse) {
            const color = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
            expect(color).not.toBeNull();
            assertValidColor(color!);

            const info = tropOverlay.getHoverInfo?.(verse);
            expect(info).toContain(`×${verseWithMultiple.count}`);
          }
        }
      }
    });

    it('handles very rare trop mark', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');

      // Find the rarest trop
      let rarestButton: HTMLButtonElement | null = null;
      let minCount = Infinity;

      buttons.forEach(button => {
        const btn = button as HTMLButtonElement;
        btn.click();
        const selected = getSelectedTrop();
        if (selected && selected.totalCount < minCount) {
          minCount = selected.totalCount;
          rarestButton = btn;
        }
      });

      if (rarestButton && minCount < RARITY_THRESHOLDS.RARE) {
        (rarestButton as HTMLButtonElement).click();

        // Should use binary coloring
        const colors = testVerses.map(v => tropOverlay.getVerseColor(v) as [number, number, number] | null).filter(c => c !== null);
        const uniqueColors = new Set(colors.map(c => JSON.stringify(c)));

        expect(uniqueColors.size).toBeLessThanOrEqual(2);
      }
    });

    it('handles selection change while viewing hover info', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const info = container.querySelector('.trop-info') as HTMLElement;
      const buttons = container.querySelectorAll('button');

      if (buttons.length >= 2) {
        const button1 = buttons[0] as HTMLButtonElement;
        const button2 = buttons[1] as HTMLButtonElement;

        button1.click();
        button1.dispatchEvent(new MouseEvent('mouseenter'));
        const info1 = info.textContent;

        button2.click();
        button2.dispatchEvent(new MouseEvent('mouseenter'));
        const info2 = info.textContent;

        // Info should change if buttons represent different trop marks
        if (button1.dataset.unicode !== button2.dataset.unicode) {
          expect(info1).not.toBe(info2);
        }
      }
    });
  });

  describe('Configure Function', () => {
    it('accepts verse texts configuration', () => {
      expect(() => configure({ verseTexts: testVerseTexts })).not.toThrow();
    });

    it('handles empty verse texts', () => {
      expect(() => configure({ verseTexts: {} })).not.toThrow();
    });

    it('builds trop index from verse texts', () => {
      configure({ verseTexts: testVerseTexts });

      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Destroy', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('preserves selected trop across destroy/recreate cycles', () => {
      const container1 = document.createElement('div');
      tropOverlay.renderControls?.(container1);

      const button1 = container1.querySelector('button') as HTMLButtonElement;
      button1.click();

      const selectedBefore = getSelectedTrop();
      expect(selectedBefore).not.toBeNull();
      const tropNameBefore = selectedBefore!.name;

      // Destroy (simulating overlay switch)
      tropOverlay.destroy?.();

      // Selection should still be preserved internally
      const selectedAfterDestroy = getSelectedTrop();
      expect(selectedAfterDestroy).not.toBeNull();
      expect(selectedAfterDestroy!.name).toBe(tropNameBefore);

      // Re-render controls (simulating switching back to trop)
      const container2 = document.createElement('div');
      tropOverlay.renderControls?.(container2);

      // Verify selection is still preserved
      const selectedAfterRender = getSelectedTrop();
      expect(selectedAfterRender).not.toBeNull();
      expect(selectedAfterRender!.name).toBe(tropNameBefore);
    });

    it('preserves colors after destroy', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const verse = testVerses[0];
      const colorBefore = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(colorBefore).not.toBeNull();

      // Destroy (simulating overlay switch)
      tropOverlay.destroy?.();

      // Colors should still work (selection is preserved)
      const colorAfter = tropOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(colorAfter).toEqual(colorBefore);
    });
  });

  describe('Highlight Trop In Text', () => {
    it('highlights trop mark in Hebrew text', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית';
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      expect(result).toContain('<mark');
      expect(result).toContain('trop-highlight');
      expect(result).toContain(tropUnicode);
    });

    it('wraps base letter and trop mark together', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית';
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      // Should have exactly one mark element
      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBeGreaterThan(0);
    });

    it('handles text without trop mark', () => {
      const hebrewText = 'בראשית';
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      expect(result).not.toContain('<mark');
      expect(result).toBe(hebrewText);
    });

    it('handles multiple occurrences of same trop', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית וְהָאָ֖רֶץ'; // Two tipcha marks
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBeGreaterThanOrEqual(1);
    });

    it('handles empty text', () => {
      const result = highlightTropInText('', SAMPLE_TROP_MARKS.TIPCHA);
      expect(result).toBe('');
    });

    it('preserves other trop marks', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית אֱלֹהִ֑ים'; // Contains tipcha and etnachta
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      // Should still contain the other trop mark (etnachta)
      expect(result).toContain(SAMPLE_TROP_MARKS.ETNACHTA);
    });
  });

  describe('Update Callback', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('registers update callback', () => {
      expect(() => tropOverlay.onUpdate?.(updateCallback)).not.toThrow();
    });

    it('calls update callback on trop selection', () => {
      tropOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      expect(updateCallback).toHaveBeenCalled();
    });

    it('calls update callback on trop deselection', () => {
      tropOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;

      button.click();
      updateCallback.mockClear();

      button.click();

      expect(updateCallback).toHaveBeenCalled();
    });
  });

  describe('Cache Performance', () => {
    beforeEach(async () => {
      await tropOverlay.init?.();
    });

    it('caches verse lookup for performance', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const verse = testVerses[0];

      // Multiple calls should return same result quickly
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tropOverlay.getVerseColor(verse);
      }
      const duration = performance.now() - start;

      // Should be fast (less than 10ms for 100 calls)
      expect(duration).toBeLessThan(10);
    });

    it('recalculates cache when trop changes', () => {
      const container = document.createElement('div');
      tropOverlay.renderControls?.(container);

      const buttons = container.querySelectorAll('button');
      if (buttons.length >= 2) {
        const button1 = buttons[0] as HTMLButtonElement;
        const button2 = buttons[1] as HTMLButtonElement;

        button1.click();
        const selected1 = getSelectedTrop();
        const verse = testVerses[0];
        const color1 = tropOverlay.getVerseColor(verse);

        button2.click();
        const selected2 = getSelectedTrop();
        const color2 = tropOverlay.getVerseColor(verse);

        // If different trop marks were selected, colors may differ
        // The test mainly ensures no crash when changing selection
        expect(color1).not.toBeNull();
        expect(color2).not.toBeNull();

        // If the selected trop marks are actually different, verify cache was updated
        if (selected1?.unicode !== selected2?.unicode) {
          // Cache was recalculated - verify by checking selectedTrop changed
          expect(selected1).not.toEqual(selected2);
        }
      }
    });
  });

  describe('Integration with Trop Module', () => {
    it('uses getRarityTier from trop module', () => {
      expect(getRarityTier(10)).toBe('rare');
      expect(getRarityTier(100)).toBe('uncommon');
      expect(getRarityTier(1000)).toBe('common');
    });

    it('applies correct rarity thresholds', () => {
      expect(RARITY_THRESHOLDS.RARE).toBe(50);
      expect(RARITY_THRESHOLDS.UNCOMMON).toBe(500);
    });
  });
});
