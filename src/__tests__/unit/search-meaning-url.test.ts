// A narrowed search has to survive being shared.
//
// ETCBC spells ayin `<` and aleph `>`, so two lexeme keys side by side read as
// an HTML tag: `<LH/@heb,>MR[@heb` is burnt-offering followed by "say". The URL
// layer strips tags out of free text, which would take the first key, the
// separator and half the second with them — and applyMeanings, finding nothing
// it recognises, would quietly fall back to every meaning. The reader would
// open the link and see a different search, with nothing saying so.

import { describe, it, expect } from 'vitest';
import { validateOverlayParams } from '../../urlState';
import { addTerm, applyMeanings, encodeMeanings, selectedKeys } from '../../search/terms';
import type { SearchTerm } from '../../search/terms';

const SPEC = [{ key: 'm', kind: 'text' }] as const;

/** A term standing in for a resolved word, narrowed to the keys given. */
function narrowedTerm(keys: string[], all: string[]): SearchTerm {
  const [term] = addTerm([], 'x');
  return {
    ...term,
    meanings: all.map((key) => ({
      keys: [key],
      form: key,
      gloss: key,
      pos: 'subs',
      language: 'heb' as const,
      verseCount: 1,
    })),
    selected: new Set(keys),
  };
}

/** Write, send through the URL layer exactly as the app does, and read back. */
function roundTrip(terms: SearchTerm[]): SearchTerm[] {
  const written = encodeMeanings(terms);
  const params = new URLSearchParams();
  params.set('m', written);
  const readBack = new URLSearchParams(params.toString()).get('m')!;
  const validated = validateOverlayParams(SPEC, { m: readBack }).m;
  return applyMeanings(
    terms.map((t) => ({ ...t, selected: new Set(t.meanings.map((m) => m.keys[0])) })),
    validated ?? '',
  );
}

describe('sharing a narrowed search', () => {
  it('keeps both choices when one key has ayin and the next has aleph', () => {
    const terms = [
      narrowedTerm(['<LH/@heb'], ['<LH/@heb', '<LH=/@heb']),
      narrowedTerm(['>MR[@heb'], ['>MR[@heb', '>MR/@heb']),
    ];

    const restored = roundTrip(terms);

    expect(selectedKeys(restored[0])).toEqual(['<LH/@heb']);
    expect(selectedKeys(restored[1])).toEqual(['>MR[@heb']);
  });

  it('writes nothing a tag-stripper can recognise', () => {
    const terms = [narrowedTerm(['<LH/@heb'], ['<LH/@heb', '>MR[@heb'])];
    expect(encodeMeanings(terms)).not.toMatch(/[<>]/);
  });

  it('still reads a link written before the keys were encoded', () => {
    // A one-key link with no closing bracket came through the stripper intact,
    // so those links exist and must keep working.
    const terms = [narrowedTerm(['<LH/@heb'], ['<LH/@heb', '<LH=/@heb'])];
    const restored = applyMeanings(
      terms.map((t) => ({ ...t, selected: new Set(t.meanings.map((m) => m.keys[0])) })),
      '<LH/@heb',
    );
    expect(selectedKeys(restored[0])).toEqual(['<LH/@heb']);
  });

  it('falls back to every meaning rather than throwing on a broken escape', () => {
    const terms = [narrowedTerm(['<LH/@heb'], ['<LH/@heb', '<LH=/@heb'])];
    const restored = applyMeanings(
      terms.map((t) => ({ ...t, selected: new Set(t.meanings.map((m) => m.keys[0])) })),
      '%ZZ',
    );
    expect(selectedKeys(restored[0])).toEqual(['<LH/@heb', '<LH=/@heb']);
  });
});
