// Numbers written in Hebrew letters, as chapters, verses and dapim are.

import { isNikkud } from './letters.ts';

const VALUES: Record<string, number> = {
  'א': 1,
  'ב': 2,
  'ג': 3,
  'ד': 4,
  'ה': 5,
  'ו': 6,
  'ז': 7,
  'ח': 8,
  'ט': 9,
  'י': 10,
  'כ': 20,
  'ך': 20,
  'ל': 30,
  'מ': 40,
  'ם': 40,
  'נ': 50,
  'ן': 50,
  'ס': 60,
  'ע': 70,
  'פ': 80,
  'ף': 80,
  'צ': 90,
  'ץ': 90,
  'ק': 100,
  'ר': 200,
  'ש': 300,
  'ת': 400,
};

// Geresh and gershayim, and the quotes typed for them.
const MARKS = new Set(['׳', '״', "'", '"', '’', '`']);

/**
 * The number Hebrew letters write, such as יז for 17; null for anything else.
 * The letters must fall from largest to smallest, as numbers are written, so
 * most words are not numbers.
 */
export function hebrewNumber(text: string): number | null {
  let total = 0;
  let last = Infinity;
  for (const char of text) {
    if (MARKS.has(char) || isNikkud(char.charCodeAt(0))) continue;
    const value = VALUES[char];
    if (value === undefined || value > last) return null;
    total += value;
    last = value;
  }
  return total > 0 ? total : null;
}
