# Code Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new text, the code map at `/codemap/`, that draws every line of this repo as a bar shaped
by its indent and length, coloured by what a pull request did to it, by churn, and by line type.

**Architecture:** A script (`scripts/codemap/`) reads git and writes three data files to
`public/data/codemap/`; an app (`apps/codemap/`) lays them out and hands them to the shared shell
with `createApp`, as `apps/euaiact/` does. One algorithm, carrying line numbers forward through a
diff, serves both the per-commit marks and churn.

**Tech Stack:** TypeScript, `tsx` for the script, vitest, Playwright layout suite, git CLI.

**Spec:** `docs/plans/2026-11-02-code-map-design.md`

## Global Constraints

- Preview only: `live: false` in `build.ts`'s `EXTRA_PAGES`. No Worker or `wrangler.jsonc` change.
- No renderer change. Bars are `MapItem`s with `width`; check the map at zoom 0.25 and 0.22 at
  screen density 1.5 and 2, at rest and while panning, before calling the layout done.
- Stepping between commits goes through the existing settings change and its cross-fade; no new
  animation path.
- No colour per commit.
- The script takes a repo path and two refs and knows nothing about torahmap; the app reads only
  its data files.
- Git only: `git diff`, `git log`, `git ls-files`. No diff library.
- The repo rules in `CLAUDE.md` and `AGENTS.md` apply: no ticket refs in code, tests check
  behaviour, say each thing once, short comments.

## Review Focus

1. **A pull request that only deletes** (a whole file, or lines with nothing added): the map must
   show deletion marks, not an unchanged map. Tests in Tasks 2 and 3.
2. **A line touched by an early commit and rewritten or removed by a later one**, in step-by-step
   mode: its mark lands where it now sits, or as a deletion mark at its spot. Test in Task 2.
3. **Renamed files**: a moved file is not all "added". Test in Task 3 (fixture repo with `git mv`).
4. **Very long lines and very long files**: a 3,000-character line or a 5,000-line file must not
   blow the layout's width or height. Test in Task 5.
5. **A branch with no commits beyond main**: the map opens, the PR overlay says there is nothing to
   show. Tests in Tasks 3 and 6.

---

### Task 1: Classify each line's type

**Files:**

- Create: `scripts/codemap/lineKind.ts`
- Test: `scripts/codemap/lineKind.test.ts`

**Interfaces:**

- Produces: `type LineKind = 'blank' | 'comment' | 'import' | 'header' | 'code'`;
  `lineKinds(path: string, lines: readonly string[]): LineKind[]`

Line by line, with regexes, not the TypeScript compiler. A block comment spans lines, which is why
it takes the whole file. `header` is a line that opens a function, method, class or interface. For
files that are not `.ts`/`.js`/`.mjs`, only `blank` and `code`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(lineKinds('a.ts', ['', '  ', "import { x } from './x';", "export { y } from './y';"]))
  .toEqual(['blank', 'blank', 'import', 'import']);
expect(lineKinds('a.ts', ['// note', '/**', ' * more', ' */', 'const a = 1; // trailing']))
  .toEqual(['comment', 'comment', 'comment', 'comment', 'code']);
