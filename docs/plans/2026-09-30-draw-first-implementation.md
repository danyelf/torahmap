# Draw First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The map draws from the structure file alone and loads every other file behind the first frame, in four stages; each landing file cross-fades whatever newly has its data, and the reader is told, in the three places they wait, that a file is loading or failed.

**Architecture:** Main loads the structure, draws the first frame and sets `data-map-ready`, then downloads in stages (the opening view's files, every other required file, the optional ones), each starting when the one before has settled, and sets `data-loaded` at the end. Each landing goes through `fileLanded`: `loaded` becomes a new value, the plain function `staleAfterLanding` says what is out of date, and main redraws it with code it has — the map through `fadeMap` (the front tool's cross-fade, taken out), a story blend through the same fade, a story ease by restarting it. An overlay's data object stays the same while none of its own files changes, so an unrelated landing redraws nothing. A Playwright suite in `loading/`, written first, holds files back under a throttled connection and is the definition of done.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Playwright with the Chrome DevTools Protocol (CDP), Node 24 type stripping for `scripts/`.

**Spec:** `docs/plans/2026-09-30-draw-first-design.md` — all of it. Read it before Task 1. It builds on step 1 (`docs/plans/2026-09-30-overlay-data-design.md`) and step 2 (`docs/plans/2026-09-30-search-data-design.md`), whose decision logs record what the branch already does. Where this plan and the spec disagree, the plan's rulings (end of this file, and Task 0's log) say why.

## Global Constraints

- Nothing waits for data but the structure: the first frame is the plain map whatever the link says. Settings are not touched: the overlay picker, the search box and the address show what the link asked for from the first frame.
- Downloads run in four stages, each starting when the one before has settled: the structure; the opening view's required files; every other required file; the optional files (the per-word parse).
- Every animated change to the map goes through the renderer's picture cross-fade (`fadeMap`, or a story ease restarted with `beginEase`). No new animation path. Under reduced motion each fade snaps.
- "Loading…" shows only where the reader waits on a file: the overlay's legend row, the search caption, the verse popup. On failure the same place shows "Couldn't load — please reload and try again" with a × that closes it; closed, it stays closed for that file.
- `data-map-ready` means the first frame. `data-loaded` means every download has landed or failed and its redraw has been asked for; `layout/page.ts` and `video/browser.ts` wait on it.
- `npm run test:layout` passes with `layout/known.ts` untouched, and its shots match Task 0's baseline within the noise in `layout-check.md`.
- No data file under `public/data/` changes. The link format does not change, and every link opens the view it opens today.
- `staleAfterLanding`, `filesFirst`, `downloadStages` and `waitingOn` are plain functions with unit tests; `staleAfterLanding` treats search as any tool.
- Tests check behaviour: no assertions on wording readers see, on counts taken from the shipped data, or on how long anything takes. The Playwright suite asserts whether things show: drawn pixels, a changed canvas, an element visible or not, an input's value and focus, the address's parameters, page errors.
- Comments describe the code as it is now; no ticket numbers, dates, step numbers or "used to" in code, test names or comments (AGENTS.md). Shorter is better.
- Use `npm`. Run TypeScript scripts with `node <file>.ts`; `tsx` is not installed. Imports reachable from `scripts/` keep explicit `.ts` extensions and import no CSS.

## Review Focus

1. **A reader scrolled down the search results when an unrelated file lands** — the haftarah file, or the per-word parse, which lands last. Expected: the list keeps its place. A new data object for search would redraw the panel and scroll it to the top. Pinned in Task 2 (an unrelated landing leaves `dataFor` the same object) and Task 4 (the parse landing redraws only the popup).
2. **Typing in the search box as search's files land.** Expected: the box keeps its text and its focus, and the results appear under it. Pinned in Task 1 ("a search typed before its files land…").
3. **A warning the reader closed, then the place redrawn** (another file lands, the popup moves to another verse). Expected: it stays closed. Pinned in Task 4 (`waitingOn` with a closed failure) and Task 1 (the failed-download case closes it).
4. **A link with both an overlay and a search whose files arrive apart.** Expected: each fills in as its own files land; the legend shows search's row while the overlay's still says it is loading. Pinned in Task 1 ("an overlay and a search fill in each as its own files land").
5. **A story stop with both an overlay and a search, reached before their data.** Expected: search comes to the front, as it does with the data in. Main decided this from whether search's data was in; Task 7 decides it from the settings. No shipped story has such a stop, so no test reaches it: the code review checks Task 7 Step 6.

---

## Standing rules for the unattended run

These bind every task and every subagent.

1. **Decide alone** anything the spec settles, and any small conflict between the plan and the code (a name, an import path, a selector, a test that needs a different fixture, a threshold measured on this machine). Log each such decision as a dated entry in the section **"Open questions, assumptions and rulings"** at the end of `docs/plans/2026-09-30-draw-first-design.md` (Task 0 creates it), and commit the entry with the task it belongs to.
2. **Stop** — commit nothing further and report BLOCKED with the specifics; the controller notifies Danyel — for anything the spec does not cover, or that changes what a reader sees beyond what the spec says (the loading message, the warning, the cross-fades), or a link that opens a different view, or a data file. A layout-test failure or a shot outside the noise in `layout-check.md` counts as "changes what a reader sees".
3. **Never skip the pre-commit hook** (`--no-verify`) except on a commit that touches only Markdown and images. If the hook fails on a timeout in a file the task did not touch, rerun the commit once and say so in the task report; a second failure is a stop.
4. **Plain shell commands only.** No `cd X && …`, no `;`-chained or `&&`-chained commands, no pipes: the worktree guard rejects them. Output redirection to a file (`> file`) is fine. Run each command on its own from the worktree root `/Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first`, using absolute paths or `git -C`.
5. **Never write to another worktree** or the primary checkout. Reading step 2's scratch files (Task 0) is allowed. Never `git stash`.
6. **Layout tests:** at the end of every task marked *(draws)*, per `layout-check.md` in the scratch directory.
7. **Before each commit:** `node_modules/.bin/prettier --write <the files you changed>`, then `npm run typecheck`, then `npx vitest run`. Fix every type error in one pass. `src/__tests__` is not typechecked; `layout/`, `loading/`, `video/`, `test-harness/`, `scripts/print/` and the rest of `src` are.
8. Commit messages end with a blank line and `Co-Authored-By: <your model name> <noreply@anthropic.com>`.
9. If you start a dev server, start your own in the background (`npm run dev`), read its port from its output, and stop only that process by PID. The layout and loading suites start their own.
10. Do not push, open PRs or post to GitHub except where Task 0 and Task 8 say to. Everything posted to GitHub starts with `🤖 Claude:`.
11. **Finish** (Task 8): the PR targets `worktree-search-data` (stacked on step 2) and says `Fixes #313`.

**The scratch directory** is `/Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first/.superpowers/sdd/2026-09-30-draw-first-implementation/` (gitignored), written `<SDD>` below. Scratch scripts live there, never in the repo.

---

## Where every changed function is called today

Line numbers drift; the files are what matter.

| Function | Callers outside tests | Test files |
|---|---|---|
| `loadFiles(paths, onLoaded?)` | `src/main.ts` (with the callback that stamps `texts_in`), `test-harness/main.ts` | `dataFiles` |
| `dataFor` (cached per `loaded` value) | `src/main.ts`, `src/tools.ts`, `src/overlays/prebuild.ts`, `test-harness/main.ts` | `dataFiles`, integration `overlay-switching`, `url-state-sync`, `view-state-restore` |
| `overlayFiles` | `src/main.ts`, `test-harness/main.ts` | `dataFiles` |
| `buildTextIndex(texts)` (reads `getBookOrder`) | `src/search/data.ts` (`textIndexOf`) | search-matching, search-performance, search-data, search-hebrew-modes, search-verse-sets, search-final-forms, search-mixed-language, search-wholeword, search-english-snippets, search-lazy-snippets, search-bounds, performance/hebrew-search-perf (14 calls) |
| `getBookOrder` | `src/search.ts` only | — |
| `SEARCH_FILES`, `SearchData` | `src/overlays/search/index.ts`, `scripts/search/click-resolution-report.ts` | `helpers/searchData.ts` |
| `prebuildAll` | `src/main.ts` (end of `main`) | `overlays/prebuild` |
| `showLegend` | `src/main.ts` (`updateLegend`) | `mapLegend` |
| `updateSidebar`, `PopupView` | `src/main.ts` (`updateSidebarWrapper`) | `sidebar` (25 calls), `sidebar-word-clicks` (6 calls) |
| `textsFrom` | `src/main.ts` (once, at startup) | `verseTexts` |
| `pictureForStop` | `src/scrollytelling/overlayBlender.ts` | `src/scrollytelling/__tests__/overlayBlender.test.ts` |
| `setFrontTool`, `cancelFrontFade`, `FRONT_FADE` | `src/main.ts` only (`FRONT_FADE` in `src/constants.ts`) | — |
| `mapReady` (waits `data-map-ready`) | `layout/page.ts` (`openMap`), `layout/app.spec.ts` | — |
| `video/browser.ts` `openMap` (waits `data-map-ready`) | `video/render.ts` and the other video scripts | — |

## File map

- Create `loading/playwright.config.ts`, `loading/tsconfig.json`, `loading/files.ts`, `loading/page.ts`, `loading/loading.spec.ts` — the suite.
- Create `src/downloads.ts` — `OpeningView`, `filesFirst`, `downloadStages`, `Downloads`, `waitingOn`, `LandingView`, `Stale`, `staleAfterLanding`. Plain; no DOM.
- Create `src/loadNotice.ts` and `src/styles/load-notice.css` — the "Loading…" and warning element.
- Create tests `src/__tests__/unit/downloads.test.ts`, `src/__tests__/unit/loadNotice.test.ts`.
- Modify `src/dataFiles.ts` (`downloadFiles`, `requiredFiles`, `optionalFiles`, `dataFor`'s cache), `src/search.ts` and `src/search/data.ts` (the book order), `src/constants/books.ts` (`getBookOrder` goes), `src/overlays/prebuild.ts`, `src/scrollytelling/overlayBlender.ts` (`stopTools`), `src/mapLegend.ts`, `src/sidebar.ts`, `src/verseTexts.ts`, `src/main.ts`, `src/constants.ts` (`MAP_FADE`), `src/telemetry/schema.ts` (a comment), `index.html` (the legend's warning line), `src/styles/frame.css`, `layout/page.ts`, `layout/app.ts`, `layout/screens.ts`, `layout/playwright.config.ts`, `video/browser.ts`, `package.json`, `CLAUDE.md`, and the tests named in each task.

## Shared names (every task relies on these)

```ts
// src/dataFiles.ts (Task 2)
export async function downloadFiles(
  paths: Iterable<string>,
  on: { landed(path: string, content: unknown): void; failed(path: string): void },
): Promise<void>;
export async function loadFiles(paths: Iterable<string>): Promise<Loaded>;   // no callback
export function requiredFiles(overlay: Overlay): string[];
export function optionalFiles(overlay: Overlay): string[];
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null;   // same object while the overlay's own files are the same

// src/search.ts, src/search/data.ts (Task 3)
export interface BookOrder { readonly books: readonly { readonly name: string }[] }
export function buildTextIndex(texts: VerseTexts, structure: BookOrder): TextIndex;
export interface SearchData extends DictionaryFiles { structure: BookOrder; texts: VerseTexts; parse: MorphologyFile | null }
// SEARCH_FILES = { structure: STRUCTURE_FILE, texts: TEXTS_FILE, ...DICTIONARY_FILES, parse: optional('search/verse-morphology.json') }

// src/__tests__/helpers/searchData.ts (Task 3)
export const inTextsOrder: (texts: VerseTexts) => BookOrder;   // the same texts give the same object

// src/downloads.ts (Task 4)
export interface OpeningView { tools: readonly Overlay[]; verse: boolean }
export function filesFirst(view: OpeningView): string[];
export function downloadStages(first: readonly string[], overlays: readonly Overlay[], loaded: Loaded): string[][];
export interface Downloads { pending: ReadonlySet<string>; failed: ReadonlySet<string>; closed: ReadonlySet<string> }
export function waitingOn(paths: readonly string[], downloads: Downloads): 'loading' | 'failed' | null;
export interface LandingView { source: 'overlay' | 'blend' | 'ease'; map: readonly Overlay[]; panel: Overlay | null; popup: boolean }
export interface Stale { map: 'fade' | 'blend' | 'ease' | null; overlayPanel: boolean; searchPanel: boolean; popup: boolean }
export function staleAfterLanding(before: Loaded, after: Loaded, view: LandingView): Stale;

// src/scrollytelling/overlayBlender.ts (Task 4)
export function stopTools(stop: StoryStop): Overlay[];

// src/overlays/prebuild.ts (Task 5)
export function prebuildCompleted(
  overlays: readonly Overlay[],
  before: Loaded,
  after: Loaded,
  built: (overlay: Overlay) => void,
  schedule?: (run: () => void) => void,   // default whenIdle
): void;

// src/loadNotice.ts (Task 6)
export const LOADING: string;   // 'Loading…'
export function loadNotice(state: 'loading' | 'failed', onClose: () => void): HTMLElement;
//   <span class="load-notice" data-state="loading|failed">; a failed one has role="alert" and a <button class="load-notice-close">

// src/mapLegend.ts (Task 6)
export interface LegendRow { panel: FrontTool; name: string; summary: OverlaySummary; loading?: boolean }
export function showLegend(legend: HTMLElement, rows: readonly LegendRow[], warnings: readonly Node[]): void;

// src/sidebar.ts (Task 6)
export interface PopupView {
  verseTexts: VerseTexts | null;
  textsNotice: Node | null;
  wordsClickable: boolean;
  overlay: ToolOnMap | null;
  search: ToolOnMap | null;
  pinned: boolean;
}

// src/verseTexts.ts (Task 6)
export function textsFrom(loaded: Loaded): VerseTexts | null;

// layout/page.ts (Task 1; mapReady changes in Task 7)
export async function firstFrame(page: Page, timeout?: number): Promise<void>;   // data-map-ready
export async function mapReady(page: Page): Promise<void>;                       // data-loaded from Task 7
export function collectErrors(page: Page): string[];
export async function canvasShot(page: Page): Promise<Buffer>;
export async function pixelCounts(page: Page, png: Buffer): Promise<{ drawn: number; coloured: number }>;

// layout/screens.ts (Task 1)
export const LAUNCH_ARGS: string[];
// layout/app.ts (Task 1)
export async function viaMenu(page: Page, action: string): Promise<void>;
```

