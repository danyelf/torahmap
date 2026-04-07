#!/usr/bin/env tsx
/**
 * Verify Wikisource coverage across all Bavli tractates.
 *
 * Issue: tm-u7b1
 * Design: docs/plans/2026-04-07-talmud-integration-design.md §2
 *
 * For each tractate:
 *   1. Download Wikisource Hebrew JSON (primary source for M/G markers)
 *   2. Download Davidson merged.json (secondary, for shape cross-check)
 *   3. Download schema JSON (for perek boundaries)
 *   4. Verify Wikisource: non-empty, plausible marker counts
 *   5. Cross-check Wikisource vs Davidson: identical shape
 *   6. Emit report to data-transient/talmud-coverage-report.json
 *
 * Raw files cached under data-transient/talmud-raw/<Tractate>/ and reused
 * by scripts/talmud/bundle.ts in tm-f28x.
 *
 * Usage:
 *   npx tsx scripts/talmud/verify-coverage.ts            # honor cache
 *   npx tsx scripts/talmud/verify-coverage.ts --force    # re-download all
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

// ============================================================================
// Tractate list — hand-rolled. Source: standard Vilna Bavli table of contents.
// 37 tractates total. Shekalim is excluded because its "Bavli" Gemara is
// actually Yerushalmi (see design doc §2.5).
// ============================================================================

export interface TractateRef {
  seder: string;
  tractate: string;
}

export const BAVLI_TRACTATES: ReadonlyArray<TractateRef> = [
  // Seder Zeraim (1)
  { seder: "Seder Zeraim", tractate: "Berakhot" },
  // Seder Moed (11; Shekalim excluded)
  { seder: "Seder Moed", tractate: "Shabbat" },
  { seder: "Seder Moed", tractate: "Eruvin" },
  { seder: "Seder Moed", tractate: "Pesachim" },
  { seder: "Seder Moed", tractate: "Yoma" },
  { seder: "Seder Moed", tractate: "Sukkah" },
  { seder: "Seder Moed", tractate: "Beitzah" },
  { seder: "Seder Moed", tractate: "Rosh Hashanah" },
  { seder: "Seder Moed", tractate: "Taanit" },
  { seder: "Seder Moed", tractate: "Megillah" },
  { seder: "Seder Moed", tractate: "Moed Katan" },
  { seder: "Seder Moed", tractate: "Chagigah" },
  // Seder Nashim (7)
  { seder: "Seder Nashim", tractate: "Yevamot" },
  { seder: "Seder Nashim", tractate: "Ketubot" },
  { seder: "Seder Nashim", tractate: "Nedarim" },
  { seder: "Seder Nashim", tractate: "Nazir" },
  { seder: "Seder Nashim", tractate: "Sotah" },
  { seder: "Seder Nashim", tractate: "Gittin" },
  { seder: "Seder Nashim", tractate: "Kiddushin" },
  // Seder Nezikin (8)
  { seder: "Seder Nezikin", tractate: "Bava Kamma" },
  { seder: "Seder Nezikin", tractate: "Bava Metzia" },
  { seder: "Seder Nezikin", tractate: "Bava Batra" },
  { seder: "Seder Nezikin", tractate: "Sanhedrin" },
  { seder: "Seder Nezikin", tractate: "Makkot" },
  { seder: "Seder Nezikin", tractate: "Shevuot" },
  { seder: "Seder Nezikin", tractate: "Avodah Zarah" },
  { seder: "Seder Nezikin", tractate: "Horayot" },
  // Seder Kodashim (9)
  { seder: "Seder Kodashim", tractate: "Zevachim" },
  { seder: "Seder Kodashim", tractate: "Menachot" },
  { seder: "Seder Kodashim", tractate: "Chullin" },
  { seder: "Seder Kodashim", tractate: "Bekhorot" },
  { seder: "Seder Kodashim", tractate: "Arakhin" },
  { seder: "Seder Kodashim", tractate: "Temurah" },
  { seder: "Seder Kodashim", tractate: "Keritot" },
  { seder: "Seder Kodashim", tractate: "Meilah" },
  { seder: "Seder Kodashim", tractate: "Tamid" },
  // Seder Tahorot (1) — note: Sefaria-Export uses "Tahorot" spelling
  { seder: "Seder Tahorot", tractate: "Niddah" },
];
// 1 + 11 + 7 + 8 + 9 + 1 = 37

// ============================================================================
// Configuration
// ============================================================================

const CACHE_ROOT = "data-transient/talmud-raw";
const REPORT_PATH = "data-transient/talmud-coverage-report.json";

const GCS_BASE = "https://storage.googleapis.com/sefaria-export";

// Marker plausibility ranges (segments per tractate).
// Berakhot has 34 of each. The lower bound handles small tractates like
// Tamid (5) and Taanit (8) which are legitimately short. Only catastrophic
// data loss (e.g., 0 markers) should be caught by this rule — the primary
// verification is the hard shape/schema check above.
const MARKER_MIN = 3;
const MARKER_MAX = 400;

// ============================================================================
// Fetch + cache helpers
// ============================================================================

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a URL to a local path if not already cached, or if force is true.
 */
