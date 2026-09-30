import { describe, it, expect } from 'vitest';
import { addTerm, lookUpMissingMeanings } from '../../search/terms';
import { loadLexiconData } from '../../search';

describe('lookUpMissingMeanings', () => {
  it('gives a term typed before the dictionary arrived its meanings, all checked', async () => {
    const [early] = addTerm([], 'אור');
    expect(early.meanings).toEqual([]);

    await loadLexiconData();
    const [late] = lookUpMissingMeanings([early]);

    expect(late.id).toBe(early.id);
    expect(late.meanings.length).toBeGreaterThan(0);
    expect(late.selected.size).toBe(late.meanings.length);
  });

  it('leaves a term that has its meanings as it is, with the reader’s choices', async () => {
    await loadLexiconData();
    const [term] = addTerm([], 'אור');
    const narrowed = { ...term, selected: new Set([term.meanings[0].keys[0]]) };
    expect(lookUpMissingMeanings([narrowed])[0]).toBe(narrowed);
  });
});
