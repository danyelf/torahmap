import { describe, it, expect } from 'vitest';
import {
  citationFinder,
  citationsByPlace,
  compared,
  quoteFinder,
  type Cited,
  type Tanakh,
  type TanakhBook,
} from '../citations.ts';

const book = (name: string, hebrewName: string, chapters = 50, verses = 40): TanakhBook => ({
  name,
  hebrewName,
  chapters: new Array(chapters).fill(verses),
});

const BOOKS: TanakhBook[] = [
  book('Genesis', 'בראשית'),
  book('Exodus', 'שמות', 40, 23),
  book('Leviticus', 'ויקרא', 27),
  book('Numbers', 'במדבר', 36),
  book('I Kings', 'מלכים א', 22),
  book('II Chronicles', 'דברי הימים ב', 36),
  book('Psalms', 'תהלים', 150, 20),
];

// The few verses whose words the tests quote; every other verse has none.
const VERSES: Record<string, string> = {
  'Exodus.20.10': 'וְיָסַף חֲמִשִׁיתוֹ עַל',
  'Exodus.20.11': 'וְיָסַף חֲמִשִׁית כֶּסֶף',
  'Exodus.20.13': 'וְהָיָה לְךָ לְאוֹת',
  'Exodus.20.14': 'וְסָמַךְ יָדוֹ עַל רֹאשׁ',
  'Exodus.20.15': 'יָדוֹ וְלֹא',
  'Exodus.20.16': 'וַיֹּאמֶר יְהוָה אֶל־מֹשֶׁה לֵּאמֹר',
  'Exodus.20.17': 'וַיֹּאמֶר אֶל־מֹשֶׁה',
  'Exodus.20.18': 'זֶה־לִּי עֶשְׂרִים שָׁנָה',
  'Exodus.20.19': 'זֶה עֶשְׂרִים שָׁנָה',
  'Exodus.20.21': 'מִזְבַּ֣ח אֲדָמָה֮ תַּעֲשֶׂה־לִּי֒ וְזָבַחְתָּ֣ עָלָ֗יו',
  'Exodus.20.22': 'וְאִם־מִזְבַּ֤ח אֲבָנִים֙ {ס}',
  'Exodus.20.23': 'וְלֹֽא־תַעֲלֶ֥ה בְמַעֲלֹ֖ת עַֽל־מִזְבְּחִ֑י',
};

const TANAKH: Tanakh = {
  books: BOOKS,
  text: (book, chapter, verse) => VERSES[`${book}.${chapter}.${verse}`] ?? null,
};
const findCitations = citationFinder(TANAKH);

/** The verse each citation in `text` names, and the text its link covers. */
function cited(text: string): [string, string][] {
  return findCitations(text).citations.map(({ start, end, verse }) => [
    text.slice(start, end),
    verse,
  ]);
}

