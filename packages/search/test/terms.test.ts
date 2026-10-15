import { describe, expect, it } from 'vitest';
import {
  addTerm,
  applyModes,
  effectiveMode,
  encodeModes,
  english,
  languageOf,
  modesOffered,
  setMode,
  setTermText,
  type ExtraMode,
  type SearchLanguage,
  type SearchTerm,
} from '../src/index.ts';

/** A language claiming any term that starts with x. */
const xs: SearchLanguage = { ...english, id: 'xs', claims: (term) => term.startsWith('x') };
const LANGUAGES = [xs, english];

/** A mode offered to x terms, possible while `x` is true, and their default. */
const tagged: ExtraMode<boolean> = {
  id: 'tagged',
  letter: 't',
  offered: (_term, language) => language.id === 'xs',
  possible: (x) => x === true,
  isDefault: (_term, language) => language.id === 'xs',
};

const one = (text: string): SearchTerm => addTerm([], text)[0];

describe('a term’s language', () => {
  it('is the first language claiming it, else the last', () => {
    expect(languageOf(LANGUAGES, one('xray')).id).toBe('xs');
    expect(languageOf(LANGUAGES, one('ray')).id).toBe('en');
  });
});

describe('a term’s mode', () => {
  it('is substring by default, with no extra mode', () => {
    expect(effectiveMode(one('xray'), LANGUAGES)).toBe('substring');
  });

  it('defaults to the extra mode where the mode says so', () => {
    expect(effectiveMode(one('xray'), LANGUAGES, tagged, true)).toBe('tagged');
    expect(effectiveMode(one('ray'), LANGUAGES, tagged, true)).toBe('substring');
  });

  it('falls back to whole word where the extra mode is not possible', () => {
    expect(effectiveMode(one('xray'), LANGUAGES, tagged, false)).toBe('word');
  });

  it('keeps a chosen mode across an edit to the text', () => {
    const added = addTerm([], 'ray');
    const terms = setMode(added, added[0].id, 'word');
    const edited = setTermText(terms, terms[0].id, 'rays');
    expect(effectiveMode(edited[0], LANGUAGES)).toBe('word');
  });

  it('offers the extra mode only where it says', () => {
    expect(modesOffered(one('xray'), LANGUAGES, tagged)).toEqual(['substring', 'word', 'tagged']);
    expect(modesOffered(one('ray'), LANGUAGES, tagged)).toEqual(['substring', 'word']);
    expect(modesOffered(one('xray'), LANGUAGES)).toEqual(['substring', 'word']);
  });
});

describe('the modes in a link', () => {
  it('round-trip, the extra mode by its own letter', () => {
    let terms = addTerm(addTerm(addTerm([], 'a'), 'b'), 'xc');
    terms = setMode(terms, terms[0].id, 'word');
    terms = setMode(terms, terms[2].id, 'tagged');
    const encoded = encodeModes(terms, tagged);
    expect(encoded).toBe('w,,t');

    const fresh = addTerm(addTerm(addTerm([], 'a'), 'b'), 'xc');
    expect(applyModes(fresh, encoded, tagged).map((t) => t.mode)).toEqual(['word', null, 'tagged']);
  });

  it('ignore the extra mode’s letter for a search without one', () => {
    const fresh = addTerm([], 'xc');
    expect(applyModes(fresh, 't')[0].mode).toBeNull();
  });
});

describe('editing a term', () => {
  it('forgets the extra mode’s choice', () => {
    const terms = addTerm([], 'xray').map((t) => ({ ...t, chosen: ['k'] }));
    expect(setTermText(terms, terms[0].id, 'xrays')[0].chosen).toBeNull();
  });
});
