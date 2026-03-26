// Multi-scale word frequency clouds
// At low zoom: book-level distinctive words
// At mid zoom: section-level words (each book split into ~3-5 chunks)
// At high zoom: chapter-level distinctive words
// Smooth crossfade between zoom levels

import type { VerseLayout } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';
import { stripNikkud } from './search.ts';

// Hebrew stop words to filter out (common grammatical particles)
const HEBREW_STOP_WORDS = new Set([
  'את', 'של', 'על', 'אל', 'לא', 'כי', 'אשר', 'הוא', 'היא',
  'הם', 'הן', 'אני', 'אנחנו', 'אתה', 'אתם', 'אתן',
  'זה', 'זאת', 'אלה', 'מה', 'מי', 'גם', 'כל', 'עם',
  'יש', 'אין', 'היה', 'להם', 'לו', 'לה', 'בו', 'בה',
  'ולא', 'ואת', 'כן', 'עד', 'אם', 'או', 'רק', 'בן',
  'לך', 'לי', 'בי', 'לנו', 'בם', 'בנו', 'להם',
  'ויאמר', 'אמר', 'ואמר',
]);

const MIN_WORD_LENGTH = 2;

// --- Zoom level thresholds ---
// Book level: visible when zoom < 0.7, fades from 0.5 to 0.7
// Section level: visible when zoom 0.3 to 2.0, peak at 0.7-1.2
// Chapter level: visible when zoom > 1.0, fades in from 1.0 to 1.5

interface ZoomBand {
  fadeIn: number;   // zoom where opacity starts rising from 0
  fullIn: number;   // zoom where opacity reaches max
  fullOut: number;  // zoom where opacity starts falling
  fadeOut: number;   // zoom where opacity reaches 0
  maxOpacity: number;
}

const BOOK_BAND: ZoomBand = {
  fadeIn: 0, fullIn: 0, fullOut: 0.4, fadeOut: 0.8,
  maxOpacity: 0.30,
};

const SECTION_BAND: ZoomBand = {
  fadeIn: 0.3, fullIn: 0.6, fullOut: 1.3, fadeOut: 2.0,
  maxOpacity: 0.28,
};

const CHAPTER_BAND: ZoomBand = {
  fadeIn: 1.2, fullIn: 1.8, fullOut: 3.5, fadeOut: 5.0,
  maxOpacity: 0.25,
};

function bandOpacity(band: ZoomBand, zoom: number): number {
  if (zoom <= band.fadeIn) return 0;
  if (zoom <= band.fullIn) {
    // Band starts at 0, so fadeIn === fullIn means always full below fullOut
    if (band.fadeIn === band.fullIn) return band.maxOpacity;
    return band.maxOpacity * (zoom - band.fadeIn) / (band.fullIn - band.fadeIn);
  }
  if (zoom <= band.fullOut) return band.maxOpacity;
  if (zoom <= band.fadeOut) {
    return band.maxOpacity * (1 - (zoom - band.fullOut) / (band.fadeOut - band.fullOut));
  }
  return 0;
}

// --- Data structures ---

interface WordEntry {
  text: string;
  frequency: number;
  normalizedSize: number; // 0-1
}

interface Region {
  label: string;
  words: WordEntry[];
  minX: number; maxX: number;
  minY: number; maxY: number;
}

interface WordPlacement {
  worldX: number;
  worldY: number;
  fontSize: number; // in world units
  element: HTMLSpanElement;
}

interface ScaleLevel {
  band: ZoomBand;
  regions: Region[];
  placements: WordPlacement[];
  container: HTMLDivElement;
}

// --- Module state ---
let outerContainer: HTMLDivElement | null = null;
let scaleLevels: ScaleLevel[] = [];

// Global word frequencies for TF-IDF style scoring
let globalWordFreqs: Map<string, number> = new Map();
let globalTotalWords = 0;

// --- Word extraction ---

function extractWords(text: string): string[] {
  const stripped = stripNikkud(text);
  const results: string[] = [];
  for (const word of stripped.split(/\s+/)) {
    const clean = word.replace(/[^\u0590-\u05FF]/g, '');
    if (clean.length < MIN_WORD_LENGTH) continue;
    if (HEBREW_STOP_WORDS.has(clean)) continue;
    results.push(clean);
  }
  return results;
}

// --- Compute regions at different scales ---

function computeGlobalFreqs(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
): void {
  globalWordFreqs = new Map();
  globalTotalWords = 0;
  for (const v of verses) {
    const text = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he;
    if (!text) continue;
    for (const w of extractWords(text)) {
      globalWordFreqs.set(w, (globalWordFreqs.get(w) || 0) + 1);
      globalTotalWords++;
    }
  }
}

