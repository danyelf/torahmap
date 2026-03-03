/**
 * Generate scroll-layout.json from tikkun.io data.
 *
 * Processes 245 tikkun.io page JSONs into a compact format that maps
 * every Torah verse to its physical scroll position (page, line, fraction).
 *
 * Usage: npx tsx scripts/generate-scroll-layout.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// -- Types --

interface TikkunVerse {
  book: number;
  chapter: number;
  verse: number;
}

interface TikkunLine {
  text: string[][];   // text[col][fragment]
  verses: TikkunVerse[];
  aliyot: { standard: number }[];
  isPetucha: boolean;
}

interface ScrollSegmentData {
  b: number;    // book (1-5)
  c: number;    // chapter
  v: number;    // verse
  p: number;    // page (1-245)
  l: number;    // line (0-based)
  s: number;    // startFraction (0.0-1.0)
  w: number;    // widthFraction (0.0-1.0)
  f?: string;   // format: 'n' (default, omitted) | 's' | 'h'
  pe?: boolean; // isPetucha (omitted when false)
}

interface ScrollLayoutData {
  pages: number;
  linesPerPage: number[];
  segments: ScrollSegmentData[];
}

// -- Helpers --

const TIKKUN_DIR = join(
  process.env.HOME || '~',
  'code/thirdparty/tikkun.io/src/data/pages/torah'
);

const SOF_PASUK = '\u05C3'; // ׃

/**
 * Strip petucha/setuma markers and leading/trailing whitespace.
 */
function stripMarkers(text: string): string {
  return text.replace(/#\(פ\)/g, '').replace(/#\(ס\)/g, '').trim();
}

/**
 * Strip nikkud and trop marks for character-count width estimation.
 * In a Torah scroll, only consonants take horizontal space.
 */
function stripForWidth(text: string): string {
  // Remove nikkud (U+0591-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C7)
  // and trop/cantillation marks
  return stripMarkers(text).replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g, '');
}

/**
 * Check if a verse reference is within Song of the Sea (Exodus 15:1-19).
 */
function isShirahVerse(book: number, chapter: number, verse: number): boolean {
  return book === 2 && chapter === 15 && verse >= 1 && verse <= 19;
}

/**
 * Advance to the next verse in sequence.
 * Used when sof pasuk signals a verse boundary but the next line's
 * verses field hasn't been read yet.
 */
function advanceVerse(v: TikkunVerse, torahStructure: Map<string, number>): TikkunVerse {
  const maxVerse = torahStructure.get(`${v.book}:${v.chapter}`) || 999;
  if (v.verse < maxVerse) {
    return { book: v.book, chapter: v.chapter, verse: v.verse + 1 };
  }
  // Next chapter
  const nextChapter = v.chapter + 1;
  const nextChapterKey = `${v.book}:${nextChapter}`;
  if (torahStructure.has(nextChapterKey)) {
    return { book: v.book, chapter: nextChapter, verse: 1 };
  }
  // Next book
  return { book: v.book + 1, chapter: 1, verse: 1 };
}

// -- Main Processing --

function loadTorahStructure(): Map<string, number> {
  // Build a map of book:chapter -> verse count from the tikkun TOC
  const tocPath = join(
    process.env.HOME || '~',
    'code/thirdparty/tikkun.io/src/data/tables-of-contents/torah.json'
  );
  const toc = JSON.parse(readFileSync(tocPath, 'utf-8'));
  const structure = new Map<string, number>();

  for (const book of Object.keys(toc)) {
    for (const chapter of Object.keys(toc[book])) {
      const verses = Object.keys(toc[book][chapter]);
      const maxVerse = Math.max(...verses.map(Number));
      structure.set(`${book}:${chapter}`, maxVerse);
    }
  }

  return structure;
}

