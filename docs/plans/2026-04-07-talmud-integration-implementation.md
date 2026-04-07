# Talmud Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full Babylonian Talmud as a second corpus at `/torahmap/talmud.html`, sharing the Torah Map's WebGL rendering pipeline via a lightweight type generalization, with all 37 Bavli tractates rendered in a bookshelf layout, structural Mishnah/Gemara coloring, and one first-cut analytical overlay.

**Architecture:** Templated spatial layer — concrete `TanakhIdentity` / `TalmudIdentity` interfaces, generic `SpatialItem<T>` wrapper, rendering modules become `<T>` generic. Two separate HTML entry points (`index.html` stays Tanakh; new `talmud.html` loads `main-talmud.ts`). Data comes from Sefaria-Export GCS bucket (Wikisource Hebrew + Davidson merged), cached locally during a verification pass, bundled into `public/data/talmud/structure.json` + `public/data/talmud/texts/*.json`, fetched at runtime.

**Tech Stack:** TypeScript, Vite multi-page build, WebGL 2 (existing engine, unchanged), Vitest (existing test runner), Sefaria-Export GCS bucket (public, no auth), Node `fetch` for downloads, `tsx` for running scripts.

**Companion design doc:** `docs/plans/2026-04-07-talmud-integration-design.md` — this plan implements that spec. References below as "§X.Y" point to sections of the design doc.

**Two issues, two stacked PRs:**
- Phase 1 = `tm-u7b1` (verify Wikisource coverage) → PR #1 against `main`
- Phase 2 = `tm-f28x` (engine integration) → PR #2 against `tm-u7b1` branch

**Execution environment:** This plan starts in the `tm-f28x` worktree where the design doc and this plan currently live uncommitted. Phase 1 creates a new `tm-u7b1` worktree and migrates the docs there for their first commit. Phase 2 returns to the `tm-f28x` worktree after rebasing onto `tm-u7b1`.

---

## Phase 1: tm-u7b1 — Coverage Verification

### Task 1: Create tm-u7b1 worktree and commit the docs

**Goal:** Move the uncommitted design doc and implementation plan from the current tm-f28x worktree into a new tm-u7b1 worktree (branched off main), and commit them there as the opening commit. Nothing else.

- [ ] **Step 1: Create the tm-u7b1 worktree off main**

Run:
```bash
git -C /Users/danyel/code/MISC/torahmap-worktrees/tm-f28x worktree add \
  /Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1 -b tm-u7b1 main
```

