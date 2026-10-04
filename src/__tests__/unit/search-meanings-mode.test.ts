// Meanings-mode search, exercised against the real generated lexeme index.
//
// The idea under test is a reading: one of the dictionary words a written form
// could be. עלה could be the verb "ascend", the noun "burnt-offering", the noun
// "leafage", and more. A meanings-mode search looks for all of them.
import { verseId } from '@torahmap/link';

import { describe, it, expect } from 'vitest';
import { excerptOf } from '../helpers/excerpt';
import { findLexemesForWord, getLexeme } from '../../search';
import { addTerm, onlyMeaning } from '../../search/terms';
import { excerpt } from '../../overlays/search/highlight';
import { stripNikkud } from '../../hebrew';

import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { realSearchData } from '../helpers/searchData';

const keys = (results: Array<{ book: string; chapter: number; verse: number }>) =>
  new Set(results.map((r) => verseId(r.book, r.chapter, r.verse)));

describe('Meanings-mode search over the lexeme index', () => {
  const { index, dictionary, parse } = realSearchData();

  describe('resolving a written form to its readings', () => {
    it('finds the verb צחק "laugh"', () => {
      const readings = findLexemesForWord(dictionary, 'צחק');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(dictionary, id)!.gloss)).toContain('laugh');
    });

    it('finds both Isaac and "laugh" for יצחק, which is spelled alike', () => {
      const readings = findLexemesForWord(dictionary, 'יצחק')!;
      const glosses = readings.map((id) => getLexeme(dictionary, id)!.gloss);
      expect(glosses).toContain('Isaac');
      expect(glosses).toContain('laugh');
    });

    it('resolves a prefixed word straight from the table (בראשית)', () => {
      // The whole printed word is filed under its stem's lexeme; nothing here
      // notices the ב.
      const readings = findLexemesForWord(dictionary, 'בראשית');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(dictionary, id)!.gloss)).toEqual(['beginning']);
    });

    it('returns null for a form that is never printed (ובראשית)', () => {
      // ובראשית appears nowhere in the Tanakh. Stripping the ו would guess at a
      // word the reader cannot have copied off the page; null is the answer.
      expect(findLexemesForWord(dictionary, 'ובראשית')).toBeNull();
    });

    it('accepts a bare dictionary spelling that never stands alone (מלוכה)', () => {
      const readings = findLexemesForWord(dictionary, 'מלוכה');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(dictionary, id)!.gloss)).toContain('kingship');
    });

    it('returns null for something that is not a Hebrew word', () => {
      expect(findLexemesForWord(dictionary, 'קקקקקקק')).toBeNull();
    });

    it('reports a vocalized dictionary form for display', () => {
      const [first] = findLexemesForWord(dictionary, 'ברא')!;
      expect(getLexeme(dictionary, first)!.form).toBe('ברא');
      expect(getLexeme(dictionary, first)!.gloss).toBe('create');
    });
  });

  describe('searching', () => {
    it('finds every inflected form of a verb, not just the one typed', () => {
      // Genesis 1:3 has וַיֹּאמֶר; the search term is the bare verb.
      const results = keys(searchInMeaningsMode(index, dictionary, 'אמר'));
      expect(results.has('Genesis.1.3')).toBe(true);
      expect(results.size).toBeGreaterThan(2000);
    });

    it('finds Genesis 19:14 when searching צחק (it has כִּמְצַחֵק)', () => {
      expect(keys(searchInMeaningsMode(index, dictionary, 'צחק')).has('Genesis.19.14')).toBe(true);
    });

    it('marks a verse with every term that matched it', () => {
      const results = searchInMeaningsMode(index, dictionary, 'צחק,יצחק');
      const gen1914 = results.find(
        (r) => r.book === 'Genesis' && r.chapter === 19 && r.verse === 14,
      );
      expect(gen1914).toBeDefined();
      expect(gen1914!.matchingTerms.map((m) => m.termIndex).sort()).toEqual([0, 1]);
    });

    it('does not drag the Hebrew preposition על into a search for עלה', () => {
      // The Hebrew על "upon" is in 4,487 verses and cannot be written עלה, so
      // folding it in swamps the results. The Aramaic preposition can be
      // written עלה, is a word, and is worth 86 verses — that collision costs
      // far less than keeping it out.
      const readings = findLexemesForWord(dictionary, 'עלה')!;
      const prepositions = readings
        .map((id) => getLexeme(dictionary, id)!)
        .filter((l) => l.pos === 'prep');
      expect(prepositions.map((l) => l.language)).toEqual(['arc']);
      expect(readings.map((id) => getLexeme(dictionary, id)!.gloss)).toContain('ascend');

      const ascend = keys(searchInMeaningsMode(index, dictionary, 'עלה'));
      const upon = keys(searchInMeaningsMode(index, dictionary, 'על'));
      expect(ascend.size).toBeLessThan(upon.size / 2);
    });

    it('highlights the word that was typed, not another word sharing a reading', () => {
      // Genesis 19:28 has both עַל and עָלָה. A search for עלה must land on עלה.
      const [result] = searchInMeaningsMode(index, dictionary, 'עלה').filter(
        (r) => r.book === 'Genesis' && r.chapter === 19 && r.verse === 28,
      );
      expect(result).toBeDefined();
      const snippet = excerptOf(result, 'עלה', 'meanings', index, dictionary, parse)!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(stripNikkud(matched).replace(/[^א-ת]/g, '')).toBe('עלה');
    });

    it('highlights the word of the meaning chosen, not another reading of the spelling', () => {
      // Genesis 8:20: וַיַּעַל עֹלֹת — "and he offered burnt offerings".
      const [added] = addTerm([], 'עלה');
      const [term] = onlyMeaning([added], added.id, ['<LH/@heb']);
      const verse = { book: 'Genesis', chapter: 8, verse: 20 };
      const snippet = excerpt({ ...verse, matchingTerms: [] }, term, index, dictionary, parse)!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(stripNikkud(matched).replace(/[^א-ת]/g, '')).toBe('עלת');
    });

    it('highlights one word of a word repeated', () => {
      // Isaiah 6:3: קָדוֹשׁ ׀ קָדוֹשׁ ׀ קָדוֹשׁ
      const verse = { book: 'Isaiah', chapter: 6, verse: 3 };
      const snippet = excerptOf(verse, 'קדוש', 'meanings', index, dictionary, parse)!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(stripNikkud(matched).replace(/[^א-ת]/g, '')).toBe('קדוש');
    });

    it('highlights both words of a name printed as two', () => {
      const [result] = searchInMeaningsMode(index, dictionary, 'בית אל').filter(
        (r) => r.book === 'Genesis' && r.chapter === 28 && r.verse === 19,
      );
      const snippet = excerptOf(result, 'בית אל', 'meanings', index, dictionary, parse)!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(
        stripNikkud(matched)
          .replace(/[^א-ת ]/g, ' ')
          .trim()
          .split(/\s+/),
      ).toEqual(['בית', 'אל']);
    });

    it('finds nothing for a word the dictionary does not know', () => {
      // ויאמר half typed.
      expect(searchInMeaningsMode(index, dictionary, 'ויאמ')).toEqual([]);
    });
  });
});
