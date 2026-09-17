// Which dictionary word is the word at *this* place in the verse?
//
// The verse narrows a spelling to the readings it contains, which is enough
// until the same verse contains two of them — Genesis 8:20 has both the verb
// "ascend" and the noun "burnt-offering", and every reader can see which word
// is which. The per-word parse says so outright, and these tests hold it to
// the words a reader would point at.
//
// The verses BHSA and Sefaria divide differently are the danger: a position
// there names the word next door. They must keep falling back to the spelling,
// so there is a test for that too.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData } from '../../../search';
import {
  meaningsInVerse,
  setVerseOnScreen,
  wordMatches,
  wordsAreNamed,
} from '../../../search/dictionary';
import { splitIntoWords, stripNikkud } from '../../../hebrew';
import { splitVerseText } from '../../../verseWords';

// The spellings of עלה the search box offers, from the two terms in issue #153.
const ASCEND = ['<LH[@heb'];
const OFFERINGS = ['<LH/@heb', '<LH=/@heb', '<LH/@arc'];

let texts: Record<string, Record<string, Record<string, { he: string }>>>;
/** The verses the file itself names as dividing into words differently. */
let misaligned: string[];

const hebrewOf = (verseKey: string): string => {
  const [book, chapter, verse] = verseKey.split(':');
  return texts[book][chapter][verse].he;
};

/**
 * The words of a verse a term would mark, in the order they are printed.
 *
 * This is the loop the search overlay runs over a verse it is highlighting:
 * split the nikkud-stripped text into words and ask, of each one, whether it
 * is one of the term's meanings. What comes back is the text of the marks.
 */
const markedWords = (verseKey: string, keys: string[]): string[] => {
  const hebrew = hebrewOf(verseKey);
  setVerseOnScreen(verseKey, hebrew);
  return splitIntoWords(stripNikkud(hebrew))
    .filter(({ word, start }) => wordMatches(keys, word, hebrew, start))
    .map(({ word }) => word);
};

/** Where a word sits among the verse's clickable words, which is what a click reports. */
const wordIndexOf = (verseKey: string, word: string): number =>
  splitVerseText(hebrewOf(verseKey))
    .filter((piece) => piece.kind === 'word')
    .findIndex((piece) => stripNikkud(piece.text) === word);

beforeAll(async () => {
  texts = await (await fetch('/data/all-texts.json')).json();
  misaligned = (await (await fetch('/data/search/verse-morphology.json')).json()).misaligned;
  await loadLexiconData();
  await setVerseOnScreen('Genesis:1:1', hebrewOf('Genesis:1:1'));
});

describe('marking the words of a verse', () => {
  it('gives each עלה in Genesis 8:20 to the term that means it', () => {
    // Noah offers burnt-offerings, עֹלֹת, on an altar he has built, and the
    // verse ends by saying he sent them up: וַיַּעַל. Both are spelled עלה once
    // the vowels come off, so a reader searching for the verb and for the noun
    // at once used to see one colour over both words.
    expect(markedWords('Genesis:8:20', ASCEND)).toEqual(['ויעל']);
    expect(markedWords('Genesis:8:20', OFFERINGS)).toEqual(['עלת']);
  });

  it('marks nothing for a verse the parse does not line up with', () => {
    // Numbers 2:12 is one of the 64 verses where BHSA and Sefaria divide a
    // compound name differently, so counting words from the start of it lands
    // on the wrong one. Falling back to the spelling is what it must do, and
    // the spelling of no word here is a form of עלה.
    expect(markedWords('Numbers:2:12', ASCEND)).toEqual([]);
  });

  it('leaves a verse it has no parse for to the spelling', () => {
    const hebrew = hebrewOf('Genesis:8:20');
    setVerseOnScreen('Nowhere:1:1', hebrew);

    // The spelling alone cannot tell the two apart, so both words answer to
    // both terms. That is the behaviour this replaces, kept for where the
    // parse cannot speak.
    const offsets = splitIntoWords(stripNikkud(hebrew));
    const ascend = offsets.filter(({ word, start }) => wordMatches(ASCEND, word, hebrew, start));
    expect(ascend.map(({ word }) => word)).toEqual(['ויעל', 'עלת']);
  });

  it('ignores a position in text that is not the verse on screen', () => {
    // The overlay hands over a string; nothing says it is the verse whose
    // parse is loaded. Reading one verse's words off another verse's parse is
    // exactly the failure the misaligned list exists to prevent.
    setVerseOnScreen('Genesis:8:20', hebrewOf('Genesis:8:20'));
    const elsewhere = stripNikkud(hebrewOf('Genesis:3:7'));

    const marked = splitIntoWords(elsewhere)
      .filter(({ word, start }) => wordMatches(OFFERINGS, word, elsewhere, start))
      .map(({ word }) => word);

    // עלה in Genesis 3:7 is a fig leaf, a third reading of the spelling, and
    // the fallback offers it to a term asking for burnt-offerings. Wrong, and
    // wrong in the old way rather than in a new one.
    expect(marked).toEqual(['עלה']);
  });
});

