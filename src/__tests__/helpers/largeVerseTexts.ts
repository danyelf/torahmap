// A synthetic verse-text index sized like the real Tanakh, for tests that
// search at production scale. Roughly half the verses contain אלהים — the
// word every search-performance test searches for — so a search has to
// filter rather than match everything.
import type { VerseTexts } from '../../verseTexts';
import { seededRandom } from '../../utils/random';

const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
const CHAPTERS_PER_BOOK = 50;

export function buildLargeVerseTexts(totalVerses: number): VerseTexts {
  const verseTexts: VerseTexts = {};
  const versesPerChapter = Math.ceil(totalVerses / BOOKS.length / CHAPTERS_PER_BOOK);
  let seed = 0;
  let created = 0;

  for (const book of BOOKS) {
    verseTexts[book] = {};

    for (let chapter = 1; chapter <= CHAPTERS_PER_BOOK && created < totalVerses; chapter++) {
      verseTexts[book][String(chapter)] = {};

      for (let verse = 1; verse <= versesPerChapter && created < totalVerses; verse++) {
        const hasGod = seededRandom(seed++) > 0.5;
        verseTexts[book][String(chapter)][String(verse)] = {
          he: hasGod
            ? 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ'
            : 'וַיֹּאמֶר יְהוָה אֶל־משֶׁה לֵאמֹר',
          en: 'Sample text',
        };
        created++;
      }
    }
  }

  return verseTexts;
}
