#!/usr/bin/env tsx
/**
 * Bundle Talmud raw cache into runtime-fetchable JSON files.
 *
 * Issue: tm-f28x
 * Design: docs/plans/2026-04-07-talmud-integration-design.md §3.4
 *
 * Inputs:
 *   data-transient/talmud-raw/<Tractate>/wikisource.json
 *   data-transient/talmud-raw/<Tractate>/schema.json
 *   docs/plans/data/2026-04-07-talmud-coverage-report.json (tells us which
 *     tractates passed verification)
 *
 * Outputs:
 *   public/data/talmud/structure.json
 *   public/data/talmud/texts/<Tractate>.json
 *
 * Excluded: tractates that failed verification.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ============================================================================
// Pure helpers (unit-tested)
// ============================================================================

/**
 * Walk a tractate's segment stream tracking Mishnah/Gemara state.
 *
 * Rule: a segment counts as a structural marker only when it carries
 * BOTH a marker word (מתני׳ / גמ׳) AND a `<big>` (or `<big><strong>`)
 * presentational wrapper near the start of the segment. Wikisource uses
 * two equally common forms:
 *
 *   - "<big><strong>מתני׳</strong></big> first mishnah word..."
 *      (the marker itself is wrapped)
 *   - "מתני׳ <big><strong>אין</strong></big> מעמידין..."
 *      (the marker is bare and the first content word is wrapped)
 *
 * Both forms put a `<big>` tag inside the leading region of the segment,
 * which makes "marker word + nearby <big>" a robust signal. The wrap is
 * the strongest cue — without it, segments like Bava Metzia 6b:2
 * ("א\"ל רב המנונא מתני׳ היא ספק בכורות...") would falsely flip the
 * state for dozens of dapim, because the abbreviation is also natural
 * Hebrew that appears inside running text.
 *
 * Initial state is gemara (conservative default — in practice the very
 * first segment of every tractate is a wrapped מתני׳ marker).
 */
