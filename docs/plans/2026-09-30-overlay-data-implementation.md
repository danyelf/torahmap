# Overlays Receive Their Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commentary, haftarah, trop, verse length and text dating stop loading their own data: each names its files, main loads every path once, and each member is handed the data as an argument — with nothing a reader sees changing.

**Architecture:** One loader (`src/dataFiles.ts`) fetches a set of paths under `public/data/` once each into one value, `loaded`, keyed by path. `dataFor(overlay, loaded)` gives an overlay its files under its own names, or `null` until all are in. The `Overlay` type gains a third parameter `D`; `toolsShown` returns `{ tool, settings, data }` and leaves out a tool whose data is missing; the map, the hover check, the legend summary, the verse popup and the story blender all take the data from there. Startup still waits for everything; `prebuild` runs at idle after the first frame.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Playwright (layout tests), Node type-stripping for `scripts/print/`.

**Spec:** `docs/plans/2026-09-30-overlay-data-design.md` — implement its two "Step 1" sections and its "Testing" section, nothing from steps 2 or 3. Read it before Task 1.

## Global Constraints

- Nothing a reader sees changes: `npm run test:layout` passes with `layout/known.ts` untouched, and the screenshots match the baseline taken in Task 0.
- No link format, link parameter or data file under `public/data/` changes.
- Search keeps its own loading (`loadLexiconData`, `buildSearchIndex`, search's `configure`) — step 2 handles it.
- The Talmud page's overlays name no files and take no data.
- Startup waits for everything, as today.
- An overlay names its files as `data: { <its own name>: '<path under public/data>' }`; it never fetches.
- Data is always a member's last argument. Members that draw the map and members that read a verse take `data: D`; `renderControls` and `renderLegend` take `data: D | null`.
- An overlay that names no files is handed `undefined` wherever data is handed, as an overlay without settings is handed `undefined` settings.
- Tests check behaviour: no assertions on wording readers see, on counts taken from shipped data, or on timings. No download mocks in overlay unit tests.
- Comments describe the code as it is now; no ticket numbers, dates, step numbers or "used to" in code, test names or comments (AGENTS.md).
- Use `npm` (the repo has `package-lock.json`). Imports reachable from `scripts/print/` use explicit `.ts` extensions, `import type` for types, and no CSS (it runs under plain `node`).

## Review Focus

1. **A caller the type checker cannot see.** Most tests are not typechecked (#329). Data is always the last argument, so no existing argument moves: a call not yet updated passes no data rather than a value in the wrong slot. `test-harness/main.ts` is typechecked by `npm run typecheck`. Expected: the harness still types and searches; checked in a browser in Task 2, Step 13.
2. **The same `loaded` must give the same data object.** Overlays keep what they derive per data value; if `dataFor` built a fresh object per call, trop would rebuild its index on every paint (a frozen map) and `prebuild` would warm nothing. Expected: `dataFor(o, loaded) === dataFor(o, loaded)`. Pinned in Task 2, Step 1.
3. **New data, stale derivation.** When an overlay is handed a different data value, its colours, legend and key follow the new value, not what was derived from the old. Pinned in each overlay task (commentary's maximum, verse length's range, trop's marks, haftarah's readings).
4. **Missing data in the panel.** `renderControls`/`renderLegend` with `null` must not throw, and controls drawn first with `null` must fill in when drawn again with data (trop's chart and haftarah's key are built once per container). Pinned in Tasks 4–8.
5. **A story stop drawn before its data.** A stop's picture made while its overlay's files are missing must not be cached, or the stop shows without its overlay forever after. Pinned in Task 2, Step 1 (blender test).

---

## Standing rules for the unattended run

These bind every task and every subagent.

1. **Decide alone** anything the spec settles, and any small conflict between the plan and the code (a name, an import path, a test that needs a different fixture). Log each such decision as a dated entry in the section **"Open questions, assumptions and rulings"** at the end of `docs/plans/2026-09-30-overlay-data-design.md` (Task 1 creates it), and commit the entry with the task it belongs to.
2. **Stop and wait** — commit nothing further, send a push notification to Danyel (the `PushNotification` tool if the session has it; if not, `SendMessage` to `team-lead` saying a push could not be sent, per Fail Loudly), and wait for an answer — for anything that would change what a reader sees, a link's format, or a data file, or anything the spec does not cover. A layout-test failure or a screenshot that differs from the baseline counts as "changes what a reader sees".
3. **Never skip the pre-commit hook** (`--no-verify`) except on a commit that touches only Markdown. If the hook fails on a timeout in a file the task did not touch, rerun the commit once and say so in the task report; a second failure is a stop.
4. **Plain shell commands only.** No `cd X && …`, no `;`-chained or `&&`-chained commands: the worktree guard rejects them. Run each command on its own from the worktree root `/Users/danyel/code/MISC/torahmap/.claude/worktrees/overlay-data`, using absolute paths or `git -C`.
5. **Never touch another worktree** or the primary checkout. Never `git stash`.
6. **Layout tests:** run `npm run test:layout` at the end of every task marked *(draws)*, and at the end of the run. It must pass with `layout/known.ts` unchanged, and the shots must match the Task 0 baseline (rule 2 if not).
7. **Before each commit:** `node_modules/.bin/prettier --write <the files you changed>`, then `npm run typecheck`, then `npx vitest run`. Fix every type error in one pass.
8. Commit messages end with a blank line and `Co-Authored-By: <your model name> <noreply@anthropic.com>` (e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
9. **Finish** (Task 11): push the branch, open a PR against `main` that embeds layout screenshots by commit-pinned URL and links the design doc and its decision log; the PR says `Fixes #327` and is step 1 of 3 for #313 — it must **not** say `Closes #313` (or `Fixes #313`/`Resolves #313`). Everything posted to GitHub starts with `🤖 Claude:`.

---

## Where every Overlay member is called today

The plan changes each of these; the list is here so a task can be checked against it.

| Member | Callers outside the overlay files |
|---|---|
| `getVerseColor` | `src/talmud/overlays/mg-base.ts:61,63` (Talmud, unchanged); tests: `src/__tests__/helpers/overlayHost.ts:73`, `helpers/fixtures.ts:127` (`testOverlay`), `integration/overlay-switching.test.ts:85,269,447,448,491`, `src/scrollytelling/__tests__/overlayBlender.test.ts:40,218,238` |
| `colorsFor` | `src/itemColoring.ts` `overlayColorsFor` only; through it `toolsPicture` and `src/main-talmud.ts:100` |
| `getHoverInfo` | `src/sidebar.ts` `updateSidebar` (overlay and search); tests: `overlayHost.ts:79`, `overlay-switching.test.ts:283`, `unit/sidebar.test.ts:338` |
| `renderSidebarInfo` | `src/sidebar.ts:152`; tests: `unit/overlays/verse-length.test.ts:502,517,528,540` |
| `highlightVerseText` | `src/sidebar.ts` (overlay and search); tests: `overlayHost.ts:83`, `sidebar.test.ts:400,433` |
| `summary` | `src/main.ts:360` `updateLegend` |
| `renderLegend` | `src/main.ts:1076`; tests: `overlayHost.ts:86`, `overlay-switching.test.ts:82,254` |
| `renderControls` | `src/main.ts:1084` (overlay), `src/main.ts:1131` (search); `test-harness/main.ts:156`; tests: `overlayHost.ts:40`, `overlay-switching.test.ts:77,246,296`, `integration/url-state-sync.test.ts:133`, `integration/view-state-restore.test.ts:41` |
| `hoverChangesColors` | `src/itemColoring.ts:115` `layerToRecompute`; `src/scrollytelling/overlayBlender.ts:50` (presence only); tests: `overlayHost.ts:76`, `overlay-switching.test.ts:384` (presence), `unit/verseColoring.test.ts:80,116-121` |
| `getSefariaConnectionParam` | `src/sidebar.ts:115` (unchanged: takes no data) |
| `init` | `src/main.ts:252`; tests: `url-state-sync.test.ts:50,64,128,336`, `view-state-restore.test.ts:37`, `overlay-switching.test.ts:73`, `unit/story-file.test.ts:26`, `unit/overlays/text-dating.test.ts` (many), `unit/overlays/haftarah.test.ts` (many) |
| `destroy` | `src/main.ts:1069` (overlay switch), `src/main.ts:1128` (search; stays); tests: `overlayHost.ts:89`, `overlay-switching.test.ts:55,64,162` |
| `configure` (module exports) | `src/main.ts:248-250` (+ `1219` search, stays); re-exported by `src/overlays/index.ts:12-15`; tests: `unit/overlays/commentary.test.ts`, `trop.test.ts`, `verse-length.test.ts`, `overlay-switching.test.ts:42-43`, `url-state-sync.test.ts:33-34`, `view-state-restore.test.ts:54-55` |
| `loadReadings`/`mappings`/`deriveHaftarah` | `src/overlays/haftarah.ts`; `scripts/print/views.ts:7-10,180-182`; tests: `scripts/print/__tests__/views.test.ts:2,23,30,31`, `unit/story-file.test.ts:19,26,37` |
| `loadJson` | `src/overlays/commentary.ts`, `text-dating.ts`, `haftarah/readings.ts` |
| `getVerseDatingInfo` | `src/overlays/text-dating.ts` only; tests: `text-dating.test.ts` |
| Story blender | `computeBlendedColors` at `src/main.ts:416,1568`; `pictureForStop` only inside the blender; tests: `overlayBlender.test.ts` |
| `toolsShown` | `src/main.ts:331`, `src/scrollytelling/overlayBlender.ts:60`; tests: `unit/tools.test.ts` |
| `layerToRecompute` | `src/main.ts:425`; tests: `unit/verseColoring.test.ts` |

## File map

- Create `src/dataFiles.ts` — `Loaded`, `loadFiles`, `filesFor`, `dataFor`, `overlayFiles`. The one place a download is fetched, parsed and its failure handled.
- Create `src/overlays/prebuild.ts` — `prebuildAll`, which calls each overlay's `prebuild` at idle, one at a time.
- Create `src/utils/idle.ts` — `whenIdle`, shared by the morphology prefetch and `prebuildAll`.
- Create tests `src/__tests__/unit/dataFiles.test.ts`, `src/__tests__/unit/overlays/prebuild.test.ts`.
- Modify `src/overlays/types.ts` (the `D` parameter), `src/overlays/memo.ts` (rename), `src/tools.ts`, `src/itemColoring.ts`, `src/sidebar.ts`, `src/scrollytelling/overlayBlender.ts`, `src/main.ts`, `src/main-talmud.ts`, `src/talmud/overlays/*.ts`, `src/verseTexts.ts`, `src/search/dictionary.ts`, every overlay file, `src/overlays/index.ts`, `scripts/print/views.ts`, `test-harness/main.ts`, and the tests listed above.
- Delete `src/overlays/loadJson.ts`.

## Shared names (every task relies on these)

```ts
// src/dataFiles.ts
export type Loaded = ReadonlyMap<string, unknown>;
export function loadFiles(paths: Iterable<string>): Promise<Loaded>;
export function filesFor<D>(files: Readonly<Record<string, string>>, loaded: Loaded): D | null;
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null;
export function overlayFiles(overlays: readonly Overlay[]): string[];

// src/verseTexts.ts
export const STRUCTURE_FILE = 'tanakh-structure.json';
export const TEXTS_FILE = 'all-texts.json';

// src/overlays/memo.ts
export function memoByValue<K extends object, V>(derive: (key: K) => V): (key: K) => V;

// Each overlay's D
CommentaryData = { counts: CommentaryCounts }          // data: { counts: 'overlays/commentary/counts.json' }
VerseLengthData = { texts: VerseTexts }                 // data: { texts: TEXTS_FILE }
TropData = { texts: VerseTexts }                        // data: { texts: TEXTS_FILE }
HaftarahData = { mappings: HaftarahMappings; structure: TorahData }  // data: HAFTARAH_FILES
TextDatingData = { dates: TextDatingFile }              // data: { dates: 'text-dating.json' }

// src/__tests__/helpers/fixtures.ts
export const SAMPLE_LOADED: Loaded;   // fixture files under their real paths
// src/__tests__/helpers/overlayHost.ts
export function hostOverlay<S, D>(overlay: Overlay<TanakhIdentity, S, D>, data: D): OverlayHost<S, D>;
```

Member signatures after Task 2 (spec order: data is always the last argument):

```ts
getVerseColor(verse: T, settings: S, data: D): Color | Color[] | null;
colorsFor(items: T[], settings: S, hovered: T | null, data: D): (Color | Color[] | null)[];
hoverChangesColors?(before: T | null, after: T | null, settings: S, data: D): boolean;
getHoverInfo?(verse: T, settings: S, data: D): string | null;
renderSidebarInfo?(verse: T, isPinned: boolean, settings: S, data: D): HTMLElement | null;
highlightVerseText?(text: string, language: TextLanguage, settings: S, data: D): DocumentFragment;
summary?(settings: S, data: D): OverlaySummary;
renderControls?(container: HTMLElement, settings: S, onChange: (update: SettingsUpdate<S>) => void, data: D | null): void;
renderLegend?(container: HTMLElement, settings: S, data: D | null): void;
getSefariaConnectionParam?(settings: S): string | null;
```

---

### Task 0: Baseline and claim the issues

No code. Establishes what "unchanged" means.

- [ ] **Step 1: Confirm the worktree and dependencies**

Run: `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/overlay-data status --short --branch`
Expected: `## worktree-overlay-data` and nothing else. If `node_modules` is missing, run `npm install` (tell Danyel per Fail Loudly if it fails).

- [ ] **Step 2: Run the suite and typecheck on the untouched branch**

Run: `npm run typecheck` then `npx vitest run`
Expected: both pass. Record the test count in the task report (not in any file).

- [ ] **Step 3: Take the layout baseline**

Run: `npm run test:layout`
Expected: PASS. Then copy the shots to your session scratchpad (the directory named in your system prompt), e.g. `cp -R layout-report/shots <scratchpad>/baseline-shots`. Read two or three of the PNGs (the `explore-trop`, `explore-haftarah` and `explore-link` states) to confirm the map actually drew.

Run `npm run test:layout` a second time on the untouched branch and `cmp` each new shot against the first copy. If every pair is byte-identical, later tasks compare shots with `cmp`. If any differ, the baseline is not stable on this machine: later tasks instead require the layout tests to pass and Read each differing pair, stopping (rule 2) only for a difference a reader would see. Log which applies, per rule 1.

- [ ] **Step 4: Mark the issues**

```bash
gh issue edit 327 --add-label in-progress
gh issue comment 327 --body "🤖 Claude: working on this in branch \`worktree-overlay-data\` (step 1 of #313 removes loadJson)."
gh issue edit 313 --add-label in-progress
gh issue comment 313 --body "🤖 Claude: step 1 of 3 (overlays receive their data) is in progress in branch \`worktree-overlay-data\`; plan: docs/plans/2026-09-30-overlay-data-implementation.md."
```

---

### Task 1: The loader, and the decision log

**Files:**
- Create: `src/dataFiles.ts`
- Create: `src/__tests__/unit/dataFiles.test.ts`
- Modify: `src/overlays/memo.ts` (rename `memoBySettings` → `memoByValue`), `src/overlays/trop.ts:22,98`, `src/overlays/search/index.ts:46,81`
- Modify: `src/verseTexts.ts` (add `STRUCTURE_FILE`, `TEXTS_FILE`)
- Modify: `docs/plans/2026-09-30-overlay-data-design.md` (append the decision log)

**Interfaces:**
- Produces: `Loaded`, `loadFiles`, `filesFor`, `memoByValue`, `STRUCTURE_FILE`, `TEXTS_FILE` (exact signatures under "Shared names").

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit/dataFiles.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesFor, loadFiles } from '../../dataFiles';
import { mockFetch, mockFetchStatus } from '../helpers/mocks';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('loadFiles', () => {
  it('downloads a path named twice only once', async () => {
    const fetchSpy = mockFetch({ '/data/shared.json': { a: 1 } });
    const loaded = await loadFiles(['shared.json', 'shared.json']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(loaded.get('shared.json')).toEqual({ a: 1 });
  });

  it('leaves a failed download missing, warns once, and keeps the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch({ '/data/good.json': { ok: true }, '/data/bad.json': mockFetchStatus(404) });
    const loaded = await loadFiles(['good.json', 'bad.json']);
    expect(loaded.has('good.json')).toBe(true);
    expect(loaded.has('bad.json')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('bad.json');
  });

  it('treats a download that cannot be read as missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as typeof fetch;
    const loaded = await loadFiles(['x.json']);
    expect(loaded.has('x.json')).toBe(false);
  });
});

describe('filesFor', () => {
  const loaded = new Map<string, unknown>([['a.json', 1], ['b.json', 2]]);

  it('gives each file under the name it was asked for', () => {
    expect(filesFor({ first: 'a.json', second: 'b.json' }, loaded)).toEqual({ first: 1, second: 2 });
  });

  it('gives null until every file named is in', () => {
    expect(filesFor({ first: 'a.json', third: 'c.json' }, loaded)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts`
Expected: FAIL — `Cannot find module '../../dataFiles'` (or "Failed to resolve import").

- [ ] **Step 3: Write `src/dataFiles.ts`**

```ts
// The one place a data file is downloaded, parsed and its failure handled.
// Paths are under public/data/; what a file means belongs to whoever names it.
import { fetchData } from './constants.ts';

/** What has arrived, by path. A file that failed is absent. */
export type Loaded = ReadonlyMap<string, unknown>;

/** Download each path once. A failure is warned about and leaves that path missing. */
export async function loadFiles(paths: Iterable<string>): Promise<Loaded> {
  const unique = [...new Set(paths)];
  const contents = await Promise.all(unique.map(loadFile));
  return new Map(
    unique.flatMap((path, i) => (contents[i] === undefined ? [] : [[path, contents[i]] as const])),
  );
}

async function loadFile(path: string): Promise<unknown> {
  try {
    const response = await fetchData(path);
    if (!response.ok) {
      console.warn(`Could not load ${path}: ${response.status}`);
      return undefined;
    }
    return await response.json();
  } catch (e) {
    console.warn(`Could not load ${path}:`, e);
    return undefined;
  }
}

/** Each named file's contents under its name, or null until every one is in. */
export function filesFor<D>(files: Readonly<Record<string, string>>, loaded: Loaded): D | null {
  const named = Object.entries(files);
  if (!named.every(([, path]) => loaded.has(path))) return null;
  return Object.fromEntries(named.map(([name, path]) => [name, loaded.get(path)])) as D;
}
```

(`dataFor` and `overlayFiles` arrive in Task 2 with the `Overlay` type they read.)

- [ ] **Step 4: Rename the memo and add the file names**

In `src/overlays/memo.ts` rename `memoBySettings` to `memoByValue`, its type parameter `S` to `K`, and reword the doc comment's first two paragraphs to:

```ts
/**
 * `derive`, worked out once per value and kept. An overlay's colours are asked
 * for once per verse, 23,000 times a paint, all with one settings value and
 * one data value.
 *
 * Settings and data are never edited in place — a change is a new value — so
 * a value's identity is a sound key, and a value no longer held is let go. The
 * last value asked about is checked first, because a paint asks about the same
 * one every time.
 */
```

Update its two callers (`src/overlays/trop.ts`, `src/overlays/search/index.ts`): import and call `memoByValue`.

In `src/verseTexts.ts`, after the `VerseTexts` type, add:

```ts
export const STRUCTURE_FILE = 'tanakh-structure.json';
export const TEXTS_FILE = 'all-texts.json';
```

and use them in `loadTanakhStructure` and `loadAllVerseTexts` (`fetchData(STRUCTURE_FILE)`, `fetchData(TEXTS_FILE)`).

- [ ] **Step 5: Append the decision log to the design doc**

At the end of `docs/plans/2026-09-30-overlay-data-design.md` append:

```markdown
## Open questions, assumptions and rulings

Decisions made while implementing step 1, newest last.

- **2026-09-30 (plan)** Main loads its own two files, the structure and the
  verse texts, through the same loader as the overlays' files. Trop and verse
  length name `all-texts.json` and haftarah names `tanakh-structure.json`; had
  main kept its own loading beside the loader, the 8.9 MB texts would download
  twice. Main reads only those two paths' contents; it still never reads an
  overlay's.
- **2026-09-30 (plan)** An overlay that names no files is handed `undefined`
  as its data, as an overlay without settings is handed `undefined` settings;
  `dataFor` never returns `null` for it, so search is never left out.
- **2026-09-30 (plan)** `dataFor` returns the same object for the same
  `loaded` value, so what an overlay derives per data value — and what
  `prebuild` warmed — is found again on the next paint.
- **2026-09-30 (plan)** Handed `null`, `renderLegend` draws nothing and
  `renderControls` draws only what needs no data (haftarah's custom picker,
  commentary's category picker); trop's chart and haftarah's key are drawn
  when data first arrives. Step 1 never hands `null` at runtime, since startup
  waits; this only has to be safe.
- **2026-09-30 (plan)** Commentary's highest count per category is taken over
  the counts file rather than over the laid-out verses. Measured on today's
  data: every verse in the file is laid out, and every category's maximum is
  the same either way.
- **2026-09-30 (plan)** `memoBySettings` is renamed `memoByValue`, since
  overlays now key derived values on data as well as settings.
- **2026-09-30 (plan)** The idle scheduling the morphology prefetch uses
  moves to `src/utils/idle.ts` and `prebuild` uses the same one.
- **2026-09-30 (plan)** The print script loads haftarah's files through the
  loader in the same task that removes `loadReadings`, since that task cannot
  compile otherwise.
```

- [ ] **Step 6: Run the tests, typecheck, format**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts` — Expected: PASS (5 tests).
Run: `node_modules/.bin/prettier --write src/dataFiles.ts src/__tests__/unit/dataFiles.test.ts src/overlays/memo.ts src/overlays/trop.ts src/overlays/search/index.ts src/verseTexts.ts`
Run: `npm run typecheck` — Expected: no errors. Run: `npx vitest run` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/dataFiles.ts src/__tests__/unit/dataFiles.test.ts src/overlays/memo.ts src/overlays/trop.ts src/overlays/search/index.ts src/verseTexts.ts docs/plans/2026-09-30-overlay-data-design.md
git commit -m "Load data files through one loader that fetches each path once"
```

(Message body: one paragraph on what the loader does; the attribution line per rule 8.)

---

### Task 2: Overlays take their data as an argument *(draws)*

The type gains `D`; every caller hands data. The overlays themselves still read their module state and ignore the new argument — they are converted one per task afterwards. This is the widest task: the type change breaks every caller at once, so they all move together.

**Files:**
- Modify: `src/overlays/types.ts`, `src/dataFiles.ts`, `src/tools.ts`, `src/itemColoring.ts`, `src/sidebar.ts`, `src/scrollytelling/overlayBlender.ts`, `src/main.ts`, `src/main-talmud.ts`, `src/talmud/overlays/mg-base.ts`, `src/talmud/overlays/segment-length.ts`, `src/overlays/{commentary,trop,haftarah,verse-length,text-dating}.ts`, `src/overlays/search/index.ts`, `test-harness/main.ts`
- Modify tests/helpers: `src/__tests__/helpers/{overlayHost,fixtures}.ts`, `src/__tests__/unit/{tools,verseColoring,combineLayers,sidebar,sidebar-word-clicks}.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`, `src/__tests__/integration/{overlay-switching,url-state-sync,view-state-restore,search-overlay-modes}.test.ts`, every `src/__tests__/unit/overlays/*.test.ts` and `src/__tests__/unit/search-matching.test.ts` that calls `hostOverlay`
- Test: `src/__tests__/unit/dataFiles.test.ts`, `src/__tests__/unit/tools.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**
- Consumes: `Loaded`, `loadFiles`, `filesFor` (Task 1).
- Produces: `Overlay<T, S, D>`; `dataFor`; `overlayFiles`; `ToolOnMap.data`; `toolsShown(overlay, overlaySettings, search, loaded)`; `overlayColorsFor(overlay, items, settings, hovered, data)`; `layerToRecompute(source, overlay: ToolOnMap<T> | null, before, after, itemsEqual)`; `pictureForStop(stop, verses, hovered, loaded)`; `computeBlendedColors(from, to, t, verses, hovered, loaded)`; `hostOverlay(overlay, data)` with `setData`, `summary`, `renderSidebarInfo`; `SAMPLE_LOADED`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/dataFiles.test.ts`:

```ts
import { dataFor, overlayFiles } from '../../dataFiles';
import { testOverlay } from '../helpers/fixtures';

describe('dataFor', () => {
  const texts = { Genesis: {} };
  const reader = testOverlay({ id: 'r', name: 'R', getVerseColor: () => null, data: { texts: 'all-texts.json' } });
  const counter = testOverlay({ id: 'c', name: 'C', getVerseColor: () => null, data: { words: 'all-texts.json' } });

  it('hands two overlays naming one path a single download, each under its own name', async () => {
    const fetchSpy = mockFetch({ '/data/all-texts.json': texts });
    const loaded = await loadFiles(overlayFiles([reader, counter]));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(dataFor(reader, loaded)).toEqual({ texts });
    expect(dataFor(counter, loaded)).toEqual({ words: texts });
  });

  it('gives null while a file is missing, without holding back another overlay', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = testOverlay({ id: 'o', name: 'O', getVerseColor: () => null, data: { counts: 'counts.json' } });
    mockFetch({ '/data/counts.json': { n: 1 }, '/data/all-texts.json': mockFetchStatus(500) });
    const loaded = await loadFiles(overlayFiles([reader, other]));
    expect(dataFor(reader, loaded)).toBeNull();
    expect(dataFor(other, loaded)).toEqual({ counts: { n: 1 } });
  });

  it('gives the same object for the same loaded value, and a new one for a new value', () => {
    const loaded = new Map([['all-texts.json', texts]]);
    expect(dataFor(reader, loaded)).toBe(dataFor(reader, loaded));
    expect(dataFor(reader, new Map(loaded))).not.toBe(dataFor(reader, loaded));
  });

  it('hands an overlay that names no files undefined, never null', () => {
    const plain = testOverlay({ id: 'p', name: 'P', getVerseColor: () => null });
    expect(dataFor(plain, new Map())).toBeUndefined();
  });
});
```

Replace the third test in `src/__tests__/unit/tools.test.ts` ("shows the overlay with its settings beside the search") and add one; pass `new Map()` as the new last argument in the other `toolsShown` calls:

```ts
import { testOverlay } from '../helpers/fixtures';

const counts = testOverlay({ id: 'counts', name: 'Counts', getVerseColor: () => null, data: { counts: 'counts.json' } });

it('shows the overlay with its settings and data beside the search', () => {
  const settings = { category: 'total' };
  const loaded = new Map([['counts.json', { n: 1 }]]);
  const tools = toolsShown(counts, settings, settingsFromLink(searchTool, { search: 'אור' }), loaded);
  expect(tools.overlay).toEqual({ tool: counts, settings, data: { counts: { n: 1 } } });
  expect(tools.search).not.toBeNull();
});

it('leaves out an overlay whose data is missing, and keeps the search', () => {
  const tools = toolsShown(counts, undefined, settingsFromLink(searchTool, { search: 'אור' }), new Map());
  expect(tools.overlay).toBeNull();
  expect(tools.search?.tool).toBe(searchTool);
});
```

Add to `src/scrollytelling/__tests__/overlayBlender.test.ts` (after the `pictureForStop` describe's existing tests; give every existing `pictureForStop`/`computeBlendedColors` call a trailing `new Map()`):

```ts
describe('a stop whose overlay data is missing', () => {
  const RED: Color = [1, 0, 0];
  const late = testOverlay({
    id: 'test-late-data',
    name: 'Late',
    data: { marks: 'late.json' },
    getVerseColor: () => RED,
  });
  const stop: ResolvedStoryStop = {
    id: 'late', title: 'L', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'test-late-data',
  };
  const bare: ResolvedStoryStop = { ...stop, id: 'bare', overlay: undefined };

  beforeEach(() => registerOverlay(late));

  it('is drawn without the overlay, and with it once the data arrives', () => {
    expect(pictureForStop(stop, verses, null, new Map())).toEqual(pictureForStop(bare, verses, null, new Map()));
    const arrived = pictureForStop(stop, verses, null, new Map([['late.json', {}]]));
    expect(arrived.colors).toEqual([RED, RED]);
  });
});
```

(Import `testOverlay` from `../../__tests__/helpers/fixtures` and `Color` from `../../overlays/types`.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts src/__tests__/unit/tools.test.ts src/scrollytelling/__tests__/overlayBlender.test.ts`
Expected: FAIL — `dataFor`/`overlayFiles` not exported; `toolsShown` has no `data`; the late stop keeps a cached picture or colours without data.

- [ ] **Step 3: Change the type** (`src/overlays/types.ts`)

Change the header comment's first paragraph to say the type is generic over T, S and D, and replace the type with:

```ts
export type Overlay<T = TanakhIdentity, S = unknown, D = unknown> = OverlayMembers<T, S, D> &
  (OverlayWithSettings<S> | OverlayWithoutSettings) &
  (OverlayWithData<D> | OverlayWithoutData);

// An overlay that reads files names each by its own short name, as a path under
// public/data/. The app loads every path once and hands the overlay D: each
// file's contents under its name. Whatever the overlay derives from them it
// keeps per data value, so it goes with the data.
interface OverlayWithData<D> {
  data: { readonly [K in keyof D]: string };
  // Work out ahead of first use what the overlay derives from its data. The
  // app calls it when the browser is idle; a member called first works out the
  // same thing on demand, so this changes when the work happens, never the result.
  prebuild?(data: D): void;
}

// The app hands an overlay that names no files undefined wherever it hands data.
interface OverlayWithoutData {
  data?: never;
  prebuild?: never;
}
```

In `OverlayMembers<T, S, D>` change the members to the signatures under "Shared names" (spec order: `data` is always the last argument; `renderControls` and `renderLegend` take `data: D | null`). Add one comment line above `renderControls`: `// The panel may be drawn before the overlay's data is in; then data is null.` Leave `init` and `destroy` in place for now (Task 9 removes `init`).

Change `ToolOnMap`:

```ts
/** A tool on the map, with the settings the app holds for it and its data. */
export interface ToolOnMap<T = TanakhIdentity> {
  tool: Overlay<T>;
  settings: unknown;
  data: unknown;
}
```

- [ ] **Step 4: `dataFor` and `overlayFiles`** (`src/dataFiles.ts`)

```ts
import type { Overlay } from './overlays/types.ts';

// Per loaded value, so that the same files give each overlay the same object.
const given = new WeakMap<Loaded, Map<object, unknown>>();

/**
 * An overlay's files under its own names, or null until every one is in. The
 * same loaded value gives the same object, so what an overlay keeps per data
 * value is found again. An overlay that names no files gets undefined.
 */
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null {
  if (!overlay.data) return undefined as D;
  let byOverlay = given.get(loaded);
  if (!byOverlay) {
    byOverlay = new Map();
    given.set(loaded, byOverlay);
  }
  if (!byOverlay.has(overlay)) {
    byOverlay.set(overlay, filesFor<D>(overlay.data as Record<string, string>, loaded));
  }
  return byOverlay.get(overlay) as D | null;
}

/** Every path the overlays name. */
export function overlayFiles(overlays: readonly Overlay[]): string[] {
  return overlays.flatMap((overlay) => Object.values((overlay.data ?? {}) as Record<string, string>));
}
```

(Both `as Record<string, string>` casts are needed: on the generic `Overlay`, `data` is a mapped type over `keyof unknown`, which `Object.entries`/`Object.values` will not take as a record of strings.)

- [ ] **Step 5: `toolsShown`** (`src/tools.ts`)

```ts
import type { Overlay, ToolOnMap, Tools } from './overlays/types.ts';
import { dataFor, type Loaded } from './dataFiles.ts';

/**
 * The tools a view shows: the overlay, if one is on, and the search, while it
 * has a word to search on — each with its data, and left out while a file it
 * reads has not arrived.
 */
export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
  loaded: Loaded,
): Tools {
  return {
    overlay: overlay && withData(overlay, overlaySettings, loaded),
    search: isSearching(search) ? withData(searchTool, search, loaded) : null,
  };
}

function withData(tool: Overlay, settings: unknown, loaded: Loaded): ToolOnMap | null {
  const data = dataFor(tool, loaded);
  return data === null ? null : { tool, settings, data };
}
```

- [ ] **Step 6: Colours and the hover check** (`src/itemColoring.ts`)

```ts
export function overlayColorsFor<T, S, D>(
  overlay: Overlay<T, S, D> | null,
  items: SpatialItem<T>[],
  settings: S,
  hovered: SpatialItem<T> | null,
  data: D,
): (VerseColor | null)[] {
  return overlay ? overlay.colorsFor(items, settings, hovered, data) : items.map(() => null);
}
```

In `toolsPicture`: `on && overlayColorsFor(on.tool, items, on.settings, hovered, on.data)`.

`layerToRecompute` takes the overlay's entry from `toolsShown` instead of an overlay and its settings:

```ts
export function layerToRecompute<T>(
  source: 'overlay' | 'blend' | 'ease',
  overlay: ToolOnMap<T> | null,
  before: T | null,
  after: T | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): 'blend' | 'overlay' | null {
  if (itemsEqual(before, after) || source === 'ease') return null;
  if (source === 'blend') return 'blend';
  return overlay?.tool.hoverChangesColors?.(before, after, overlay.settings, overlay.data)
    ? 'overlay'
    : null;
}
```

Update `src/__tests__/unit/verseColoring.test.ts`: `overlayColorsFor(overlay, verses, 'settings', verses[1], 'data')` and `overlayColorsFor(null, verses, undefined, null, undefined)`; every `layerToRecompute(src, overlay, settings, a, b, eq)` becomes `layerToRecompute(src, overlay && { tool: overlay, settings, data: undefined }, a, b, eq)`; the spy test hands `{ tool: overlay, settings: 'settings', data: 'data' }` and expects `toHaveBeenCalledWith(a, b, 'settings', 'data')`. In `combineLayers.test.ts` add `data: undefined` to each `{ tool, settings }` literal.

- [ ] **Step 7: The verse popup** (`src/sidebar.ts`)

In `updateSidebar` add `const overlayData = view.overlay?.data;` and hand it on: `renderSidebarInfo?.(verse, isPinned, overlaySettings, overlayData)`, `getHoverInfo?.(verse, overlaySettings, overlayData)`, `highlightVerseText?.(text, language, overlaySettings, overlayData)`; for the search, `search.tool.getHoverInfo?.(verse, search.settings, search.data)` and `search.tool.highlightVerseText?.(text, language, search.settings, search.data)`. In `sidebar.test.ts` and `sidebar-word-clicks.test.ts` add `data: undefined` to every `{ tool, settings }` (and `ToolOnMap` literal), and extend the two `toHaveBeenCalledWith` checks with a trailing `undefined`.

- [ ] **Step 8: The story blender** (`src/scrollytelling/overlayBlender.ts`)

`pictureForStop(stop, verses, hovered, loaded: Loaded)` and `computeBlendedColors(fromStop, toStop, t, verses, hovered, loaded: Loaded)` (pass `loaded` through to every `pictureForStop` call). In `pictureForStop`:

```ts
  const tools = toolsShown(
    overlay,
    overlay ? settingsFromLink(overlay, stop.overlayParams ?? {}) : undefined,
    settingsFromLink(searchTool, stop.searchParams ?? {}),
    loaded,
  );
  const picture = fillDefaultColors(toolsPicture(tools, verses, hovered));
  // A stop drawn while its overlay's data is missing is drawn again once it arrives.
  if (!byHover && (!overlay || tools.overlay)) cache.set(key, picture);
  return picture;
```

- [ ] **Step 9: The overlays, search, Talmud and the test harness**

Each overlay's members take the new parameters but ignore `data` for now (Tasks 4–8 use it):
- `commentary.ts`, `trop.ts`, `verse-length.ts`: `colorsFor(items, settings, _hovered, _data)`; `renderControls(container, settings, onChange, _data)`.
- `haftarah.ts`: `colorsFor(items, settings, hovered, _data)`; `renderControls(container, settings, onChange, _data)`.
- `search/index.ts`: type it `Overlay<TanakhIdentity, SearchSettings, void>`; `colorsFor(items, settings, _hovered, _data)`; `renderControls(container, settings, onChange, _data)`.
- `talmud/overlays/mg-base.ts`, `segment-length.ts`: every `Overlay<TalmudIdentity, void>` becomes `Overlay<TalmudIdentity, void, void>` (members stay as they are; trailing `void` parameters may be omitted).
- `src/main-talmud.ts:100`: `overlayColorsFor(composeWithMgBase(mgBaseOverlay, currentOverlay), items, undefined, hoveredItem, undefined)`; `Overlay<TalmudIdentity, void>` → `Overlay<TalmudIdentity, void, void>` at lines 92 and 94.
- `test-harness/main.ts:156` (typechecked by `npm run typecheck`): `searchOverlay.renderControls?.(controlsContainer, settings.get(searchOverlay), (update) => {…}, undefined)` (data last).

Then search the tree for any other untyped caller:

Run: `git grep -n "renderControls\|colorsFor\|renderLegend" -- test-harness experiments video layout scripts`
Expected: only the line just fixed in `test-harness/main.ts` (and nothing under `experiments/` that imports `src/overlays`). Fix anything else the same way.

- [ ] **Step 10: Main** (`src/main.ts`)

1. Imports: `import { dataFor, loadFiles, overlayFiles, type Loaded } from './dataFiles.ts';`
2. Startup: move `registerAllOverlays();` above the `Promise.all` at line 227 and load the overlays' files beside the existing loads:

```ts
  registerAllOverlays();
  const [torahData, verseTexts, , loaded] = await Promise.all([
    loadTanakhStructure(),
    loadAllVerseTexts(),
    loadLexiconData(),
    loadFiles(overlayFiles(getAllOverlays())),
  ]);
```

(Task 3 folds the first two into `loadFiles`.) Delete the later `registerAllOverlays();` line.
3. `toolsNow()`: `toolsShown(currentOverlay, currentSettings(), overlaySettings.get(searchTool), loaded)`.
4. `updateLegend()`: `summary: on.tool.summary?.(on.settings, on.data) ?? {}`.
5. `blendTransition()`: `computeBlendedColors(from, to, t, verses, mouseState.hoveredVerse, loaded)`; `beginEase`: `computeBlendedColors(state.fromStop, state.toStop, state.t, verses, null, loaded)`.
6. `repaint()`:

```ts
    const layer = layerToRecompute(
      colorSource(driver),
      toolsNow().overlay,
      hoveredBefore,
      mouseState.hoveredVerse,
      tanakhIdentitiesEqual,
    );
```

7. `renderOverlayLegend()`: `if (currentOverlay) currentOverlay.renderLegend?.(overlayLegendContainer, currentSettings(), dataFor(currentOverlay, loaded));`
8. `renderOverlayControls()`: `overlay.renderControls?.(overlayControlsContainer, overlaySettings.get(overlay), (update) => changeSettings(overlay, update), dataFor(overlay, loaded));`
9. `searchChanged()`: `searchTool.renderControls?.(searchControls, overlaySettings.get(searchTool), changeSearch, undefined);`

`npm run typecheck` will name any call this list missed; fix each the same way.

- [ ] **Step 11: Test helpers**

`src/__tests__/helpers/overlayHost.ts`: make the host generic over `D` and hand `data` to every member:

```ts
export interface OverlayHost<S, D> {
  readonly overlay: Overlay<TanakhIdentity, S, D>;
  readonly settings: S;
  /** The data the overlay is handed. */
  readonly data: D;
  /** Hand the overlay different data, and redraw the controls with it. */
  setData(next: D): void;
  // ...existing members unchanged...
  summary(): OverlaySummary;
  renderSidebarInfo(verse: TanakhIdentity, isPinned: boolean): HTMLElement | null;
}

export function hostOverlay<S, D>(overlay: Overlay<TanakhIdentity, S, D>, data: D): OverlayHost<S, D> {
  let held = data;
  // ...
  // draw(): overlay.renderControls?.(container, store.get(overlay), host.change, held);
  // getVerseColor: overlay.getVerseColor(verse, store.get(overlay), held)
  // hoverChangesColors: overlay.hoverChangesColors?.(before, after, store.get(overlay), held) ?? false
  // getHoverInfo: overlay.getHoverInfo?.(verse, store.get(overlay), held) ?? null
  // highlightVerseText: overlay.highlightVerseText(text, language, store.get(overlay), held)
  // renderLegend: overlay.renderLegend?.(into, store.get(overlay), held)
  // summary: overlay.summary?.(store.get(overlay), held) ?? {}
  // renderSidebarInfo: overlay.renderSidebarInfo?.(verse, isPinned, store.get(overlay), held) ?? null
  // get data() { return held; }
  // setData(next) { held = next; draw(); }
}
```

Every existing `hostOverlay(x)` call becomes `hostOverlay(x, undefined)` for now (`search-overlay-modes`, `search-from-click`, `search-marks-by-position`, `search-meaning-filter`, `search-term-colors`, `search.test.ts:16,1425` (`hostOverlay(searchOverlay.overlay, undefined)`), `search-matching`, `commentary`, `haftarah`, `text-dating`, `trop`, `verse-length`). The overlay tasks replace `undefined` with real data.

`src/__tests__/helpers/fixtures.ts`: `testOverlay` forwards data —

```ts
export function testOverlay<T = TanakhLayout, S = unknown, D = unknown>(
  fields: Omit<Overlay<T, S, D>, 'colorsFor'>,
): Overlay<T, S, D> {
  return {
    ...fields,
    colorsFor: (items, settings, _hovered, data) => items.map((item) => fields.getVerseColor(item, settings, data)),
  } as Overlay<T, S, D>;
}
```

and add the sample files under their real paths:

```ts
import type { Loaded } from '../../dataFiles';
import { TEXTS_FILE } from '../../verseTexts';

/** The sample files, under the paths the overlays name. */
export const SAMPLE_LOADED: Loaded = new Map<string, unknown>([
  ['overlays/commentary/counts.json', SAMPLE_COMMENTARY_DATA],
  [TEXTS_FILE, SAMPLE_VERSE_TEXTS],
]);
```

(declare it after both samples). The integration tests (`overlay-switching`, `url-state-sync`, `view-state-restore`) hand `dataFor(overlay, SAMPLE_LOADED)` wherever they call a member directly: `renderControls(container, settings.get(overlay), onChange, dataFor(overlay, SAMPLE_LOADED))`, `renderLegend(container, settings.get(overlay), dataFor(overlay, SAMPLE_LOADED))`, `getVerseColor(v, settings.get(overlay), data)`, `getHoverInfo(v, settings.get(overlay), data)`. In `overlay-switching.test.ts`'s `switchToOverlay`, take `const data = dataFor(overlay, SAMPLE_LOADED);` once, throw `new Error(\`${overlay.id}'s files are not in SAMPLE_LOADED\`)` if it is `null`, and use it for every member call; keep `currentData` beside `currentOverlay` for the later calls at lines 269, 283, 447–448, 491. In `overlayBlender.test.ts` the stub `multiColorOverlay.colorsFor(items, settings, _hovered, data)` forwards `data`, and the commentary test hands `undefined` as data for now.

- [ ] **Step 12: Run everything**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts src/__tests__/unit/tools.test.ts src/scrollytelling/__tests__/overlayBlender.test.ts` — Expected: PASS.
Run: `node_modules/.bin/prettier --write <every file changed>`; `npm run typecheck` — Expected: no errors; `npx vitest run` — Expected: all pass.

- [ ] **Step 13: Check the test harness by hand**

Start your own dev server in the background (`npm run dev`, `run_in_background`), read its output for the port, then with a scratchpad Playwright script (e.g. `<scratchpad>/harness.mjs`, run with `node`):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${process.argv[2]}/test-harness/`);
await page.waitForTimeout(3000);
await page.locator('input').first().fill('אור');
await page.waitForTimeout(1500);
console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
```

Run: `node <scratchpad>/harness.mjs <port>` — Expected: `no page errors`. Stop only the dev server you started (by its PID).

- [ ] **Step 14: Layout tests**

Run: `npm run test:layout` — Expected: PASS, `layout/known.ts` unchanged; compare `layout-report/shots/` with the baseline (`cmp` each PNG; Read any pair that differs — a difference a reader would see is a stop, per rule 2).

- [ ] **Step 15: Commit**

```bash
git add -A src test-harness
git commit -m "Hand each overlay member its data as an argument"
```

---

### Task 3: Main loads its own files through the loader *(draws)*

So that when trop, verse length and haftarah name `all-texts.json` and `tanakh-structure.json`, each still downloads once.

**Files:**
- Modify: `src/main.ts:6,227-232`, `src/verseTexts.ts` (delete `loadTanakhStructure`, now unused)

**Interfaces:**
- Consumes: `loadFiles`, `overlayFiles`, `STRUCTURE_FILE`, `TEXTS_FILE`.

- [ ] **Step 1: Confirm nothing else uses `loadTanakhStructure`**

Run: `git grep -n loadTanakhStructure`
Expected: only `src/main.ts` and `src/verseTexts.ts`. (`loadAllVerseTexts` stays: `test-harness/main.ts` uses it.)

- [ ] **Step 2: Change startup**

```ts
  registerAllOverlays();
  const [loaded] = await Promise.all([
    loadFiles([STRUCTURE_FILE, TEXTS_FILE, ...overlayFiles(getAllOverlays())]),
    loadLexiconData(),
  ]);
  // Main reads these two itself; every other file is an overlay's.
  const torahData = loaded.get(STRUCTURE_FILE) as TorahData | undefined;
  if (!torahData) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  const verseTexts = (loaded.get(TEXTS_FILE) ?? {}) as VerseTexts;
```

Imports: `STRUCTURE_FILE, TEXTS_FILE, type VerseTexts` from `./verseTexts.ts` (drop `loadTanakhStructure`, `loadAllVerseTexts`); `type TorahData` from `./types.ts` if not already imported. Delete `loadTanakhStructure` from `src/verseTexts.ts`.

This keeps today's behaviour on failure: a missing structure stops startup with an error, missing texts leave an empty text set.

- [ ] **Step 3: Verify one download each**

Run: `npm run typecheck` and `npx vitest run` — Expected: pass.
Start your own dev server; with a scratchpad Playwright script, open `http://localhost:<port>/?overlay=trop`, record `page.on('request')` URLs, wait for `document.documentElement.dataset.mapReady !== undefined`, and print how many requests end in `/data/all-texts.json` and `/data/tanakh-structure.json`.
Expected: `1` each. Stop your dev server.

- [ ] **Step 4: Layout tests** — `npm run test:layout`; Expected: PASS, shots match baseline.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/verseTexts.ts
git commit -m "Load the structure and the verse texts through the same loader as the overlays"
```

---

### Task 4: Commentary receives its counts *(draws)*

**Files:**
- Modify: `src/overlays/commentary.ts`, `src/overlays/index.ts:12`, `src/main.ts:110,248`
- Modify tests: `src/__tests__/unit/overlays/commentary.test.ts`, `src/__tests__/helpers/fixtures.ts` (type of `SAMPLE_COMMENTARY_DATA`), `src/__tests__/integration/{overlay-switching,url-state-sync,view-state-restore}.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**
- Produces: `CommentaryCounts` (the file's shape, renamed from `CommentaryData`), `CommentaryData = { counts: CommentaryCounts }`, `commentaryOverlay: Overlay<TanakhIdentity, CommentarySettings, CommentaryData>`.

- [ ] **Step 1: Write the failing tests**

In `commentary.test.ts`, replace the module-level host and the `mockFetch`/`configure` setup: build the host in `beforeEach` with the test's data —

```ts
import { commentaryOverlay as overlay, type CommentaryCounts } from '../../../overlays/commentary';
let commentaryOverlay: OverlayHost<CommentarySettings, CommentaryData>;
beforeEach(() => {
  testData = { /* unchanged */ };
  commentaryOverlay = hostOverlay(overlay, { counts: testData });
});
```

Delete `afterEach(() => commentaryOverlay.destroy())`, the `mockFetch` variable and every test that asserts on a download or on `init` (a fetch of `counts.json`, "handles fetch errors"): the loader's tests cover those. Then add:

```ts
describe('data', () => {
  it('names its counts file', () => {
    expect(overlay.data).toEqual({ counts: 'overlays/commentary/counts.json' });
  });

  it('scales to the data it is handed, not to data it was handed before', () => {
    const legend = () => {
      const el = document.createElement('div');
      commentaryOverlay.renderLegend(el);
      return el.innerHTML;
    };
    const before = legend();
    const doubled = structuredClone(testData);
    doubled.Genesis['1']['1'].total = 300;
    commentaryOverlay.setData({ counts: doubled });
    expect(legend()).not.toBe(before);
  });

  it('draws its picker but no legend before the data is in', () => {
    const controls = document.createElement('div');
    overlay.renderControls!(controls, commentaryOverlay.settings, () => {}, null);
    expect(controls.querySelector('select')).not.toBeNull();
    const legend = document.createElement('div');
    legend.innerHTML = 'stale';
    overlay.renderLegend!(legend, commentaryOverlay.settings, null);
    expect(legend.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/commentary.test.ts`
Expected: FAIL — `overlay.data` undefined; the legend does not follow `setData`.

- [ ] **Step 3: Convert the overlay**

In `src/overlays/commentary.ts`:
- Rename the exported file shape `CommentaryData` → `CommentaryCounts`; add `export interface CommentaryData { counts: CommentaryCounts }`.
- Delete `let data`, `let verses`, `let cachedMaxValues`, the `loadJson` and `TanakhLayout` imports, `init`, `destroy`, and `export function configure`.
- Thread data through the helpers:

```ts
// Each category's highest count, worked out once per data value.
const maximaOf = memoByValue((_data: CommentaryData) => new Map<string, number>());

function linkScale(data: CommentaryData, category: string): Scale {
  return scale(1, getMaxValue(data, category), LOG, HEATMAP_STOPS);
}

function countIn(entry: TanakhCommentary | undefined, category: string): number {
  if (!entry) return 0;
  if (category === 'total') return entry.total;
  return entry.categories[category] || 0;
}

function getCount(data: CommentaryData, verse: TanakhIdentity, category: string): number {
  return countIn(data.counts[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)], category);
}

function getMaxValue(data: CommentaryData, category: string): number {
  const maxima = maximaOf(data);
  const known = maxima.get(category);
  if (known !== undefined) return known;
  let max = 0;
  for (const chapters of Object.values(data.counts)) {
    for (const verses of Object.values(chapters)) {
      for (const entry of Object.values(verses)) max = Math.max(max, countIn(entry, category));
    }
  }
  maxima.set(category, max);
  return max;
}

function commentaryColorAt(data: CommentaryData, verse: TanakhIdentity, category: string): Color | null {
  const count = getCount(data, verse, category);
  if (count === 0) return NEVER_LINKED;
  return linkScale(data, category).colorOf(count);
}
```

- The overlay: type `Overlay<TanakhIdentity, CommentarySettings, CommentaryData>`; `data: { counts: 'overlays/commentary/counts.json' },`; `getVerseColor(verse, settings, data)`; `colorsFor(items, settings, _hovered, data)`; `renderControls(container, settings, onChange, _data)` (body unchanged); `renderLegend(container, settings, data)` starts `if (!data) { container.innerHTML = ''; return; }` and uses `getMaxValue(data, …)`/`linkScale(data, …)`; `summary(settings, data)` uses `linkScale(data, settings.category)`; `getHoverInfo(verse, settings, data)` reads `data.counts[…]` and `getCount(data, verse, settings.category)`.
- Import `memoByValue` from `./memo.ts`.

Remove `configure as configureCommentary` from `src/overlays/index.ts`, and `configureCommentary` from `src/main.ts` (import and the `configureCommentary({ verses })` call).

- [ ] **Step 4: Update the other tests**

- `fixtures.ts`: `SAMPLE_COMMENTARY_DATA: CommentaryCounts`.
- `overlay-switching`, `url-state-sync`, `view-state-restore`: delete `configureCommentary` imports/calls and the `mockFetch({ '/data/overlays/commentary/counts.json': … })` lines (keep `mockFetch` only where a test still needs it for something else). In `overlay-switching.test.ts`, the test "calls destroy() when switching away from overlay" spies on commentary's `destroy`, which is gone: register a `testOverlay` with `destroy: vi.fn()` and switch away from that instead. Its "handles fetch failure gracefully during init" test becomes: "leaves out an overlay whose files did not load" — `toolsShown(getOverlay('commentary')!, undefined, settingsFromLink(searchTool, {}), new Map()).overlay` is `null`. Its "handles malformed data gracefully" test hands `{ counts: { invalidKey: 'invalid data' } as unknown as CommentaryCounts }` directly instead of mocking fetch.
- `overlayBlender.test.ts` "the blender evaluates without disturbing the overlay": hand `{ counts: SAMPLE_COMMENTARY_DATA }` as data to both `getVerseColor` calls and `SAMPLE_LOADED` to `computeBlendedColors`.

- [ ] **Step 5: Run everything**

Run: `npx vitest run src/__tests__/unit/overlays/commentary.test.ts` — Expected: PASS.
Run: prettier on changed files; `npm run typecheck`; `npx vitest run` — Expected: pass.
Run: `git grep -n "configureCommentary\|cachedMaxValues" -- src` — Expected: no output.

- [ ] **Step 6: Layout tests** — `npm run test:layout`; PASS, shots match baseline (the `explore-link` state shows commentary).

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Hand the commentary overlay its counts instead of loading them"
```

---

### Task 5: Verse length receives the texts *(draws)*

**Files:**
- Modify: `src/overlays/verse-length.ts`, `src/overlays/index.ts:15`, `src/main.ts` (`configureVerseLength` import and call)
- Modify test: `src/__tests__/unit/overlays/verse-length.test.ts`

**Interfaces:**
- Produces: `VerseLengthData = { texts: VerseTexts }`, `verseLengthOverlay: Overlay<TanakhIdentity, void, VerseLengthData>` with `prebuild`.

- [ ] **Step 1: Write the failing tests**

In `verse-length.test.ts`, drop `configure`; build the host per test: `verseLengthOverlay = hostOverlay(overlay, { texts: testVerseTexts })` in `beforeEach` (import `verseLengthOverlay as overlay`). Calls to `verseLengthOverlay.overlay.renderSidebarInfo!(verse, pinned)` become `verseLengthOverlay.renderSidebarInfo(verse, pinned)`. Add:

```ts
describe('data', () => {
  it('names the verse texts', () => {
    expect(overlay.data).toEqual({ texts: 'all-texts.json' });
  });

  it('colours by the texts it is handed now', () => {
    const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
    const before = verseLengthOverlay.getVerseColor(verse);
    const shorter = structuredClone(testVerseTexts);
    shorter.Genesis['1']['1'].he = 'בְּרֵאשִׁ֖ית';
    verseLengthOverlay.setData({ texts: shorter });
    expect(verseLengthOverlay.getVerseColor(verse)).not.toEqual(before);
  });

  it('colours the same whether or not prebuild ran first', () => {
    const fresh = { texts: structuredClone(testVerseTexts) };
    const verses = [createVerse({ book: 'Genesis', chapter: 1, verse: 1 }), createVerse({ book: 'Exodus', chapter: 1, verse: 2 })];
    const onDemand = overlay.colorsFor(verses, undefined, null, { texts: structuredClone(testVerseTexts) });
    overlay.prebuild!(fresh);
    expect(overlay.colorsFor(verses, undefined, null, fresh)).toEqual(onDemand);
  });

  it('draws no legend before the data is in', () => {
    const legend = document.createElement('div');
    legend.innerHTML = 'stale';
    overlay.renderLegend!(legend, undefined, null);
    expect(legend.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/verse-length.test.ts`
Expected: FAIL — no `data`, no `prebuild`, colours follow the module's configured texts.

- [ ] **Step 3: Convert the overlay**

Delete `verseTexts`, `wordCountCache`, `minWordCount`, `maxWordCount` and `configure`. Add:

```ts
export interface VerseLengthData {
  texts: VerseTexts;
}

interface WordCounts {
  byVerse: Map<string, number>;
  min: number;
  max: number;
}

/** Every verse's word count, and the range of the non-empty ones, once per data value. */
const wordCountsOf = memoByValue(({ texts }: VerseLengthData): WordCounts => {
  const byVerse = new Map<string, number>();
  let min = Infinity;
  let max = 0;
  for (const book in texts) {
    for (const chapter in texts[book]) {
      for (const verse in texts[book][chapter]) {
        const wordCount = verseWords(texts[book][chapter][verse].he).length;
        byVerse.set(tanakhKey(book, parseInt(chapter), parseInt(verse)), wordCount);
        if (wordCount > 0) {
          min = Math.min(min, wordCount);
          max = Math.max(max, wordCount);
        }
      }
    }
  }
  return { byVerse, min: min === Infinity ? 0 : min, max };
});

function wordCountScale(counts: WordCounts): Scale {
  return scale(counts.min, counts.max, SQRT, PLASMA_STOPS);
}

function wordCountAt(data: VerseLengthData, verse: TanakhIdentity): number | undefined {
  return wordCountsOf(data).byVerse.get(tanakhKey(verse.book, verse.chapter, verse.verse));
}
```

Keep `wordCountScale`'s existing doc comment. The overlay: type `Overlay<TanakhIdentity, void, VerseLengthData>`; `data: { texts: TEXTS_FILE }`; `prebuild(data) { wordCountsOf(data); }`; `getVerseColor(verse, _settings, data)` and `colorsFor(items, _settings, _hovered, data)` colour from `wordCountAt(data, verse)` (zero or missing → `NO_DATA`, else `wordCountScale(wordCountsOf(data)).colorOf(n)`); `renderLegend(container, _settings, data)` returns an empty container for `null` and otherwise uses `wordCountsOf(data)` for the scale and `[min, max]`; `summary(_settings, data)`; `getHoverInfo(verse, _settings, data)` and `renderSidebarInfo(verse, _isPinned, _settings, data)` read `wordCountAt(data, verse)`. Imports: `memoByValue` from `./memo.ts`, `TEXTS_FILE` from `../verseTexts.ts`.

Remove `configure as configureVerseLength` from `src/overlays/index.ts` and `configureVerseLength` from `src/main.ts`.

- [ ] **Step 4: Run everything** — the overlay test (PASS), prettier, `npm run typecheck`, `npx vitest run` (all pass); `git grep -n configureVerseLength -- src` prints nothing.

- [ ] **Step 5: Layout tests** — `npm run test:layout`; PASS, shots match baseline.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Hand the verse length overlay the texts instead of configuring it"
```

---

### Task 6: Trop receives the texts *(draws)*

**Files:**
- Modify: `src/overlays/trop.ts`, `src/overlays/index.ts:13`, `src/main.ts` (`configureTrop` import and call)
- Modify tests: `src/__tests__/unit/overlays/trop.test.ts`, `src/__tests__/integration/{overlay-switching,url-state-sync,view-state-restore}.test.ts` (`configureTrop`)

**Interfaces:**
- Produces: `TropData = { texts: VerseTexts }`, `tropOverlay: Overlay<TanakhIdentity, TropSettings, TropData>` with `prebuild`. `highlightTropInText` unchanged.

- [ ] **Step 1: Write the failing tests**

In `trop.test.ts`, drop `configure`; `makeHost()` becomes `hostOverlay(tropOverlay, { texts: testVerseTexts })` (import `tropOverlay` from the module, so no cast is needed). Add:

```ts
describe('data', () => {
  it('names the verse texts', () => {
    expect(tropOverlay.data).toEqual({ texts: 'all-texts.json' });
  });

  it('offers the marks of the texts it is handed now', () => {
    const host = makeHost();
    const before = host.renderControls().querySelectorAll('button').length;
    host.setData({ texts: { Genesis: { '1': { '1': { he: 'בָּרָ֣א', en: 'created' } } } } });
    const after = host.renderControls().querySelectorAll('button').length;
    expect(after).toBeLessThan(before);
  });

  it('colours the same whether or not prebuild ran first', () => {
    const settings = { mark: 'tipcha', preview: null };
    const onDemand = tropOverlay.colorsFor(testVerses, settings, null, { texts: structuredClone(testVerseTexts) });
    const fresh = { texts: structuredClone(testVerseTexts) };
    tropOverlay.prebuild!(fresh);
    expect(tropOverlay.colorsFor(testVerses, settings, null, fresh)).toEqual(onDemand);
  });

  it('draws the chart once the data arrives, into controls first drawn without it', () => {
    const container = document.createElement('div');
    tropOverlay.renderControls!(container, { mark: null, preview: null }, () => {}, null);
    expect(container.querySelectorAll('.trop-chart button')).toHaveLength(0);
    tropOverlay.renderControls!(container, { mark: null, preview: null }, () => {}, { texts: testVerseTexts });
    expect(container.querySelectorAll('.trop-chart button').length).toBeGreaterThan(0);
  });
});
```

(If the sample texts carry no tipcha, pick the slug of the first button `makeHost().renderControls()` draws instead; log it per rule 1 only if the fixture had to change.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/trop.test.ts` — Expected: FAIL.

- [ ] **Step 3: Convert the overlay**

Delete `let tropBySlug` and `configure`. Add, near the top (after `slugify`, which can move up):

```ts
export interface TropData {
  texts: VerseTexts;
}

/** Every mark the text carries, by URL slug, rarest first; once per data value. */
const marksOf = memoByValue(
  (data: TropData): Map<string, TropIndexEntry> =>
    new Map(
      getTropByFrequency(buildTropIndex(data.texts)).map((entry) => [slugify(entry.name), entry]),
    ),
);

function entryFor(data: TropData, mark: string | null): TropIndexEntry | null {
  if (!mark) return null;
  return marksOf(data).get(mark) ?? null;
}

// Per data value, then per settings value.
const derivationsOf = memoByValue((data: TropData) =>
  memoByValue((settings: TropSettings) => deriveTrop(data, shownMark(settings))),
);

function derivationFor(data: TropData, settings: TropSettings): TropDerivation | null {
  return derivationsOf(data)(settings);
}
```

`deriveTrop(data, mark)` calls `entryFor(data, mark)`. `renderTropChart(container, settings, onChange, data: TropData | null)` starts with `if (!data) return;` (comment: `// The chart lists the marks the texts carry, so it waits for them.`), builds buttons from `marksOf(data)`, and uses `entryFor(data, …)` for the info line. The overlay: type `Overlay<TanakhIdentity, TropSettings, TropData>`; `data: { texts: TEXTS_FILE }`; `prebuild(data) { marksOf(data); }`; every member takes `data` in spec position and passes it to `derivationFor`/`entryFor`; `renderLegend(container, settings, data)` empties the container for `null`; `summary(settings, data)`; `highlightVerseText(text, language, settings, data)`.

Remove `configure as configureTrop` from `src/overlays/index.ts` (keep `highlightTropInText`), `configureTrop` from `src/main.ts`, and every `configureTrop` import/call from the three integration tests.

- [ ] **Step 4: Run everything** — the trop test (PASS), prettier, typecheck, full suite; `git grep -n "configureTrop\|tropBySlug" -- src` prints nothing.

- [ ] **Step 5: Layout tests** — `npm run test:layout`; PASS, shots match baseline (`explore-trop`).

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Hand the trop overlay the texts instead of configuring it"
```

---

### Task 7: Haftarah receives its readings, and the print script loads them the same way *(draws)*

One task because removing `loadReadings` breaks the print script until it loads through the loader.

**Files:**
- Modify: `src/overlays/haftarah/readings.ts`, `src/overlays/haftarah.ts`, `scripts/print/views.ts:5-10,179-183`
- Modify tests: `src/__tests__/unit/overlays/haftarah.test.ts`, `src/__tests__/unit/story-file.test.ts:19,26,37`, `scripts/print/__tests__/views.test.ts:2,23,30-31`, `src/__tests__/helpers/fixtures.ts` (add haftarah's files to `SAMPLE_LOADED`)

**Interfaces:**
- Produces: `HAFTARAH_FILES`, `HaftarahData = { mappings: HaftarahMappings; structure: TorahData }`, `deriveHaftarah(data: HaftarahData, custom: Custom)`, `forEachVerseInRange(structure: TorahData, range, callback)`, `loadHaftarahData(): Promise<HaftarahData>` in `scripts/print/views.ts`.

- [ ] **Step 1: Write the failing tests**

In `haftarah.test.ts`: move `SAMPLE_HAFTARAH_DATA` and `SAMPLE_STRUCTURE` into `src/__tests__/helpers/fixtures.ts` (exported, typed `HaftarahMappings` and `TorahData`), and add them to `SAMPLE_LOADED` under `'overlays/haftarah/mappings.json'` and `STRUCTURE_FILE` — so the integration tests that switch through every registered overlay find haftarah's files. Build the host with `hostOverlay(haftarahOverlay, { mappings: SAMPLE_HAFTARAH_DATA, structure: SAMPLE_STRUCTURE })`; delete the `mockFetch` setup and every test of downloads or `init` ("loads haftarah mappings data on init", "loads tanakh structure data on init", "handles fetch errors gracefully"); `loadRoshChodesh(custom, ranges)` becomes synchronous and calls `haftarahOverlay.setData({ mappings: changed, structure: SAMPLE_STRUCTURE })`. Add:

```ts
describe('data', () => {
  it('names its readings and the structure', () => {
    expect(overlay.data).toEqual({
      mappings: 'overlays/haftarah/mappings.json',
      structure: 'tanakh-structure.json',
    });
  });

  it('draws the custom picker, and the key once the readings arrive', () => {
    const container = document.createElement('div');
    const settings = { custom: 'ashkenazi' as const, preview: null, reading: null };
    overlay.renderControls!(container, settings, () => {}, null);
    expect(container.querySelector('#custom-select')).not.toBeNull();
    expect(container.querySelector('.haftarah-key')).toBeNull();
    overlay.renderControls!(container, settings, () => {}, { mappings: SAMPLE_HAFTARAH_DATA, structure: SAMPLE_STRUCTURE });
    expect(container.querySelector('.haftarah-key')).not.toBeNull();
  });

  it('draws no legend before the readings are in', () => {
    const legend = document.createElement('div');
    legend.innerHTML = 'stale';
    overlay.renderLegend!(legend, { custom: 'ashkenazi', preview: null, reading: null }, null);
    expect(legend.innerHTML).toBe('');
  });
});
```

(Import the overlay itself as `overlay` beside the host.) The existing Rosh Chodesh tests already check that colours follow new data; keep them.

In `story-file.test.ts` replace `beforeAll(() => haftarahOverlay.init?.())` and `deriveHaftarah(custom)` with:

```ts
let readings: HaftarahData;
beforeAll(async () => {
  readings = filesFor<HaftarahData>(HAFTARAH_FILES, await loadFiles(Object.values(HAFTARAH_FILES)))!;
});
// …
return !reading || !deriveHaftarah(readings, custom).itemByName.has(reading);
```

In `scripts/print/__tests__/views.test.ts` replace `loadReadings` with `loadHaftarahData` from `../views.ts`: `const derived = deriveHaftarah(await loadHaftarahData(), 'ashkenazi');` (make the second test `async`).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/haftarah.test.ts src/__tests__/unit/story-file.test.ts scripts/print/__tests__/views.test.ts`
Expected: FAIL — `HAFTARAH_FILES`, `HaftarahData`, `loadHaftarahData` missing; `deriveHaftarah` takes one argument.

- [ ] **Step 3: Convert `readings.ts`**

Delete `let data`, `let structure`, `mappings()`, `loadReadings`, `derivationCache` and the `loadJson` import. Add:

```ts
import { STRUCTURE_FILE } from '../../verseTexts.ts';
import { memoByValue } from '../memo.ts';

export const HAFTARAH_FILES = {
  mappings: 'overlays/haftarah/mappings.json',
  structure: STRUCTURE_FILE,
} as const;

export interface HaftarahData {
  mappings: HaftarahMappings;
  structure: TorahData;
}

// There are only two customs, so each one's derivation is kept, per data value.
const derivationsOf = memoByValue((_data: HaftarahData) => new Map<Custom, HaftarahDerivation>());
```

`getVerseCount(structure: TorahData, book, chapter)` (drop the `if (!structure)` fallback line, keep the out-of-range one); `forEachVerseInRange(structure: TorahData, range, callback)`; `deriveHaftarah(data: HaftarahData, custom: Custom)` reads `derivationsOf(data)` instead of `derivationCache`, builds `items` from `data.mappings` without the `if (data)` guard, and passes `data.structure` to `forEachVerseInRange`. Update the file's header comment: the readings are handed in, not loaded. Every import in this file keeps its `.ts` extension (the print script runs it under plain `node`).

- [ ] **Step 4: Convert `haftarah.ts`**

Type `Overlay<TanakhIdentity, HaftarahSettings, HaftarahData>`; `data: HAFTARAH_FILES`; delete `init` and the `mappings`/`loadReadings` imports. Thread `data: HaftarahData` through `litByPreview(data, derived, item, custom)` (its `forEachVerseInRange(data.structure, range, …)`), `litByName(data, custom, name)`, `litFor(data, settings, hovered)`, `renderKey(container, data, custom, onPreview)` (reads `data.mappings` where it read `mappings()`, and keeps `if (container.querySelector('.haftarah-key')) return;`), and every `deriveHaftarah(custom)` → `deriveHaftarah(data, custom)`. Members: `hoverChangesColors(before, after, settings, data)`; `getVerseColor(verse, settings, data)` and `colorsFor(items, settings, hovered, data)` lose their `if (!mappings())` guards; `renderControls(container, settings, onChange, data)` draws the select as now and then `if (data) renderKey(container, data, settings.custom, …)`; `renderLegend(container, settings, data)` empties the container for `null`, otherwise counts from `data.mappings.parshiot?.length || 54` and `data.mappings.specialOccasions?.length || 0` exactly as now (replace the comment with `// A malformed file can lack either list.`); `getHoverInfo(verse, settings, data)` loses its `if (!mappings())` guard.

- [ ] **Step 5: The print script** (`scripts/print/views.ts`)

```ts
import { filesFor, loadFiles } from '../../src/dataFiles.ts';
import {
  deriveHaftarah,
  HAFTARAH_FILES,
  type HaftarahData,
  type HaftarahDerivation,
  type HaftarahItem,
} from '../../src/overlays/haftarah/readings.ts';

/** The haftarah overlay's files, loaded as the site loads them. */
export async function loadHaftarahData(): Promise<HaftarahData> {
  const paths = Object.values(HAFTARAH_FILES);
  const loaded = await loadFiles(paths);
  const data = filesFor<HaftarahData>(HAFTARAH_FILES, loaded);
  if (!data) throw new Error(`Could not load ${paths.filter((p) => !loaded.has(p)).join(', ')}`);
  return data;
}
```

In `haftarahSheet`: `const derived = deriveHaftarah(await loadHaftarahData(), 'ashkenazi');` and delete `await loadReadings();` and the `derived.items.length === 0` throw (the loader has named the missing file).

- [ ] **Step 6: Run everything**

Run the three test files — Expected: PASS. Then prettier, `npm run typecheck` (it covers `scripts/print/tsconfig.json`), `npx vitest run`.
Run: `git grep -n "loadReadings\|mappings()" -- src scripts` — Expected: no output.
Run: `command -v pdftoppm` — if it prints a path, run `npm run print` and expect it to write `scripts/print/out/haftarah.pdf` without error; if not, say in the task report that the print run was skipped for want of `pdftoppm` (the views tests above exercise the same loading).

- [ ] **Step 7: Layout tests** — `npm run test:layout`; PASS, shots match baseline (`explore-haftarah`).

- [ ] **Step 8: Commit**

```bash
git add -A src scripts/print
git commit -m "Hand the haftarah overlay its readings, and load them the same way for the print"
```

---

### Task 8: Text dating receives its dates

Not on the menu, so nothing on screen moves; its tests are what change.

**Files:**
- Modify: `src/overlays/text-dating.ts`
- Modify test: `src/__tests__/unit/overlays/text-dating.test.ts`

**Interfaces:**
- Produces: `TextDatingFile` (the file's shape, renamed from `TextDatingData`), `TextDatingData = { dates: TextDatingFile }`, `getVerseDatingInfo(data: TextDatingData, book, chapter, verse)`, `textDatingOverlay: Overlay<TanakhIdentity, void, TextDatingData>`.

- [ ] **Step 1: Write the failing tests**

Build the host per test with `hostOverlay(overlay, { dates: testData })`. Every `mockFetch.mockResolvedValueOnce(...)` followed by `init?.().then(...)` becomes `textDatingOverlay.setData({ dates: newData })` followed by the assertions, synchronously. Delete the "Initialization" describe, `mockFetch`, and the `init` expectation in "has required methods". `getVerseDatingInfo(book, ch, v)` calls become `getVerseDatingInfo({ dates: testData }, book, ch, v)`. Add:

```ts
it('names its dates file', () => {
  expect(overlay.data).toEqual({ dates: 'text-dating.json' });
});
```

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/__tests__/unit/overlays/text-dating.test.ts`; Expected: FAIL.

- [ ] **Step 3: Convert the overlay**

Rename the file interface to `TextDatingFile`; add `export interface TextDatingData { dates: TextDatingFile }`; delete `let data`, `init` and the `loadJson` import. `getVerseData(data: TextDatingData, verse)` reads `data.dates.books`; `getVerseDatingInfo(data, book, chapter, verse)` reads `data.dates.notes`. The overlay: `data: { dates: 'text-dating.json' }`; `getVerseColor(verse, _settings, data)`; `colorsFor(items, settings, _hovered, data) { return items.map((item) => this.getVerseColor(item, settings, data)); }`; `getHoverInfo(verse, _settings, data)`; `renderSidebarInfo(verse, isPinned, _settings, data)`; `renderLegend` and `summary` need no data and keep their bodies. Update the comment above `getVerseDatingInfo` (`// Used by the sidebar.` is wrong: it is used by the overlay's own hover and pinned-verse text) to say so, or delete it.

- [ ] **Step 4: Run everything** — the test (PASS), prettier, typecheck, full suite.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "Hand the text dating overlay its dates instead of loading them"
```

---

### Task 9: Remove `init` and `loadJson`

**Files:**
- Delete: `src/overlays/loadJson.ts`
- Modify: `src/overlays/types.ts` (remove `init?(): Promise<void>;`), `src/main.ts:252`
- Modify tests: `src/__tests__/integration/url-state-sync.test.ts:50,64,128,336`, `view-state-restore.test.ts:37`, `overlay-switching.test.ts:73` and its "overlay without init" test

- [ ] **Step 1: Confirm nothing implements or needs them**

Run: `git grep -n "init()\|init?\.\|loadJson" -- src scripts test-harness`
Expected: only `src/overlays/types.ts`, `src/overlays/loadJson.ts`, `src/main.ts:252` and the test lines listed above. Anything else (an overlay still with `init`) means an earlier task is unfinished: stop and finish it.

- [ ] **Step 2: Remove them**

Delete `src/overlays/loadJson.ts`; delete `init?(): Promise<void>;` from `OverlayMembers`; delete `await Promise.all(getAllOverlays().map((o) => o.init?.()));` from `src/main.ts`; delete every `await overlay?.init?.();`/`await overlay.init?.();` line in the three integration tests (making helpers synchronous where nothing else awaits). In `overlay-switching.test.ts` delete the test that registers an overlay "without init" (there is no `init` to be without); keep "handles overlay with no destroy method".

- [ ] **Step 3: Run everything**

Run: prettier; `npm run typecheck`; `npx vitest run` — Expected: pass.
Run: `git grep -n "init?\|loadJson\|configure(" -- src/overlays` — Expected: only `src/overlays/search/index.ts`'s `configure` (search keeps it).

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Remove the overlays' init and loadJson: main's loader is the only one"
```

---

### Task 10: Prebuild at idle, after the first frame *(draws)*

**Files:**
- Create: `src/utils/idle.ts`, `src/overlays/prebuild.ts`, `src/__tests__/unit/overlays/prebuild.test.ts`
- Modify: `src/search/dictionary.ts:282-303` (use `whenIdle`), `src/main.ts` (end of `main()`)

**Interfaces:**
- Consumes: `dataFor`, `Loaded`, each overlay's `prebuild` (Tasks 5, 6).
- Produces: `whenIdle(run: () => void): void`; `prebuildAll(overlays: readonly Overlay[], loaded: Loaded, schedule?: (run: () => void) => void): void`.

- [ ] **Step 1: Write the failing test**

`src/__tests__/unit/overlays/prebuild.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { prebuildAll } from '../../../overlays/prebuild';
import { testOverlay } from '../../helpers/fixtures';

/** A scheduler that runs nothing until told to, one turn at a time. */
function turns() {
  const queue: (() => void)[] = [];
  return { schedule: (run: () => void) => void queue.push(run), next: () => queue.shift()?.() };
}

const withPrebuild = (id: string, path: string, prebuild = vi.fn()) =>
  testOverlay({ id, name: id, getVerseColor: () => null, data: { file: path }, prebuild });

describe('prebuildAll', () => {
  it('prebuilds one overlay per idle turn, each with its own data, nothing before the first', () => {
    const a = withPrebuild('a', 'a.json');
    const b = withPrebuild('b', 'b.json');
    const idle = turns();
    prebuildAll([a, b], new Map([['a.json', 1], ['b.json', 2]]), idle.schedule);
    expect(a.prebuild).not.toHaveBeenCalled();
    idle.next();
    expect(a.prebuild).toHaveBeenCalledWith({ file: 1 });
    expect(b.prebuild).not.toHaveBeenCalled();
    idle.next();
    expect(b.prebuild).toHaveBeenCalledWith({ file: 2 });
  });

  it('skips an overlay whose data is missing, and one with nothing to prebuild', () => {
    const missing = withPrebuild('m', 'missing.json');
    const plain = testOverlay({ id: 'p', name: 'p', getVerseColor: () => null });
    const idle = turns();
    prebuildAll([missing, plain], new Map(), idle.schedule);
    idle.next();
    idle.next();
    expect(missing.prebuild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/__tests__/unit/overlays/prebuild.test.ts`; Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/utils/idle.ts`**

Move the scheduling out of `prefetchMorphology` (keep its explanation, which belongs to the scheduling):

```ts
/**
 * Run `run` once the app has finished starting up, off the critical path: at
 * the moment this is called the first frame has been drawn but the browser may
 * still be laying out and painting. Safari has no `requestIdleCallback`, hence
 * the timer. The deadline matters more than the idleness: on a page that never
 * goes idle the callback must still run.
 */
export function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(run, IDLE_TIMEOUT_MS);
  }
}

/** Long enough to be clear of first paint, short enough to beat a deliberate click. */
const IDLE_TIMEOUT_MS = 2000;
```

`prefetchMorphology()` becomes `whenIdle(() => void loadMorphology());` with its doc comment reduced to the part about the memoised fetch ("a verse opened before this fires still fetches exactly once"); delete `PREFETCH_TIMEOUT_MS`.

- [ ] **Step 4: Write `src/overlays/prebuild.ts`**

```ts
import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';
import { whenIdle } from '../utils/idle.ts';

/** Call each overlay's prebuild with its data, one per idle turn, so none holds up a frame. */
export function prebuildAll(
  overlays: readonly Overlay[],
  loaded: Loaded,
  schedule: (run: () => void) => void = whenIdle,
): void {
  const waiting = overlays.filter((overlay) => overlay.prebuild);
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    const data = dataFor(overlay, loaded);
    if (overlay.prebuild && data !== null) overlay.prebuild(data);
    schedule(next);
  };
  schedule(next);
}
```

- [ ] **Step 5: Call it from main**

At the end of `main()`, after `prefetchMorphology();`: `prebuildAll(getAllOverlays(), loaded);` (import from `./overlays/prebuild.ts`).

- [ ] **Step 6: Run everything** — the test (PASS), prettier, typecheck, full suite.

- [ ] **Step 7: Check it in a browser**

Start your own dev server; with a scratchpad Playwright script open `http://localhost:<port>/?overlay=trop`, wait for `mapReady`, then 3 s, and assert no `pageerror`; then open `/?overlay=verse-length` likewise. Expected: no page errors. (Do not measure timings in the extension browser.) Stop your dev server.

- [ ] **Step 8: Layout tests** — `npm run test:layout`; PASS, shots match baseline.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "Prebuild trop's and verse length's indexes at idle, after the first frame"
```

---

### Task 11: Verify the whole branch and open the pull request

- [ ] **Step 1: Check the spec's "Gone" list is gone**

Run each; Expected: no output.
```bash
git grep -n "loadJson" -- src scripts
git grep -n "configureCommentary\|configureTrop\|configureVerseLength\|loadReadings" -- src scripts test-harness
git grep -nE "^\s*(async )?init\(" -- src/overlays
git grep -nE "^let (data|verses|tropBySlug|wordCountCache|cachedMaxValues)" -- src/overlays
```

- [ ] **Step 2: Full gates**

Run: `npm run typecheck`, `npx vitest run`, `npm run build` — Expected: all pass.
Run: `npm run test:layout` — Expected: PASS, `layout/known.ts` unchanged (`git diff --quiet main -- layout/known.ts` exits 0), and every shot byte-identical to the Task 0 baseline or, where not, Read both and confirm no difference a reader would see (rule 2 otherwise).

- [ ] **Step 3: Whole-branch review**

Per superpowers:subagent-driven-development, dispatch the final whole-branch reviewer with the spec, this plan and the Review Focus list. Tell the reviewer to push back rather than accept a claim in this plan it cannot verify. Fix what it finds that the spec requires; log rulings per rule 1.

- [ ] **Step 4: Commit the screenshots**

Copy the shots of the states overlays touch — `explore-link` (commentary), `explore-trop`, `explore-haftarah`, `explore-search-and-overlay`, `explore-verse-pinned`, `story-opening` — into `docs/plans/images/2026-09-30-overlay-data/` and commit them (Markdown-and-image-only commit: `--no-verify` is allowed here under rule 3, but not needed).

```bash
git add docs/plans/images/2026-09-30-overlay-data
git commit -m "Screenshots for the pull request: step 1 changes nothing on screen"
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin worktree-overlay-data
```

Get the commit hash of the screenshot commit (`git rev-parse HEAD`) and write the PR body to a scratchpad file. The body, in plain prose (CLAUDE.md: lead with problem, approach, solution; no coined terms):

- First line: `🤖 Claude:`
- What it does: overlays name their files and are handed their data; main loads each file once; `loadJson`, `init`, `configure` are gone; prebuild at idle; the print script loads haftarah's files the same way. Nothing on screen changes.
- `Fixes #327.` and `Step 1 of 3 toward #313.` (never "Closes #313").
- Links: the design doc and its "Open questions, assumptions and rulings" section, by blob URL on the branch: `https://github.com/danyelf/torahmap/blob/worktree-overlay-data/docs/plans/2026-09-30-overlay-data-design.md#open-questions-assumptions-and-rulings`, and this plan.
- What to look at, and where: the Cloudflare preview link (it arrives as a comment from `cloudflare-workers-and-pages`; check with `gh pr view <n> --json comments` and add it to the body once it lands): open each overlay and a story; it should look exactly as on torahmap.org.
- The screenshots, each embedded as `![explore-trop](https://raw.githubusercontent.com/danyelf/torahmap/<hash>/docs/plans/images/2026-09-30-overlay-data/explore-trop.png)` with a one-line caption.
- Last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

```bash
gh pr create --base main --title "Overlays receive their data (step 1 of 3 toward #313)" --body-file <scratchpad>/pr-body.md
```

Expected: a PR URL. Confirm with `gh pr view --json number,url,body` that the body contains `Fixes #327` and does not contain `Closes #313`, `Fixes #313` or `Resolves #313`.

- [ ] **Step 6: Mark the issues**

```bash
gh issue comment 313 --body "🤖 Claude: step 1 of 3 is up for review as #<PR>. #313 stays open for steps 2 and 3."
gh issue comment 327 --body "🤖 Claude: fixed by #<PR>: loadJson is gone; the one loader warns with the path and status, and the print script names the file that failed."
```

Leave the `in-progress` label on both (the `landed` skill clears #327's on merge; #313 continues).

- [ ] **Step 7: Report**

Send `team-lead` the PR URL, the test count before and after, every ruling logged, anything skipped (and why), and the preview link if it has arrived.
