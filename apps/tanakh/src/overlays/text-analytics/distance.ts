// How far apart two verses sit in the canon, and the colour of each distance.

import { type Color, oklchToRgb } from '@torahmap/utils';
import { getBookSection } from '../../books.ts';
import type { Place } from './places.ts';

/** Books counted as one: a book split in two, a scroll shared, and the Twelve Minor Prophets. */
const ONE_BOOK: string[][] = [
  ['I Samuel', 'II Samuel'],
  ['I Kings', 'II Kings'],
  ['I Chronicles', 'II Chronicles'],
  ['Ezra', 'Nehemiah'],
  [
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
  ],
];

const sameBook = (a: string, b: string): boolean =>
  a === b || ONE_BOOK.some((group) => group.includes(a) && group.includes(b));

/** The steps of distance, nearest first. */
export const DISTANCE_STEPS = [
  { name: 'Same chapter', color: oklchToRgb(0.54, 0.19, 300) },
  { name: 'Same book', color: oklchToRgb(0.64, 0.22, 350) },
  { name: 'Same section of the Tanakh', color: oklchToRgb(0.84, 0.15, 50) },
  { name: 'Another section', color: oklchToRgb(0.96, 0.1, 95) },
] as const satisfies readonly { name: string; color: Color }[];

/** The index in DISTANCE_STEPS of how far verse `b` is from verse `a`. */
export function distanceStep(a: Place, b: Place): number {
  if (a.book === b.book && a.chapter === b.chapter) return 0;
  if (sameBook(a.book, b.book)) return 1;
  return getBookSection(a.book) === getBookSection(b.book) ? 2 : 3;
}
