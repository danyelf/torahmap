# Code Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new text, the code map at `/codemap/`, that draws every line of a repo as a bar shaped
by its indent and length, coloured by what a pull request did to it, by churn, and by line type.

**Architecture:** A script, `scripts/codemap/`, reads a repo's git history and writes
`structure.json` and `texts.json` into a folder, by default `public/data/codemap/`. Committed in a
pull request's branch, they make the branch's Cloudflare preview show the map. An app,
`apps/codemap/`, lays the files out and hands them to the shared shell with `createApp`, as
`apps/euaiact/` does.

**Tech Stack:** TypeScript, `tsx` for the script, vitest, the Playwright layout suite, the git CLI.

**Spec:** `docs/plans/2026-11-02-code-map-design.md`

## Global Constraints

- The data files' shape is defined once, in `apps/codemap/src/data.ts`. The script imports it, so
  the script and the map cannot disagree without `npm run typecheck` failing. `scripts/codemap` is
  added to `tsconfig.json`'s `include` for that.
- The script takes a repo path and two refs and knows nothing about torahmap.
- Git only: `git ls-files`, `git show`, `git diff`, `git blame`, `git log`. No diff library.
- **This PR's marks** come from the PR's own commits. **Churn** covers the file's whole history:
  when each line last changed from `git blame`, how many times from a walk of `git log`.
- Preview only: `live: false` in `build.ts`'s `EXTRA_PAGES`. No Worker or `wrangler.jsonc` change.
- No renderer change. Bars are `MapItem`s with `width`. Check the map at zoom 0.25 and 0.22 at
  screen density 1.5 and 2, at rest and while panning, before calling the layout done.
- Stepping between commits is a settings change, so it uses the existing cross-fade. No new
  animation path, and no colour per commit.
- The rules in `CLAUDE.md` and `AGENTS.md` apply: no ticket refs in code, tests check behaviour,
  say each thing once, short comments.

## Review Focus

1. **A pull request that only deletes** (a whole file, or lines with nothing added): the map shows
   deletion marks, not an unchanged map. Tests in Tasks 2, 3 and 6.
2. **A line touched by an early commit and rewritten or removed by a later one**, in step-by-step
   mode: its mark lands where it now sits, or becomes a deletion mark at its spot. Tests in Tasks 2
   and 3.
3. **Renamed files**: a moved file is not all "added", and its churn follows it. Test in Task 3.
4. **Very long lines and very long files**: a 3,000-character line or a 5,000-line file must not
   blow the layout's width or height. Test in Task 5.
5. **A branch with no commits beyond main**: the map opens, and the PR overlay says there is
   nothing to show. Tests in Tasks 3 and 6.

---

### Task 1: The data format and each line's type

**Files:**

- Create: `apps/codemap/package.json` (as `apps/euaiact/package.json`), `apps/codemap/src/data.ts`
- Create: `scripts/codemap/lineKind.ts`, test `scripts/codemap/lineKind.test.ts`
- Modify: root `package.json` (dependency `@torahmap/codemap`), `tsconfig.json` (`include` gains
  `scripts/codemap`)

**Interfaces:** `apps/codemap/src/data.ts` holds exactly this, plus
`structureFrom(loaded: Loaded): CodeStructure` as in `apps/euaiact/src/data.ts`:

```ts
export const CODEMAP_DATA_DIR = 'codemap';
export const STRUCTURE_FILE = `${CODEMAP_DATA_DIR}/structure.json`;
export const TEXTS_FILE = `${CODEMAP_DATA_DIR}/texts.json`;

/** One character per line. */
export const LINE_KINDS = { b: 'blank', c: 'comment', i: 'import', h: 'header', x: 'code' } as const;
export type LineKind = keyof typeof LINE_KINDS;

/** One character per head line: '.' untouched, 'a' added, 'c' changed. */
export interface Marks {
  marks: string;
  /** Head line numbers (1-based) just below each removal; one past the last line for a removal at the end. */
  deletedBefore: number[];
}

export interface CodeFile {
  path: string;
  /** Per head line, parallel arrays. */
  indent: number[];
  length: number[];
  kind: string; // LineKind per line
  lastChanged: number[]; // unix seconds, from git blame
  timesChanged: number[]; // over the file's whole history
  /** The pull request as a whole, then each of its commits in order. */
  pr: Marks;
  commits: Marks[];
  /** A file the pull request deleted: no lines, drawn as a stub. */
  deleted?: true;
}

export interface CodeStructure {
  repoUrl: string; // for links to a line, e.g. https://github.com/danyelf/torahmap
  base: string; // merge-base sha
  head: string;
  commits: { sha: string; subject: string }[];
  files: CodeFile[]; // sorted by path
}

/** Each file's lines, in the order of structure.files. */
export type CodeTexts = readonly (readonly string[])[];
```

