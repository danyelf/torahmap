// Quality checks on the generated lexeme index.
//
// The index comes from the ETCBC BHSA database, which keeps words that merely
// share a spelling apart as separate dictionary entries. These tests read the
// generated files directly and assert the properties search.ts relies on.
//
// Regenerate the files with:
//   .venv/bin/python scripts/search/generate-lexeme-index.py
import { parseVerseId, verseId } from '@torahmap/link';

import { describe, it, expect } from 'vitest';
import { normalizeHebrewForSearch } from '../../hebrew';
import { wordsBhsaParsed } from '../../search/dictionary';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const searchDataDir = path.join(dataDir, 'search');
const lexiconPath = path.join(searchDataDir, 'lexicon.json');
const formsPath = path.join(searchDataDir, 'word-lexemes.json');
const versesPath = path.join(searchDataDir, 'verse-lexemes.json');
const morphologyPath = path.join(searchDataDir, 'verse-morphology.json');
const textsPath = path.join(dataDir, 'all-texts.json');
const generatorPath = path.join(process.cwd(), 'scripts', 'search', 'generate-lexeme-index.py');

const dataExists =
  fs.existsSync(lexiconPath) && fs.existsSync(formsPath) && fs.existsSync(versesPath);

type LexemeRow = [string, string, string, string, 'heb' | 'arc', string];

const lexiconFile = dataExists
  ? (JSON.parse(fs.readFileSync(lexiconPath, 'utf-8')) as {
      source: string;
      lexemes: LexemeRow[];
    })
  : null;
const forms: Record<string, number[]> = dataExists
  ? JSON.parse(fs.readFileSync(formsPath, 'utf-8'))
  : {};
const verses: Record<string, number[]> = dataExists
  ? JSON.parse(fs.readFileSync(versesPath, 'utf-8'))
  : {};

// verse-morphology.json is the finer-grained companion to verse-lexemes.json:
// where that file says which dictionary words a verse contains, this one says
// which word of the verse each of them is.
type MorphologyVerse = [Array<[number, number]>, number[], number[]];
const morphologyExists = dataExists && fs.existsSync(morphologyPath);
const morphologyFile = morphologyExists
  ? (JSON.parse(fs.readFileSync(morphologyPath, 'utf-8')) as {
      fields: string[];
      parsings: string[];
      verseFields: string[];
      realigned: Record<string, number[][]>;
      note: string;
      verses: Record<string, MorphologyVerse>;
    })
  : null;
const morphology = morphologyFile?.verses ?? {};
// Verses the two sources divide into words differently, where a position here
// does not name the same word the reader sees, and the lexemes of each word
// the page shows instead.
const realigned = morphologyFile?.realigned ?? {};

const lexemes = lexiconFile?.lexemes ?? [];
const gloss = (id: number) => lexemes[id][2];
const etcbcId = (id: number) => lexemes[id][0];
const language = (id: number) => lexemes[id][4];