describe('findCitations', () => {
  it('finds a book, chapter and verse in parentheses, and links the words inside them', () => {
    expect(cited('שנאמר (תהלים לו, ז) צדקתך')).toEqual([['תהלים לו, ז', 'Psalms.36.7']]);
  });

  it('reads a citation without a comma, or with a colon', () => {
    expect(cited('(במדבר יח טז)')).toEqual([['במדבר יח טז', 'Numbers.18.16']]);
    expect(cited('(בראשית א:כה)')).toEqual([['בראשית א:כה', 'Genesis.1.25']]);
  });

  it('links a range of verses to its first', () => {
    expect(cited('(ויקרא ז, כט-ל)')).toEqual([['ויקרא ז, כט-ל', 'Leviticus.7.29']]);
  });

  it('reads numerals with a geresh or gershayim, and braces around the citation', () => {
    expect(cited('{ויקרא כ״ז:כ״ג }')).toEqual([['ויקרא כ״ז:כ״ג', 'Leviticus.27.23']]);
    expect(cited('(ויקרא ט"ו, ט״ז)')).toEqual([['ויקרא ט"ו, ט״ז', 'Leviticus.15.16']]);
  });

  it('reads a numbered book, written with or without a geresh', () => {
    expect(cited("(מלכים א' ו ז)")).toEqual([["מלכים א' ו ז", 'I.Kings.6.7']]);
    expect(cited('(מלכים א ז, לה)')).toEqual([['מלכים א ז, לה', 'I.Kings.7.35']]);
  });

  it('reads the other spellings the Talmud uses for a book', () => {
    expect(cited('(תהילים קלג, ב)')).toEqual([['תהילים קלג, ב', 'Psalms.133.2']]);
    expect(cited('(דה"ב ה, יג)')).toEqual([['דה"ב ה, יג', 'II.Chronicles.5.13']]);
  });

  it('finds every citation in a segment, at its place', () => {
    const text = 'כתיב (תהלים א, א) וכתיב (תהלים ב, ב)';
    expect(findCitations(text).citations).toEqual([
      { start: 6, end: 16, verse: 'Psalms.1.1' },
      { start: 25, end: 35, verse: 'Psalms.2.2' },
    ]);
  });

  it('leaves alone what is not a citation of a verse', () => {
    const plain = [
      '{ויקרא כז }',
      '(ויקרא יח)',
      '(קידושין סו ב)',
      '(סימן ממה"ק)',
      '(ל"א אמר רבי)',
      '(אמר) [אמרת]',
      '(ע"ש)',
      '(מלכים א ל)',
    ];
    for (const text of plain) expect(findCitations(text)).toEqual({ citations: [], missed: [] });
  });

  it('reports what looks like a citation but names no verse of the Tanakh', () => {
    const text = '(שם מא, ו) (תהלים לו, כה) (בראשית נא, א) (בן סירא יג, יד)';
    expect(findCitations(text)).toEqual({
      citations: [],
      missed: ['(שם מא, ו)', '(תהלים לו, כה)', '(בראשית נא, א)', '(בן סירא יג, יד)'],
    });
  });
});

describe('reading what the text gets wrong or leaves out', () => {
  it('reads שם as the book the segment last named', () => {
    expect(cited('(תהלים מב, ג) מתי אבוא (שם מא, ו) מתי ימות')).toEqual([
      ['תהלים מב, ג', 'Psalms.42.3'],
      ['שם מא, ו', 'Psalms.41.6'],
    ]);
  });

  it('reads the citations whose mistakes are known', () => {
    expect(cited('(ויקרא הכ, ו)')).toEqual([['ויקרא הכ, ו', 'Leviticus.25.6']]);
    expect(cited('(ב דברי הימים ג, ב)')).toEqual([['ב דברי הימים ג, ב', 'II.Chronicles.3.2']]);
  });

  it('keeps the verse cited when its words follow the citation', () => {
    expect(cited('(שמות כ, כא) מזבח אדמה תעשה לי')).toEqual([['שמות כ, כא', 'Exodus.20.21']]);
  });

  it('moves to a nearby verse that holds the words quoted when the cited one does not', () => {
    expect(cited('(שמות כ, כב) מזבח אדמה תעשה')).toEqual([['שמות כ, כב', 'Exodus.20.21']]);
    expect(cited('(שמות כ, כו) לא תעלה במעלות')).toEqual([['שמות כ, כו', 'Exodus.20.23']]);
  });

  it('reads the quote past spelling with or without vav and yod, and past וגו׳', () => {
    expect(cited("(שמות כ, כב) וגו' מזבח אדמה תעשה")).toEqual([['שמות כ, כב', 'Exodus.20.21']]);
    expect(cited('(שמות כ, כ) ולא תעלה במעלת')).toEqual([['שמות כ, כ', 'Exodus.20.23']]);
  });

  it('counts a two-letter word such as לי in the quote', () => {
    expect(cited('(שמות כ, יח) זה לי עשרים')).toEqual([['שמות כ, יח', 'Exodus.20.18']]);
  });

  it('reads the abbreviation ה׳ as the name it stands for', () => {
    expect(cited("(שמות כ, טז) ויאמר ה' אל משה")).toEqual([['שמות כ, טז', 'Exodus.20.16']]);
  });

  it('keeps the verse cited when only two of the words that follow are in a nearby verse', () => {
    expect(cited('(שמות כ, יד) ידו ולא יד עבדו')).toEqual([['שמות כ, יד', 'Exodus.20.14']]);
  });

  it('matches the quote word by word, not letters running across words', () => {
    expect(cited('(שמות כ, יב) יהיה לך ולא של אחרים')).toEqual([['שמות כ, יב', 'Exodus.20.12']]);
  });

  it('keeps the verse cited when it holds two of the words quoted, in order', () => {
    expect(cited('(שמות כ, יא) ויסף חמישיתו עליו')).toEqual([['שמות כ, יא', 'Exodus.20.11']]);
  });

  it('keeps the verse cited when no nearby verse holds the words either', () => {
    expect(cited('(שמות כ, כב) ויאמר משה לעם')).toEqual([['שמות כ, כב', 'Exodus.20.22']]);
  });
});

