#!/usr/bin/env tsx
/**
 * Bundle Talmud raw cache into runtime-fetchable JSON files.
 *
 * Inputs:
 *   data/talmud/raw/<Tractate>/wikisource.json
 *   data/talmud/raw/<Tractate>/merged.json (the Steinsaltz edition, for its markers)
 *   data/talmud/raw/<Tractate>/schema.json
 *   data/talmud/coverage-report.json (tells us which
 *     tractates passed verification)
 *
 * Outputs:
 *   public/data/talmud/structure.json
 *   public/data/talmud/texts/<Tractate>.json
 *
 * Excluded: tractates that failed verification.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripNikkud } from '@torahmap/shell/hebrew.ts';
import { amudIndex } from '@torahmap/talmud/data.ts';

// Pure helpers (unit-tested).

type Marker = 'M' | 'G' | null;

// A marker is מתני׳ (a Mishnah begins) or גמ׳ (the Gemara begins) in bold
// at the start of a segment. The same words occur in running text ("מתני׳
// מני ר״ש היא", Sanhedrin 67a:8), so without the bold they are not markers.
// The forms that occur:
//   "<big><strong>מתני׳</strong></big> ..."     (also <b>, or <strong><big>)
//   "[<big><strong>גמ׳</strong></big> ת״ר] ..." (Sotah 49a:17)
//   "<big><strong>(גמ׳)</strong></big> ..."     (Sotah 49b:4)
//   "מתני׳ <big><strong>הכל</strong></big> ..." (bare word, bold first word)
const WRAPPED_MARKER_RE =
  /^[\s\[\(]*(?:<[^>]+>[\s\[\(]*)*<big[^>]*>(?:[\s\(]*<(?:strong|b)\b[^>]*>)?[\s\(]*(מתני׳|גמ׳)/;
const BARE_LEADING_MARKER_RE = /^[\s\[\(]*(מתני׳|גמ׳)(?:\s|$)/;
// Tamid's last three chapters have no Gemara; Wikisource numbers their
// mishnayot with a bold letter instead ("<big><strong>ב</strong></big> אמר").
const NUMBERED_MISHNAH_RE = /^\s*(?:<[^>]+>\s*)*<big[^>]*>\s*<(?:strong|b)\b[^>]*>\s*[א-י](?:\s|<)/;
// Where an amud break falls between a Mishnah and its Gemara, Wikisource
// leaves the גמ׳ at the end of the Mishnah's last segment (Pesachim 71b:14,
// Niddah 56b:25); the Steinsaltz edition puts it on the next segment.
const TRAILING_GEMARA_RE = /<big[^>]*>\s*(?:<(?:strong|b)\b[^>]*>\s*)?גמ׳\s*(?:<\/[^>]+>\s*)*$/;

/** Without points, and with the ASCII apostrophe some markers use as geresh. */
function normalizeMarkers(seg: string): string {
  return stripNikkudAndSeparators(seg).replace(/(מתני|גמ)'/g, '$1׳');
}

function detectMarker(seg: string): Marker {
  const s = normalizeMarkers(seg);
  const wrapped = s.match(WRAPPED_MARKER_RE);
  if (wrapped) return wrapped[1] === 'מתני׳' ? 'M' : 'G';
  const bare = s.match(BARE_LEADING_MARKER_RE);
  if (bare && /<big[^>]*>/.test(s.slice(0, 80))) return bare[1] === 'מתני׳' ? 'M' : 'G';
  if (NUMBERED_MISHNAH_RE.test(s)) return 'M';
  return null;
}

function endsWithGemaraMarker(seg: string): boolean {
  return TRAILING_GEMARA_RE.test(normalizeMarkers(seg));
}

/**
 * Whether each segment is Mishnah. A tractate starts in Gemara; each marker
 * sets the state until the next.
 *
 * `other` is a second edition of the same text, segment for segment. Each
 * edition misses markers the other has: the Steinsaltz edition drops the
 * bare מתני׳ that opens most chapters, and Wikisource lacks some גמ׳ at the
 * top of an amud (Avodah Zarah 22b:1), so a segment is a marker if either
 * edition marks it. The two never disagree on which marker it is.
 */
export function walkMarkers(text: string[][], other: string[][] = []): boolean[][] {
  let gemaraNext = false;
  let isMishnah = false;
  return text.map((amud, ai) =>
    amud.map((seg, si) => {
      const m = markerAt(text, other, ai, si) ?? (gemaraNext ? 'G' : null);
      if (m) isMishnah = m === 'M';
      gemaraNext = endsWithGemaraMarker(seg) || endsWithGemaraMarker(other[ai]?.[si] ?? '');
      return isMishnah;
    }),
  );
}

function markerAt(text: string[][], other: string[][], ai: number, si: number): Marker {
  return detectMarker(text[ai][si]) ?? detectMarker(other[ai]?.[si] ?? '');
}

/** A segment without the marker word that opens or closes it. */
function stripMarkerWords(seg: string, isMarker: boolean): string {
  if (endsWithGemaraMarker(seg)) seg = seg.replace(/גמ['׳]((?:\s|<\/[^>]+>)*)$/, '$1');
  // Shabbat 82a:13 opens with a bare גמ, no geresh.
  if (isMarker) seg = seg.replace(/^((?:[\s\[\(]|<[^>]+>)*)(?:מתני|גמ)['׳]?(?=[\s<\]\)]|$)/, '$1');
  return seg;
}

// Maqaf, paseq, sof pasuq and nun hafukha: stripNikkud keeps them, as word
// separators, but marker matching ignores them.
const HEBREW_SEPARATORS = /[\u05BE\u05C0\u05C3\u05C6]/g;

/**
 * Hebrew without points, accents or its four separator marks. The Steinsaltz
 * edition is fully pointed, marker words included (מַתְנִי׳); Wikisource is not.
 */
export function stripNikkudAndSeparators(s: string): string {
  return stripNikkud(s).replace(HEBREW_SEPARATORS, '');
}

/**
 * Strip Wikisource HTML, embedded data-URI images, and markdown link
 * syntax from a segment string. The Bavli Wikisource source mixes raw
 * tags into segments — not just <br>/<big>/<strong> but also <img>
 * blobs (sometimes huge base64 PNGs), <a>/<span> wrappers, and the
 * occasional `[label](url)` markdown link. We want plain Hebrew text
 * for the popup AND for counting segment lengths (which
 * counts characters, so a base64 blob would dwarf real content).
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

export interface TalmudAmud {
  daf: number;
  amud: 'a' | 'b';
  segmentCount: number;
  perekIdx: number;
  perekBoundaryAt?: number;
  mishnahMask: boolean[];
}

export interface TalmudPerek {
  hebrewName: string;
  startAmudIdx: number;
  endAmudIdx: number;
  startSegmentInFirstAmud: number;
  endSegmentInLastAmud: number;
}

export interface TalmudTractate {
  name: string;
  hebrewName: string;
  seder: string;
  firstDaf: number;
  amudim: TalmudAmud[];
  perakim: TalmudPerek[];
}

export interface TalmudStructure {
  tractates: TalmudTractate[];
}

export interface TalmudTractateText {
  name: string;
  amudim: string[][];
}

interface WikisourceJson {
  text: string[][];
  heTitle?: string;
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

interface CoverageReport {
  tractates: Array<{
    seder: string;
    tractate: string;
    status: 'pass' | 'hard-fail' | 'soft-fail';
  }>;
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

export interface MergedJson {
  text: string[][]; // [amudIdx][segIdx], parallel to wikisource shape
}

export function processTractate(
  seder: string,
  tractateName: string,
  wikisource: WikisourceJson,
  schema: SchemaJson,
  merged?: MergedJson | null,
): { structure: TalmudTractate; text: TalmudTractateText } {
  const rawText = wikisource.text;
  const hebrewName = wikisource.heTitle ?? tractateName;
  // verify-coverage.ts checks the Steinsaltz edition has the same shape;
  // where it does not, its markers cannot be lined up and go unused.
  const sameShape =
    merged?.text?.length === rawText.length &&
    rawText.every((amud, ai) => merged.text[ai]?.length === amud.length);
  const otherEdition = sameShape ? merged.text : [];

  const schemaNodes = schema.alts?.Chapters?.nodes ?? [];
  if (schemaNodes.length === 0) {
    throw new Error(`${tractateName}: schema has no perek nodes`);
  }
  // Sefaria-Export indexes its amud array starting from daf 1 (with 1a/1b
  // as empty placeholders — the Talmud traditionally has no daf 1). So the
  // firstDaf is always 1, and the schema's perek refs like "Berakhot 2a:1"
  // are resolved against that origin via amudIndex(daf, amud, 1).
  const firstDaf = 1;

  // Build perakim array and compute per-amud perekIdx + boundary markers.
  const perakim: TalmudPerek[] = [];
  const amudPerekIdx: number[] = new Array(rawText.length).fill(0);
  const amudPerekBoundary: Map<number, number> = new Map();

  for (let pi = 0; pi < schemaNodes.length; pi++) {
    const node = schemaNodes[pi];
    const ref = parseWholeRef(node.wholeRef ?? '');
    if (!ref) {
      throw new Error(`${tractateName}: cannot parse perek ${pi} wholeRef "${node.wholeRef}"`);
    }
    const startIdx = amudIndex(ref.startDaf, ref.startAmud, firstDaf);
    const endIdx = amudIndex(ref.endDaf, ref.endAmud, firstDaf);

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
    for (let ai = assignStart; ai <= endIdx && ai < rawText.length; ai++) {
      amudPerekIdx[ai] = pi;
    }
  }

  const mishnahMask = walkMarkers(rawText, otherEdition);

  const cleanText: string[][] = rawText.map((amud, ai) =>
    amud.map((seg, si) =>
      stripHtml(
        stripMarkerWords(seg, markerAt(rawText, otherEdition, ai, si) !== null).replace(
          /הדרן/g,
          '',
        ),
      ),
    ),
  );

  const amudim: TalmudAmud[] = [];
  for (let ai = 0; ai < rawText.length; ai++) {
    const segmentCount = rawText[ai].length;
    const daf = firstDaf + Math.floor(ai / 2);
    const amud: 'a' | 'b' = ai % 2 === 0 ? 'a' : 'b';
    const boundary = amudPerekBoundary.get(ai);
    amudim.push({
      daf,
      amud,
      segmentCount,
      perekIdx: amudPerekIdx[ai],
      ...(boundary !== undefined ? { perekBoundaryAt: boundary } : {}),
      mishnahMask: mishnahMask[ai] ?? new Array(segmentCount).fill(false),
    });
  }

  return {
    structure: {
      name: tractateName,
      hebrewName,
      seder,
      firstDaf,
      amudim,
      perakim,
    },
    text: {
      name: tractateName,
      amudim: cleanText,
    },
  };
}

const CACHE_ROOT = 'data/talmud/raw';
const COVERAGE_REPORT = 'data/talmud/coverage-report.json';
const OUTPUT_DIR = 'public/data/talmud';
const TEXTS_DIR = join(OUTPUT_DIR, 'texts');

async function main(): Promise<void> {
  console.log('Loading coverage report...');
  const reportText = await readFile(COVERAGE_REPORT, 'utf-8');
  const report: CoverageReport = JSON.parse(reportText);

  const passed = report.tractates.filter((t) => t.status === 'pass');
  console.log(`${passed.length} passed tractates to bundle`);
  console.log('');

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(TEXTS_DIR, { recursive: true });

  const structure: TalmudStructure = { tractates: [] };

  for (const ref of passed) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} ... `);
    try {
      const wsText = await readFile(join(CACHE_ROOT, ref.tractate, 'wikisource.json'), 'utf-8');
      const scText = await readFile(join(CACHE_ROOT, ref.tractate, 'schema.json'), 'utf-8');
      const ws: WikisourceJson = JSON.parse(wsText);
      const sc: SchemaJson = JSON.parse(scText);

      // Optional; processTractate falls back to wikisource if missing.
      let merged: MergedJson | null = null;
      try {
        const mergedRaw = await readFile(join(CACHE_ROOT, ref.tractate, 'merged.json'), 'utf-8');
        merged = JSON.parse(mergedRaw) as MergedJson;
      } catch {
        /* fall back to wikisource markers */
      }

      const { structure: tractateStructure, text: tractateText } = processTractate(
        ref.seder,
        ref.tractate,
        ws,
        sc,
        merged,
      );

      structure.tractates.push(tractateStructure);

      await writeFile(
        join(TEXTS_DIR, `${ref.tractate}.json`),
        JSON.stringify(tractateText),
        'utf-8',
      );

      const segCount = tractateStructure.amudim.reduce((a, b) => a + b.segmentCount, 0);
      console.log(
        `OK (${tractateStructure.amudim.length} amudim, ${segCount} segments, ${tractateStructure.perakim.length} perakim)`,
      );
    } catch (err) {
      console.log(`SKIP: ${(err as Error).message}`);
    }
  }

  await writeFile(join(OUTPUT_DIR, 'structure.json'), JSON.stringify(structure), 'utf-8');

  console.log('');
  console.log(`Structure: ${join(OUTPUT_DIR, 'structure.json')}`);
  console.log(`Texts: ${TEXTS_DIR}/*.json (${structure.tractates.length} files)`);
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('bundle failed:', err);
    process.exit(1);
  });
}