DOM hooks the suite relies on (made in Tasks 6 and 7): `html[data-map-ready]`, `html[data-loaded]`, `.map-legend-row[data-panel="overlay"][data-loading]`, `.map-legend-row[data-panel="search"][data-loading]`, `#map-legend .map-legend-warning`, `.load-notice[data-state="loading"|"failed"]`, `.load-notice-close`, `#search-hit-caption .load-notice`, `#verse-popup .load-notice`.

---

### Task 0: Worktree, baseline, and the decision log

No code. Establishes what "unchanged" means before anything moves.

- [ ] **Step 1: Make the worktree**

Step 2's work must be finished on `worktree-search-data`. If `/Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first` does not exist yet:

Run: `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data worktree add /Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first -b worktree-draw-first worktree-search-data`
Then from the new worktree: `npm install`, then `./scripts/install-hooks.sh` (Danyel's npm config sets `ignore-scripts=true`, so `prepare` does not install the hooks). Then `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first config core.hooksPath` — Expected: `.githooks` (relative). If it prints an absolute path, rerun the install script and say so in the report.
Expected: `git -C /Users/danyel/code/MISC/torahmap/.claude/worktrees/draw-first status --short --branch` prints `## worktree-draw-first` and nothing else.

- [ ] **Step 2: Read the code at the branch head**

Step 2's final reviews may have moved code since this plan was written. Read `src/dataFiles.ts`, `src/main.ts` (startup, `toolsNow`, `setFrontTool`, `updateLegend`, `updateSidebarWrapper`, `searchChanged`, the capture shortcut, the end of `main`), `src/search/data.ts`, `src/overlays/prebuild.ts`, `src/sidebar.ts` and `src/mapLegend.ts`. Where they differ from what this plan assumes, follow the code and log the difference (rule 1).

- [ ] **Step 3: The scratch directory**

Create `<SDD>`. Copy into it from `/Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/`: `pixel-diff.mjs` and `layout-check.md`. In the copied `layout-check.md`, replace `2026-09-30-search-data-implementation` with `2026-09-30-draw-first-implementation` throughout.

- [ ] **Step 4: Suite and typecheck on the untouched branch**

Run: `npm run typecheck`, then `npx vitest run`. Expected: both pass. Record the test count in the report.

- [ ] **Step 5: Layout baseline**

Run: `npm run test:layout`. Expected: PASS. Copy `layout-report/shots/` to `<SDD>/baseline-shots/`. Read the PNGs for `explore-link`, `explore-search-and-overlay-pinned` and `story-stop-with-verse` (desktop) to confirm the map and the popup drew. Run `npm run test:layout` a second time and `node <SDD>/pixel-diff.mjs`; record the noise in `<SDD>/layout-check.md` under "Noise seen on this branch (two runs on the untouched head, step 3 Task 0)".

- [ ] **Step 6: The decision log, and mark the issue**

In `docs/plans/2026-09-30-draw-first-design.md`:

- Change the `**Status:**` line to `**Status:** Design, decided 2026-10-01. Planned: docs/plans/2026-09-30-draw-first-implementation.md.`
- In "What is decided", replace the sentence `The verse popup stays closed until the texts arrive.` with `The verse popup says "Loading…" until the texts arrive.`
- In "Failure of a download", replace `a failed texts file keeps the popup closed.` with `a failed texts file leaves the popup with the warning in place of the text.`
- In the table, replace the Pinned verse row's "Before release" cell `popup closed; map centred on the verse` with `popup says it is loading; map centred on the verse`.
- Append:

```markdown
## Open questions, assumptions and rulings

Decisions made while implementing step 3, newest last.

- **2026-10-01 (plan)** The verse popup opens before the texts, as it does
  today, and says "Loading…" where the text goes; a failed texts file shows the
  warning there. The design's later "While data loads" section decides this;
  the three lines that said the popup stays closed are changed to match.
- **2026-10-01 (plan)** The map and the panels are drawn from the files a tool
  requires; the popup also from its optional ones. So the per-word parse
  landing redraws only the popup, as the design's example says, and a reader
  scrolled down the search results keeps their place.
- **2026-10-01 (plan)** `staleAfterLanding` is handed the tools the map shows
  as a list rather than an overlay and a search: in a story blend or ease the
  map shows the tools of the stops it is between, which need not be the picked
  overlay.
- **2026-10-01 (plan)** The optional files are the last stage (that is, the
  per-word parse); `filesFirst` names only required files.
- **2026-10-01 (plan)** "Loading…" shows for a file queued for a later stage as
  well as one downloading: main counts every file it will download as pending
  from the moment the structure lands.
- **2026-10-01 (plan, Danyel)** A tool's legend row — the overlay's or
  search's alike — reads "<name> · Loading…" while its files are on their way.
  On failure the row goes and a warning line with its × shows below the rows in
  the legend card: a × cannot sit inside the row, which is a button. Search's
  row joins its caption because on a phone with the panel closed the legend is
  the only place a search link's reader sees.
- **2026-10-01 (plan)** Main writes the search caption's notice into the
  search panel's `#search-hit-caption`, which search leaves empty without data.
- **2026-10-01 (plan)** Search names the structure file, and `buildTextIndex`
  takes the book order from it, so the index can never be built in another
  order. `getBookOrder` had no other reader and goes.
- **2026-10-01 (plan)** `dataFor` keeps, per overlay, one data object per set
  of its files' contents, so an overlay's data stays the same object while none
  of its own files changes.
- **2026-10-01 (plan)** The popup's Hebrew words are clickable only once
  search has its data (`PopupView.wordsClickable`).
- **2026-10-01 (plan)** A story stop with a search puts search in front, and
  the story's last "explore" button opens the search panel, by whether the
  search has a word, not by whether its data is in: before the data they would
  otherwise decide differently than after.
- **2026-10-01 (plan)** `load_timing` is sent once, when every download has
  settled and search's index and dictionary have been built. `first_frame`:
  the first frame, now drawn from the structure alone. `texts_in`: when the
  texts file landed, as before. `search_ready`: when search's idle prebuild
  built its index and dictionary after its files landed; 0 if they never
  arrived. `texts_kbps` and `connection`: as before. The event waited for
  every file before as well, so the visits it misses are the same kind.
- **2026-10-01 (plan)** The suite throttles to 150 ms latency and 16 Mbit/s.
  The dev server sends files uncompressed, about four times the bytes the site
  sends, so each file takes about as long as it does on a 4 Mbit/s phone.
- **2026-10-01 (plan)** Main's wiring of search recording is tested by turning
  the dev server's analytics on from the test (a module script importing the
  app's own `/src/analytics.ts`) and collecting what is sent. No app change.
- **2026-10-01 (plan)** The capture shortcut names the picked overlay whether
  or not its data is in; the suite checks it with a stubbed clipboard.
- **2026-10-01 (plan)** `fadeMap(to, settle)` is the front tool's cross-fade
  taken out: `settle` paints the picture the map rests on at the end
  (`applyTools`, or `blendTransition` in a story blend). Landing fades take its
  250 ms; `FRONT_FADE` becomes `MAP_FADE`, and `cancelFrontFade` `cancelFade`.
- **2026-10-01 (plan)** An ease is restarted only while it has time left; at
  its last frame the story paints the stop with the new data anyway.
- **2026-10-01 (plan)** "Plain" in the suite means fewer coloured (non-grey)
  canvas pixels than a small floor; the plain map is grey.
- **2026-10-01 (plan)** `loadFiles` loses its per-file callback;
  `downloadFiles(paths, { landed, failed })` reports each file as it settles.
- **2026-10-01 (plan)** The layout and loading suites share the software-WebGL
  launch arguments from `layout/screens.ts`.
```

Commit (Markdown only; `--no-verify` allowed by rule 3 but not needed):

```bash
git add docs/plans/2026-09-30-draw-first-design.md
git commit -m "Step 3 plan rulings recorded (#313)"
```

Then:

```bash
gh issue comment 313 --body "🤖 Claude: step 3 of 3 (draw first) is in progress in branch \`worktree-draw-first\`, stacked on step 2; plan: docs/plans/2026-09-30-draw-first-implementation.md."
```

---

### Task 1: The loading suite, failing where it should

**Files:**
- Create: `loading/playwright.config.ts`, `loading/tsconfig.json`, `loading/files.ts`, `loading/page.ts`, `loading/loading.spec.ts`
- Modify: `layout/page.ts`, `layout/app.ts`, `layout/screens.ts`, `layout/playwright.config.ts`, `package.json`, `CLAUDE.md`

**Interfaces:**
- Consumes: nothing new from `src`. Reads `TEXTS_FILE` from `src/verseTexts.ts` and `DICTIONARY_FILES`, `SEARCH_FILES` from `src/search/data.ts`.
- Produces: `npm run test:loading`; `firstFrame`, `collectErrors`, `canvasShot`, `pixelCounts` in `layout/page.ts`; `LAUNCH_ARGS` in `layout/screens.ts`; `viaMenu` exported from `layout/app.ts`. The DOM hooks listed under Shared names, which Tasks 6 and 7 must provide.

No app code changes in this task. On this branch the first frame waits for every file, so every case fails: a held file keeps `data-map-ready` from ever being set.

- [ ] **Step 1: Share the launch arguments and the menu helper**

In `layout/screens.ts`, add above `SCREENS`:

```ts
/** Headless Chromium has no WebGL2 without software rendering. */
export const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
```

In `layout/playwright.config.ts`, import it (`import { LAUNCH_ARGS, SCREENS } from './screens.ts';`) and replace the `launchOptions` block with:

```ts
    launchOptions: { args: LAUNCH_ARGS },
```

In `layout/app.ts`, export `viaMenu` (`export async function viaMenu`), unchanged otherwise.

- [ ] **Step 2: The page helpers in `layout/page.ts`**

Replace `mapReady`, `openMap` and `drawnPixels` with the following, and add the new helpers. `boxes`, `shown` and `clippedText` stay as they are.

```ts
/** A pixel whose channels spread this far apart is coloured rather than grey. */
const COLOURED_SPREAD = 24;

/** Waits for the first frame: the map drawn before any file but the structure. */
export async function firstFrame(page: Page, timeout = 30_000): Promise<void> {
  // Everything in the body is position: fixed, so <html> never has the
  // nonzero box waitFor's default 'visible' state requires.
  await page.locator('html[data-map-ready]').waitFor({ state: 'attached', timeout });
}

/**
 * Waits until the map has started and settled: the story applies a stop on the
 * animation frame after startup, and the title face arrives from Google Fonts
 * with display=swap, changing text widths.
 */
export async function mapReady(page: Page): Promise<void> {
  await firstFrame(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/**
 * The page's uncaught errors and console errors from now on. They keep
 * arriving, so check the list again after acting on the page.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Loads the map at `link` and waits until it has settled and drawn. Returns `collectErrors`'s list. */
export async function openMap(page: Page, link: string): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto(link ? `/?${link}` : '/');
  await mapReady(page);
  await expect
    .poll(async () => drawnPixels(page), { timeout: 15_000 })
    .toBeGreaterThan(DRAWN_FLOOR);
  expect(errors, 'page errors').toEqual([]);
  return errors;
}

/**
 * The map as the reader sees it, with everything over it hidden: the labels,
 * the title and the controls carry enough text to pass for a map on their own.
 * A screenshot rather than the WebGL buffer, which would depend on
 * preserveDrawingBuffer.
 */
export async function canvasShot(page: Page): Promise<Buffer> {
  const hide = await page.addStyleTag({
    content: 'body *:not(#canvas) { visibility: hidden !important; }',
  });
  try {
    return await page.locator('#canvas').screenshot();
  } finally {
    await hide.evaluate((el: Element) => el.remove());
  }
}

/** How many of `png`'s pixels are drawn, and how many of those are coloured rather than grey. */
export async function pixelCounts(
  page: Page,
  png: Buffer,
): Promise<{ drawn: number; coloured: number }> {
  return page.evaluate(
    async ({ b64, bg, delta, spread }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let drawn = 0;
      let coloured = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (Math.max(Math.abs(r - bg), Math.abs(g - bg), Math.abs(b - bg)) > delta) drawn++;
        if (Math.max(r, g, b) - Math.min(r, g, b) > spread) coloured++;
      }
      return { drawn, coloured };
    },
    { b64: png.toString('base64'), bg: BACKGROUND, delta: DRAWN_DELTA, spread: COLOURED_SPREAD },
  );
}

/** Counts the map's drawn pixels. */
export async function drawnPixels(page: Page): Promise<number> {
  return (await pixelCounts(page, await canvasShot(page))).drawn;
}
```

- [ ] **Step 3: The suite's config, files and helpers**

`loading/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "types": ["node", "vite/client"] },
  "include": ["."]
}
```

`loading/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { LAUNCH_ARGS, SCREENS } from '../layout/screens.ts';

