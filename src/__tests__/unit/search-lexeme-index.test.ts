// Quality checks on the generated lexeme index.
//
// The index comes from the ETCBC BHSA database, which keeps words that merely
// share a spelling apart as separate dictionary entries. These tests read the
// generated files directly and assert the properties search.ts relies on.
//
// Regenerate the files with:
//   .venv/bin/python scripts/search/generate-lexeme-index.py

import { describe, it, expect } from 'vitest';
import { normalizeHebrewForSearch } from '../../search';
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
      misaligned: string[];
      note: string;
      verses: Record<string, MorphologyVerse>;
    })
  : null;
const morphology = morphologyFile?.verses ?? {};
// Verses the two sources divide into words differently, where a position here
// does not name the same word the reader sees.
const misaligned = new Set(morphologyFile?.misaligned ?? []);

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
      const withGloss = lexemes.filter((row) => row[2].length > 0).length;
      expect(withGloss / lexemes.length).toBeGreaterThan(0.99);
    });
  });

  describe('written forms', () => {
    it('are stored with final letters folded to their medial shape', () => {
      const finals = /[ךםןףץ]/;
      const offenders = Object.keys(forms).filter((form) => finals.test(form));
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
      expect(ids.map((id) => lexemes[id][3])).not.toContain('prep');
    });

    it('indexes a function word only under its own spelling', () => {
      // The Aramaic preposition על carrying a pronominal suffix is written עלה,
      // "upon him". Filing that under the preposition would attach all 5,700 of
      // its occurrences to a search for the verb עלה "ascend", so suffixed and
      // prefixed forms of function words are left out of the index. The bare
      // spelling still resolves.
      expect(forms['על'].map((id) => lexemes[id][3])).toContain('prep');
      expect(forms['עליו']).toBeUndefined();
      expect(forms['בו']).toBeUndefined();
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

  describe('verse keys', () => {
    it('covers every verse of the Tanakh the app displays', () => {
      const structure = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'tanakh-structure.json'), 'utf-8'),
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

// The morphology file is the only place the project records which dictionary
// word each individual word of a verse is. ETCBC's units are morphemes rather
// than printed words — it makes the בְּ of בְּרֵאשִׁית a unit of its own — so the file
// has to say where each printed word begins and ends, or nothing can line it
// up with the Hebrew the app puts on screen.
describe.skipIf(!morphologyExists)('Word boundaries', () => {
  const texts: Record<string, Record<string, Record<string, { he: string }>>> = JSON.parse(
    fs.readFileSync(textsPath, 'utf-8'),
  );

  // A printed word ends at a space or at a maqaf, the little hyphen that joins
  // כָּל־הָאָרֶץ into one written unit while keeping two dictionary words inside it.
  // Two further things in Sefaria's text are not words: the scribal paragraph
  // marks {ס} and {פ}, which BHSA has nothing for; and, where the received
  // text is corrected, the ketiv, which Sefaria prints in round brackets beside
  // the qere it prints in square ones. BHSA carries the one word that is read.
  //
  // This has to fold the text exactly as displayed_words() in
  // scripts/search/generate-lexeme-index.py does. When the two drift apart the
  // alignment test below fails and names the verses.
  const displayedWords = (hebrew: string): string[] =>
    hebrew
      .replace(/\{[ספ]\}/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .split(/[\s־]+/)
      .map((word) => word.replace(/[^א-ת]/g, ''))
      .filter((word) => word.length > 0);

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
    const [morphemes, words, joined] = morphology['Genesis:4:22'];
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
    const [morphemes, words, joined] = morphology['Genesis:1:1'];
    expect(morphemes.length).toBe(11);
    expect(words).toEqual([2, 1, 1, 1, 2, 2, 2]);
    expect(joined).toEqual([]);
  });

  it('keeps the two words inside a maqaf pair apart (Deuteronomy 6:5)', () => {
    // בְּכׇל־לְבָבְךָ is one word on the page and two in the dictionary: "with all"
    // and "your heart". A reader filtering for "heart" wants the highlight on
    // לְבָבְךָ alone, so the maqaf has to be a word boundary with a join recorded
    // across it.
    const [morphemes, words, joined] = morphology['Deuteronomy:6:5'];
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

  it('agrees with the displayed Hebrew on how many words a verse has', () => {
    // This is the property the whole file rests on. If a verse is one word out,
    // every word after the discrepancy is labelled with its neighbour's
    // dictionary entry — wrong, but plausible enough to go unnoticed.
    const unexpected: string[] = [];
    for (const [key, [, words]] of entries) {
      if (misaligned.has(key)) continue;
      const [book, chapter, verse] = key.split(':');
      const hebrew = texts[book]?.[chapter]?.[verse]?.he;
      if (hebrew === undefined) continue;
      if (displayedWords(hebrew).length !== words.length) unexpected.push(key);
    }
    expect(unexpected).toEqual([]);
  });

  it('owns up to the handful of verses that do not line up', () => {
    // BHSA and Sefaria disagree about where a few compound names divide —
    // צורי־שדי against צורישדי — and two verses of Joshua have no Hebrew here at
    // all. Those verses are named in the file so that a reader can fall back to
    // the spelling instead of labelling a word confidently wrong. The list
    // staying short is the point: if it grows, something has drifted.
    expect(misaligned.size).toBeGreaterThan(0);
    expect(misaligned.size).toBeLessThan(100);
    expect(misaligned.size / entries.length).toBeLessThan(0.01);

    for (const key of misaligned) {
      expect(morphology[key], `${key} is listed but absent`).toBeTruthy();
      const [book, chapter, verse] = key.split(':');
      const hebrew = texts[book]?.[chapter]?.[verse]?.he;
      if (hebrew === undefined) continue;
      expect(displayedWords(hebrew).length, `${key} is listed as misaligned but agrees`).not.toBe(
        morphology[key][1].length,
      );
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