function processLine(
  line: TikkunLine,
  page: number,
  lineIdx: number,
  currentVerse: TikkunVerse,
  torahStructure: Map<string, number>,
  segments: ScrollSegmentData[]
): TikkunVerse {
  const isPetucha = line.isPetucha;

  // Build queue of upcoming verse starts from the verses field.
  // Don't override currentVerse — let sof pasuk tracking advance it naturally.
  // This prevents off-by-one errors in shirah where frag 0 is the tail of
  // the previous verse, not the start of the verse listed in the verses field.
  const verseQueue = line.verses.filter(v =>
    v.book > currentVerse.book ||
    (v.book === currentVerse.book && v.chapter > currentVerse.chapter) ||
    (v.book === currentVerse.book && v.chapter === currentVerse.chapter && v.verse > currentVerse.verse)
  );

  // Check if the line has content
  const allText = line.text.flat().join('');
  if (stripForWidth(allText).length === 0) {
    return currentVerse; // Empty line, skip
  }

  const isHaazinu = line.text.length > 1;

  if (isHaazinu) {
    // Ha'azinu: two-column layout
    // text[0] = right column (read first in RTL), text[1] = left column
    for (let colIdx = 0; colIdx < line.text.length; colIdx++) {
      const colFragments = line.text[colIdx];
      const colText = colFragments.join('');
      const stripped = stripForWidth(colText);
      if (stripped.length === 0) continue;

      // Each column takes roughly half the line
      // col 0 = right half (start 0.5), col 1 = left half (start 0)
      const startFrac = colIdx === 0 ? 0.55 : 0;
      const widthFrac = 0.45;

      segments.push({
        b: currentVerse.book,
        c: currentVerse.chapter,
        v: currentVerse.verse,
        p: page,
        l: lineIdx,
        s: round(startFrac),
        w: round(widthFrac),
        f: 'h',
        pe: isPetucha,
      });

      // Check if this column text ends with sof pasuk
      if (stripMarkers(colText).endsWith(SOF_PASUK)) {
        if (verseQueue.length > 0) {
          currentVerse = verseQueue.shift()!;
        } else {
          currentVerse = advanceVerse(currentVerse, torahStructure);
        }
      }
    }
  } else {
    const fragments = line.text[0];

    if (fragments.length > 1) {
      // Multi-fragment line (shirah or verse boundary)
      const isShirah = isShirahVerse(
        currentVerse.book,
        currentVerse.chapter,
        currentVerse.verse
      );
      const format = isShirah ? 's' : 'n';

      if (isShirah) {
        // Shirah brick pattern: fixed-position zones with gaps
        // 3-fragment lines: text | gap | text | gap | text
        // 2-fragment lines: gap | text | gap | text | gap
        const BRICK_WIDTH = 0.27;
        const GAP = 0.095;

        let positions: Array<{ s: number; w: number }>;
        if (fragments.length === 3) {
          positions = [
            { s: 0, w: BRICK_WIDTH },
            { s: BRICK_WIDTH + GAP, w: BRICK_WIDTH },
            { s: 1 - BRICK_WIDTH, w: BRICK_WIDTH },
          ];
        } else {
          // 2-fragment lines: offset to create brick stagger
          positions = [
            { s: GAP + BRICK_WIDTH / 2, w: BRICK_WIDTH },
            { s: 1 - GAP - BRICK_WIDTH * 1.5, w: BRICK_WIDTH },
          ];
        }

        for (let fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
          const fragText = fragments[fragIdx];
          const stripped = stripForWidth(fragText);
          if (stripped.length === 0) continue;

          const pos = positions[fragIdx];
          segments.push({
            b: currentVerse.book,
            c: currentVerse.chapter,
            v: currentVerse.verse,
            p: page,
            l: lineIdx,
            s: round(pos.s),
            w: round(pos.w),
            f: 's',
            pe: isPetucha,
          });

          if (stripMarkers(fragText).endsWith(SOF_PASUK)) {
            if (verseQueue.length > 0) {
              currentVerse = verseQueue.shift()!;
            } else {
              currentVerse = advanceVerse(currentVerse, torahStructure);
            }
          }
        }
      } else {
        // Non-shirah multi-fragment: compute proportional widths
        const strippedFragments = fragments.map(f => stripForWidth(f));
        const totalChars = strippedFragments.reduce((sum, f) => sum + f.length, 0);
        if (totalChars === 0) return currentVerse;

        let cumChars = 0;
        for (let fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
          const fragText = fragments[fragIdx];
          const stripped = strippedFragments[fragIdx];
          if (stripped.length === 0) continue;

          const startFrac = cumChars / totalChars;
          const widthFrac = stripped.length / totalChars;

          segments.push({
            b: currentVerse.book,
            c: currentVerse.chapter,
            v: currentVerse.verse,
            p: page,
            l: lineIdx,
            s: round(startFrac),
            w: round(widthFrac),
            f: 'n',
            pe: isPetucha,
          });

          cumChars += stripped.length;

          if (stripMarkers(fragText).endsWith(SOF_PASUK)) {
            if (verseQueue.length > 0) {
              currentVerse = verseQueue.shift()!;
            } else {
              currentVerse = advanceVerse(currentVerse, torahStructure);
            }
          }
        }
      }
    } else {
      // Single fragment
      const fullText = fragments[0];
      const strippedFull = stripForWidth(fullText);
      if (strippedFull.length === 0) return currentVerse;

      const cleanText = stripMarkers(fullText);

      // Check for sof pasuk in the middle (verse boundary within line)
      const sofPasukIdx = cleanText.indexOf(SOF_PASUK);
      const hasSofPasuk = sofPasukIdx !== -1;
      const hasTextAfterSofPasuk =
        hasSofPasuk && stripForWidth(cleanText.slice(sofPasukIdx + 1)).length > 0;

      if (hasTextAfterSofPasuk) {
        // Split at sof pasuk: text before = current verse, text after = next verse
        const beforeText = cleanText.slice(0, sofPasukIdx + 1);
        const afterText = cleanText.slice(sofPasukIdx + 1);
        const beforeLen = stripForWidth(beforeText).length;
        const afterLen = stripForWidth(afterText).length;
        const totalLen = beforeLen + afterLen;

        // Segment for current verse (end of verse)
        segments.push({
          b: currentVerse.book,
          c: currentVerse.chapter,
          v: currentVerse.verse,
          p: page,
          l: lineIdx,
          s: 0,
          w: round(beforeLen / totalLen),
          f: 'n',
          pe: isPetucha,
        });

        // Advance to next verse
        if (verseQueue.length > 0) {
          currentVerse = verseQueue.shift()!;
        } else {
          currentVerse = advanceVerse(currentVerse, torahStructure);
        }

        // Check for ANOTHER sof pasuk in the remaining text (very short verse)
        const afterClean = stripMarkers(afterText);
        const secondSofPasuk = afterClean.indexOf(SOF_PASUK);
        const hasSecondSofPasuk = secondSofPasuk !== -1;
        const hasTextAfterSecond =
          hasSecondSofPasuk &&
          stripForWidth(afterClean.slice(secondSofPasuk + 1)).length > 0;

        if (hasTextAfterSecond) {
          // Three verses on one line
          const midText = afterClean.slice(0, secondSofPasuk + 1);
          const lastText = afterClean.slice(secondSofPasuk + 1);
          const midLen = stripForWidth(midText).length;
          const lastLen = stripForWidth(lastText).length;
          const startAfter = beforeLen / totalLen;

          segments.push({
            b: currentVerse.book,
            c: currentVerse.chapter,
            v: currentVerse.verse,
            p: page,
            l: lineIdx,
            s: round(startAfter),
            w: round(midLen / totalLen),
            f: 'n',
            pe: isPetucha,
          });

          currentVerse = advanceVerse(currentVerse, torahStructure);

          segments.push({
            b: currentVerse.book,
            c: currentVerse.chapter,
            v: currentVerse.verse,
            p: page,
            l: lineIdx,
            s: round((beforeLen + midLen) / totalLen),
            w: round(lastLen / totalLen),
            f: 'n',
            pe: isPetucha,
          });

          // Check if the last text also ends with sof pasuk
          if (afterClean.trimEnd().endsWith(SOF_PASUK)) {
            currentVerse = advanceVerse(currentVerse, torahStructure);
          }
        } else {
          // Two verses on one line
          segments.push({
            b: currentVerse.book,
            c: currentVerse.chapter,
            v: currentVerse.verse,
            p: page,
            l: lineIdx,
            s: round(beforeLen / totalLen),
            w: round(afterLen / totalLen),
            f: 'n',
            pe: isPetucha,
          });

          // Check if the after text also ends with sof pasuk
          if (afterClean.trimEnd().endsWith(SOF_PASUK)) {
            if (verseQueue.length > 0) {
              currentVerse = verseQueue.shift()!;
            } else {
              currentVerse = advanceVerse(currentVerse, torahStructure);
            }
          }
        }
      } else {
        // Whole line belongs to current verse
        segments.push({
          b: currentVerse.book,
          c: currentVerse.chapter,
          v: currentVerse.verse,
          p: page,
          l: lineIdx,
          s: 0,
          w: 1,
          f: 'n',
          pe: isPetucha,
        });

        // If the line ends with sof pasuk, verse ends here
        if (hasSofPasuk) {
          if (verseQueue.length > 0) {
            currentVerse = verseQueue.shift()!;
          } else {
            currentVerse = advanceVerse(currentVerse, torahStructure);
          }
        }
      }
    }
  }

  return currentVerse;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function makeSegment(
  verse: TikkunVerse,
  page: number,
  lineIdx: number,
  startFrac: number,
  widthFrac: number,
  format: string,
  isPetucha: boolean
): ScrollSegmentData {
  const seg: ScrollSegmentData = {
    b: verse.book,
    c: verse.chapter,
    v: verse.verse,
    p: page,
    l: lineIdx,
    s: round(startFrac),
    w: round(widthFrac),
  };
  if (format !== 'n') seg.f = format;
  if (isPetucha) seg.pe = true;
  return seg;
}

function generate(): void {
  console.log('Loading Torah structure...');
  const torahStructure = loadTorahStructure();

  const segments: ScrollSegmentData[] = [];
  const linesPerPage: number[] = [];

  let currentVerse: TikkunVerse = { book: 1, chapter: 1, verse: 1 };

  console.log('Processing 245 pages...');
  for (let page = 1; page <= 245; page++) {
    const pagePath = join(TIKKUN_DIR, `${page}.json`);
    const lines: TikkunLine[] = JSON.parse(readFileSync(pagePath, 'utf-8'));
    linesPerPage.push(lines.length);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      currentVerse = processLine(
        line,
        page,
        lineIdx,
        currentVerse,
        torahStructure,
        segments
      );
    }
  }

  const data: ScrollLayoutData = {
    pages: 245,
    linesPerPage,
    segments,
  };

  // Validate
  validate(data);

  // Strip default values to reduce file size
  // f='n' (normal) is the default, pe=false is the default
  const compactSegments = data.segments.map(seg => {
    const compact: Record<string, unknown> = {
      b: seg.b, c: seg.c, v: seg.v,
      p: seg.p, l: seg.l, s: seg.s, w: seg.w,
    };
    if (seg.f && seg.f !== 'n') compact.f = seg.f;
    if (seg.pe) compact.pe = true;
    return compact;
  });
  const compactData = { ...data, segments: compactSegments };

  // Write output
  const outPath = join(process.cwd(), 'public/data/scroll-layout.json');
  const json = JSON.stringify(compactData);
  writeFileSync(outPath, json);
  const sizeKB = Math.round(Buffer.byteLength(json) / 1024);
  console.log(`\nWrote ${outPath} (${sizeKB} KB)`);
}

