// Which dictionary word is the word at *this* place in the verse?
//
// The verse narrows a spelling to the readings it contains, which is enough
// until the same verse contains two of them — Genesis 8:20 has both the verb
// "ascend" and the noun "burnt-offering", and every reader can see which word
// is which. The per-word parse says so outright, and these tests hold it to
// the words a reader would point at.
//
// The verses BHSA and Sefaria divide differently are the danger: a position
// there names the word next door, so they are lined up by letter instead.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData } from '../../../search';
import {
  meaningsFor,
  meaningsInVerse,
  setVerseOnScreen,
  wordMatches,
  wordsAreNamed,
} from '../../../search/dictionary';
import { splitIntoWords, stripNikkud } from '../../../hebrew';
import { lookupForm, verseWords } from '../../../verseWords';

// The spellings of עלה the search box offers, from the two terms in issue #153.
const ASCEND = ['<LH[@heb'];
const OFFERINGS = ['<LH/@heb', '<LH=/@heb', '<LH/@arc'];

let texts: Record<string, Record<string, Record<string, { he: string }>>>;
/** The verses the file lines up by letter, since the page divides them into words differently. */
let realigned: string[];

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
  verseWords(hebrewOf(verseKey)).findIndex((w) => stripNikkud(w.word) === word);

beforeAll(async () => {
  texts = await (await fetch('/data/all-texts.json')).json();
  realigned = Object.keys(
    (await (await fetch('/data/search/verse-morphology.json')).json()).realigned,
  );
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

  it('marks the word in a verse the two sources divide differently', () => {
    // Numbers 2:12 prints צורישדי solid where BHSA has צורי שדי, so counting
    // words from the start of the verse would land one word out.
    expect(markedWords('Numbers:2:12', ['YWRJCDJ/@heb'])).toEqual(['צורישדי']);
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
    // parse is loaded. Reading one verse's words off another verse's parse
    // labels every word with a stranger's dictionary entry.
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

  it('names each word of a verse the two sources divide differently', () => {
    // II Samuel 23:24 opens "Asahel the brother of Joab". Sefaria prints
    // עֲשָׂהאֵל solid where BHSA divides it in two, so every position in the verse
    // is one word behind: counting into it would answer אֲחִי, "brother", with
    // Asahel. Lined up by letter, each word is itself.
    const verse = 'II Samuel:23:24';
    setVerseOnScreen(verse, hebrewOf(verse));

    const at = (word: string) =>
      meaningsInVerse(word, verse, wordIndexOf(verse, word)).map((m) => m.gloss);
    expect(at('אחי')).toEqual(['brother']);
    expect(at('עשהאל')).toEqual(['Asahel']);
  });

  it('names a word where the two sources print different words', () => {
    // Sefaria prints יְהֹוָה אֱלֹהִים in II Samuel 7:22 where BHS has אֲדֹנָי יְהוִה.
    // By position each word would be named as the other; by letter the
    // Tetragrammaton is itself, and אֱלֹהִים, which BHS does not have here, falls
    // back to its spelling.
    const verse = 'II Samuel:7:22';
    setVerseOnScreen(verse, hebrewOf(verse));

    expect(meaningsInVerse('יהוה', verse, wordIndexOf(verse, 'יהוה')).map((m) => m.gloss)).toEqual([
      'YHWH',
    ]);
  });
});

describe('the verses the two sources divide differently', () => {
  it('still have their words named, over the whole Tanakh', () => {
    // A regenerated index whose word divisions have drifted would leave a
    // verse unnamed here, which nothing else would notice.
    expect(realigned).not.toHaveLength(0);

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

    expect(refused).toEqual([]);
  });
});

// Sefaria prints a corrected word twice: the ketiv, as written, in round
// brackets, and the qere, as read, in square ones. BHSA parses the qere, and
// a click on the ketiv lands on that parse.
describe('a click on the written form of a corrected word', () => {
  /** The meanings a click on the word printed as `printed` offers. */
  const clicked = (verseKey: string, printed: string): string[][] => {
    const hebrew = hebrewOf(verseKey);
    setVerseOnScreen(verseKey, hebrew);
    const words = verseWords(hebrew);
    const index = words.findIndex((w) => stripNikkud(w.word) === printed);
    expect(index, `${printed} in ${verseKey}`).toBeGreaterThanOrEqual(0);
    return meaningsInVerse(lookupForm(words[index].word), verseKey, index).map((m) => m.keys);
  };

  it('offers what a click on the reading beside it offers', () => {
    // (אעבוד) [אֶעֱבוֹר]: no printed word is spelled אעבוד.
    expect(clicked('Jeremiah:2:20', '(אעבוד)')).toEqual(clicked('Jeremiah:2:20', '[אעבור]'));
  });

  it('when the reading comes first', () => {
    expect(clicked('Daniel:7:19', '(כלהון)')).toEqual(clicked('Daniel:7:19', '[כלהין]'));
  });

  it('offers both words when one written word is read as two', () => {
    // (בגד) [בָּא גָד]
    const both = [...clicked('Genesis:30:11', '[בא'), ...clicked('Genesis:30:11', 'גד]')];
    expect(clicked('Genesis:30:11', '(בגד)')).toEqual(both);
  });

  it('gives each of two written words the one word they are read as', () => {
    // (כי טוב) [כְּטוֹב]
    const reading = clicked('Judges:16:25', '[כטוב]');
    expect(clicked('Judges:16:25', '(כי')).toEqual(reading);
    expect(clicked('Judges:16:25', 'טוב)')).toEqual(reading);
  });

  it('offers what the spelling can be for a word written but not read', () => {
    // (נא) in II Kings 5:18 has no reading beside it, and BHSA no word for it,
    // so the verse cannot narrow its spelling either.
    const offered = clicked('II Kings:5:18', '(נא)');
    expect(offered).not.toHaveLength(0);
    expect(offered).toEqual(meaningsFor('נא').map((m) => m.keys));
  });
});