const PORT = Number(process.env.LOADING_PORT ?? 5198);

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results/loading',
  fullyParallel: true,
  workers: 4,
  // Every file crosses a throttled connection once a case lets it through.
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    launchOptions: { args: LAUNCH_ARGS },
  },
  // One desktop screen and one phone: this checks what loads when, not layout.
  projects: SCREENS.filter((s) => s.name === 'desktop' || s.name === 'phone').map((s) => ({
    name: s.name,
    use: s.use,
  })),
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

`loading/files.ts`:

```ts
// The data files the cases hold back, by the names the app gives them.
import { TEXTS_FILE } from '../src/verseTexts.ts';
import { DICTIONARY_FILES, SEARCH_FILES } from '../src/search/data.ts';

export { TEXTS_FILE };
export const DICTIONARY = Object.values(DICTIONARY_FILES);
export const PARSE = SEARCH_FILES.parse.optional;
// As src/overlays/commentary.ts and src/overlays/haftarah.ts name them; both
// import CSS, which Playwright cannot load.
export const COMMENTARY = 'overlays/commentary/counts.json';
export const HAFTARAH = 'overlays/haftarah/mappings.json';
/** Every file but the structure. */
export const EVERYTHING = [TEXTS_FILE, ...DICTIONARY, PARSE, COMMENTARY, HAFTARAH];
```

Before writing the next file, check those two paths against `data:` in `src/overlays/commentary.ts` and `HAFTARAH_FILES` in `src/overlays/haftarah.ts`; and check whether either module imports CSS. If neither does, import the paths from them instead of writing them here, and log it.

`loading/page.ts`:

```ts
// What the loading cases share beyond layout/page.ts: a connection that holds
// files back until the case lets them through, and what the map and the app's
// analytics show meanwhile.
import { expect, type Page } from '@playwright/test';
import { canvasShot, collectErrors, DRAWN_FLOOR, firstFrame, pixelCounts } from '../layout/page.ts';

/** The plain map is grey; a few coloured pixels still count as plain. */
const COLOURED_FLOOR = 100;

/**
 * A slow phone, for the dev server: it sends files uncompressed, about four
 * times the bytes the site sends, so this is four times a 4 Mbit/s connection.
 */
const SLOW_MOBILE = {
  offline: false,
  latency: 150,
  downloadThroughput: 2_000_000,
  uploadThroughput: 375_000,
};

export async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_MOBILE);
}

/** Keeps each data file in `paths` from arriving until the returned function is called. */
export async function hold(page: Page, paths: readonly string[]): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  for (const path of paths) {
    await page.route(`**/data/${path}`, async (route) => {
      await released;
      // The page may have closed while the file was held.
      await route.continue().catch(() => {});
    });
  }
  return release;
}

/** Makes each data file in `paths` fail to download. */
export async function fail(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) await page.route(`**/data/${path}`, (route) => route.abort());
}

/**
 * Opens `link` on the throttled connection with the files in `held` kept back,
 * and waits for the first frame.
 */
export async function open(
  page: Page,
  link: string,
  held: readonly string[],
): Promise<{ release: () => void; errors: string[] }> {
  await throttle(page);
  const release = await hold(page, held);
  const errors = collectErrors(page);
  await page.goto(link ? `/?${link}` : '/');
  await firstFrame(page, 90_000);
  return { release, errors };
}

/** The map has drawn, and nothing on it is coloured. */
export async function expectPlainMap(page: Page): Promise<void> {
  await expect
    .poll(async () => (await pixelCounts(page, await canvasShot(page))).drawn)
    .toBeGreaterThan(DRAWN_FLOOR);
  expect((await pixelCounts(page, await canvasShot(page))).coloured).toBeLessThan(COLOURED_FLOOR);
}

/** The canvas once two shots in a row agree: an ease or a glide in progress has finished. */
export async function stillShot(page: Page): Promise<Buffer> {
  let last = await canvasShot(page);
  for (;;) {
    await page.waitForTimeout(250);
    const next = await canvasShot(page);
    if (next.equals(last)) return next;
    last = next;
  }
}

/** Waits until the canvas differs from `before`. */
export async function mapChangesFrom(page: Page, before: Buffer): Promise<void> {
  await expect.poll(async () => (await canvasShot(page)).equals(before)).toBe(false);
}

export function param(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

/**
 * Turns on the app's analytics, which the dev server leaves off, sending each
 * event to window.sent. The module script imports the app's own module: the
 * browser loads a URL once.
 */
export async function recordEvents(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { configureAnalytics } from '/src/analytics.ts';
      window.sent = [];
      configureAnalytics({ enabled: true, send: (body) => window.sent.push(JSON.parse(body)) });
    `,
  });
  await page.waitForFunction(() => 'sent' in window);
}

interface Sent {
  event: string;
  fields: Record<string, unknown>;
}

/** The term of every search recorded so far, in order. */
export async function sentSearches(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    ((window as unknown as { sent?: Sent[] }).sent ?? [])
      .filter((e) => e.event === 'search_execute')
      .map((e) => e.fields.term),
  );
}
```

- [ ] **Step 4: The cases**

`loading/loading.spec.ts`:

```ts
// The map draws before its data and fills in as each file lands. Each case
// holds files back on a throttled connection, so "before the data" is a state
// the case sets rather than a race it hopes to win.
import { expect, test } from '@playwright/test';
import { viaMenu } from '../layout/app.ts';
import { mapReady } from '../layout/page.ts';
import { COMMENTARY, DICTIONARY, EVERYTHING, TEXTS_FILE } from './files.ts';
import {
  expectPlainMap,
  fail,
  mapChangesFrom,
  open,
  param,
  recordEvents,
  sentSearches,
  stillShot,
  throttle,
} from './page.ts';

const WORD = 'אלהים';
const SEARCH_FILES_HELD = [TEXTS_FILE, ...DICTIONARY];
const overlayRow = '.map-legend-row[data-panel="overlay"]';
const searchRow = '.map-legend-row[data-panel="search"]';

test('the bare address draws the map and opens the story before any data', async ({ page }) => {
  const { release, errors } = await open(page, '', EVERYTHING);
  await expectPlainMap(page);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'story');
  await expect(page.locator('#story')).toBeVisible();
  release();
  await mapReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-loaded');
  expect(errors).toEqual([]);
});

test('an overlay link draws a plain map, says it is loading, and colours in when its file lands', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'overlay=commentary', [COMMENTARY]);
  await expectPlainMap(page);
  await expect(page.locator('#overlay-select')).toHaveValue('commentary');
  await expect(page.locator(`${overlayRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(overlayRow)).toBeVisible();
  await expect(page.locator(overlayRow)).not.toHaveAttribute('data-loading');
  await mapReady(page);
  expect(param(page, 'overlay')).toBe('commentary');
  expect(errors).toEqual([]);
});

test("a search link keeps its word in the box, and finds it once search's files land", async ({
  page,
}) => {
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent(WORD)}`,
    SEARCH_FILES_HELD,
  );
  await expectPlainMap(page);
  await expect(page.locator('#search-input')).toHaveValue(WORD);
  await expect(page.locator('#search-hit-caption .load-notice[data-state="loading"]')).toBeAttached();
  // On a phone the panel opens closed, so the legend is the one place that says so.
  await expect(page.locator(`${searchRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(searchRow)).not.toHaveAttribute('data-loading');
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await mapReady(page);
  expect(param(page, 'search')).toBe(WORD);
  expect(errors).toEqual([]);
});

test('a narrowed search link keeps its meaning while the dictionary is on its way', async ({
  page,
}) => {
  const meaning = '<LH/@heb';
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent('עלה')}&m=${encodeURIComponent(meaning)}`,
    DICTIONARY,
  );
  expect(param(page, 'm')).toBe(meaning);
  release();
  await mapReady(page);
  await viaMenu(page, 'search');
  await expect(page.locator('.term-row[data-open="true"] .meaning-row input:checked')).toHaveCount(1);
  expect(param(page, 'm')).toBe(meaning);
  expect(errors).toEqual([]);
});

test('a pinned verse is centred at once, and its popup fills in when the texts land', async ({
  page,
}) => {
  const link = 'verse=Genesis.12.1';
  const { release, errors } = await open(page, link, [TEXTS_FILE]);
  await expect(page.locator('#verse-popup.visible .load-notice[data-state="loading"]')).toBeVisible();
  await expect(page.locator('#verse-popup .verse-word')).toHaveCount(0);

  // Centred where it is with every file in: the same plain map, the same pin.
  const settled = await page.context().newPage();
  await settled.goto(`/?${link}`);
  await mapReady(settled);
  expect((await stillShot(page)).equals(await stillShot(settled))).toBe(true);
  await settled.close();

  release();
  await mapReady(page);
  await expect(page.locator('#verse-popup.visible .verse-word').first()).toBeVisible();
  await expect(page.locator('#verse-popup .load-notice')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an overlay picked before its file lands colours in when it does', async ({ page }) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', [COMMENTARY]);
  await page.keyboard.press('Escape');
  await viaMenu(page, 'overlay');
  await page.locator('#overlay-select').selectOption('commentary');
  await expectPlainMap(page);
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator('#overlay-select')).toHaveValue('commentary');
  await mapReady(page);
  expect(param(page, 'overlay')).toBe('commentary');
  expect(errors).toEqual([]);
});

test('a search typed before its files land keeps the box and finds the word when they do', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_FILES_HELD);
  await page.keyboard.press('Escape');
  await viaMenu(page, 'search');
  const box = page.locator('#search-input');
  await box.fill('light');
  await expect(box).toBeFocused();
  await expectPlainMap(page);
  release();
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await expect(box).toHaveValue('light');
  await expect(box).toBeFocused();
  await mapReady(page);
  expect(param(page, 'search')).toBe('light');
  expect(errors).toEqual([]);
});

test('a story scrolled to a search before its files land shows the search when they do', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_FILES_HELD);
  await page.locator('.story-stop[data-stop-id="abraham_zoom"]').scrollIntoViewIfNeeded();
  await expect.poll(() => param(page, 'stop')).toBe('abraham_zoom');
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(searchRow)).toBeVisible();
  await mapReady(page);
  expect(errors).toEqual([]);
});

test('an overlay and a search fill in each as its own files land', async ({ page }) => {
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent(WORD)}&overlay=commentary`,
    [COMMENTARY],
  );
  await expect(page.locator(searchRow)).toBeVisible();
  await expect(page.locator(`${overlayRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(overlayRow)).not.toHaveAttribute('data-loading');
  await mapReady(page);
  expect(errors).toEqual([]);
});

test('a failed download leaves its overlay plain and says so where it would show', async ({
  page,
}) => {
  await throttle(page);
  await fail(page, [COMMENTARY]);
  // The browser and the app both log the failed download; only uncaught errors count here.
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto('/?overlay=commentary');
  await mapReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-loaded');
  await expectPlainMap(page);
  const warning = page.locator('#map-legend .load-notice[data-state="failed"]');
  await expect(warning).toBeVisible();
  await warning.locator('.load-notice-close').click();
  await expect(warning).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('a search typed before its files land is recorded once they do', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'what is recorded does not depend on the screen');
  const { release, errors } = await open(page, 'overlay=haftarah', SEARCH_FILES_HELD);
  await recordEvents(page);
  await viaMenu(page, 'search');
  await page.locator('#search-input').fill('light');
  release();
  await expect.poll(() => sentSearches(page)).toEqual(['light']);
  expect(errors).toEqual([]);
});

test('a linked search is never recorded; a word the reader adds is', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'what is recorded does not depend on the screen');
  const { release, errors } = await open(page, 'search=light', SEARCH_FILES_HELD);
  await recordEvents(page);
  release();
  await mapReady(page);
  await viaMenu(page, 'search');
  await page.locator('#add-term').click();
  await page.locator('.term-row[data-open="true"] .term-input').fill('dark');
  await expect.poll(() => sentSearches(page)).toEqual(['dark']);
  expect(errors).toEqual([]);
});

test('the capture shortcut keeps an overlay whose file has not landed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a keyboard shortcut for authors');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
  const { errors } = await open(page, 'overlay=commentary', [COMMENTARY]);
  await page.keyboard.press('Control+Shift+C');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { copied?: string }).copied))
    .toContain('commentary');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 5: The script, the typecheck and the docs**