describe('quoteFinder', () => {
  const findQuotes = quoteFinder(TANAKH);

  /** A citation of `verse` whose reference is followed, in the edition that names it, by `after`. */
  const cite = (verse: string, after = '', before = ''): Cited => ({
    verse,
    reference: '(שמות כ)',
    after: after.split(' ').filter(Boolean).map(compared),
    before: before.split(' ').filter(Boolean).map(compared),
  });

  /**
   * What each citation in `text` is placed on, the verse, and how; a reference shows where it is,
   * and a citation shown nowhere is empty.
   */
  function placed(text: string, cited: Cited[], find = findQuotes): [string, string, string][] {
    return find(text, cited).map(({ citation: c, cited: { verse }, placing }) => [
      !c
        ? ''
        : c.reference
          ? `${text.slice(0, c.start)}|${c.reference}|`
          : text.slice(c.start, c.end),
      verse,
      placing,
    ]);
  }

  it('links the quote that holds two of the verse’s words in a row', () => {
    const text = 'אמר: ״אמר להם״, שנאמר: ״וְסָמַךְ יָדוֹ עַל רֹאשׁ״.';
    expect(placed(text, [cite('Exodus.20.14')])).toEqual([
      ['וְסָמַךְ יָדוֹ עַל רֹאשׁ', 'Exodus.20.14', 'quote'],
    ]);
  });

  it('of two quotes that hold the verse, takes the one the words after the reference begin', () => {
    const text = '״וְסָמַךְ יָדוֹ״ ודרשו: ״יָדוֹ עַל רֹאשׁ״';
    expect(placed(text, [cite('Exodus.20.14', 'ידו על ראש')])).toEqual([
      ['יָדוֹ עַל רֹאשׁ', 'Exodus.20.14', 'quote'],
    ]);
  });

  it('links nothing that does not hold the verse, though the words after the reference are there', () => {
    // The reference follows its quote, so the words after it are the next quote's.
    const text = '״וְסָמַךְ יָדוֹ״ ״זֶה לִּי עֶשְׂרִים״';
    expect(placed(text, [cite('Exodus.20.14', 'זה לי')])).toEqual([
      ['וְסָמַךְ יָדוֹ', 'Exodus.20.14', 'quote'],
    ]);
  });

  it('does not follow the words after the reference where only common words hold the verse', () => {
    // אמר and להם are in every verse of this Tanakh.
    const common: Tanakh = {
      books: [book('Exodus', 'שמות', 1, 200)],
      text: (_, __, verse) => (verse === 1 ? 'אמר להם זה הדבר' : 'אמר להם'),
    };
    const text = '״אמר להם זה הדבר״ ״אמר להם״';
    expect(placed(text, [cite('Exodus.1.1', 'אמר להם')], quoteFinder(common))).toEqual([
      ['אמר להם זה הדבר', 'Exodus.1.1', 'quote'],
    ]);
  });

  it('takes a one-word quote only where no longer one holds the verse', () => {
    expect(placed('״עֶשְׂרִים״ ו״זֶה לִּי עֶשְׂרִים״', [cite('Exodus.20.18')])).toEqual([
      ['זֶה לִּי עֶשְׂרִים', 'Exodus.20.18', 'quote'],
    ]);
    expect(placed('״עֶשְׂרִים״ ו״אמר להם״', [cite('Exodus.20.18')])).toEqual([
      ['עֶשְׂרִים', 'Exodus.20.18', 'quote'],
    ]);
  });

  it('reads a word with a prefix the verse lacks, ה׳ and י״י as the name, and past וגו׳', () => {
    expect(placed('״לסמך יָדוֹ״', [cite('Exodus.20.14')])).toEqual([
      ['לסמך יָדוֹ', 'Exodus.20.14', 'quote'],
    ]);
    expect(placed('״וַיֹּאמֶר ה׳ וְגוֹ׳״', [cite('Exodus.20.16')])).toEqual([
      ['וַיֹּאמֶר ה׳ וְגוֹ׳', 'Exodus.20.16', 'quote'],
    ]);
  });

  it('splits one quote between two verses where the second one’s words begin, and shows a verse once', () => {
    const text = '״וְהָיָה לְךָ לְאוֹת וְסָמַךְ יָדוֹ״';
    expect(placed(text, [cite('Exodus.20.13'), cite('Exodus.20.14')])).toEqual([
      ['וְהָיָה לְךָ לְאוֹת', 'Exodus.20.13', 'quote'],
      ['וְסָמַךְ יָדוֹ', 'Exodus.20.14', 'shared'],
    ]);
    expect(placed('״וְהָיָה לְךָ לְאוֹת״', [cite('Exodus.20.13'), cite('Exodus.20.13')])).toEqual([
      ['וְהָיָה לְךָ לְאוֹת', 'Exodus.20.13', 'quote'],
      ['', 'Exodus.20.13', 'again'],
    ]);
  });

  it('links three of the verse’s words in a row outside any quote', () => {
    expect(placed('אתיא זה לי עשרים, דאמר', [cite('Exodus.20.18')])).toEqual([
      ['זה לי עשרים', 'Exodus.20.18', 'words'],
    ]);
  });

  it('links less of the verse only where the words after the reference are, and it shares an uncommon word', () => {
    expect(placed('״מזבח ... וזבחת״', [cite('Exodus.20.21', 'מזבח')])).toEqual([
      ['מזבח ... וזבחת', 'Exodus.20.21', 'variant'],
    ]);
    expect(placed('״מזבח ... וזבחת״', [cite('Exodus.20.21')])).toEqual([
      ['|(שמות כ)|', 'Exodus.20.21', 'reference'],
    ]);
  });

  it('shows the reference before the words after it, or after those before it, outside quote marks, and after any link', () => {
    expect(placed('אמר להם: ״לא כך״', [cite('Exodus.20.14', 'לא כך')])).toEqual([
      ['אמר להם: |(שמות כ)|', 'Exodus.20.14', 'reference'],
    ]);
    expect(placed('״אמר להם״ ואמר', [cite('Exodus.20.14', '', 'ואמר להם')])).toEqual([
      ['״אמר להם״|(שמות כ)|', 'Exodus.20.14', 'reference'],
    ]);
    expect(placed('״וְסָמַךְ יָדוֹ״ ואמר', [cite('Exodus.20.14'), cite('Exodus.20.15')])).toEqual([
      ['וְסָמַךְ יָדוֹ', 'Exodus.20.14', 'quote'],
      ['״וְסָמַךְ יָדוֹ״ |(שמות כ)|', 'Exodus.20.15', 'reference'],
    ]);
  });
});