/** Score words by TF-IDF-like distinctiveness: high local frequency, lower global frequency */
function scoreAndRank(localFreqs: Map<string, number>, topN: number): WordEntry[] {
  const localTotal = [...localFreqs.values()].reduce((a, b) => a + b, 0);
  if (localTotal === 0) return [];

  const scored: { text: string; score: number; freq: number }[] = [];
  for (const [word, freq] of localFreqs) {
    const tf = freq / localTotal;
    const globalFreq = globalWordFreqs.get(word) || 1;
    const idf = Math.log(globalTotalWords / globalFreq);
    scored.push({ text: word, score: tf * idf, freq });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);
  if (top.length === 0) return [];

  const maxScore = top[0].score;
  const minScore = top[top.length - 1].score;
  const range = maxScore - minScore || 1;

  return top.map(s => ({
    text: s.text,
    frequency: s.freq,
    normalizedSize: (s.score - minScore) / range,
  }));
}

function computeBookRegions(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
): Region[] {
  const bookData: Record<string, {
    freqs: Map<string, number>;
    minX: number; maxX: number; minY: number; maxY: number;
  }> = {};

  for (const v of verses) {
    if (!bookData[v.book]) {
      bookData[v.book] = {
        freqs: new Map(),
        minX: v.x, maxX: v.x + v.size,
        minY: v.y, maxY: v.y + v.size,
      };
    }
    const bd = bookData[v.book];
    bd.minX = Math.min(bd.minX, v.x);
    bd.maxX = Math.max(bd.maxX, v.x + v.size);
    bd.minY = Math.min(bd.minY, v.y);
    bd.maxY = Math.max(bd.maxY, v.y + v.size);

    const text = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he;
    if (!text) continue;
    for (const w of extractWords(text)) {
      bd.freqs.set(w, (bd.freqs.get(w) || 0) + 1);
    }
  }

  const regions: Region[] = [];
  for (const [book, bd] of Object.entries(bookData)) {
    const words = scoreAndRank(bd.freqs, 8);
    if (words.length === 0) continue;
    regions.push({
      label: book,
      words,
      minX: bd.minX, maxX: bd.maxX,
      minY: bd.minY, maxY: bd.maxY,
    });
  }
  return regions;
}

function computeSectionRegions(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
): Region[] {
  // Group verses by book, then split each book into ~4 sections by chapter
  const bookChapters: Record<string, Map<number, VerseLayout[]>> = {};
  for (const v of verses) {
    if (!bookChapters[v.book]) bookChapters[v.book] = new Map();
    const chapters = bookChapters[v.book];
    if (!chapters.has(v.chapter)) chapters.set(v.chapter, []);
    chapters.get(v.chapter)!.push(v);
  }

  const regions: Region[] = [];

  for (const [book, chapters] of Object.entries(bookChapters)) {
    const chapterNums = [...chapters.keys()].sort((a, b) => a - b);
    const totalChapters = chapterNums.length;
    const sectionsCount = Math.max(1, Math.min(5, Math.ceil(totalChapters / 8)));
    const chapsPerSection = Math.ceil(totalChapters / sectionsCount);

    for (let s = 0; s < sectionsCount; s++) {
      const startIdx = s * chapsPerSection;
      const endIdx = Math.min(startIdx + chapsPerSection, totalChapters);
      if (startIdx >= totalChapters) break;

      const sectionChapters = chapterNums.slice(startIdx, endIdx);
      const freqs = new Map<string, number>();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      for (const ch of sectionChapters) {
        for (const v of chapters.get(ch)!) {
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x + v.size);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y + v.size);

          const text = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he;
          if (!text) continue;
          for (const w of extractWords(text)) {
            freqs.set(w, (freqs.get(w) || 0) + 1);
          }
        }
      }

      const words = scoreAndRank(freqs, 6);
      if (words.length === 0) continue;

      regions.push({
        label: `${book} ${sectionChapters[0]}-${sectionChapters[sectionChapters.length - 1]}`,
        words,
        minX, maxX, minY, maxY,
      });
    }
  }

  return regions;
}

function computeChapterRegions(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
): Region[] {
  const chapterData: Record<string, {
    freqs: Map<string, number>;
    minX: number; maxX: number; minY: number; maxY: number;
  }> = {};

  for (const v of verses) {
    const key = `${v.book}:${v.chapter}`;
    if (!chapterData[key]) {
      chapterData[key] = {
        freqs: new Map(),
        minX: v.x, maxX: v.x + v.size,
        minY: v.y, maxY: v.y + v.size,
      };
    }
    const cd = chapterData[key];
    cd.minX = Math.min(cd.minX, v.x);
    cd.maxX = Math.max(cd.maxX, v.x + v.size);
    cd.minY = Math.min(cd.minY, v.y);
    cd.maxY = Math.max(cd.maxY, v.y + v.size);

    const text = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he;
    if (!text) continue;
    for (const w of extractWords(text)) {
      cd.freqs.set(w, (cd.freqs.get(w) || 0) + 1);
    }
  }

  const regions: Region[] = [];
  for (const [key, cd] of Object.entries(chapterData)) {
    const words = scoreAndRank(cd.freqs, 4);
    if (words.length === 0) continue;
    regions.push({
      label: key,
      words,
      minX: cd.minX, maxX: cd.maxX,
      minY: cd.minY, maxY: cd.maxY,
    });
  }
  return regions;
}