In `package.json`, add after `"test:layout"`:

```json
    "test:loading": "playwright test -c loading",
```

and append to the `typecheck` script ` && tsc --project loading/tsconfig.json --noEmit`.

In `CLAUDE.md`, after the "Layout tests" subsection and before "Test Harness", add:

````markdown
### Loading tests

```bash
npm run test:loading
```

The map draws before its data and fills in as each file lands; this checks
that it does, at one desktop and one phone size. Each case throttles the
connection through the Chrome DevTools Protocol and holds the files it needs
back until it lets them through, so "before the data" is a state the case sets,
not a race. It starts its own dev server on port 5198 (`LOADING_PORT` to change
it). Run it before opening any pull request that changes startup or what loads
when.
````

- [ ] **Step 6: Run it, and see it fail where it should**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run test:loading > <SDD>/loading-task1.txt` — Expected: every case on both projects FAILS except the three desktop-only cases on the phone project, which are skipped. A held file keeps `data-map-ready` from being set, so most fail in `firstFrame`; the failed-download case reaches the first frame and fails waiting for `data-loaded` (in `toHaveAttribute('data-loaded')`). Read the file and confirm no case fails for another reason (a selector, a type, a server that did not start). One that does is a bug in the suite: fix it and log it.
Run: `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: PASS, every shot within `layout-check.md`'s noise (only `layout/page.ts` was reshaped).

- [ ] **Step 7: Commit**

```bash
git add loading layout package.json CLAUDE.md docs/plans/2026-09-30-draw-first-design.md
git commit -m "Loading suite: the map draws before its data, on a throttled connection (fails until the startup changes)"
```

---

### Task 2: An overlay's data stays the same object while its own files do

**Files:**
- Modify: `src/dataFiles.ts`, `src/main.ts` (startup only)
- Test: `src/__tests__/unit/dataFiles.test.ts`

**Interfaces:**
- Produces: `downloadFiles`, `loadFiles` without a callback, `requiredFiles`, `optionalFiles`, `dataFor`'s per-files cache.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/dataFiles.test.ts`, import `downloadFiles`, `optionalFiles`, `requiredFiles` as well.

Replace the `loadFiles` test `'calls back once for each path as it arrives, not for a failed one, before resolving'` with a new describe:

```ts
describe('downloadFiles', () => {
  it('hands each path over as it lands or as it fails, once, before resolving', async () => {
    mockFetch({ '/data/a.json': { a: 1 }, '/data/bad.json': mockFetchStatus(404) });
    const landed: [string, unknown][] = [];
    const failed: string[] = [];
    let resolved = false;
    await downloadFiles(['a.json', 'bad.json', 'a.json'], {
      landed: (path, content) => {
        expect(resolved).toBe(false);
        landed.push([path, content]);
      },
      failed: (path) => {
        expect(resolved).toBe(false);
        failed.push(path);
      },
    }).then(() => (resolved = true));
    expect(landed).toEqual([['a.json', { a: 1 }]]);
    expect(failed).toEqual(['bad.json']);
  });
});
```

In `describe('dataFor')`, replace `'gives the same object for the same loaded value, and a new one for a new value'` with:

```ts
  it('gives the same object while none of its own files changes, whatever else lands', () => {
    const loaded = new Map<string, unknown>([['all-texts.json', texts]]);
    const later = new Map(loaded).set('counts.json', { n: 1 });
    expect(dataFor(reader, later)).toBe(dataFor(reader, loaded));
  });

  it('gives a new object once one of its own files changes', () => {
    const loaded = new Map<string, unknown>([['all-texts.json', texts]]);
    const other = new Map<string, unknown>([['all-texts.json', { ...texts }]]);
    expect(dataFor(reader, other)).not.toBe(dataFor(reader, loaded));
  });
```

In `describe('an optional file')`, add:

```ts
  it('gives a new object once it lands', () => {
    const without = new Map<string, unknown>([['all-texts.json', texts]]);
    const withIt = new Map(without).set('parse.json', parse);
    expect(dataFor(reader, withIt)).not.toBe(dataFor(reader, without));
  });

  it('is named apart from the files the overlay requires', () => {
    expect(requiredFiles(reader)).toEqual(['all-texts.json']);
    expect(optionalFiles(reader)).toEqual(['parse.json']);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/dataFiles.test.ts`
Expected: FAIL — `downloadFiles is not a function`, and `'gives the same object while none of its own files changes…'` fails with `expected … to be …` (a new object per `loaded` value).

- [ ] **Step 3: The loader and the cache**

In `src/dataFiles.ts`, replace `loadFiles` with:

```ts
/**
 * Download each path once, handing each to `landed` as it arrives, or to
 * `failed` once its failure is reported. Resolves when every path has done one
 * or the other.
 */
export async function downloadFiles(
  paths: Iterable<string>,
  on: { landed(path: string, content: unknown): void; failed(path: string): void },
): Promise<void> {
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const content = await loadFile(path);
      if (content === undefined) on.failed(path);
      else on.landed(path, content);
    }),
  );
}

/** Download each path once. A failure is reported and leaves that path missing. */
export async function loadFiles(paths: Iterable<string>): Promise<Loaded> {
  const loaded = new Map<string, unknown>();
  await downloadFiles(paths, {
    landed: (path, content) => loaded.set(path, content),
    failed: () => {},
  });
  return loaded;
}
```

Replace everything from `// Per loaded value, so that the same files give each overlay the same object.` to the end of the file with:

```ts
const namesOf = (overlay: Overlay): Readonly<Record<string, FileName>> =>
  (overlay.data ?? {}) as Readonly<Record<string, FileName>>;

/** The paths an overlay cannot work without. */
export function requiredFiles(overlay: Overlay): string[] {
  return Object.values(namesOf(overlay)).filter((file): file is string => typeof file === 'string');
}

/** The paths an overlay is handed as null until they are in. */
export function optionalFiles(overlay: Overlay): string[] {
  return Object.values(namesOf(overlay)).flatMap((file) =>
    typeof file === 'string' ? [] : [file.optional],
  );
}

// Per overlay, each set of its files' contents handed out so far, with the
// data made from it.
const given = new WeakMap<object, { contents: unknown[]; data: unknown }[]>();

/**
 * An overlay's files under its own names, or null while any it requires is
 * missing. The data stays the same object while none of the overlay's own
 * files changes, however many others land, so what the overlay keeps per data
 * value is found again. An overlay that names no files gets undefined.
 */
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null {
  if (!overlay.data) return undefined as D;
  const files = overlay.data as Readonly<Record<string, FileName>>;
  const contents = filePaths(files).map((path) => loaded.get(path));
  let known = given.get(overlay);
  if (!known) {
    known = [];
    given.set(overlay, known);
  }
  const found = known.find((entry) => entry.contents.every((c, i) => c === contents[i]));
  if (found) return found.data as D | null;
  const data = filesFor<D>(files, loaded);
  known.push({ contents, data });
  return data;
}

/** Every path the overlays name. */
export function overlayFiles(overlays: readonly Overlay[]): string[] {
  return overlays.flatMap((overlay) => filePaths(namesOf(overlay)));
}
```

- [ ] **Step 4: Main's startup, until Task 7 replaces it**

In `src/main.ts`, import `downloadFiles` and `type Loaded` from `'./dataFiles.ts'`, and replace:

```ts
  let textsIn = 0;
  const loaded = await loadFiles(
    [STRUCTURE_FILE, TEXTS_FILE, ...overlayFiles(allOverlays)],
    (path) => {
      if (path === TEXTS_FILE) textsIn = performance.now();
    },
  );
```

with:

```ts
  let textsIn = 0;
  const arrived = new Map<string, unknown>();
  await downloadFiles([STRUCTURE_FILE, TEXTS_FILE, ...overlayFiles(allOverlays)], {
    landed: (path, content) => {
      if (path === TEXTS_FILE) textsIn = performance.now();
      arrived.set(path, content);
    },
    failed: () => {},
  });
  const loaded: Loaded = arrived;
```

Drop `loadFiles` from main's import if nothing else in main uses it.

- [ ] **Step 5: Run everything**

Run: the test file (PASS), prettier on the changed files, `npm run typecheck`, `npx vitest run`.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "An overlay's data stays the same object while none of its own files changes; downloads report each file as it settles"
```

---

### Task 3: Search's text index takes the book order from the structure

**Files:**
- Modify: `src/search.ts`, `src/search/data.ts`, `src/constants/books.ts`, `src/__tests__/helpers/searchData.ts`
- Test: `src/__tests__/unit/search-data.test.ts`; the 14 `buildTextIndex(…)` calls in the test files listed in the table above

**Interfaces:**
- Produces: `BookOrder`, `buildTextIndex(texts, structure)`, `SearchData.structure`, `SEARCH_FILES.structure`, `inTextsOrder`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/search-data.test.ts`, import `dataFor` from `'../../dataFiles'`, `STRUCTURE_FILE` from `'../../verseTexts'`, `SAMPLE_LOADED` from `'../helpers/fixtures'` and `inTextsOrder` from `'../helpers/searchData'`. Replace `'builds one text index per texts value'` with:

```ts
  it('builds one text index per texts value', () => {
    const order = inTextsOrder(texts);
    expect(buildTextIndex(texts, order)).toBe(buildTextIndex(texts, order));
    expect(buildTextIndex({ ...texts }, order)).not.toBe(buildTextIndex(texts, order));
  });

  it("lists the verses in the structure's book order, whatever order the texts hold them in", () => {
    const shuffled: VerseTexts = {
      Exodus: { 1: { 1: { he: 'ב', en: 'b' } } },
      Genesis: { 1: { 1: { he: 'א', en: 'a' } } },
    };
    const index = buildTextIndex(shuffled, { books: [{ name: 'Genesis' }, { name: 'Exodus' }] });
    expect(index.entries.map((entry) => entry.book)).toEqual(['Genesis', 'Exodus']);
  });

  it('has no data for search until the structure is in', () => {
    const noStructure = new Map([...SAMPLE_LOADED].filter(([path]) => path !== STRUCTURE_FILE));
    expect(dataFor(searchTool, noStructure)).toBeNull();
    expect(dataFor(searchTool, SAMPLE_LOADED)).not.toBeNull();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/search-data.test.ts`
Expected: FAIL — `inTextsOrder is not a function`.

- [ ] **Step 3: The index takes the order**

In `src/search.ts`: delete `import { getBookOrder } from './constants/books.ts';` and replace `buildTextIndex` and the head of `textIndexFrom` with:

```ts
/** The books in order, as the structure file lists them. */
export interface BookOrder {
  readonly books: readonly { readonly name: string }[];
}

// Per structure, then per texts.
const textIndexes = memoByValue((structure: BookOrder) =>
  memoByValue((texts: VerseTexts) =>
    textIndexFrom(
      texts,
      structure.books.map((book) => book.name),
    ),
  ),
);

/** The verses folded for matching, in the structure's book order. The same files give the same object. */
export function buildTextIndex(texts: VerseTexts, structure: BookOrder): TextIndex {
  return textIndexes(structure)(texts);
}

function textIndexFrom(verseTexts: VerseTexts, books: readonly string[]): TextIndex {
  const entries: IndexEntry[] = [];
  const byKey = new Map<string, IndexEntry>();
  for (const book of books) {
```

(the rest of the loop is unchanged; the `let books` / `try … catch` block goes).

In `src/search/data.ts`: import `STRUCTURE_FILE` with `TEXTS_FILE`, and `type BookOrder` from `'../search.ts'`; then

```ts
/** What search reads: the book order, the verse texts, the three lexeme files, and the per-word parse. */
export interface SearchData extends DictionaryFiles {
  structure: BookOrder;
  texts: VerseTexts;
  parse: MorphologyFile | null;
}

export const SEARCH_FILES = {
  structure: STRUCTURE_FILE,
  texts: TEXTS_FILE,
  ...DICTIONARY_FILES,
  parse: optional('search/verse-morphology.json'),
} as const;

export function textIndexOf(data: SearchData): TextIndex {
  return buildTextIndex(data.texts, data.structure);
}
```

In `src/constants/books.ts`, delete `getBookOrder`, the `bookOrder` variable and its assignment in `initBookData`; run `git grep -n getBookOrder` first — Expected: no caller left once `search.ts` is changed.

- [ ] **Step 4: The test helpers and the calls**

In `src/__tests__/helpers/searchData.ts`, import `memoByValue` from `'../../utils/memo'` and `type BookOrder` from `'../../search'`, and:

```ts
/** The books in the order the texts hold them, as a structure file would list them. */
export const inTextsOrder = memoByValue(
  (texts: VerseTexts): BookOrder => ({ books: Object.keys(texts).map((name) => ({ name })) }),
);

/** Search's files: these texts in their own order, with the files given or a dictionary that knows no word. */
export function searchDataFor(texts: VerseTexts, files: Partial<SearchData> = {}): SearchData {
  return { structure: inTextsOrder(texts), texts, ...EMPTY_DICTIONARY_FILES, parse: null, ...files };
}
```

and in `realSearchData`, add `structure: read(SEARCH_FILES.structure),` to `files`.

