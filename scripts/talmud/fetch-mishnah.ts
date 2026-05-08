#!/usr/bin/env tsx
/**
 * Download standalone "Mishnah X" Hebrew text for every Bavli tractate
 * we bundle. Used by scripts/talmud/bundle.ts as ground truth for the
 * mishnah-character budget cap.
 *
 * Why: the Wikisource Bavli source is missing some `<big><strong>גמ׳`
 * markers, which causes walkMarkers to keep the state in "mishnah" for
 * dozens of segments past the real mishnah end. The standalone Mishnah
 * tells us how long each perek's mishnah block actually is.
 *
 * Inputs:  data-transient/talmud-coverage-report.json (tractate list)
 * Outputs: data-transient/mishnah-raw/<Tractate>.json
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const GCS = "https://storage.googleapis.com/sefaria-export";
const COVERAGE = "data-transient/talmud-coverage-report.json";
const OUT = "data-transient/mishnah-raw";

// A few standalone-Mishnah names don't follow the "Mishnah <Tractate>"
// pattern. Add overrides here as we discover them.
const NAME_OVERRIDES: Record<string, string> = {
  Taanit: "Mishnah Ta'anit",
};

interface CoverageEntry {
  seder: string;
  tractate: string;
  status: string;
}
interface CoverageReport {
  tractates: CoverageEntry[];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchOne(seder: string, tractate: string): Promise<void> {
  const out = join(OUT, `${tractate}.json`);
  if (await fileExists(out)) {
    return;
  }
  const name = NAME_OVERRIDES[tractate] ?? `Mishnah ${tractate}`;
  const url = `${GCS}/json/Mishnah/${encodeURIComponent(seder)}/${encodeURIComponent(name)}/Hebrew/merged.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  await writeFile(out, text, "utf-8");
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const report: CoverageReport = JSON.parse(
    await readFile(COVERAGE, "utf-8"),
  );
  const passed = report.tractates.filter((t) => t.status === "pass");
  console.log(`Fetching standalone Mishnah for ${passed.length} tractates...`);
  let ok = 0;
  let fail = 0;
  for (const t of passed) {
    process.stdout.write(`  ${t.tractate.padEnd(20)} ... `);
    try {
      await fetchOne(t.seder, t.tractate);
      console.log("OK");
      ok++;
    } catch (err) {
      console.log(`FAIL: ${(err as Error).message}`);
      fail++;
    }
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
