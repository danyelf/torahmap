// Single source of truth for Tanakh book definitions

export interface BookDefinition {
  name: string;
  file: string;
  section: 'torah' | 'neviim' | 'ketuvim';
}

/**
 * All 39 books of the Tanakh in canonical order.
 * Each entry contains the display name, file prefix, and section.
 */
export const BOOKS: readonly BookDefinition[] = [
  // Torah (5 books)
  { name: 'Genesis', file: 'genesis', section: 'torah' },
  { name: 'Exodus', file: 'exodus', section: 'torah' },
  { name: 'Leviticus', file: 'leviticus', section: 'torah' },
  { name: 'Numbers', file: 'numbers', section: 'torah' },
  { name: 'Deuteronomy', file: 'deuteronomy', section: 'torah' },
  // Nevi'im - Former Prophets (6 books)
  { name: 'Joshua', file: 'joshua', section: 'neviim' },
  { name: 'Judges', file: 'judges', section: 'neviim' },
  { name: 'I Samuel', file: 'i-samuel', section: 'neviim' },
  { name: 'II Samuel', file: 'ii-samuel', section: 'neviim' },
  { name: 'I Kings', file: 'i-kings', section: 'neviim' },
  { name: 'II Kings', file: 'ii-kings', section: 'neviim' },
  // Nevi'im - Latter Prophets (3 major)
  { name: 'Isaiah', file: 'isaiah', section: 'neviim' },
  { name: 'Jeremiah', file: 'jeremiah', section: 'neviim' },
  { name: 'Ezekiel', file: 'ezekiel', section: 'neviim' },
  // Nevi'im - Twelve Minor Prophets
  { name: 'Hosea', file: 'hosea', section: 'neviim' },
  { name: 'Joel', file: 'joel', section: 'neviim' },
  { name: 'Amos', file: 'amos', section: 'neviim' },
  { name: 'Obadiah', file: 'obadiah', section: 'neviim' },
  { name: 'Jonah', file: 'jonah', section: 'neviim' },
  { name: 'Micah', file: 'micah', section: 'neviim' },
  { name: 'Nahum', file: 'nahum', section: 'neviim' },
  { name: 'Habakkuk', file: 'habakkuk', section: 'neviim' },
  { name: 'Zephaniah', file: 'zephaniah', section: 'neviim' },
  { name: 'Haggai', file: 'haggai', section: 'neviim' },
  { name: 'Zechariah', file: 'zechariah', section: 'neviim' },
  { name: 'Malachi', file: 'malachi', section: 'neviim' },
  // Ketuvim - Writings (13 books)
  { name: 'Psalms', file: 'psalms', section: 'ketuvim' },
  { name: 'Proverbs', file: 'proverbs', section: 'ketuvim' },
  { name: 'Job', file: 'job', section: 'ketuvim' },
  { name: 'Song of Songs', file: 'song-of-songs', section: 'ketuvim' },
  { name: 'Ruth', file: 'ruth', section: 'ketuvim' },
  { name: 'Lamentations', file: 'lamentations', section: 'ketuvim' },
  { name: 'Ecclesiastes', file: 'ecclesiastes', section: 'ketuvim' },
  { name: 'Esther', file: 'esther', section: 'ketuvim' },
  { name: 'Daniel', file: 'daniel', section: 'ketuvim' },
  { name: 'Ezra', file: 'ezra', section: 'ketuvim' },
  { name: 'Nehemiah', file: 'nehemiah', section: 'ketuvim' },
  { name: 'I Chronicles', file: 'i-chronicles', section: 'ketuvim' },
  { name: 'II Chronicles', file: 'ii-chronicles', section: 'ketuvim' },
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

/**
 * Get the section (Torah/Nevi'im/Ketuvim) for a book name.
 */
export function getBookSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  if (TORAH_BOOKS.has(bookName)) return 'torah';
  if (KETUVIM_BOOKS.has(bookName)) return 'ketuvim';
  return 'neviim';
}