Run: `git grep -n "buildTextIndex(" -- src/__tests__`. In each call that passes one argument, add `inTextsOrder(<the same texts expression>)` as the second (import `inTextsOrder` from the helpers in each file). Only the call arguments and the import change.

- [ ] **Step 5: Run everything**

Run: the test file (PASS), prettier, `npm run typecheck`, `npx vitest run`. Then `node scripts/search/click-resolution-report.ts > <SDD>/report-task3.txt` and `node /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/compare-report.mjs /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/report-before.txt <SDD>/report-task3.txt` — Expected: `IDENTICAL` (the report now also loads the structure; nothing it prints changes).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Search's text index takes the book order from the structure it is handed"
```

---

### Task 4: What downloads when, and what a landing puts out of date

**Files:**
- Create: `src/downloads.ts`
- Modify: `src/scrollytelling/overlayBlender.ts`
- Test: `src/__tests__/unit/downloads.test.ts`, `src/scrollytelling/__tests__/overlayBlender.test.ts`

**Interfaces:**
- Consumes: `dataFor`, `requiredFiles`, `optionalFiles` (Task 2); `searchTool`, `isSearching`.
- Produces: everything listed for `src/downloads.ts` and `stopTools` under Shared names.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit/downloads.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  downloadStages,
  filesFirst,
  staleAfterLanding,
  waitingOn,
  type Downloads,
  type LandingView,
} from '../../downloads';
import type { Loaded } from '../../dataFiles';
import type { Overlay } from '../../overlays/types';
import { commentaryOverlay } from '../../overlays/commentary';
import { tropOverlay } from '../../overlays/trop';
import { HAFTARAH_FILES } from '../../overlays/haftarah';
import { searchTool } from '../../overlays/search/index';
import { DICTIONARY_FILES, SEARCH_FILES } from '../../search/data';
import { STRUCTURE_FILE, TEXTS_FILE } from '../../verseTexts';
import { SAMPLE_LOADED, SAMPLE_STRUCTURE } from '../helpers/fixtures';

const COUNTS = commentaryOverlay.data.counts;
const HAFTARAH = HAFTARAH_FILES.mappings;
const LEXICON = DICTIONARY_FILES.lexicon;
const PARSE = SEARCH_FILES.parse.optional;

const without = (...paths: string[]): Loaded =>
  new Map([...SAMPLE_LOADED].filter(([path]) => !paths.includes(path)));
const explore = (map: Overlay[], panel: Overlay | null, popup: boolean): LandingView => ({
  source: 'overlay',
  map,
  panel,
  popup,
});
const NOTHING = { map: null, overlayPanel: false, searchPanel: false, popup: false };

describe('filesFirst', () => {
  it('names the files of the tools the opening view shows', () => {
    expect(filesFirst({ tools: [commentaryOverlay], verse: false })).toEqual([COUNTS]);
  });

  it("names the files search requires, and not the per-word parse", () => {
    const files = filesFirst({ tools: [searchTool], verse: false });
    expect(files).toEqual(expect.arrayContaining([TEXTS_FILE, LEXICON]));
    expect(files).not.toContain(PARSE);
  });

  it('names the texts for a pinned verse', () => {
    expect(filesFirst({ tools: [], verse: true })).toEqual([TEXTS_FILE]);
  });

  it('names nothing for a view with no tool and no verse', () => {
    expect(filesFirst({ tools: [], verse: false })).toEqual([]);
  });
});

describe('downloadStages', () => {
  const structureOnly: Loaded = new Map([[STRUCTURE_FILE, SAMPLE_STRUCTURE]]);

  it('downloads the opening view first, then every other required file, then the optional ones', () => {
    const stages = downloadStages([COUNTS], [searchTool, commentaryOverlay], structureOnly);
    expect(stages[0]).toEqual([COUNTS]);
    expect(stages[1]).toEqual(expect.arrayContaining([TEXTS_FILE, LEXICON]));
    expect(stages[1]).not.toContain(COUNTS);
    expect(stages[1]).not.toContain(STRUCTURE_FILE);
    expect(stages[2]).toEqual([PARSE]);
    expect(stages).toHaveLength(3);
  });

  it('goes straight to the other files when the opening view needs none', () => {
    expect(downloadStages([], [commentaryOverlay], structureOnly)).toEqual([[COUNTS]]);
  });

  it('downloads a file several tools name once, in the first stage that names it', () => {
    const stages = downloadStages([TEXTS_FILE], [searchTool, tropOverlay], structureOnly);
    expect(stages[0]).toEqual([TEXTS_FILE]);
    expect(stages.flat().filter((path) => path === TEXTS_FILE)).toHaveLength(1);
  });
});

describe('waitingOn', () => {
  const downloads = (d: Partial<Downloads>): Downloads => ({
    pending: new Set(),
    failed: new Set(),
    closed: new Set(),
    ...d,
  });

  it('says loading while a file is on its way', () => {
    expect(waitingOn(['a', 'b'], downloads({ pending: new Set(['b']) }))).toBe('loading');
  });

  it('says failed once a file has failed, even with another still on its way', () => {
    expect(
      waitingOn(['a', 'b'], downloads({ pending: new Set(['b']), failed: new Set(['a']) })),
    ).toBe('failed');
  });

  it('says nothing once the reader has closed the warning, whatever is still on its way', () => {
    expect(
      waitingOn(
        ['a', 'b'],
        downloads({ pending: new Set(['b']), failed: new Set(['a']), closed: new Set(['a']) }),
      ),
    ).toBeNull();
  });

  it('says nothing once every file has landed', () => {
    expect(waitingOn(['a'], downloads({}))).toBeNull();
  });
});

describe('staleAfterLanding', () => {
  it('puts nothing out of date when no tool shown reads the file', () => {
    expect(
      staleAfterLanding(
        without(HAFTARAH),
        SAMPLE_LOADED,
        explore([commentaryOverlay], commentaryOverlay, true),
      ),
    ).toEqual(NOTHING);
  });

  it('redraws the map and the popup when the texts land with trop on', () => {
    expect(
      staleAfterLanding(without(TEXTS_FILE), SAMPLE_LOADED, explore([tropOverlay], tropOverlay, true)),
    ).toMatchObject({ map: 'fade', overlayPanel: true, popup: true });
  });

  it('redraws only the popup when the per-word parse lands with search on', () => {
    const withParse = new Map(SAMPLE_LOADED).set(PARSE, { misaligned: [], verses: {} });
    expect(
      staleAfterLanding(SAMPLE_LOADED, withParse, explore([searchTool], null, true)),
    ).toEqual({ ...NOTHING, popup: true });
  });

  it('fades the blend when the overlay of a stop the story is between lands', () => {
    const view: LandingView = { source: 'blend', map: [commentaryOverlay], panel: null, popup: false };
    expect(staleAfterLanding(without(COUNTS), SAMPLE_LOADED, view).map).toBe('blend');
  });

  it('starts the ease again when the overlay of the stop it eases to lands', () => {
    const view: LandingView = { source: 'ease', map: [commentaryOverlay], panel: null, popup: false };
    expect(staleAfterLanding(without(COUNTS), SAMPLE_LOADED, view).map).toBe('ease');
  });

  it('redraws nothing for a file that leaves its tool waiting on another', () => {
    expect(
      staleAfterLanding(
        without(TEXTS_FILE, LEXICON),
        without(LEXICON),
        explore([searchTool], null, false),
      ),
    ).toEqual(NOTHING);
  });

  it("redraws the picked overlay's panel when its file lands, and not a closed popup", () => {
    expect(
      staleAfterLanding(
        without(COUNTS),
        SAMPLE_LOADED,
        explore([commentaryOverlay], commentaryOverlay, false),
      ),
    ).toEqual({ ...NOTHING, map: 'fade', overlayPanel: true });
  });

  it('redraws the search panel and the open popup when the dictionary lands, with no search on', () => {
    expect(staleAfterLanding(without(LEXICON), SAMPLE_LOADED, explore([], null, true))).toEqual({
      ...NOTHING,
      searchPanel: true,
      popup: true,
    });
  });
});
```

Before writing it, check that `src/overlays/haftarah.ts` exports `HAFTARAH_FILES` (`src/__tests__/helpers/fixtures.ts` uses it) and that `SAMPLE_LOADED` holds no parse file; adjust the imports to match and log it.

In `src/scrollytelling/__tests__/overlayBlender.test.ts`, import `stopTools` with the others, `searchTool` from `'../../overlays/search/index'`, and add:

```ts
describe('stopTools', () => {
  const stop = (fields: Partial<ResolvedStoryStop>): ResolvedStoryStop => ({
    id: 's',
    title: 'S',
    text: '',
    camera: { x: 0, y: 0, zoom: 1 },
    ...fields,
  });

  it("names the stop's overlay, and search when the stop searches", () => {
    registerOverlay(commentaryOverlay);
    expect(stopTools(stop({ overlay: 'commentary', searchParams: { search: 'אור' } }))).toEqual([
      commentaryOverlay,
      searchTool,
    ]);
  });

  it('names nothing for a stop with no overlay and no word to search', () => {
    expect(stopTools(stop({ searchParams: { search: 'א' } }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/downloads.test.ts src/scrollytelling/__tests__/overlayBlender.test.ts`
Expected: FAIL — `Failed to resolve import "../../downloads"`, and `stopTools is not a function`.

- [ ] **Step 3: `src/downloads.ts`**

```ts
// What downloads when, and what a file landing puts out of date. Main draws
// the map from the structure alone and loads every other file behind it.
import { TEXTS_FILE } from './verseTexts.ts';
import { dataFor, optionalFiles, requiredFiles, type Loaded } from './dataFiles.ts';
import { searchTool } from './overlays/search/index.ts';
import type { Overlay } from './overlays/types.ts';

/** What the first view shows: the tools it names, and whether it pins a verse. */
export interface OpeningView {
  tools: readonly Overlay[];
  verse: boolean;
}

/** The files the opening view requires, the texts among them if it pins a verse. */
export function filesFirst(view: OpeningView): string[] {
  return [...new Set([...view.tools.flatMap(requiredFiles), ...(view.verse ? [TEXTS_FILE] : [])])];
}

/**
 * The downloads in the order they run, each stage once the one before has
 * settled: the opening view's files, every other file a tool requires, then
 * the optional ones. A file shares the connection with fewer others, so the
 * opening view fills in sooner. Files already loaded, and empty stages, are
 * left out.
 */
export function downloadStages(
  first: readonly string[],
  overlays: readonly Overlay[],
  loaded: Loaded,
): string[][] {
  const taken = new Set(loaded.keys());
  const stages: string[][] = [];
  for (const stage of [first, overlays.flatMap(requiredFiles), overlays.flatMap(optionalFiles)]) {
    const fresh = [...new Set(stage)].filter((path) => !taken.has(path));
    for (const path of fresh) taken.add(path);
    if (fresh.length > 0) stages.push(fresh);
  }
  return stages;
}

/** The downloads main has not heard back from, the ones that failed, and the warnings closed. */
export interface Downloads {
  pending: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  closed: ReadonlySet<string>;
}

/**
 * What a place waiting on `paths` says: 'failed' once one has failed, until
 * the reader closes the warning; 'loading' while one is on its way.
 */
export function waitingOn(
  paths: readonly string[],
  downloads: Downloads,
): 'loading' | 'failed' | null {
  const failed = paths.filter((path) => downloads.failed.has(path));
  if (failed.length > 0) return failed.every((path) => downloads.closed.has(path)) ? null : 'failed';
  return paths.some((path) => downloads.pending.has(path)) ? 'loading' : null;
}

/** What the map, the panels and the popup are drawn from as a file lands. */
export interface LandingView {
  /** Where the map's colours come from: colorSource(driver). */
  source: 'overlay' | 'blend' | 'ease';
  /**
   * The tools the map shows once their data is in: the picked overlay and the
   * search while it has a word, or the tools of the stops a story blend or
   * ease is between.
   */
  map: readonly Overlay[];
  /** The overlay whose controls are drawn. Search's always are. */
  panel: Overlay | null;
  /** Whether the popup shows a verse. */
  popup: boolean;
}

export interface Stale {
  map: 'fade' | 'blend' | 'ease' | null;
  overlayPanel: boolean;
  searchPanel: boolean;
  popup: boolean;
}

const MAP_REDRAW = { overlay: 'fade', blend: 'blend', ease: 'ease' } as const;

/**
 * What a file landing put out of date: whatever is drawn from a tool whose
 * data it changed. The map and the panels are drawn from the files a tool
 * requires; the popup also from its optional files, and from the texts.
 */
export function staleAfterLanding(before: Loaded, after: Loaded, view: LandingView): Stale {
  const drawn = (tool: Overlay): boolean => changed(tool, before, after, requiredFiles(tool));
  const read = (tool: Overlay): boolean => changed(tool, before, after, null);
  return {
    map: view.map.some(drawn) ? MAP_REDRAW[view.source] : null,
    overlayPanel: view.panel !== null && drawn(view.panel),
    searchPanel: drawn(searchTool),
    popup:
      view.popup &&
      (before.get(TEXTS_FILE) !== after.get(TEXTS_FILE) ||
        read(searchTool) ||
        (view.panel !== null && read(view.panel))),
  };
}

/** Whether a tool's data changed, through one of `paths` if given. */
function changed(
  tool: Overlay,
  before: Loaded,
  after: Loaded,
  paths: readonly string[] | null,
): boolean {
  const was = dataFor(tool, before);
  const is = dataFor(tool, after);
  if (was === is) return false;
  if (paths === null || was === null || is === null) return true;
  return paths.some((path) => before.get(path) !== after.get(path));
}
```