function validate(data: ScrollLayoutData): void {
  console.log('\n--- Validation ---');

  // Count unique verses
  const verseKeys = new Set<string>();
  const versesSegmentCount = new Map<string, number>();
  const formatCounts = { n: 0, s: 0, h: 0 };

  for (const seg of data.segments) {
    const key = `${seg.b}:${seg.c}:${seg.v}`;
    verseKeys.add(key);
    versesSegmentCount.set(key, (versesSegmentCount.get(key) || 0) + 1);
    formatCounts[seg.f as keyof typeof formatCounts]++;
  }

  // Check page coverage
  const pages = new Set(data.segments.map(s => s.p));
  const missingPages = [];
  for (let p = 1; p <= 245; p++) {
    if (!pages.has(p)) missingPages.push(p);
  }

  // Check for verses with 0 segments
  const emptyVerses = [...versesSegmentCount.entries()].filter(
    ([, count]) => count === 0
  );

  console.log(`Total segments: ${data.segments.length}`);
  console.log(`Unique verses: ${verseKeys.size}`);
  console.log(
    `Avg segments/verse: ${(data.segments.length / verseKeys.size).toFixed(2)}`
  );
  console.log(`Format counts: normal=${formatCounts.n}, shirah=${formatCounts.s}, haazinu=${formatCounts.h}`);
  console.log(`Pages covered: ${pages.size}/245`);
  if (missingPages.length > 0) {
    console.warn(`WARNING: Missing pages: ${missingPages.join(', ')}`);
  }
  if (emptyVerses.length > 0) {
    console.warn(`WARNING: Verses with 0 segments: ${emptyVerses.length}`);
  }

  // Expected: 5,846 Torah verses
  if (verseKeys.size < 5800) {
    console.warn(
      `WARNING: Expected ~5846 Torah verses, got ${verseKeys.size}`
    );
  } else {
    console.log(`PASS: Verse count looks correct (expected ~5846)`);
  }

  if (missingPages.length === 0) {
    console.log('PASS: All 245 pages covered');
  }
}

generate();
