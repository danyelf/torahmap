import { describe, it, expect } from 'vitest';
import { termsToRecord, type Recorded } from '../../../overlays/search/recording';
import { addTerm, setMode, setTermText, type SearchTerm } from '../../../search/terms';
import type { Meaning } from '../../../search/dictionary';

const none: Recorded = new Map();

function meaning(key: string): Meaning {
  return { keys: [key], form: key, gloss: key, pos: 'subs', language: 'heb', verseCount: 1 };
}

describe('termsToRecord', () => {
  it('sends a term it has not recorded', () => {
    const terms = addTerm([], 'light');
    expect(termsToRecord(none, terms).send).toEqual(terms);
  });

  it('does not send a term again while it is unchanged', () => {
    const terms = addTerm([], 'light');
    const { recorded } = termsToRecord(none, terms);
    expect(termsToRecord(recorded, terms).send).toEqual([]);
  });

  it('sends only the term that is new when another is already recorded', () => {
    const one = addTerm([], 'light');
    const { recorded } = termsToRecord(none, one);
    const two = addTerm(one, 'dark');
    expect(termsToRecord(recorded, two).send).toEqual([two[1]]);
  });

  it('sends a term whose text changed', () => {
    const before = addTerm([], 'light');
    const { recorded } = termsToRecord(none, before);
    const after = setTermText(before, before[0].id, 'lights');
    expect(termsToRecord(recorded, after).send).toEqual(after);
  });

  it('sends a term whose mode changed', () => {
    const before = addTerm([], 'light');
    const { recorded } = termsToRecord(none, before);
    const after = setMode(before, before[0].id, 'word');
    expect(termsToRecord(recorded, after).send).toEqual(after);
  });

  it('sends a term whose chosen meanings changed', () => {
    const [plain] = addTerm([], 'עלה');
    const both: SearchTerm = {
      ...plain,
      meanings: [meaning('a'), meaning('b')],
      selected: new Set(['a', 'b']),
    };
    const { recorded } = termsToRecord(none, [both]);
    const narrowed = { ...both, selected: new Set(['a']) };
    expect(termsToRecord(recorded, [narrowed]).send).toEqual([narrowed]);
  });

  it('forgets a removed term, so bringing it back sends it again', () => {
    const terms = addTerm(addTerm([], 'light'), 'dark');
    const { recorded } = termsToRecord(none, terms);
    const without = termsToRecord(recorded, [terms[0]]);
    expect(without.send).toEqual([]);
    expect([...without.recorded.keys()]).toEqual([terms[0].id]);
    expect(termsToRecord(without.recorded, terms).send).toEqual([terms[1]]);
  });
});
