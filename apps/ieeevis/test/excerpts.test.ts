import { describe, expect, it } from 'vitest';
import { defaultExcerpt, hitExcerpt } from '../src/excerpts.ts';

const numbered = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => `w${i + from}`).join(' ');
const at = (text: string, word: string) => {
  const start = text.indexOf(word);
  return { start, end: start + word.length };
};

describe('the words around a hit', () => {
  const text = numbered(40);

  it('keeps ten words on either side', () => {
    expect(hitExcerpt(text, [at(text, 'w20')])).toBe(`…${numbered(21, 10)}…`);
  });

  it('reads several hits as one passage, with the words between them', () => {
    expect(hitExcerpt(text, [at(text, 'w15'), at(text, 'w25')], 2)).toBe(`…${numbered(15, 13)}…`);
  });

  it('has no ellipsis where the text itself ends', () => {
    expect(hitExcerpt(text, [at(text, 'w3')])).toBe(`${numbered(13)}…`);
    expect(hitExcerpt(text, [at(text, 'w38')])).toBe(`…${numbered(13, 28)}`);
  });

  it('leaves out the middle when hits are far apart', () => {
    expect(hitExcerpt(text, [at(text, 'w5'), at(text, 'w35')], 2, 10)).toBe(
      '…' + numbered(5, 3) + ' … ' + numbered(5, 33) + '…',
    );
  });

  it('takes a whole word when the hit is part of one', () => {
    expect(hitExcerpt('alpha beta gamma', [{ start: 7, end: 9 }], 0)).toBe('…beta…');
  });

  it('is null without a hit', () => {
    expect(hitExcerpt(text, [])).toBeNull();
  });
});

describe('the excerpt shown with no search', () => {
  const text = `${numbered(50)} sampling methods ${numbered(50, 51)}`;

  it('is the thirty words that hold the most keywords', () => {
    const excerpt = defaultExcerpt(text, ['Sampling Method', 'unrelated']);
    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).toContain('sampling methods');
    expect(excerpt.replace(/…/g, '').split(' ')).toHaveLength(30);
  });

  it('is the opening when no keyword appears', () => {
    expect(defaultExcerpt(text, ['absent'])).toBe(`${numbered(30)}…`);
    expect(defaultExcerpt(text, [])).toBe(`${numbered(30)}…`);
  });

  it('is the whole of a short text', () => {
    expect(defaultExcerpt('A short piece.', [])).toBe('A short piece.');
  });

  it('is empty for an empty text', () => {
    expect(defaultExcerpt('', [])).toBe('');
  });
});