`lineKinds(path: string, lines: readonly string[]): string` in `scripts/codemap/lineKind.ts`
returns one `LineKind` per line. Line by line, with regexes, not the TypeScript compiler. A block
comment spans lines, which is why it takes the whole file. `h` is a line that opens a function,
method, class or interface; `if (x) {`, `for (…) {` and other keywords are not. `.ts`, `.js`,
`.mjs` and `.py` files get every kind; other files only `b` and `x`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(lineKinds('a.ts', ['', '  ', "import { x } from './x';", "export { y } from './y';"])).toBe('bbii');
expect(lineKinds('a.ts', ['// note', '/**', ' * more', ' */', 'const a = 1; // trailing'])).toBe('ccccx');
expect(lineKinds('a.ts', [
  'export function f(x: number): number {', 'async function g() {',
  'export const h = (a: string) => {', '  method(a: string): void {',
  'export class C {', 'interface I {', '  if (x) {',
])).toBe('hhhhhhx');
expect(lineKinds('README.md', ['# Title', '', 'text'])).toBe('xbx');
expect(lineKinds('a.py', ['import os', '# note', 'def f():', '    return 1'])).toBe('ichx');
```

- [ ] **Step 2:** `npx vitest run scripts/codemap/lineKind.test.ts` → FAIL.
- [ ] **Step 3:** implement `lineKinds`; write `data.ts` and `package.json`.
- [ ] **Step 4:** the test passes and `npm run typecheck` passes.
- [ ] **Step 5:** commit `Code map: the data format and each line's type`.

### Task 2: Read a diff and carry lines forward through it

**Files:** create `scripts/codemap/diff.ts`, test `scripts/codemap/diff.test.ts`, fixture
`scripts/codemap/fixtures/sample.diff` (real `git diff -U0 -M` output: a modify, a rename with an
edit, an added file, a deleted file)

**Interfaces:**

- `interface Hunk { oldStart: number; oldCount: number; newStart: number; newCount: number }`,
  1-based as git's `@@ -a,b +c,d @@`
- `interface FileDiff { oldPath: string | null; newPath: string | null; hunks: Hunk[] }`; null for
  an added or deleted file
- `parseDiff(text: string): FileDiff[]`
- `marksOf(hunks: readonly Hunk[], lineCount: number): Marks` (`Marks` from `data.ts`)
- `carryForward(line: number, hunks: readonly Hunk[]): number | { removedBefore: number }`: where
  an old line sits in the new file, or the new line just below where it was removed

"Changed" is inferred (spec): in a hunk with both removed and added lines, the first
`min(oldCount, newCount)` added lines are `c`, the rest `a`. If `oldCount > newCount`, the line
after the hunk also gets a deletion mark.

- [ ] **Step 1: Write the failing tests**

```ts
expect(parseDiff(SAMPLE).map((f) => [f.oldPath, f.newPath, f.hunks.length])).toEqual([
  ['a.ts', 'a.ts', 2], ['old.ts', 'new.ts', 1], [null, 'add.ts', 1], ['gone.ts', null, 1],
]);
expect(marksOf([{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 3 }], 12))
  .toEqual({ marks: '.........cca', deletedBefore: [] });
// Pure deletion of old lines 5-7: git writes newStart 4, newCount 0.
expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 4, newCount: 0 }], 6))
  .toEqual({ marks: '......', deletedBefore: [5] });
// 3 removed, 1 added: one changed, and a deletion mark below it.
expect(marksOf([{ oldStart: 5, oldCount: 3, newStart: 5, newCount: 1 }], 6))
  .toEqual({ marks: '....c.', deletedBefore: [6] });
const hunks = [{ oldStart: 10, oldCount: 2, newStart: 10, newCount: 5 }];
expect(carryForward(3, hunks)).toBe(3);
expect(carryForward(20, hunks)).toBe(23);
expect(carryForward(11, hunks)).toEqual({ removedBefore: 15 });
```

- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** commit `Code map: read a diff and carry lines forward`.

### Task 3: Build the data from a repo

**Files:** create `scripts/codemap/build.ts` (the command), `scripts/codemap/collect.ts` (git calls
and assembly), `scripts/codemap/exclude.ts` (what is left out), test
`scripts/codemap/collect.test.ts`; modify `package.json`
(`"codemap": "tsx scripts/codemap/build.ts"`)

**Interfaces:**

- `collect(repo: string, base: string, head: string, repoUrl: string): { structure: CodeStructure; texts: CodeTexts }`
- `isExcluded(path: string): boolean`: lockfiles, `public/data/`, binaries by extension, generated
  files. The list lives only here.
- Command: `npm run codemap -- [--repo <path>] [--base origin/main] [--head HEAD] [<out dir>]`, the
  out dir defaulting to `public/data/codemap/`. `repoUrl` comes from the repo's `origin` remote;
  the base is the merge base of the two refs.

