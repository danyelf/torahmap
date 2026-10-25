#!/usr/bin/env tsx
/**
 * Download every Bavli tractate in the William Davidson edition, with its English and chapter
 * boundaries, and check that each is whole: chapters in the schema and a plausible count of
 * markers. Wikisource's edition comes too, only for the Tanakh verses it names, and must be
 * divided as Davidson's is. The report says which tractates bundle.ts builds.
 *
 * Usage:
 *   npx tsx scripts/talmud/verify-coverage.ts            # honor cache
 *   npx tsx scripts/talmud/verify-coverage.ts --force    # re-download all
 */

import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { markersOf } from './markers.ts';

// Tractate list — hand-rolled. Source: standard Vilna Bavli table of contents.
// 37 tractates total. Shekalim is excluded because its "Bavli" Gemara is
// actually Yerushalmi.

export interface TractateRef {
  seder: string;
  tractate: string;
}

export const BAVLI_TRACTATES: ReadonlyArray<TractateRef> = [
  // Zeraim (1)
  { seder: 'Zeraim', tractate: 'Berakhot' },
  // Moed (11; Shekalim excluded)
  { seder: 'Moed', tractate: 'Shabbat' },
  { seder: 'Moed', tractate: 'Eruvin' },
  { seder: 'Moed', tractate: 'Pesachim' },
  { seder: 'Moed', tractate: 'Yoma' },
  { seder: 'Moed', tractate: 'Sukkah' },
  { seder: 'Moed', tractate: 'Beitzah' },
  { seder: 'Moed', tractate: 'Rosh Hashanah' },
  { seder: 'Moed', tractate: 'Taanit' },
  { seder: 'Moed', tractate: 'Megillah' },
  { seder: 'Moed', tractate: 'Moed Katan' },
  { seder: 'Moed', tractate: 'Chagigah' },
  // Nashim (7)
  { seder: 'Nashim', tractate: 'Yevamot' },
  { seder: 'Nashim', tractate: 'Ketubot' },
  { seder: 'Nashim', tractate: 'Nedarim' },
  { seder: 'Nashim', tractate: 'Nazir' },
  { seder: 'Nashim', tractate: 'Sotah' },
  { seder: 'Nashim', tractate: 'Gittin' },
  { seder: 'Nashim', tractate: 'Kiddushin' },
  // Nezikin (8)
  { seder: 'Nezikin', tractate: 'Bava Kamma' },
  { seder: 'Nezikin', tractate: 'Bava Metzia' },
  { seder: 'Nezikin', tractate: 'Bava Batra' },
  { seder: 'Nezikin', tractate: 'Sanhedrin' },
  { seder: 'Nezikin', tractate: 'Makkot' },
  { seder: 'Nezikin', tractate: 'Shevuot' },
  { seder: 'Nezikin', tractate: 'Avodah Zarah' },
  { seder: 'Nezikin', tractate: 'Horayot' },
  // Kodashim (9)
  { seder: 'Kodashim', tractate: 'Zevachim' },
  { seder: 'Kodashim', tractate: 'Menachot' },
  { seder: 'Kodashim', tractate: 'Chullin' },
  { seder: 'Kodashim', tractate: 'Bekhorot' },
  { seder: 'Kodashim', tractate: 'Arakhin' },
  { seder: 'Kodashim', tractate: 'Temurah' },
  { seder: 'Kodashim', tractate: 'Keritot' },
  { seder: 'Kodashim', tractate: 'Meilah' },
  { seder: 'Kodashim', tractate: 'Tamid' },
  // Tahorot (1) — note: Sefaria-Export uses "Tahorot" spelling
  { seder: 'Tahorot', tractate: 'Niddah' },
];
// 1 + 11 + 7 + 8 + 9 + 1 = 37

export const CACHE_ROOT = 'data/talmud/raw';
export const REPORT_PATH = 'data/talmud/coverage-report.json';

const SEFARIA_EXPORT = readFileSync('scripts/sefaria-export.env', 'utf-8').match(
  /^SEFARIA_EXPORT=(.+)$/m,
)?.[1];
if (!SEFARIA_EXPORT) throw new Error('scripts/sefaria-export.env names no SEFARIA_EXPORT');

