import { describe, expect, it } from 'vitest';
import { englishCitationFinder, englishCitationsByPlace } from '../englishCitations.ts';

const find = englishCitationFinder([
  { name: 'Genesis', chapters: [31, 25] },
  { name: 'Numbers', chapters: [54, 34, 51, 49, 89, 73] },
  { name: 'Hosea', chapters: [11, 25, 5, 19, 15, 11] },
  { name: 'I Samuel', chapters: [28, 36] },
  { name: 'II Samuel', chapters: [27, 32] },
]);

const linked = (marked: string) =>
  find(marked).citations.map((c) => [c.verse, englishOf(marked).slice(c.start, c.end)]);
const englishOf = (marked: string) => marked.replace(/[*_]/g, '');

describe('the references in the English', () => {
  it('links the parenthesised words to the verse they name', () => {
    expect(linked('as it says *“Be fruitful”* (Genesis 1:28) and so')).toEqual([
      ['Genesis.1.28', '(Genesis 1:28)'],
    ]);
  });

  it('counts the text without its bold and italic markers', () => {
    expect(linked('*bold _and_ more* (Genesis 2:3)')).toEqual([['Genesis.2.3', '(Genesis 2:3)']]);
  });

  it('links a range, and a list, to the first verse', () => {
    expect(linked('(Numbers 3:2–6)')[0][0]).toBe('Numbers.3.2');
    expect(linked('(Numbers 3:2, 7, 12)')[0][0]).toBe('Numbers.3.2');
    expect(linked('(Genesis 1:3; Numbers 2:4)')[0][0]).toBe('Genesis.1.3');
  });

  it('reads a numbered book', () => {
    expect(linked('(I Samuel 2:3) and (II Samuel 2:3)').map(([verse]) => verse)).toEqual([
      'I.Samuel.2.3',
      'II.Samuel.2.3',
    ]);
  });

  it('reads the slips in how a book is written', () => {
    expect(linked('(i Samuel 2:3) (Number 5:22) (Hoshea 5:6) (Genesis:1:3) (Genesis1:4)')).toEqual([
      ['I.Samuel.2.3', '(i Samuel 2:3)'],
      ['Numbers.5.22', '(Number 5:22)'],
      ['Hosea.5.6', '(Hoshea 5:6)'],
      ['Genesis.1.3', '(Genesis:1:3)'],
      ['Genesis.1.4', '(Genesis1:4)'],
    ]);
  });

  it('reads a book name written with a non-breaking space', () => {
    expect(linked('(I\u00a0Samuel 2:3)')).toEqual([['I.Samuel.2.3', '(I\u00a0Samuel 2:3)']]);
  });

  it('links a reference that follows “see” or “e.g.”', () => {
    expect(linked('(see, e.g., Genesis 1:3) (e.g., Numbers 5:22) (see Genesis 2:1)')).toHaveLength(
      3,
    );
  });

  it('leaves a book outside the Tanakh, and other parentheses, plain', () => {
    expect(
      linked('(Ben Sira 3:2) (Tosefta, Terumot 1:1) (Terumot 1:1) (Genesis 1) (on Job 2:5)'),
    ).toEqual([]);
    expect(find('(Tosefta, Genesis 1:1)').citations).toEqual([]);
  });

  it('reports a verse the book does not have, and links nothing for it', () => {
    const found = find('(Genesis 2:99)');
    expect(found.citations).toEqual([]);
    expect(found.unlinked.map((u) => u.reference)).toEqual(['(Genesis 2:99)']);
  });

  it('collects the references by amud and segment', () => {
    const found = englishCitationsByPlace([['a', 'b (Genesis 1:1)'], []], find);
    expect(found.citations).toEqual({
      0: { 1: [{ start: 2, end: 15, verse: 'Genesis.1.1' }] },
    });
  });
});
