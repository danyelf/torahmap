import type { LinkKeys, OverlayParamSpecLookup } from '../src/index.ts';

// Samples shaped like the real overlays, one per kind of setting. The real
// declarations go through readLink and writeLink in the catalog's own test.
export const lookup: OverlayParamSpecLookup = (id) => {
  switch (id) {
    case 'commentary':
      return [{ key: 'category', kind: 'category', default: 'total' }];
    case 'trop':
      return [{ key: 'trop', kind: 'token' }];
    case 'haftarah':
      return [
        { key: 'custom', kind: 'token', allowed: ['ashkenazi', 'sephardi'], default: 'ashkenazi' },
      ];
    default:
      return undefined;
  }
};

// A copy of the Tanakh's keys, which live in a package this one cannot import.
export const keys: LinkKeys = {
  square: 'verse',
  search: [
    { key: 'search', kind: 'text' },
    { key: 'mode', kind: 'token' },
    { key: 'm', kind: 'names' },
  ],
  overlayParams: lookup,
};