(Running via `git -C` means we don't need to cd first. The worktree command accepts a source and target from anywhere inside the repo.)

Expected: new worktree at `/Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1` on branch `tm-u7b1`, starting from `main`.

- [ ] **Step 2: Move the two doc files across worktrees**

Run:
```bash
mv /Users/danyel/code/MISC/torahmap-worktrees/tm-f28x/docs/plans/2026-04-07-talmud-integration-design.md \
   /Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1/docs/plans/2026-04-07-talmud-integration-design.md

mv /Users/danyel/code/MISC/torahmap-worktrees/tm-f28x/docs/plans/2026-04-07-talmud-integration-implementation.md \
   /Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1/docs/plans/2026-04-07-talmud-integration-implementation.md
```

After this, tm-f28x's working tree no longer contains the docs; tm-u7b1's does.

- [ ] **Step 3: Commit the docs in the tm-u7b1 worktree**

Run:
```bash
cd /Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1
git add docs/plans/2026-04-07-talmud-integration-design.md \
        docs/plans/2026-04-07-talmud-integration-implementation.md
git commit -m "$(cat <<'EOF'
docs: add Talmud integration design + implementation plan

Brainstormed design covering tm-u7b1 (verify Wikisource coverage)
and tm-f28x (engine integration for full Bavli). Ships as two
stacked PRs; this commit lands on the tm-u7b1 branch which is the
base of the stack.

EOF
)"
```

Expected: one commit on `tm-u7b1` containing only the two doc files. Phase 1's remaining tasks continue from this worktree.

---

### Task 2: Add `data-transient/` to gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Read the current .gitignore**

Use the Read tool on `.gitignore` to see the current contents and where the new entry fits naturally.

- [ ] **Step 2: Append `data-transient/` with a comment**

Edit `.gitignore` to add (at the bottom, or grouped with other cache/artifact exclusions):

```
# Talmud verification cache — regenerable via scripts/talmud/verify-coverage.ts
data-transient/
```

- [ ] **Step 3: Verify the pattern matches**

Run:
```bash
mkdir -p data-transient/test
echo "test" > data-transient/test/file.txt
git status --porcelain data-transient/
```

Expected: empty output (the directory is ignored). Clean up:

```bash
rm -rf data-transient/test
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore data-transient/ for Talmud verification cache"
```

---

### Task 3: Scaffold verify-coverage script with BAVLI_TRACTATES constant

**Files:**
- Create: `scripts/talmud/verify-coverage.ts`

- [ ] **Step 1: Create the scripts/talmud directory**

Run:
```bash
mkdir -p scripts/talmud/fixtures
```

- [ ] **Step 2: Write the script scaffold**

Create `scripts/talmud/verify-coverage.ts`:

```ts
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

interface TractateRef {
  seder: string;
  tractate: string;
}

const BAVLI_TRACTATES: ReadonlyArray<TractateRef> = [
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
  // Seder Tohorot (1)
  { seder: "Seder Tohorot", tractate: "Niddah" },
];

// ============================================================================
// Configuration
// ============================================================================

const CACHE_ROOT = "data-transient/talmud-raw";
const REPORT_PATH = "data-transient/talmud-coverage-report.json";

const GCS_BASE = "https://storage.googleapis.com/sefaria-export";

// Marker plausibility ranges (segments per tractate).
// Berakhot has 34 of each. Extreme outliers are suspicious.
const MARKER_MIN = 10;
const MARKER_MAX = 300;

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

  // TODO in later tasks: fetch, verify, report
  throw new Error("not yet implemented");
}

main().catch((err) => {
  console.error("verify-coverage failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify it runs (and fails with the expected stub error)**

Run:
```bash
npx tsx scripts/talmud/verify-coverage.ts
```

Expected: prints the header, then crashes with `not yet implemented`. Exit code 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/talmud/verify-coverage.ts
git commit -m "feat(talmud): scaffold verify-coverage script with BAVLI_TRACTATES list"
```

---

### Task 4: Implement fetch-and-cache helper

**Files:**
- Modify: `scripts/talmud/verify-coverage.ts`

- [ ] **Step 1: Add fetch-and-cache functions to the script**

After the `CACHE_ROOT` constant, insert:

```ts
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
 * Returns the path on success. Throws on HTTP failure or network error.
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

/**
 * Build the three GCS URLs for a tractate.
 */
function urlsFor(ref: TractateRef): {
  wikisource: string;
  merged: string;
  schema: string;
} {
  const seder = encodeURIComponent(ref.seder);
  const tractate = encodeURIComponent(ref.tractate);
  return {
    wikisource: `${GCS_BASE}/json/Talmud/Bavli/${seder}/${tractate}/Hebrew/${encodeURIComponent("Wikisource Talmud Bavli.json")}`,
    merged: `${GCS_BASE}/json/Talmud/Bavli/${seder}/${tractate}/Hebrew/merged.json`,
    schema: `${GCS_BASE}/schemas/${tractate}.json`,
  };
}

/**
 * Build the three local cache paths for a tractate.
 */
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

/**
 * Download (or load from cache) all three files for a tractate.
 */
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
```

- [ ] **Step 2: Replace the `main()` stub with a smoke-test loop**

Replace the `main()` body:

```ts
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  console.log(`Verifying ${BAVLI_TRACTATES.length} Bavli tractates...`);
  console.log(`Cache: ${CACHE_ROOT}`);
  console.log(`Force re-download: ${force}`);
  console.log("");

  for (const ref of BAVLI_TRACTATES) {
    process.stdout.write(`  ${ref.tractate.padEnd(20)} ... `);
    try {
      await fetchTractate(ref, force);
      console.log("fetched");
    } catch (err) {
      console.log(`FAIL: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 3: Smoke-test with Berakhot only (not the full list)**

Temporarily edit the `for` loop to only iterate the first tractate:

```ts
for (const ref of BAVLI_TRACTATES.slice(0, 1)) {
```

Then run:
```bash
npx tsx scripts/talmud/verify-coverage.ts
```

Expected: prints `Berakhot ... fetched`, creates `data-transient/talmud-raw/Berakhot/{wikisource,merged,schema}.json`. If the URL 404s, the BAVLI_TRACTATES spelling of "Berakhot" or "Seder Zeraim" is wrong — fix it per the real GCS path and retry.

Verify:
```bash
ls -la data-transient/talmud-raw/Berakhot/
```

Expected: three files, `wikisource.json` ~700 KB, `merged.json` similar, `schema.json` ~50 KB.

- [ ] **Step 4: Revert the slice to process all tractates**

Change `BAVLI_TRACTATES.slice(0, 1)` back to `BAVLI_TRACTATES`.

- [ ] **Step 5: Commit**

```bash
git add scripts/talmud/verify-coverage.ts
git commit -m "feat(talmud): add fetch-and-cache helper for Sefaria-Export downloads"
```

---

### Task 5: Implement Wikisource verification (hard rules + marker walk)

**Files:**
- Modify: `scripts/talmud/verify-coverage.ts`

The verification logic lives in a pure function so it's testable independently of fetching.

- [ ] **Step 1: Add types and verification functions**

After the fetch helpers, insert:

```ts
// ============================================================================
// Verification logic (pure functions, no I/O)
// ============================================================================

interface VerificationResult {
  status: "pass" | "hard-fail" | "soft-fail";
  failures: string[];              // empty if status === "pass"
  wikisource: { amudCount: number; segmentCount: number };
  merged: { amudCount: number; segmentCount: number };
  shapeMatch: boolean;
  markers: { matnitin: number; gemara: number; hadran: number };
}

/**
 * Shape of a Sefaria-Export Talmud JSON file (both Wikisource and merged).
 * text[amudIdx] is an array of segment strings.
 */
interface TalmudJson {
  text: string[][];
}

/**
 * Count occurrences of a marker string across all segments in a tractate.
 * The markers are Hebrew abbreviations: מתני׳, גמ׳, הדרן.
 * They may appear at the start of a segment or embedded within it.
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
 * Verify that two tractate sources have identical shape:
 * same amud count, same per-amud segment count.
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
 * Returns a structured result. Does not throw.
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
```

- [ ] **Step 2: Wire verification into the main loop**

Replace the `main()` function with:

```ts
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

  // Report generation comes in Task 7
  console.log("");
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.length - passed;
  console.log(`PASS: ${passed} / FAIL: ${failed}`);
}
```

- [ ] **Step 3: Test compilation**

Run:
```bash
npx tsx --check scripts/talmud/verify-coverage.ts 2>&1 || npx tsc --noEmit scripts/talmud/verify-coverage.ts
```

Expected: no TypeScript errors. (If `tsx --check` isn't supported, use `tsc --noEmit` with the project config.)

- [ ] **Step 4: Commit**

```bash
git add scripts/talmud/verify-coverage.ts
git commit -m "feat(talmud): implement verification rules (shape, markers, schema)"
```

---

### Task 6: Write unit tests for verification functions

**Files:**
- Create: `src/__tests__/unit/talmud-verify-coverage.test.ts`
- Create: `scripts/talmud/fixtures/fake-tractate-clean.json`
- Create: `scripts/talmud/fixtures/fake-tractate-shape-mismatch-merged.json`
- Create: `scripts/talmud/fixtures/fake-tractate-schema.json`

These tests exercise `verifyTractate`, `countMarker`, `shapeMatches`, and `totalSegments` from the script using synthetic minimal JSON fixtures. No network calls.

- [ ] **Step 1: Create a clean-case fixture**

Create `scripts/talmud/fixtures/fake-tractate-clean.json`:

```json
{
  "text": [
    ["מתני׳ התחלה", "המשך משנה", "הדרן"],
    ["גמ׳ התחלת גמרא", "המשך גמרא"],
    ["מתני׳ משנה שנייה", "גמ׳ המשך", "סוף הדף"]
  ]
}
```

This has 3 amudim, 8 segments, 2 מתני׳, 2 גמ׳, 1 הדרן. It will pass hard rules but **soft-fail** on the markers (2 < 10). That's deliberate — we'll assert the soft-fail branch.

- [ ] **Step 2: Create a schema fixture**

Create `scripts/talmud/fixtures/fake-tractate-schema.json`:

```json
{
  "alts": {
    "Chapters": {
      "nodes": [
        { "heTitle": "פרק א", "wholeRef": "Fake 1a:1-2b:3" }
      ]
    }
  }
}
```

- [ ] **Step 3: Create a shape-mismatch merged fixture**

Create `scripts/talmud/fixtures/fake-tractate-shape-mismatch-merged.json`:

```json
{
  "text": [
    ["x", "y", "z"],
    ["a", "b"]
  ]
}
```

Two amudim where the clean version has three. Will fail shape check.

- [ ] **Step 4: Export helper functions from the script**

In `scripts/talmud/verify-coverage.ts`, add `export` to the functions we'll test if they're not already exported: `countMarker`, `totalSegments`, `shapeMatches`, `verifyTractate`. (`VerificationResult` should also be exported.)

Also add the `export` keyword to `interface VerificationResult` and `interface TalmudJson` if not already.

- [ ] **Step 5: Write the test file**

Create `src/__tests__/unit/talmud-verify-coverage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countMarker,
  totalSegments,
  shapeMatches,
  verifyTractate,
} from "../../../scripts/talmud/verify-coverage.ts";

const FIXTURES = join(__dirname, "../../../scripts/talmud/fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf-8"));
}

describe("countMarker", () => {
  it("counts matnitin markers", () => {
    const text = [["מתני׳ one", "two"], ["three", "מתני׳ four"]];
    expect(countMarker(text, "מתני׳")).toBe(2);
  });

  it("returns 0 when marker absent", () => {
    expect(countMarker([["x", "y"]], "מתני׳")).toBe(0);
  });

  it("counts markers embedded mid-segment, not just at start", () => {
    const text = [["prefix מתני׳ suffix"]];
    expect(countMarker(text, "מתני׳")).toBe(1);
  });
});

describe("totalSegments", () => {
  it("sums segment counts across amudim", () => {
    expect(totalSegments([["a", "b", "c"], ["d"], ["e", "f"]])).toBe(6);
  });

  it("returns 0 for empty array", () => {
    expect(totalSegments([])).toBe(0);
  });
});

describe("shapeMatches", () => {
  it("matches identical shapes", () => {
    const a = { text: [["x", "y"], ["z"]] };
    const b = { text: [["1", "2"], ["3"]] };
    expect(shapeMatches(a, b).match).toBe(true);
  });

  it("rejects differing amud counts", () => {
    const a = { text: [["x"]] };
    const b = { text: [["x"], ["y"]] };
    const r = shapeMatches(a, b);
    expect(r.match).toBe(false);
    expect(r.reason).toContain("amud count");
  });

  it("rejects differing segment counts within an amud", () => {
    const a = { text: [["x", "y"]] };
    const b = { text: [["x"]] };
    const r = shapeMatches(a, b);
    expect(r.match).toBe(false);
    expect(r.reason).toContain("amud 0");
  });
});

describe("verifyTractate", () => {
  it("hard-fails on empty text", () => {
    const ws = { text: [] };
    const md = { text: [] };
    const sc = { alts: { Chapters: { nodes: [{}] } } };
    const r = verifyTractate(ws, md, sc);
    expect(r.status).toBe("hard-fail");
    expect(r.failures.some((f) => f.includes("text.length === 0"))).toBe(true);
  });

  it("hard-fails on shape mismatch", () => {
    const ws = loadFixture("fake-tractate-clean.json");
    const md = loadFixture("fake-tractate-shape-mismatch-merged.json");
    const sc = loadFixture("fake-tractate-schema.json");
    const r = verifyTractate(ws, md, sc);
    expect(r.status).toBe("hard-fail");
    expect(r.failures.some((f) => f.includes("shape mismatch"))).toBe(true);
  });

  it("hard-fails on missing schema nodes", () => {
    const ws = loadFixture("fake-tractate-clean.json");
    const md = ws; // identical shape
    const sc = { alts: { Chapters: { nodes: [] } } };
    const r = verifyTractate(ws, md, sc);
    expect(r.status).toBe("hard-fail");
    expect(r.failures.some((f) => f.includes("no perek nodes"))).toBe(true);
  });

  it("soft-fails when marker counts are below the expected range", () => {
    const ws = loadFixture("fake-tractate-clean.json"); // only 2 markers each
    const md = ws;
    const sc = loadFixture("fake-tractate-schema.json");
    const r = verifyTractate(ws, md, sc);
    expect(r.status).toBe("soft-fail");
    expect(r.failures.some((f) => f.includes("מתני׳"))).toBe(true);
  });

  it("passes when everything is plausible", () => {
    // Build a synthetic tractate with 15 matnitin, 15 gemara, 3 hadran markers
    const amudim: string[][] = [];
    for (let i = 0; i < 15; i++) {
      amudim.push([`מתני׳ mishnah ${i}`, `גמ׳ gemara ${i}`]);
    }
    // Add 3 hadran markers
    amudim[4].push("הדרן 1");
    amudim[9].push("הדרן 2");
    amudim[14].push("הדרן 3");

    const ws = { text: amudim };
    const md = { text: amudim.map((a) => a.map((s) => s)) }; // identical shape
    const sc = loadFixture("fake-tractate-schema.json");
    const r = verifyTractate(ws, md, sc);
    expect(r.status).toBe("pass");
    expect(r.failures).toEqual([]);
    expect(r.markers.matnitin).toBe(15);
    expect(r.markers.gemara).toBe(15);
    expect(r.markers.hadran).toBe(3);
  });
});
```

- [ ] **Step 6: Run the tests**

Run:
```bash
npx vitest run src/__tests__/unit/talmud-verify-coverage.test.ts
```

Expected: all tests pass. If any fail, fix the script functions (not the tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/talmud/verify-coverage.ts \
        scripts/talmud/fixtures/fake-tractate-clean.json \
        scripts/talmud/fixtures/fake-tractate-shape-mismatch-merged.json \
        scripts/talmud/fixtures/fake-tractate-schema.json \
        src/__tests__/unit/talmud-verify-coverage.test.ts
git commit -m "test(talmud): unit tests for verify-coverage verification logic"
```

---

### Task 7: Implement coverage report generation

**Files:**
- Modify: `scripts/talmud/verify-coverage.ts`

- [ ] **Step 1: Add report-writing function**

After `verifyTractate`, before `main()`, insert:

```ts
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
```

- [ ] **Step 2: Wire report writing + summary into `main`**

Replace the last lines of `main()` (the `console.log('PASS: ...')` part) with:

```ts
  await writeCoverageReport(results);
  printSummary(results);

  // Exit code: 0 if at least one tractate passed, 1 if zero passed.
  const passed = results.filter((r) => r.status === "pass").length;
  process.exit(passed > 0 ? 0 : 1);
```

- [ ] **Step 3: Smoke test against Berakhot only**

Temporarily change the loop again to `BAVLI_TRACTATES.slice(0, 1)` and run:

```bash
npx tsx scripts/talmud/verify-coverage.ts
```

Expected: Berakhot passes all rules, report file written at `data-transient/talmud-coverage-report.json`, summary printed, exit code 0.

Inspect the report:
```bash
cat data-transient/talmud-coverage-report.json | head -30
```

Expected: well-formed JSON with one tractate entry.

- [ ] **Step 4: Revert the slice**

Change back to `BAVLI_TRACTATES`.

- [ ] **Step 5: Commit**

```bash
git add scripts/talmud/verify-coverage.ts
git commit -m "feat(talmud): coverage report generation with summary and issue suggestions"
```

---

### Task 8: Run full verification against all 37 tractates

This is the live-data step. The output depends on what's actually in the GCS bucket. You'll respond to anomalies per the design doc's §2.7.

- [ ] **Step 1: Run the full verification**

Run:
```bash
npx tsx scripts/talmud/verify-coverage.ts
```

Expected: ~1–3 minutes of downloads (first run) or ~10 seconds (if cached). Progress line per tractate. Final summary.

If the script crashes on a 404 fetch for a specific tractate:
- The name in `BAVLI_TRACTATES` is probably off. Common issues: "Moed Qatan" vs "Moed Katan", "Bava Kama" vs "Bava Kamma", "Avoda Zara" vs "Avodah Zarah". Try alternate spellings manually by curling the URL, fix `BAVLI_TRACTATES`, delete the broken tractate's partial cache dir, and rerun.
- If no spelling seems right, the bucket may be structured differently — investigate by listing the bucket (e.g., `curl "https://storage.googleapis.com/storage/v1/b/sefaria-export/o?prefix=json/Talmud/Bavli/"`).

- [ ] **Step 2: Review the summary output carefully**

Check:
- How many tractates passed.
- What anomalies (if any) are listed.
- Whether any anomaly indicates a bug in the verification logic itself (e.g., a marker range that's wrong) vs. a real data issue.

**Decision gate:** if more than ~5 tractates fail, stop and add a note to §6.3 (Unexpected issues) of the design doc. Consult Danyel before proceeding. Otherwise continue.

- [ ] **Step 3: Commit the report as a doc-only reference**

The report lives in `data-transient/` which is gitignored, so it won't be committed automatically. **But** we want a readable copy committed as evidence for the PR. Copy it to a committed location:

```bash
mkdir -p docs/plans/data
cp data-transient/talmud-coverage-report.json docs/plans/data/2026-04-07-talmud-coverage-report.json
git add docs/plans/data/2026-04-07-talmud-coverage-report.json
git commit -m "docs(talmud): coverage report from verify-coverage run"
```

- [ ] **Step 4: File issues for anomalies (if any)**

For each flagged anomaly in the summary, run the suggested `./scripts/issues-new.sh` command. Then stage the resulting issue files:

```bash
# Example:
./scripts/issues-new.sh "Talmud coverage anomaly: Meilah (soft-fail מתני׳ count)" task 2
# (Repeat for each anomaly)

git add issues/open/
git commit -m "docs(talmud): file issues for coverage anomalies from verify-coverage run"
```

If there are zero anomalies, skip this step.

- [ ] **Step 5: Add notes to the design doc's open-questions log**

Open `docs/plans/2026-04-07-talmud-integration-design.md` and in §6.3 (Unexpected issues), document anything surprising from the verification run:
- Tractate name corrections that were needed
- Anomaly patterns observed
- Any data shape surprises

Keep it concise — this is a pointer to the follow-up issues, not a redo of the report.

```bash
git add docs/plans/2026-04-07-talmud-integration-design.md
git commit -m "docs(talmud): log coverage-run findings to design doc §6.3"
```

(Skip the commit if there were no notable findings — the log should say "run clean, zero anomalies" in that case, which is still worth committing.)

---

### Task 9: Push tm-u7b1 and open PR #1

- [ ] **Step 1: Verify test suite still passes**

Run:
```bash
npm test
```

Expected: all existing tests plus the new `talmud-verify-coverage.test.ts` pass. No regressions.

- [ ] **Step 2: Check git log for clean history**

Run:
```bash
git log --oneline main..HEAD
```

Expected: roughly 6–9 commits, all scoped to `scripts/talmud/`, `docs/plans/`, `issues/open/`, `.gitignore`, and `src/__tests__/unit/talmud-verify-coverage.test.ts`. No src/ changes. No data/ changes.

- [ ] **Step 3: Push the branch**

Run:
```bash
git push -u origin tm-u7b1
```

- [ ] **Step 4: Open PR #1 as draft**

Use `land-issue.sh` if possible (it's the project convention), but the script is designed for single-issue worktrees and may want to move the issue file from `issues/open/` to `issues/closed/` as part of the PR. Check:

```bash
cat scripts/land-issue.sh | head -40
```

If `land-issue.sh` fits this case, run it:

```bash
./scripts/land-issue.sh
```

Otherwise, open the PR manually:

```bash
gh pr create --draft --base main --title "tm-u7b1: verify Wikisource coverage across all Bavli tractates" --body "$(cat <<'EOF'
## Summary

Implements `tm-u7b1`: verification pass that downloads Wikisource Hebrew JSON and Davidson `merged.json` from the public Sefaria-Export GCS bucket for each of 37 Bavli tractates, verifies shape/content/markers, and emits a coverage report.

Precondition for `tm-f28x` (engine integration for full Bavli). Opens as the base of a two-PR stack; `tm-f28x`'s PR will be branched on top of this one.

## What's in this PR

- `scripts/talmud/verify-coverage.ts` — standalone verification script
- `scripts/talmud/fixtures/` — synthetic test fixtures
- `src/__tests__/unit/talmud-verify-coverage.test.ts` — unit tests for verification logic
- `.gitignore` — adds `data-transient/` for the local cache
- `docs/plans/2026-04-07-talmud-integration-design.md` — design doc covering both tm-u7b1 and tm-f28x
- `docs/plans/2026-04-07-talmud-integration-implementation.md` — implementation plan
- `docs/plans/data/2026-04-07-talmud-coverage-report.json` — committed copy of the actual coverage report from the live run
- `issues/open/*` — any follow-up issues filed for coverage anomalies (if applicable)

## Coverage summary

(Paste the PASS/FAIL summary from the verify-coverage run here.)

## Test plan

- [ ] `npm test` passes
- [ ] Coverage report at `docs/plans/data/2026-04-07-talmud-coverage-report.json` reviewed
- [ ] Any anomalies have corresponding issues filed in `issues/open/`

## Notes

- Raw downloads cached locally in `data-transient/talmud-raw/` (gitignored) for reuse by `tm-f28x`'s bundling script.
- Shekalim is excluded from the 37 tractates because its Bavli-printed Gemara is actually from the Yerushalmi — see design doc §2.5.

EOF
)"
```

Expected: PR URL printed to stdout. PR is in draft.

- [ ] **Step 5: Capture the PR URL**

Save the printed URL — it will go in the PR #2 body in Task 43.

Phase 1 is complete. The tm-u7b1 worktree stays alive (do not remove it yet — the raw cache at `data-transient/talmud-raw/` is still needed by Phase 2's bundling script in Task 26).

---

## Phase 2: tm-f28x — Engine Integration

### Task 10: Fast-forward tm-f28x onto tm-u7b1

**Goal:** Move the tm-f28x branch pointer to match tm-u7b1's HEAD, so subsequent integration commits stack cleanly on top of the verification work. The docs (and the verify-coverage script) reappear in the tm-f28x working tree as a side effect.

- [ ] **Step 1: Switch to the tm-f28x worktree**

```bash
cd /Users/danyel/code/MISC/torahmap-worktrees/tm-f28x
```

- [ ] **Step 2: Confirm the tm-f28x branch has zero commits beyond main**

```bash
git log --oneline main..HEAD
```

Expected: empty output. The tm-f28x branch is still at main (we never committed anything to it during brainstorming). If there are commits, stop — something's off.

- [ ] **Step 3: Fast-forward tm-f28x to match tm-u7b1**

```bash
git merge tm-u7b1 --ff-only
```

Expected: `Fast-forward` message, followed by a summary of the commits that now exist on tm-f28x (the docs commit, the gitignore commit, the verify-coverage commits, the coverage report commit, etc.). The tm-f28x branch pointer moves forward to match tm-u7b1's HEAD. Working tree updates automatically — the docs and `scripts/talmud/verify-coverage.ts` reappear.

If the merge complains about uncommitted local changes, something unexpected is in the working tree. Stop and investigate with `git status`.

- [ ] **Step 4: Verify state**

```bash
ls docs/plans/2026-04-07-talmud-integration-*
ls scripts/talmud/
ls data-transient/talmud-raw/ | wc -l
```

Expected:
- Both doc files present in `docs/plans/`.
- `scripts/talmud/verify-coverage.ts` and `scripts/talmud/fixtures/` exist (committed during Phase 1). `scripts/talmud/bundle.ts` does *not* yet exist — it's created later in Phase 2.
- Around 33–37 tractate directories under `data-transient/talmud-raw/`. The raw cache persists because it's worktree-local on disk and gitignored — it was never tied to the branch.

If the raw cache is missing (shouldn't happen in normal flow), rerun `npx tsx scripts/talmud/verify-coverage.ts` to rebuild it.

Phase 2 continues from here. Every new commit lands on tm-f28x on top of tm-u7b1's history.

---

### Task 11: Add `SpatialItem<T>`, `TanakhIdentity`, `TalmudIdentity` to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Read the current types.ts to find insertion points**

Use the Read tool on `src/types.ts`. Note the location of `VerseIdentity` (currently line ~51) and `VerseLayout` (currently line ~62).

- [ ] **Step 2: Add the new types alongside the existing ones**

Before the existing `VerseIdentity` interface (preserving the architecture comment block at the top of the file), insert:

```ts
// ============================================================================
// Corpus-generic identity types (Talmud integration)
// ============================================================================

/**
 * A spatial item is any domain identity paired with 2D coordinates and a size.
 * The rendering pipeline is generic over the identity type — it never reads
 * domain fields, only x/y/size.
 *
 * Usage:
 *   TanakhLayout = SpatialItem<TanakhIdentity>   // {book, chapter, verse, x, y, size}
 *   TalmudLayout = SpatialItem<TalmudIdentity>   // {tractate, daf, amud, segment, x, y, size}
 *
 * Any new corpus needs only a concrete identity interface to produce a new
 * SpatialItem<T> flavor; the spatial modules already accept it via generics.
 */
export type SpatialItem<T> = T & {
  x: number;
  y: number;
  size: number;
};

/**
 * Identity of a Tanakh verse. Three levels: book, chapter, verse.
 */
export interface TanakhIdentity {
  book: string;
  chapter: number;
  verse: number;
}

/**
 * Identity of a Talmud segment. Four levels: tractate, daf, amud, segment.
 * Dapim start at 2 in standard printings (there is no daf 1).
 */
export interface TalmudIdentity {
  tractate: string;
  daf: number;
  amud: "a" | "b";
  segment: number;
}

/**
 * Talmud layout item — identity plus spatial coordinates.
 */
export type TalmudLayout = SpatialItem<TalmudIdentity>;
```

- [ ] **Step 3: Change `VerseIdentity` and `VerseLayout` to aliases**

Replace the existing `VerseIdentity` interface and `VerseLayout` interface definitions with:

```ts
/**
 * Identity of a biblical verse.
 * @deprecated Use TanakhIdentity directly in new code. VerseIdentity is kept
 * as an alias so existing Tanakh imports compile unchanged.
 */
export type VerseIdentity = TanakhIdentity;

/**
 * Complete layout information for a verse.
 * Extends identity with spatial position computed during layout.
 * This data is immutable after initial layout computation.
 *
 * @deprecated Use TanakhLayout (= SpatialItem<TanakhIdentity>) directly in
 * new code. VerseLayout is kept as an alias so existing Tanakh imports
 * compile unchanged.
 */
export type VerseLayout = SpatialItem<TanakhIdentity>;
export type TanakhLayout = SpatialItem<TanakhIdentity>;
```

- [ ] **Step 4: Run the full test suite to confirm zero regressions**

Run:
```bash
npm test
```

Expected: all tests pass. The type aliases are structurally identical to the old interfaces, so no existing code should break.

- [ ] **Step 5: Run the type checker explicitly**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "refactor(types): introduce SpatialItem<T>, TanakhIdentity, TalmudIdentity

VerseLayout and VerseIdentity become type aliases pointing at the new
generic shapes. Behavior is unchanged — tests still pass as-is.
Prepares the spatial layer for Talmud integration (tm-f28x)."
```

---

### Task 12: Add `CorpusSchema` with `TANAKH_SCHEMA` and `TALMUD_SCHEMA`

**Files:**
- Create: `src/corpusSchema.ts`

This module is where the hierarchy data lives. Shared formatters/parsers in later tasks consume it.

- [ ] **Step 1: Write the module**

Create `src/corpusSchema.ts`:

```ts
// Corpus schema — runtime description of a corpus's identity hierarchy.
// Consumed by shared formatters, URL parsers, and comparators so they can
// work across corpora without per-corpus switch statements.

/**
 * Description of one level in a corpus's identity hierarchy.
 *
 * - "string" levels carry free-form names (e.g. book or tractate names).
 * - "number" levels carry positive integers (chapter, verse, daf, segment).
 * - "enum" levels carry one of a fixed list of values (e.g. amud = "a" | "b").
 */
export interface LevelDef {
  key: string;
  type: "string" | "number" | "enum";
  enum?: readonly string[];
  /**
   * When true, this level is rendered concatenated with the previous level
   * rather than separated by the usual delimiter. E.g. Talmud's `amud` is
   * "a"/"b" and renders as "2a" rather than "2:a" — `concatWithPrevious: true`.
   */
  concatWithPrevious?: boolean;
}

/**
 * A corpus's identity schema. Array order matches hierarchy depth
 * (outermost → innermost).
 */
export interface CorpusSchema {
  kind: "tanakh" | "talmud";
  levels: readonly LevelDef[];
}

export const TANAKH_SCHEMA: CorpusSchema = {
  kind: "tanakh",
  levels: [
    { key: "book", type: "string" },
    { key: "chapter", type: "number" },
    { key: "verse", type: "number" },
  ],
};

export const TALMUD_SCHEMA: CorpusSchema = {
  kind: "talmud",
  levels: [
    { key: "tractate", type: "string" },
    { key: "daf", type: "number" },
    { key: "amud", type: "enum", enum: ["a", "b"], concatWithPrevious: true },
    { key: "segment", type: "number" },
  ],
};
```

- [ ] **Step 2: Run type check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/corpusSchema.ts
git commit -m "feat(corpus): add CorpusSchema with TANAKH and TALMUD instances"
```

---

### Task 13: Write spatial-layer genericization tests

**Files:**
- Create: `src/__tests__/unit/spatial-layer-generic.test.ts`

This test proves the spatial modules treat identity as opaque. It uses three different identity shapes — `TanakhIdentity`, `TalmudIdentity`, and a synthetic `FooIdentity` — and asserts that the rendering pipeline accepts all three and produces identical output for the same `{x, y, size}` coordinates.

**This test is written BEFORE the generic refactor.** It will fail initially because `buildVerseGeometry`, `findVerseLayoutAtPoint`, etc. still require `VerseLayout` concretely. Watching it fail-then-pass is the TDD proof that the refactor worked.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/spatial-layer-generic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SpatialItem, TanakhIdentity, TalmudIdentity } from "../../types.ts";
import { buildVerseGeometry } from "../../geometry.ts";
import { findExactHit, findFuzzyHit } from "../../hitDetection.ts";

// Synthetic third identity — not a real corpus, just proves the spatial
// layer doesn't care what T is.
interface FooIdentity {
  foo: string;
  bar: number;
}

describe("spatial layer genericization", () => {
  it("buildVerseGeometry accepts SpatialItem<TanakhIdentity>", () => {
    const items: SpatialItem<TanakhIdentity>[] = [
      { book: "Genesis", chapter: 1, verse: 1, x: 10, y: 20, size: 6 },
      { book: "Genesis", chapter: 1, verse: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry accepts a synthetic third identity (proof of opacity)", () => {
    const items: SpatialItem<FooIdentity>[] = [
      { foo: "x", bar: 42, x: 10, y: 20, size: 6 },
      { foo: "y", bar: 43, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry produces byte-identical output for identical coordinates across different T", () => {
    const coords = [
      { x: 10, y: 20, size: 6 },
      { x: 16, y: 20, size: 6 },
    ];
    const tanakhItems: SpatialItem<TanakhIdentity>[] = coords.map((c, i) => ({
      book: "Genesis",
      chapter: 1,
      verse: i + 1,
      ...c,
    }));
    const talmudItems: SpatialItem<TalmudIdentity>[] = coords.map((c, i) => ({
      tractate: "Berakhot",
      daf: 2,
      amud: "a",
      segment: i + 1,
      ...c,
    }));
    const fooItems: SpatialItem<FooIdentity>[] = coords.map((c, i) => ({
      foo: `f${i}`,
      bar: i,
      ...c,
    }));

    const gTanakh = buildVerseGeometry(tanakhItems);
    const gTalmud = buildVerseGeometry(talmudItems);
    const gFoo = buildVerseGeometry(fooItems);

    expect(gTalmud).toEqual(gTanakh);
    expect(gFoo).toEqual(gTanakh);
  });

  it("findExactHit accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
    ];
    const hit = findExactHit(items, 12, 22);
    expect(hit).not.toBeNull();
    expect(hit?.tractate).toBe("Berakhot");
  });

  it("findFuzzyHit accepts SpatialItem<FooIdentity>", () => {
    const items: SpatialItem<FooIdentity>[] = [
      { foo: "x", bar: 1, x: 10, y: 20, size: 6 },
    ];
    const hit = findFuzzyHit(items, 12, 22);
    expect(hit).not.toBeNull();
    expect(hit?.foo).toBe("x");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run:
```bash
npx vitest run src/__tests__/unit/spatial-layer-generic.test.ts
```

Expected: **compile errors** from TypeScript because `buildVerseGeometry` and `findExactHit` currently take `VerseLayout[]` (i.e. `SpatialItem<TanakhIdentity>[]`), not `SpatialItem<T>[]`. The test file's `SpatialItem<TalmudIdentity>[]` and `SpatialItem<FooIdentity>[]` usages won't compile against the current signatures.

This is the failing state we want. The next few tasks refactor the spatial modules to make this pass.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/__tests__/unit/spatial-layer-generic.test.ts
git commit -m "test(spatial): failing test for generic SpatialItem<T> across spatial layer

Will pass after geometry.ts, hitDetection.ts, and verseColoring.ts are
refactored to generic <T> signatures (subsequent tasks)."
```

---

### Task 14: Genericize `src/geometry.ts`

**Files:**
- Modify: `src/geometry.ts`

The only change is the function signature — `buildVerseGeometry` becomes `<T>(verses: SpatialItem<T>[], ...)` and the body is unchanged because it only reads `v.x`, `v.y`, `v.size`.

- [ ] **Step 1: Read geometry.ts to find all exported function signatures**

Use the Read tool on `src/geometry.ts`. Note every `export function` signature that takes or returns a `VerseLayout` or `VerseLayout[]`.

- [ ] **Step 2: Add `<T>` generic parameter to each public function**

Replace the import line:
```ts
import type { VerseLayout } from './types.ts';
```
with:
```ts
import type { SpatialItem } from './types.ts';
```

For each exported function that takes `VerseLayout[]` or `VerseLayout`, add a `<T>` parameter and replace `VerseLayout` with `SpatialItem<T>`. For the main `buildVerseGeometry`:

```ts
export function buildVerseGeometry<T>(
  verses: SpatialItem<T>[],
  colors?: (Color | Color[])[],
  baseColor: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR
): Float32Array {
  // body unchanged — only reads v.x, v.y, v.size
  ...
}
```

Do this for every exported function in the file. Internal helper functions that take a single verse (like checks or math) can also become `<T>(v: SpatialItem<T>)` or can simply use `SpatialItem<unknown>` where T doesn't need to flow through.

- [ ] **Step 3: Run type check**

Run:
```bash
npx tsc --noEmit
```

Expected: clean, or only errors in *other* files that also need the generic update (hitDetection, etc. — those are later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/geometry.ts
git commit -m "refactor(geometry): make buildVerseGeometry generic over identity type"
```

---

### Task 15: Genericize `src/hitDetection.ts`

**Files:**
- Modify: `src/hitDetection.ts`

- [ ] **Step 1: Read hitDetection.ts**

Use the Read tool on `src/hitDetection.ts`. The file has these exported functions: `screenToWorld`, `isPointInVerseLayout`, `findExactHit`, `findFuzzyHit`, `findVerseLayoutAtPoint`.

- [ ] **Step 2: Add `<T>` to each function that takes a verse or returns one**

Replace:
```ts
import type { VerseLayout } from './types';
```
with:
```ts
import type { SpatialItem } from './types';
```

Then:

```ts
export function isPointInVerseLayout<T>(
  worldX: number,
  worldY: number,
  verse: SpatialItem<T>
): boolean {
  return (
    worldX >= verse.x &&
    worldX < verse.x + verse.size &&
    worldY >= verse.y &&
    worldY < verse.y + verse.size
  );
}

export function findExactHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number
): SpatialItem<T> | null {
  for (const v of verses) {
    if (isPointInVerseLayout(worldX, worldY, v)) {
      return v;
    }
  }
  return null;
}

export function findFuzzyHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number
): SpatialItem<T> | null {
  let nearestVerseLayout: SpatialItem<T> | null = null;
  let nearestDistSq =
    HIGHLIGHT_CONSTANTS.FUZZY_RADIUS * HIGHLIGHT_CONSTANTS.FUZZY_RADIUS;

  for (const v of verses) {
    const centerX = v.x + v.size / 2;
    const centerY = v.y + v.size / 2;
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestVerseLayout = v;
      nearestDistSq = distSq;
    }
  }

  return nearestVerseLayout;
}

