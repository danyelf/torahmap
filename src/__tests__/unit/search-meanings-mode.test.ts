// Meanings-mode search, exercised against the real generated lexeme index.
//
// The idea under test is a reading: one of the dictionary words a written form
// could be. עלה could be the verb "ascend", the noun "burnt-offering", the noun
// "leafage", and more. A meanings-mode search looks for all of them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildSearchIndex,
  search,
  findLexemesForWord,
  getLexeme,
  getLexemeForm,
  loadLexiconData,
  computeSnippetForMatch,
} from '../../search';
import { stripNikkud } from '../../hebrew';
import type { VerseTexts } from '../../verseTexts';

import * as fs from 'fs';
import * as path from 'path';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';

const dataDir = path.join(process.cwd(), 'public', 'data');
const searchDataDir = path.join(dataDir, 'search');
const lexiconPath = path.join(searchDataDir, 'lexicon.json');
const formsPath = path.join(searchDataDir, 'word-lexemes.json');
const versesPath = path.join(searchDataDir, 'verse-lexemes.json');
const allTextsPath = path.join(dataDir, 'all-texts.json');

const dataExists =
  fs.existsSync(lexiconPath) &&
  fs.existsSync(formsPath) &&
  fs.existsSync(versesPath) &&
  fs.existsSync(allTextsPath);

function mockFetchForLexiconData() {
  const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf-8'));
  const forms = JSON.parse(fs.readFileSync(formsPath, 'utf-8'));
  const verses = JSON.parse(fs.readFileSync(versesPath, 'utf-8'));

  global.fetch = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    let data: unknown;
    if (url.includes('lexicon.json')) data = lexicon;
    else if (url.includes('word-lexemes')) data = forms;
    else if (url.includes('verse-lexemes')) data = verses;
    else return Promise.resolve({ ok: false, status: 404 } as Response);

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
  });
}

const keys = (results: Array<{ book: string; chapter: number; verse: number }>) =>
  new Set(results.map((r) => `${r.book}:${r.chapter}:${r.verse}`));

describe.skipIf(!dataExists)('Meanings-mode search over the lexeme index', () => {
  beforeEach(async () => {
    buildSearchIndex(JSON.parse(fs.readFileSync(allTextsPath, 'utf-8')) as VerseTexts);
    mockFetchForLexiconData();
    await loadLexiconData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolving a written form to its readings', () => {
    it('finds the verb צחק "laugh"', () => {
      const readings = findLexemesForWord('צחק');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(id)!.gloss)).toContain('laugh');
    });

    it('finds both Isaac and "laugh" for יצחק, which is spelled alike', () => {
      const readings = findLexemesForWord('יצחק')!;
      const glosses = readings.map((id) => getLexeme(id)!.gloss);
      expect(glosses).toContain('Isaac');
      expect(glosses).toContain('laugh');
    });

    it('resolves a prefixed word straight from the table (בראשית)', () => {
      // The whole printed word is filed under its stem's lexeme; nothing here
      // notices the ב.
      const readings = findLexemesForWord('בראשית');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(id)!.gloss)).toEqual(['beginning']);
    });

    it('returns null for a form that is never printed (ובראשית)', () => {
      // ובראשית appears nowhere in the Tanakh. Stripping the ו would guess at a
      // word the reader cannot have copied off the page; null is the answer.
      expect(findLexemesForWord('ובראשית')).toBeNull();
    });

    it('accepts a bare dictionary spelling that never stands alone (מלוכה)', () => {
      const readings = findLexemesForWord('מלוכה');
      expect(readings).not.toBeNull();
      expect(readings!.map((id) => getLexeme(id)!.gloss)).toContain('kingship');
    });

    it('returns null for something that is not a Hebrew word', () => {
      expect(findLexemesForWord('קקקקקקק')).toBeNull();
    });

    it('reports a vocalized dictionary form for display', () => {
      const [first] = findLexemesForWord('ברא')!;
      expect(getLexemeForm(first)).toBe('ברא');
      expect(getLexeme(first)!.gloss).toBe('create');
    });
  });

  describe('searching', () => {
    it('finds every inflected form of a verb, not just the one typed', () => {
      // Genesis 1:3 has וַיֹּאמֶר; the search term is the bare verb.
      const results = keys(searchInMeaningsMode('אמר'));
      expect(results.has('Genesis:1:3')).toBe(true);
      expect(results.size).toBeGreaterThan(2000);
    });

    it('finds Genesis 19:14 when searching צחק (it has כִּמְצַחֵק)', () => {
      expect(keys(searchInMeaningsMode('צחק')).has('Genesis:19:14')).toBe(true);
    });

    it('marks a verse with every term that matched it', () => {
      const results = searchInMeaningsMode('צחק,יצחק');
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
      const readings = findLexemesForWord('עלה')!;
      const prepositions = readings.map((id) => getLexeme(id)!).filter((l) => l.pos === 'prep');
      expect(prepositions.map((l) => l.language)).toEqual(['arc']);
      expect(readings.map((id) => getLexeme(id)!.gloss)).toContain('ascend');

      const ascend = keys(searchInMeaningsMode('עלה'));
      const upon = keys(searchInMeaningsMode('על'));
      expect(ascend.size).toBeLessThan(upon.size / 2);
    });

    it('highlights the word that was typed, not another word sharing a reading', () => {
      // Genesis 19:28 has both עַל and עָלָה. A search for עלה must land on עלה.
      const [result] = searchInMeaningsMode('עלה').filter(
        (r) => r.book === 'Genesis' && r.chapter === 19 && r.verse === 28,
      );
      expect(result).toBeDefined();
      const snippet = computeSnippetForMatch(result, 0, 'עלה')!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(stripNikkud(matched).replace(/[^א-ת]/g, '')).toBe('עלה');
    });

    it('falls back to whole-word search for a term with no reading', () => {
      // A nonsense string finds nothing rather than throwing.
      expect(searchInMeaningsMode('קקקקקקק')).toEqual([]);
    });
  });
});