expect(lineKinds('a.ts', [
  'export function f(x: number): number {',
  'async function g() {',
  'export const h = (a: string) => {',
  '  method(a: string): void {',
  'export class C {',
  'interface I {',
  '  if (x) {',
])).toEqual(['header', 'header', 'header', 'header', 'header', 'header', 'code']);
expect(lineKinds('README.md', ['# Title', '', 'text'])).toEqual(['code', 'blank', 'code']);
```

- [ ] **Step 2: Run, see it fail.** `npx vitest run scripts/codemap/lineKind.test.ts` → FAIL.
- [ ] **Step 3: Implement `lineKinds`.** `if (x) {`, `for (...) {` and similar keywords are not
      headers.
- [ ] **Step 4: Run, see it pass.**
- [ ] **Step 5: Commit** `Code map: classify each line's type`.

### Task 2: Read a diff and carry lines forward through it

**Files:**

- Create: `scripts/codemap/diff.ts`
- Test: `scripts/codemap/diff.test.ts`

**Interfaces:**

- Produces:
  - `interface Hunk { oldStart: number; oldCount: number; newStart: number; newCount: number }`
    (1-based, as git's `@@ -a,b +c,d @@`)
  - `interface FileDiff { oldPath: string | null; newPath: string | null; hunks: Hunk[] }` (null
    for a file added or deleted)
  - `parseDiff(text: string): FileDiff[]` — reads `git diff -U0 -M` output.
  - `type Mark = 'added' | 'changed'`
  - `interface FileMarks { lines: Map<number, Mark>; deletedBefore: Set<number> }` — line numbers
    in the new file; `deletedBefore` holds the line just below each removal (one past the last line
    for a removal at the end).
  - `marksOf(hunks: readonly Hunk[]): FileMarks`
  - `carryForward(line: number, hunks: readonly Hunk[]): number | { removedBefore: number }` — where
    an old line number sits in the new file, or the spot it was removed at.

"Changed" is inferred (spec): in a hunk with both removed and added lines, the first
`min(oldCount, newCount)` added lines are `changed`, the rest `added`; if `oldCount > newCount`, the
line after the hunk also gets a deletion mark.

- [ ] **Step 1: Write the failing tests**

```ts
// parseDiff: a modify, a rename with an edit, an added and a deleted file.
expect(parseDiff(FIXTURE).map((f) => [f.oldPath, f.newPath, f.hunks.length]))
  .toEqual([['a.ts', 'a.ts', 2], ['old.ts', 'new.ts', 1], [null, 'add.ts', 1], ['gone.ts', null, 1]]);

// marksOf: 2 removed, 3 added at line 10 → 10,11 changed, 12 added.
expect(marksOf([{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 3 }]))
  .toEqual({ lines: new Map([[10, 'changed'], [11, 'changed'], [12, 'added']]), deletedBefore: new Set() });
// Pure deletion of old lines 5-7: git writes newStart 4, newCount 0.
expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 4, newCount: 0 }]).deletedBefore).toEqual(new Set([5]));
// 3 removed, 1 added: one changed, and a deletion mark below it.
expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 5, newCount: 1 }]))
  .toEqual({ lines: new Map([[5, 'changed']]), deletedBefore: new Set([6]) });

// carryForward: lines above a hunk keep their number, lines below shift, lines inside are removed.
const hunks = [{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 5 }];
expect(carryForward(3, hunks)).toBe(3);
expect(carryForward(20, hunks)).toBe(23);
expect(carryForward(11, hunks)).toEqual({ removedBefore: 15 });
```

- [ ] **Step 2: Run, see it fail.**
- [ ] **Step 3: Implement `parseDiff`, `marksOf`, `carryForward`.** `FIXTURE` is real
      `git diff -U0 -M` output, kept beside the test as `scripts/codemap/fixtures/sample.diff`.
- [ ] **Step 4: Run, see it pass.**
- [ ] **Step 5: Commit** `Code map: read a diff and carry lines forward`.

### Task 3: Build the data from a repo

**Files:**

- Create: `scripts/codemap/build.ts` (the command), `scripts/codemap/collect.ts` (git calls and
  assembly), `scripts/codemap/exclude.ts` (what is left out)
- Create: `apps/codemap/src/data.ts` (file names and shapes, read by both the script and the app)
- Modify: `package.json` — `"codemap": "tsx scripts/codemap/build.ts"`
- Test: `scripts/codemap/collect.test.ts`

**Interfaces:**

- Consumes: Task 1's `lineKinds`, Task 2's `parseDiff`, `marksOf`, `carryForward`.
- Produces, in `apps/codemap/src/data.ts`:

```ts
export const CODEMAP_DATA_DIR = 'codemap';
export const STRUCTURE_FILE = `${CODEMAP_DATA_DIR}/structure.json`;
export const TEXTS_FILE = `${CODEMAP_DATA_DIR}/texts.json`;

/** A mark string has one character per line: '.' untouched, 'a' added, 'c' changed. */
export interface Marks { marks: string; deletedBefore: number[] }

export interface CodeFile {
  path: string;
  /** Per line, parallel arrays. */
  indent: number[];
  length: number[];
  kind: string; // one LineKind initial per line: b c i h x
  lastChanged: number[]; // unix seconds
  timesChanged: number[];
  /** The pull request as a whole, then each of its commits in order. */
  pr: Marks;
  commits: Marks[];
  /** A file the pull request deleted: no lines, shown as a stub. */
  deleted?: true;
}

export interface CodeStructure {
  repoUrl: string; // for links to a line, e.g. https://github.com/danyelf/torahmap
  head: string;
  base: string;
  commits: { sha: string; subject: string }[];
  files: CodeFile[]; // sorted by path
}

/** Each file's lines, in the same order as structure.files. */
export type CodeTexts = readonly (readonly string[])[];

export function structureFrom(loaded: Loaded): CodeStructure;
```

- `collect(repo: string, base: string, head: string): { structure: CodeStructure; texts: CodeTexts }`
- `isExcluded(path: string): boolean` — lockfiles, `public/data/`, binaries (by extension), and
  generated files; the list lives only here.

The command: `npm run codemap -- [--repo <path>] [--base origin/main] [--head HEAD]`, writing both
files to `public/data/codemap/`. Base is the merge base of the two refs.

- Files and lines: `git ls-files` at head, minus `isExcluded`, read with `git show head:path`.
- The PR: `git diff -U0 -M <mergeBase> <head>` → `marksOf` per file. A file deleted by the PR is
  kept with `deleted: true`.
- Each commit: `git diff -U0 -M <sha>^ <sha>` for each commit in `git rev-list --reverse
  mergeBase..head`; each mark carried forward through the later commits' hunks to its head line
  number with `carryForward`. A line that does not survive becomes a `deletedBefore` entry.
- Churn: per file, `git log --follow --reverse -p -U0 -M --format=<sha and time>`; walk every
  commit, carrying a count and a last time per line forward with `carryForward`. Lines a commit adds
  start at count 1 with that commit's time.

- [ ] **Step 1: Write the failing tests.** Build a fixture repo in a temp directory with git
      (commits made in the test, fixed author dates via `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`):

```ts
// main: a.ts (5 lines), old.ts, gone.ts. Branch: commit 1 edits a.ts line 2 and adds line 6;
// commit 2 deletes a.ts line 4, git mv old.ts new.ts, deletes gone.ts.
const { structure, texts } = collect(repo, 'main', 'branch');
const a = structure.files.find((f) => f.path === 'a.ts')!;
// a.ts at head: 5 lines (5, plus line 6, less line 4); old line 6 is now line 5.
expect(a.pr.marks).toBe('.c..a');
expect(a.pr.deletedBefore).toEqual([4]);
expect(a.commits.map((c) => c.marks)).toEqual(['.c..a', '.....']);
expect(a.commits[1].deletedBefore).toEqual([4]);
expect(structure.files.find((f) => f.path === 'new.ts')!.pr.marks).toMatch(/^\.+$/); // rename, not added
expect(structure.files.find((f) => f.path === 'gone.ts')!.deleted).toBe(true);
expect(a.timesChanged[1]).toBe(2); // made on main, changed on the branch
expect(texts[structure.files.indexOf(a)]).toHaveLength(a.indent.length);
// A branch with no commits beyond main: no commits, every mark '.'.
expect(collect(repo, 'main', 'main').structure.commits).toEqual([]);
```

- [ ] **Step 2: Run, see it fail.**
- [ ] **Step 3: Implement `collect`, `isExcluded`, `build.ts`.**
- [ ] **Step 4: Run, see it pass.** Then `npm run codemap` on this branch; report the two files'
      sizes and the time taken. If `texts.json` is over 10 MB, stop and say so.
- [ ] **Step 5: Commit** the code and the generated `public/data/codemap/` files,
      `Code map: build the data from git`.

### Task 4: The app's page, wiring and base colour

**Files:**

- Create: `apps/codemap/package.json` (as `apps/euaiact/package.json`), `src/main.ts`, `src/page.ts`
  (`CODEMAP_PATH = '/codemap/'`, name "Code Map"), `src/site.ts` (`squareName: 'line'`,
  `direction: 'ltr'`), `src/files.ts`, `src/baseColor.ts`, `src/constants.ts`
- Modify: root `package.json` (dependency `@torahmap/codemap`), `pages.ts`, `build.ts`
  (`{ page: 'codemap', dataDir: CODEMAP_DATA_DIR, live: false }`), `vite.config.ts` (`PAGE_PATHS`,
  `PAGE_FILES`, `pageAddressPlugin('codemap')`), `test/package-imports.test.ts` if it lists apps
- Test: `apps/codemap/test/baseColor.test.ts`

Follow how `ieeevis` is wired in each of those files exactly; `git grep -n ieeevis` lists them.
`main.ts` turns analytics off, as the AI Act's does. Base colour: one grey with brightness jitter by
id, as `apps/euaiact/src/baseColor.ts`.

- [ ] **Step 1:** test that `baseColor` is a fixed grey within the jitter range for any line.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** `npm run typecheck` passes. Commit `Code map: the page and its wiring`. (The page
      cannot open until Task 5 gives it a text.)

### Task 5: Lay out the bars

**Files:**

- Create: `apps/codemap/src/layout.ts`, `apps/codemap/src/ids.ts`
- Test: `apps/codemap/test/layout.test.ts`

**Interfaces:**

- Consumes: `CodeStructure` (Task 3).
- Produces:
  - `lineId(path: string, line: number): string` → `` `${path}:${line}` ``; `parseLineId(id)`.
  - `interface CodeItem extends MapItem { file: number; line: number; kind: LineKind; deletedFile: boolean }`
  - `computeCodeLayout(structure: CodeStructure): { items: CodeItem[]; books: BookBox[]; bounds: Bounds }`

Layout rules (constants in `constants.ts`):

- A row per line, `ROW` map units tall; a bar starts at `colX + indent * CHAR` and is
  `max(length - indent, 1) * CHAR` wide, clipped at `MAX_CHARS` (100) characters from the column's
  left edge.
- A file is a column `MAX_CHARS * CHAR` wide; a file longer than `MAX_ROWS` (400) lines continues in
  the next column. Files are separated by `FILE_GAP`.
- A folder group (the first two path parts for `apps/` and `packages/`, the first part otherwise,
  `(root)` for files at the top) is a `BookBox` named for it; groups flow left to right and wrap to
  a new band at `MAX_WIDTH`, like the Tanakh's books.
- A deleted file is one bar `STUB_CHARS` wide in its place by path, with `deletedFile: true`.
- No jitter: the bars are widened squares.

- [ ] **Step 1: Write the failing tests**

```ts
// A line indented 4 with length 20 starts 4 chars in and is 16 chars wide.
// Two lines of one file sit one ROW apart in the same column.
// A 900-line file takes three columns (400, 400, 100).
// A 3,000-character line is no wider than MAX_CHARS.
// A deleted file is one item with deletedFile true.
// Every item id is unique; bounds contain every item.
```

- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** Commit `Code map: lay out the bars`.

### Task 6: The text, popup, search and the three overlays

**Files:**

- Create: `apps/codemap/src/text.ts`, `src/search.ts`, `src/references.ts`,
  `src/overlays/index.ts`, `src/overlays/pullRequest.ts`, `src/overlays/churn.ts`,
  `src/overlays/lineKind.ts`
- Test: `apps/codemap/test/overlays.test.ts`, `apps/codemap/test/references.test.ts`

**Interfaces:**

- Consumes: Tasks 3–5.
- Produces: `codemapText: MapText<CodeItem, TermSettings>`, built as `apps/euaiact/src/text.ts`.
  Popup: `ref` = `path:line`, `english` = the line's text, `link` =
  `${repoUrl}/blob/${head}/${path}#L${line}`. `goTo` reads `path` or `path:line` and completes paths.
  One story, a single stop showing the whole map, as the AI Act's `WHOLE_MAP`.

Overlays (`colorsFor` takes one `ColorArgs` object, as on main since #560):

- **Pull request** (`id: 'pr'`). Settings `{ commit: number | null }` (null = all commits); URL
  param `commit`, absent for all. Colours: added green, changed amber, untouched `null`; a line in
  `deletedBefore` is split `[red, its own colour]`; a deleted file's stub is red. Controls: "All
  commits", previous, next, and the commit's subject. Changing the commit is a settings change, so
  the map cross-fades. With no commits, the controls say there is nothing to show.
- **Churn** (`id: 'churn'`). Settings `{ measure: 'recent' | 'often' }`; URL param `measure`. A
  sequential scale: recent = newest bright; often = most changes bright. Legend as a `strip`.
- **Line type** (`id: 'kind'`). One colour per `LineKind`, legend by `swatchList`.

- [ ] **Step 1: Write the failing tests.** With a two-file `CodeStructure` made in the test:
      `pr` with `commit: null` colours an added line green, a changed line amber, an untouched
      line null, the line below a removal as a two-colour split, a deleted file red; with
      `commit: 2` only commit 2's marks show; `settingsFromUrl({})` gives `commit: null`; `churn`
      orders a line changed once below one changed five times; `kind` gives each kind a distinct
      colour. `goTo.read('a.ts:3')` names that line's id; `goTo.read('a.ts')` names the file's ids.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** `npm run dev`, open `/codemap/`, check each overlay and step through the commits;
      look at zoom 0.25 and 0.22 while panning for moiré. Commit `Code map: overlays and popup`.

### Task 7: Layout suite and pictures

**Files:**

- Modify: `test/layout/app.ts` (`CODEMAP_STATES`), `test/layout/known.test.ts`,
  `scripts/test-browser.ts` (route `apps/codemap/` and `scripts/codemap/` to the layout suite)
- Create: `test/layout/codemap.spec.ts` (as `ieeevis.spec.ts`)

States: `codemap-default`, `codemap-pr` (`overlay=pr`), `codemap-pr-commit` (`overlay=pr&commit=1`),
`codemap-churn`, `codemap-kind`, `codemap-popup` (a pinned line).

- [ ] **Step 1:** add the states and spec; `npm run test:layout -- -g codemap` passes.
- [ ] **Step 2:** `npm run test:browser` passes.
- [ ] **Step 3:** `npm run shots -- codemap-default codemap-pr codemap-pr-commit codemap-churn
      codemap-kind`; Read two or three of the PNGs to see the map really drew.
- [ ] **Step 4:** Commit `Code map: layout states`; push; open the PR with the shots' Markdown and
      the branch preview link at `/codemap/`.

### Task 8: Show another pull request as an artifact

**Files:**

- Create: `scripts/codemap/artifact.ts`; modify `package.json`
  (`"codemap:artifact": "tsx scripts/codemap/artifact.ts"`)

`npm run codemap:artifact -- --head <branch>` builds the data for that branch into a temporary
copy of `public/data/codemap/` (never the committed one), runs a Vite build of the code map page
alone with relative asset paths, and prints the folder holding the page and its files, ready for
Claude's Artifact tool (`file_path` = the page, `files` = the rest).

- [ ] **Step 1:** Implement; run it against a recent merged PR's branch.
- [ ] **Step 2:** Publish the folder with the Artifact tool; open the link and confirm the map draws
      and the PR overlay shows that branch's changes. If the artifact host cannot load the page's
      files, stop and report what failed.
- [ ] **Step 3:** Commit `Code map: publish another pull request as an artifact`.