async function fetchToCache(
  url: string,
  cachePath: string,
  force: boolean,
): Promise<string> {
  if (!force && (await fileExists(cachePath))) {
    return cachePath;
  }
  const dir = cachePath.substring(0, cachePath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  await writeFile(cachePath, text, "utf-8");
  return cachePath;
}

function urlsFor(ref: TractateRef): {
  wikisource: string;
  merged: string;
  schema: string;
} {
  const seder = encodeURIComponent(ref.seder);
  const tractate = encodeURIComponent(ref.tractate);
  // Schema filenames use underscores for spaces, not URL-encoded spaces.
  // E.g. "Rosh Hashanah" → "Rosh_Hashanah.json".
  const schemaName = ref.tractate.replace(/ /g, "_");
  return {
    wikisource: `${GCS_BASE}/json/Talmud/Bavli/${seder}/${tractate}/Hebrew/${encodeURIComponent("Wikisource Talmud Bavli.json")}`,
    merged: `${GCS_BASE}/json/Talmud/Bavli/${seder}/${tractate}/Hebrew/merged.json`,
    schema: `${GCS_BASE}/schemas/${schemaName}.json`,
  };
}

function cachePathsFor(ref: TractateRef): {
  wikisource: string;
  merged: string;
  schema: string;
} {
  const dir = join(CACHE_ROOT, ref.tractate);
  return {
    wikisource: join(dir, "wikisource.json"),
    merged: join(dir, "merged.json"),
    schema: join(dir, "schema.json"),
  };
}

async function fetchTractate(
  ref: TractateRef,
  force: boolean,
): Promise<{
  wikisource: unknown;
  merged: unknown;
  schema: unknown;
}> {
  const urls = urlsFor(ref);
  const paths = cachePathsFor(ref);

  const [ws, md, sc] = await Promise.all([
    fetchToCache(urls.wikisource, paths.wikisource, force),
    fetchToCache(urls.merged, paths.merged, force),
    fetchToCache(urls.schema, paths.schema, force),
  ]);

  const [wsText, mdText, scText] = await Promise.all([
    readFile(ws, "utf-8"),
    readFile(md, "utf-8"),
    readFile(sc, "utf-8"),
  ]);

  return {
    wikisource: JSON.parse(wsText),
    merged: JSON.parse(mdText),
    schema: JSON.parse(scText),
  };
}

// ============================================================================
// Verification logic (pure functions, no I/O)
// ============================================================================

export interface VerificationResult {
  status: "pass" | "hard-fail" | "soft-fail";
  failures: string[];
  wikisource: { amudCount: number; segmentCount: number };
  merged: { amudCount: number; segmentCount: number };
  shapeMatch: boolean;
  markers: { matnitin: number; gemara: number; hadran: number };
}

export interface TalmudJson {
  text: string[][];
}

/**
 * Count occurrences of a marker string across all segments in a tractate.
 */
export function countMarker(text: string[][], marker: string): number {
  let count = 0;
  for (const amud of text) {
    for (const seg of amud) {
      if (seg.includes(marker)) count += 1;
    }
  }
  return count;
}

/**
 * Total segments across all amudim.
 */
export function totalSegments(text: string[][]): number {
  let n = 0;
  for (const amud of text) n += amud.length;
  return n;
}

/**
 * Verify that two tractate sources have identical shape.
 */
export function shapeMatches(
  a: TalmudJson,
  b: TalmudJson,
): { match: boolean; reason?: string } {
  if (a.text.length !== b.text.length) {
    return {
      match: false,
      reason: `amud count differs: ${a.text.length} vs ${b.text.length}`,
    };
  }
  for (let i = 0; i < a.text.length; i++) {
    if (a.text[i].length !== b.text[i].length) {
      return {
        match: false,
        reason: `amud ${i} segment count differs: ${a.text[i].length} vs ${b.text[i].length}`,
      };
    }
  }
  return { match: true };
}

/**
 * Run all verification rules against a fetched tractate bundle.
 */
export function verifyTractate(
  wikisource: unknown,
  merged: unknown,
  schema: unknown,
): VerificationResult {
  const failures: string[] = [];
  const ws = wikisource as TalmudJson;
  const md = merged as TalmudJson;
  const sc = schema as {
    alts?: { Chapters?: { nodes?: unknown[] } };
  };

  // --- Hard rules ---

  if (!Array.isArray(ws?.text)) {
    failures.push("wikisource.text is not an array");
  }
  if (!Array.isArray(md?.text)) {
    failures.push("merged.text is not an array");
  }
  const wsAmud = ws?.text?.length ?? 0;
  const wsSeg = Array.isArray(ws?.text) ? totalSegments(ws.text) : 0;
  const mdAmud = md?.text?.length ?? 0;
  const mdSeg = Array.isArray(md?.text) ? totalSegments(md.text) : 0;

  if (wsAmud === 0) failures.push("wikisource text.length === 0");
  if (wsSeg === 0) failures.push("wikisource total segment count === 0");
  if (mdAmud === 0) failures.push("merged text.length === 0");
  if (mdSeg === 0) failures.push("merged total segment count === 0");

  let shapeOk = false;
  if (Array.isArray(ws?.text) && Array.isArray(md?.text)) {
    const sh = shapeMatches(ws, md);
    shapeOk = sh.match;
    if (!sh.match) failures.push(`shape mismatch: ${sh.reason}`);
  }

  const nodes = sc?.alts?.Chapters?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    failures.push("schema has no perek nodes");
  }

  const hardFail = failures.length > 0;

  // --- Soft rules (markers) — only if hard rules passed ---

  const markers = {
    matnitin: 0,
    gemara: 0,
    hadran: 0,
  };

  if (!hardFail && Array.isArray(ws?.text)) {
    markers.matnitin = countMarker(ws.text, "מתני׳");
    markers.gemara = countMarker(ws.text, "גמ׳");
    markers.hadran = countMarker(ws.text, "הדרן");

    if (markers.matnitin < MARKER_MIN || markers.matnitin > MARKER_MAX) {
      failures.push(
        `מתני׳ count = ${markers.matnitin} (expected ${MARKER_MIN}–${MARKER_MAX})`,
      );
    }
    if (markers.gemara < MARKER_MIN || markers.gemara > MARKER_MAX) {
      failures.push(
        `גמ׳ count = ${markers.gemara} (expected ${MARKER_MIN}–${MARKER_MAX})`,
      );
    }
    if (markers.hadran < 1) {
      failures.push("הדרן count < 1 (no perek boundaries?)");
    }
  }

  const status: VerificationResult["status"] = hardFail
    ? "hard-fail"
    : failures.length > 0
      ? "soft-fail"
      : "pass";

  return {
    status,
    failures,
    wikisource: { amudCount: wsAmud, segmentCount: wsSeg },
    merged: { amudCount: mdAmud, segmentCount: mdSeg },
    shapeMatch: shapeOk,
    markers,
  };
}