How each part is made:

- Files and lines: `git ls-files` at head, less `isExcluded`, read with `git show head:path`.
- The PR: `git diff -U0 -M <merge base> <head>`, then `marksOf` per file. A file the PR deleted is
  kept with `deleted: true` and empty arrays.
- Each commit: `git diff -U0 -M <sha>^ <sha>` for each commit in
  `git rev-list --reverse <merge base>..<head>`. Each mark is carried through the later commits'
  hunks to its head line with `carryForward`; a line that does not survive becomes a
  `deletedBefore` entry where it was removed.
- `lastChanged`: `git blame --line-porcelain -M -C <head> -- path`, each line's committer time.
- `timesChanged`: per file, `git log --follow --reverse -p -U0 -M` over the whole history. Walk the
  commits carrying a count per line forward with `carryForward`; a line a commit adds or changes
  gains one.

- [ ] **Step 1: Write the failing tests.** Build a fixture repo in a temp directory, with fixed dates
      through `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`. On main: `a.ts` (5 lines), `old.ts`,
      `gone.ts`. Branch commit 1 edits `a.ts` line 2 and adds line 6; commit 2 deletes `a.ts` line
      4, runs `git mv old.ts new.ts`, and deletes `gone.ts`.

```ts
const { structure, texts } = collect(repo, 'main', 'branch', 'https://example.com/r');
const a = fileAt(structure, 'a.ts');
// a.ts at head: 5 lines (5, plus line 6, less line 4); old line 6 is now line 5.
expect(a.pr).toEqual({ marks: '.c..a', deletedBefore: [4] });
expect(a.commits.map((c) => c.marks)).toEqual(['.c..a', '.....']);
expect(a.commits[1].deletedBefore).toEqual([4]);
expect(new Set(fileAt(structure, 'new.ts').pr.marks)).toEqual(new Set(['.'])); // a rename, not an add
expect(fileAt(structure, 'gone.ts').deleted).toBe(true);
expect(a.timesChanged[1]).toBe(2); // made on main, changed on the branch
expect(a.lastChanged[1]).toBe(COMMIT_1_TIME);
expect(texts[structure.files.indexOf(a)]).toHaveLength(a.indent.length);
expect(collect(repo, 'main', 'main', URL).structure.commits).toEqual([]); // nothing beyond main
```

- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** run `npm run codemap -- <scratch folder>` on this branch; report the files' sizes
      and the time taken. If `texts.json` is over 10 MB, stop and say so.
- [ ] **Step 6:** commit `Code map: build the data from git`.

### Task 4: The page, wiring and base colour

**Files:**