- [ ] **Step 4: `stopTools`**

In `src/scrollytelling/overlayBlender.ts`, import `isSearching` alongside `searchTool`, and add after `cacheKeyFor`:

```ts
function overlayOf(stop: StoryStop): Overlay | null {
  return (stop.overlay && getOverlay(stop.overlay)) || null;
}

/** The tools a stop shows: its overlay, and search when the stop has a word to search. */
export function stopTools(stop: StoryStop): Overlay[] {
  const overlay = overlayOf(stop);
  const searches = isSearching(settingsFromLink(searchTool, stop.searchParams ?? {}));
  return [...(overlay ? [overlay] : []), ...(searches ? [searchTool] : [])];
}
```

and in `pictureForStop` replace `const overlay = (stop.overlay && getOverlay(stop.overlay)) || null;` with `const overlay = overlayOf(stop);`.

- [ ] **Step 5: Run everything**

Run: both test files (PASS), prettier, `npm run typecheck`, `npx vitest run`.

- [ ] **Step 6: Commit**

```bash
git add src docs/plans/2026-09-30-draw-first-design.md
git commit -m "What downloads when, and what a landing file puts out of date, as plain functions"
```

---

### Task 5: Prebuild whatever a landing completes

**Files:**
- Modify: `src/overlays/prebuild.ts`, `src/main.ts` (one call)
- Test: `src/__tests__/unit/overlays/prebuild.test.ts`

**Interfaces:**
- Consumes: `dataFor`.
- Produces: `prebuildCompleted(overlays, before, after, built, schedule = whenIdle)`; `prebuildAll` goes.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/overlays/prebuild.test.ts`, import `prebuildCompleted` instead of `prebuildAll`. In the three existing cases, change each call `prebuildAll(overlays, loaded, idle.schedule)` to `prebuildCompleted(overlays, new Map(), loaded, () => {}, idle.schedule)` — only the call changes. Rename the describe to `'prebuildCompleted'`. Add:

```ts
  it('skips an overlay whose data was complete before', () => {
    const a = withPrebuild('a', 'a.json');
    const loaded = new Map([['a.json', 1]]);
    const idle = turns();
    prebuildCompleted([a], loaded, new Map([...loaded, ['other.json', 2]]), () => {}, idle.schedule);
    idle.next();
    expect(a.prebuild).not.toHaveBeenCalled();
  });

  it('says which overlay it built, after building it', () => {
    const a = withPrebuild('a', 'a.json');
    const built = vi.fn(() => expect(a.prebuild).toHaveBeenCalled());
    const idle = turns();
    prebuildCompleted([a], new Map(), new Map([['a.json', 1]]), built, idle.schedule);
    idle.next();
    expect(built).toHaveBeenCalledWith(a);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/overlays/prebuild.test.ts`
Expected: FAIL — `prebuildCompleted is not a function`.

- [ ] **Step 3: The prebuild**

Replace `src/overlays/prebuild.ts`'s function with:

```ts
/**
 * Call the prebuild of each overlay whose data `after` completes, with that
 * data, one per idle turn so none holds up a frame, and tell `built` after each.
 */
export function prebuildCompleted(
  overlays: readonly Overlay[],
  before: Loaded,
  after: Loaded,
  built: (overlay: Overlay) => void,
  schedule: (run: () => void) => void = whenIdle,
): void {
  const waiting = overlays.filter(
    (overlay) =>
      overlay.prebuild && dataFor(overlay, before) === null && dataFor(overlay, after) !== null,
  );
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    try {
      overlay.prebuild?.(dataFor(overlay, after));
      built(overlay);
    } finally {
      schedule(next);
    }
  };
  if (waiting.length > 0) schedule(next);
}
```

In `src/main.ts`, import `prebuildCompleted` instead of `prebuildAll`, and replace `prebuildAll(getAllOverlays(), loaded);` with `prebuildCompleted(getAllOverlays(), new Map(), loaded, () => {});` (Task 7 replaces it).

- [ ] **Step 4: Run everything** — the file (PASS), prettier, `npm run typecheck`, `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Prebuild each overlay whose data a landing completes"
```

---

### Task 6: Saying a file is loading or failed; the popup without texts *(draws)*

**Files:**
- Create: `src/loadNotice.ts`, `src/styles/load-notice.css`
- Modify: `src/mapLegend.ts`, `src/sidebar.ts`, `src/verseTexts.ts`, `index.html`, `src/styles/frame.css`, `src/main.ts` (two calls)
- Test: `src/__tests__/unit/loadNotice.test.ts`, `src/__tests__/unit/mapLegend.test.ts`, `src/__tests__/unit/sidebar.test.ts`, `src/__tests__/unit/sidebar-word-clicks.test.ts`, `src/__tests__/unit/verseTexts.test.ts`

**Interfaces:**
- Produces: `loadNotice`, `LOADING`, `LegendRow.loading`, `showLegend(legend, rows, warning)`, the new `PopupView`, `textsFrom` returning null.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit/loadNotice.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { loadNotice } from '../../loadNotice';

describe('loadNotice', () => {
  it('says a file is loading, with nothing to close', () => {
    const notice = loadNotice('loading', () => {});
    expect(notice.dataset.state).toBe('loading');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('warns that a file failed, and closes when its × is pressed', () => {
    const onClose = vi.fn();
    const notice = loadNotice('failed', onClose);
    expect(notice.dataset.state).toBe('failed');
    expect(notice.getAttribute('role')).toBe('alert');
    notice.querySelector<HTMLButtonElement>('.load-notice-close')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

In `src/__tests__/unit/mapLegend.test.ts`, change the fixture to add the warning line, and every existing `showLegend(el, rows)` call to `showLegend(el, rows, [])`:

```ts
function legend(): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML =
    ['search', 'overlay']
      .map(
        (panel) =>
          `<button class="map-legend-row" data-panel="${panel}" hidden>` +
          `<span class="map-legend-summary"></span></button>`,
      )
      .join('') + '<div class="map-legend-warning" hidden></div>';
  return div;
}
```

and add:

```ts
  it('marks a row whose files are on their way, and only that row', () => {
    const el = legend();
    showLegend(el, [SEARCH, { ...OVERLAY, loading: true }], []);
    expect(el.querySelector('[data-panel="overlay"]')!.hasAttribute('data-loading')).toBe(true);
    expect(el.querySelector('[data-panel="search"]')!.hasAttribute('data-loading')).toBe(false);
  });

  it('shows the warnings under the rows, the card with them, and hides the line when there are none', () => {
    const el = legend();
    const warnings = [document.createElement('span'), document.createElement('span')];
    showLegend(el, [], warnings);
    const line = el.querySelector<HTMLElement>('.map-legend-warning')!;
    expect(line.hidden).toBe(false);
    expect(warnings.every((w) => line.contains(w))).toBe(true);
    expect(el.hidden).toBe(false);
    showLegend(el, [], []);
    expect(line.hidden).toBe(true);
    expect(el.hidden).toBe(true);
  });
```

In `src/__tests__/unit/sidebar.test.ts` and `src/__tests__/unit/sidebar-word-clicks.test.ts`, every view object passed to `updateSidebar` gains `textsNotice: null, wordsClickable: true` (only the call arguments change). In `sidebar.test.ts`, replace `'handles verse with no text data'` with:

```ts
      it('shows nothing for a verse the texts do not hold', () => {
        const verse = createVerse({ book: 'Exodus', chapter: 20, verse: 2 });
        updateSidebar(elements, verse, {
          verseTexts,
          overlay: null,
          search: null,
          pinned: false,
          textsNotice: null,
          wordsClickable: true,
        });

        expect(elements.hebrew?.textContent).toBe('');
        expect(elements.english?.textContent).toBe('');
      });

      it('shows the notice in place of the text while the texts are not in', () => {
        const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
        const notice = document.createElement('span');
        updateSidebar(elements, verse, {
          verseTexts: null,
          overlay: null,
          search: null,
          pinned: true,
          textsNotice: notice,
          wordsClickable: true,
        });

        expect(elements.hebrew?.contains(notice)).toBe(true);
        expect(elements.english?.textContent).toBe('');
        expect(elements.sidebar?.classList.contains('visible')).toBe(true);
      });
```

In `sidebar-word-clicks.test.ts`, add:

```ts
  it('leaves the words plain and unclickable while search has no data', () => {
    const handler = vi.fn();
    setWordClickHandler(handler);
    const elements = getSidebarElements();
    updateSidebar(elements, createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), {
      verseTexts: texts,
      overlay: null,
      search: null,
      pinned: true,
      textsNotice: null,
      wordsClickable: false,
    });

    expect(document.querySelectorAll('.verse-hebrew .verse-word')).toHaveLength(0);
    document.querySelector<HTMLElement>('.verse-hebrew')!.click();
    expect(handler).not.toHaveBeenCalled();
  });
```

In `src/__tests__/unit/verseTexts.test.ts`, replace the `textsFrom` case with:

```ts
  it('hands back the texts it was loaded with, or null while they are not in', () => {
    expect(textsFrom(new Map([[TEXTS_FILE, SAMPLE_VERSE_TEXTS]]))).toBe(SAMPLE_VERSE_TEXTS);
    expect(textsFrom(new Map())).toBeNull();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/unit/loadNotice.test.ts src/__tests__/unit/mapLegend.test.ts src/__tests__/unit/sidebar.test.ts src/__tests__/unit/sidebar-word-clicks.test.ts src/__tests__/unit/verseTexts.test.ts`
Expected: FAIL — `Failed to resolve import "../../loadNotice"`; the legend, popup and `textsFrom` cases fail on their new expectations.

- [ ] **Step 3: The notice**

`src/loadNotice.ts`:

```ts
// What a place shows while the reader waits on a file: that it is loading, or
// that it failed, with a × that closes the warning.
import './styles/load-notice.css';

export const LOADING = 'Loading…';
const FAILED = "Couldn't load — please reload and try again";

export function loadNotice(state: 'loading' | 'failed', onClose: () => void): HTMLElement {
  const notice = document.createElement('span');
  notice.className = 'load-notice';
  notice.dataset.state = state;
  notice.textContent = state === 'loading' ? LOADING : FAILED;
  if (state === 'failed') {
    notice.setAttribute('role', 'alert');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'load-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', onClose);
    notice.append(close);
  }
  return notice;
}
```

`src/styles/load-notice.css`:

```css
.load-notice {
  color: #999;
  font-family: system-ui, sans-serif;
  font-size: 13px;
}

.load-notice[data-state='failed'] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #e8b06a;
}

/* 24×24 at least: the touch-target floor the layout tests hold buttons to. */
.load-notice-close {
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
}
```

- [ ] **Step 4: The legend**

In `src/mapLegend.ts`:

```ts
export interface LegendRow {
  panel: FrontTool;
  name: string;
  summary: OverlaySummary;
  /** The tool is picked but its files are on their way. */
  loading?: boolean;
}

/**
 * Show `rows` in the legend's own order, search above overlay, and
 * `warnings` under them; with neither, hide the card.
 */
export function showLegend(
  legend: HTMLElement,
  rows: readonly LegendRow[],
  warnings: readonly Node[],
): void {
  for (const button of legend.querySelectorAll<HTMLElement>('.map-legend-row')) {
    const row = rows.find((r) => r.panel === button.dataset.panel);
    button.hidden = !row;
    button.toggleAttribute('data-loading', !!row?.loading);
    if (row) {
      button.querySelector('.map-legend-summary')!.innerHTML = summaryHtml(row.name, row.summary);
    }
  }
  const line = legend.querySelector<HTMLElement>('.map-legend-warning');
  if (line) {
    line.replaceChildren(...warnings);
    line.hidden = warnings.length === 0;
  }
  legend.hidden = rows.length === 0 && warnings.length === 0;
}
```

In `index.html`, inside `#map-legend` after the overlay row's `</button>`, add `<div class="map-legend-warning" hidden></div>`. In `src/styles/frame.css`, after the `.map-legend-row[hidden]` rule:

