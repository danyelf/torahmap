#!/usr/bin/env tsx
// Build public/data/talmud/ from the tractates verify-coverage.ts downloaded and passed.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  amudIndex,
  type TalmudAmud,
  type TalmudPerek,
  type TalmudStructure,
  type TalmudTractate,
  type TalmudTractateText,
  type TalmudTractateEnglish,
  englishFile,
  textsFile,
  SEARCH_FILE,
  SEARCH_ENGLISH_FILE,
  STRUCTURE_FILE as TALMUD_STRUCTURE_FILE,
  type TalmudSearchText,
} from '@torahmap/talmud/data.ts';
import { stripNikkud } from '@torahmap/hebrew';
import { isHadran, markersOf, mishnahFrom, stripMarkerWord } from './markers.ts';
import {
  REPORT_PATH,
  cachePathsFor,
  shapeMatches,
  type CoverageReport,
} from './verify-coverage.ts';
import {
  STRUCTURE_FILE,
  TEXTS_FILE,
  getVerseText,
  type VerseTexts,
} from '@torahmap/tanakh/verseTexts.ts';
import {
  citationFinder,
  citationsByPlace,
  quoteFinder,
  type Placing,
  type Tanakh,
  type TanakhBook,
} from './citations.ts';
import { englishMarkers } from './english.ts';
import { englishSearchText } from '@torahmap/talmud/english.ts';

/**
 * A segment without its tags. Davidson's hold only <br>, <big>, <strong> and <b>; Wikisource's,
 * read for the verses it names, also hold <img> blobs (sometimes huge base64 PNGs), <a>/<span>
 * wrappers and the occasional `[label](url)` markdown link.
 */
