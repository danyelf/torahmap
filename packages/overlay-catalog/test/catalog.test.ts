import { describe, it, expect } from 'vitest';
import { SEARCH_KEYS, RESERVED_KEYS } from '@torahmap/link';
import {
  overlayName,
  overlayParamSpecs,
  COMMENTARY,
  OVERLAYS,
  type OverlayEntry,
} from '@torahmap/overlay-catalog';

const ALL: readonly OverlayEntry[] = OVERLAYS;

describe('the overlay catalog', () => {
  it('names each overlay by id', () => {
    expect(overlayName('commentary')).toBe('Commentary');
    expect(overlayName('nope')).toBeUndefined();
  });

  it('gives each overlay its link keys', () => {
    expect(overlayParamSpecs('commentary')).toBe(COMMENTARY.urlParams);
    expect(overlayParamSpecs('nope')).toBeUndefined();
  });

  it.each(ALL)('$id claims distinct keys, none belonging to the link or the search', (entry) => {
    const keys = (entry.urlParams ?? []).map((spec) => spec.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(SEARCH_KEYS.has(key) || RESERVED_KEYS.has(key)).toBe(false);
    }
  });
});
