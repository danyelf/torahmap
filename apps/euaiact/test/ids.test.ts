import { describe, expect, it } from 'vitest';
import { actRef, layerOf, ownerOf, sourceUrl } from '../src/ids.ts';

describe('a square’s id', () => {
  it.each([
    ['Recital.12', 'recital', 'Recital.12', 'Recital 12'],
    ['6', 'article', '6', 'Article 6'],
    ['5(1)(h)', 'article', '5', 'Article 5(1)(h)'],
    ['75a(2)', 'article', '75a', 'Article 75a(2)'],
    ['Annex.III.2.5', 'annex', 'Annex III', 'Annex III'],
  ])('%s', (id, layer, owner, ref) => {
    expect(layerOf(id)).toBe(layer);
    expect(ownerOf(id)).toBe(owner);
    expect(actRef(id)).toBe(ref);
  });

  it('points at the recital, article or annex it is in', () => {
    expect(sourceUrl('Recital.12')).toMatch(/#rct_12$/);
    expect(sourceUrl('5(1)(h)')).toMatch(/#art_5$/);
    expect(sourceUrl('Annex.III.2.5')).toMatch(/#anx_III$/);
  });
});