export function stripHtml(s: string): string {
  return (
    s
      .replace(/<br\s*\/?>/gi, ' ')
      // Drop entire <img ...> tags including ones whose attributes contain
      // base64 data: URIs that may span tens of thousands of characters.
      .replace(/<img\b[^>]*>/gi, '')
      // Drop any other tag (open, close, or self-closing). At this point
      // anything in angle brackets is presentational/structural noise.
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Markdown links: [label](href) → label.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

interface SchemaJson {
  alts?: {
    Chapters?: {
      nodes?: Array<{
        heTitle?: string;
        wholeRef?: string;
      }>;
    };
  };
}

/**
 * Parse a Sefaria range ref into start and end endpoints.
 *
 * Supports two forms:
 *   "Berakhot 2a:1-13a:15"  — cross-daf range, both endpoints specified
 *   "Tamid 33a:8-14"        — shorthand: same daf/amud, only segment range
 *
 * Returns null if the format is unrecognized.
 */
export function parseWholeRef(ref: string): {
  startDaf: number;
  startAmud: 'a' | 'b';
  startSegment: number;
  endDaf: number;
  endAmud: 'a' | 'b';
  endSegment: number;
} | null {
  // Full form: "... 2a:1-13a:15"
  const full = ref.match(/\s(\d+)([ab]):(\d+)-(\d+)([ab]):(\d+)$/);
  if (full) {
    return {
      startDaf: parseInt(full[1], 10),
      startAmud: full[2] as 'a' | 'b',
      startSegment: parseInt(full[3], 10),
      endDaf: parseInt(full[4], 10),
      endAmud: full[5] as 'a' | 'b',
      endSegment: parseInt(full[6], 10),
    };
  }
  // Shorthand form: "... 33a:8-14" — same daf/amud, segment range only.
  const shorthand = ref.match(/\s(\d+)([ab]):(\d+)-(\d+)$/);
  if (shorthand) {
    const daf = parseInt(shorthand[1], 10);
    const amud = shorthand[2] as 'a' | 'b';
    return {
      startDaf: daf,
      startAmud: amud,
      startSegment: parseInt(shorthand[3], 10),
      endDaf: daf,
      endAmud: amud,
      endSegment: parseInt(shorthand[4], 10),
    };
  }
  return null;
}

/** A few pointed letters Davidson writes as one character, וּ as U+FB35, as letter and point, which search reads. */
const decomposed = (s: string): string => s.replace(/[\uFB1D-\uFB4F]/g, (c) => c.normalize('NFD'));

export interface EditionJson {
  text: string[][];
  heTitle?: string;
}

/**
 * Where the English differs in shape from the Hebrew, or null. The English leaves off a Hadran
 * line that ends an amud, and keeps every other as an empty string.
 */
function englishShapeDiffers(hebrew: string[][], english: string[][]): number | null {
  if (english.length !== hebrew.length) return Math.min(english.length, hebrew.length);
  const at = hebrew.findIndex((amud, ai) => {
    const n = english[ai].length;
    return !(n === amud.length || (n === amud.length - 1 && isHadran(amud.at(-1)!)));
  });
  return at < 0 ? null : at;
}

export function processTractate(
  seder: string,
  tractateName: string,
  /** The William Davidson edition's Hebrew and Aramaic. */
  davidson: EditionJson,
  schema: SchemaJson,
  /** The William Davidson English, shaped as `davidson`. */
  english: EditionJson,
  /** The Wikisource edition, shaped as `davidson`, read for the Tanakh verses it names. */
  wikisource: EditionJson,
): {
  structure: TalmudTractate;
  text: Omit<TalmudTractateText, 'citations'>;
  english: TalmudTractateEnglish;
  /** What search reads: the popup's text without points. */
  search: string[][];
  /** What English search reads, shaped as `english`. */
  searchEnglish: string[][];
  /** Wikisource's text without tags, laid out as `text`. Davidson names no verse it quotes. */
  naming: string[][];
} {
  const shape = shapeMatches(davidson, wikisource);
  if (!shape.match) throw new Error(`${tractateName}: the editions differ: ${shape.reason}`);
  const schemaNodes = schema.alts?.Chapters?.nodes ?? [];
  if (schemaNodes.length === 0) {
    throw new Error(`${tractateName}: schema has no perek nodes`);
  }
  // Sefaria's amud arrays start at 1a, though the Talmud has no daf 1, and keep
  // every amud before a tractate's text starts empty: to 25a, in Tamid.
  const skip = davidson.text.findIndex((amud) => amud.length > 0);
  if (skip < 0) throw new Error(`${tractateName}: no text`);
  const amudAt = (ai: number): Pick<TalmudAmud, 'daf' | 'amud'> => ({
    daf: 1 + Math.floor((skip + ai) / 2),
    amud: (skip + ai) % 2 === 0 ? 'a' : 'b',
  });
  const text = davidson.text.slice(skip).map((amud) => amud.map(decomposed));
  const translation = english.text.slice(skip);
  const differs = englishShapeDiffers(text, translation);
  if (differs !== null) {
    const { daf, amud } = amudAt(differs);
    throw new Error(
      `${tractateName}: the English differs in shape from the Hebrew at ${daf}${amud}`,
    );
  }

  // Build perakim array and compute per-amud perekIdx + boundary markers.
  const perakim: TalmudPerek[] = [];
  const amudPerekIdx: number[] = new Array(text.length).fill(0);
  const amudPerekBoundary: Map<number, number> = new Map();

  for (let pi = 0; pi < schemaNodes.length; pi++) {
    const node = schemaNodes[pi];
    const ref = parseWholeRef(node.wholeRef ?? '');
    if (!ref) {
      throw new Error(`${tractateName}: cannot parse perek ${pi} wholeRef "${node.wholeRef}"`);
    }
    const startIdx = amudIndex(ref.startDaf, ref.startAmud, amudAt(0));
    const endIdx = amudIndex(ref.endDaf, ref.endAmud, amudAt(0));
    if (startIdx < 0) throw new Error(`${tractateName}: perek ${pi} starts before the text`);

    perakim.push({
      hebrewName: node.heTitle ?? `פרק ${pi + 1}`,
      startAmudIdx: startIdx,
      endAmudIdx: endIdx,
      startSegmentInFirstAmud: ref.startSegment,
      endSegmentInLastAmud: ref.endSegment,
    });

    // If a perek boundary falls mid-amud (prev perek's endAmudIdx ===
    // this perek's startAmudIdx), mark the boundary segment index.
    // The boundary amud's perekIdx must STAY at the previous perek so that
    // layoutTractate's rowsForTractate() can derive (firstHalf=prev,
    // secondHalf=prev+1) from a single base index. If we overwrite it here
    // the firstHalf gets mislabeled and produces spurious "short perakim".
    let assignStart = startIdx;
    if (pi > 0) {
      const prev = perakim[pi - 1];
      if (prev.endAmudIdx === startIdx) {
        amudPerekBoundary.set(startIdx, ref.startSegment - 1);
        assignStart = startIdx + 1;
      }
    }

    // Assign perekIdx to every amud in this range (skipping the boundary
    // amud when it already belongs to the previous perek).
    for (let ai = assignStart; ai <= endIdx && ai < text.length; ai++) {
      amudPerekIdx[ai] = pi;
    }
  }

  const markers = markersOf(text);
  const mishnahMask = mishnahFrom(markers);
  const cleanText = text.map((amud, ai) =>
    amud.map((seg, si) => stripHtml(stripMarkerWord(seg, markers[ai][si]))),
  );

  const amudim: TalmudAmud[] = text.map((amud, ai) => {
    const boundary = amudPerekBoundary.get(ai);
    return {
      ...amudAt(ai),
      segmentCount: amud.length,
      perekIdx: amudPerekIdx[ai],
      ...(boundary !== undefined ? { perekBoundaryAt: boundary } : {}),
      mishnahMask: mishnahMask[ai],
    };
  });

  const englishMarked = text.map((amud, ai) =>
    amud.map((seg, si) => {
      if (isHadran(seg)) return '';
      try {
        return englishMarkers(translation[ai][si]);
      } catch (err) {
        const { daf, amud } = amudAt(ai);
        throw new Error(`${tractateName} ${daf}${amud}:${si + 1}: ${(err as Error).message}`);
      }
    }),
  );

  return {
    structure: {
      name: tractateName,
      hebrewName: davidson.heTitle ?? tractateName,
      seder,
      amudim,
      perakim,
    },
    text: { name: tractateName, amudim: cleanText },
    english: englishMarked,
    search: cleanText.map((amud) => amud.map(stripNikkud)),
    searchEnglish: englishMarked.map((amud) => amud.map(englishSearchText)),
    naming: wikisource.text.slice(skip).map((amud) => amud.map(stripHtml)),
  };
}

const DATA_DIR = 'public/data';

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8')) as T;
}

/** Writes `value` to `file`, a path under `public/data/` as the app asks for it. */
async function writeData(file: string, value: unknown): Promise<void> {
  const path = join(DATA_DIR, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value), 'utf-8');
}

