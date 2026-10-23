// Test fixtures for Torah Map tests
import { verseId } from '@torahmap/link/tanakh';
import type { TanakhIdentity, TanakhLayout, TorahData } from '../../src/types.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { CommentaryCounts } from '../../src/overlays/commentary.ts';
import { HAFTARAH_FILES, type HaftarahMappings } from '../../src/overlays/haftarah/readings.ts';
import { commentaryOverlay } from '../../src/overlays/commentary.ts';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../src/overlays/text-analytics.ts';
import type { Loaded } from '@torahmap/shell/dataFiles.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from '../../src/verseTexts.ts';
import { DICTIONARY_FILES, type DictionaryFiles } from '../../src/search/data.ts';
import type { StoryStop } from '@torahmap/stories';

export function createStoryStop(overrides: Partial<StoryStop> = {}): StoryStop {
  return { id: 's', text: 'Text.', camera: 'initial', overlay: null, ...overrides };
}

export function createVerse(overrides: Partial<TanakhLayout> = {}): TanakhLayout {
  const verse = { book: 'Genesis', chapter: 1, verse: 1, x: 10, y: 20, size: 6, ...overrides };
  return { ...verse, id: overrides.id ?? verseId(verse.book, verse.chapter, verse.verse) };
}

export function createVerses(
  count: number,
  baseOverrides: Partial<TanakhLayout> = {},
): TanakhLayout[] {
  return Array.from({ length: count }, (_, i) =>
    createVerse({
      verse: i + 1,
      x: (i % 10) * 8,
      y: Math.floor(i / 10) * 8,
      ...baseOverrides,
    }),
  );
}

export const SAMPLE_VERSES: TanakhLayout[] = [
  // Torah - Genesis
  createVerse({ book: 'Genesis', chapter: 1, verse: 1, x: 10, y: 20 }),
  createVerse({ book: 'Genesis', chapter: 1, verse: 2, x: 18, y: 20 }),
  createVerse({ book: 'Genesis', chapter: 2, verse: 1, x: 10, y: 28 }),

  // Torah - Exodus
  createVerse({ book: 'Exodus', chapter: 1, verse: 1, x: 100, y: 20 }),
  createVerse({ book: 'Exodus', chapter: 1, verse: 2, x: 108, y: 20 }),

  // Nevi'im - Isaiah
  createVerse({ book: 'Isaiah', chapter: 1, verse: 1, x: 10, y: 500 }),
  createVerse({ book: 'Isaiah', chapter: 1, verse: 2, x: 18, y: 500 }),

  // Ketuvim - Psalms
  createVerse({ book: 'Psalms', chapter: 1, verse: 1, x: 10, y: 1000 }),
  createVerse({ book: 'Psalms', chapter: 1, verse: 2, x: 18, y: 1000 }),
  createVerse({ book: 'Psalms', chapter: 119, verse: 1, x: 10, y: 1100 }),
];

export const SAMPLE_COMMENTARY_COUNTS: CommentaryCounts = {
  'Genesis': {
    '1': {
      '1': {
        total: 150,
        categories: { 'Midrash': 50, 'Talmud': 30, 'Chasidut': 20, 'Tanakh': 50 },
      },
      '2': { total: 45, categories: { 'Midrash': 20, 'Talmud': 15, 'Kabbalah': 10 } },
    },
    '2': {
      '1': { total: 30, categories: { 'Midrash': 15, 'Halakhah': 10, 'Musar': 5 } },
    },
  },
  'Isaiah': {
    '1': {
      '1': { total: 80, categories: { 'Midrash': 40, 'Jewish Thought': 25, 'Tanakh': 15 } },
      '2': { total: 25, categories: { 'Midrash': 15, 'Responsa': 10 } },
    },
  },
};

export const SAMPLE_VERSE_TEXTS = {
  'Genesis': {
    '1': {
      '1': {
        he: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃',
        en: 'In the beginning God created the heaven and the earth.',
      },
      '2': {
        he: 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ',
        en: 'And the earth was without form, and void',
      },
    },
    '2': {
      '1': {
        he: 'וַיְכֻלּ֛וּ הַשָּׁמַ֥יִם וְהָאָ֖רֶץ',
        en: 'Thus the heavens and the earth were finished',
      },
    },
  },
  'Isaiah': {
    '1': {
      '1': {
        he: 'חֲז֧וֹן יְשַֽׁעְיָ֛הוּ בֶּן־אָמ֖וֹץ',
        en: 'The vision of Isaiah the son of Amoz',
      },
    },
  },
};