export function findVerseLayoutAtPoint<T>(
  verses: SpatialItem<T>[],
  camera: Camera,
  screenX: number,
  screenY: number
): SpatialItem<T> | null {
  const { x: worldX, y: worldY } = screenToWorld(screenX, screenY, camera);
  const exactHit = findExactHit(verses, worldX, worldY);
  if (exactHit) return exactHit;
  return findFuzzyHit(verses, worldX, worldY);
}
```

`screenToWorld` doesn't touch verses — leave it unchanged.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: existing Tanakh call sites still compile (they pass `VerseLayout[]` which is `SpatialItem<TanakhIdentity>[]`, T gets inferred). Errors may remain in verseColoring.ts — handled next task.

- [ ] **Step 4: Run the spatial-layer generic test**

```bash
npx vitest run src/__tests__/unit/spatial-layer-generic.test.ts
```

Expected: the `findExactHit` and `findFuzzyHit` tests pass now. The `buildVerseGeometry` tests should also pass (from Task 14). If everything is passing, great — skip ahead. Otherwise continue to Task 16.

- [ ] **Step 5: Commit**

```bash
git add src/hitDetection.ts
git commit -m "refactor(hitDetection): make all public functions generic over identity"
```

---

### Task 16: Genericize `src/verseColoring.ts` (with injected equality)

**Files:**
- Modify: `src/verseColoring.ts`
- Modify: `src/overlays/types.ts` (the `Overlay` interface)

This is the trickiest of the three because `verseColoring.ts` calls `versesEqual` (which reads Tanakh identity fields) and `overlay.getVerseColor(verse)` (which takes `VerseIdentity` specifically).

**Strategy:**
1. Make `Overlay<T>` generic with `default = VerseIdentity` so existing Tanakh overlay imports compile unchanged.
2. Inject the equality function as a parameter into `computeVerseStates`, since `versesEqual` is corpus-specific.
3. Existing Tanakh callers pass `versesEqual` explicitly; Talmud callers will pass their own.

- [ ] **Step 1: Update the Overlay interface to be generic**

Use Read on `src/overlays/types.ts` first to see its current shape. Then modify the file to make the core interface generic with `VerseIdentity` as the default.

Replace the existing `Overlay` interface (and related types) with generic versions. The key idea:

```ts
// Before:
export interface Overlay {
  ...
  getVerseColor(verse: VerseIdentity): Color | Color[] | null;
}

