#!/usr/bin/env node

// Write public/data/tanakh-structure.json: each book's chapter lengths, read
// from the downloaded Hebrew texts (scripts/download-texts.sh), the book each counts as in the
// traditional 24, and the layout.
//
// Usage: node scripts/fetch-tanakh-structure.js [texts-dir] > public/data/tanakh-structure.json

import fs from 'node:fs';
import path from 'node:path';

const TANAKH_BOOKS = {
  torah: [
    { english: 'Genesis', hebrew: 'בראשית' },
    { english: 'Exodus', hebrew: 'שמות' },
    { english: 'Leviticus', hebrew: 'ויקרא' },
    { english: 'Numbers', hebrew: 'במדבר' },
    { english: 'Deuteronomy', hebrew: 'דברים' },
  ],
  neviim: [
    { english: 'Joshua', hebrew: 'יהושע' },
    { english: 'Judges', hebrew: 'שופטים' },
    { english: 'I Samuel', hebrew: 'שמואל א', countedAs: 'Samuel' },
    { english: 'II Samuel', hebrew: 'שמואל ב', countedAs: 'Samuel' },
    { english: 'I Kings', hebrew: 'מלכים א', countedAs: 'Kings' },
    { english: 'II Kings', hebrew: 'מלכים ב', countedAs: 'Kings' },
    { english: 'Isaiah', hebrew: 'ישעיהו' },
    { english: 'Jeremiah', hebrew: 'ירמיהו' },
    { english: 'Ezekiel', hebrew: 'יחזקאל' },
    { english: 'Hosea', hebrew: 'הושע', countedAs: 'The Twelve' },
    { english: 'Joel', hebrew: 'יואל', countedAs: 'The Twelve' },
    { english: 'Amos', hebrew: 'עמוס', countedAs: 'The Twelve' },
    { english: 'Obadiah', hebrew: 'עובדיה', countedAs: 'The Twelve' },
    { english: 'Jonah', hebrew: 'יונה', countedAs: 'The Twelve' },
    { english: 'Micah', hebrew: 'מיכה', countedAs: 'The Twelve' },
    { english: 'Nahum', hebrew: 'נחום', countedAs: 'The Twelve' },
    { english: 'Habakkuk', hebrew: 'חבקוק', countedAs: 'The Twelve' },
    { english: 'Zephaniah', hebrew: 'צפניה', countedAs: 'The Twelve' },
    { english: 'Haggai', hebrew: 'חגי', countedAs: 'The Twelve' },
    { english: 'Zechariah', hebrew: 'זכריה', countedAs: 'The Twelve' },
    { english: 'Malachi', hebrew: 'מלאכי', countedAs: 'The Twelve' },
  ],
  ketuvim: [
    { english: 'Psalms', hebrew: 'תהלים' },
    { english: 'Proverbs', hebrew: 'משלי' },
    { english: 'Job', hebrew: 'איוב' },
    { english: 'Song of Songs', hebrew: 'שיר השירים' },
    { english: 'Ruth', hebrew: 'רות' },
    { english: 'Lamentations', hebrew: 'איכה' },
    { english: 'Ecclesiastes', hebrew: 'קהלת' },
    { english: 'Esther', hebrew: 'אסתר' },
    { english: 'Daniel', hebrew: 'דניאל' },
    { english: 'Ezra', hebrew: 'עזרא', countedAs: 'Ezra–Nehemiah' },
    { english: 'Nehemiah', hebrew: 'נחמיה', countedAs: 'Ezra–Nehemiah' },
    { english: 'I Chronicles', hebrew: 'דברי הימים א', countedAs: 'Chronicles' },
    { english: 'II Chronicles', hebrew: 'דברי הימים ב', countedAs: 'Chronicles' },
  ],
};

// How the map stacks and splits books. Kept by hand.
const LAYOUT = {
  minorProphetStacks: [
    ['Hosea', 'Joel'],
    ['Amos', 'Obadiah', 'Jonah'],
    ['Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai'],
    ['Zechariah', 'Malachi'],
  ],
  ketuvimStacks: [
    { books: ['Song of Songs', 'Ruth', 'Lamentations'], insertAfter: 'Job' },
    { books: ['Ecclesiastes', 'Esther'], insertAfter: 'Job' },
    { books: ['Ezra', 'Nehemiah'], insertAfter: 'Daniel' },
  ],
  multiColumnBooks: { Psalms: { splitAtChapter: 72 } },
};

const textsDir = process.argv[2] ?? path.join(import.meta.dirname, '..', 'data', 'texts');

function readChapters(bookName) {
  const file = path.join(textsDir, `${bookName.toLowerCase().replaceAll(' ', '-')}-he.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).text.map((verses) => verses.length);
}

const books = Object.entries(TANAKH_BOOKS).flatMap(([section, list]) =>
  list.map((book) => ({
    name: book.english,
    hebrewName: book.hebrew,
    chapters: readChapters(book.english),
    section,
    countedAs: book.countedAs ?? book.english,
  })),
);

console.log(JSON.stringify({ books, layout: LAYOUT }, null, 2));
