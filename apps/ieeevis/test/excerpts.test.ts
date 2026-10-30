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
  const filler = (n: number) => Array.from({ length: n }, () => 'ordinary').join(' ');
  const sentence = (n: number, word: string) => `${word} ${filler(n - 2)} words.`;
  const rarity = (word: string) => (word === 'unusual' ? 5 : 1);
  const input = (keywords: string[] = []) => ({ rarity, keywords });
  const text = [sentence(20, 'Plain'), sentence(20, 'Unusual'), sentence(20, 'Sampling')].join(' ');

  it('chooses the sentence that uses the paper’s keywords', () => {
    expect(defaultExcerpt(text, input(['sampling'])).startsWith('…Sampling')).toBe(true);
  });

  it('without keywords chooses the sentence with the rarest words', () => {
    expect(defaultExcerpt(text, input()).startsWith('…Unusual')).toBe(true);
  });

  it('can take the opening instead', () => {
    expect(defaultExcerpt(text, { ...input(['sampling']), opening: true })).toMatch(/^Plain/);
  });

  it('marks an excerpt that stops before the text ends, and one that starts partway', () => {
    expect(defaultExcerpt(text, input()).endsWith('…')).toBe(true);
    const whole = sentence(20, 'Only');
    expect(defaultExcerpt(whole, input())).toBe(whole);
  });

  it('runs a short sentence on into the next', () => {
    const short = `${sentence(10, 'Short')} ${sentence(10, 'Next')}`;
    expect(defaultExcerpt(short, input())).toBe(short);
  });

  it('cuts a long sentence to about thirty words', () => {
    const cut = defaultExcerpt(sentence(60, 'Long'), input());
    expect(cut.split(' ')).toHaveLength(30);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('does not end a sentence at an abbreviation', () => {
    const quoted = `Smith et al. showed ${filler(20)} words. Next ${filler(20)} words.`;
    expect(defaultExcerpt(quoted, input()).startsWith('Smith et al. showed')).toBe(true);
    expect(defaultExcerpt(quoted, input())).not.toContain('Next');
  });

  it('is empty for an empty text', () => {
    expect(defaultExcerpt('', input())).toBe('');
  });
});
