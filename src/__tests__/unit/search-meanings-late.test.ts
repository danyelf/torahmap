// The dictionary is loaded partway through this file: the first test starts
// without it.
import { describe, it, expect } from 'vitest';
import {
  addTerm,
  applyMeanings,
  encodeMeanings,
  lookUpMissingMeanings,
  setTermText,
} from '../../search/terms';
import { loadLexiconData } from '../../search';

// "Be light", one of the words אור can be.
const BE_LIGHT = '>WR[@heb';

describe('meanings for terms made before the dictionary arrives', () => {
  it('are looked up when it does: all checked for a typed word, the link’s choice for a linked one', async () => {
    const [typed] = addTerm([], 'אור');
    const linked = applyMeanings(addTerm([], 'אור'), BE_LIGHT);
    expect(typed.meanings).toEqual([]);
    expect(encodeMeanings(linked)).toBe(BE_LIGHT);

    await loadLexiconData();
    const [typedLate] = lookUpMissingMeanings([typed]);
    const [linkedLate] = lookUpMissingMeanings(linked);

    expect(typedLate.id).toBe(typed.id);
    expect(typedLate.meanings.length).toBeGreaterThan(0);
    expect(typedLate.selected.size).toBe(typedLate.meanings.length);

    const fromLink = applyMeanings(addTerm([], 'אור'), BE_LIGHT);
    expect(linkedLate.selected.size).toBe(1);
    expect(linkedLate.selected).toEqual(fromLink[0].selected);
    expect(encodeMeanings([linkedLate])).toBe(encodeMeanings(fromLink));
  });

  it('leaves a term that has its meanings as it is, with the reader’s choices', async () => {
    await loadLexiconData();
    const [term] = addTerm([], 'אור');
    const narrowed = { ...term, selected: new Set([term.meanings[0].keys[0]]) };
    expect(lookUpMissingMeanings([narrowed])[0]).toBe(narrowed);
  });

  it('holds no link choice for a word the loaded dictionary does not know', async () => {
    await loadLexiconData();
    const [term] = applyMeanings(addTerm([], 'light'), BE_LIGHT);
    expect(term.linkMeanings).toBeUndefined();
    expect(encodeMeanings([term])).toBe('');
  });

  it('drops a held link choice when the reader retypes the word', () => {
    const [term] = addTerm([], 'אור');
    const held = [{ ...term, meanings: [], selected: new Set<string>(), linkMeanings: [BE_LIGHT] }];
    expect(setTermText(held, term.id, 'אורה')[0].linkMeanings).toBeUndefined();
  });
});