async function main(): Promise<void> {
  console.log('Loading coverage report...');
  const report = await readJson<CoverageReport>(REPORT_PATH);

  const passed = report.tractates.filter((t) => t.status === 'pass');
  console.log(`${passed.length} passed tractates to bundle`);
  console.log('');

  const structure: TalmudStructure = { tractates: [] };
  const search: TalmudSearchText = {};
  const searchEnglish: TalmudSearchText = {};
  const { books } = await readJson<{ books: TanakhBook[] }>(join(DATA_DIR, STRUCTURE_FILE));
  const texts = await readJson<VerseTexts>(join(DATA_DIR, TEXTS_FILE));
  const tanakh: Tanakh = {
    books,
    text: (book, chapter, verse) => getVerseText(texts, book, chapter, verse)?.he ?? null,
  };
  const find = citationFinder(tanakh);
  const place = quoteFinder(tanakh);
  const placings: Partial<Record<Placing, number>> = {};
  const missed: string[] = [];

  for (const ref of passed) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} ... `);
    try {
      const paths = cachePathsFor(ref);
      const {
        structure: tractateStructure,
        text: tractateText,
        english: tractateEnglish,
        search: searchText,
        searchEnglish: searchEnglishText,
        naming,
      } = processTractate(
        ref.seder,
        ref.tractate,
        await readJson<EditionJson>(paths.davidson),
        await readJson<SchemaJson>(paths.schema),
        await readJson<EditionJson>(paths.english),
        await readJson<EditionJson>(paths.wikisource),
      );

      structure.tractates.push(tractateStructure);
      search[ref.tractate] = searchText;
      searchEnglish[ref.tractate] = searchEnglishText;

      const cited = citationsByPlace(tractateText.amudim, naming, find, place, placings);
      missed.push(...cited.missed.map((stretch) => `${ref.tractate}: ${stretch}`));
      const shipped: TalmudTractateText = { ...tractateText, citations: cited.citations };
      await writeData(textsFile(ref.tractate), shipped);
      await writeData(englishFile(ref.tractate), tractateEnglish);

      const segCount = tractateStructure.amudim.reduce((a, b) => a + b.segmentCount, 0);
      console.log(
        `OK (${tractateStructure.amudim.length} amudim, ${segCount} segments, ${tractateStructure.perakim.length} perakim)`,
      );
    } catch (err) {
      // A tractate left out would drop from the map and leave its old file behind.
      console.log('FAILED');
      throw err;
    }
  }

  await writeFile(join(DATA_DIR, TALMUD_STRUCTURE_FILE), JSON.stringify(structure), 'utf-8');
  await writeFile(join(DATA_DIR, SEARCH_FILE), JSON.stringify(search), 'utf-8');
  await writeFile(join(DATA_DIR, SEARCH_ENGLISH_FILE), JSON.stringify(searchEnglish), 'utf-8');

  console.log('');
  console.log(`Structure: ${join(DATA_DIR, TALMUD_STRUCTURE_FILE)}`);
  console.log(`Search: ${join(DATA_DIR, SEARCH_FILE)}`);
  console.log(`English search: ${join(DATA_DIR, SEARCH_ENGLISH_FILE)}`);
  console.log(
    `Texts: ${join(DATA_DIR, dirname(textsFile('')))} (${structure.tractates.length} files)`,
  );
  console.log(`English: ${join(DATA_DIR, dirname(englishFile('')))}`);
  console.log('');
  console.log(`Tanakh citations, by how each found its place in Davidson's text:`);
  for (const [way, n] of Object.entries(placings)) console.log(`  ${way}: ${n}`);
  console.log(`Looked like citations but named no verse: ${missed.length}`);
  for (const stretch of missed.slice(0, 10)) console.log(`  ${stretch}`);
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('bundle failed:', err);
    process.exit(1);
  });
}
