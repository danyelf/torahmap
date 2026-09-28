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

  it.each(ALL)('$id claims no key that belongs to the link or the search', (entry) => {
    for (const { key } of entry.urlParams ?? []) {
      expect(SEARCH_KEYS.has(key) || RESERVED_KEYS.has(key)).toBe(false);
    }
  });
});
