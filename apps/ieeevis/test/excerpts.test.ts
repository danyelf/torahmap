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

  it('takes a whole word when the hit is part of one', () => {
    expect(hitExcerpt('alpha beta gamma', [{ start: 7, end: 9 }], 0)).toBe('…beta…');
  });

  it('is null without a hit', () => {
    expect(hitExcerpt(text, [])).toBeNull();
  });
});

describe('the excerpt shown with no search', () => {
  const filler = (n: number) => Array.from({ length: n }, () => 'ordinary').join(' ');
  const sentence = (n: number, word: string) => `${word} ${filler(n - 2)} words.`;
  const rarity = (word: string) => (word === 'unusual' ? 5 : 1);
  const input = (method: 'first' | 'rare' | 'keywords', keywords: string[] = []) => ({
    method,
    rarity,
    keywords,
  });
  const text = [sentence(12, 'Plain'), sentence(12, 'Unusual'), sentence(12, 'Sampling')].join(' ');

  it('begins at the first sentence', () => {
    expect(defaultExcerpt(text, input('first')).startsWith('Plain')).toBe(true);
  });

  it('can choose the sentence with the rarest words', () => {
    expect(defaultExcerpt(text, input('rare')).startsWith('Unusual')).toBe(true);
  });

  it('can choose the sentence that uses the paper’s keywords', () => {
    expect(defaultExcerpt(text, input('keywords', ['sampling'])).startsWith('Sampling')).toBe(true);
  });

  it('cuts a long sentence to about twenty words', () => {
    const cut = defaultExcerpt(sentence(60, 'Long'), input('first'));
    expect(cut.split(' ')).toHaveLength(20);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('does not end a sentence at an abbreviation', () => {
    const quoted = `Smith et al. showed ${filler(10)} words. Next ${filler(10)} words.`;
    expect(defaultExcerpt(quoted, input('first')).startsWith('Smith et al. showed')).toBe(true);
    expect(defaultExcerpt(quoted, input('first'))).not.toContain('Next');
  });

  it('is empty for an empty text', () => {
    expect(defaultExcerpt('', input('first'))).toBe('');
  });
});