```css
/* A file a tool on the map needs failed; each warning's × closes it. */
.map-legend-warning {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: var(--legend-row);
  padding: 0 4px 0 12px;
}

.map-legend-warning[hidden] {
  display: none;
}

.map-legend-row:not([hidden]) ~ .map-legend-warning {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 5: The popup and the texts**

In `src/verseTexts.ts`:

```ts
export function textsFrom(loaded: Loaded): VerseTexts | null {
  return (loaded.get(TEXTS_FILE) as VerseTexts | undefined) ?? null;
}
```

In `src/sidebar.ts`, replace `PopupView` with:

```ts
/** What the popup shows beside the verse, and whether the verse is pinned. */
export interface PopupView {
  /** Null until the texts file is in. */
  verseTexts: VerseTexts | null;
  /** Shown where the text goes while the texts are not in. */
  textsNotice: Node | null;
  /** Whether a Hebrew word opens its menu when clicked: only once search has its data. */
  wordsClickable: boolean;
  overlay: ToolOnMap | null;
  search: ToolOnMap | null;
  pinned: boolean;
}
```

In `updateSidebar`, take `textsNotice` and `wordsClickable` from `view` with the others; `const text = verseTexts && getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);`; and replace the `if (hebrew) { … }` and `if (english) { … }` blocks with:

```ts
  if (hebrew) {
    const container = hebrew as HTMLElement;
    container.onclick = null;
    if (!text) {
      container.replaceChildren(...(textsNotice ? [textsNotice] : []));
    } else {
      const fragment = marked(text.he, HEBREW) ?? textFragment(text.he);
      if (wordsClickable) {
        // Whatever the overlay produced, words are wrapped afterwards, so a click
        // finds a word whether or not anything is highlighting the text.
        container.replaceChildren(wrapWordsInFragment(fragment, text.he));
        attachWordClicks(container, text.he, verse);
      } else {
        container.replaceChildren(fragment);
      }
    }
  }
  if (english) {
    const highlighted = text && marked(text.en, ENGLISH);
    if (highlighted) english.replaceChildren(highlighted);
    else english.textContent = text?.en ?? '';
  }
```

In `src/main.ts`: `updateSidebarWrapper` passes `textsNotice: null, wordsClickable: dataFor(searchTool, loaded) !== null` with the rest; `updateLegend` calls `showLegend(mapLegend, rows, [])`. (Task 7 fills both in.)

- [ ] **Step 6: Run everything**

Run: the five test files (PASS), prettier, `npm run typecheck`, `npx vitest run`, `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: PASS, every shot within the noise (the warning line is hidden in every state).

- [ ] **Step 7: Commit**

```bash
git add src index.html docs/plans/2026-09-30-draw-first-design.md
git commit -m "Say where a file is loading or failed; the popup without texts, and its words plain until search has its data"
```

---

### Task 7: Main draws first *(draws)*

**Files:**
- Modify: `src/main.ts`, `src/constants.ts`, `src/telemetry/schema.ts` (a comment), `layout/page.ts`, `video/browser.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `data-map-ready` at the first frame, `data-loaded` at the end; the suite of Task 1 passes.

Read the whole of `main()` before you start; the steps name the code they change, not line numbers.

- [ ] **Step 1: Imports and names**

In `src/main.ts`:
- From `'./dataFiles.ts'`: `dataFor, downloadFiles, loadFiles, overlayFiles, requiredFiles, type Loaded`.
- New: `import { downloadStages, filesFirst, staleAfterLanding, waitingOn, type LandingView, type OpeningView } from './downloads.ts';`, `import { loadNotice } from './loadNotice.ts';`, `import type { Picture } from './geometry.ts';`.
- From `'./scrollytelling/overlayBlender'`: `computeBlendedColors, stopTools`.
- From `'./overlays/search/index.ts'`: add `isSearching`.
- `prebuildCompleted` stays imported; `whenIdle` is not needed.

In `src/constants.ts`, rename `FRONT_FADE` to `MAP_FADE` and its comment to `/** How long the map takes to cross-fade to a new picture: the front tool switching, or data landing. */`. Rename it in `main.ts`. In `main.ts`, rename `frontFadeFrame` to `fadeFrame` and `cancelFrontFade` to `cancelFade` everywhere (`git grep -n "FRONT_FADE\|frontFadeFrame\|cancelFrontFade"` — Expected afterwards: no output).

- [ ] **Step 2: Startup loads the structure alone**

Replace the startup block from Task 2 (`let textsIn = 0;` … `const loaded: Loaded = arrived;`), the line `const verseTexts = textsFrom(loaded);`, and the three lines `const searchData = …`, `if (searchData) searchTool.prebuild?.(searchData);`, `const searchReady = performance.now();` with:

```ts
  // Everything but the structure loads behind the first frame (fileLanded).
  let loaded: Loaded = await loadFiles([STRUCTURE_FILE]);
  const downloads = {
    pending: new Set(overlayFiles(allOverlays).filter((path) => !loaded.has(path))),
    failed: new Set<string>(),
    closed: new Set<string>(),
  };
  const torahData = structureFrom(loaded);

  // Load timing, sent once every download has settled (sendLoadTiming).
  let firstFrame = 0;
  let textsIn = 0;
  let searchReady = 0;
  let downloadsSettled = false;
  let timingSent = false;
```

keeping `initBookData(torahData);` and what follows it.

- [ ] **Step 3: One cross-fade for the map**

Replace `setFrontTool` with:

```ts
  /**
   * Cross-fade the map from what it shows to `to` over MAP_FADE.DURATION_MS
   * through the renderer's own picture blend — the one a story ease uses —
   * then `settle` paints the picture it rests on. Snaps under reduced motion.
   */
  function fadeMap(to: Picture, settle: () => void): void {
    cancelFade();
    if (reducedMotion.matches) {
      settle();
      render();
      return;
    }
    // flatten collapses a fade already in progress to where it is, as a story
    // ease starting mid-blend does (beginEase).
    const from = flatten(withDefaults(colorLayer));
    const since = performance.now();
    const step = (now: number): void => {
      const raw = Math.min(1, (now - since) / MAP_FADE.DURATION_MS);
      fadeFrame = null;
      if (raw >= 1) {
        // The settled picture, not `to`: fillDefaultColors filled the holes a
        // real overlay leaves for an uncoloured match, which would hover
        // wrong (fillDefaultColors marks uncoloured only the holes it fills
        // itself) until the next repaint.
        settle();
      } else {
        setColorLayer({ from, to, t: easingFunctions[DEFAULT_EASING](raw) });
        fadeFrame = requestAnimationFrame(step);
      }
      render();
    };
    fadeFrame = requestAnimationFrame(step);
  }

  /** Move the front tool to `next`, fading the map; with only one tool on there is nothing to fade. */
  function setFrontTool(next: FrontTool): void {
    if (next === frontTool) return;
    frontTool = next;
    const tools = toolsNow();
    if (!tools.search || !tools.overlay) {
      applyTools();
      render();
      return;
    }
    fadeMap(
      fillDefaultColors(toolsPicture(tools, verses, mouseState.hoveredVerse, dimFor(next))),
      applyTools,
    );
  }
```

- [ ] **Step 4: The places that say a file is loading or failed**

Replace `updateLegend` with:

```ts
  function updateLegend(): void {
    const tools = toolsNow();
    const picked = {
      search: isSearching(overlaySettings.get(searchTool)) ? searchTool : null,
      overlay: currentOverlay,
    };
    const rows: LegendRow[] = [];
    const warnings: Node[] = [];
    for (const panel of ['search', 'overlay'] as const) {
      const on = tools[panel];
      const tool = picked[panel];
      if (on) {
        rows.push({
          panel,
          name: on.tool.name,
          summary: on.tool.summary?.(on.settings, on.data) ?? {},
        });
      } else if (tool) {
        // A picked tool without its data: its files are on their way, or one failed.
        const files = requiredFiles(tool);
        const state = waitingOn(files, downloads);
        if (state === 'loading') {
          rows.push({ panel, name: tool.name, summary: { detail: LOADING }, loading: true });
        } else if (state === 'failed') {
          warnings.push(loadNotice('failed', () => closeWarning(files)));
        }
      }
    }
    showLegend(mapLegend, rows, warnings);
  }
```

(import `LOADING` with `loadNotice`). Search's row and caption share its files, so closing either warning closes both. Replace `updateSidebarWrapper` with:

```ts
  function updateSidebarWrapper(verse: TanakhLayout | null, isPinned: boolean = false): void {
    const texts = waitingOn([TEXTS_FILE], downloads);
    updateSidebar(sidebarElements, verse, {
      verseTexts: textsFrom(loaded),
      textsNotice: texts && loadNotice(texts, () => closeWarning([TEXTS_FILE])),
      wordsClickable: dataFor(searchTool, loaded) !== null,
      ...toolsNow(),
      pinned: isPinned,
    });
  }
```

Add after `refreshVersePopup`:

```ts
  /** Say in the search caption that search's files are loading or failed; search fills it once they are in. */
  function showSearchNotice(): void {
    const caption = searchControls.querySelector('#search-hit-caption');
    if (!caption) return;
    const files = requiredFiles(searchTool);
    const state = waitingOn(files, downloads);
    if (state) caption.replaceChildren(loadNotice(state, () => closeWarning(files)));
    else caption.querySelector('.load-notice')?.remove();
  }

  /** Redraw every place that says a file is loading or failed. */
  function showLoadState(): void {
    updateLegend();
    showSearchNotice();
    refreshVersePopup();
  }

  /** The reader closed a warning: it stays closed for those files. */
  function closeWarning(paths: readonly string[]): void {
    for (const path of paths) if (downloads.failed.has(path)) downloads.closed.add(path);
    showLoadState();
  }
```

`searchControls` is declared further down than `refreshVersePopup`; both are inside `main`, and these functions run only after startup, so the order is fine. In `searchChanged`, after the `searchTool.renderControls?.(…)` call, add `showSearchNotice();`.

- [ ] **Step 5: A file lands, or fails**

Add before `restoreFromUrl`:

```ts
  /** The picked overlay, and search while it has a word. */
  function pickedTools(): Overlay[] {
    const tools: Overlay[] = currentOverlay ? [currentOverlay] : [];
    return isSearching(overlaySettings.get(searchTool)) ? [...tools, searchTool] : tools;
  }

  /** What the link or the story stop shows first. */
  function openingView(): OpeningView {
    if (frame.mode !== 'story') return { tools: pickedTools(), verse: pinnedVerse !== null };
    const stop = resolvedStops[storyStopIndex()];
    return { tools: stopTools(stop), verse: Boolean(stop.verse) };
  }

  function landingView(): LandingView {
    let map = pickedTools();
    if (driver.by === 'story' && driver.blend) {
      map = [...stopTools(driver.blend.from), ...stopTools(driver.blend.to)];
    } else if (driver.by === 'rejoining') {
      const state = currentStoryState();
      map = [...stopTools(state.fromStop), ...stopTools(state.toStop)];
    }
    return {
      source: colorSource(driver),
      map,
      panel: currentOverlay,
      popup: pinnedVerse !== null || mouseState.hoveredVerse !== null,
    };
  }

  /** Bring the map up to date with data that just landed, the way it is being drawn. */
  function redrawMap(how: 'fade' | 'blend' | 'ease'): void {
    if (how === 'fade') {
      fadeMap(
        fillDefaultColors(
          toolsPicture(toolsNow(), verses, mouseState.hoveredVerse, dimFor(frontTool)),
        ),
        applyTools,
      );
    } else if (how === 'blend' && driver.by === 'story' && driver.blend) {
      const { from, to, t } = driver.blend;
      fadeMap(
        flatten(computeBlendedColors(from, to, t, verses, mouseState.hoveredVerse, loaded)),
        blendTransition,
      );
    } else if (how === 'ease' && driver.by === 'rejoining') {
      // From where it is, for the time it has left, so it ends on the picture with the data.
      const now = performance.now();
      const left = driver.since + driver.duration - now;
      if (left > 0) keepDriving(beginEase(left, now));
      scheduleStoryFrame();
    }
  }

  function fileLanded(path: string, content: unknown): void {
    if (path === TEXTS_FILE) textsIn = performance.now();
    downloads.pending.delete(path);
    const before = loaded;
    loaded = new Map(before).set(path, content);
    const stale = staleAfterLanding(before, loaded, landingView());
    if (stale.map) redrawMap(stale.map);
    if (stale.overlayPanel) overlayChanged(false);
    if (stale.searchPanel) searchChanged(false);
    if (stale.popup) refreshVersePopup();
    const search = dataFor(searchTool, loaded);
    if (search !== dataFor(searchTool, before)) searchRecorder.dataChanged(search);
    prebuildCompleted(allOverlays, before, loaded, prebuilt);
  }

  function fileFailed(path: string): void {
    downloads.pending.delete(path);
    downloads.failed.add(path);
    showLoadState();
  }

  function prebuilt(overlay: Overlay): void {
    if (overlay !== searchTool) return;
    searchReady = performance.now();
    sendLoadTiming();
  }

  /**
   * Once every download has settled and search's index and dictionary are
   * built. search_ready stays 0 when search's files never arrived.
   */
  function sendLoadTiming(): void {
    if (timingSent || !downloadsSettled) return;
    if (dataFor(searchTool, loaded) && !searchReady) return;
    timingSent = true;
    const textsEntry = performance
      .getEntriesByType('resource')
      .find((e) => e.name.endsWith(`/${TEXTS_FILE}`)) as PerformanceResourceTiming | undefined;
    const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
    trackLoadTiming({
      first_frame: Math.round(firstFrame),
      texts_in: Math.round(textsIn),
      search_ready: Math.round(searchReady),
      texts_kbps: downloadKbps(textsEntry),
      connection: connection?.effectiveType ?? '',
    });
  }
