import { describe, expect, it } from 'vitest';
import { englishText } from '../src/english.ts';

describe('englishText', () => {
  it('reads bold and italic stretches, and drops the markers', () => {
    expect(englishText('*Rava said:* the _Shema_')).toEqual({
      text: 'Rava said: the Shema',
      styles: [
        { start: 0, end: 10, style: 'bold' },
        { start: 15, end: 20, style: 'italic' },
      ],
    });
  });

  it('reads italic inside bold, and bold inside italic', () => {
    expect(englishText('*a _b_ c*').styles).toEqual([
      { start: 2, end: 3, style: 'italic' },
      { start: 0, end: 5, style: 'bold' },
    ]);
    expect(englishText('_a *b*_').styles).toEqual([
      { start: 2, end: 3, style: 'bold' },
      { start: 0, end: 3, style: 'italic' },
    ]);
  });

  it('reads a marker at either edge of the text', () => {
    expect(englishText('*all*')).toEqual({
      text: 'all',
      styles: [{ start: 0, end: 3, style: 'bold' }],
    });
  });

  it('ends a stretch left open with the text', () => {
    expect(englishText('a *b').styles).toEqual([{ start: 2, end: 3, style: 'bold' }]);
  });

  it('reads empty text, and empty stretches, as nothing', () => {
    expect(englishText('')).toEqual({ text: '', styles: [] });
    expect(englishText('a**')).toEqual({ text: 'a', styles: [] });
  });
});