// --- Placement ---

function placeWordsInRegion(region: Region, sizeScale: number): WordPlacement[] {
  const placements: WordPlacement[] = [];
  const width = region.maxX - region.minX;
  const height = region.maxY - region.minY;
  if (width <= 0 || height <= 0) return placements;

  const minFontSize = Math.min(width * 0.07, height * 0.05) * sizeScale;
  const maxFontSize = minFontSize * 3.0;

  const count = region.words.length;
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);

  const marginX = width * 0.05;
  const marginY = height * 0.08;
  const usableW = width - marginX * 2;
  const usableH = height - marginY * 2;

  for (let i = 0; i < count; i++) {
    const word = region.words[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const cellW = usableW / cols;
    const cellH = usableH / rows;

    // Deterministic jitter
    const offsetX = ((i * 7 + 3) % 11) / 11 * 0.4 - 0.2;
    const offsetY = ((i * 13 + 5) % 11) / 11 * 0.3 - 0.15;

    const worldX = region.minX + marginX + cellW * (col + 0.5 + offsetX);
    const worldY = region.minY + marginY + cellH * (row + 0.5 + offsetY);
    const fontSize = minFontSize + (maxFontSize - minFontSize) * word.normalizedSize;

    const element = document.createElement('span');
    element.textContent = word.text;
    element.style.cssText = `
      position:absolute;
      pointer-events:none;
      font-family:"Noto Sans Hebrew",system-ui,sans-serif;
      font-weight:700;
      color:#c8d0e0;
      white-space:nowrap;
      transform:translate(-50%,-50%);
      text-shadow:0 0 10px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3);
      will-change:left,top,font-size;
    `;

    placements.push({ worldX, worldY, fontSize, element });
  }

  return placements;
}

// --- Public API ---

export function initWordClouds(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
  container: HTMLElement,
): void {
  // Compute global word frequencies for TF-IDF scoring
  computeGlobalFreqs(verses, verseTexts);

  // Compute regions at each scale
  const bookRegions = computeBookRegions(verses, verseTexts);
  const sectionRegions = computeSectionRegions(verses, verseTexts);
  const chapterRegions = computeChapterRegions(verses, verseTexts);

  // Create outer container
  outerContainer = document.createElement('div');
  outerContainer.id = 'word-clouds';
  outerContainer.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:2;';

  // Build scale levels
  scaleLevels = [
    buildScaleLevel(bookRegions, BOOK_BAND, 1.0),
    buildScaleLevel(sectionRegions, SECTION_BAND, 0.8),
    buildScaleLevel(chapterRegions, CHAPTER_BAND, 0.6),
  ];

  for (const level of scaleLevels) {
    outerContainer.appendChild(level.container);
  }

  container.appendChild(outerContainer);
}

function buildScaleLevel(regions: Region[], band: ZoomBand, sizeScale: number): ScaleLevel {
  const levelContainer = document.createElement('div');
  levelContainer.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

  const allPlacements: WordPlacement[] = [];
  for (const region of regions) {
    const placements = placeWordsInRegion(region, sizeScale);
    for (const p of placements) {
      levelContainer.appendChild(p.element);
    }
    allPlacements.push(...placements);
  }

  return {
    band,
    regions,
    placements: allPlacements,
    container: levelContainer,
  };
}

export function updateWordClouds(
  pan: { x: number; y: number },
  zoom: number,
): void {
  if (!outerContainer || scaleLevels.length === 0) return;

  // Viewport bounds for culling
  const vpLeft = 0;
  const vpTop = 0;
  const vpRight = window.innerWidth;
  const vpBottom = window.innerHeight;
  // Add margin so words don't pop in at edges
  const margin = 200;

  let anyVisible = false;

  for (const level of scaleLevels) {
    const opacity = bandOpacity(level.band, zoom);

    if (opacity <= 0.001) {
      level.container.style.display = 'none';
      continue;
    }

    anyVisible = true;
    level.container.style.display = '';
    level.container.style.opacity = String(opacity);

    for (const p of level.placements) {
      const screenX = (p.worldX + pan.x) * zoom;
      const screenY = (p.worldY + pan.y) * zoom;
      const screenFontSize = p.fontSize * zoom;

      // Cull off-screen words for performance
      if (
        screenX < vpLeft - margin || screenX > vpRight + margin ||
        screenY < vpTop - margin || screenY > vpBottom + margin
      ) {
        p.element.style.display = 'none';
        continue;
      }

      p.element.style.display = '';
      p.element.style.left = screenX + 'px';
      p.element.style.top = screenY + 'px';
      p.element.style.fontSize = screenFontSize + 'px';
    }
  }

  outerContainer.style.display = anyVisible ? '' : 'none';
}