```

`overlayChanged` and `searchChanged` each also redraw the legend and the popup, so a redraw can run twice in one landing; that is cheap and leaves the same result.

- [ ] **Step 6: Decide by the settings what the data does not change**

- In `syncStoryStopStateUnguarded`, replace `if (toolsNow().search) frontTool = 'search';` with `if (isSearching(overlaySettings.get(searchTool))) frontTool = 'search';`.
- In `onChromeClick`, replace `toolsNow().search ? 'search' : 'overlay'` with `isSearching(overlaySettings.get(searchTool)) ? 'search' : 'overlay'`.
- In the capture shortcut, delete `const { overlay } = toolsNow();` and write the overlay's part as `...(currentOverlay && { overlay: currentOverlay.id, ...overlaySettings.toUrl(currentOverlay) }),`.

- [ ] **Step 7: The end of `main`**

Replace everything from `// Layout tests wait on this; nothing in the app reads it.` to the end of `main` (the timing block and `prebuildCompleted(getAllOverlays(), new Map(), loaded, () => {});`) with:

```ts
  // The loading tests wait on this; nothing in the app reads it.
  document.documentElement.dataset.mapReady = '';
  firstFrame = performance.now();
  showLoadState();

  for (const stage of downloadStages(filesFirst(openingView()), allOverlays, loaded)) {
    await downloadFiles(stage, { landed: fileLanded, failed: fileFailed });
  }
  // The layout tests and the video harness wait on this; nothing in the app reads it.
  document.documentElement.dataset.loaded = '';
  downloadsSettled = true;
  sendLoadTiming();
}
```

In `src/telemetry/schema.ts`, change the comment above `load_timing` to:

```ts
  // Milliseconds since navigation start, sent once every download has settled:
  // first_frame when the map first draws, from the structure alone; texts_in
  // when the texts land; search_ready when search's index and dictionary are
  // built, 0 if its files never arrived. texts_kbps is 0 where the browser did
  // not report the download (a cached copy, or no Resource Timing entry).
```

- [ ] **Step 8: The layout tests and the video harness wait for the data**

In `layout/page.ts`, change `mapReady`'s first line and comment:

```ts
/**
 * Waits until every file has landed or failed and been drawn, and the map has
 * settled: the story applies a stop on the animation frame after startup, and
 * the title face arrives from Google Fonts with display=swap, changing text
 * widths.
 */
export async function mapReady(page: Page): Promise<void> {
  await page.locator('html[data-loaded]').waitFor({ state: 'attached', timeout: 60_000 });
```

In `video/browser.ts`'s `openMap`, wait on `html[data-loaded]` instead of `html[data-map-ready]`, and change the error to `'the map did not load within 30 seconds'`.

- [ ] **Step 9: Run everything**

Run: prettier on the changed files, `npm run typecheck` (fix every error in one pass), `npx vitest run`.
Run: `npm run test:loading > <SDD>/loading-task7.txt` — Expected: every case passes on both projects, the three desktop-only cases skipped on the phone. If a case fails, read its error and trace: `<SDD>`'s output names the case and the line. The plain-map floor (`COLOURED_FLOOR`) is the one number measured here: if a plain map measures more coloured pixels than it, print the count, set the floor above the largest plain count and below the smallest coloured one, and log it.
Run: `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: PASS, every shot within `layout-check.md`'s noise.
Run: `npm run build` — Expected: success.

Check by hand: start your own dev server; with a scratch Playwright script in `<SDD>` (the throttle and hold from `loading/page.ts` may be copied), open `?overlay=commentary` with commentary held, screenshot the desktop page before and after release, and Read both PNGs: the legend says it is loading, then the map is coloured. Stop your dev server.

- [ ] **Step 10: Commit**

```bash
git add src layout video docs/plans/2026-09-30-draw-first-design.md
git commit -m "Draw the map from the structure alone; load the rest in stages and fade in what each file brings"
```

---

### Task 8: Verify the whole branch and open the pull request

- [ ] **Step 1: What went is gone**

Run each; Expected: no output.

```bash
git grep -nE "prebuildAll|getBookOrder|FRONT_FADE|cancelFrontFade|frontFadeFrame" -- src scripts test-harness layout video loading
git grep -n "Loading\.\.\." -- src/sidebar.ts
git grep -n "data-map-ready" -- video
```

`git grep -n "data-map-ready" -- layout/page.ts` must show only `firstFrame`.

- [ ] **Step 2: Full gates**

Run: `npm run typecheck`, `npx vitest run`, `npm run build` — Expected: all pass. Record the test count.
Run: `npm run test:layout` and `node <SDD>/pixel-diff.mjs` — Expected: PASS, `git diff --quiet worktree-search-data -- layout/known.ts` exits 0, every shot within the noise.
Run: `npm run test:loading > <SDD>/loading-results.txt` — Expected: every case passes. This file goes in the PR.
Run: `node scripts/search/click-resolution-report.ts > <SDD>/report-after.txt`, then `node /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/compare-report.mjs /Users/danyel/code/MISC/torahmap/.claude/worktrees/search-data/.superpowers/sdd/2026-09-30-search-data-implementation/report-before.txt <SDD>/report-after.txt` — Expected: `IDENTICAL`.
Run: `npm run print` — Expected: PDFs written without error.

- [ ] **Step 3: Whole-branch review**

Per superpowers:subagent-driven-development, dispatch the final whole-branch reviewer with the spec, this plan and the Review Focus list, and a drift reviewer (anything said in two places that can drift apart: the file paths in `loading/files.ts`, the throttle profile, the notice wording, `staleAfterLanding`'s rule and its comment, the stage order in the design and in `downloadStages`). Tell both to push back rather than accept a claim in this plan they cannot verify. Fix what they find that the spec requires; log rulings per rule 1.

- [ ] **Step 4: Screenshots of the loading message and the warning**

Start your own dev server. Write `<SDD>/notice-shots.mjs`:

```js
// node <this file> <port> <out-dir>
// The four places a reader is told a file is loading or failed, desktop and phone.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [port, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const SCREENS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: devices['iPhone 13'],
};
const CASES = [
  { name: 'overlay-loading', link: 'overlay=commentary', hold: ['overlays/commentary/counts.json'] },
  { name: 'search-loading', link: `search=${encodeURIComponent('אלהים')}`, hold: ['all-texts.json', 'search/lexicon.json', 'search/word-lexemes.json', 'search/verse-lexemes.json'], panel: 'search' },
  { name: 'popup-loading', link: 'verse=Genesis.12.1', hold: ['all-texts.json'] },
  { name: 'overlay-failed', link: 'overlay=commentary', fail: ['overlays/commentary/counts.json'] },
  { name: 'popup-failed', link: 'verse=Genesis.12.1', fail: ['all-texts.json'] },
];
for (const [screen, options] of Object.entries(SCREENS)) {
  for (const c of CASES) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    for (const path of c.hold ?? []) await page.route(`**/data/${path}`, () => new Promise(() => {}));
    for (const path of c.fail ?? []) await page.route(`**/data/${path}`, (route) => route.abort());
    await page.goto(`http://localhost:${port}/?${c.link}`);
    const ready = c.fail ? 'html[data-loaded]' : 'html[data-map-ready]';
    await page.locator(ready).waitFor({ state: 'attached', timeout: 90_000 });
    if (c.panel && screen === 'phone') {
      await page.locator('#menu-toggle').click();
      await page.locator(`.menu-item[data-action="${c.panel}"]:visible`).click();
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(out, `${c.name}--${screen}.png`) });
    await context.close();
  }
}
await browser.close();
```

Run: `node <SDD>/notice-shots.mjs <port> docs/plans/images/2026-09-30-draw-first` — Expected: ten PNGs. Read each: the legend row says "Commentary · Loading…"; the search caption says "Loading…" (on the phone, with the panel open); the popup says "Loading…" where the text goes; the legend shows the warning with its ×; the popup shows the warning. Stop your dev server. Copy the layout shots `explore-link`, `story-stop-with-verse` and `explore-search-and-overlay-pinned` (desktop and phone) from `layout-report/shots/` into the same directory, to show the loaded states unchanged.

```bash
git add docs/plans/images/2026-09-30-draw-first
git commit -m "Screenshots for the pull request: the loading message and the warning"
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin worktree-draw-first
```

Write the PR body to `<SDD>/pr-body.md`, in plain prose (lead with the problem, then the approach; no coined terms):

- First line: `🤖 Claude:`
- The problem: the first frame waited for every file, about 4.9 MB compressed, so a slow phone saw nothing for a long time. What it does now: the map draws from the 17 KB structure file, everything else loads behind it in four stages, and each file fades in what it brings. Where the reader waits, it says "Loading…"; a failed file says so, with a × to close it.
- `Fixes #313.` Step 3 of 3, stacked on step 2's PR (#335); review that first. Note: GitHub closes an issue from a PR only when it merges into the default branch, so #313 may need closing by hand once the stack lands.
- The suite: what `npm run test:loading` checks and how (held files on a throttled connection), with `<SDD>/loading-results.txt`'s summary lines.
- The load timing fields and what each now marks (from the decision log), so the numbers before and after can be compared.
- Every ruling from the design doc's "Open questions, assumptions and rulings", one line each, linked by blob URL on the branch (`https://github.com/danyelf/torahmap/blob/worktree-draw-first/docs/plans/2026-09-30-draw-first-design.md#open-questions-assumptions-and-rulings`), and this plan.
- What to look at, and where: the Cloudflare preview link (it arrives as a comment from `cloudflare-workers-and-pages`; check with `gh pr view <n> --json comments` and add it once it lands). Open it with the browser's network throttled to a slow 4G profile: the bare address, `?overlay=commentary`, a search link, a pinned verse.
- The screenshots, embedded by commit-pinned URL, `![overlay-loading](https://raw.githubusercontent.com/danyelf/torahmap/<hash>/docs/plans/images/2026-09-30-draw-first/overlay-loading--desktop.png)`, each with a one-line caption.
- Last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

```bash
gh pr create --base worktree-search-data --title "Draw the map first, and load its data behind it (step 3 of 3, #313)" --body-file <SDD>/pr-body.md
```

If `worktree-search-data` has already merged into `main`, use `--base main`. Expected: a PR URL. Confirm with `gh pr view --json number,url,body,baseRefName` that the body contains `Fixes #313`.

- [ ] **Step 6: Mark the issue**

```bash
gh issue comment 313 --body "🤖 Claude: step 3 of 3 is up for review as #<PR>, stacked on step 2 (#335). Merging the stack fixes this issue."
```

Leave #313's `in-progress` label.

- [ ] **Step 7: Report**

Send `team-lead` the PR URL, the test count before and after, the loading suite's result, every ruling logged, anything skipped (and why), the preview link if it has arrived, and this note for Danyel: **once this lands, close #320 unmerged** — it tried the same thing and this replaces it.

---

## Plan-writer rulings for Danyel to check

Each is also an entry in the design doc's decision log (Task 0).

1. **The popup opens before the texts and says "Loading…"; a failed texts file shows the warning there.** The design says both "the popup stays closed until the texts arrive" (summary, failure section, Pinned-verse case) and "Loading… in the verse popup while the texts are" (the later "While data loads" section, added with your answers). This plan follows the later section, which also matches today's popup, and changes the three lines; the Pinned-verse case checks for the notice.
2. **The map and panels read a tool's required files; the popup also its optional ones.** That is how the per-word parse landing redraws only the popup, as the design's own example says, and how a reader scrolled down the results keeps their place.
3. `staleAfterLanding` takes the map's tools as a list, not `overlay` and `search`: in a story blend or ease the map shows the two stops' tools, not the picked overlay.
4. The fourth stage is "the optional files", today the parse alone; `filesFirst` names only required files.
5. "Loading…" covers a file queued for a later stage, not only one downloading.
6. **(Danyel)** A tool's legend row, the overlay's or search's alike, reads "<name> · Loading…" while waiting; on failure a warning line with its × replaces it under the rows (a button cannot hold the ×). Search's row joins its caption so a search link on a phone with the panel closed still says it is loading; the search-link case checks it on both screens.
7. Main writes the search caption's notice into search's own `#search-hit-caption`, which is empty without data.
8. Search names the structure file and the text index takes its book order from it; `getBookOrder` goes.
9. `dataFor` remembers one data object per overlay per set of its files' contents.
10. Popup words become clickable only once search's data is in.
11. A stop with a search puts search in front, and the story's last button picks the search panel, by whether search has a word, not whether its data has landed.
12. `load_timing` is sent once all downloads have settled and search's idle prebuild has run; `first_frame` is now the structure-only frame, `texts_in` unchanged, `search_ready` the end of search's prebuild (0 if its files failed), `texts_kbps` unchanged.
13. The suite's throttle is 150 ms latency, 16 Mbit/s — a 4 Mbit/s phone on the compressed site, since the dev server sends files uncompressed.
14. Main's recording wiring is tested by turning the dev server's analytics on from the test, with no app change.
15. The capture shortcut uses the picked overlay; the suite tests it with a stubbed clipboard.
16. `fadeMap(to, settle)` serves the front tool, explore landings and story blends; `FRONT_FADE` is renamed `MAP_FADE` (250 ms for all).
17. An ease restarts only while time is left; at its end the story paints the stop with the new data anyway.
18. "Plain" in the suite = fewer coloured canvas pixels than a small floor, measured in Task 7.
19. `loadFiles` loses its callback; `downloadFiles(paths, { landed, failed })` replaces it.
20. The layout and loading suites share their WebGL launch arguments from `layout/screens.ts`.