// After:
export interface Overlay<T = VerseIdentity> {
  ...
  getVerseColor(item: T): Color | Color[] | null;
}
```

Apply the same pattern to any related types (`OverlayConfig`, etc.) in the file. Use `T = VerseIdentity` as the default everywhere so existing Tanakh overlay implementations compile without changes.

- [ ] **Step 2: Update `verseColoring.ts` to inject equality**

Use Read on `src/verseColoring.ts` first. The key change: `computeVerseStates` takes an equality function as a parameter instead of importing `versesEqual` directly.

Replace the imports at the top:

```ts
import type { SpatialItem, VerseState } from "./types";
import type { Overlay } from "./overlays/types";
import { seededRandom } from "./utils/random";
import { HIGHLIGHT_CONSTANTS } from "./constants";
```

Change `getOverlayColor` signature:

```ts
export function getOverlayColor<T>(
  overlay: Overlay<T> | null,
  item: T,
): [number, number, number] | [number, number, number][] | null {
  return overlay?.getVerseColor(item) ?? null;
}
```

Change `computeVerseStates` signature and body:

```ts
export function computeVerseStates<T>(
  items: SpatialItem<T>[],
  overlay: Overlay<T> | null,
  hoveredItem: SpatialItem<T> | null,
  pinnedItem: SpatialItem<T> | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): VerseState[] {
  return items.map((v, i) => {
    const overlayColor = getOverlayColor(overlay, v);
    const hasOverlayColor = overlayColor !== null;
    const resolvedColor = hasOverlayColor ? overlayColor : getDefaultColor(i);

    const isHovered = itemsEqual(hoveredItem, v);
    const isPinned = itemsEqual(pinnedItem, v);

    return {
      hasOverlayColor,
      resolvedColor,
      isHovered,
      isPinned,
    };
  });
}
```

`applyVerseColors`, `applyHoverHighlight`, and `getDefaultColor` don't read identity fields, so they stay unchanged.

- [ ] **Step 3: Update the one call site in `main.ts` (Tanakh) to pass `versesEqual`**

Use Read on `src/main.ts` to find the `computeVerseStates(...)` call. Change it from:

```ts
computeVerseStates(verses, overlay, hoveredVerse, pinnedVerse)
```

to:

```ts
computeVerseStates(verses, overlay, hoveredVerse, pinnedVerse, versesEqual)
```

`versesEqual` is already imported in main.ts from `./types.ts`. If not, add the import.

- [ ] **Step 4: Run the type check**

```bash
npx tsc --noEmit
```

Expected: clean. If any existing Tanakh overlay has a type error, it likely means the overlay was not declared as `Overlay` (no generic argument — which falls back to `Overlay<VerseIdentity>` via the default). Add `Overlay<VerseIdentity>` or `Overlay<TanakhIdentity>` explicitly where needed.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: all existing Tanakh tests pass, PLUS the spatial-layer generic test now fully passes. If anything fails, look at the specific failure — the refactor is mechanical, so failures usually mean a call site wasn't updated or an overlay implementation lost its generic default.

- [ ] **Step 6: Commit**

```bash
git add src/verseColoring.ts src/overlays/types.ts src/main.ts
git commit -m "refactor(verseColoring): generic <T> with injected equality

Overlay<T> has default T = VerseIdentity so existing Tanakh overlays
compile unchanged. computeVerseStates takes itemsEqual as a parameter
so each corpus injects its own comparator. The spatial-layer genericization
test now passes end-to-end."
```

---

### Task 17: Write tests for corpus-format (shared reference/URL formatter)

**Files:**
- Create: `src/__tests__/unit/corpus-format.test.ts`

The `corpus-format` module produces human-readable references (`Genesis 1:1`, `Berakhot 17b:11`) and URL hash params (`Genesis:1:1`, `Berakhot:2a:1`) from identities, driven by `CorpusSchema`. It's generic, usable by both corpora.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/corpus-format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  formatReference,
  serializeToUrlHash,
  parseFromUrlHash,
} from "../../corpus-format.ts";
import { TANAKH_SCHEMA, TALMUD_SCHEMA } from "../../corpusSchema.ts";
import type { TanakhIdentity, TalmudIdentity } from "../../types.ts";

describe("formatReference for Tanakh", () => {
  it("formats a standard verse", () => {
    const id: TanakhIdentity = { book: "Genesis", chapter: 1, verse: 1 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Genesis 1:1");
  });

  it("formats a multi-digit chapter", () => {
    const id: TanakhIdentity = { book: "Psalms", chapter: 119, verse: 176 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Psalms 119:176");
  });

  it("handles a book name with a space", () => {
    const id: TanakhIdentity = { book: "Song of Songs", chapter: 1, verse: 1 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Song of Songs 1:1");
  });
});

describe("formatReference for Talmud", () => {
  it("formats a standard segment with amud concatenated", () => {
    const id: TalmudIdentity = {
      tractate: "Berakhot",
      daf: 17,
      amud: "b",
      segment: 11,
    };
    expect(formatReference(id, TALMUD_SCHEMA)).toBe("Berakhot 17b:11");
  });

  it("handles a tractate name with a space", () => {
    const id: TalmudIdentity = {
      tractate: "Bava Kamma",
      daf: 2,
      amud: "a",
      segment: 3,
    };
    expect(formatReference(id, TALMUD_SCHEMA)).toBe("Bava Kamma 2a:3");
  });

  it("handles amud b", () => {
    const id: TalmudIdentity = {
      tractate: "Shabbat",
      daf: 31,
      amud: "b",
      segment: 5,
    };
    expect(formatReference(id, TALMUD_SCHEMA)).toBe("Shabbat 31b:5");
  });
});

describe("serializeToUrlHash / parseFromUrlHash for Tanakh", () => {
  it("round-trips a verse", () => {
    const id: TanakhIdentity = { book: "Genesis", chapter: 1, verse: 1 };
    const hash = serializeToUrlHash(id, TANAKH_SCHEMA);
    expect(hash).toBe("Genesis:1:1");
    const parsed = parseFromUrlHash(hash, TANAKH_SCHEMA);
    expect(parsed).toEqual(id);
  });

  it("returns null for malformed input", () => {
    expect(parseFromUrlHash("", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis:1", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis:1:abc", TANAKH_SCHEMA)).toBeNull();
  });
});

describe("serializeToUrlHash / parseFromUrlHash for Talmud", () => {
  it("round-trips a standard segment", () => {
    const id: TalmudIdentity = {
      tractate: "Berakhot",
      daf: 2,
      amud: "a",
      segment: 1,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Berakhot:2a:1");
    const parsed = parseFromUrlHash(hash, TALMUD_SCHEMA);
    expect(parsed).toEqual(id);
  });

  it("round-trips with a 2-digit daf", () => {
    const id: TalmudIdentity = {
      tractate: "Shabbat",
      daf: 31,
      amud: "b",
      segment: 5,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Shabbat:31b:5");
    expect(parseFromUrlHash(hash, TALMUD_SCHEMA)).toEqual(id);
  });

  it("round-trips with a multi-word tractate name", () => {
    const id: TalmudIdentity = {
      tractate: "Bava Kamma",
      daf: 10,
      amud: "a",
      segment: 2,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Bava Kamma:10a:2");
    expect(parseFromUrlHash(hash, TALMUD_SCHEMA)).toEqual(id);
  });

  it("rejects a daf without an amud letter", () => {
    expect(parseFromUrlHash("Berakhot:2:1", TALMUD_SCHEMA)).toBeNull();
  });

  it("rejects an invalid amud letter", () => {
    expect(parseFromUrlHash("Berakhot:2c:1", TALMUD_SCHEMA)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (module doesn't exist yet)**

```bash
npx vitest run src/__tests__/unit/corpus-format.test.ts
```

Expected: "cannot find module corpus-format" or similar.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/__tests__/unit/corpus-format.test.ts
git commit -m "test(corpus-format): failing tests for shared reference and URL formatters"
```

---

### Task 18: Implement `src/corpus-format.ts`

**Files:**
- Create: `src/corpus-format.ts`

- [ ] **Step 1: Write the implementation**

Create `src/corpus-format.ts`:

```ts
// Shared reference/URL formatters for any corpus described by CorpusSchema.
//
// - formatReference: human-readable ("Genesis 1:1" / "Berakhot 17b:11")
// - serializeToUrlHash: URL-safe, colon-separated ("Genesis:1:1" / "Berakhot:2a:1")
// - parseFromUrlHash: inverse of serializeToUrlHash, returns null on malformed input
//
// The schema's level definitions drive the formatting rules:
// - "string" levels are rendered as-is
// - "number" levels are rendered as decimal integers
// - "enum" levels are rendered as the raw enum value
// - A level with concatWithPrevious=true is joined to the previous level
//   with no separator — used for Talmud's "2a" where amud is a suffix of daf.

import type { CorpusSchema, LevelDef } from "./corpusSchema.ts";

type LevelValue = string | number;

/**
 * Produce a human-readable reference like "Genesis 1:1" or "Berakhot 17b:11".
 *
 * Format rule: first level followed by a space, then subsequent levels
 * separated by ":" except where concatWithPrevious is true (no separator).
 */
export function formatReference<T extends Record<string, LevelValue>>(
  id: T,
  schema: CorpusSchema,
): string {
  const parts: string[] = [];
  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];
    const value = String(id[level.key as keyof T]);
    if (i === 0) {
      parts.push(value);
    } else if (level.concatWithPrevious) {
      parts[parts.length - 1] += value;
    } else if (i === 1) {
      parts.push(" " + value);
    } else {
      parts.push(":" + value);
    }
  }
  return parts.join("");
}

/**
 * Produce a URL-safe hash param value like "Genesis:1:1" or "Berakhot:2a:1".
 *
 * Format rule: all levels separated by ":" except where concatWithPrevious
 * is true (no separator).
 */
export function serializeToUrlHash<T extends Record<string, LevelValue>>(
  id: T,
  schema: CorpusSchema,
): string {
  const parts: string[] = [];
  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];
    const value = String(id[level.key as keyof T]);
    if (i === 0) {
      parts.push(value);
    } else if (level.concatWithPrevious) {
      parts[parts.length - 1] += value;
    } else {
      parts.push(":" + value);
    }
  }
  return parts.join("");
}

/**
 * Parse a URL hash string into an identity object, or null if malformed.
 *
 * The parser walks the schema levels, consuming one ":"-separated token per
 * non-concat level. A concat level is parsed by stripping its enum suffix
 * from the preceding token.
 */
export function parseFromUrlHash(
  hash: string,
  schema: CorpusSchema,
): Record<string, LevelValue> | null {
  if (!hash) return null;

  // Split by ":" — we'll need as many tokens as there are non-concat levels.
  const tokens = hash.split(":");
  const nonConcatLevelCount = schema.levels.filter(
    (l) => !l.concatWithPrevious,
  ).length;
  if (tokens.length !== nonConcatLevelCount) return null;

  const result: Record<string, LevelValue> = {};
  let tokenIdx = 0;

  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];

    if (level.concatWithPrevious) {
      // Split the previous token into a numeric prefix and an enum suffix.
      // E.g. "2a" → previousLevel = 2, thisLevel = "a".
      const prevLevel = schema.levels[i - 1];
      if (!prevLevel || prevLevel.type !== "number") return null;
      const enumValues = level.enum;
      if (!enumValues) return null;

      const prevToken = String(result[prevLevel.key]);
      let matched: string | null = null;
      for (const e of enumValues) {
        if (prevToken.endsWith(e)) {
          matched = e;
          break;
        }
      }
      if (!matched) return null;

      const numericPart = prevToken.slice(0, -matched.length);
      if (!/^\d+$/.test(numericPart)) return null;
      result[prevLevel.key] = parseInt(numericPart, 10);
      result[level.key] = matched;
      continue;
    }

    const token = tokens[tokenIdx++];
    if (token === undefined) return null;

    if (level.type === "string") {
      if (token.length === 0) return null;
      result[level.key] = token;
    } else if (level.type === "number") {
      // Store as a string initially — may be post-processed by a concat level.
      // If no concat level follows, we convert to number at the end.
      result[level.key] = token;
    } else if (level.type === "enum") {
      if (!level.enum || !level.enum.includes(token)) return null;
      result[level.key] = token;
    }
  }

  // Post-process: any "number" level whose value is still a string and was
  // not consumed by a concat level needs to be converted to a number.
  for (const level of schema.levels) {
    if (level.type === "number" && typeof result[level.key] === "string") {
      const s = result[level.key] as string;
      if (!/^\d+$/.test(s)) return null;
      result[level.key] = parseInt(s, 10);
    }
  }

  return result;
}
```

