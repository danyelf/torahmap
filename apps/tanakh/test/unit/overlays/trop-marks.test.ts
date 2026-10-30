import { describe, it, expect } from 'vitest';
import { getRarityTier, RARITY_THRESHOLDS } from '../../../src/overlays/trop/marks';

describe('getRarityTier', () => {
  it('starts each tier at its threshold', () => {
    const { RARE, UNCOMMON } = RARITY_THRESHOLDS;
    expect(getRarityTier(RARE - 1)).toBe('rare');
    expect(getRarityTier(RARE)).toBe('uncommon');
    expect(getRarityTier(UNCOMMON - 1)).toBe('uncommon');
    expect(getRarityTier(UNCOMMON)).toBe('common');
  });
});