// ============================================================================
// Report + summary output
// ============================================================================

interface CoverageReport {
  generatedAt: string;
  totalTractates: number;
  passed: number;
  failed: number;
  tractates: Array<VerificationResult & TractateRef>;
}

async function writeCoverageReport(
  results: Array<VerificationResult & TractateRef>,
): Promise<void> {
  const report: CoverageReport = {
    generatedAt: new Date().toISOString(),
    totalTractates: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status !== "pass").length,
    tractates: results,
  };
  await mkdir("data-transient", { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nReport written to ${REPORT_PATH}`);
}

function printSummary(results: Array<VerificationResult & TractateRef>): void {
  const passed = results.filter((r) => r.status === "pass");
  const failed = results.filter((r) => r.status !== "pass");

  console.log("");
  console.log("==========================================");
  console.log(`PASS: ${passed.length} / ${results.length}`);
  console.log(`FAIL: ${failed.length} / ${results.length}`);
  console.log("==========================================");

  if (failed.length > 0) {
    console.log("\nFailures:\n");
    for (const r of failed) {
      console.log(`  ${r.tractate.padEnd(20)} ${r.status}`);
      for (const f of r.failures) {
        console.log(`    ! ${f}`);
      }
    }
    console.log("\nSuggested issue creation (copy-paste one line per anomaly):\n");
    for (const r of failed) {
      const kind = r.status === "hard-fail" ? "hard" : "soft";
      console.log(
        `  ./scripts/issues-new.sh "Talmud coverage anomaly: ${r.tractate} (${kind}-fail)" task 2`,
      );
    }
  }
}

// ============================================================================
// Entry point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  console.log(`Verifying ${BAVLI_TRACTATES.length} Bavli tractates...`);
  console.log(`Cache: ${CACHE_ROOT}`);
  console.log(`Force re-download: ${force}`);
  console.log("");

  const results: Array<VerificationResult & TractateRef> = [];

  for (const ref of BAVLI_TRACTATES) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} `);
    try {
      const bundle = await fetchTractate(ref, force);
      const result = verifyTractate(bundle.wikisource, bundle.merged, bundle.schema);
      results.push({ ...ref, ...result });

      const tag = result.status === "pass" ? "PASS" : result.status.toUpperCase();
      process.stdout.write(
        `${tag.padEnd(10)} amudim=${result.wikisource.amudCount} seg=${result.wikisource.segmentCount} ` +
          `markers=${result.markers.matnitin}/${result.markers.gemara}/${result.markers.hadran}\n`,
      );
      if (result.failures.length > 0) {
        for (const f of result.failures) console.log(`    ! ${f}`);
      }
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
      results.push({
        ...ref,
        status: "hard-fail",
        failures: [`fetch error: ${(err as Error).message}`],
        wikisource: { amudCount: 0, segmentCount: 0 },
        merged: { amudCount: 0, segmentCount: 0 },
        shapeMatch: false,
        markers: { matnitin: 0, gemara: 0, hadran: 0 },
      });
    }
  }

  await writeCoverageReport(results);
  printSummary(results);

  const passed = results.filter((r) => r.status === "pass").length;
  process.exit(passed > 0 ? 0 : 1);
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("verify-coverage failed:", err);
    process.exit(1);
  });
}