export const SAMPLE_HAFTARAH_MAPPINGS: HaftarahMappings = {
  parshiot: [
    {
      name: 'Bereshit',
      hebrewName: 'בראשית',
      torah: {
        book: 'Genesis',
        start: { chapter: 1, verse: 1 },
        end: { chapter: 6, verse: 8 },
      },
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 42, verse: 5 },
            end: { chapter: 42, verse: 21 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 42, verse: 5 },
            end: { chapter: 43, verse: 10 },
          },
        ],
      },
    },
    {
      name: 'Noach',
      hebrewName: 'נח',
      torah: {
        book: 'Genesis',
        start: { chapter: 6, verse: 9 },
        end: { chapter: 11, verse: 32 },
      },
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 54, verse: 1 },
            end: { chapter: 55, verse: 5 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 54, verse: 1 },
            end: { chapter: 54, verse: 10 },
          },
        ],
      },
    },
  ],
  specialOccasions: [
    {
      name: 'Shabbat Rosh Chodesh',
      hebrewName: 'שבת ראש חודש',
      category: 'rosh-chodesh',
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 66, verse: 1 },
            end: { chapter: 66, verse: 24 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 66, verse: 1 },
            end: { chapter: 66, verse: 24 },
          },
        ],
      },
    },
    {
      name: 'Rosh Hashanah Day 1',
      hebrewName: 'ראש השנה יום א׳',
      category: 'high-holidays',
      haftarah: {
        ashkenazi: [
          {
            book: 'I Samuel',
            start: { chapter: 1, verse: 1 },
            end: { chapter: 2, verse: 10 },
          },
        ],
        sephardi: [
          {
            book: 'I Samuel',
            start: { chapter: 1, verse: 1 },
            end: { chapter: 2, verse: 10 },
          },
        ],
      },
    },
  ],
};

export const SAMPLE_STRUCTURE = {
  books: [
    {
      name: 'Genesis',
      hebrewName: 'בראשית',
      section: 'torah',
      chapters: [
        31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20,
        67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34,
        31, 22, 33, 26,
      ],
    },
    {
      name: 'Isaiah',
      hebrewName: 'ישעיהו',
      section: 'neviim',
      chapters: [
        31, 22, 26, 6, 30, 13, 25, 23, 20, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23,
        12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15,
        22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24,
      ],
    },
    {
      name: 'I Samuel',
      hebrewName: 'שמואל א',
      section: 'neviim',
      chapters: [
        28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 43, 15, 23, 28,
        23, 44, 25, 12, 25, 11, 31, 13,
      ],
    },
  ],
} as TorahData;

/**
 * The three lexeme files, holding no word: every term is matched by its text.
 */
export const EMPTY_DICTIONARY_FILES: DictionaryFiles = {
  lexicon: { source: 'none', lexemes: [] },
  forms: {},
  verseLexemes: {},
};

export const SAMPLE_TEXT_ANALYTICS_SCORES: TextAnalyticsData['scores'] = {
  parameters: {
    minWords: 7,
    runWords: 4,
    reachVerses: 50,
    formulaBooks: 5,
  },
  repetition: { Genesis: { '1': [0.1, 0.4, null] } },
};

/** The sample files, under the paths the overlays name. */
export const SAMPLE_LOADED: Loaded = new Map<string, unknown>([
  [commentaryOverlay.data.counts, SAMPLE_COMMENTARY_COUNTS],
  [TEXTS_FILE, SAMPLE_VERSE_TEXTS],
  [HAFTARAH_FILES.mappings, SAMPLE_HAFTARAH_MAPPINGS],
  [textAnalyticsOverlay.data.scores, SAMPLE_TEXT_ANALYTICS_SCORES],
  [STRUCTURE_FILE, SAMPLE_STRUCTURE],
  ...(Object.keys(DICTIONARY_FILES) as (keyof DictionaryFiles)[]).map(
    (name) => [DICTIONARY_FILES[name], EMPTY_DICTIONARY_FILES[name]] as const,
  ),
]);

export const SAMPLE_TROP_MARKS = {
  TIPCHA: '\u0596',
  ETNACHTA: '\u0591',
  SEGOL: '\u0592',
  SHALSHELET: '\u0593',
  ZAQEF_QATAN: '\u0594',
};

/** A test overlay that colours each item by `getItemColor`. */
export function testOverlay<T = TanakhIdentity, S = unknown, D = unknown>(
  fields: Omit<Overlay<T, S, D>, 'colorsFor'>,
): Overlay<T, S, D> {
  return {
    ...fields,
    colorsFor: (items, settings, _hovered, data) =>
      items.map((item) => fields.getItemColor(item, settings, data)),
  } as Overlay<T, S, D>;
}