describe('citationsByPlace', () => {
  it('places the verses one edition names in the other, by amud and segment, and counts how each was placed', () => {
    const naming = [
      ['(שמות כ, יד) וסמך ידו', 'none here'],
      [],
      ['(שמות כ, יג) והיה לך (בן סירא יג, יד)'],
    ];
    const text = [['״וְסָמַךְ יָדוֹ״', 'none here'], [], ['אמר להם']];
    const placings = { reference: 2 };
    expect(citationsByPlace(text, naming, findCitations, quoteFinder(TANAKH), placings)).toEqual({
      citations: {
        0: { 0: [{ start: 1, end: 15, verse: 'Exodus.20.14' }] },
        2: { 0: [{ start: 0, end: 0, verse: 'Exodus.20.13', reference: '(שמות כ, יג)' }] },
      },
      missed: ['(בן סירא יג, יד)'],
    });
    expect(placings).toEqual({ quote: 1, reference: 3 });
  });

  it('links a reference that ends a segment on the quote that opens the next', () => {
    const naming = [['כדכתיב (שמות כ, יג)', 'ועוד']];
    const text = [['כדכתיב', '״וְהָיָה לְךָ לְאוֹת״ ועוד']];
    expect(citationsByPlace(text, naming, findCitations, quoteFinder(TANAKH), {})).toEqual({
      citations: { 0: { 1: [{ start: 1, end: 20, verse: 'Exodus.20.13' }] } },
      missed: [],
    });
  });
});
