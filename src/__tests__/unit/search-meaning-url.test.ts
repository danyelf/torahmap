// A narrowed search has to survive being shared.
//
// ETCBC spells ayin `<` and aleph `>`, so two lexeme keys side by side read as
// an HTML tag: `<LH/@heb,>MR[@heb` is burnt-offering followed by "say". The URL
// layer strips tags out of free text, and `m` was declared free text, so the
// first key, the separator and half the second were deleted in transit —
// leaving applyMeanings nothing it recognised, and falling back to every
// meaning. The reader opened the link and saw a different search, with nothing
// saying so, which is the failure the meaning filter exists to prevent.
//
// `m` is a `names` parameter now, which is the declaration that keeps the
// stripper away from it.

import { describe, it, expect } from 'vitest';
import { validateOverlayParams } from '@torahmap/link';
import { searchTool } from '../../overlays/search/index';
import { addTerm, applyMeanings, encodeMeanings } from '../../search/terms';
import type { SearchTerm } from '../../search/terms';

// The overlay's own declaration, not a copy of it: declaring `m` as free text
// again is the mistake this file exists to catch, and a hand-written spec here
// would go on passing while the app broke.
const SPEC = searchTool.urlParams!;

/** A term narrowed to the keys given. */
function narrowedTerm(keys: string[]): SearchTerm {
  const [term] = addTerm([], 'x');
  return { ...term, chosen: keys };
}

/** Write, send through the URL layer exactly as the app does, and read back. */
function roundTrip(terms: SearchTerm[]): SearchTerm[] {
  const written = encodeMeanings(terms);
  const params = new URLSearchParams();
  params.set('m', written);
  const readBack = new URLSearchParams(params.toString()).get('m')!;
  const validated = validateOverlayParams(SPEC, { m: readBack }).m;
  return applyMeanings(
    terms.map((t) => ({ ...t, chosen: null })),
    validated ?? '',
  );
}

describe('sharing a narrowed search', () => {
  it('keeps both choices when one key has ayin and the next has aleph', () => {
    const terms = [narrowedTerm(['<LH/@heb']), narrowedTerm(['>MR[@heb'])];

    const restored = roundTrip(terms);

    expect(restored[0].chosen).toEqual(['<LH/@heb']);
    expect(restored[1].chosen).toEqual(['>MR[@heb']);
  });

  it('reaches the overlay with its brackets intact', () => {
    const terms = [narrowedTerm(['<LH/@heb'])];
    const written = encodeMeanings(terms);

    expect(written).toBe('<LH/@heb');
    expect(validateOverlayParams(SPEC, { m: written }).m).toBe(written);
  });

  it('refuses a value carrying anything a lexeme name cannot hold', () => {
    // Refused whole rather than edited, so a tampered link cannot half-apply.
    expect(validateOverlayParams(SPEC, { m: '<script>alert(1)</script>' }).m).toBeUndefined();
    expect(validateOverlayParams(SPEC, { m: '<LH/@heb but with spaces' }).m).toBeUndefined();
  });
});