- Create in `apps/codemap/src/`: `main.ts`; `page.ts` (`CODEMAP_PATH = '/codemap/'`, name "Code
  Map"); `site.ts` (`squareName: 'line'`, `direction: 'ltr'`); `files.ts`; `baseColor.ts`;
  `constants.ts`
- Create: `apps/codemap/test/helpers/fixture.ts`, a small hand-written `CodeStructure` and
  `CodeTexts` (three files, one deleted, two commits) that the map's tests use
- Modify: `pages.ts`, `build.ts` (`{ page: 'codemap', dataDir: CODEMAP_DATA_DIR, live: false }`),
  `vite.config.ts` (`PAGE_PATHS`, `PAGE_FILES`, `pageAddressPlugin('codemap')`)
- Test: `apps/codemap/test/baseColor.test.ts`

Wire it exactly as `ieeevis` is wired in each of those files; `git grep -n ieeevis` lists them.
`main.ts` turns analytics off, as the AI Act's does. Base colour: one grey with brightness jitter by
id, as in `apps/euaiact/src/baseColor.ts`.

- [ ] **Step 1:** a test that the base colour is that grey, within the jitter range.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** `npm run typecheck` passes. Commit `Code map: the page and its wiring`.

### Task 5: Lay out the bars

**Files:** create `apps/codemap/src/layout.ts`, `src/ids.ts`; test `apps/codemap/test/layout.test.ts`

**Interfaces:**

- `lineId(path: string, line: number): string` gives `` `${path}:${line}` ``; `parseLineId(id)`.
- `interface CodeItem extends MapItem { file: number; line: number; kind: string; deletedFile: boolean }`
- `computeCodeLayout(structure: CodeStructure): { items: CodeItem[]; books: BookBox[]; bounds: Bounds }`

Layout rules, with the constants in `constants.ts`:

- One row per line, `ROW` map units tall. A bar starts at `columnX + indent * CHAR` and is
  `max(length - indent, 1) * CHAR` wide, clipped at `MAX_CHARS` (100) from the column's left edge.
- A file is a column `MAX_CHARS * CHAR` wide. A file longer than `MAX_ROWS` (400) lines continues
  in the next column. Files are separated by `FILE_GAP`.
- A folder group is a `BookBox` named for it: the first two path parts under `apps/` and
  `packages/`, the first part otherwise, and `(root)` for top-level files. Groups flow left to
  right and wrap to a new band at `MAX_WIDTH`, like the Tanakh's books.
- A deleted file is one bar `STUB_CHARS` wide in its place by path, with `deletedFile: true`.
- No jitter: the bars are widened squares.

- [ ] **Step 1: Write the failing tests:** a line indented 4 with length 20 starts 4 characters in
      and is 16 wide; two lines of one file sit one `ROW` apart in the same column; a 900-line
      file takes three columns (400, 400, 100); a 3,000-character line is no wider than
      `MAX_CHARS`; a deleted file is one item with `deletedFile` true; every id is unique; the
      bounds contain every item.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** commit `Code map: lay out the bars`.

### Task 6: The text, popup, search and the three overlays

**Files:** create `apps/codemap/src/text.ts`, `src/search.ts`, `src/references.ts`,
`src/overlays/index.ts`, `src/overlays/pullRequest.ts`, `src/overlays/churn.ts`,
`src/overlays/lineKind.ts`; test `apps/codemap/test/overlays.test.ts` and
`apps/codemap/test/references.test.ts`

**Interfaces:** produces `codemapText: MapText<CodeItem, TermSettings>`, built as
`apps/euaiact/src/text.ts`:

- Popup: `ref` is `path:line`, `english` is the line's text, `link` is
  `${repoUrl}/blob/${head}/${path}#L${line}`.
- `goTo` reads `path` or `path:line` and completes paths.
- One story, a single stop showing the whole map, as the AI Act's `WHOLE_MAP`.
- Search is the AI Act's term search over the lines' text.

The overlays (`colorsFor` takes one `ColorArgs` object, as on main):

- **Pull request** (`id: 'pr'`). Settings `{ commit: number | null }`, null for all commits; URL
  param `commit`, absent for all.
  - Colours: added green, changed amber, untouched `null`. A line in `deletedBefore` is split
    `[red, its own colour]`; a deleted file's stub is red.
  - Controls: "All commits", previous, next, and the commit's subject. With no commits, the
    controls say there is nothing to show.
- **Churn** (`id: 'churn'`). Settings `{ measure: 'recent' | 'often' }`; URL param `measure`. A
  sequential scale, newest or most changed brightest, with its legend as a `strip`.
- **Line type** (`id: 'kind'`). One colour per kind, with a legend from `swatchList`.

- [ ] **Step 1: Write the failing tests, on the Task 4 fixture:**
  - `pr` with `commit: null` gives an added line green, a changed line amber, an untouched line
    null, the line below a removal a two-colour split, and a deleted file red.
  - With `commit: 2`, only commit 2's marks show, and `settingsFromUrl({})` gives `commit: null`.
  - `churn` puts a line changed once below one changed five times.
  - `kind` gives each kind its own colour.
  - `goTo.read('a.ts:3')` names that line's id, and `goTo.read('a.ts')` names the file's ids.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5:** commit `Code map: overlays and popup`.

### Task 7: Real data, the layout suite and pictures

**Files:**

- Add: `public/data/codemap/structure.json` and `texts.json`, written by `npm run codemap` (Task 3) on this
  branch
- Modify: `test/layout/app.ts` (`CODEMAP_STATES`), `test/layout/known.test.ts`,
  `scripts/test-browser.ts` (route `apps/codemap/` to the layout suite),
  `docs/working-in-the-repo.md` (a "Code map data" section like "IEEE VIS data": the script's
  command, where its output goes, and that a conflict in these files is settled by running the script again)
- Create: `test/layout/codemap.spec.ts`, as `ieeevis.spec.ts`

States: `codemap-default`, `codemap-pr` (`overlay=pr`), `codemap-pr-commit`
(`overlay=pr&commit=1`), `codemap-churn`, `codemap-kind`, `codemap-popup` (a pinned line).

- [ ] **Step 1:** run `npm run codemap` into `public/data/codemap/`. `npm run dev`, open `/codemap/`,
      try each overlay and step through the commits. Look at zoom 0.25 and 0.22 while panning, for
      moiré.
- [ ] **Step 2:** add the states and the spec; `npm run test:layout -- -g codemap` passes.
- [ ] **Step 3:** `npm run test:browser` passes.
- [ ] **Step 4:** `npm run shots -- codemap-default codemap-pr codemap-pr-commit codemap-churn codemap-kind`.
      Read two or three of the PNGs to check the map really drew.
- [ ] **Step 5:** commit `Code map: real data and layout states`; push; put the shots' Markdown and
      the branch preview link at `/codemap/` in the PR.
