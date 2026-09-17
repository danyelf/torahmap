// Test fixtures for Torah Map tests
import type { TanakhLayout, CommentaryData } from '../../types';

export function createVerse(overrides: Partial<TanakhLayout> = {}): TanakhLayout {
  return {
    book: 'Genesis',
    chapter: 1,
    verse: 1,
    x: 10,
    y: 20,
    size: 6,
    ...overrides,
  };
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

export const SAMPLE_COMMENTARY_DATA: CommentaryData = {
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

export const TEST_COLORS = {
  RED: [1, 0, 0] as [number, number, number],
  GREEN: [0, 1, 0] as [number, number, number],
  BLUE: [0, 0, 1] as [number, number, number],
  WHITE: [1, 1, 1] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  GRAY: [0.5, 0.5, 0.5] as [number, number, number],
  YELLOW: [1, 1, 0] as [number, number, number],
  PURPLE: [0.5, 0, 0.5] as [number, number, number],
};

export const SAMPLE_TROP_MARKS = {
  TIPCHA: '\u0596',
  ETNACHTA: '\u0591',
  SEGOL: '\u0592',
  SHALSHELET: '\u0593',
  ZAQEF_QATAN: '\u0594',
};
