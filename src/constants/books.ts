// Single source of truth for Tanakh book definitions

export interface BookDefinition {
  name: string;
  nameHe: string;
  file: string;
  section: 'torah' | 'neviim' | 'ketuvim';
}

/**
 * All 39 books of the Tanakh in canonical order.
 * Each entry contains the display name, Hebrew name, file prefix, and section.
 */
export const BOOKS: readonly BookDefinition[] = [
  // Torah (5 books)
  { name: 'Genesis', nameHe: 'בְּרֵאשִׁית', file: 'genesis', section: 'torah' },
  { name: 'Exodus', nameHe: 'שְׁמוֹת', file: 'exodus', section: 'torah' },
  { name: 'Leviticus', nameHe: 'וַיִּקְרָא', file: 'leviticus', section: 'torah' },
  { name: 'Numbers', nameHe: 'בְּמִדְבַּר', file: 'numbers', section: 'torah' },
  { name: 'Deuteronomy', nameHe: 'דְּבָרִים', file: 'deuteronomy', section: 'torah' },
  // Nevi'im - Former Prophets (6 books)
  { name: 'Joshua', nameHe: 'יְהוֹשֻׁעַ', file: 'joshua', section: 'neviim' },
  { name: 'Judges', nameHe: 'שׁוֹפְטִים', file: 'judges', section: 'neviim' },
  { name: 'I Samuel', nameHe: 'שְׁמוּאֵל א', file: 'i-samuel', section: 'neviim' },
  { name: 'II Samuel', nameHe: 'שְׁמוּאֵל ב', file: 'ii-samuel', section: 'neviim' },
  { name: 'I Kings', nameHe: 'מְלָכִים א', file: 'i-kings', section: 'neviim' },
  { name: 'II Kings', nameHe: 'מְלָכִים ב', file: 'ii-kings', section: 'neviim' },
  // Nevi'im - Latter Prophets (3 major)
  { name: 'Isaiah', nameHe: 'יְשַׁעְיָהוּ', file: 'isaiah', section: 'neviim' },
  { name: 'Jeremiah', nameHe: 'יִרְמְיָהוּ', file: 'jeremiah', section: 'neviim' },
  { name: 'Ezekiel', nameHe: 'יְחֶזְקֵאל', file: 'ezekiel', section: 'neviim' },
  // Nevi'im - Twelve Minor Prophets
  { name: 'Hosea', nameHe: 'הוֹשֵׁעַ', file: 'hosea', section: 'neviim' },
  { name: 'Joel', nameHe: 'יוֹאֵל', file: 'joel', section: 'neviim' },
  { name: 'Amos', nameHe: 'עָמוֹס', file: 'amos', section: 'neviim' },
  { name: 'Obadiah', nameHe: 'עֹבַדְיָה', file: 'obadiah', section: 'neviim' },
  { name: 'Jonah', nameHe: 'יוֹנָה', file: 'jonah', section: 'neviim' },
  { name: 'Micah', nameHe: 'מִיכָה', file: 'micah', section: 'neviim' },
  { name: 'Nahum', nameHe: 'נַחוּם', file: 'nahum', section: 'neviim' },
  { name: 'Habakkuk', nameHe: 'חֲבַקּוּק', file: 'habakkuk', section: 'neviim' },
  { name: 'Zephaniah', nameHe: 'צְפַנְיָה', file: 'zephaniah', section: 'neviim' },
  { name: 'Haggai', nameHe: 'חַגַּי', file: 'haggai', section: 'neviim' },
  { name: 'Zechariah', nameHe: 'זְכַרְיָה', file: 'zechariah', section: 'neviim' },
  { name: 'Malachi', nameHe: 'מַלְאָכִי', file: 'malachi', section: 'neviim' },
  // Ketuvim - Writings (13 books)
  { name: 'Psalms', nameHe: 'תְּהִלִּים', file: 'psalms', section: 'ketuvim' },
  { name: 'Proverbs', nameHe: 'מִשְׁלֵי', file: 'proverbs', section: 'ketuvim' },
  { name: 'Job', nameHe: 'אִיּוֹב', file: 'job', section: 'ketuvim' },
  { name: 'Song of Songs', nameHe: 'שִׁיר הַשִּׁירִים', file: 'song-of-songs', section: 'ketuvim' },
  { name: 'Ruth', nameHe: 'רוּת', file: 'ruth', section: 'ketuvim' },
  { name: 'Lamentations', nameHe: 'אֵיכָה', file: 'lamentations', section: 'ketuvim' },
  { name: 'Ecclesiastes', nameHe: 'קֹהֶלֶת', file: 'ecclesiastes', section: 'ketuvim' },
  { name: 'Esther', nameHe: 'אֶסְתֵּר', file: 'esther', section: 'ketuvim' },
  { name: 'Daniel', nameHe: 'דָּנִיֵּאל', file: 'daniel', section: 'ketuvim' },
  { name: 'Ezra', nameHe: 'עֶזְרָא', file: 'ezra', section: 'ketuvim' },
  { name: 'Nehemiah', nameHe: 'נְחֶמְיָה', file: 'nehemiah', section: 'ketuvim' },
  { name: 'I Chronicles', nameHe: 'דִּבְרֵי הַיָּמִים א', file: 'i-chronicles', section: 'ketuvim' },
  { name: 'II Chronicles', nameHe: 'דִּבְרֵי הַיָּמִים ב', file: 'ii-chronicles', section: 'ketuvim' },
] as const;

// Derived constants for convenience
export const BOOK_ORDER = BOOKS.map(b => b.name);

export const TORAH_BOOKS = new Set(
  BOOKS.filter(b => b.section === 'torah').map(b => b.name)
);

export const NEVIIM_BOOKS = new Set(
  BOOKS.filter(b => b.section === 'neviim').map(b => b.name)
);

export const KETUVIM_BOOKS = new Set(
  BOOKS.filter(b => b.section === 'ketuvim').map(b => b.name)
);

export const BOOK_FILES: Record<string, string> = Object.fromEntries(
  BOOKS.map(b => [b.name, b.file])
);

export const BOOK_HEBREW_NAMES: Record<string, string> = Object.fromEntries(
  BOOKS.map(b => [b.name, b.nameHe])
);

/**
 * Get the section (Torah/Nevi'im/Ketuvim) for a book name.
 */
export function getBookSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  if (TORAH_BOOKS.has(bookName)) return 'torah';
  if (KETUVIM_BOOKS.has(bookName)) return 'ketuvim';
  return 'neviim';
}
