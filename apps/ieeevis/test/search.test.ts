import { describe, expect, it } from 'vitest';
import type { Paper, Structure } from '../src/data.ts';
import { pieceEntries } from '../src/search.ts';

const paper = (index: number, pieces: string): Paper => ({
  index,
  title: 'A Title',
  authors: ['Ana Silva'],
  kind: 'Full VIS Paper',
  when: '',
  pieces,
  page: `https://ieeevis.org/year/2026/paper/${index}`,
});
const structure: Structure = {
  days: [
    {
      name: 'Mon',
      sessions: [{ name: 'S', start: '', papers: [paper(0, 'ai'), paper(1, 'xx')] }],
    },
  ],
};
const texts = { '0.0': 'The abstract.', '0.1': 'The introduction.' };

describe('what search reads', () => {
  const entries = [...pieceEntries({ structure, texts })];
  const text = (id: string) => entries.find((e) => e.id === id)?.text.en;

  it('gives a paper’s first piece its title and authors, and no other piece', () => {
    expect(text('0.0')).toContain('A Title');
    expect(text('0.0')).toContain('Ana Silva');
    expect(text('0.1')).toBe('The introduction.');
  });

  it('leaves out a piece with no text, however the popup puts it', () => {
    expect(text('1.1')).toBeUndefined();
    expect(entries.map((e) => e.text.en).join(' ')).not.toMatch(/no text yet/i);
  });
});
