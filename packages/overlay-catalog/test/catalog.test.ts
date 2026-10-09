import { describe, it, expect } from 'vitest';
import {
  RESERVED_KEYS,
  readLink,
  writeLink,
  type UrlParamKind,
  type UrlParamSpec,
} from '@torahmap/link';
import {
  overlayName,
  overlayParamSpecs,
  LINK_KEYS,
  SEARCH_KEYS,
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
      expect(SEARCH_KEYS.has(key) || RESERVED_KEYS.has(key) || key === LINK_KEYS.square).toBe(
        false,
      );
    }
  });
});

const SAMPLE: Record<UrlParamKind, string> = {
  token: 'sample',
  category: 'Talmud/Mishnah',
  text: 'in the beginning',
  names: 'BR>CJT/',
};

const sampleValue = (spec: UrlParamSpec): string => spec.allowed?.at(-1) ?? SAMPLE[spec.kind];

describe('each overlay’s settings survive a link', () => {
  it.each(ALL.filter((entry) => entry.urlParams))('$id', (entry) => {
    const settings = Object.fromEntries(
      (entry.urlParams ?? []).map((spec) => [spec.key, sampleValue(spec)]),
    );
    const link = writeLink({ overlay: entry.id, overlayParams: settings }, LINK_KEYS);
    expect(readLink(link, LINK_KEYS).overlayParams).toEqual(settings);
  });
});
