#!/usr/bin/env node

// Write public/data/tanakh-structure.json: each book's chapter lengths, read
// from the downloaded Hebrew texts (scripts/download-texts.sh), plus the layout.
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
    { english: 'I Samuel', hebrew: 'שמואל א' },
    { english: 'II Samuel', hebrew: 'שמואל ב' },
    { english: 'I Kings', hebrew: 'מלכים א' },
    { english: 'II Kings', hebrew: 'מלכים ב' },
    { english: 'Isaiah', hebrew: 'ישעיהו' },
    { english: 'Jeremiah', hebrew: 'ירמיהו' },
    { english: 'Ezekiel', hebrew: 'יחזקאל' },
    { english: 'Hosea', hebrew: 'הושע' },
    { english: 'Joel', hebrew: 'יואל' },
    { english: 'Amos', hebrew: 'עמוס' },
    { english: 'Obadiah', hebrew: 'עובדיה' },
    { english: 'Jonah', hebrew: 'יונה' },
    { english: 'Micah', hebrew: 'מיכה' },
    { english: 'Nahum', hebrew: 'נחום' },
    { english: 'Habakkuk', hebrew: 'חבקוק' },
    { english: 'Zephaniah', hebrew: 'צפניה' },
    { english: 'Haggai', hebrew: 'חגי' },
    { english: 'Zechariah', hebrew: 'זכריה' },
    { english: 'Malachi', hebrew: 'מלאכי' },
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
    { english: 'Ezra', hebrew: 'עזרא' },
    { english: 'Nehemiah', hebrew: 'נחמיה' },
    { english: 'I Chronicles', hebrew: 'דברי הימים א' },
    { english: 'II Chronicles', hebrew: 'דברי הימים ב' },
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
  })),
);

console.log(JSON.stringify({ books, layout: LAYOUT }, null, 2));