// How many of each marker a tractate may have. Berakhot has 34 of each; the
// floor is low for short tractates, so it catches only markers lost outright.
const MARKER_MIN = 3;
const MARKER_MAX = 400;

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
async function fetchToCache(url: string, cachePath: string, force: boolean): Promise<string> {
  if (!force && (await fileExists(cachePath))) {
    return cachePath;
  }
  const dir = cachePath.substring(0, cachePath.lastIndexOf('/'));
  await mkdir(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  await writeFile(cachePath, text, 'utf-8');
  return cachePath;
}

/** What a tractate is downloaded as: its text, its chapters, its English and the verses it cites. */
interface TractateFiles {
  davidson: string;
  schema: string;
  english: string;
  /** Read only for the Tanakh verses it names, which Davidson quotes without naming. */
  wikisource: string;
}

function urlsFor(ref: TractateRef): TractateFiles {
  const seder = encodeURIComponent(`Seder ${ref.seder}`);
  const tractate = encodeURIComponent(ref.tractate);
  // Schema filenames use underscores for spaces, not URL-encoded spaces.
  // E.g. "Rosh Hashanah" → "Rosh_Hashanah.json".
  const schemaName = ref.tractate.replace(/ /g, '_');
  const edition = (name: string) =>
    `${SEFARIA_EXPORT}/json/Talmud/Bavli/${seder}/${tractate}/${name}`;
  return {
    // merged.json holds the Davidson text.
    davidson: edition('Hebrew/merged.json'),
    schema: `${SEFARIA_EXPORT}/schemas/${schemaName}.json`,
    english: edition(`English/${encodeURIComponent('William Davidson Edition - English.json')}`),
    wikisource: edition(`Hebrew/${encodeURIComponent('Wikisource Talmud Bavli.json')}`),
  };
}

export function cachePathsFor(ref: TractateRef): TractateFiles {
  const dir = join(CACHE_ROOT, ref.tractate);
  return {
    davidson: join(dir, 'merged.json'),
    schema: join(dir, 'schema.json'),
    english: join(dir, 'english.json'),
    wikisource: join(dir, 'wikisource.json'),
  };
}

async function fetchTractate(
  ref: TractateRef,
  force: boolean,
): Promise<{ davidson: unknown; wikisource: unknown; schema: unknown }> {
  const urls = urlsFor(ref);
  const paths = cachePathsFor(ref);
  await Promise.all(
    (Object.keys(urls) as (keyof TractateFiles)[]).map((key) =>
      fetchToCache(urls[key], paths[key], force),
    ),
  );
  const read = async (path: string) => JSON.parse(await readFile(path, 'utf-8')) as unknown;
  return {
    davidson: await read(paths.davidson),
    wikisource: await read(paths.wikisource),
    schema: await read(paths.schema),
  };
}

// Verification logic — pure functions, no I/O.

export type TractateStatus = 'pass' | 'hard-fail' | 'soft-fail';

export interface VerificationResult {
  status: TractateStatus;
  failures: string[];
  amudCount: number;
  segmentCount: number;
  markers: { matnitin: number; gemara: number };
}

export interface TalmudJson {
  text: string[][];
}

/** How many segments open each part, read as bundle.ts reads them. */
export function countMarkers(text: string[][]): { matnitin: number; gemara: number } {
  const opens = markersOf(text).flat();
  return {
    matnitin: opens.filter((m) => m === 'M').length,
    gemara: opens.filter((m) => m === 'G').length,
  };
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
export function shapeMatches(a: TalmudJson, b: TalmudJson): { match: boolean; reason?: string } {
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
 * Run all verification rules against a fetched tractate.
 */
export function verifyTractate(
  davidson: unknown,
  wikisource: unknown,
  schema: unknown,
): VerificationResult {
  const failures: string[] = [];
  const text = (davidson as TalmudJson)?.text;
  const naming = (wikisource as TalmudJson)?.text;
  const sc = schema as {
    alts?: { Chapters?: { nodes?: unknown[] } };
  };

  // --- Hard rules ---

  const amudCount = Array.isArray(text) ? text.length : 0;
  const segmentCount = Array.isArray(text) ? totalSegments(text) : 0;
  if (segmentCount === 0) failures.push('no text');

  if (!Array.isArray(naming)) {
    failures.push('wikisource.text is not an array');
  } else if (Array.isArray(text)) {
    const sh = shapeMatches({ text }, { text: naming });
    if (!sh.match) failures.push(`shape mismatch: ${sh.reason}`);
  }

  const nodes = sc?.alts?.Chapters?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    failures.push('schema has no perek nodes');
  }

  const hardFail = failures.length > 0;

  // --- Soft rules (markers) — only if hard rules passed ---

  let markers = { matnitin: 0, gemara: 0 };

  if (!hardFail) {
    markers = countMarkers(text);

    if (markers.matnitin < MARKER_MIN || markers.matnitin > MARKER_MAX) {
      failures.push(`מתני׳ count = ${markers.matnitin} (expected ${MARKER_MIN}–${MARKER_MAX})`);
    }
    if (markers.gemara < MARKER_MIN || markers.gemara > MARKER_MAX) {
      failures.push(`גמ׳ count = ${markers.gemara} (expected ${MARKER_MIN}–${MARKER_MAX})`);
    }
  }

  const status: VerificationResult['status'] = hardFail
    ? 'hard-fail'
    : failures.length > 0
      ? 'soft-fail'
      : 'pass';

  return { status, failures, amudCount, segmentCount, markers };
}

export interface CoverageReport {
  totalTractates: number;
  passed: number;
  failed: number;
  tractates: Array<VerificationResult & TractateRef>;
}

async function writeCoverageReport(
  results: Array<VerificationResult & TractateRef>,
): Promise<void> {
  const report: CoverageReport = {
    totalTractates: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status !== 'pass').length,
    tractates: results,
  };
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nReport written to ${REPORT_PATH}`);
}

function printSummary(results: Array<VerificationResult & TractateRef>): void {
  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status !== 'pass');

  console.log('');
  console.log('==========================================');
  console.log(`PASS: ${passed.length} / ${results.length}`);
  console.log(`FAIL: ${failed.length} / ${results.length}`);
  console.log('==========================================');

  if (failed.length > 0) {
    console.log('\nFailures:\n');
    for (const r of failed) {
      console.log(`  ${r.tractate.padEnd(20)} ${r.status}`);
      for (const f of r.failures) {
        console.log(`    ! ${f}`);
      }
    }
    console.log('\nSuggested issue creation (copy-paste one line per anomaly):\n');
    for (const r of failed) {
      const kind = r.status === 'hard-fail' ? 'hard' : 'soft';
      console.log(
        `  gh issue create --title "Talmud coverage anomaly: ${r.tractate} (${kind}-fail)" --label task,P2`,
      );
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log(`Verifying ${BAVLI_TRACTATES.length} Bavli tractates...`);
  console.log(`Cache: ${CACHE_ROOT}`);
  console.log(`Force re-download: ${force}`);
  console.log('');

  const results: Array<VerificationResult & TractateRef> = [];

  for (const ref of BAVLI_TRACTATES) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} `);
    try {
      const bundle = await fetchTractate(ref, force);
      const result = verifyTractate(bundle.davidson, bundle.wikisource, bundle.schema);
      results.push({ ...ref, ...result });

      const tag = result.status === 'pass' ? 'PASS' : result.status.toUpperCase();
      process.stdout.write(
        `${tag.padEnd(10)} amudim=${result.amudCount} seg=${result.segmentCount} ` +
          `markers=${result.markers.matnitin}/${result.markers.gemara}\n`,
      );
      if (result.failures.length > 0) {
        for (const f of result.failures) console.log(`    ! ${f}`);
      }
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
      results.push({
        ...ref,
        status: 'hard-fail',
        failures: [`fetch error: ${(err as Error).message}`],
        amudCount: 0,
        segmentCount: 0,
        markers: { matnitin: 0, gemara: 0 },
      });
    }
  }

  await writeCoverageReport(results);
  printSummary(results);

  const passed = results.filter((r) => r.status === 'pass').length;
  process.exit(passed > 0 ? 0 : 1);
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('verify-coverage failed:', err);
    process.exit(1);
  });
}
