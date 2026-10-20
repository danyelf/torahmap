import { describe, expect, it } from 'vitest';
import { english, matchRanges } from '@torahmap/search';
import { englishSearchText, englishText, searchedStretches } from '../src/english.ts';

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

  it('reads empty text as nothing', () => {
    expect(englishText('')).toEqual({ text: '', styles: [] });
  });
});

describe('what search reads of the English', () => {
  const phrase = (text: string, needle: string) =>
    matchRanges(english.fold(text), english.fold(needle), { mode: 'word', language: english });

  it('is the bold, without the explanation around it', () => {
    const searched = englishSearchText('*The Rabbis say:* the _Shema_ *until midnight.*');
    expect(phrase(searched, 'rabbis')).toHaveLength(1);
    expect(phrase(searched, 'midnight')).toHaveLength(1);
    expect(phrase(searched, 'shema')).toHaveLength(0);
  });

  it('runs a phrase across bold split only by a space, and not across the explanation', () => {
    expect(phrase(englishSearchText('*From when* *does one recite*'), 'when does')).toHaveLength(1);
    expect(phrase(englishSearchText('*From when,* that is, *does one*'), 'when does')).toHaveLength(
      0,
    );
    expect(phrase(englishSearchText('*From when,* that is, *does one*'), 'when that')).toHaveLength(
      0,
    );
  });

  it('is nothing for English with no bold', () => {
    expect(englishSearchText('only _explanation_')).toBe('');
  });

  it('stretches over the bold of the plain text, joined where only a space parts them', () => {
    const { text, styles } = englishText('*a* *b* c *d* _e_');
    expect(searchedStretches(text, styles).map(({ start, end }) => text.slice(start, end))).toEqual(
      ['a b', 'd'],
    );
  });
});
