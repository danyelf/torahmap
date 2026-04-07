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
 * Rule: whenever a segment contains "מתני׳" flip current state to mishnah;
 * whenever a segment contains "גמ׳" flip to gemara. Each segment is tagged
 * with the state at the moment it's encountered (post-flip if it contains
 * a marker, pre-flip if it doesn't).
 *
 * Initial state is gemara (conservative default — in practice real data
 * always starts with מתני׳).
 */
export function walkMarkers(text: string[][]): boolean[][] {
  const result: boolean[][] = [];
  let isMishnah = false;
  for (const amud of text) {
    const row: boolean[] = [];
    for (const seg of amud) {
      if (seg.includes("מתני׳")) isMishnah = true;
      else if (seg.includes("גמ׳")) isMishnah = false;
      row.push(isMishnah);
    }
    result.push(row);
  }
  return result;
}

/**
 * Strip common Wikisource HTML tags from a segment string.
 */
export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?big>/gi, "")
    .replace(/<\/?strong>/gi, "")
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

export function processTractate(
  seder: string,
  tractateName: string,
  wikisource: WikisourceJson,
  schema: SchemaJson,
): { structure: TalmudTractate; text: TalmudTractateText } {
  const rawText = wikisource.text;
  const hebrewName = wikisource.heTitle ?? tractateName;

  const schemaNodes = schema.alts?.Chapters?.nodes ?? [];
  if (schemaNodes.length === 0) {
    throw new Error(`${tractateName}: schema has no perek nodes`);
  }
  const firstRef = parseWholeRef(schemaNodes[0].wholeRef ?? "");
  if (!firstRef) {
    throw new Error(
      `${tractateName}: cannot parse first perek wholeRef "${schemaNodes[0].wholeRef}"`,
    );
  }
  const firstDaf = firstRef.startDaf;

  // Compute per-segment Mishnah mask via marker walk.
  const mishnahMask = walkMarkers(rawText);

  // Strip markers and HTML from text before storing.
  const cleanText: string[][] = rawText.map((amud) =>
    amud.map((seg) =>
      stripHtml(
        seg.replace(/מתני׳/g, "").replace(/גמ׳/g, "").replace(/הדרן/g, ""),
      ),
    ),
  );

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

    // Assign perekIdx to every amud in this range.
    for (let ai = startIdx; ai <= endIdx && ai < rawText.length; ai++) {
      amudPerekIdx[ai] = pi;
    }

    // If a perek boundary falls mid-amud (prev perek's endAmudIdx ===
    // this perek's startAmudIdx), mark the boundary segment index.
    if (pi > 0) {
      const prev = perakim[pi - 1];
      if (prev.endAmudIdx === startIdx) {
        amudPerekBoundary.set(startIdx, ref.startSegment - 1);
      }
    }
  }

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

      const { structure: tractateStructure, text: tractateText } =
        processTractate(ref.seder, ref.tractate, ws, sc);

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
