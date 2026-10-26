import { describe, expect, it } from 'vitest';
import type { ActRef } from '../src/data.ts';
import type { ActItem } from '../src/layout.ts';
import { amendmentOverlay } from '../src/overlays/amendment.ts';
import { referencesOverlay, CITES, CITED_BY, FOCUS, QUIET } from '../src/overlays/references.ts';

const item = (id: string, over: Partial<ActItem> = {}): ActItem => ({
  id,
  x: 0,
  y: 0,
  size: 6,
  layer: 'article',
  origin: 'B',
  lead: false,
  chapter: 'I',
  ...over,
});

describe('the amendment overlay', () => {
  it('colours text inserted and replaced in 2026 differently from the rest', () => {
    const colour = (origin: ActItem['origin']) =>
      amendmentOverlay.colorsFor(
        [item('1', { origin })],
        undefined as never,
        null,
        undefined as never,
      )[0];
    expect(colour('M1 inserted')).not.toEqual(colour('B'));
    expect(colour('M1 replaced')).not.toEqual(colour('B'));
    expect(colour('M1 replaced')).not.toEqual(colour('M1 inserted'));
  });

  it('draws a list’s lead-in darker than its points', () => {
    const colour = (lead: boolean) =>
      amendmentOverlay.colorsFor(
        [item('1', { lead })],
        undefined as never,
        null,
        undefined as never,
      )[0];
    expect(colour(true)).not.toEqual(colour(false));
  });
});

describe('the what-points-here overlay', () => {
  // Article 6 cites 5(1) and Annex III; 9(2) and 40 cite Article 6; 6(1) cites 6(2) inside itself.
  const refs: ActRef[] = [
    ['6(1)', '5(1)'],
    ['6(2)', 'Annex III'],
    ['9(2)', '6(1)'],
    ['40', '6'],
    ['6(1)', '6(2)'],
  ];
  const colours = (squares: ActItem[], article = '6') =>
    referencesOverlay.colorsFor(squares, { article }, null, { refs });

  it('marks the article itself', () => {
    expect(colours([item('6(2)')])[0]).toEqual(FOCUS);
  });

  it('marks what the article cites, down to the paragraph and point', () => {
    expect(colours([item('5(1)'), item('5(1)(a)'), item('5(2)')])).toEqual([CITES, CITES, QUIET]);
  });

  it('marks a whole annex the article cites, and no other', () => {
    const annex = (n: string) => item(`Annex.${n}.1.1`, { layer: 'annex' });
    expect(colours([annex('III'), annex('IV')])).toEqual([CITES, QUIET]);
  });

  it('marks what cites the article', () => {
    expect(colours([item('9(2)'), item('9(3)')])).toEqual([CITED_BY, QUIET]);
    expect(colours([item('40')])[0]).toEqual(CITED_BY);
  });

  it('colours no recital', () => {
    expect(colours([item('Recital.3', { layer: 'recital' })])[0]).toEqual(QUIET);
  });

  it('reads its article from a link and writes it back, leaving the default out', () => {
    expect(referencesOverlay.settingsFromUrl!({ article: '9' })).toEqual({ article: '9' });
    expect(referencesOverlay.settingsFromUrl!({})).toEqual({ article: '6' });
    expect(referencesOverlay.settingsToUrl!({ article: '9' })).toEqual({ article: '9' });
    expect(referencesOverlay.settingsToUrl!({ article: '6' })).toEqual({});
  });

  describe('while the pointer is on a square', () => {
    const hover = (squares: ActItem[], on: ActItem, article = '') =>
      referencesOverlay.colorsFor(squares, { article }, on, { refs });

    it('shows the references of the article the square is in', () => {
      const shown = hover([item('9(1)'), item('6(1)'), item('6(2)')], item('9(3)'));
      expect(shown).toEqual([FOCUS, CITES, QUIET]);
    });

    it('shows them over the article typed in the box', () => {
      expect(hover([item('5(1)')], item('9(3)'), '6')).toEqual([QUIET]);
    });

    it('shows what cites an annex the pointer is on', () => {
      const annex = item('Annex.III.1.1', { layer: 'annex' });
      expect(hover([annex, item('6(2)'), item('6(1)')], annex)).toEqual([FOCUS, CITED_BY, QUIET]);
    });

    it('leaves the map as it was on a recital', () => {
      const squares = [item('6(1)'), item('40')];
      const recital = item('Recital.3', { layer: 'recital' });
      expect(hover(squares, recital, '6')).toEqual(colours(squares, '6'));
    });

    it('changes the map only when the pointer moves to another article', () => {
      const changes = (a: ActItem | null, b: ActItem | null) =>
        referencesOverlay.hoverChangesColors!(a, b, { article: '' }, { refs });
      const recital = item('Recital.3', { layer: 'recital' });
      expect(changes(item('6(1)'), item('6(2)'))).toBe(false);
      expect(changes(item('6(1)'), item('9(2)'))).toBe(true);
      expect(changes(item('6(1)'), null)).toBe(true);
      expect(changes(recital, null)).toBe(false);
    });
  });

  it('marks nothing with the box empty and nothing under the pointer', () => {
    const squares = [item('6(1)'), item('5(1)'), item('Annex.III.2', { layer: 'annex' })];
    expect(colours(squares, '')).toEqual([QUIET, QUIET, QUIET]);
  });
});
