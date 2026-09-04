// Root-mode search and related-word suggestions, exercised against the real
// generated lexeme index.
//
// Two ideas are being tested and they are easy to confuse:
//
//   readings   -- the dictionary words a written form could be. עלה could be
//                 the verb "ascend", the noun "burnt-offering", the noun
//                 "leafage", and more. A root-mode search looks for all of them.
//   relatives  -- words built from the same root as one of those readings.
//                 They are offered as clickable suggestions, never folded into
//                 the results.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildSearchIndex,
  search,
  findLexemesForWord,
  getLexeme,
  getLexemeForm,
  getRelatedLexemes,
  loadLexiconData,
  computeSnippetForMatch,
  stripNikkud,
} from '../../search';
import type { VerseTexts } from '../../verseTexts';

import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const lexiconPath = path.join(dataDir, 'lexicon.json');
const formsPath = path.join(dataDir, 'word-lexemes.json');
const versesPath = path.join(dataDir, 'verse-lexemes.json');
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
  new Set(results.map(r => `${r.book}:${r.chapter}:${r.verse}`));

describe.skipIf(!dataExists)('Root-mode search over the lexeme index', () => {
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
      expect(readings!.map(id => getLexeme(id)!.gloss)).toContain('laugh');
    });

    it('finds both Isaac and "laugh" for יצחק, which is spelled alike', () => {
      const readings = findLexemesForWord('יצחק')!;
      const glosses = readings.map(id => getLexeme(id)!.gloss);
      expect(glosses).toContain('Isaac');
      expect(glosses).toContain('laugh');
    });

    it('strips a prefix when the word as typed is not in the text (ובראשית)', () => {
      const readings = findLexemesForWord('ובראשית');
      expect(readings).not.toBeNull();
      expect(readings!.map(id => getLexeme(id)!.gloss)).toContain('beginning');
    });

    it('accepts a bare dictionary spelling that never stands alone (מלוכה)', () => {
      const readings = findLexemesForWord('מלוכה');
      expect(readings).not.toBeNull();
      expect(readings!.map(id => getLexeme(id)!.gloss)).toContain('kingship');
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
      const results = keys(search('אמר', false, 'root'));
      expect(results.has('Genesis:1:3')).toBe(true);
      expect(results.size).toBeGreaterThan(2000);
    });

    it('finds Genesis 19:14 when searching צחק (it has כִּמְצַחֵק)', () => {
      expect(keys(search('צחק', false, 'root')).has('Genesis:19:14')).toBe(true);
    });

    it('marks a verse with every term that matched it', () => {
      const results = search('צחק,יצחק', false, 'root');
      const gen1914 = results.find(
        r => r.book === 'Genesis' && r.chapter === 19 && r.verse === 14
      );
      expect(gen1914).toBeDefined();
      expect(gen1914!.matchingTerms.map(m => m.termIndex).sort()).toEqual([0, 1]);
    });

    it('does not drag the Hebrew preposition על into a search for עלה', () => {
      // This is the failure the old concordance numbering forced: על "upon"
      // occurs some 5,700 times, so folding it into עלה swamped the results.
      const readings = findLexemesForWord('עלה')!;
      expect(readings.map(id => getLexeme(id)!.pos)).not.toContain('prep');
      expect(readings.map(id => getLexeme(id)!.gloss)).toContain('ascend');

      const ascend = keys(search('עלה', false, 'root'));
      const upon = keys(search('על', false, 'root'));
      expect(ascend.size).toBeLessThan(upon.size / 2);
    });

    it('highlights the word that was typed, not another word sharing a reading', () => {
      // Genesis 19:28 has both עַל and עָלָה. A search for עלה must land on עלה.
      const [result] = search('עלה', false, 'root').filter(
        r => r.book === 'Genesis' && r.chapter === 19 && r.verse === 28
      );
      expect(result).toBeDefined();
      const snippet = computeSnippetForMatch(result, 0, 'עלה')!;
      const matched = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);
      expect(stripNikkud(matched).replace(/[^א-ת]/g, '')).toBe('עלה');
    });

    it('falls back to whole-word search for a term with no reading', () => {
      // A nonsense string finds nothing rather than throwing.
      expect(search('קקקקקקק', false, 'root')).toEqual([]);
    });
  });

  describe('related words', () => {
    const familyOf = (word: string) => getRelatedLexemes(findLexemesForWord(word)!);

    it('suggests words built from the same root (מלכ -> kingdom)', () => {
      const glosses = familyOf('מלכ').map(r => r.gloss);
      expect(glosses).toContain('kingdom');
    });

    it('suggests derived nouns for a verb (זכר -> remembrance)', () => {
      const glosses = familyOf('זכר').map(r => r.gloss);
      expect(glosses).toContain('remembrance');
    });

    it('never suggests a word the search already resolved to', () => {
      const readings = findLexemesForWord('דבר')!;
      const suggested = new Set(getRelatedLexemes(readings).map(r => r.lexemeId));
      for (const reading of readings) {
        expect(suggested.has(reading)).toBe(false);
      }
    });

    it('suggests only words that actually share a root', () => {
      // דבר is spelled the same as דֶּבֶר "pest" and the place name Debir.
      // Those are readings of the written form, not relatives, and nothing
      // outside the root family may be suggested.
      const readings = findLexemesForWord('דבר')!;
      const rootsSearched = new Set(
        readings.map(id => {
          const lexeme = getLexeme(id)!;
          return `${lexeme.root ?? lexeme.id.replace(/[/[]/g, '')}|${lexeme.language}`;
        })
      );
      for (const related of getRelatedLexemes(readings)) {
        const lexeme = getLexeme(related.lexemeId)!;
        const key = `${lexeme.root ?? lexeme.id.replace(/[/[]/g, '')}|${lexeme.language}`;
        expect(rootsSearched.has(key)).toBe(true);
      }
    });

    it('never suggests a function word', () => {
      for (const word of ['מלכ', 'זכר', 'דבר', 'ספר', 'עלה']) {
        for (const related of familyOf(word)) {
          expect(getLexeme(related.lexemeId)!.pos).not.toBe('prep');
          expect(getLexeme(related.lexemeId)!.pos).not.toBe('conj');
          expect(getLexeme(related.lexemeId)!.pos).not.toBe('art');
        }
      }
    });

    it('offers a written form that finds the suggested word again', () => {
      for (const related of familyOf('מלכ')) {
        expect(related.searchForm).toBeTruthy();
        const found = findLexemesForWord(related.searchForm);
        expect(found).not.toBeNull();
        expect(found).toContain(related.lexemeId);
      }
    });

    it('lists each dictionary form once', () => {
      const forms = familyOf('ספר').map(r => r.form);
      expect(forms.length).toBe(new Set(forms).size);
    });

    it('returns nothing for a lexeme that does not exist', () => {
      expect(getRelatedLexemes([999999])).toEqual([]);
    });
  });
});