// The marker may be preceded by editorial punctuation (`[`, `(`) and the
// marker word itself can be wrapped inside parentheses inside the strong
// tag — Wikisource has all of these forms in real data:
//   "<big><strong>מתני׳</strong></big> ..."     (canonical wrapped)
//   "[<big><strong>גמ׳</strong></big> ת\"ר] ..." (Sotah 49a:17 style)
//   "<big><strong>(גמ׳)</strong></big> ..."     (Sotah 49b:4 style)
//   "מתני׳ <big><strong>הכל</strong></big> ..." (bare-leading form)
const WRAPPED_MARKER_RE =
  /^[\s\[\(]*(?:<[^>]+>[\s\[\(]*)*<big[^>]*>(?:[\s\(]*<strong[^>]*>)?[\s\(]*(מתני׳|גמ׳)/;
const BARE_LEADING_MARKER_RE = /^[\s\[\(]*(מתני׳|גמ׳)(?:\s|$)/;

function detectMarker(seg: string): "M" | "G" | null {
  // Strip nikkud first — Sefaria's merged ("Steinsaltz") source carries
  // full vowel pointing on every word, including the marker words
  // (מַתְנִי׳ / גְּמָ׳). The bare wikisource source doesn't, but
  // stripping is a no-op there. Doing this once up front lets the
  // regexes stay simple.
  const s = stripNikkud(seg);

  // Form 1: marker is wrapped in <big><strong>...</strong></big>.
  const wrapped = s.match(WRAPPED_MARKER_RE);
  if (wrapped) {
    return wrapped[1] === "מתני׳" ? "M" : "G";
  }
  // Form 2: marker is bare at the very start, and the first content
  // word IS wrapped in <big>. We require the wrap to appear within the
  // first 80 chars of the segment so we don't pick up unrelated tags
  // later in the text.
  const bare = s.match(BARE_LEADING_MARKER_RE);
  if (bare && /<big[^>]*>/.test(s.slice(0, 80))) {
    return bare[1] === "מתני׳" ? "M" : "G";
  }
  return null;
}

export function walkMarkers(text: string[][]): boolean[][] {
  const result: boolean[][] = [];
  let isMishnah = false;
  for (const amud of text) {
    const row: boolean[] = [];
    for (const seg of amud) {
      const m = detectMarker(seg);
      if (m === "M") isMishnah = true;
      else if (m === "G") isMishnah = false;
      row.push(isMishnah);
    }
    result.push(row);
  }
  return result;
}

/**
 * Walk markers with a per-marker char budget bounding how long any
 * single mishnah run can be. The cap is set per-perek to the LONGEST
 * standalone mishnah unit in that perek × slack — that's the largest
 * any single Bavli mishnah block could plausibly be without a missing
 * gemara marker. Each new מתני׳ marker resets the run counter, so a
 * perek with several legitimate mishnayot still works (each gets its
 * own fresh budget).
 *
 * This compensates for missing-marker bugs in the Wikisource source
 * (e.g. Avodah Zarah 22a:11 → 26a:4, where the editor forgot the
 * gemara marker and the walker would otherwise leave 100+ segments
 * wrongly tagged as mishnah).
 *
 * Args:
 *   text             - Wikisource segment grid
 *   perekIdxByAmud   - perek index per amud
 *   perekUnitChars   - char count of each standalone mishnah unit, per
 *                      perek (parallel to schema perakim)
 *   perekBoundaryAt  - optional per-amud mid-amud perek-boundary map
 *   slack            - multiplier on the per-marker cap (default 1.5)
 */
export function walkMarkersWithBudget(
  text: string[][],
  perekIdxByAmud: number[],
  perekUnitChars: number[][],
  perekBoundaryAt: Map<number, number>,
  slack = 1.2,
): boolean[][] {
  const result: boolean[][] = [];
  let isMishnah = false;
  let currentPerekIdx = -1;
  let charsConsumedInRun = 0;
  let currentBudget = 0;
  let runForceFlipped = false;

  function startPerek(newIdx: number): void {
    currentPerekIdx = newIdx;
    charsConsumedInRun = 0;
    runForceFlipped = false;
    const units = perekUnitChars[newIdx] ?? [];
    // Per-marker cap = largest single standalone unit × slack. This is
    // the upper bound for any one Bavli mishnah block in this perek.
    const maxUnit = units.length > 0 ? Math.max(...units) : 0;
    currentBudget = maxUnit * slack;
  }

  for (let ai = 0; ai < text.length; ai++) {
    const amud = text[ai];
    const amudPerek = perekIdxByAmud[ai];
    const boundary = perekBoundaryAt.get(ai);

    if (boundary === undefined && amudPerek !== currentPerekIdx) {
      startPerek(amudPerek);
    }

    const row: boolean[] = [];
    for (let si = 0; si < amud.length; si++) {
      // Mid-amud perek boundary handling: segments [0..boundary) belong
      // to the OLD perek; segments [boundary..) belong to the NEW one.
      if (boundary !== undefined && si === 0 && amudPerek !== currentPerekIdx) {
        startPerek(amudPerek);
      }
      if (boundary !== undefined && si === boundary) {
        startPerek(amudPerek + 1);
      }

      const seg = amud[si];
      const m = detectMarker(seg);
      if (m === "M") {
        isMishnah = true;
        // Reset run counter — each marker gets a fresh budget.
        charsConsumedInRun = 0;
        runForceFlipped = false;
      } else if (m === "G") {
        isMishnah = false;
        charsConsumedInRun = 0;
        runForceFlipped = false;
      }

      if (isMishnah) {
        const clean = stripNikkud(stripHtml(seg))
          .replace(/[\s\.,;:׃״׳"׳']/g, "");
        charsConsumedInRun += clean.length;
        if (
          !runForceFlipped &&
          currentBudget > 0 &&
          charsConsumedInRun > currentBudget
        ) {
          // We've consumed more characters than the largest plausible
          // mishnah in this perek. Assume the source is missing a גמ׳
          // marker and force-flip back to gemara from here.
          isMishnah = false;
          runForceFlipped = true;
        }
      }

      row.push(isMishnah);
    }
    result.push(row);
  }
  return result;
}

/**
 * Compute per-perek char counts of every standalone mishnah unit, for
 * use as walkMarkersWithBudget's per-marker cap input.
 */
export function perekUnitCharCounts(mishnahText: string[][]): number[][] {
  return mishnahText.map((perek) =>
    perek.map(
      (unit) =>
        stripNikkud(stripHtml(unit)).replace(/[\s\.,;:׃״׳"׳']/g, "").length,
    ),
  );
}

/**
 * Strip Hebrew nikkud (combining marks) and other diacritics so that
 * char-count comparisons between Wikisource Bavli (no nikkud) and
 * standalone Mishnah (full nikkud) are apples-to-apples.
 */
export function stripNikkud(s: string): string {
  // Hebrew points: U+0591..U+05C7 (cantillation + nikkud + punctuation marks)
  return s.replace(/[\u0591-\u05C7]/g, "");
}

/**
 * Strip Wikisource HTML, embedded data-URI images, and markdown link
 * syntax from a segment string. The Bavli Wikisource source mixes raw
 * tags into segments — not just <br>/<big>/<strong> but also <img>
 * blobs (sometimes huge base64 PNGs), <a>/<span> wrappers, and the
 * occasional `[label](url)` markdown link. We want plain Hebrew text
 * for sidebar display AND for the segment-length overlay (which
 * counts characters, so a base64 blob would dwarf real content).
 */
export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    // Drop entire <img ...> tags including ones whose attributes contain
    // base64 data: URIs that may span tens of thousands of characters.
    .replace(/<img\b[^>]*>/gi, "")
    // Drop any other tag (open, close, or self-closing). At this point
    // anything in angle brackets is presentational/structural noise.
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    // Markdown links: [label](href) → label.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Output schema types
// ============================================================================

export interface TalmudAmud {
  daf: number;
  amud: "a" | "b";
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

// ============================================================================
// Schema parsing
// ============================================================================

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
    status: "pass" | "hard-fail" | "soft-fail";
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
export function parseWholeRef(
  ref: string,
): {
  startDaf: number;
  startAmud: "a" | "b";
  startSegment: number;
  endDaf: number;
  endAmud: "a" | "b";
  endSegment: number;
} | null {
  // Full form: "... 2a:1-13a:15"
  const full = ref.match(/\s(\d+)([ab]):(\d+)-(\d+)([ab]):(\d+)$/);
  if (full) {
    return {
      startDaf: parseInt(full[1], 10),
      startAmud: full[2] as "a" | "b",
      startSegment: parseInt(full[3], 10),
      endDaf: parseInt(full[4], 10),
      endAmud: full[5] as "a" | "b",
      endSegment: parseInt(full[6], 10),
    };
  }
  // Shorthand form: "... 33a:8-14" — same daf/amud, segment range only.
  const shorthand = ref.match(/\s(\d+)([ab]):(\d+)-(\d+)$/);
  if (shorthand) {
    const daf = parseInt(shorthand[1], 10);
    const amud = shorthand[2] as "a" | "b";
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

/**
 * Convert (daf, amud) to an amud index, given the tractate's firstDaf.
 */
export function dafAmudToIdx(
  daf: number,
  amud: "a" | "b",
  firstDaf: number,
): number {
  return (daf - firstDaf) * 2 + (amud === "b" ? 1 : 0);
}

// ============================================================================
// Tractate processing
// ============================================================================

export interface MishnahJson {
  text: string[][]; // [perek][mishnah_unit]
}

export interface MergedJson {
  text: string[][]; // [amudIdx][segIdx], parallel to wikisource shape
}

export function processTractate(
  seder: string,
  tractateName: string,
  wikisource: WikisourceJson,
  schema: SchemaJson,
  mishnah?: MishnahJson | null,
  merged?: MergedJson | null,
): { structure: TalmudTractate; text: TalmudTractateText } {
  const rawText = wikisource.text;
  const hebrewName = wikisource.heTitle ?? tractateName;
  // For marker detection we prefer the Steinsaltz-merged source if it
  // exists — it carries more reliable structural markers, including
  // ones that the bare wikisource source is missing (e.g. AZ 22b:1's
  // <strong><big>גְּמָ׳</big></strong>). The shape is identical
  // (verify-coverage.ts confirms amudCount + segmentCount per tractate),
  // so we can index into it with the same coordinates.
  const markerText: string[][] =
    merged && merged.text && merged.text.length === rawText.length
      ? merged.text
      : rawText;

  const schemaNodes = schema.alts?.Chapters?.nodes ?? [];
  if (schemaNodes.length === 0) {
    throw new Error(`${tractateName}: schema has no perek nodes`);
  }
  // Sefaria-Export indexes its amud array starting from daf 1 (with 1a/1b
  // as empty placeholders — the Talmud traditionally has no daf 1). So the
  // firstDaf is always 1, and the schema's perek refs like "Berakhot 2a:1"
  // are resolved against that origin via dafAmudToIdx(daf, amud, 1).
  const firstDaf = 1;

  // Build perakim array and compute per-amud perekIdx + boundary markers.
  const perakim: TalmudPerek[] = [];
  const amudPerekIdx: number[] = new Array(rawText.length).fill(0);
  const amudPerekBoundary: Map<number, number> = new Map();

  for (let pi = 0; pi < schemaNodes.length; pi++) {
    const node = schemaNodes[pi];
    const ref = parseWholeRef(node.wholeRef ?? "");
    if (!ref) {
      throw new Error(
        `${tractateName}: cannot parse perek ${pi} wholeRef "${node.wholeRef}"`,
      );
    }
    const startIdx = dafAmudToIdx(ref.startDaf, ref.startAmud, firstDaf);
    const endIdx = dafAmudToIdx(ref.endDaf, ref.endAmud, firstDaf);

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

  // Compute per-segment Mishnah mask. If a standalone Mishnah counterpart
  // is available (almost all 37 Bavli tractates have one), use the
  // budget-capped walker which bounds each perek's mishnah-state run by
  // the standalone perek's char length × slack. This is what catches
  // missing-marker bugs like Avodah Zarah 22a:11 → 26a:4 where the
  // Wikisource source omits the gemara marker entirely.
  let mishnahMask: boolean[][];
  if (mishnah && mishnah.text && mishnah.text.length > 0) {
    const unitChars = perekUnitCharCounts(mishnah.text);
    mishnahMask = walkMarkersWithBudget(
      markerText,
      amudPerekIdx,
      unitChars,
      amudPerekBoundary,
    );
  } else {
    mishnahMask = walkMarkers(markerText);
  }

  // Strip markers and HTML from text before storing.
  const cleanText: string[][] = rawText.map((amud) =>
    amud.map((seg) =>
      stripHtml(
        seg.replace(/מתני׳/g, "").replace(/גמ׳/g, "").replace(/הדרן/g, ""),
      ),
    ),
  );

  // Build the TalmudAmud[] array.
  const amudim: TalmudAmud[] = [];
  for (let ai = 0; ai < rawText.length; ai++) {
    const segmentCount = rawText[ai].length;
    const daf = firstDaf + Math.floor(ai / 2);
    const amud: "a" | "b" = ai % 2 === 0 ? "a" : "b";
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

// ============================================================================
// Main script
// ============================================================================

const CACHE_ROOT = "data-transient/talmud-raw";
const MISHNAH_CACHE = "data-transient/mishnah-raw";
const COVERAGE_REPORT = "docs/plans/data/2026-04-07-talmud-coverage-report.json";
const OUTPUT_DIR = "public/data/talmud";
const TEXTS_DIR = join(OUTPUT_DIR, "texts");

async function main(): Promise<void> {
  console.log("Loading coverage report...");
  const reportText = await readFile(COVERAGE_REPORT, "utf-8");
  const report: CoverageReport = JSON.parse(reportText);

  const passed = report.tractates.filter((t) => t.status === "pass");
  console.log(`${passed.length} passed tractates to bundle`);
  console.log("");

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(TEXTS_DIR, { recursive: true });

  const structure: TalmudStructure = { tractates: [] };

  for (const ref of passed) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} ... `);
    try {
      const wsText = await readFile(
        join(CACHE_ROOT, ref.tractate, "wikisource.json"),
        "utf-8",
      );
      const scText = await readFile(
        join(CACHE_ROOT, ref.tractate, "schema.json"),
        "utf-8",
      );
      const ws: WikisourceJson = JSON.parse(wsText);
      const sc: SchemaJson = JSON.parse(scText);

      // Load merged.json (Steinsaltz) — used as a more reliable marker
      // source. Optional; falls back to wikisource if missing or shape
      // mismatched.
      let merged: MergedJson | null = null;
      try {
        const mergedRaw = await readFile(
          join(CACHE_ROOT, ref.tractate, "merged.json"),
          "utf-8",
        );
        merged = JSON.parse(mergedRaw) as MergedJson;
      } catch {
        /* fall back to wikisource markers */
      }

      // Load standalone Mishnah counterpart for the mishnah-budget cap.
      // It's optional — if missing we fall back to the marker-only walker.
      let mishnah: MishnahJson | null = null;
      try {
        const mishText = await readFile(
          join(MISHNAH_CACHE, `${ref.tractate}.json`),
          "utf-8",
        );
        mishnah = JSON.parse(mishText) as MishnahJson;
      } catch {
        /* no standalone mishnah; walker falls back to marker-only mode */
      }

      const { structure: tractateStructure, text: tractateText } =
        processTractate(ref.seder, ref.tractate, ws, sc, mishnah, merged);

      structure.tractates.push(tractateStructure);

      await writeFile(
        join(TEXTS_DIR, `${ref.tractate}.json`),
        JSON.stringify(tractateText),
        "utf-8",
      );

      const segCount = tractateStructure.amudim.reduce(
        (a, b) => a + b.segmentCount,
        0,
      );
      console.log(
        `OK (${tractateStructure.amudim.length} amudim, ${segCount} segments, ${tractateStructure.perakim.length} perakim)`,
      );
    } catch (err) {
      console.log(`SKIP: ${(err as Error).message}`);
    }
  }

  await writeFile(
    join(OUTPUT_DIR, "structure.json"),
    JSON.stringify(structure),
    "utf-8",
  );

  console.log("");
  console.log(`Structure: ${join(OUTPUT_DIR, "structure.json")}`);
  console.log(`Texts: ${TEXTS_DIR}/*.json (${structure.tractates.length} files)`);
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("bundle failed:", err);
    process.exit(1);
  });
}