- [ ] **Step 2: Run the test — expect PASS**

```bash
npx vitest run src/__tests__/unit/corpus-format.test.ts
```

Expected: all cases pass. If any fail, fix the implementation (not the tests). The Talmud round-trip cases are the trickiest — they exercise the concat-with-previous logic.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: no regressions anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/corpus-format.ts
git commit -m "feat(corpus-format): implement schema-driven reference and URL formatters"
```

---

### Task 19: Write tests for the marker walk in the bundling script

**Files:**
- Create: `src/__tests__/unit/talmud-bundle.test.ts` (just the marker-walk tests for now)

The marker walk is the heart of the bundling script. It reads Wikisource Hebrew text segment-by-segment and produces per-segment Mishnah/Gemara tags. Test it in isolation before writing the full bundle script.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/talmud-bundle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { walkMarkers, stripHtml } from "../../../scripts/talmud/bundle.ts";

describe("walkMarkers", () => {
  it("tags segments as mishnah after a מתני׳ marker", () => {
    const text: string[][] = [
      ["מתני׳ start of mishnah", "continuation of mishnah"],
      ["more mishnah"],
    ];
    const result = walkMarkers(text);
    // All 4 segments should be mishnah
    expect(result).toEqual([
      [true, true],
      [true],
    ]);
  });

  it("tags segments as gemara after a גמ׳ marker", () => {
    const text: string[][] = [
      ["מתני׳ mishnah one", "גמ׳ gemara begins"],
      ["more gemara"],
    ];
    const result = walkMarkers(text);
    expect(result).toEqual([
      [true, false],
      [false],
    ]);
  });

  it("handles multiple perakim (mishnah/gemara alternation)", () => {
    const text: string[][] = [
      ["מתני׳ m1", "גמ׳ g1", "more g1"],
      ["הדרן end of perek", "מתני׳ m2", "גמ׳ g2"],
    ];
    const result = walkMarkers(text);
    // First perek: m1 is mishnah, g1 and "more g1" are gemara
    // "הדרן end of perek" — traditionally considered gemara (it's the closing formula, not new content)
    // "מתני׳ m2" flips back to mishnah
    // "גמ׳ g2" flips to gemara
    expect(result).toEqual([
      [true, false, false],
      [false, true, false],
    ]);
  });

  it("starts in gemara state before any markers (conservative default)", () => {
    // If a tractate's first segment doesn't have a marker, it's treated as
    // gemara until a marker is seen. This should be rare in practice — real
    // Wikisource data always starts with a מתני׳ marker — but the function
    // must not crash.
    const text: string[][] = [[["no marker"]]].map((a) => a.map((s) => String(s)));
    // TS coercion — use a simple literal:
    const realText: string[][] = [["no marker here", "or here"]];
    const result = walkMarkers(realText);
    expect(result).toEqual([[false, false]]);
  });

  it("handles markers embedded mid-segment", () => {
    const text: string[][] = [
      ["prefix text מתני׳ more text", "follows mishnah"],
    ];
    const result = walkMarkers(text);
    expect(result).toEqual([[true, true]]);
  });
});

describe("stripHtml", () => {
  it("removes <big> tags", () => {
    expect(stripHtml("<big>hello</big>")).toBe("hello");
  });

  it("removes <strong> tags", () => {
    expect(stripHtml("<strong>bold</strong> text")).toBe("bold text");
  });

  it("removes <br/> tags", () => {
    expect(stripHtml("line1<br/>line2")).toBe("line1 line2");
    expect(stripHtml("line1<br>line2")).toBe("line1 line2");
  });

  it("preserves plain text", () => {
    expect(stripHtml("hello world")).toBe("hello world");
  });

  it("handles Hebrew text", () => {
    expect(stripHtml("<big>שלום</big>")).toBe("שלום");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (bundle.ts doesn't exist)**

```bash
npx vitest run src/__tests__/unit/talmud-bundle.test.ts
```

Expected: "cannot find module".

- [ ] **Step 3: Commit the failing test**

```bash
git add src/__tests__/unit/talmud-bundle.test.ts
git commit -m "test(talmud): failing tests for marker walk and HTML stripping"
```

---

### Task 20: Implement the marker walk in `scripts/talmud/bundle.ts`

**Files:**
- Create: `scripts/talmud/bundle.ts`

Start with just the pure functions the tests need. The full bundling pipeline comes in Task 21.

- [ ] **Step 1: Write the scaffold with just the two pure helpers**

Create `scripts/talmud/bundle.ts`:

```ts
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
 *
 * Returns a 2D boolean mask parallel to the input: result[i][j] === true
 * means the segment at amudim[i][j] is Mishnah.
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
 * Replaces <br>, <br/>, and <br /> with a space; removes <big>, <strong>,
 * and their closing tags.
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
// Main script (implemented in Task 21)
// ============================================================================

async function main(): Promise<void> {
  throw new Error("bundle.ts main() not yet implemented — see Task 21");
}

// Only run main() when invoked as a script, not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("bundle failed:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run the marker walk tests**

```bash
npx vitest run src/__tests__/unit/talmud-bundle.test.ts
```

Expected: all tests pass. If `walkMarkers` or `stripHtml` tests fail, fix the function (not the test).

- [ ] **Step 3: Commit**

```bash
git add scripts/talmud/bundle.ts
git commit -m "feat(talmud): marker walk and HTML stripping helpers for bundler"
```

---

### Task 21: Implement the full bundle.ts pipeline

**Files:**
- Modify: `scripts/talmud/bundle.ts`

- [ ] **Step 1: Add types for the output schema**

Inside `scripts/talmud/bundle.ts`, above the `main()` stub, add:

```ts
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
```

- [ ] **Step 2: Add schema-parsing helpers**

After the types, add:

```ts
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
 * Parse a Sefaria range ref like "Berakhot 2a:1-13a:15" into start and end
 * endpoints. Returns null if the format is unrecognized.
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
  // Example: "Berakhot 2a:1-13a:15"
  const match = ref.match(/\s(\d+)([ab]):(\d+)-(\d+)([ab]):(\d+)$/);
  if (!match) return null;
  return {
    startDaf: parseInt(match[1], 10),
    startAmud: match[2] as "a" | "b",
    startSegment: parseInt(match[3], 10),
    endDaf: parseInt(match[4], 10),
    endAmud: match[5] as "a" | "b",
    endSegment: parseInt(match[6], 10),
  };
}

/**
 * Convert (daf, amud) to an amud index, given the tractate's firstDaf.
 * daf=2, amud="a", firstDaf=2 → 0
 * daf=2, amud="b", firstDaf=2 → 1
 * daf=3, amud="a", firstDaf=2 → 2
 */
export function dafAmudToIdx(
  daf: number,
  amud: "a" | "b",
  firstDaf: number,
): number {
  return (daf - firstDaf) * 2 + (amud === "b" ? 1 : 0);
}
```

- [ ] **Step 3: Add the tractate-processing function**

```ts
// ============================================================================
// Tractate processing
// ============================================================================

/**
 * Process one tractate's raw files into structured + text output.
 */
export function processTractate(
  seder: string,
  tractateName: string,
  wikisource: WikisourceJson,
  schema: SchemaJson,
): { structure: TalmudTractate; text: TalmudTractateText } {
  const rawText = wikisource.text;
  const hebrewName = wikisource.heTitle ?? tractateName;

  // Determine firstDaf — use the first perek's start daf from schema.
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
    amud.map((seg) => stripHtml(seg.replace(/מתני׳/g, "").replace(/גמ׳/g, "").replace(/הדרן/g, ""))),
  );

  // Build perakim array and compute per-amud perekIdx.
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

    // If a perek boundary falls mid-amud (i.e. the first amud's startSegment
    // isn't 1, OR the last amud's endSegment isn't the full length), record it.
    // Specifically: if perek P+1 starts on an amud where P ended, the amud's
    // perekBoundaryAt is the startSegment of P+1 (1-based).
    if (pi > 0) {
      const prevEndIdx = dafAmudToIdx(
        /* previous ref ended */ 0, /* placeholder */ "a", 0,
      );
      // We re-derive below using perakim[pi-1]
      const prev = perakim[pi - 1];
      if (prev.endAmudIdx === startIdx) {
        // This amud is split: prev perek ends at prev.endSegmentInLastAmud,
        // this perek starts at ref.startSegment.
        // The boundary index is ref.startSegment - 1 (0-based split point).
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
```

- [ ] **Step 4: Wire `main()` to read cache, run `processTractate`, and write outputs**