describe('naming the word that was clicked', () => {
  it('reads עלת in Genesis 8:20 as the offering and ויעל as the verb', () => {
    // Without a position both words answer "either", which is what
    // word-in-verse.test.ts pins. With one, each word answers for itself.
    const verse = 'Genesis:8:20';
    setVerseOnScreen(verse, hebrewOf(verse));

    const offering = meaningsInVerse('עלת', verse, wordIndexOf(verse, 'עלת'));
    expect(offering.map((m) => m.gloss)).toEqual(['burnt-offering']);

    const ascend = meaningsInVerse('ויעל', verse, wordIndexOf(verse, 'ויעל'));
    expect(ascend.map((m) => m.gloss)).toEqual(['ascend']);
  });

  it('settles לו in Genesis 2:18 on "to him"', () => {
    // The index carries לו as a spelling of לֹא as well, because the two are
    // interchanged where the text is corrected, and this verse has לֹא־טוֹב. The
    // verse cannot choose; the word's own position can.
    const verse = 'Genesis:2:18';
    setVerseOnScreen(verse, hebrewOf(verse));

    const meanings = meaningsInVerse('לו', verse, wordIndexOf(verse, 'לו'));
    expect(meanings.map((m) => m.gloss)).toEqual(['to']);
  });

  it('names both halves of a compound name as the one word they spell', () => {
    // בֵּית אֵל is two words on the page and one in the dictionary. Reading them
    // separately gives "house" and "god", which is etymology rather than what
    // the verse says.
    const verse = 'Genesis:13:3';
    setVerseOnScreen(verse, hebrewOf(verse));

    expect(meaningsInVerse('בית', verse, wordIndexOf(verse, 'בית')).map((m) => m.gloss)).toEqual([
      'Bethel',
    ]);
    expect(meaningsInVerse('אל', verse, wordIndexOf(verse, 'אל')).map((m) => m.gloss)).toEqual([
      'Bethel',
    ]);
  });

  it('falls back to the spelling in a verse that does not line up', () => {
    // II Samuel 23:24 opens "Asahel the brother of Joab". Sefaria prints
    // עֲשָׂהאֵל solid where BHSA divides it in two, so every position in the verse
    // is one word behind: counting into it would answer אֲחִי, "brother", with
    // Asahel — confidently, and wrong. 51 of the 64 misaligned verses have at
    // least one word where a position would lie like this.
    const verse = 'II Samuel:23:24';
    setVerseOnScreen(verse, hebrewOf(verse));

    const meanings = meaningsInVerse('אחי', verse, wordIndexOf(verse, 'אחי'));
    expect(meanings.map((m) => m.gloss)).toEqual(['brother']);
    expect(meanings).toEqual(meaningsInVerse('אחי', verse));
  });

  it('names a word BHSA and Sefaria spell differently, which is not always a gain', () => {
    // Sefaria prints יְהֹוָה אֱלֹהִים in II Samuel 7:22 where BHS has אֲדֹנָי יְהוִה,
    // so each of the two words is parsed as the other one's name. A reader who
    // clicks the first word is told אֲדֹנָי while looking at the Tetragrammaton.
    //
    // Kept rather than worked around. It is three clicks in the Tanakh, it is
    // the two sources disagreeing about the text rather than anything this
    // lookup decides, and the same disagreement already sends search for אֲדֹנָי
    // to this verse. Anything that suppressed it would have to distrust the
    // parse wherever it names a word outside the spelling's candidates, which
    // is also what makes בֵּית אֵל read as Bethel — 1,207 words, against these 3.
    const verse = 'II Samuel:7:22';
    setVerseOnScreen(verse, hebrewOf(verse));

    expect(meaningsInVerse('יהוה', verse, wordIndexOf(verse, 'יהוה')).map((m) => m.form)).toEqual([
      'אֲדֹנָי',
    ]);
  });
});

describe('the verses the two sources divide differently', () => {
  it('is exactly the 64 the file names, over the whole Tanakh', () => {
    // The only thing standing between this feature and a confidently wrong
    // label. It will never show up in ordinary use — 64 verses in 23,206 — and
    // the way it breaks is a regenerated index whose word divisions have
    // drifted, which nothing else would notice.
    // An empty list would make the comparison below pass without meaning
    // anything, and the list arrives over the same fetch the data does.
    expect(misaligned).toHaveLength(64);

    const refused: string[] = [];

    for (const [book, chapters] of Object.entries(texts)) {
      for (const [chapter, verses] of Object.entries(chapters)) {
        for (const [verse, text] of Object.entries(verses)) {
          const verseKey = `${book}:${chapter}:${verse}`;
          setVerseOnScreen(verseKey, text.he ?? '');
          if (!wordsAreNamed()) refused.push(verseKey);
        }
      }
    }

    expect(refused.sort()).toEqual([...misaligned].sort());
  });
});
