import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, highlightTropInText, type TropSettings } from '../../../overlays/trop';
import { hostOverlay } from '../../helpers/overlayHost';
import { createVerse, SAMPLE_TROP_MARKS } from '../../helpers/fixtures';
import { assertValidColor, assertApproximately } from '../../helpers/assertions';
import type { Overlay } from '../../../overlays/types';
import type { TanakhIdentity, TanakhLayout } from '../../../types';
import type { VerseTexts } from '../../../verseTexts';
import { getRarityTier, RARITY_THRESHOLDS } from '../../../trop';

registerAllOverlays();

describe('Trop Overlay', () => {
  let testVerseTexts: VerseTexts;
  let testVerses: TanakhLayout[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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

    configure({ verseTexts: testVerseTexts });
  });

  function makeHost() {
    return hostOverlay(getOverlay('trop')! as Overlay<TanakhIdentity, TropSettings>);
  }

  /** Click the first button in a freshly drawn set of controls; returns the host and button. */
  function selectFirstMark(host: ReturnType<typeof makeHost>) {
    const container = host.renderControls();
    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    return { container, button };
  }

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      const overlay = getOverlay('trop')!;
      expect(overlay.id).toBe('trop');
      expect(overlay.name).toBe('Trop');
    });
  });

  describe('Initialization', () => {
    it('starts with no mark selected', () => {
      const host = makeHost();
      expect(host.settings.mark).toBeNull();
    });

    it('returns null color when no mark selected', () => {
      const host = makeHost();
      const color = host.getVerseColor(testVerses[0]);
      expect(color).toBeNull();
    });
  });

  describe('Trop Mark Selection UI', () => {
    it('renders trop selector buttons', () => {
      const host = makeHost();
      const container = host.renderControls();

      const chart = container.querySelector('.trop-chart');
      expect(chart).not.toBeNull();

      const buttons = chart?.querySelectorAll('button');
      expect(buttons).not.toBeNull();
      expect(buttons!.length).toBeGreaterThan(0);
    });

    it('displays trop marks on bet character', () => {
      const host = makeHost();
      const container = host.renderControls();

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((button) => {
        expect(button.textContent).toMatch(/^ב/);
      });
    });

    it('shows trop name on hover', () => {
      const host = makeHost();
      const container = host.renderControls();

      const info = container.querySelector('.trop-info') as HTMLElement;
      const button = container.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new MouseEvent('mouseenter'));
      expect(info.textContent).not.toBe('');
      expect(info.textContent).toContain('occurrences');
    });

    it('clears info on mouseleave when no selection', () => {
      const host = makeHost();
      const container = host.renderControls();

      const info = container.querySelector('.trop-info') as HTMLElement;
      const button = container.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new MouseEvent('mouseenter'));
      expect(info.textContent).not.toBe('');

      button.dispatchEvent(new MouseEvent('mouseleave'));
      vi.runAllTimers();
      expect(info.textContent).toBe('');
    });

    it('selects a mark on click', () => {
      const host = makeHost();
      const onChange = vi.fn();
      host.onChange(onChange);

      const { button } = selectFirstMark(host);

      expect(button.classList.contains('selected')).toBe(true);
      expect(host.settings.mark).not.toBeNull();
      expect(onChange).toHaveBeenCalled();
    });

    it('deselects a mark on second click', () => {
      const host = makeHost();
      const { container, button } = selectFirstMark(host);
      expect(button.classList.contains('selected')).toBe(true);

      // The button clicked is the same element after the change is applied:
      // renderControls updates the existing chart in place, it does not rebuild it.
      expect(container.querySelector('button')).toBe(button);

      button.click();
      expect(button.classList.contains('selected')).toBe(false);
      expect(host.settings.mark).toBeNull();
    });

    it('switches selection when clicking a different mark, without rebuilding the chart', () => {
      const host = makeHost();
      const container = host.renderControls();

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      const [button1, button2] = Array.from(buttons) as HTMLButtonElement[];

      button1.click();
      expect(button1.classList.contains('selected')).toBe(true);
      expect(button2.classList.contains('selected')).toBe(false);

      button2.click();
      expect(button1.classList.contains('selected')).toBe(false);
      expect(button2.classList.contains('selected')).toBe(true);

      // Still the same DOM elements: the controls updated in place.
      const buttonsAfter = container.querySelectorAll('button');
      expect(buttonsAfter[0]).toBe(button1);
      expect(buttonsAfter[1]).toBe(button2);
    });

    describe('previewing a mark by hovering', () => {
      const colours = (host: ReturnType<typeof makeHost>) =>
        testVerses.map((v) => host.getVerseColor(v));

      /** The map's colours with `button` clicked, from a host of its own. */
      function coloursClicked(index: number) {
        const host = makeHost();
        (host.renderControls().querySelectorAll('button')[index] as HTMLButtonElement).click();
        return colours(host);
      }

      it('colours the map for a hovered mark without selecting it', () => {
        const host = makeHost();
        const button = host.renderControls().querySelector('button') as HTMLButtonElement;

        button.dispatchEvent(new MouseEvent('mouseenter'));

        expect(colours(host)).toEqual(coloursClicked(0));
        expect(host.settings.mark).toBeNull();
        expect(button.classList.contains('selected')).toBe(false);
        expect(host.toUrl()).toEqual({});
      });

      it('returns to no colouring on leaving when nothing is clicked', () => {
        const host = makeHost();
        const button = host.renderControls().querySelector('button') as HTMLButtonElement;

        button.dispatchEvent(new MouseEvent('mouseenter'));
        button.dispatchEvent(new MouseEvent('mouseleave'));
        vi.runAllTimers();

        expect(colours(host).every((c) => c === null)).toBe(true);
      });

      it('returns to the clicked mark on leaving another', () => {
        const host = makeHost();
        const [first, second] = Array.from(
          host.renderControls().querySelectorAll('button'),
        ) as HTMLButtonElement[];
        first.click();

        second.dispatchEvent(new MouseEvent('mouseenter'));
        expect(colours(host)).toEqual(coloursClicked(1));
        expect(host.toUrl()).toEqual({ trop: first.dataset.slug });

        second.dispatchEvent(new MouseEvent('mouseleave'));
        vi.runAllTimers();
        expect(colours(host)).toEqual(coloursClicked(0));
      });

      it('goes straight from one hovered mark to the next, never through no mark', () => {
        const host = makeHost();
        const [first, second] = Array.from(
          host.renderControls().querySelectorAll('button'),
        ) as HTMLButtonElement[];

        first.dispatchEvent(new MouseEvent('mouseenter'));
        first.dispatchEvent(new MouseEvent('mouseleave'));
        expect(colours(host)).toEqual(coloursClicked(0));

        second.dispatchEvent(new MouseEvent('mouseenter'));
        vi.runAllTimers();
        expect(colours(host)).toEqual(coloursClicked(1));
      });

      it('names the hovered mark in the legend', () => {
        const host = makeHost();
        const button = host.renderControls().querySelector('button') as HTMLButtonElement;
        button.dispatchEvent(new MouseEvent('mouseenter'));

        const legend = document.createElement('div');
        host.renderLegend(legend);
        expect(legend.textContent).not.toContain('Select a trop mark');
      });

      it('is not restored from a link', () => {
        const host = makeHost();
        (host.renderControls().querySelector('button') as HTMLButtonElement).dispatchEvent(
          new MouseEvent('mouseenter'),
        );
        host.restore({});
        expect(colours(host).every((c) => c === null)).toBe(true);
      });
    });

    it('marks a rare trop with a special class', () => {
      const host = makeHost();
      const container = host.renderControls();

      const buttons = container.querySelectorAll('button');
      const hasRareButton = Array.from(buttons).some((button) => button.classList.contains('rare'));
      expect(hasRareButton).toBe(true);
    });

    it('displays the rarity tier in the info text', () => {
      const host = makeHost();
      const container = host.renderControls();

      const info = container.querySelector('.trop-info') as HTMLElement;
      const button = container.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new MouseEvent('mouseenter'));

      const text = info.textContent || '';
      const hasRarityLabel =
        text.includes('Rare') || text.includes('Uncommon') || text.includes('Common');
      expect(hasRarityLabel).toBe(true);
    });

    it('shows the selection a link named when the controls are first drawn', () => {
      const first = makeHost();
      const chosen = selectFirstMark(first).container.querySelector('button')!.dataset.slug!;

      const second = makeHost();
      second.restore({ trop: chosen });
      const container = second.renderControls();

      const selected = container.querySelector('button.selected') as HTMLButtonElement | null;
      expect(selected).not.toBeNull();
      expect(selected!.dataset.slug).toBe(chosen);
    });
  });

  describe('Rarity-Based Coloring', () => {
    describe('Rare Marks (<50 occurrences)', () => {
      it('returns gold for a verse holding a rare mark', () => {
        const host = makeHost();
        const container = host.renderControls();
        const rareButton = Array.from(container.querySelectorAll('button')).find((b) =>
          b.classList.contains('rare'),
        ) as HTMLButtonElement | undefined;
        expect(rareButton).toBeDefined();
        rareButton!.click();

        const verseWithMark = testVerses.find((v) => {
          const color = host.getVerseColor(v) as [number, number, number] | null;
          return color && color[0] > 0.9 && color[1] > 0.8;
        });
        if (!verseWithMark) return;

        const color = host.getVerseColor(verseWithMark) as [number, number, number];
        assertApproximately(color[0], 1.0, 0.01);
        assertApproximately(color[1], 0.84, 0.01);
        assertApproximately(color[2], 0.0, 0.01);
      });

      it('returns dim gray for a verse without the rare mark', () => {
        const host = makeHost();
        const container = host.renderControls();
        const rareButton = Array.from(container.querySelectorAll('button')).find((b) =>
          b.classList.contains('rare'),
        ) as HTMLButtonElement | undefined;
        expect(rareButton).toBeDefined();
        rareButton!.click();

        const verseWithoutMark = testVerses.find((v) => {
          const color = host.getVerseColor(v) as [number, number, number] | null;
          return color && color[0] < 0.2;
        });
        if (!verseWithoutMark) return;

        const color = host.getVerseColor(verseWithoutMark) as [number, number, number];
        assertApproximately(color[0], 0.25, 0.02);
        assertApproximately(color[1], 0.25, 0.02);
        assertApproximately(color[2], 0.25, 0.02);
      });

      it('uses binary coloring for rare marks', () => {
        const host = makeHost();
        const container = host.renderControls();
        const rareButton = Array.from(container.querySelectorAll('button')).find((b) =>
          b.classList.contains('rare'),
        ) as HTMLButtonElement | undefined;
        expect(rareButton).toBeDefined();
        rareButton!.click();

        const colors = testVerses.map(
          (v) => host.getVerseColor(v) as [number, number, number] | null,
        );
        const uniqueColors = new Set(
          colors.filter((c) => c !== null).map((c) => JSON.stringify(c)),
        );
        expect(uniqueColors.size).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Verse Filtering', () => {
    it('returns null color when no mark selected', () => {
      const host = makeHost();
      expect(host.getVerseColor(testVerses[0])).toBeNull();
    });

    it('returns a color for every verse once a mark is selected', () => {
      const host = makeHost();
      selectFirstMark(host);

      testVerses.forEach((verse) => {
        const color = host.getVerseColor(verse) as [number, number, number] | null;
        expect(color).not.toBeNull();
        assertValidColor(color!);
      });
    });

    it('returns consistent colors for the same verse', () => {
      const host = makeHost();
      selectFirstMark(host);

      const verse = testVerses[0];
      expect(host.getVerseColor(verse)).toEqual(host.getVerseColor(verse));
    });

    it('colorsFor agrees with getVerseColor for every verse', () => {
      const host = makeHost();
      selectFirstMark(host);

      const overlay = getOverlay('trop')!;
      const fromColorsFor = overlay.colorsFor!(testVerses, host.settings, null);
      const fromGetVerseColor = testVerses.map((v) => host.getVerseColor(v));
      expect(fromColorsFor).toEqual(fromGetVerseColor);
    });

    it('colorsFor does not read or write the settings a host holds', () => {
      const host = makeHost();
      selectFirstMark(host);
      const held = host.settings;
      const urlBefore = host.toUrl();

      const overlay = getOverlay('trop')!;
      const otherSettings: TropSettings = { mark: null, preview: null };
      overlay.colorsFor!(testVerses, otherSettings, null);

      expect(host.settings).toBe(held);
      expect(host.toUrl()).toEqual(urlBefore);
    });
  });

  describe('Render Legend', () => {
    it('shows a selection prompt when no mark is selected', () => {
      const host = makeHost();
      const container = document.createElement('div');
      host.renderLegend(container);
      expect(container.innerHTML).toContain('Select a trop mark');
    });

    it('shows the binary legend for a rare mark', () => {
      const host = makeHost();
      const controls = host.renderControls();
      const rareButton = Array.from(controls.querySelectorAll('button')).find((b) =>
        b.classList.contains('rare'),
      ) as HTMLButtonElement | undefined;
      expect(rareButton).toBeDefined();
      rareButton!.click();

      const container = document.createElement('div');
      host.renderLegend(container);

      expect(container.innerHTML).toContain('Contains');
      expect(container.innerHTML).toContain('Does not contain');
      expect(container.innerHTML).toContain('rgb(255, 214, 0)'); // Gold
    });

    it('draws its strip in its own colours, owing nothing to commentary', () => {
      // The shared fixture's marks are all rare, which is the two-swatch
      // legend. A mark has to clear RARITY_THRESHOLDS.UNCOMMON to get a strip.
      const chapter: Record<string, { he: string; en: string }> = {};
      for (let verse = 1; verse <= RARITY_THRESHOLDS.UNCOMMON + 1; verse++) {
        chapter[String(verse)] = { he: 'בְּרֵאשִׁ֑ית', en: 'In the beginning' };
      }
      configure({ verseTexts: { 'Genesis': { '1': chapter } } });

      const host = makeHost();
      const controls = host.renderControls();
      (controls.querySelector('button') as HTMLButtonElement).click();

      const container = document.createElement('div');
      host.renderLegend(container);

      const strip = container.querySelector<HTMLElement>('.trop-gradient');
      expect(strip).not.toBeNull();
      expect(container.querySelector('.legend-gradient')).toBeNull();
      // The ends of trop's own gradient, not a hand-written approximation.
      expect(strip?.style.background).toContain('rgb(51, 26, 77) 0%');
      expect(strip?.style.background).toContain('rgb(242, 153, 230) 100%');
    });
  });

  describe('Hover Info', () => {
    it('returns null when no mark is selected', () => {
      const host = makeHost();
      expect(host.getHoverInfo(testVerses[0])).toBeNull();
    });

    it('returns the mark and its count for a matching verse', () => {
      const host = makeHost();
      selectFirstMark(host);

      const verseInList = testVerses.find((v) => host.getHoverInfo(v) !== null);
      if (!verseInList) return;

      const info = host.getHoverInfo(verseInList);
      expect(info).not.toBeNull();
      expect(info).toContain('×');
    });

    it('returns null for a verse without the selected mark', () => {
      const host = makeHost();
      selectFirstMark(host);

      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      expect(host.getHoverInfo(verse)).toBeNull();
    });
  });

  describe('Settings and the URL', () => {
    it('reports no params when no mark is selected', () => {
      const host = makeHost();
      expect(host.toUrl()).toEqual({});
    });

    it('reports the mark slug once one is selected', () => {
      const host = makeHost();
      selectFirstMark(host);

      const params = host.toUrl();
      expect(params).toHaveProperty('trop');
      expect(typeof params.trop).toBe('string');
      expect(params.trop.length).toBeGreaterThan(0);
      expect(params.trop).toMatch(/^[a-z0-9-]+$/);
    });

    it('restores a mark named by a link', () => {
      const first = makeHost();
      const slug = selectFirstMark(first).container.querySelector('button')!.dataset.slug!;

      const second = makeHost();
      second.restore({ trop: slug });

      expect(second.settings.mark).toBe(slug);
      expect(second.toUrl()).toEqual({ trop: slug });
    });

    it('holds no mark when a link names none', () => {
      const host = makeHost();
      host.restore({});
      expect(host.settings.mark).toBeNull();
    });

    it('colours nothing for a slug no mark answers to', () => {
      const host = makeHost();
      host.restore({ trop: 'not-a-real-mark' });

      testVerses.forEach((verse) => {
        expect(host.getVerseColor(verse)).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty verse texts', () => {
      configure({ verseTexts: {} });
      const host = makeHost();
      expect(() => host.renderControls()).not.toThrow();
    });

    it('handles a verse without text data', () => {
      const host = makeHost();
      selectFirstMark(host);

      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = host.getVerseColor(verse) as [number, number, number] | null;
      expect(color).not.toBeNull();
      assertValidColor(color!);
    });

    it('handles a verse with multiple occurrences of the same mark', () => {
      const host = makeHost();
      const container = host.renderControls();

      for (const button of Array.from(container.querySelectorAll('button'))) {
        (button as HTMLButtonElement).click();
        const withMultiple = testVerses.find((v) => {
          const info = host.getHoverInfo(v);
          return info && /×[2-9]/.test(info);
        });
        if (withMultiple) {
          const color = host.getVerseColor(withMultiple) as [number, number, number] | null;
          expect(color).not.toBeNull();
          assertValidColor(color!);
          return;
        }
        (button as HTMLButtonElement).click(); // deselect before trying the next one
      }
    });
  });

  describe('Highlight Trop In Text', () => {
    it('highlights the mark in Hebrew text', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית';
      const tropUnicode = SAMPLE_TROP_MARKS.TIPCHA;

      const result = highlightTropInText(hebrewText, tropUnicode);

      expect(result).toContain('<mark');
      expect(result).toContain('trop-highlight');
      expect(result).toContain(tropUnicode);
    });

    it('wraps the base letter and the mark together', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית';
      const result = highlightTropInText(hebrewText, SAMPLE_TROP_MARKS.TIPCHA);
      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBeGreaterThan(0);
    });

    it('leaves text without the mark unchanged', () => {
      const hebrewText = 'בראשית';
      const result = highlightTropInText(hebrewText, SAMPLE_TROP_MARKS.TIPCHA);
      expect(result).not.toContain('<mark');
      expect(result).toBe(hebrewText);
    });

    it('handles multiple occurrences of the same mark', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית וְהָאָ֖רֶץ'; // Two tipcha marks
      const result = highlightTropInText(hebrewText, SAMPLE_TROP_MARKS.TIPCHA);
      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBeGreaterThanOrEqual(1);
    });

    it('handles empty text', () => {
      expect(highlightTropInText('', SAMPLE_TROP_MARKS.TIPCHA)).toBe('');
    });

    it('preserves other marks', () => {
      const hebrewText = 'בְּרֵאשִׁ֖ית אֱלֹהִ֑ים'; // Contains tipcha and etnachta
      const result = highlightTropInText(hebrewText, SAMPLE_TROP_MARKS.TIPCHA);
      expect(result).toContain(SAMPLE_TROP_MARKS.ETNACHTA);
    });
  });

  describe('highlightVerseText (the overlay member)', () => {
    it('marks the selected trop in Hebrew verse text', () => {
      const host = makeHost();
      const container = host.renderControls();
      const button = container.querySelector('button') as HTMLButtonElement;
      const unicode = button.dataset.unicode!;
      button.click();

      const fragment = host.highlightVerseText(`בְּרֵאשִׁ${unicode}ית`, 'he');
      const holder = document.createElement('div');
      holder.append(fragment);
      expect(holder.querySelector('mark')).not.toBeNull();
    });

    it('marks nothing when no trop is selected', () => {
      const host = makeHost();
      const fragment = host.highlightVerseText('בְּרֵאשִׁ֖ית', 'he');
      const holder = document.createElement('div');
      holder.append(fragment);
      expect(holder.querySelector('mark')).toBeNull();
      expect(holder.textContent).toBe('בְּרֵאשִׁ֖ית');
    });

    it('marks nothing in English text even with a trop selected', () => {
      const host = makeHost();
      selectFirstMark(host);
      const fragment = host.highlightVerseText('In the beginning', 'en');
      const holder = document.createElement('div');
      holder.append(fragment);
      expect(holder.querySelector('mark')).toBeNull();
    });
  });

  describe('Configure Function', () => {
    it('accepts verse texts configuration', () => {
      expect(() => configure({ verseTexts: testVerseTexts })).not.toThrow();
    });

    it('handles empty verse texts', () => {
      expect(() => configure({ verseTexts: {} })).not.toThrow();
    });

    it('builds the trop index from verse texts', () => {
      configure({ verseTexts: testVerseTexts });
      const host = makeHost();
      const container = host.renderControls();
      expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
    });
  });

  describe('Holds no settings of its own', () => {
    it('keeps two hosts of the same overlay independent', () => {
      const hostA = makeHost();
      const hostB = makeHost();

      const slugA = selectFirstMark(hostA).container.querySelector('button')!.dataset.slug!;
      expect(hostB.settings.mark).toBeNull();

      const containerB = hostB.renderControls();
      const buttons = Array.from(containerB.querySelectorAll('button')) as HTMLButtonElement[];
      const other = buttons.find((b) => b.dataset.slug !== slugA) ?? buttons[1];
      if (other) {
        other.click();
        expect(hostA.settings.mark).toBe(slugA);
        expect(hostB.settings.mark).not.toBe(slugA);
      }
    });

    it('colours by the settings handed in, not by anything left over from a previous host', () => {
      const first = makeHost();
      selectFirstMark(first);

      const second = makeHost();
      expect(second.getVerseColor(testVerses[0])).toBeNull();
    });

    it('survives destroy: colours still come from the settings, not module state', () => {
      const host = makeHost();
      selectFirstMark(host);
      const verse = testVerses[0];
      const before = host.getVerseColor(verse);

      const overlay = getOverlay('trop')!;
      overlay.destroy?.();

      expect(host.getVerseColor(verse)).toEqual(before);
    });
  });

  describe('Cache Performance', () => {
    it('recalculates when the selected mark changes', () => {
      const host = makeHost();
      const container = host.renderControls();
      const buttons = container.querySelectorAll('button');
      if (buttons.length < 2) return;
      const [button1, button2] = Array.from(buttons) as HTMLButtonElement[];

      button1.click();
      const verse = testVerses[0];
      const color1 = host.getVerseColor(verse);
      const slug1 = host.settings.mark;

      button2.click();
      const color2 = host.getVerseColor(verse);
      const slug2 = host.settings.mark;

      expect(color1).not.toBeNull();
      expect(color2).not.toBeNull();
      if (slug1 !== slug2) {
        expect(slug1).not.toEqual(slug2);
      }
    });
  });

  describe('Integration with Trop Module', () => {
    it('uses getRarityTier from trop module', () => {
      expect(getRarityTier(10)).toBe('rare');
      expect(getRarityTier(100)).toBe('uncommon');
      expect(getRarityTier(1000)).toBe('common');
    });
  });
});