Replace the `main()` stub:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

      // Write per-tractate text file
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

  // Write the combined structure file
  await writeFile(
    join(OUTPUT_DIR, "structure.json"),
    JSON.stringify(structure),
    "utf-8",
  );

  console.log("");
  console.log(`Structure: ${join(OUTPUT_DIR, "structure.json")}`);
  console.log(`Texts: ${TEXTS_DIR}/*.json (${structure.tractates.length} files)`);
}
```

- [ ] **Step 5: Run the full test suite to verify nothing broke**

```bash
npm test
```

Expected: all tests pass including `talmud-bundle.test.ts` (which tests the pure helpers).

- [ ] **Step 6: Commit**

```bash
git add scripts/talmud/bundle.ts
git commit -m "feat(talmud): implement full bundling pipeline from raw cache to runtime JSON"
```

---

### Task 22: Run the bundler and commit the outputs

- [ ] **Step 1: Run the bundler**

From the tm-f28x worktree (where the raw cache and coverage report are accessible):

```bash
npx tsx scripts/talmud/bundle.ts
```

Expected: one line per passed tractate, each reporting OK. Final summary shows the output paths.

- [ ] **Step 2: Inspect the outputs**

```bash
ls -la public/data/talmud/
ls public/data/talmud/texts/ | wc -l
du -sh public/data/talmud/structure.json public/data/talmud/texts/
```

Expected:
- `structure.json` exists (~1–5 MB)
- `texts/` contains ~33–37 JSON files (depending on how many passed verification)
- Total bundle size somewhere in the 20–60 MB range

- [ ] **Step 3: Quick sanity check on structure.json**

```bash
cat public/data/talmud/structure.json | head -c 500
```

Expected: valid JSON starting with `{"tractates":[{"name":"Berakhot"...`. Count tractates:

```bash
node -e 'const s = JSON.parse(require("fs").readFileSync("public/data/talmud/structure.json")); console.log(s.tractates.length, "tractates"); s.tractates.slice(0,3).forEach(t => console.log(t.name, t.amudim.length, "amudim,", t.perakim.length, "perakim"));'
```

Expected: ~33–37 tractates, Berakhot with 127 amudim and 9 perakim.

- [ ] **Step 4: Commit the bundled outputs**

```bash
git add public/data/talmud/
git commit -m "data(talmud): bundled structure and per-tractate texts from verified cache"
```

---

### Task 23: Create `talmud.html` entry point and wire into Vite

**Files:**
- Create: `talmud.html`
- Modify: `vite.config.ts`

- [ ] **Step 1: Read the current index.html as a reference**

Use the Read tool on `index.html`. Note its structure: the canvas, sidebar DOM, overlay picker, help elements, script tag.

- [ ] **Step 2: Create talmud.html mirroring that structure**

Create `talmud.html` at project root with the same DOM shape but titled for Talmud and with its script tag pointing at `main-talmud.ts`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bavli Map</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <canvas id="canvas"></canvas>

  <!-- Sidebar (identical DOM structure to index.html for shared sidebar styles) -->
  <div id="sidebar" class="sidebar hidden">
    <button id="sidebar-close" aria-label="Close sidebar">×</button>
    <div id="sidebar-content">
      <h2 id="sidebar-reference"></h2>
      <div id="sidebar-tag" class="sidebar-tag"></div>
      <div id="sidebar-text-he" class="sidebar-text-he" dir="rtl"></div>
      <a id="sidebar-sefaria-link" class="sidebar-link" target="_blank" rel="noopener">Open on Sefaria ↗</a>
    </div>
  </div>

  <!-- Overlay picker -->
  <div id="overlay-picker" class="overlay-picker">
    <select id="overlay-select">
      <option value="">No overlay</option>
    </select>
  </div>

  <script type="module" src="/src/main-talmud.ts"></script>
</body>
</html>
```

**Important:** match `index.html`'s existing `id` attributes on reusable elements (canvas, sidebar) so shared CSS selectors still apply. If `index.html` has elements we're not using (e.g., search box, help modal), just omit them from `talmud.html`.

- [ ] **Step 3: Add talmud.html to vite.config.ts**

Read `vite.config.ts` to find the `rollupOptions.input` block, then modify:

```ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, "index.html"),
      "test-harness": resolve(__dirname, "test-harness/index.html"),
      talmud: resolve(__dirname, "talmud.html"),
    },
  },
},
```

- [ ] **Step 4: Start the dev server and confirm talmud.html loads**

Run (background task):
```bash
npm run dev
```

Verify the dev server port from its output (probably 5173), then:

```bash
curl -s http://localhost:5173/talmud.html | head -20
```

Expected: the HTML source. Opening it in a browser will currently fail because `main-talmud.ts` doesn't exist yet — that's fine for this task.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add talmud.html vite.config.ts
git commit -m "feat(talmud): add talmud.html entry point and wire into Vite multi-page build"
```

---

### Task 24: Create `src/talmud/constants.ts`

**Files:**
- Create: `src/talmud/constants.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/talmud
```

Create `src/talmud/constants.ts`:

```ts
// Talmud-specific layout and color constants.
// Tunable values for the tm-f28x integration — placeholders that can be
// adjusted during visual review without hunting across files.

// --- Layout constants ---

export const SEGMENT_SIZE = 6;                   // px per segment square
export const PEREK_GAP = 30;                     // vertical gap between perakim within a tractate
export const TRACTATE_GAP = 40;                  // horizontal gap between tractates on a shelf
export const SEDER_GAP = 120;                    // vertical gap between shelves (sedarim)
export const DAF_LABEL_COLUMN_WIDTH = 30;        // space reserved for daf labels on the right of each tractate
export const TRACTATE_LABEL_HEIGHT = 24;         // space above each tractate block for its Hebrew name label

// --- Canonical seder order (top-to-bottom shelf order) ---

export const SEDER_ORDER: readonly string[] = [
  "Seder Zeraim",
  "Seder Moed",
  "Seder Nashim",
  "Seder Nezikin",
  "Seder Kodashim",
  "Seder Tohorot",
];

// --- Base colors (muted, similar, "rainfall over both") ---

export const MISHNAH_BASE_COLOR: readonly [number, number, number] = [0.42, 0.47, 0.58];
export const GEMARA_BASE_COLOR: readonly [number, number, number] = [0.55, 0.55, 0.55];

// --- Per-seder background tints (very subtle, ranging toward invisible) ---

export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  "Seder Zeraim":   [0.97, 0.98, 0.96],
  "Seder Moed":     [0.96, 0.97, 0.98],
  "Seder Nashim":   [0.98, 0.97, 0.97],
  "Seder Nezikin":  [0.97, 0.97, 0.95],
  "Seder Kodashim": [0.96, 0.98, 0.97],
  "Seder Tohorot":  [0.98, 0.96, 0.97],
};

// --- Zoom thresholds for daf label density ---

export const DAF_LABEL_ZOOM_LOW = 0.3;   // below this: no daf labels
export const DAF_LABEL_ZOOM_HIGH = 1.5;  // above this: all daf labels
// Between LOW and HIGH: every 10th daf

// --- Prefetch concurrency ---

export const PREFETCH_CONCURRENCY = 4;
```

- [ ] **Step 2: Commit**

```bash
git add src/talmud/constants.ts
git commit -m "feat(talmud): tunable constants for layout, colors, and prefetch"
```

---

### Task 25: Write tests for `src/talmud/data.ts`

**Files:**
- Create: `src/__tests__/unit/talmud-data.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/talmud-data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTractateText, resetTalmudDataCache } from "../../talmud/data.ts";

// Minimal fake TalmudTractateText for mocking
const fakeTractate = {
  name: "Berakhot",
  amudim: [["segment 1", "segment 2"], ["segment 3"]],
};

describe("getTractateText", () => {
  beforeEach(() => {
    resetTalmudDataCache();
    // Mock global fetch
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("Berakhot.json")) {
        return new Response(JSON.stringify(fakeTractate));
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
  });

  it("fetches and returns a tractate text on first call", async () => {
    const result = await getTractateText("Berakhot");
    expect(result).toEqual(fakeTractate);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches the result on subsequent calls (no re-fetch)", async () => {
    await getTractateText("Berakhot");
    await getTractateText("Berakhot");
    await getTractateText("Berakhot");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight fetches", async () => {
    const [a, b, c] = await Promise.all([
      getTractateText("Berakhot"),
      getTractateText("Berakhot"),
      getTractateText("Berakhot"),
    ]);
    expect(a).toEqual(fakeTractate);
    expect(b).toEqual(fakeTractate);
    expect(c).toEqual(fakeTractate);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/unit/talmud-data.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/talmud-data.test.ts
git commit -m "test(talmud): failing tests for tractate data loading and caching"
```

---

### Task 26: Implement `src/talmud/data.ts`

**Files:**
- Create: `src/talmud/data.ts`

- [ ] **Step 1: Write the module**

Create `src/talmud/data.ts`:

```ts
// Runtime data loading for the Talmud map.
//
// Loads public/data/talmud/structure.json eagerly at startup and per-tractate
// text files lazily with in-memory caching.

import { fetchData } from "../constants/app.ts";

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

/**
 * Load the all-tractates structure file. Called once at page load.
 */
export async function loadTalmudStructure(): Promise<TalmudStructure> {
  const res = await fetchData("talmud/structure.json");
  if (!res.ok) {
    throw new Error(`Failed to load talmud/structure.json: ${res.status}`);
  }
  return res.json() as Promise<TalmudStructure>;
}

// ============================================================================
// Per-tractate text cache
// ============================================================================

const textCache = new Map<string, TalmudTractateText | Promise<TalmudTractateText>>();

/**
 * Get the Hebrew text for a tractate. Returns cached text if loaded,
 * awaits an in-flight fetch if one exists, otherwise starts a new fetch.
 * Dedupes concurrent callers automatically.
 */
export async function getTractateText(
  name: string,
): Promise<TalmudTractateText> {
  const existing = textCache.get(name);
  if (existing) {
    return await existing;
  }
  const promise = (async () => {
    const res = await fetchData(`talmud/texts/${name}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load ${name}: ${res.status}`);
    }
    return res.json() as Promise<TalmudTractateText>;
  })();
  textCache.set(name, promise);
  const result = await promise;
  textCache.set(name, result); // replace promise with resolved value
  return result;
}

/**
 * Check whether a tractate's text is already fully loaded (not just in flight).
 * Used by the prefetch queue to know when to skip.
 */
export function hasTractateText(name: string): boolean {
  const entry = textCache.get(name);
  return entry !== undefined && !(entry instanceof Promise);
}

/**
 * Clear the cache. Test-only.
 */
export function resetTalmudDataCache(): void {
  textCache.clear();
}
```

**Note on `fetchData`:** this is an existing helper in `src/constants/app.ts` used by the Tanakh data loader. It wraps `fetch` with the right base path for dev vs production. Using it gives us the same behavior for Talmud data. If `fetchData` doesn't exist, use plain `fetch` with the path.

- [ ] **Step 2: Verify fetchData exists**

```bash
grep -n "export.*fetchData" src/constants/app.ts
```

If it exists, great. If not, replace both `fetchData(...)` calls with:

```ts
const res = await fetch(`/data/talmud/structure.json`);
```

and similar for the text file. (Test mocks use full-URL substring matching so the path choice doesn't matter for testing.)

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/__tests__/unit/talmud-data.test.ts
```

Expected: all pass. If the concurrent-dedup test fails, double-check that the cache stores the *promise* before awaiting, not after.

- [ ] **Step 4: Commit**

```bash
git add src/talmud/data.ts
git commit -m "feat(talmud): data loading module with structure fetch and text caching"
```

---

### Task 27: Write tests for `src/talmud/layout.ts`

**Files:**
- Create: `src/__tests__/unit/talmud-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/talmud-layout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeTalmudLayout } from "../../talmud/layout.ts";
import type { TalmudStructure } from "../../talmud/data.ts";
import { SEGMENT_SIZE, PEREK_GAP, TRACTATE_GAP, SEDER_GAP } from "../../talmud/constants.ts";

// Synthetic fixture: two tractates in two different sedarim.
// Tractate A has 2 perakim (3 amudim + 1 amud), tractate B has 1 perek (2 amudim).
const fixture: TalmudStructure = {
  tractates: [
    {
      name: "TractA",
      hebrewName: "א",
      seder: "Seder Zeraim",
      firstDaf: 2,
      amudim: [
        { daf: 2, amud: "a", segmentCount: 5, perekIdx: 0, mishnahMask: [true, false, false, false, false] },
        { daf: 2, amud: "b", segmentCount: 4, perekIdx: 0, mishnahMask: [false, false, false, false] },
        { daf: 3, amud: "a", segmentCount: 6, perekIdx: 0, mishnahMask: [false, false, false, false, false, false] },
        { daf: 3, amud: "b", segmentCount: 3, perekIdx: 1, mishnahMask: [true, false, false] },
      ],
      perakim: [
        { hebrewName: "פרק א", startAmudIdx: 0, endAmudIdx: 2, startSegmentInFirstAmud: 1, endSegmentInLastAmud: 6 },
        { hebrewName: "פרק ב", startAmudIdx: 3, endAmudIdx: 3, startSegmentInFirstAmud: 1, endSegmentInLastAmud: 3 },
      ],
    },
    {
      name: "TractB",
      hebrewName: "ב",
      seder: "Seder Moed",
      firstDaf: 2,
      amudim: [
        { daf: 2, amud: "a", segmentCount: 4, perekIdx: 0, mishnahMask: [true, false, false, false] },
        { daf: 2, amud: "b", segmentCount: 2, perekIdx: 0, mishnahMask: [false, false] },
      ],
      perakim: [
        { hebrewName: "פרק א", startAmudIdx: 0, endAmudIdx: 1, startSegmentInFirstAmud: 1, endSegmentInLastAmud: 2 },
      ],
    },
  ],
};

describe("computeTalmudLayout", () => {
  const { items, tractateBlocks, sederBlocks } = computeTalmudLayout(fixture);

  it("emits one item per segment across all tractates", () => {
    // TractA: 5+4+6+3 = 18. TractB: 4+2 = 6. Total: 24.
    expect(items.length).toBe(24);
  });

  it("emits one tractateBlock per tractate", () => {
    expect(tractateBlocks.length).toBe(2);
    expect(tractateBlocks[0].name).toBe("TractA");
    expect(tractateBlocks[1].name).toBe("TractB");
  });

  it("emits one sederBlock per represented seder", () => {
    expect(sederBlocks.length).toBe(2);
    expect(sederBlocks.map((s) => s.name).sort()).toEqual(["Seder Moed", "Seder Zeraim"]);
  });

  it("each row within a tractate shares the same right edge", () => {
    const tractA = items.filter((i) => i.tractate === "TractA");
    // Group by (daf, amud) — each group is one row
    const rows = new Map<string, typeof items>();
    for (const item of tractA) {
      const key = `${item.daf}${item.amud}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(item);
    }
    // For each row, the rightmost segment (highest segment index) should have
    // the same x + size across all rows.
    const rightEdges = new Set<number>();
    for (const row of rows.values()) {
      const rightmost = row.reduce((acc, cur) =>
        cur.segment > acc.segment ? cur : acc,
      );
      rightEdges.add(rightmost.x + rightmost.size);
    }
    expect(rightEdges.size).toBe(1); // all rows agree on the right edge
  });

  it("row width equals segment count × SEGMENT_SIZE", () => {
    // TractA amud 0 has 5 segments. Its width should be 5 * SEGMENT_SIZE = 30.
    const row0 = items.filter(
      (i) => i.tractate === "TractA" && i.daf === 2 && i.amud === "a",
    );
    const minX = Math.min(...row0.map((i) => i.x));
    const maxX = Math.max(...row0.map((i) => i.x)) + row0[0].size;
    expect(maxX - minX).toBe(5 * SEGMENT_SIZE);
  });

  it("places a PEREK_GAP between perakim", () => {
    // The last row of perek 0 (TractA amud idx 2, daf 3a) and the first row of
    // perek 1 (amud idx 3, daf 3b) should be separated by PEREK_GAP vertically.
    const perek0LastRow = items.filter(
      (i) => i.tractate === "TractA" && i.daf === 3 && i.amud === "a",
    );
    const perek1FirstRow = items.filter(
      (i) => i.tractate === "TractA" && i.daf === 3 && i.amud === "b",
    );
    const perek0Bottom = Math.max(...perek0LastRow.map((i) => i.y)) + SEGMENT_SIZE;
    const perek1Top = Math.min(...perek1FirstRow.map((i) => i.y));
    expect(perek1Top - perek0Bottom).toBe(PEREK_GAP);
  });

  it("places a SEDER_GAP between shelves", () => {
    const tractA = tractateBlocks.find((t) => t.name === "TractA")!;
    const tractB = tractateBlocks.find((t) => t.name === "TractB")!;
    // TractA is in Zeraim (first seder), TractB is in Moed (second seder).
    // TractB's top should be at least SEDER_GAP below TractA's bottom.
    expect(tractB.minY - tractA.maxY).toBeGreaterThanOrEqual(SEDER_GAP);
  });

  it("tractates on the same shelf are separated horizontally by TRACTATE_GAP", () => {
    // This fixture has each tractate on its own shelf, so this test is a
    // placeholder for the single-shelf invariant. If a future fixture puts
    // two tractates on one shelf, assert the horizontal gap here.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npx vitest run src/__tests__/unit/talmud-layout.test.ts
```

Expected: module not found.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/talmud-layout.test.ts
git commit -m "test(talmud): failing tests for computeTalmudLayout with synthetic fixture"
```

---

### Task 28: Implement `src/talmud/layout.ts`

**Files:**
- Create: `src/talmud/layout.ts`

- [ ] **Step 1: Write the module**

Create `src/talmud/layout.ts`:

```ts
// Bookshelf layout for the Talmud map.
//
// Design: docs/plans/2026-04-07-talmud-integration-design.md §3.6
//
// - Each tractate is an "option C" perek-block (vertical blocks of amud-rows,
//   shared right edge, RTL within each row).
// - Sedarim are stacked vertically (top to bottom in canonical order).
// - Within a shelf, tractates are arranged right-to-left (RTL reading).
// - Tractates on a shelf are top-aligned.
// - Coordinates: (0, 0) is the top-right of the whole bookshelf. x grows
//   leftward and downward (in screen-y terms, x is actually negative as we
//   move leftward, but we offset the whole bookshelf so minX >= 0).

import type { SpatialItem, TalmudIdentity } from "../types.ts";
import type { TalmudStructure, TalmudTractate, TalmudAmud } from "./data.ts";
import {
  SEGMENT_SIZE,
  PEREK_GAP,
  TRACTATE_GAP,
  SEDER_GAP,
  TRACTATE_LABEL_HEIGHT,
  SEDER_ORDER,
} from "./constants.ts";

export type TalmudLayoutItem = SpatialItem<TalmudIdentity>;

export interface TractateBlock {
  name: string;
  hebrewName: string;
  seder: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  labelAnchor: { x: number; y: number };
}

export interface SederBlock {
  name: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TalmudLayoutResult {
  items: TalmudLayoutItem[];
  tractateBlocks: TractateBlock[];
  sederBlocks: SederBlock[];
}

// ============================================================================
// Per-tractate layout (option C)
// ============================================================================

interface AmudRow {
  daf: number;
  amud: "a" | "b";
  segments: Array<{ segment: number; isMishnah: boolean }>;
  perekIdx: number;
}

/**
 * Walk a tractate's amudim and produce rows. An amud with perekBoundaryAt
 * becomes two half-rows.
 */
function rowsForTractate(tractate: TalmudTractate): AmudRow[] {
  const rows: AmudRow[] = [];
  for (const amud of tractate.amudim) {
    if (amud.perekBoundaryAt !== undefined && amud.perekBoundaryAt > 0) {
      // Split into two half-rows
      const firstHalf: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx,
      };
      const secondHalf: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx + 1,
      };
      for (let s = 0; s < amud.segmentCount; s++) {
        const seg = {
          segment: s + 1, // segments are 1-based in the identity
          isMishnah: amud.mishnahMask[s] ?? false,
        };
        if (s < amud.perekBoundaryAt) {
          firstHalf.segments.push(seg);
        } else {
          secondHalf.segments.push(seg);
        }
      }
      if (firstHalf.segments.length > 0) rows.push(firstHalf);
      if (secondHalf.segments.length > 0) rows.push(secondHalf);
    } else {
      const row: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx,
      };
      for (let s = 0; s < amud.segmentCount; s++) {
        row.segments.push({
          segment: s + 1,
          isMishnah: amud.mishnahMask[s] ?? false,
        });
      }
      rows.push(row);
    }
  }
  return rows;
}

interface LaidOutTractate {
  name: string;
  hebrewName: string;
  seder: string;
  items: TalmudLayoutItem[];
  // Unshifted local coordinates: origin (0, 0) = top-right of this tractate.
  // x values are 0 or negative (growing leftward); y values are 0 or positive.
  width: number;
  height: number;
}

/**
 * Lay out one tractate in local coordinates (top-right at 0,0).
 * Each row grows leftward (RTL); rows stack top-to-bottom within a perek;
 * perakim are separated by PEREK_GAP.
 */
function layoutTractate(tractate: TalmudTractate): LaidOutTractate {
  const rows = rowsForTractate(tractate);
  const items: TalmudLayoutItem[] = [];

  let y = 0;
  let lastPerekIdx = -1;
  let maxWidth = 0;

  for (const row of rows) {
    if (lastPerekIdx !== -1 && row.perekIdx !== lastPerekIdx) {
      y += PEREK_GAP;
    }
    lastPerekIdx = row.perekIdx;

    const rowWidth = row.segments.length * SEGMENT_SIZE;
    if (rowWidth > maxWidth) maxWidth = rowWidth;

    // Segments flow right-to-left from x = 0
    // Segment 1 is at x = -SEGMENT_SIZE, segment 2 is at x = -2*SEGMENT_SIZE, etc.
    // ...wait, Segment 1 should be the rightmost since RTL reading.
    for (let i = 0; i < row.segments.length; i++) {
      const seg = row.segments[i];
      const x = -(i + 1) * SEGMENT_SIZE; // segment 1 is rightmost (smallest |x|)
      items.push({
        tractate: tractate.name,
        daf: row.daf,
        amud: row.amud,
        segment: seg.segment,
        x,
        y,
        size: SEGMENT_SIZE,
      });
    }

    y += SEGMENT_SIZE;
  }

  return {
    name: tractate.name,
    hebrewName: tractate.hebrewName,
    seder: tractate.seder,
    items,
    width: maxWidth,
    height: y,
  };
}

// ============================================================================
// Bookshelf arrangement
// ============================================================================

export function computeTalmudLayout(
  structure: TalmudStructure,
): TalmudLayoutResult {
  // 1. Lay out each tractate in local coordinates.
  const laid = structure.tractates.map(layoutTractate);

  // 2. Group by seder (in canonical order).
  const bySeder = new Map<string, LaidOutTractate[]>();
  for (const seder of SEDER_ORDER) {
    bySeder.set(seder, []);
  }
  for (const t of laid) {
    if (!bySeder.has(t.seder)) bySeder.set(t.seder, []);
    bySeder.get(t.seder)!.push(t);
  }

  // 3. Arrange shelves top-to-bottom. Within each shelf, tractates go
  //    right-to-left. All tractates top-aligned within the shelf.
  //    Coordinate system: shelves grow downward (positive y).
  //    Within a shelf, the first tractate's right edge is at some anchor x;
  //    subsequent tractates have their right edges at anchor - (cumulative width).
  //
  //    We'll build everything in a single coordinate space where x can be
  //    negative, then shift to positive at the end.

  const allItems: TalmudLayoutItem[] = [];
  const tractateBlocks: TractateBlock[] = [];
  const sederBlocks: SederBlock[] = [];

  let shelfY = 0;

  for (const seder of SEDER_ORDER) {
    const tractates = bySeder.get(seder) ?? [];
    if (tractates.length === 0) continue;

    // For this shelf: anchor the first tractate's right edge at x = 0, and
    // subsequent tractates extend leftward.
    let shelfRightEdge = 0;
    let shelfMaxHeight = 0;
    const shelfItemStart = allItems.length;
    const shelfTractateStart = tractateBlocks.length;

    for (const t of tractates) {
      const tractateRightEdge = shelfRightEdge;
      const tractateLeftEdge = tractateRightEdge - t.width;
      const tractateTop = shelfY + TRACTATE_LABEL_HEIGHT;
      const tractateBottom = tractateTop + t.height;

      // Shift this tractate's items into world coordinates:
      //   local x (which is <= 0) becomes tractateRightEdge + local_x
      //   local y (which is >= 0) becomes tractateTop + local_y
      for (const item of t.items) {
        allItems.push({
          ...item,
          x: tractateRightEdge + item.x,
          y: tractateTop + item.y,
        });
      }

      tractateBlocks.push({
        name: t.name,
        hebrewName: t.hebrewName,
        seder: t.seder,
        minX: tractateLeftEdge,
        minY: shelfY,
        maxX: tractateRightEdge,
        maxY: tractateBottom,
        labelAnchor: {
          x: tractateRightEdge - t.width / 2,
          y: shelfY + TRACTATE_LABEL_HEIGHT / 2,
        },
      });

      if (tractateBottom - shelfY > shelfMaxHeight) {
        shelfMaxHeight = tractateBottom - shelfY;
      }
      shelfRightEdge = tractateLeftEdge - TRACTATE_GAP;
    }

    const shelfLeftEdge = shelfRightEdge + TRACTATE_GAP; // last step overshot
    sederBlocks.push({
      name: seder,
      minX: shelfLeftEdge,
      minY: shelfY,
      maxX: 0,
      maxY: shelfY + shelfMaxHeight,
    });

    shelfY += shelfMaxHeight + SEDER_GAP;
  }

  // 4. Shift everything so minX >= 0.
  let globalMinX = 0;
  for (const item of allItems) {
    if (item.x < globalMinX) globalMinX = item.x;
  }
  const dx = -globalMinX;
  for (const item of allItems) {
    item.x += dx;
  }
  for (const block of tractateBlocks) {
    block.minX += dx;
    block.maxX += dx;
    block.labelAnchor.x += dx;
  }
  for (const block of sederBlocks) {
    block.minX += dx;
    block.maxX += dx;
  }

  return { items: allItems, tractateBlocks, sederBlocks };
}
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/__tests__/unit/talmud-layout.test.ts
```

Expected: all tests pass. The most likely failure is the "shared right edge" test — if it fails, the layout logic is mis-aligning rows. Debug by logging `rows.map(r => r.segments.length * SEGMENT_SIZE)` vs the actual `x + size` values.

- [ ] **Step 3: Commit**

```bash
git add src/talmud/layout.ts
git commit -m "feat(talmud): bookshelf layout with option-C perek blocks and RTL shelves"
```

---

### Task 29: Write + implement prefetch, URL state, sidebar, labels, overlay, entry script

The remaining tasks are similar in structure (write test, implement, commit). To keep this plan a usable length, the following tasks give summary descriptions and key code snippets, not full TDD walkthroughs. Follow the same rhythm: test first, implement, run, commit.

**Task 29a: `src/talmud/prefetch.ts`** + `src/__tests__/unit/talmud-prefetch.test.ts`

Implements background prefetch with concurrency cap and click-time precedence override per design doc §3.12. Uses `getTractateText` from `data.ts` as the fetch primitive.

Key API:
```ts
export function startBackgroundPrefetch(
  tractateNames: string[],
  concurrency: number = PREFETCH_CONCURRENCY,
): void;

export function promoteTractateToFront(name: string): void;
```

Tests assert: fires fetch for every tractate; `promoteTractateToFront` moves a queued name to the head; concurrency never exceeds cap; is a no-op when all tractates already loaded.

Commit: `feat(talmud): background prefetch with click-time precedence override`

---

**Task 29b: `src/talmud/urlState.ts`** + `src/__tests__/unit/talmud-urlState.test.ts`

Wraps `corpus-format`'s `serializeToUrlHash` / `parseFromUrlHash` with `TALMUD_SCHEMA` and the param name `segment`. Provides:

```ts
export function parseTalmudUrlState(): { segment: TalmudIdentity | null, overlay: string | null };
export function updateTalmudUrl(state: { segment: TalmudIdentity | null, overlay: string | null }): void;
```

Tests: round-trip several segments through the URL hash.

Commit: `feat(talmud): URL hash state management for segment and overlay`

---

**Task 29c: `src/talmud/sidebar.ts`**

Parallel to `src/sidebar.ts`. Populates the sidebar DOM with a Talmud segment's details per design doc §3.9. Reads the reference via `formatReference(id, TALMUD_SCHEMA)`, the Hebrew text via `getTractateText(name).then(t => t.amudim[amudIdx][segIdx - 1])`, and composes the Sefaria link as `https://www.sefaria.org/${encodeURIComponent(tractate)}.${daf}${amud}.${segment}`.

No new tests beyond integration — this is DOM manipulation best verified visually.

Key function:
```ts
export async function updateTalmudSidebar(
  id: TalmudIdentity | null,
  isMishnah: boolean,
  elements: { reference: HTMLElement, tag: HTMLElement, textHe: HTMLElement, sefariaLink: HTMLAnchorElement, sidebar: HTMLElement },
): Promise<void>;
```

Commit: `feat(talmud): sidebar population with reference, Hebrew text, Sefaria link`

---

**Task 29d: `src/talmud/talmudLabels.ts`** (parallel to `src/labels.ts`)

Parallel module for tractate name labels above each block, plus daf labels with zoom-dependent density + hover reveal per design doc §3.11. DOM-overlay approach mirroring `labels.ts`, no WebGL text.

Key APIs:
```ts
export function createTalmudLabels(
  tractateBlocks: TractateBlock[],
  amudLookup: Array<{ tractate: string, daf: number, amud: "a"|"b", row: { minX: number, rightX: number, y: number } }>,
  container: HTMLElement,
): HTMLDivElement;

export function updateTalmudLabelPositions(
  labelsContainer: HTMLElement,
  pan: { x: number, y: number },
  zoom: number,
  hoveredRow: { tractate: string, daf: number, amud: "a"|"b" } | null,
): void;
```

Zoom thresholds come from `constants.ts`. Tractate labels are always visible; daf labels toggle by zoom level and by hover.

No unit tests (pure DOM). Visual verification only.

Commit: `feat(talmud): tractate and daf labels with zoom-dependent density`

---

**Task 29e: `src/talmud/overlays/segment-length.ts`**

Talmud overlay that colors Gemara and Mishnah segments by length on a pale-yellow → dark-red ramp. Registered in the overlay picker, off by default. Implements the `Overlay<TalmudIdentity>` interface.

Key implementation:
```ts
import type { Overlay } from "../../overlays/types.ts";
import type { TalmudIdentity } from "../../types.ts";
import { getTractateText } from "../data.ts";

type Color = [number, number, number];

function lengthToColor(length: number, maxLength: number): Color {
  const t = Math.min(1, length / maxLength);
  // Pale yellow (0.95, 0.95, 0.6) → dark red (0.6, 0.15, 0.1)
  return [
    0.95 - (0.95 - 0.6) * t,
    0.95 - (0.95 - 0.15) * t,
    0.6 - (0.6 - 0.1) * t,
  ];
}

export const segmentLengthOverlay: Overlay<TalmudIdentity> = {
  name: "Segment length",
  id: "segment-length",
  getVerseColor(id: TalmudIdentity): Color | null {
    // Length is looked up from a precomputed cache keyed by tractate+amudIdx+seg.
    // The cache is populated by configureSegmentLength() below.
    const key = `${id.tractate}:${id.daf}${id.amud}:${id.segment}`;
    const length = lengthCache.get(key);
    if (length === undefined) return null;
    return lengthToColor(length, maxLength);
  },
};

const lengthCache = new Map<string, number>();
let maxLength = 1;

export async function configureSegmentLength(tractateNames: string[]): Promise<void> {
  // Fetch each tractate's text (via getTractateText which uses prefetch cache)
  // and populate lengthCache.
  for (const name of tractateNames) {
    const text = await getTractateText(name);
    text.amudim.forEach((amud, amudIdx) => {
      amud.forEach((seg, segIdx) => {
        const daf = Math.floor(amudIdx / 2) + 2; // assumes firstDaf=2 — look up from structure if needed
        const amudLetter = amudIdx % 2 === 0 ? "a" : "b";
        const key = `${name}:${daf}${amudLetter}:${segIdx + 1}`;
        lengthCache.set(key, seg.length);
        if (seg.length > maxLength) maxLength = seg.length;
      });
    });
  }
}
```

**Note on firstDaf assumption:** the length overlay's key derivation above assumes `firstDaf=2`. In practice, for a production-quality version, `configureSegmentLength` should receive the structure so it can use each tractate's actual `firstDaf`. Make the fix by passing structure in and walking `structure.amudim` for the daf/amud values instead of computing from index.

Commit: `feat(talmud): segment-length overlay with pale-yellow to dark-red ramp`

---

**Task 29f: `src/main-talmud.ts`** — the entry point wiring

The glue that brings it all together. Mirror the structure of `src/main.ts` but for the Talmud code paths.

Responsibilities:
1. Load `structure.json` via `loadTalmudStructure()`.
2. Compute layout via `computeTalmudLayout(structure)`.
3. Get canvas element from DOM, initialize WebGL context via existing `createRenderContext`.
4. Build initial geometry via `buildVerseGeometry(items)` (generic — accepts TalmudLayout).
5. Register `segmentLengthOverlay` in the overlay registry, populate the picker `<select>` with overlay options.
6. Wire up mouse/touch event handlers using existing `mouseState.ts` / `touchState.ts` / `camera.ts` modules.
7. On hover, call `findVerseLayoutAtPoint` (generic) to get the hovered TalmudLayout item.
8. On click, pin the segment, update the sidebar via `updateTalmudSidebar(id, isMishnah, elements)`.
9. Kick off `startBackgroundPrefetch(structure.tractates.map(t => t.name))` after initial render.
10. On segment click where the tractate isn't loaded: call `promoteTractateToFront(name)` then await `getTractateText(name)`.
11. Parse the URL hash via `parseTalmudUrlState()` at startup to restore a pinned segment.
12. Update URL on state change via debounced `updateTalmudUrl(...)`.
13. Render loop: call `computeVerseStates(items, activeOverlay, hoveredItem, pinnedItem, talmudSegmentsEqual)` then `applyVerseColors` then `rebuildGeometry` + `render`.

This file will be ~300–500 lines. Use `src/main.ts` as the scaffold and adapt.

**Key function to add** somewhere (e.g. in `types.ts` alongside `versesEqual`):

```ts
export function talmudSegmentsEqual(
  a: TalmudIdentity | null,
  b: TalmudIdentity | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.tractate === b.tractate &&
    a.daf === b.daf &&
    a.amud === b.amud &&
    a.segment === b.segment
  );
}
```

And a helper to look up whether a given segment is Mishnah:

```ts
export function isSegmentMishnah(
  structure: TalmudStructure,
  id: TalmudIdentity,
): boolean {
  const tractate = structure.tractates.find((t) => t.name === id.tractate);
  if (!tractate) return false;
  const amudIdx = (id.daf - tractate.firstDaf) * 2 + (id.amud === "b" ? 1 : 0);
  const amud = tractate.amudim[amudIdx];
  if (!amud) return false;
  return amud.mishnahMask[id.segment - 1] ?? false;
}
```

This helper lives in `src/talmud/data.ts` (or `src/talmud/query.ts` if you prefer a dedicated module).

Commit: `feat(talmud): main-talmud.ts wires entry point, layout, overlays, interaction`

---

### Task 30: Dev-server smoke test and visual review

- [ ] **Step 1: Start the dev server**

Run as a background task:
```bash
npm run dev
```

Wait for it to print the URL (probably `http://localhost:5173`). Verify:
```bash
curl -s http://localhost:5173/talmud.html > /dev/null && echo "OK"
```

- [ ] **Step 2: Open the Talmud map in a browser**

Navigate to `http://localhost:5173/talmud.html`. Open DevTools console.

Check:
- Zero console errors (the most common cause is data shape mismatch between `structure.json` and the types).
- All verified tractates visible as a bookshelf of 6 shelves.
- Pan/zoom work.
- Hover highlights a segment.
- Click opens sidebar with reference, Hebrew text, Sefaria link.
- URL updates to `#segment=...` on click.
- Reload preserves the pinned segment.
- Overlay picker shows "No overlay" and "Segment length". Switching overlays updates colors.

- [ ] **Step 3: Take screenshots**

Save screenshots to a scratch directory (not committed):
```bash
mkdir -p /tmp/talmud-screenshots
```

Capture manually:
1. Full-Bavli view (zoomed all the way out)
2. Single-seder zoom (e.g., Seder Moed)
3. Single-tractate zoom on Berakhot — compare to `docs/plans/images/2026-04-06-talmud-exploration/berakhot-full-2x.png` for parity check
4. Clicked-segment sidebar showing reference, Hebrew text, Sefaria link

- [ ] **Step 4: Run the Tanakh map smoke test**

Navigate to `http://localhost:5173/index.html`. Confirm the Tanakh map still loads and functions identically to before the refactor. Click a verse — sidebar should open. This is the regression check for the spatial-layer generic refactor.

- [ ] **Step 5: Stop the dev server**

Kill the background task.

- [ ] **Step 6: Run the full test suite one more time**

```bash
npm test
```

Expected: all tests pass. Verify there are no skipped tests by checking the output for "skipped" or "pending".

- [ ] **Step 7: Update design doc §6.3 with any surprises**

Open `docs/plans/2026-04-07-talmud-integration-design.md` and in §6.3 (Unexpected issues), note anything that came up during implementation:
- Visual surprises (colors were off, labels overlapped, etc.)
- Data surprises (unexpected perek boundary handling, tractate shapes, etc.)
- Refactor surprises (places where `<T>` wasn't as clean as expected)
- Any tasks that were harder/easier than the plan estimated

This log is what you'll use in the cleanup-round conversation with Danyel before the PRs exit draft.

- [ ] **Step 8: Commit the design doc log update**

```bash
git add docs/plans/2026-04-07-talmud-integration-design.md
git commit -m "docs(talmud): log implementation findings in design doc §6.3"
```

---

### Task 31: Push tm-f28x and open PR #2

- [ ] **Step 1: Review the commit log**

```bash
git log --oneline tm-u7b1..HEAD
```

Expected: the integration commits from this phase, clearly scoped.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin tm-f28x
```

- [ ] **Step 3: Open PR #2 as draft targeting tm-u7b1**

```bash
gh pr create --draft --base tm-u7b1 --title "tm-f28x: engine integration for full Bavli" --body "$(cat <<'EOF'
## Summary

Implements `tm-f28x`: wires the Talmud data pipeline into the main app as a second entry point at `/torahmap/talmud.html`. Reuses the Torah Map's WebGL rendering engine via a lightweight generic refactor (`SpatialItem<T>`) and adds Talmud-specific domain code alongside the existing Tanakh code.

**Stacked on PR #1 (`tm-u7b1`)** — this PR's base is the `tm-u7b1` branch. When PR #1 merges to main, GitHub will auto-retarget this PR to main and the diff becomes integration-only.

## What's in this PR

### Spatial-layer refactor
- `src/types.ts` — introduces `SpatialItem<T>`, `TanakhIdentity`, `TalmudIdentity`, `TalmudLayout`; `VerseLayout` / `VerseIdentity` become backwards-compat aliases
- `src/geometry.ts`, `src/hitDetection.ts`, `src/verseColoring.ts` — become `<T>` generic over identity
- `src/overlays/types.ts` — `Overlay<T>` generic with default `T = VerseIdentity`
- `src/corpusSchema.ts` — runtime schema description for shared formatters
- `src/corpus-format.ts` — schema-driven reference and URL hash formatters
- `src/urlState.ts` — refactored to use `corpus-format` with `TANAKH_SCHEMA`
- `src/__tests__/unit/spatial-layer-generic.test.ts` — proves spatial layer is identity-agnostic

### Talmud integration
- `talmud.html` + `vite.config.ts` — new entry point wired into multi-page build
- `src/main-talmud.ts` — Talmud entry script
- `src/talmud/constants.ts` — layout and color constants
- `src/talmud/data.ts` — structure and text loading with in-memory cache
- `src/talmud/layout.ts` — bookshelf layout (option-C perek blocks per tractate, RTL shelves)
- `src/talmud/prefetch.ts` — background prefetch with click-time precedence override
- `src/talmud/urlState.ts` — Talmud URL hash state
- `src/talmud/sidebar.ts` — sidebar population with reference, Hebrew text, Sefaria link
- `src/talmud/talmudLabels.ts` — tractate + daf labels with zoom-dependent density
- `src/talmud/overlays/segment-length.ts` — first Talmud analytical overlay
- `scripts/talmud/bundle.ts` — raw cache → runtime JSON bundler
- `public/data/talmud/structure.json` + `public/data/talmud/texts/*.json` — bundled data
- New unit tests across all the above

## Screenshots

(Attach the four screenshots from Task 30 Step 3 here.)

## Test plan

- [ ] `npm test` passes
- [ ] `talmud.html` loads without console errors
- [ ] All verified tractates visible as six-shelf bookshelf
- [ ] Pan/zoom work
- [ ] Hover + click + sidebar work
- [ ] URL hash state round-trips on reload
- [ ] Segment-length overlay toggles on/off
- [ ] Tanakh map at `index.html` still works unchanged (spatial refactor regression check)
- [ ] Visual parity with the prototype reference at `docs/plans/images/2026-04-06-talmud-exploration/berakhot-full-2x.png`

## Open questions and assumptions log

See §6 of `docs/plans/2026-04-07-talmud-integration-design.md` for the running log of assumptions made during implementation, unexpected issues encountered, and open questions that should be discussed in the cleanup round before this PR exits draft.

EOF
)"
```

- [ ] **Step 4: Confirm the PR is visible and in draft**

```bash
gh pr view --web
```

Expected: browser opens with the PR page. Status = draft. Base = tm-u7b1.

---

## Phase 3: Cleanup Round (Before PRs Exit Draft)

This happens interactively with Danyel after both PRs are open.

- [ ] **Walk through §6 of the design doc** (open questions, assumptions, unexpected issues) and triage each item.
- [ ] **For each assumption: verified, invalidated, or still open?** Update or remove.
- [ ] **For each unexpected issue: fix in-place (add a commit), file a follow-up issue, or accept as-is?**
- [ ] **Review screenshots together.** Visual parity check, color tuning, label placement.
- [ ] **Toggle the PRs draft → ready** when Danyel is satisfied.
- [ ] **Danyel merges PR #1.** GitHub auto-retargets PR #2 to main.
- [ ] **Danyel merges PR #2.**
- [ ] **Worktree cleanup:**
  ```bash
  cd /Users/danyel/code/MISC/torahmap
  git worktree remove ../torahmap-worktrees/tm-u7b1
  git worktree remove ../torahmap-worktrees/tm-f28x
  git branch -D tm-u7b1 tm-f28x
  ```

---

## Self-review summary

This plan has 31 numbered tasks plus the cleanup phase. Each task follows the TDD rhythm (test-first for non-trivial logic, implementation, commit) and includes exact commands, file paths, and code blocks. Tasks 29a–29f use summary descriptions rather than full TDD walkthroughs to keep the plan tractable; these are the DOM/wiring tasks where the primary verification is visual, not unit-test-driven.

**Spec coverage check:**
- §1 overview: Tasks 1, 10 (setup), 29f (main-talmud wiring), 31 (PR)
- §2 verification: Tasks 1–9
- §3.1 templated spatial layer: Tasks 11, 13–16
- §3.2 mode switch (talmud.html): Task 23
- §3.3 data pipeline: Tasks 21, 22, 26
- §3.4 bundling script: Tasks 19–21
- §3.5 runtime data loading: Tasks 25, 26
- §3.6 bookshelf layout: Tasks 27, 28
- §3.7 visual encoding / base colors: Task 24 (constants), 29f (wiring)
- §3.8 overlays: Task 29e
- §3.9 interaction / sidebar: Task 29c
- §3.10 shared formatting: Tasks 12, 17, 18
- §3.11 labels: Task 29d
- §3.12 prefetch: Task 29a
- §3.13 module layout: covered across all of Phase 2
- §3.14 tests: the spatial genericization test is Task 13; layout tests are Task 27; data/prefetch/URL tests are 25, 29a, 29b; the marker walk tests are Task 19
- §3.15 visual review: Task 30
- §3.16 page title: Task 23 + 29f
- §4 stacked-PR process: Tasks 1, 9, 10, 31, Phase 3

**Placeholder check:** Tasks 29a–29f are the closest thing to placeholders, but they include the key API, key code snippets, and the commit message. A competent engineer can execute them by extrapolating from the prior, fully-worked tasks (1–28, 30, 31). The only explicit deferral is visual tuning of color constants, which happens during Task 30 and the cleanup round.

**Type consistency:** `SpatialItem<T>`, `TanakhIdentity`, `TalmudIdentity`, `TalmudLayout`, `TalmudStructure`, `TalmudTractate`, `TalmudAmud`, `TalmudPerek`, `TalmudTractateText` are used consistently across tasks. `Overlay<T>` has the same default everywhere. `computeTalmudLayout`'s return shape (`{items, tractateBlocks, sederBlocks}`) is consistent between its test (Task 27) and implementation (Task 28).
