// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, Verse, Bounds, DivineNamesData } from './types.ts';

const VERSE_SIZE = 6;       // pixels per verse square
const CHAPTER_GAP = 2;      // gap between chapter rows
const BOOK_GAP = 12;        // gap between book columns

// Seeded random for deterministic jitter (same layout every time)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Color constants for divine names
const DIVINE_NAME_COLORS: { [code: number]: [number, number, number] } = {
  1: [0.3, 0.5, 0.9],  // YHWH only - Blue
  2: [0.9, 0.3, 0.3],  // Elohim only - Red
  3: [0.7, 0.3, 0.8],  // Both - Purple
};

export function computeLayout(torahData: TorahData, divineNames?: DivineNamesData): Verse[] {
  const verses: Verse[] = [];
  let bookX = 0;
  let globalVerseIdx = 0;

  for (const book of torahData.books) {
    let maxChapterWidth = 0;
    let chapterY = 0;

    // Get divine names data for this book (if available)
    const bookDivineNames = divineNames?.[book.name];

    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      const verseCount = book.chapters[chapterIdx];

      for (let verseIdx = 0; verseIdx < verseCount; verseIdx++) {
        // Position jitter (±1px) to break up regular grid
        const jitterX = (seededRandom(globalVerseIdx * 2) - 0.5) * 2.0;
        const jitterY = (seededRandom(globalVerseIdx * 2 + 1) - 0.5) * 2.0;

        // Determine color based on divine name code
        let color: [number, number, number];
        const divineNameCode = bookDivineNames?.[chapterIdx]?.[verseIdx] ?? 0;

        if (divineNameCode > 0 && DIVINE_NAME_COLORS[divineNameCode]) {
          // Use divine name color for codes 1, 2, or 3
          color = DIVINE_NAME_COLORS[divineNameCode];
        } else {
          // Default gray with brightness variation (0.4 to 0.8) for code 0
          const brightness = 0.4 + seededRandom(globalVerseIdx * 3) * 0.4;
          color = [brightness, brightness, brightness];
        }

        verses.push({
          book: book.name,
          chapter: chapterIdx + 1,
          verse: verseIdx + 1,
          x: bookX + verseIdx * VERSE_SIZE + jitterX,
          y: chapterY + jitterY,
          size: VERSE_SIZE,
          color
        });

        globalVerseIdx++;
      }

      maxChapterWidth = Math.max(maxChapterWidth, verseCount * VERSE_SIZE);
      chapterY += VERSE_SIZE + CHAPTER_GAP;
    }

    bookX += maxChapterWidth + BOOK_GAP;
  }

  return verses;
}

export function getLayoutBounds(verses: Verse[]): Bounds {
  let maxX = 0, maxY = 0;
  for (const v of verses) {
    maxX = Math.max(maxX, v.x + v.size);
    maxY = Math.max(maxY, v.y + v.size);
  }
  return { width: maxX, height: maxY };
}