describe.skipIf(!dataExists)('Lexeme index', () => {
  describe('the dictionary', () => {
    it('names its source', () => {
      expect(lexiconFile!.source).toMatch(/BHSA/);
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
      const withGloss = lexemes.filter((row) => row[2].length > 0).length;
      expect(withGloss / lexemes.length).toBeGreaterThan(0.99);
    });
  });

  describe('written forms', () => {
    it('are stored already folded, so typing one finds it', () => {
      // A key is what typing gets folded into, so folding it again must change
      // nothing. Covers every rule at once, including the ones a stale index
      // was built before.
      const offenders = Object.keys(forms).filter(
        (form) => normalizeHebrewForSearch(form) !== form,
      );
      expect(offenders.slice(0, 5)).toEqual([]);
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

    it("include each lexeme's commonest printed spelling, filed under it", () => {
      const misfiled = lexemes
        .map((row, id) => [row[5], id] as const)
        .filter(
          ([printed, id]) =>
            printed !== '' && !forms[normalizeHebrewForSearch(printed)]?.includes(id),
        );
      expect(misfiled).toEqual([]);
    });

    it('write that spelling as printed, with a final letter ending each word', () => {
      const medialAtEnd = lexemes.map((row) => row[5]).filter((p) => /[כמנפצ](\s|$)/.test(p));
      expect(medialAtEnd).toEqual([]);
    });

    it('keeps the several words spelled עלה apart instead of merging them', () => {
      const ids = forms['עלה'];
      expect(ids.length).toBeGreaterThan(1);

      const glosses = ids.map(gloss);
      expect(glosses).toContain('ascend');
      expect(new Set(glosses).size).toBe(glosses.length);

      // The Aramaic על with a suffix is written עלה and is offered; the Hebrew
      // על, a different word in 4,487 verses, could never be.
      const prepositions = ids.filter((id) => lexemes[id][3] === 'prep');
      expect(prepositions.map(language)).toEqual(['arc']);
    });

    it('resolves a preposition carrying a pronominal suffix (עליו, בו)', () => {
      // עליו is "upon him" and בו is "in it": among the commonest words in the
      // Bible, and both missing from this table until the word rule. Their
      // absence is what let meanings mode answer עליו with עֶלְיֹון "most high",
      // a different word that merely starts with the same four letters.
      expect(forms['על'].map((id) => lexemes[id][3])).toContain('prep');
      expect(forms['עליו'].map(gloss)).toEqual(['upon']);
      expect(forms['בו'].map(gloss)).toEqual(['in']);
      expect(forms['עליו'].map((id) => lexemes[id][1])).not.toContain('עֶלְיֹון');
    });

    it('separates the noun דבר "word" from the verb דבר "speak"', () => {
      const ids = forms['דבר'];
      const noun = ids.find((id) => etcbcId(id) === 'DBR/');
      const verb = ids.find((id) => etcbcId(id) === 'DBR[');
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

  // BHSA counts in morphemes, not in printed words: the ו of ויאמר and the ב of
  // בראשית are units of their own. A unit with nothing printed after it runs
  // straight into the next, so it is part of a word rather than a word, and it
  // is not indexed and puts no lexeme into its verse.
  //
  // These are the tripwires for that rule. It is meant to cut fragments and
  // leave words alone, so the two halves are asserted separately: a change in
  // the first block means it has reached a real word.
  describe('what counts as a word', () => {
    const lexemeFor = (id: string, lang: 'heb' | 'arc') => {
      const found = lexemes.findIndex((row) => row[0] === id && row[4] === lang);
      expect(found, `no ${lang} lexeme ${id} in the dictionary`).toBeGreaterThanOrEqual(0);
      return found;
    };

    const verseCount = (lexeme: number) =>
      Object.values(verses).filter((ids) => ids.includes(lexeme)).length;

    it('leaves the words that stand on their own untouched', () => {
      // All printed with a space after them, always, so the rule cannot touch
      // them: these counts are what they were before it, to the verse.
      expect(verseCount(lexemeFor('<L', 'heb'))).toBe(4487); // על "upon"
      expect(verseCount(lexemeFor('>T', 'heb'))).toBe(6783); // את, object marker
      expect(verseCount(lexemeFor('L>', 'heb'))).toBe(3945); // לא "not"
      expect(verseCount(lexemeFor('KJ', 'heb'))).toBe(3908); // כי "that"
      expect(verseCount(lexemeFor('>CR', 'heb'))).toBe(4438); // אשר, relative
    });

    it('leaves nothing behind for a proclitic, which is never a word', () => {
      // ו "and" and ה "the" are printed stuck to what follows, without a single
      // exception in the whole Bible. They are not words and match no verse.
      expect(verseCount(lexemeFor('W', 'heb'))).toBe(0);
      expect(verseCount(lexemeFor('H', 'heb'))).toBe(0);
      expect(verseCount(lexemeFor('W', 'arc'))).toBe(0);
    });

    it('keeps the suffixed forms of a preposition, which are words', () => {
      // ל is two different things wearing one dictionary entry. Stuck to a noun
      // it is a proclitic; carrying a suffix it is לוֹ, לָהֶם, לְךָ, printed words
      // in their own right. The rule keeps the second and drops the first, so
      // the count falls a long way without reaching zero.
      const to = verseCount(lexemeFor('L', 'heb'));
      expect(to).toBeGreaterThan(3000);
      expect(to).toBeLessThan(5000);
      expect(forms['לו'].map(gloss)).toContain('to');
    });
  });

  describe('verse keys', () => {
    it('gives every verse the app displays at least one dictionary word', () => {
      // Iterate the structure, not the file's own keys: the generator creates a
      // key only when it adds a lexeme, so an emptied verse goes missing.
      const structure = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'tanakh-structure.json'), 'utf-8'),
      ) as { books: Array<{ name: string; chapters: number[] }> };

      const missing: string[] = [];
      for (const book of structure.books) {
        book.chapters.forEach((verseCount, index) => {
          for (let verse = 1; verse <= verseCount; verse++) {
            const key = verseId(book.name, index + 1, verse);
            if (!verses[key]?.length) missing.push(key);
          }
        });
      }
      expect(missing).toEqual([]);
    });

    it('uses Sefaria numbering where BHSA splits the Decalogue differently', () => {
      // BHSA gives each short prohibition its own verse and runs three ahead of
      // Sefaria for the rest of the chapter. The index follows Sefaria, so the
      // chapter must stop at 23 rather than 26.
      expect(verses['Exodus.20.23']).toBeTruthy();
      expect(verses['Exodus.20.24']).toBeUndefined();
      expect(verses['Deuteronomy.5.30']).toBeTruthy();
      expect(verses['Deuteronomy.5.31']).toBeUndefined();
    });

    it('moves the verse BHSA appends to Numbers 25 into Numbers 26', () => {
      expect(verses['Numbers.25.19']).toBeUndefined();
      expect(verses['Numbers.26.1']).toBeTruthy();
    });

    it('lists each lexeme of a verse once, in ascending order', () => {
      const genesis = verses['Genesis.1.1'];
      expect(genesis).toEqual([...new Set(genesis)].sort((a, b) => a - b));
      expect(genesis.map(gloss)).toContain('create');
      expect(genesis.map(gloss)).toContain('beginning');
    });
  });
});

// The morphology file is the only place the project records which dictionary
// word each individual word of a verse is. ETCBC's units are morphemes rather
// than printed words — it makes the בְּ of בְּרֵאשִׁית a unit of its own — so the file
// has to say where each printed word begins and ends, or nothing can line it
// up with the Hebrew the app puts on screen.
describe.skipIf(!morphologyExists)('Word boundaries', () => {
  const texts: Record<string, Record<string, Record<string, { he: string }>>> = JSON.parse(
    fs.readFileSync(textsPath, 'utf-8'),
  );

  const entries = Object.entries(morphology) as Array<[string, MorphologyVerse]>;

  it('declares the layout of each verse entry', () => {
    expect(morphologyFile!.verseFields).toEqual(['morphemes', 'words', 'joined']);
  });

  it('accounts for every morpheme exactly once in some word', () => {
    const offenders = entries
      .filter(([, [morphemes, words]]) => {
        const counted = words.reduce((sum, n) => sum + n, 0);
        return counted !== morphemes.length;
      })
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('never opens a verse with a continuation', () => {
    // A word of 0 morphemes means "a further part of the dictionary word
    // before it", so there has to be a word before it.
    const offenders = entries
      .filter(([, [, words]]) => words.length === 0 || words[0] === 0 || words.some((n) => n < 0))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('spreads a two-part name over the two words it is printed as', () => {
    // תובל קין is one dictionary entry and two words on the page — and Genesis
    // 4:22 prints it both ways, once with a space and once with a maqaf. Each
    // time, the second half is a word of its own carrying no new morpheme.
    const [morphemes, words, joined] = morphology['Genesis.4.22'];
    const continuations = words.flatMap((n, i) => (n === 0 ? [i] : []));
    expect(continuations.length).toBe(2);

    for (const at of continuations) {
      const start = words.slice(0, at).reduce((sum, n) => sum + n, 0);
      expect(gloss(morphemes[start - 1][0])).toBe('Tubal-Cain');
    }
    // The second occurrence is the one written with a maqaf.
    expect(joined).toContain(continuations[1] - 1);
    expect(joined).not.toContain(continuations[0] - 1);
  });

  it('only marks maqaf joins between two words that exist', () => {
    // A join says "the word at this position is followed by a maqaf rather
    // than a space", so it can never point at the last word of a verse.
    const offenders = entries
      .filter(([, [, words, joined]]) =>
        joined.some((at, i) => at < 0 || at >= words.length - 1 || (i > 0 && at <= joined[i - 1])),
      )
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('splits the first verse of Genesis into the seven words it is printed as', () => {
    // בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ — eleven ETCBC morphemes, because the
    // prefixed בְּ, הַ, וְ and הַ are each a unit, but seven words on the page.
    const [morphemes, words, joined] = morphology['Genesis.1.1'];
    expect(morphemes.length).toBe(11);
    expect(words).toEqual([2, 1, 1, 1, 2, 2, 2]);
    expect(joined).toEqual([]);
  });

  it('keeps the two words inside a maqaf pair apart (Deuteronomy 6:5)', () => {
    // בְּכׇל־לְבָבְךָ is one word on the page and two in the dictionary: "with all"
    // and "your heart". A reader filtering for "heart" wants the highlight on
    // לְבָבְךָ alone, so the maqaf has to be a word boundary with a join recorded
    // across it.
    const [morphemes, words, joined] = morphology['Deuteronomy.6.5'];
    const glossesOf = (index: number) => {
      const start = words.slice(0, index).reduce((sum, n) => sum + n, 0);
      return morphemes.slice(start, start + words[index]).map(([lex]) => gloss(lex));
    };

    expect(words.length).toBe(10);
    expect(joined.length).toBe(3);

    const heart = words.findIndex((_, i) => glossesOf(i).includes('heart'));
    expect(heart).toBeGreaterThan(-1);
    expect(glossesOf(heart)).toEqual(['heart']);
    // The word before it is the "with all" that the maqaf binds to it.
    expect(glossesOf(heart - 1)).toEqual(['in', 'whole']);
    expect(joined).toContain(heart - 1);
  });

  it('encodes the word rule the same way verse-lexemes.json does', () => {
    // verse-lexemes.json holds the stem of each printed word, and in a verse
    // lined up by letter the lexemes its shown words name; this file holds
    // every morpheme plus the word lengths, so the same set is recoverable.
    // Nothing else checks that the two agree, and they must.
    const disagree: string[] = [];
    for (const [key, [morphemes, words]] of entries) {
      const stems = new Set<number>(realigned[key]?.flat());
      let at = 0;
      for (const length of words) {
        // A length of 0 is a printed word that is a further part of the
        // dictionary word before it — the second half of תובל קין — so it
        // carries no morphemes and contributes no stem.
        if (length === 0) continue;
        stems.add(morphemes[at + length - 1][0]);
        at += length;
      }
      const stored = new Set(verses[key] ?? []);
      if (stems.size !== stored.size || [...stems].some((id) => !stored.has(id))) {
        disagree.push(key);
      }
    }
    expect(disagree).toEqual([]);
  });

  it('names the words of each verse it lines up by letter', () => {
    // The page and BHSA divide a few verses into words differently, nearly
    // always at a compound name: צורישדי against צורי שדי. For those the file
    // lists the lexemes of every word the page shows.
    expect(Object.keys(realigned)).not.toHaveLength(0);
    for (const [key, named] of Object.entries(realigned)) {
      expect(morphology[key], `${key} is lined up but absent`).toBeTruthy();
      const v = parseVerseId(key);
      const hebrew = v && texts[v.book]?.[v.chapter]?.[v.verse]?.he;
      expect(hebrew, `${key} names no verse the page shows`).toBeTruthy();
      if (!hebrew) continue;
      expect(named, key).toHaveLength(wordsBhsaParsed(hebrew).length);
      for (const id of named.flat()) {
        expect(lexemes[id], `${key} names ${id}`).toBeTruthy();
        // A click there can search for it, and the search must find this verse.
        expect(verses[key], `${key} names ${id} but does not carry it`).toContain(id);
      }
    }
  });
});

// The generator and the search box each fold Hebrew before matching, and each
// decides for itself which characters separate one word from the next. They are
// separate implementations in separate languages, and the alignment in
// verse-morphology.json is only true while they agree.
describe.skipIf(!dataExists)('Word separators', () => {
  it('are the same set in the Python generator and in search.ts', () => {
    const generator = fs.readFileSync(generatorPath, 'utf-8');
    const declared = generator.match(/^SEPARATORS = \{([^}]*)\}/m);
    expect(declared).toBeTruthy();
    const pythonSeparators = new Set(
      (declared![1].match(/0x[0-9A-Fa-f]{4}/g) ?? []).map((hex) => parseInt(hex, 16)),
    );

    // Everything in the Hebrew points-and-accents block that search.ts turns
    // into a space rather than dropping.
    const typescriptSeparators = new Set<number>();
    for (let code = 0x0591; code <= 0x05c7; code++) {
      if (normalizeHebrewForSearch(String.fromCharCode(code)) === ' ') {
        typescriptSeparators.add(code);
      }
    }

    expect([...typescriptSeparators].sort()).toEqual([...pythonSeparators].sort());
    // Named, so that a change to either side fails here with the reason legible:
    // maqaf, paseq, sof pasuq, nun hafukha.
    expect([...pythonSeparators].sort()).toEqual([0x05be, 0x05c0, 0x05c3, 0x05c6]);
  });
});
