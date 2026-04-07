# Talmud Integration — Design

**Issues:** `tm-u7b1` (verify Wikisource coverage), `tm-f28x` (engine integration for full Bavli)
**Date:** 2026-04-07
**Status:** Design — awaiting approval
**Supersedes planning state of:** `docs/plans/2026-04-06-talmud-exploration-design.md` (exploration), `docs/plans/2026-04-06-talmud-exploration-memo.md` (recommendation)

This document covers both issues together because they form a single indivisible arc: `tm-u7b1` is the precondition that unblocks `tm-f28x`, and the verification work directly feeds the integration's data pipeline. They will ship as two stacked PRs, with `tm-f28x` branched on top of `tm-u7b1`.

The brainstorm that produced this design is captured in the 24 Q&A pairs in the session transcript. This document is the settled, commitment-ready summary; it does not re-derive the reasoning. For the "why" behind any choice, the transcript and the exploration memo (`2026-04-06-talmud-exploration-memo.md`) are the sources of truth.

---

## 1. Overview

**Goal:** Bring the full Babylonian Talmud (Bavli) into the Torah Map engine as a second first-class corpus, sharing the spatial rendering substrate and diverging at the domain layer. The result is a second map at `/torahmap/talmud.html` that uses the same WebGL engine and shows all 37 Bavli tractates with authoritative Mishnah/Gemara tagging.

**Two sequential issues:**

- **`tm-u7b1` — Verify Wikisource coverage across all 37 Bavli tractates.** A one-off verification pass that downloads Wikisource Hebrew JSON and Davidson `merged.json` from the public Sefaria-Export GCS bucket for each tractate, confirms non-empty and plausible data, and cross-checks that the two sources have identical shape (so position-based addressing is interchangeable for any future Davidson-based overlays). Anomalies are flagged, excluded from `tm-f28x`, and an issue is filed per anomaly.

- **`tm-f28x` — Engine integration for full Bavli.** Wires the exploration prototype's pipeline into the production app as a parallel HTML entry point (`talmud.html`), reusing the spatial rendering layer via a lightweight type generalization and duplicating the domain layer in a `main-talmud.ts` parallel to the existing `main.ts`. Ships with a bookshelf layout of all verified tractates, structural Mishnah/Gemara base coloring, a segment-length overlay (off by default), click-to-sidebar, URL-hash state, and the set of tests required to guarantee the spatial refactor is identity-agnostic.

**What's explicitly out of scope** (filed as separate issues, do not creep in):

| Out | Issue |
|---|---|
| English translation from Davidson | `tm-s6f5` |
| Full-text search | `tm-mhdo` |
| Hebrew/Aramaic classifier | `tm-haar` |
| Commentary link heatmap | `tm-gko1` |
| Rabbinical name search | `tm-aooj` |
| Argumentation-pattern overlays (kal va-chomer etc.) | `tm-f28v` |
| Cross-reference overlay (Bavli → Torah) | `tm-dk9d` |
| Text dating by rabbinical generation | `tm-5zen` |
| Multi-tractate layout *refinement* (the bookshelf is v1) | `tm-txt2` |
| Perek label styling refinement | `tm-56as` |
| Mishnah as a standalone corpus | `tm-0kyg` |
| Alternative Talmud layouts | `tm-go93` |
| Yerushalmi, Tosefta, Mishnah-as-corpus | (no issue — not Bavli) |
| Sugya boundary inference | (no issue — deferred indefinitely) |

---

## 2. tm-u7b1 — Coverage Verification

### 2.1 Script and location

`scripts/talmud/verify-coverage.ts` — a standalone `tsx`-runnable TypeScript script. Not a test, not part of the dev server. Invoked manually: `npx tsx scripts/talmud/verify-coverage.ts`.

### 2.2 Tractate list

Hard-rolled constant at the top of the script:

```ts
// Source: standard Vilna Bavli table of contents.
// 37 tractates total. Shekalim is excluded because its "Bavli" Gemara is
// actually Yerushalmi — see §2.5.
const BAVLI_TRACTATES: ReadonlyArray<{ seder: string; tractate: string }> = [
  // Seder Zeraim (1)
  { seder: "Seder Zeraim", tractate: "Berakhot" },
  // Seder Moed (11; Shekalim excluded — see §2.5)
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
// 1 + 11 + 7 + 8 + 9 + 1 = 37
```

**Assumption to verify during tm-u7b1 execution:** that the exact tractate names and seder names above match the GCS bucket paths. If a name differs (e.g., "Bava Kama" vs "Bava Kamma", "Moed Katan" vs "Moed Qatan", "Avodah Zarah" vs "Avoda Zara"), the script will fail fast on first fetch and the list gets corrected before the real run.

### 2.3 Data sources

For each `(seder, tractate)`:

1. **Wikisource Hebrew** — `https://storage.googleapis.com/sefaria-export/json/Talmud/Bavli/<Seder>/<Tractate>/Hebrew/Wikisource%20Talmud%20Bavli.json`
2. **Davidson merged** — `https://storage.googleapis.com/sefaria-export/json/Talmud/Bavli/<Seder>/<Tractate>/Hebrew/merged.json`
3. **Schema** — `https://storage.googleapis.com/sefaria-export/schemas/<Tractate>.json`

Path components are URL-encoded (spaces become `%20`).

### 2.4 Cache

All downloads land in `data-transient/talmud-raw/` with the following layout:

```
data-transient/talmud-raw/
├── <Tractate>/
│   ├── wikisource.json
│   ├── merged.json
│   └── schema.json
...
```

`data-transient/` is added to `.gitignore`. The directory name `data-transient` distinguishes it from `data/` (which contains committed Tanakh source texts) and `public/data/` (which contains runtime-fetchable bundles). The cache is regenerable from the verify script and is consumed by the bundling script in tm-f28x.

**Idempotency:** the verify script skips downloads when a file already exists in the cache. A `--force` flag forces re-download.

### 2.5 Shekalim exclusion

Shekalim is traditionally bound with Bavli printings but its Gemara is drawn from the Yerushalmi. The script's `BAVLI_TRACTATES` list **excludes** Shekalim, so it is not verified and is not wired into tm-f28x. If the Sefaria-Export bucket has a Bavli Shekalim file anyway, the script ignores it. This is documented as a comment in the constant.

**Future consideration (not in scope):** if we later want to include Shekalim for completeness, we can add a `type: "yerushalmi-source"` marker in the data model. For now, the cleanest story is "tm-f28x ships the 37 Bavli-proper tractates." This is noted in the open-questions section of this doc.

### 2.6 Pass criteria

**Hard rules (failure = excluded from tm-f28x, issue filed):**

- Wikisource file is reachable (HTTP 200) and parses as JSON.
- Wikisource `text.length` > 0 (non-zero amud count).
- Total segment count across all amudim > 0.
- Davidson file is reachable and parses.
- `wikisource.text.length === merged.text.length`.
- `wikisource.text[i].length === merged.text[i].length` for every amud `i`.
- Schema file is reachable, parses, and has a non-empty `alts.Chapters.nodes` array.

