// The dictionary is loaded partway through this file: the first test starts
// without it.
import { describe, it, expect } from 'vitest';
import {
  addTerm,
  applyMeanings,
  encodeMeanings,
  lookUpMeaningsAgain,
  setTermText,
} from '../../search/terms';
import { loadLexiconData } from '../../search';

// "Be light", one of the words אור can be.
const BE_LIGHT = '>WR[@heb';

describe('a link’s choice of meaning, before the dictionary arrives', () => {
  it('is kept in the link, and applied once the dictionary is in', async () => {
    const early = applyMeanings(addTerm([], 'אור'), BE_LIGHT);
    expect(encodeMeanings(early)).toBe(BE_LIGHT);

    await loadLexiconData();
    const late = lookUpMeaningsAgain(early);

    const fromLink = applyMeanings(addTerm([], 'אור'), BE_LIGHT);
    expect(late[0].selected.size).toBe(1);
    expect(late[0].selected).toEqual(fromLink[0].selected);
    expect(encodeMeanings(late)).toBe(encodeMeanings(fromLink));
  });

  it('is dropped when the reader retypes the word', () => {
    const [term] = addTerm([], 'אור');
    const held = [{ ...term, meanings: [], selected: new Set<string>(), chosen: [BE_LIGHT] }];
    expect(setTermText(held, term.id, 'אורה')[0].chosen).toBeUndefined();
  });
});
