// Quality checks on the generated lexeme index.
//
// The index comes from the ETCBC BHSA database, which keeps words that merely
// share a spelling apart as separate dictionary entries. These tests read the
// generated files directly and assert the properties search.ts relies on.
//
// Regenerate the files with:
//   python3 scripts/generate-lexeme-index.py

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const lexiconPath = path.join(dataDir, 'lexicon.json');
const formsPath = path.join(dataDir, 'word-lexemes.json');
const versesPath = path.join(dataDir, 'verse-lexemes.json');

const dataExists =
  fs.existsSync(lexiconPath) && fs.existsSync(formsPath) && fs.existsSync(versesPath);

type LexemeRow = [string, string, string, string, 'heb' | 'arc', string | null];

const lexiconFile = dataExists
  ? (JSON.parse(fs.readFileSync(lexiconPath, 'utf-8')) as {
      source: string;
      fields: string[];
      functionWordPos: string[];
      lexemes: LexemeRow[];
    })
  : null;
const forms: Record<string, number[]> = dataExists
  ? JSON.parse(fs.readFileSync(formsPath, 'utf-8'))
  : {};
const verses: Record<string, number[]> = dataExists
  ? JSON.parse(fs.readFileSync(versesPath, 'utf-8'))
  : {};

const lexemes = lexiconFile?.lexemes ?? [];
const gloss = (id: number) => lexemes[id][2];
const etcbcId = (id: number) => lexemes[id][0];
const language = (id: number) => lexemes[id][4];

describe.skipIf(!dataExists)('Lexeme index', () => {
  describe('the dictionary', () => {
    it('names its source and column order', () => {
      expect(lexiconFile!.source).toMatch(/BHSA/);
      expect(lexiconFile!.fields).toEqual(['id', 'form', 'gloss', 'pos', 'lang', 'root']);
    });

    it('gives every lexeme an identifier, a display form and a part of speech', () => {
      expect(lexemes.length).toBeGreaterThan(8000);
      for (const [id, form, , pos, lang] of lexemes) {
        expect(id).toBeTruthy();
        expect(form).toBeTruthy();
        expect(pos).toBeTruthy();
        expect(['heb', 'arc']).toContain(lang);
      }
    });

    it('gives nearly every lexeme an English gloss', () => {
      const withGloss = lexemes.filter(row => row[2].length > 0).length;
      expect(withGloss / lexemes.length).toBeGreaterThan(0.99);
    });
  });

  describe('written forms', () => {
    it('are stored with final letters folded to their medial shape', () => {
      const finals = /[ךםןףץ]/;
      const offenders = Object.keys(forms).filter(form => finals.test(form));
      expect(offenders).toEqual([]);
    });

    it('all point at lexemes that exist', () => {
      for (const ids of Object.values(forms)) {
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
          expect(lexemes[id]).toBeTruthy();
        }
      }
    });

    it('keeps the several words spelled עלה apart instead of merging them', () => {
      // Under the old concordance numbering this written form was offered five
      // entries, one of which was the Aramaic preposition "upon" filed as if it
      // shared a root with the verb. Here each reading is its own dictionary
      // entry with its own gloss.
      const ids = forms['עלה'];
      expect(ids.length).toBeGreaterThan(1);

      const glosses = ids.map(gloss);
      expect(glosses).toContain('ascend');
      expect(new Set(glosses).size).toBe(glosses.length);

      // No preposition of either language is among them: עלה is a content word.
      expect(ids.map(id => lexemes[id][3])).not.toContain('prep');
    });

    it('indexes a function word only under its own spelling', () => {
      // The Aramaic preposition על carrying a pronominal suffix is written עלה,
      // "upon him". Filing that under the preposition would attach all 5,700 of
      // its occurrences to a search for the verb עלה "ascend", so suffixed and
      // prefixed forms of function words are left out of the index. The bare
      // spelling still resolves.
      expect(forms['על'].map(id => lexemes[id][3])).toContain('prep');
      expect(forms['עליו']).toBeUndefined();
      expect(forms['בו']).toBeUndefined();
    });

    it('separates the noun דבר "word" from the verb דבר "speak"', () => {
      const ids = forms['דבר'];
      const noun = ids.find(id => etcbcId(id) === 'DBR/');
      const verb = ids.find(id => etcbcId(id) === 'DBR[');
      expect(noun).toBeDefined();
      expect(verb).toBeDefined();
      expect(noun).not.toBe(verb);
      expect(gloss(noun!)).toBe('word');
      expect(gloss(verb!)).toBe('speak');
    });

    it('resolves a word carrying a possessive suffix (עבדיו)', () => {
      expect(forms['עבדיו']).toBeTruthy();
      expect(forms['עבדיו'].map(gloss)).toContain('servant');
    });

    it('resolves a word carrying a prefix without stripping it first (בדבר)', () => {
      expect(forms['בדבר']).toBeTruthy();
      expect(forms['בדבר'].map(gloss)).toContain('word');
    });

    it('files a whole printed word under the lexeme of its stem (בראשית)', () => {
      // BHSA treats the ב of בראשית as its own word. Filing the printed token
      // under the preposition would make a search for בראשית return a third of
      // the Bible, so it is filed under רֵאשִׁית instead.
      expect(forms['בראשית'].map(gloss)).toEqual(['beginning']);
    });

    it('lists the likeliest reading of an ambiguous form first', () => {
      // אמר "say" is one of the commonest verbs in the Bible; its Aramaic
      // namesake occurs a few dozen times.
      const [first] = forms['ויאמר'];
      expect(language(first)).toBe('heb');
    });
  });

  describe('verse keys', () => {
    it('covers every verse of the Tanakh the app displays', () => {
      const structure = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'tanakh-structure.json'), 'utf-8')
      ) as { books: Array<{ name: string; chapters: number[] }> };

      const missing: string[] = [];
      for (const book of structure.books) {
        book.chapters.forEach((verseCount, index) => {
          for (let verse = 1; verse <= verseCount; verse++) {
            const key = `${book.name}:${index + 1}:${verse}`;
            if (!verses[key]) missing.push(key);
          }
        });
      }
      expect(missing).toEqual([]);
    });

    it('uses Sefaria numbering where BHSA splits the Decalogue differently', () => {
      // BHSA gives each short prohibition its own verse and runs three ahead of
      // Sefaria for the rest of the chapter. The index follows Sefaria, so the
      // chapter must stop at 23 rather than 26.
      expect(verses['Exodus:20:23']).toBeTruthy();
      expect(verses['Exodus:20:24']).toBeUndefined();
      expect(verses['Deuteronomy:5:30']).toBeTruthy();
      expect(verses['Deuteronomy:5:31']).toBeUndefined();
    });

    it('moves the verse BHSA appends to Numbers 25 into Numbers 26', () => {
      expect(verses['Numbers:25:19']).toBeUndefined();
      expect(verses['Numbers:26:1']).toBeTruthy();
    });

    it('lists each lexeme of a verse once, in ascending order', () => {
      const genesis = verses['Genesis:1:1'];
      expect(genesis).toEqual([...new Set(genesis)].sort((a, b) => a - b));
      expect(genesis.map(gloss)).toContain('create');
      expect(genesis.map(gloss)).toContain('beginning');
    });
  });
});