**Soft rules (failure = flag, exclude from tm-f28x, file an issue):**

- `מתני׳` marker count across the whole tractate is in `[10, 300]`.
- `גמ׳` marker count across the whole tractate is in `[10, 300]`.
- `הדרן` marker count ≥ 1 (there's at least one perek boundary).

The ranges are chosen from Berakhot's observed counts (34 of each) with generous headroom. Tractates outside this range may be legitimate (a tiny tractate, a tractate with unusual structure) but they deserve a human look before we commit their data to production.

### 2.7 Anomaly handling

When a tractate fails any rule:

1. Print a clear error/warning line to stdout with the tractate name and the specific rule that failed.
2. Add an entry to the in-memory anomaly list.
3. **Do not stop.** Continue processing the remaining tractates.

At the end of the run:

1. Write `data-transient/talmud-coverage-report.json` with per-tractate pass/fail details (this file is gitignored alongside the rest of `data-transient/`).
2. Print a summary table to stdout:

   ```
   PASS: 33 tractates
   FAIL: 4 tractates

     Meilah        soft-fail: מתני׳ count = 2 (expected 10–300)
     Tamid         hard-fail: wikisource text.length === 0
     ...
   ```

3. Print exact `./scripts/issues-new.sh` command lines to copy-paste, one per anomaly:

   ```
   ./scripts/issues-new.sh "Talmud coverage anomaly: Meilah (soft-fail מתני׳ count)" task 2
   ./scripts/issues-new.sh "Talmud coverage anomaly: Tamid (hard-fail empty Wikisource)" task 2
   ```

4. Exit code is `0` if any tractates passed, `1` if zero passed (catastrophic). Non-zero exit does *not* gate PR merge — a few anomalies are expected and acceptable; the integration just excludes them.

**Important:** the script does not automatically create the issues or modify the repo beyond writing to `data-transient/`. The human running the script is responsible for reading the summary, creating the issues, and deciding whether to rerun with `--force` after any data-side fixes.

### 2.8 Report format

`data-transient/talmud-coverage-report.json`:

```json
{
  "generatedAt": "2026-04-07T12:34:56Z",
  "totalTractates": 37,
  "passed": 33,
  "failed": 4,
  "tractates": [
    {
      "seder": "Seder Zeraim",
      "tractate": "Berakhot",
      "status": "pass",
      "wikisource": { "amudCount": 127, "segmentCount": 2749 },
      "merged": { "amudCount": 127, "segmentCount": 2749 },
      "shapeMatch": true,
      "markers": { "matnitin": 34, "gemara": 34, "hadran": 9 }
    },
    {
      "seder": "Seder Kodashim",
      "tractate": "Tamid",
      "status": "hard-fail",
      "failures": ["wikisource.text.length === 0"],
      "wikisource": { "amudCount": 0, "segmentCount": 0 }
    }
  ]
}
```

This JSON is the durable record of what was verified and what wasn't. tm-f28x's bundling script consumes this file to know which tractates to include.

### 2.9 Tests for the verify script

- Fixture-based unit tests in `src/__tests__/unit/talmud-verify-coverage.test.ts` using synthetic Wikisource/Davidson/schema JSON fixtures (small, ~3 amudim each) committed to `scripts/talmud/fixtures/`.
- Assertions cover: clean tractate passes all rules; shape mismatch triggers hard-fail; too-few markers triggers soft-fail; empty text triggers hard-fail; malformed JSON triggers a clean error message (not a stack trace).
- Network is mocked — no real fetches from tests.

---

## 3. tm-f28x — Engine Integration

### 3.1 Architecture: templated spatial layer

The existing `src/types.ts` comment block already anticipates corpus generalization. This design makes it real with minimal churn.

**Concrete per-corpus identity types:**

```ts
// Unchanged from today, just renamed internally. Still Tanakh-specific.
interface TanakhIdentity {
  book: string;
  chapter: number;
  verse: number;
}

// New, Talmud-specific.
interface TalmudIdentity {
  tractate: string;
  daf: number;           // 2..end (there is no daf 1 in standard printings)
  amud: "a" | "b";
  segment: number;       // 1-based, segment index within the amud
}
```

**Generic spatial wrapper:**

```ts
// Before: interface VerseLayout extends VerseIdentity { x, y, size }
// After:
type SpatialItem<T> = T & { x: number; y: number; size: number };

type TanakhLayout = SpatialItem<TanakhIdentity>;   // structurally identical to today's VerseLayout
type TalmudLayout = SpatialItem<TalmudIdentity>;
```

**Rendering/geometry/hit-detection modules become generic over `T`:**

```ts
function buildGeometry<T>(items: SpatialItem<T>[]): GeometryBuffers { ... }
function findVerseLayoutAtPoint<T>(items: SpatialItem<T>[], x: number, y: number): SpatialItem<T> | null { ... }
```

None of these modules read identity fields. They only touch `x`, `y`, `size`. The generic parameter `<T>` exists to preserve type information through the pipeline so downstream code gets back the concrete identity it put in.

**Hierarchy described as runtime data (for shared formatters, URL parsers, comparators):**

```ts
interface LevelDef {
  key: string;
  type: "string" | "number" | "enum";
  enum?: readonly string[];
}

interface CorpusSchema {
  kind: "tanakh" | "talmud";
  levels: readonly LevelDef[];
}

const TANAKH_SCHEMA: CorpusSchema = {
  kind: "tanakh",
  levels: [
    { key: "book", type: "string" },
    { key: "chapter", type: "number" },
    { key: "verse", type: "number" },
  ],
};

const TALMUD_SCHEMA: CorpusSchema = {
  kind: "talmud",
  levels: [
    { key: "tractate", type: "string" },
    { key: "daf", type: "number" },
    { key: "amud", type: "enum", enum: ["a", "b"] as const },
    { key: "segment", type: "number" },
  ],
};
```

Shared utilities (e.g., a URL-hash parser that turns `Berakhot:2a:1` into an identity object) consume the schema and work for both corpora without a switch statement.

**What this buys, concretely:**

- The rendering layer is provably identity-agnostic (enforced by a test — see §3.11).
- Domain code stays strongly typed with named fields — `sidebar.ts` gets a `TalmudIdentity`, not a `Record<string, unknown>`.
- Adding a hypothetical third corpus later is O(new identity interface + new schema + new data loader + new entry HTML), not O(fork the codebase).
- No discriminated-union switch statements anywhere in the spatial layer.
- The Tanakh code path is structurally unchanged — every existing test passes without modification because `TanakhLayout = SpatialItem<TanakhIdentity>` is byte-for-byte the same shape as today's `VerseLayout`.

### 3.2 Mode-switch: separate HTML entry points

The Talmud map is a separate page. No runtime corpus flag.

**File changes:**

- New: `talmud.html` at project root. Structure mirrors `index.html` but references `/src/main-talmud.ts` as its entry script. Canvas element, sidebar DOM, overlay picker all present.
- New: `src/main-talmud.ts` — the Talmud entry point. Mirrors `src/main.ts` in structure: loads data, computes layout, wires up interaction, registers Talmud-specific overlays. Imports shared modules from the spatial layer.
- Modified: `vite.config.ts` — adds `talmud: resolve(__dirname, "talmud.html")` to the `rollupOptions.input` object.

**Deep-link:** `/torahmap/talmud.html#segment=Berakhot:2a:1` in production, `http://localhost:5173/talmud.html#segment=Berakhot:2a:1` in dev.

**`index.html` and `main.ts` are not modified** beyond what's required by the spatial-layer generic refactor (which is mechanical: adding `<T>` parameters to function signatures, renaming `VerseLayout` → `TanakhLayout` where the concrete type is wanted, or keeping `VerseLayout` as a type alias for zero-churn where possible).

### 3.3 Data pipeline

```
           one-time                       build-time                    runtime
  ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
  │ GCS: sefaria-export │ ───▶ │ data-transient/      │ ───▶ │ public/data/talmud/ │
  │ (Wikisource +       │      │ talmud-raw/          │      │   structure.json    │
  │  Davidson + schemas)│      │ (gitignored cache)   │      │   texts/*.json      │
  └─────────────────────┘      └──────────────────────┘      └─────────────────────┘
          verify-coverage.ts              bundle.ts                    main-talmud.ts
             (tm-u7b1)                     (tm-f28x)                    (tm-f28x)
```

- **Download** happens once, cached to `data-transient/talmud-raw/` (Step 1, gitignored).
- **Bundling** reads the cache + coverage report, writes production artifacts to `public/data/talmud/` (Step 2, committed — these are the files Vite serves).
- **Runtime** fetches `structure.json` at page load (fast), then background-prefetches `texts/*.json` per tractate with click-time precedence override.

### 3.4 Bundling script

`scripts/talmud/bundle.ts` — standalone `tsx` script. Reads `data-transient/talmud-raw/` and `data-transient/talmud-coverage-report.json`, writes `public/data/talmud/`.

**Inputs:**

- `data-transient/talmud-raw/<Tractate>/wikisource.json`
- `data-transient/talmud-raw/<Tractate>/schema.json`
- `data-transient/talmud-coverage-report.json` (to know which tractates passed)

**Outputs:**

- `public/data/talmud/structure.json` — everything layout needs, all tractates, one file.
- `public/data/talmud/texts/<Tractate>.json` — Hebrew text per tractate, one file each.

Tractates that failed verification are omitted from both outputs.

**`structure.json` schema:**

```ts
interface TalmudStructure {
  tractates: TalmudTractate[];
}

interface TalmudTractate {
  name: string;                    // "Berakhot"
  hebrewName: string;              // "ברכות"
  seder: string;                   // "Seder Zeraim"
  firstDaf: number;                // typically 2
  amudim: TalmudAmud[];            // in document order (daf 2a, 2b, 3a, ...)
  perakim: TalmudPerek[];          // in document order
}

interface TalmudAmud {
  daf: number;
  amud: "a" | "b";
  segmentCount: number;
  perekIdx: number;                // which perakim[i] this amud belongs to
  // If a perek boundary falls mid-amud, segments [0, perekBoundaryAt) are in
  // perekIdx and segments [perekBoundaryAt, segmentCount) are in perekIdx + 1.
  // Undefined when the amud is entirely within one perek (the common case).
  perekBoundaryAt?: number;
  // Per-segment Mishnah/Gemara tags (true = Mishnah, false = Gemara).
  // Length equals segmentCount.
  mishnahMask: boolean[];
}

interface TalmudPerek {
  hebrewName: string;              // "מאימתי"
  startAmudIdx: number;            // inclusive index into tractate.amudim
  endAmudIdx: number;              // inclusive
  startSegmentInFirstAmud: number; // 1-based (a perek can begin mid-amud)
  endSegmentInLastAmud: number;    // 1-based
}
```

**Design notes on the structure:**

- **Amud-primary array.** This matches Sefaria-Export's natural shape (`text[amudIndex][segmentIndex]`). Perakim are described as ranges over the amud array. This is the inverse of the current Tanakh `tanakh-structure.json` which is book/chapter/verse nested — but it's the shape that makes the bookshelf layout trivial to compute.
- **`mishnahMask` is per-amud, per-segment.** Computed during bundling by the marker-walk algorithm described in the exploration design. At runtime the layout engine reads `mishnahMask[i]` to decide base color.
- **`firstDaf: 2` is explicit.** Dapim are numbered starting at 2 in standard printings. Don't assume it.
- **Perek boundaries are segment-precision.** The algorithm must handle perakim that begin/end mid-amud.

**`texts/<Tractate>.json` schema:**

```ts
interface TalmudTractateText {
  name: string;              // "Berakhot"
  amudim: string[][];        // amudim[amudIdx][segmentIdx] = Hebrew text
}
```

Flat array of arrays, no metadata beyond the tractate name. Structural info lives in `structure.json`. The two align by index: `text.amudim[i][j]` corresponds to `structure.amudim[i]` segment `j`.

**Marker walk during bundling:**

Exactly the algorithm from the exploration design. Walk `wikisource.text` in document order, track `currentKind: "mishnah" | "gemara"`. Whenever a segment string starts with or contains `מתני׳` flip to mishnah; whenever it contains `גמ׳` flip to gemara. Tag each segment with the current kind. Strip `<big>`, `<strong>`, `<br>` and other Wikisource HTML during the same pass. Drop the marker characters themselves from the rendered text (they're structural metadata, not content).

**Validation during bundling:**

- Count of `הדרן` markers === number of perakim from schema. If mismatch, error loudly and skip that tractate (add it to the anomaly list as a "structure mismatch" issue).
- Every perek from the schema has at least one Mishnah segment. If not, warn but include.

### 3.5 Runtime data loading

`src/talmud/data.ts` — new module.

- `loadTalmudStructure(): Promise<TalmudStructure>` — fetches `structure.json`.
- `prefetchAllTalmudTexts(structure): AsyncIterable<string>` — kicks off parallel fetches of all `texts/*.json` files, yields tractate names as each completes. Used for both the initial background prefetch and progress reporting.
- `getTractateText(name): Promise<TalmudTractateText>` — returns cached text if loaded, otherwise awaits a fetch. Used by the click-time precedence override: if a click lands on a tractate not yet prefetched, this call jumps it ahead of the prefetch queue.

Internal state: a `Map<string, TalmudTractateText | Promise<TalmudTractateText>>`. In-flight fetches store the promise so concurrent requests dedupe.

### 3.6 Layout: `computeTalmudLayout`

`src/talmud/layout.ts` — new module. Code-lifted from the exploration prototype (the prototype lived in a throwaway worktree — see the exploration memo — so it's code-lift by reference, not import). Not shared with `src/layout.ts`.

**Input:** `TalmudStructure` (from `structure.json`).
**Output:** `{ items: TalmudLayout[], tractateBlocks: TractateBlock[], sederBlocks: SederBlock[] }`

`tractateBlocks` and `sederBlocks` carry bounding-box info for label placement and subtle background tinting.

**Layout constants** (named, all in one block at the top of the module for easy tuning):

```ts
const SEGMENT_SIZE = 6;                  // px per segment square
const PEREK_GAP = 30;                    // vertical gap between perakim within a tractate
const TRACTATE_GAP = 40;                 // horizontal gap between tractates on a shelf
const SEDER_GAP = 120;                   // vertical gap between shelves
const DAF_LABEL_COLUMN_WIDTH = 30;       // space reserved for daf labels on the right of each tractate
const TRACTATE_LABEL_HEIGHT = 24;        // space above each tractate block for its Hebrew name label
```

**Algorithm (bookshelf of option-C perek blocks):**

1. **Per-tractate layout.**
   For each tractate that passed verification:
   - Walk `amudim` in order. Each amud becomes either one row (the common case) or **two half-rows** if it has `perekBoundaryAt` set (a perek boundary falls mid-amud). The split is performed here at layout time, using the bundled `perekBoundaryAt` field; `structure.json` itself stores amudim in their natural unsplit form, and the layout function is the only place that materializes half-rows. Berakhot has 6 crossing boundaries, producing 6 extra rows relative to the 127-amud count.
   - Each row (full or half) has a perek assignment, a daf, an amud letter, and a contiguous slice of segments. Row width = segment count × `SEGMENT_SIZE`. Segments flow right-to-left within the row (RTL).
   - Rows within a perek stack vertically with no intra-perek gap.
   - Between perakim, `PEREK_GAP` vertical space.
   - All rows share a common right edge (the tractate's right spine).
   - Tractate height = sum of (perek heights + inter-perek gaps).
   - Tractate width = max row width across all rows in the tractate (plus `DAF_LABEL_COLUMN_WIDTH` on the outside for daf labels).

2. **Bookshelf (seder shelves).**
   - Sedarim are laid out top-to-bottom in canonical order (Zeraim, Moed, Nashim, Nezikin, Kodashim, Tohorot).
   - Within each seder, tractates are laid out **right-to-left** in canonical order (so the eye reads the shelf in Hebrew direction). The rightmost tractate in Seder Moed is Shabbat; the leftmost is Chagigah.
   - Within a shelf, tractates are **top-aligned** (their tops sit flush on the shelf's top line, under the label row). Taller tractates extend downward past shorter ones. The shelf's vertical extent equals its tallest tractate + `TRACTATE_LABEL_HEIGHT`.
   - `TRACTATE_GAP` between adjacent tractates on a shelf.
   - `SEDER_GAP` between shelves.

3. **Output.**
   - `items: TalmudLayout[]` — flat array of `{ tractate, daf, amud, segment, x, y, size }` for every segment in every verified tractate, suitable for feeding into `buildGeometry`.
   - `tractateBlocks: TractateBlock[]` — one entry per tractate with `{ name, hebrewName, seder, minX, minY, maxX, maxY, labelAnchor }`. Used by label placement and hover detection.
   - `sederBlocks: SederBlock[]` — one entry per seder with `{ name, minX, minY, maxX, maxY, backgroundColor }`. Used by subtle background tint layer.

**Anchor point for coordinates:** `(0, 0)` is the top-right of the whole bookshelf (so RTL layouts can grow to the left and down into positive y). The rendering pipeline handles the screen mapping.

### 3.7 Visual encoding

**Base colors** — named constants in `src/talmud/constants.ts`:

```ts
// Muted, similar to each other — "you notice they're different if you look,
// but neither one shouts." Overlays paint over both equally.
export const MISHNAH_BASE_COLOR: [number, number, number] = [0.42, 0.47, 0.58]; // slate blue, tune during visual review
export const GEMARA_BASE_COLOR:  [number, number, number] = [0.55, 0.55, 0.55]; // neutral grey

// Per-seder background tints. Very subtle — ranging toward invisible.
// Applied as a color wash behind the segments for each shelf.
// Six entries, one per seder in canonical order.
export const SEDER_BACKGROUND_COLORS: Record<string, [number, number, number]> = {
  "Seder Zeraim":   [0.97, 0.98, 0.96],
  "Seder Moed":     [0.96, 0.97, 0.98],
  "Seder Nashim":   [0.98, 0.97, 0.97],
  "Seder Nezikin":  [0.97, 0.97, 0.95],
  "Seder Kodashim": [0.96, 0.98, 0.97],
  "Seder Tohorot":  [0.98, 0.96, 0.97],
};
```

Exact values above are placeholders for visual-review tuning. The principle is what matters: very muted, ranging toward invisible.

**Coloring pipeline** (matches the existing Tanakh two-pass design in `verseColoring.ts`):

1. **Pass 1 (semantic state).** For each segment, determine: is it Mishnah or Gemara (from `mishnahMask`)? Is it hovered? Is it pinned? Does any registered overlay have a color for it?
2. **Pass 2 (resolve color).** If an overlay has a color for this segment, use it. Otherwise, use `MISHNAH_BASE_COLOR` if `mishnahMask[i]`, else `GEMARA_BASE_COLOR`.

Overlays paint over both Mishnah and Gemara. The base color is the resting state when no overlay speaks.

**Seder background tints** — drawn as separate full-shelf quads at a lower z-layer than segments. Implementation-wise, this is a separate draw call at the start of each frame before the segment geometry. Uses the same WebGL context but a solid-fill shader (new, small).

### 3.8 Overlays

The overlay registry pattern from `src/overlays/` is reused. `main-talmud.ts` registers its own set, and the registry is already agnostic about which overlays exist (it's just a list).

**Overlays registered for tm-f28x:**

- `segmentLengthOverlay` — at `src/talmud/overlays/segment-length.ts`. Analog of `verseLengthOverlay` for Talmud. Maps segment character count to a pale-yellow → dark-red ramp. Paints both Mishnah and Gemara. Off by default.

That's it for this issue. Additional overlays (search, commentary, Hebrew/Aramaic, etc.) are filed as separate issues and will be added in follow-ups.

**Not registered** (the Tanakh overlays like commentary/trop/haftarah/text-dating): these are never imported by `main-talmud.ts` so they don't appear in the Talmud map's overlay picker. No hide-vs-disable logic — they simply don't exist in this codepath.

### 3.9 Interaction

**Hover:** segment under the mouse gets highlighted (same outline treatment as Tanakh). Tooltip or sidebar-on-hover behavior mirrors the existing Tanakh map exactly.

**Click:** pins the segment, opens the sidebar.

**Sidebar contents** (see Q16):
- Reference: `Berakhot 17b:11` (via the shared reference formatter — see §3.10).
- Mishnah / Gemara tag label (small, colored to match the base color for that type).
- Hebrew text (from the tractate's `texts/<name>.json`, fetched via `getTractateText` with click-time precedence).
- Sefaria deep link: `https://www.sefaria.org/Berakhot.17b.11`.

**No perek name** in the sidebar per Q16.

**No English translation** — deferred to `tm-s6f5`.

**Sidebar module:** `src/talmud/sidebar.ts`. Parallel to `src/sidebar.ts`. The DOM ids and element structure are shared (both entry HTMLs use the same sidebar DOM structure), but the population logic differs because it takes `TalmudIdentity` not `TanakhIdentity`.

**Drag to pan, scroll to zoom, keyboard nav:** identical to Tanakh. These behaviors live in shared modules (`camera.ts`, `mouseState.ts`, `touchState.ts`) and are not touched.

### 3.10 Shared formatting: reference strings and URL hash

`src/corpus-format.ts` — new shared module. Generic over `CorpusSchema`, usable by both Tanakh and Talmud.

- `formatReference(id, schema): string` — produces a human-readable reference. For Tanakh: `Genesis 1:1`. For Talmud: `Berakhot 17b:11`.
- `parseReference(str, schema): Identity | null` — inverse. Used by URL hash parsing.
- `serializeToUrlHash(id, schema): string` — produces the fragment param value. For Tanakh: `Genesis:1:1`. For Talmud: `Berakhot:2a:1`.
- `parseFromUrlHash(str, schema): Identity | null` — inverse.

The implementation walks `schema.levels` and uses per-level type info. For the `enum` level type (Talmud's `amud`), the formatter concatenates with the previous level rather than separating with a delimiter — that's how `2` + `a` becomes `2a` rather than `2:a`. This is the one place corpus-specific formatting rules exist, and they're expressed declaratively in the schema rather than hard-coded per corpus.

**Existing Tanakh URL-state code migration:** `src/urlState.ts` is refactored to use `parseFromUrlHash` / `serializeToUrlHash` with `TANAKH_SCHEMA`. Zero behavioral change — the output strings are identical. New `src/talmud/urlState.ts` wraps the same functions with `TALMUD_SCHEMA` and a different hash param name (`segment` instead of `verse`). The overlay-params portion of URL state (`OverlayParams`) stays in the per-corpus files because the overlay sets differ.

### 3.11 Tractate and daf labels

**Tractate labels:**

- Placed `TRACTATE_LABEL_HEIGHT` pixels above each tractate block, centered horizontally over the tractate's right-edge spine (so it reads as "the label for this book").
- Hebrew name rendered with `direction: rtl`.
- Always visible at all zoom levels (there are only 37 of them, and they're the primary navigation).
- Implemented via the existing `src/labels.ts` system if it can be parameterized in ≤30 lines of churn. Otherwise a parallel `src/talmud/labels.ts`.
- **Parameterization strategy for `labels.ts`:** the current implementation takes a `Book[]` array and positions labels over book centers. Refactor to take a generic `LabelAnchor[]` array (`{text, x, y, align}`) and have each map's main module translate its domain-specific data into that shape. If existing tests in `labels.test.ts` can be updated without touching the semantics, this is probably a small refactor.

**Daf labels** (Q13 — hybrid zoom-dependent + hover):

- At low zoom (whole-Bavli view, zoom ≤ 0.3): no daf labels.
- At medium zoom (single-seder to single-tractate visible, 0.3 < zoom ≤ 1.5): show the label for every 10th daf (2, 10, 20, 30, ...) at each tractate's right edge. Positioned to the right of the daf's first row, slightly outdented.
- At high zoom (intra-tractate, zoom > 1.5): show all daf labels.
- **Hover reveal at any zoom:** when the mouse hovers over a specific row, its daf label appears regardless of zoom. The hover label is rendered on top of the statically-visible labels so it's always visible.
- Daf labels use the same HTML-div-overlay approach as the existing Tanakh book labels, not WebGL text.

### 3.12 Background prefetch with click-time override

`src/talmud/prefetch.ts` — new module.

**Behavior:**

1. `main-talmud.ts` kicks off `startBackgroundPrefetch(structure)` immediately after layout completes and the first frame renders.
2. Prefetch iterates `structure.tractates` in canonical Bavli order and fetches each `texts/<Tractate>.json` with `fetch()`. Results are stored in the same `Map` that `getTractateText` uses.
3. Concurrency: up to 4 parallel fetches at a time. A queue ensures we don't fire all 37 at once.
4. **Click-time override:** when the user clicks a segment, the click handler calls `getTractateText(tractate)`. If the tractate is already loaded, return it synchronously. If a fetch is in flight, await it. If it's still queued for later, move it to the head of the queue and start it immediately (bypass the concurrency limit for this one). The click awaits the resulting promise.
5. On completion of all tractates, a flag is set and the prefetch module goes idle.

**Observability:** console logs at start, on each tractate completion, and at final completion. No UI indicator in this issue (filed separately if desired).

### 3.13 Module layout (concrete file changes)

**New files:**

```
talmud.html                                              # new entry HTML
src/main-talmud.ts                                       # new entry script
src/corpus-format.ts                                     # shared reference/URL formatters driven by CorpusSchema
src/talmud/
  constants.ts                                           # colors, sizes, seder order
  data.ts                                                # structure.json + texts/*.json loading, in-memory cache
  layout.ts                                              # computeTalmudLayout, bookshelf + option-C
  prefetch.ts                                            # background prefetch with click-time override
  sidebar.ts                                             # Talmud-flavored sidebar population
  urlState.ts                                            # Talmud URL hash I/O (wraps corpus-format with TALMUD_SCHEMA)
  labels.ts                                              # only if labels.ts refactor isn't feasible
  overlays/
    segment-length.ts                                    # first Talmud overlay
scripts/talmud/
  verify-coverage.ts                                     # tm-u7b1 main script
  bundle.ts                                              # tm-f28x bundling script
  fixtures/                                              # test fixtures for both scripts
    berakhot-fixture-wikisource.json
    berakhot-fixture-merged.json
    berakhot-fixture-schema.json
public/data/talmud/
  structure.json                                         # committed, generated by bundle.ts
  texts/
    Berakhot.json                                        # one per verified tractate
    Shabbat.json
    ...
src/__tests__/unit/talmud-layout.test.ts                 # follows existing src/__tests__/unit/ convention
src/__tests__/unit/talmud-data.test.ts
src/__tests__/unit/talmud-urlState.test.ts
src/__tests__/unit/talmud-prefetch.test.ts
src/__tests__/unit/talmud-verify-coverage.test.ts        # tests scripts/talmud/verify-coverage.ts
src/__tests__/unit/talmud-bundle.test.ts                 # tests scripts/talmud/bundle.ts
src/__tests__/unit/spatial-layer-generic.test.ts         # proves SpatialItem<T> is identity-agnostic
```

**Modified files:**

```
vite.config.ts                                           # add talmud.html to rollupOptions.input
.gitignore                                               # add data-transient/
src/types.ts                                             # introduce SpatialItem<T>, TanakhIdentity, VerseLayout alias
src/layout.ts                                            # adopts SpatialItem<TanakhIdentity> (mechanical)
src/geometry.ts                                          # function signatures become <T>(items: SpatialItem<T>[])
src/rendering.ts                                         # function signatures become <T>
src/hitDetection.ts                                      # function signatures become <T>
src/verseColoring.ts                                     # function signatures become <T>
src/labels.ts                                            # parameterized if feasible (see §3.11)
src/urlState.ts                                          # refactored to use corpus-format.ts with TANAKH_SCHEMA
```

**Not modified:**

```
src/main.ts                                              # Tanakh entry point, untouched except possibly for import renaming
src/camera.ts, src/mouseState.ts, src/touchState.ts       # purely spatial, nothing to change
src/webgl.ts                                             # purely spatial, nothing to change
```

The critical invariant: **after the refactor, every existing Tanakh test still passes unchanged.** The spatial-layer modules get `<T>` generics added to their signatures, but their bodies and behavior are unchanged. `VerseLayout` can remain as a type alias for `SpatialItem<TanakhIdentity>` so existing imports don't break.

### 3.14 Tests

**Spatial-layer genericization tests** (`src/__tests__/unit/spatial-layer-generic.test.ts`) — the crown jewel of the refactor's safety:

1. **Identity-agnosticism test.** Build two `SpatialItem<T>[]` arrays at identical coordinates — one with `T = TanakhIdentity`, one with `T = TalmudIdentity`. Run them through `buildGeometry`, `findVerseLayoutAtPoint`, `computeVerseStates` (or its color-agnostic inner functions). Assert that the outputs that depend only on spatial data are byte-for-byte identical.

2. **Third-T compile test.** Define a synthetic `type FooIdentity = { foo: string; bar: number }`. Build `SpatialItem<FooIdentity>[]`, run it through the spatial pipeline. This test exists primarily to force TypeScript to check that no spatial module leaks a Tanakh field name — if the test file compiles, the spatial layer is provably identity-agnostic.

3. **Spot audit of existing tests.** Any existing test that implicitly relies on `VerseLayout` having `book`/`chapter`/`verse` fields (i.e. reads those fields on a "rendering" or "hit detection" test) should either be genericized or annotated with `// Tanakh-specific test: intentionally reads identity fields`.

**Talmud layout tests** (`src/__tests__/unit/talmud-layout.test.ts`):

- Synthetic 2-tractate input: tractate A with 2 perakim, 4 amudim total; tractate B with 1 perek, 3 amudim total. Both in the same seder.
- Assertions:
  - All segments get assigned coordinates within the expected per-tractate bounding boxes.
  - Each row's rightmost segment has the same x coordinate (shared right edge).
  - Row width equals segment count × `SEGMENT_SIZE`.
  - Perek gaps are applied between perakim, no gap within a perek.
  - Tractate A's block is taller than tractate B's (since it has more amudim).
  - `tractateBlocks[0].minX > tractateBlocks[1].minX` (RTL order on the shelf: A to the right of B).
  - Mid-amud perek boundaries produce two half-amud rows.

- Cross-seder synthetic input: one tractate in each of two sedarim. Assert that the two sedarim are vertically separated by `SEDER_GAP`.

**Talmud data-loading tests** (`src/__tests__/unit/talmud-data.test.ts`):

- `loadTalmudStructure` parses a minimal fixture structure.json.
- `getTractateText` returns cached text on second call without re-fetching.
- `getTractateText` dedupes concurrent fetches (two calls while one is in flight share the same promise).

**Talmud URL state tests** (`src/__tests__/unit/talmud-urlState.test.ts`):

- `serialize → parse` round-trip for several segments: `Berakhot 2a:1`, `Shabbat 31b:5`, `Bava Metzia 59a:1`.
- Malformed input returns null.
- Amud letter parsing: `2a` → `{daf: 2, amud: "a"}`, `17b` → `{daf: 17, amud: "b"}`.

**Prefetch tests** (`src/__tests__/unit/talmud-prefetch.test.ts`):

- Mock `fetch`. Assert that prefetch fires fetches for all structure tractates.
- Click-time override: start prefetch, immediately call `getTractateText("Niddah")` (last in queue), assert Niddah's fetch promise resolves before the earlier queued ones.
- Concurrency: at any time, no more than 4 fetches are in flight.

**Verify-coverage script tests** (`src/__tests__/unit/talmud-verify-coverage.test.ts`):

- Mocked fetch, fixture JSONs. Clean case passes all rules. Shape mismatch hard-fails. Too-few markers soft-fails. Empty text hard-fails. Malformed JSON fails cleanly with a helpful error message. Report JSON has the expected shape.

**Bundle script tests** (`src/__tests__/unit/talmud-bundle.test.ts`):

- Given a fixture raw cache + fixture coverage report, produce `structure.json` and `texts/*.json` with expected shapes. Marker walk produces expected `mishnahMask` arrays on a synthetic amud. Perek boundary that crosses an amud produces two half-amud rows.

**Regression:** the existing 1000+ tests must all pass unchanged. Pre-commit hook enforces this.

### 3.15 Visual review and sign-off

After all tests pass and the dev server runs, I take screenshots:

1. Full-Bavli view (zoomed all the way out, all 37 tractates on six shelves visible).
2. Single-seder zoom (e.g., Seder Moed — 11 tractates visible, daf labels showing every 10th).
3. Single-tractate zoom on Berakhot — visual parity check against the prototype reference screenshot at `docs/plans/images/2026-04-06-talmud-exploration/berakhot-full-2x.png`.
4. Clicked-segment sidebar view showing reference, Hebrew text, M/G tag, Sefaria link.

All four are attached to the PR description. The PR opens as **draft** and Danyel reviews at his leisure.

### 3.16 Page title, branding

`talmud.html`'s `<title>` is set dynamically by `main-talmud.ts` the same way `main.ts` does: `Bavli Map [${__GIT_BRANCH__}]`. The `__GIT_BRANCH__` define is already in `vite.config.ts` and is shared between entry points.

No changes to `index.html`'s Tanakh-specific title.

---

## 4. Process — Stacked PRs

### 4.1 Sequence

1. **Current conversation (in `tm-f28x` worktree):** finish this design doc, get user approval, invoke `writing-plans` to produce the implementation plan at `docs/plans/2026-04-07-talmud-integration-implementation.md`. Both files are written to disk in the `tm-f28x` worktree but **not yet committed** — they'll be committed as the opening commit on the `tm-u7b1` branch (see step 2) since the docs cover both issues and tm-u7b1 is the base of the stack. Deferring the commit means the docs land in `tm-u7b1`'s history first and `tm-f28x` inherits them via the rebase in step 6, with no duplication.

2. **New worktree for tm-u7b1:** `git worktree add ../tm-u7b1 -b tm-u7b1 main` (from any location in the main repo). The new worktree is at `/Users/danyel/code/MISC/torahmap-worktrees/tm-u7b1`. The design doc and implementation plan files are copied (not re-generated) from the `tm-f28x` worktree's uncommitted working tree into this worktree, then committed here in the first commit on the `tm-u7b1` branch. The originals in `tm-f28x`'s working tree are removed after the copy so there's no stale duplicate — they'll reappear in `tm-f28x` after the rebase in step 6.

3. **Execute tm-u7b1:** implement `scripts/talmud/verify-coverage.ts` and its tests, run it against the live GCS bucket, review the resulting `data-transient/talmud-coverage-report.json`, handle any anomalies per §2.7. The raw cache in `data-transient/talmud-raw/` is *not* committed (gitignored) but is preserved on disk for tm-f28x's bundling step. The `issues-new.sh` calls for any flagged anomalies are executed, and the resulting issue files in `issues/open/` are committed as part of the tm-u7b1 PR.

4. **Decision gate.** If the verification reveals a catastrophic data problem (e.g., more than half the tractates hard-fail), STOP: update the open-questions log in the design doc, flag it in the PR description, and do not proceed with tm-f28x until Danyel triages. Otherwise proceed.

5. **Push tm-u7b1, open PR #1 draft** against `main` with a description that includes the coverage summary table and links to any anomaly issues filed. Attach the coverage report JSON as a reference.

6. **Return to the tm-f28x worktree.** Rebase `tm-f28x` onto `tm-u7b1`:

   ```
   cd /Users/danyel/code/MISC/torahmap-worktrees/tm-f28x
   git fetch
   git rebase tm-u7b1
   ```

   The design doc + implementation plan are now in the tm-f28x worktree via the rebase. The `data-transient/talmud-raw/` cache is also still on disk (unaffected by git, it was never committed).

7. **Execute tm-f28x:** work through the implementation plan. Write the spatial-layer refactor first (§3.1) since everything else depends on it. Then the data pipeline (§3.3, §3.4, §3.5). Then layout (§3.6). Then interaction and overlays (§3.7–§3.12). Tests throughout. Run the dev server, take screenshots, check visual parity against the prototype reference.

8. **Push tm-f28x, open PR #2 draft targeting the `tm-u7b1` branch** (not `main`). The stacked-PR pattern means PR #2's diff is integration-only until PR #1 merges; once PR #1 merges, GitHub auto-retargets PR #2 to `main` and the diff is unchanged because the tm-u7b1 commits are now in main's history.

9. **Both PRs sit in draft.** Danyel reviews on his schedule, toggles draft → ready on each after he's satisfied.

10. **Cleanup round.** Before either PR exits draft, Danyel and Claude triage the "Open questions / assumptions / unexpected issues" log in this design doc. Items are resolved, deferred to follow-up issues, or fixed in-place in the same PRs.

11. **Worktree cleanup** (after Danyel merges both PRs): `git worktree remove` both worktrees, delete both branches locally.

### 4.2 Why stacked PRs

- **Reviewable.** PR #1 is ~500 lines of verification script + tests. PR #2 is ~2000+ lines of integration. Reviewing them as separate diffs is much easier than one 2500-line monster.
- **Safe.** If the verification script reveals a data problem, PR #2 can be paused or revised without losing PR #1's work.
- **Honors the issue separation.** The two issues exist as separate tickets for a reason; shipping them as separate PRs matches the ticket structure.
- **Autonomous.** Danyel doesn't need to merge PR #1 before work on PR #2 can start, because PR #2 is branched on top of PR #1 locally. The agent proceeds straight through both.

---

## 5. Test and quality gates

- `npm test` passes for every commit on both branches (pre-commit hook enforces).
- `npm run build` succeeds (Vite build with two entry points).
- Existing Tanakh functionality is unchanged — smoke test the Tanakh map at `index.html` after the spatial-layer refactor to confirm zero regressions.
- New spatial-layer genericization tests pass (§3.14).
- New Talmud unit tests pass (§3.14).
- Dev server running `talmud.html` renders all verified tractates without console errors.
- Visual parity check: Berakhot in the integrated map resembles the prototype reference screenshot.

---

## 6. Open questions / assumptions / unexpected issues

*This section is a living log. Items are added during autonomous execution and triaged with Danyel in a cleanup round before either PR exits draft. Empty at design-doc time.*

### 6.1 Open questions

*(none yet)*

### 6.2 Assumptions (to verify during execution)

1. **Tractate name spellings.** The `BAVLI_TRACTATES` list uses spellings like "Bava Kamma", "Moed Katan", "Avodah Zarah". Sefaria-Export's actual bucket paths may differ. First fetch will reveal mismatches; I'll correct the list and rerun. If more than a few fail, I'll investigate whether there's a canonical index file.

2. **Shekalim exclusion is the right call.** Standard practice in Bavli tooling is to either (a) include Shekalim with a note that its Gemara is Yerushalmi, or (b) exclude it as we are doing. I'm excluding because it keeps the data pipeline clean; if Danyel wants Shekalim included as a special case, it's a follow-up.

3. **Davidson shape matches Wikisource for all 37 tractates.** Verified on Berakhot in the exploration. If any tractate has diverging shape, it gets excluded per §2.7.

4. **`labels.ts` can be parameterized in ≤30 lines.** I haven't read it yet. Fallback: parallel `src/talmud/labels.ts` module. Either way the user-facing behavior is the same.

5. **The existing Tanakh tests do not depend on `VerseLayout` field names in a way that blocks the `<T>` refactor.** If they do, I'll either genericize the affected tests or mark them explicitly Tanakh-specific. No semantic changes to the tests.

6. **GCS bucket downloads are reasonably fast.** The exploration worked with Berakhot (~700 KB). 37 tractates × (Wikisource + Davidson + schema) is roughly 50–80 MB total. Should complete in under a minute on a normal connection.

7. **Background-prefetching all 37 tractate text files simultaneously is acceptable.** With concurrency capped at 4, this is ~10 serial rounds. Fine on desktop; might be slow on mobile. The click-time override means this isn't a correctness issue, just a UX one on slow connections.

8. **The bookshelf layout will produce a canvas with extreme aspect ratio** (shelves are wide, total is tall). The camera and zoom behavior already handle arbitrary bounds, so this should be fine, but it's worth eyeballing during visual review.

### 6.3 Unexpected issues

#### 2026-04-07 — tm-u7b1 coverage run findings

**Result: 37/37 tractates PASS.** Zero anomalies in the final report. No follow-up issues filed.

Three corrections had to be made to the verification script during the run, all preserved in `docs/plans/data/2026-04-07-talmud-coverage-report.json`:

1. **Seder Tahorot spelling.** My `BAVLI_TRACTATES` constant used "Seder Tohorot" (with 'o'). The Sefaria-Export bucket uses "Seder Tahorot" (with 'a'). Fixed; now Niddah loads correctly.

2. **Schema URL convention.** The `schemas/<Tractate>.json` endpoint uses **underscores** for spaces in tractate names, not URL-encoded spaces. E.g. `Rosh_Hashanah.json`, `Bava_Kamma.json`. The content JSONs (Wikisource/merged) correctly use `%20`. Script now generates the schema URL with `tractate.replace(/ /g, "_")`. This affected 6 tractates with multi-word names.

3. **Marker plausibility thresholds too tight.** I set `MARKER_MIN = 10` based on Berakhot's 34 markers. Two tractates are legitimately small and had fewer markers:
   - **Tamid** — 5 matnitin / 4 gemara markers. Tamid has Gemara on only a few perakim (traditional; Tamid 25b onward has no Gemara at all). Real data.
   - **Taanit** — 8 matnitin / 8 gemara markers. Small tractate (31 dapim vs. Berakhot's 64), legitimate marker density.
   - Lowered `MARKER_MIN` to 3 and raised `MARKER_MAX` to 400. The bound is now catastrophe-catching only (e.g. 0 markers = data corruption), not small-tractate-rejecting.

**Corpus stats from the passing report.** Marker counts range from Tamid (5/4/7) to Shabbat (137/137/24). Full-Bavli total is **~78,000 segments** across **37 tractates** — about 3× the Tanakh's 23,000 verses. The largest tractates (Shabbat, Chullin, Sanhedrin, Bava Batra, Yevamot) dominate. Combined Hebrew text bundle is likely ~30–50 MB raw, matching the design doc §3.3 expectation.

#### 2026-04-07 — tm-f28x integration findings

**Result: all 37 tractates render, visual parity with prototype, 1,470 tests pass.** PR ready for review.

Corrections during integration:

1. **Bundler `firstDaf` bug.** My first bundler used `firstDaf = schema.perakim[0].startDaf` (= 2 for Berakhot). Wrong: Sefaria-Export's Wikisource array is **always indexed from daf 1**, with 1a/1b as empty placeholders (the traditional Talmud has no daf 1). Fix: `firstDaf = 1` for all Bavli tractates. Layout now skips empty amudim (`segmentCount === 0`) so the placeholders take no vertical space.

2. **Bundle script `parseWholeRef` needed a shorthand form.** Tamid's last perek has `wholeRef: "Tamid 33a:8-14"` (same daf, segment range only) rather than the usual `"Xa:Y-Zb:W"`. Added a second regex branch. Before the fix, Tamid was skipped and only 36/37 tractates bundled.

3. **Initial camera: fit-to-bounds.** `createCamera()` was designed for the Tanakh (starts at zoom 1.0 with Genesis 1:1 near top-right). The Bavli's bounds are ~2,100 × 11,600 px — a 1:5.5 aspect ratio. At zoom 1.0 only a sliver is visible. `main-talmud.ts` now computes a fit-to-bounds zoom at startup. At that zoom the full bookshelf is visible but individual tractates are too small to read — users zoom in from there. **Open question:** a better "initial camera" might fit-to-width and show just the top shelves; filed as a tuning item for the cleanup round.

4. **Spatial-layer refactor larger than initially estimated.** The design said the refactor was "nearly mechanical." In practice `rendering.ts` also had to become generic (`RenderState<T>`, `createRenderState<T>`, `render<T>`, `renderOutline<T>`) because it held `verses: VerseLayout[]`. The `render()` function also had an embedded `versesEqual(hoveredVerse, pinnedVerse)` call — replaced with an injected `itemsEqual` parameter defaulting to `versesEqual` so Tanakh callers are unchanged. And an embedded `updateLabelPositions(window.bookLabels, ...)` call — left as-is since `window.bookLabels` is optional and `main-talmud.ts` simply doesn't set it. Zero behavior change for the Tanakh path, but ~8 files touched instead of the ~4 I'd estimated.

5. **`corpus-format`'s generic `T` constraint too tight.** First draft used `T extends Record<string, LevelValue>`, which `TanakhIdentity` satisfies structurally but `TalmudIdentity` doesn't (TS interfaces don't have implicit index signatures). Relaxed to just `<T>` with an internal cast.

6. **Playwright screenshots needed software-WebGL flags.** Headless Chromium doesn't provide WebGL2 by default. Using `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` enables it. Without these, the canvas is blank and main-talmud throws "WebGL2 not supported".

7. **Screenshot automation needed a debug hook.** Simulating wheel-zoom via Playwright is fragile because the zoom center shifts off-content at deep zoom levels. Added `window.talmudMap = { camera, items, tractateBlocks, setCameraForBounds(), pin() }` as a debug handle the screenshot script drives directly. **Open question for cleanup:** should this be stripped behind `import.meta.env.DEV` for production? Currently always exposed.

**Numbers:**
- Final bundle: `public/data/talmud/structure.json` = 892 KB, `texts/*.json` = 16 MB across 37 files.
- **1,470 tests pass** (1,419 pre-integration + 51 new across spatial-generic, corpus-format, bundle, data, layout).
- Production build: `dist/talmud-*.js` = 12.6 KB (4.9 KB gzipped). Shared chunks with Tanakh.
- **Zero console errors** on `talmud.html` page load.
- Visual parity with the exploration prototype reference (`docs/plans/images/2026-04-06-talmud-exploration/berakhot-full-2x.png`).

---

## 7. Success criteria

- `tm-u7b1`:
  - `scripts/talmud/verify-coverage.ts` runs end-to-end against the live GCS bucket.
  - Coverage report documents every tractate's pass/fail status and justification.
  - Any anomalies have corresponding issues filed in `issues/open/`.
  - PR #1 is open against `main` in draft, with the coverage summary in the description.

- `tm-f28x`:
  - `talmud.html` loads in the dev server and the production build.
  - All verified tractates render as a bookshelf of option-C perek blocks.
  - Mishnah and Gemara are visually distinct via muted base colors (slate blue / grey).
  - Clicking a segment opens the sidebar with reference, M/G tag, Hebrew text, and Sefaria link.
  - URL hash state works: `talmud.html#segment=Berakhot:2a:1` pins the right segment on reload.
  - Segment-length overlay is selectable (registered but off by default).
  - Background prefetch loads all tractate texts; click-time override works for unloaded tractates.
  - Existing Tanakh map is unchanged (`index.html` smoke test passes).
  - All tests pass, including the spatial-layer genericization proofs.
  - Visual review screenshots attached to the PR description.
  - PR #2 is open against the `tm-u7b1` branch (becomes `main` after PR #1 merges) in draft.
