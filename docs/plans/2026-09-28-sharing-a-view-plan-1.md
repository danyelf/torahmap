# Sharing a view, part 1: packages and query-string links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move link reading/writing, the stories and the overlays' names into
npm workspace packages, and move the view from the URL hash to the query
string. A reader sees only the address bar change.

**Architecture:** Three packages under `packages/`, each exporting TypeScript
source through its `package.json` `exports` (no build step of their own):
`@torahmap/link` (pure link logic), `@torahmap/overlay-catalog` (each
overlay's id, name, description and link keys), `@torahmap/stories` (the
Markdown, its parser, and a generation step replacing `import.meta.glob`).
`src/urlState.ts` keeps only what touches the browser.

**Tech Stack:** npm workspaces, TypeScript 7, Vite 7, Vitest 4, Node 24.

**Spec:** `docs/plans/2026-09-28-sharing-a-view.md` — this plan is its first
pull request ("How it lands", item 1).

## Global Constraints

- No new third-party dependencies. `~/.npmrc` refuses packages published in
  the last 7 days; if anything needs one, stop and ask.
- Packages never import from `src/`. `src/` imports packages by name
  (`@torahmap/link`), never by relative path into `packages/`.
- No compatibility shims: when code moves, its importers change. Nothing
  re-exports a moved name from its old file.
- `#` links are not read. The Talmud page keeps its own hash links
  (`src/talmud/urlState.ts`); leave it alone.
- Link keys and their order stay exactly as today.
- Comments follow AGENTS.md: present tense, only what the code cannot say, no
  ticket or step numbers.
- Every commit passes the pre-commit hook (format, typecheck, tests). A new
  worktree needs `npm ci` first.

## Review Focus

1. **A fresh checkout typechecks.** `npm ci && npm run typecheck` in a clean
   worktree, before any dev server or test run has generated the stories
   module, must pass. (Task 4, Step 7.)
2. **Editing a story while `npm run dev` runs** — add, change or delete a
   `.md` — shows up without restarting the server, as it does today. (Task 4,
   Step 8.)
3. **An old `#` link** (`/#verse=Genesis.1.1`) opens the plain map with no
   error, and the first URL write leaves no `#` behind. (Task 2, Step 1.)
4. **Back and Forward** restore the view from the query string. (Task 2,
   Step 1, the popstate test.)
5. **Cloudflare's build** (`npm ci`, `npm run build`) links the workspaces and
   the site loads on the PR's `workers.dev` preview. (Task 5, Step 4.)

---

## File structure

```
packages/
  link/
    package.json            @torahmap/link
    src/index.ts            public surface (re-exports only)
    src/params.ts           UrlParamSpec & kinds, validation, SEARCH_URL_PARAMS, RESERVED_KEYS
    src/link.ts             UrlState, readLink, writeLink, verse helpers, zoom limits
    test/link.test.ts       moved from src/__tests__/unit/urlState.test.ts (pure parts)
    test/link.security.test.ts  moved from src/__tests__/unit/urlState.security.test.ts
  overlay-catalog/
    package.json            @torahmap/overlay-catalog
    src/index.ts            one entry per overlay + overlayParamSpecs(id)
    test/catalog.test.ts
  stories/
    package.json            @torahmap/stories
    markdown/*.md           moved from src/stories/
    generate.mjs            markdown/*.md -> src/generated.ts; also a CLI
    vite-plugin.mjs         runs generate.mjs on config, and on .md changes in dev
    src/index.ts            STORY_MARKDOWN, STORIES, parser, story data types
    src/parser.ts           moved from src/scrollytelling/storyParser.ts
    src/types.ts            the data types moved from src/scrollytelling/types.ts
    src/generated.ts        written by generate.mjs; gitignored, prettier-ignored
    test/stories.test.ts
```

Changed: `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts`, `vite.config.ts`, `.gitignore`, `.prettierignore`,
`src/urlState.ts`, `src/camera.ts`, `src/main.ts`, `src/viewState.ts`,
`src/overlays/*`, `src/scrollytelling/*`, `layout/page.ts`, `layout/app.ts`,
`layout/app.spec.ts`, tests under `src/__tests__/`, `CLAUDE.md`.
Deleted: `src/stories/` (moved).

---

### Task 1: The workspace and `@torahmap/link`

A pure move: behaviour is unchanged and links are still in the hash when this
task ends.

**Files:**
- Create: `packages/link/package.json`, `packages/link/src/{index,params,link}.ts`
- Move: pure tests from `src/__tests__/unit/urlState.test.ts` and all of
  `src/__tests__/unit/urlState.security.test.ts` to `packages/link/test/`
- Modify: `package.json`, `tsconfig.json`, `tsconfig.build.json`,
  `vitest.config.ts`, `src/urlState.ts`, `src/camera.ts`, and every importer
  listed in Step 5

**Interfaces — produces (`@torahmap/link`):**
```ts
export type UrlParamKind = 'token' | 'category' | 'text' | 'names';
export interface UrlParamSpec { key; kind; allowed?; default? }        // unchanged
export type UrlParamValues<S> = …;                                      // unchanged
export type OverlayParams = UrlParamValues;
export type OverlayParamSpecLookup = (overlayId: string) => readonly UrlParamSpec[] | undefined;
export interface UrlState { story?; stop?; overlay?; verse?; zoom?; x?; y?; overlayParams; searchParams? } // unchanged
export const SEARCH_URL_PARAMS, SEARCH_KEYS, RESERVED_KEYS;           // unchanged
export const MIN_ZOOM = 0.1, MAX_ZOOM = 10.0;                          // moved from src/camera.ts
export function validateOverlayParams(specs, raw): UrlParamValues;     // unchanged
/** The view a link's query string names. Accepts "?a=b", "a=b" or URLSearchParams. */
export function readLink(query: string | URLSearchParams, lookup?: OverlayParamSpecLookup): UrlState;
/** The query string for a view, with its leading "?", or "" for the default view. */
export function writeLink(state: UrlState): string;
export function verseToUrlFormat(book, chapter, verse): string;        // unchanged
export function parseVerseFromUrl(s): { book; chapter; verse } | null; // unchanged
```

- [ ] **Step 1: Declare the workspace.** In the root `package.json` add
  `"workspaces": ["packages/*"]` and
  `"dependencies": { "@torahmap/link": "*" }`. Create `packages/link/package.json`:

```json
{
  "name": "@torahmap/link",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 2: Point the tools at `packages/`.**
  - `tsconfig.json`: `"include": ["src", "packages"]`.
  - `tsconfig.build.json`: `"exclude": ["src/__tests__", "packages/*/test"]`.
  - `vitest.config.ts`: `include: ['src/**/*.test.ts', 'packages/*/test/**/*.test.ts']`.
  - Run `npm install`, then check the link exists:
    `ls -l node_modules/@torahmap/` shows `link -> ../../packages/link`.
    Commit the `package-lock.json` change with this task.

- [ ] **Step 3: Move the pure code.** From `src/urlState.ts`:
  - to `packages/link/src/params.ts`: `UrlParamKind`, `UrlParamSpec`,
    `UrlParamValues`, `SEARCH_URL_PARAMS`, `SEARCH_KEYS`, `OverlayParams`,
    `OverlayParamSpecLookup`, `RESERVED_KEYS`, the length constants,
    `NAMES_ALLOWED`, `baseValidate`, `validateString`, `validateCategoryName`,
    `validateOneParam`, `validateOverlayParams`, `stripHtmlTags` — with their
    comments, unchanged. Export `validateString` for `link.ts`.
  - to `packages/link/src/link.ts`: `UrlState`, `MAX_PAN_POSITION`,
    `validateBookName`, `verseToUrlFormat`, `parseVerseFromUrl`, and
    `parseUrlState`/`buildUrlHash` reshaped as `readLink`/`writeLink`:

```ts
export function readLink(
  query: string | URLSearchParams,
  lookupOverlayParams?: OverlayParamSpecLookup,
): UrlState {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  // …the body of parseUrlState from `const state` on, unchanged
}

export function writeLink(state: UrlState): string {
  // …the body of buildUrlHash, unchanged except that both returns use '?':
  //   return `?${params.toString()}`;          (story branch)
  //   return query ? `?${query}` : '';          (end)
}
```

  `URLSearchParams` drops one leading `?`, so `readLink(location.search)` needs
  no slicing.
  - Move `MIN_ZOOM` and `MAX_ZOOM` from `src/camera.ts` into `link.ts`, and have
    `src/camera.ts` import them from `@torahmap/link`, re-exporting nothing.
    The range a link may carry and the range the camera allows are one range;
    the link owns it because packages cannot import from `src/`.
  - `packages/link/src/index.ts` re-exports the public surface above and
    nothing else.

- [ ] **Step 4: Keep the browser half in `src/urlState.ts`.** It keeps
  `applyingExternalState`, `isApplyingExternalState`, `updateUrl`,
  `subscribeToHashChange`, and gains thin wrappers so callers still read the
  current location in one place:

```ts
import { readLink, writeLink, type OverlayParamSpecLookup, type UrlState } from '@torahmap/link';

/** The view the current address names. */
export function parseUrlState(lookupOverlayParams?: OverlayParamSpecLookup): UrlState {
  return readLink(window.location.hash.slice(1), lookupOverlayParams);
}
```

  In `updateUrl`, build the hash from `writeLink(state).replace(/^\?/, '#')`
  for now; Task 2 removes that line. Update the file's header comment to say
  it is the browser's half of `@torahmap/link`.

- [ ] **Step 5: Change every importer** to take moved names from
  `@torahmap/link`: `src/main.ts`, `src/viewState.ts`,
  `src/overlays/{types,settings,registry}.ts`, `src/overlays/search/index.ts`,
  `src/scrollytelling/{storyParser,overlayBlender,storyPanel}.ts`,
  `src/__tests__/helpers/overlayUrlParams.ts`, and the tests found by
  `grep -rln "urlState\|MIN_ZOOM\|MAX_ZOOM" src layout`. Tests that call
  `buildUrlHash` switch to `writeLink` and expect `?` where they expected `#`
  (hash tests of the browser half stay as they are until Task 2).

- [ ] **Step 6: Move the pure tests.** `urlState.security.test.ts` tests only
  validation: move it whole to `packages/link/test/link.security.test.ts`,
  calling `readLink(query)` instead of mocking `window.location`. From
  `urlState.test.ts`, move every `describe` that exercises parsing, building,
  validation or verse helpers to `packages/link/test/link.test.ts`, rewritten
  the same way:

```ts
// before
mockWindowLocation('http://localhost:5173/#zoom=4&x=100&y=200');
const state = parseUrlState();
// after
const state = readLink('?zoom=4&x=100&y=200');
```

  What remains in `src/__tests__/unit/urlState.test.ts` covers `updateUrl`,
  `applyingExternalState` and `parseUrlState` reading the location.

- [ ] **Step 7: Run everything.**
  Run: `npm run typecheck && npm test`
  Expected: PASS, with the same test count as before the task (tests moved,
  none lost). Compare against `npx vitest run 2>&1 | grep Tests` on `main`.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "Move link reading and writing into @torahmap/link"`

---

### Task 2: Links live in the query string

**Files:**
- Modify: `src/urlState.ts`, `src/main.ts:1700`, `layout/page.ts`,
  `layout/app.ts`, `layout/app.spec.ts`, and the tests that set
  `window.location.hash`
- Test: `src/__tests__/unit/urlState.test.ts`,
  `src/__tests__/integration/url-state-sync.test.ts`

**Interfaces — produces:** `src/urlState.ts` exports `parseUrlState(lookup?)`
(reads `location.search`), `updateUrl(state, push?)` (writes
`pathname + writeLink(state)`), `subscribeToHistory(callback)` (renamed from
`subscribeToHashChange`), `applyingExternalState`, `isApplyingExternalState`.
Tests get a helper `setLink(query: string)` in
`src/__tests__/helpers/setLink.ts`.

- [ ] **Step 1: Write the failing tests** in
  `src/__tests__/unit/urlState.test.ts`:

```ts
import { setLink } from '../helpers/setLink';

describe('the address holds the view in its query string', () => {
  it('reads the view from the query string', () => {
    setLink('?verse=Genesis.1.1&overlay=commentary');
    expect(parseUrlState()).toMatchObject({ verse: 'Genesis.1.1', overlay: 'commentary' });
  });

  it('ignores a hash link', () => {
    history.replaceState(null, '', '/#verse=Genesis.1.1');
    expect(parseUrlState().verse).toBeUndefined();
  });

  it('writes the query string and drops any hash', () => {
    history.replaceState(null, '', '/#verse=Genesis.1.1');
    updateUrl({ verse: 'Exodus.2.3', overlayParams: {} });
    expect(window.location.search).toBe('?verse=Exodus.2.3');
    expect(window.location.hash).toBe('');
  });

  it('adds no history entry for an unchanged view', () => {
    setLink('?verse=Genesis.1.1');
    const before = history.length;
    updateUrl({ verse: 'Genesis.1.1', overlayParams: {} }, true);
    expect(history.length).toBe(before);
  });

  it('hears Back and Forward', () => {
    const heard = vi.fn();
    subscribeToHistory(heard);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(heard).toHaveBeenCalledOnce();
  });
});
```

  and `src/__tests__/helpers/setLink.ts`:

```ts
/** Put the app at a link, without navigating. `query` is "?a=b" or "". */
export function setLink(query: string): void {
  history.replaceState(null, '', `/${query}`);
}
```

- [ ] **Step 2: Run them** — `npx vitest run src/__tests__/unit/urlState.test.ts`.
  Expected: FAIL (the reads still come from the hash; `subscribeToHistory` is
  not defined).

- [ ] **Step 3: Implement** in `src/urlState.ts`:

```ts
export function parseUrlState(lookupOverlayParams?: OverlayParamSpecLookup): UrlState {
  return readLink(window.location.search, lookupOverlayParams);
}

export function updateUrl(state: UrlState, pushHistory: boolean = false): void {
  if (urlWritesSuspended > 0) return;
  const query = writeLink(state);
  if (query === window.location.search && !window.location.hash) return;
  const newUrl = window.location.pathname + query;
  if (pushHistory) history.pushState(null, '', newUrl);
  else history.replaceState(null, '', newUrl);
}

/** Back and Forward. The app writes the address only through updateUrl, which fires no event. */
export function subscribeToHistory(callback: () => void): void {
  window.addEventListener('popstate', callback);
}
```

  Shorten the long comment above the old `subscribeToHashChange` to the one
  line shown. In `src/main.ts`, `if (window.location.hash)` becomes
  `if (window.location.search)`, and `subscribeToHashChange` becomes
  `subscribeToHistory`.

- [ ] **Step 4: Move the remaining tests to the query string.** Every test
  that sets `window.location.hash = …` or mocks a `/#…` URL now calls
  `setLink('?…')`; assertions on `window.location.hash` become assertions on
  `window.location.search`. Find them with
  `grep -rln "location.hash\|/#" src/__tests__`. Includes
  `story-file.test.ts` ("has an id a link can carry").

- [ ] **Step 5: The layout tests.** In `layout/page.ts`, `openMap(page, hash)`
  becomes `openMap(page, link)` and navigates to `link ? `/?${link}` : '/'`;
  update its doc comment. In `layout/app.ts`, rename each state's `hash` field
  to `link`. In `layout/app.spec.ts`, `'/#overlay=commentary'` becomes
  `'/?overlay=commentary'`.

- [ ] **Step 6: Run** — `npm run typecheck && npm test`. Expected: PASS.

- [ ] **Step 7: Check the app by hand.** Start `npm run dev` as a background
  task, read the port from its output, and load
  `http://localhost:<port>/?verse=Genesis.12.1&overlay=commentary`: the verse
  is pinned under the commentary overlay. Pan, pick another overlay, press
  Back: the earlier view returns and the address shows `?`, never `#`. Load
  `/?story=tour&stop=abraham_call`: the story opens at that stop. Load
  `/#verse=Genesis.1.1`: the plain map, no console errors. Stop the server.

- [ ] **Step 8: Commit** — `git commit -am "Keep the view in the query string, not the hash"`

---

### Task 3: `@torahmap/overlay-catalog`

**Files:**
- Create: `packages/overlay-catalog/package.json`,
  `packages/overlay-catalog/src/index.ts`,
  `packages/overlay-catalog/test/catalog.test.ts`
- Modify: `src/overlays/{commentary,trop,haftarah,verse-length,text-dating}.ts`,
  `src/main.ts` (the `getOverlay(id)?.urlParams` lookups)

**Interfaces — produces (`@torahmap/overlay-catalog`):**
```ts
export interface OverlayEntry<S extends readonly UrlParamSpec[] = readonly UrlParamSpec[]> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly urlParams?: S;
}
export const COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH, TEXT_DATING; // OverlayEntry each
/** The link keys an overlay declares, by id; undefined for an unknown id. */
export const overlayParamSpecs: OverlayParamSpecLookup;
/** An overlay's display name, by id; undefined for an unknown id. */
export function overlayName(id: string): string | undefined;
```
Consumes `UrlParamSpec`, `OverlayParamSpecLookup` from `@torahmap/link`.

- [ ] **Step 1: Write the failing test** `packages/overlay-catalog/test/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SEARCH_KEYS, RESERVED_KEYS } from '@torahmap/link';
import { overlayName, overlayParamSpecs, COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH, TEXT_DATING } from '@torahmap/overlay-catalog';

const ALL = [COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH, TEXT_DATING];

describe('the overlay catalog', () => {
  it('names each overlay by id', () => {
    expect(overlayName('commentary')).toBe('Commentary');
    expect(overlayName('nope')).toBeUndefined();
  });

  it('gives each overlay its link keys', () => {
    expect(overlayParamSpecs('commentary')).toBe(COMMENTARY.urlParams);
    expect(overlayParamSpecs('nope')).toBeUndefined();
  });

  it.each(ALL)('$id claims no key that belongs to the link or the search', (entry) => {
    for (const { key } of entry.urlParams ?? []) {
      expect(SEARCH_KEYS.has(key) || RESERVED_KEYS.has(key)).toBe(false);
    }
  });
});
```

  And in the existing overlay tests, one assertion per overlay that the full
  overlay carries its entry: e.g. in `src/__tests__/unit/overlays/commentary.test.ts`,
  `expect(commentaryOverlay.name).toBe(COMMENTARY.name)`.

- [ ] **Step 2: Run** — `npx vitest run packages/overlay-catalog`. Expected:
  FAIL (package missing).

- [ ] **Step 3: Implement.** Create `packages/overlay-catalog/package.json`
  like the link package's, named `@torahmap/overlay-catalog`, with
  `"dependencies": { "@torahmap/link": "*" }`. Move each overlay's `id`,
  `name`, `description` and `URL_PARAMS` (keeping `as const satisfies readonly
  UrlParamSpec[]`, which keeps the literal types `settingsFromUrl` relies on)
  into `src/index.ts`:

```ts
const COMMENTARY_PARAMS = [ /* moved verbatim from src/overlays/commentary.ts */ ] as const satisfies readonly UrlParamSpec[];

export const COMMENTARY = {
  id: 'commentary',
  name: 'Commentary',
  description: 'Shades each verse by how much has been written about it: …', // verbatim
  urlParams: COMMENTARY_PARAMS,
} as const satisfies OverlayEntry;
// …TROP, HAFTARAH, VERSE_LENGTH, TEXT_DATING the same way

const BY_ID: ReadonlyMap<string, OverlayEntry> = new Map(
  [COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH, TEXT_DATING].map((e) => [e.id, e]),
);
export const overlayParamSpecs: OverlayParamSpecLookup = (id) => BY_ID.get(id)?.urlParams;
export const overlayName = (id: string): string | undefined => BY_ID.get(id)?.name;
```

  Each overlay file spreads its entry and drops the moved fields:

```ts
export const commentaryOverlay: Overlay<TanakhIdentity, CommentarySettings> = {
  ...COMMENTARY,
  credits: [ … ],
  // …everything else unchanged; `settingsFromUrl(params: UrlParamValues<typeof COMMENTARY.urlParams>)`
};
```

  If the type checker rejects the spread for an overlay without settings
  (`urlParams?: never`), give that entry no `urlParams` field rather than
  loosening `Overlay`. In `src/main.ts`, lookups written
  `(id) => getOverlay(id)?.urlParams` become `overlayParamSpecs`. Add
  `"@torahmap/overlay-catalog": "*"` to the root `package.json`
  `dependencies` alongside `"@torahmap/link": "*"`, and run `npm install`.

- [ ] **Step 4: Run** — `npm run typecheck && npm test`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Move each overlay's name and link keys into @torahmap/overlay-catalog"`

---

### Task 4: `@torahmap/stories`

**Files:**
- Create: `packages/stories/{package.json,generate.mjs,vite-plugin.mjs}`,
  `packages/stories/src/{index,parser,types}.ts`,
  `packages/stories/test/stories.test.ts`
- Move: `src/stories/*.md` → `packages/stories/markdown/`;
  `src/scrollytelling/storyParser.ts` → `packages/stories/src/parser.ts`;
  `src/__tests__/unit/storyParser.test.ts` → `packages/stories/test/parser.test.ts`
- Modify: `src/scrollytelling/types.ts`, every importer of `src/stories` or
  `storyParser`, `vite.config.ts`, `vitest.config.ts`, `package.json` scripts,
  `.gitignore`, `.prettierignore`
- Delete: `src/stories/index.ts`

**Interfaces — produces (`@torahmap/stories`):**
```ts
export type { CameraPosition, CameraRef, StoryStop, StoryData, EasingName } from './types';
export { parseStoryMarkdown, STORY_HEADER_KEYS } from './parser';
/** Each story's Markdown, by id: its file name without `.md`. */
export const STORY_MARKDOWN: Readonly<Record<string, string>>;
/** Every story, parsed. Drafts included; the page decides whether to list them. */
export const STORIES: readonly { id: string; data: StoryData }[];
```
`src/scrollytelling/types.ts` keeps `ResolvedStoryStop` and
`InterpolatedState`, importing what they build on from `@torahmap/stories`.
`Story`, `listedStories` and `storyToOpen` stay in `src/scrollytelling/storyIndex.ts`.

- [ ] **Step 1: Write the failing test** `packages/stories/test/stories.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { STORY_MARKDOWN, STORIES } from '@torahmap/stories';

const dir = fileURLToPath(new URL('../markdown/', import.meta.url));

describe('the stories', () => {
  it('include every Markdown file in the folder', () => {
    const ids = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
    expect(Object.keys(STORY_MARKDOWN).sort()).toEqual(ids.sort());
  });

  it('are each parsed once, by id', () => {
    expect(STORIES.map((s) => s.id).sort()).toEqual(Object.keys(STORY_MARKDOWN).sort());
    expect(STORIES.find((s) => s.id === 'tour')?.data.title).toBe('The Guided Tour');
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run packages/stories`. Expected: FAIL.

- [ ] **Step 3: The generator.** `packages/stories/generate.mjs`:

```js
// Compiles markdown/*.md into src/generated.ts, so that every tool that bundles
// this package (Vite, Vitest, Wrangler, tsc) sees the same plain module.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

export const MARKDOWN_DIR = fileURLToPath(new URL('./markdown/', import.meta.url));
const OUT = fileURLToPath(new URL('./src/generated.ts', import.meta.url));

export function generateStories() {
  const stories = Object.fromEntries(
    readdirSync(MARKDOWN_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => [f.slice(0, -3), readFileSync(MARKDOWN_DIR + f, 'utf8')]),
  );
  const text =
    '// Written by generate.mjs from markdown/*.md. Do not edit.\n' +
    `export const STORY_MARKDOWN: Readonly<Record<string, string>> = ${JSON.stringify(stories, null, 2)};\n`;
  // Unchanged output is not rewritten, so the dev server does not reload for nothing.
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) writeFileSync(OUT, text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateStories();
```

- [ ] **Step 4: The Vite plugin.** `packages/stories/vite-plugin.mjs`:

```js
import { generateStories, MARKDOWN_DIR } from './generate.mjs';

/** Keeps src/generated.ts in step with the Markdown, at startup and on every edit. */
export function storiesPlugin() {
  return {
    name: 'torahmap-stories',
    config() {
      generateStories();
    },
    configureServer(server) {
      server.watcher.add(MARKDOWN_DIR);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(MARKDOWN_DIR) && file.endsWith('.md')) generateStories();
      });
    },
  };
}
```

  `packages/stories/package.json`:

```json
{
  "name": "@torahmap/stories",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./vite-plugin": "./vite-plugin.mjs" },
  "dependencies": { "@torahmap/link": "*" }
}
```

  Add `storiesPlugin()` to `plugins` in both `vite.config.ts` and
  `vitest.config.ts` (`import { storiesPlugin } from '@torahmap/stories/vite-plugin'`).
  In the root `package.json`, add `"@torahmap/stories": "*"` to
  `dependencies`, and make the two scripts that run `tsc` before Vite generate
  first:
  - `"typecheck": "node packages/stories/generate.mjs && tsc --project tsconfig.build.json --noEmit && tsc --project layout/tsconfig.json --noEmit"`
  - `"build": "node packages/stories/generate.mjs && tsc --project tsconfig.build.json && vite build"`

  Add `packages/stories/src/generated.ts` to `.gitignore` and
  `.prettierignore`. Run `npm install`.

- [ ] **Step 5: Move the stories and the parser.**
  `git mv src/stories/*.md packages/stories/markdown/`;
  `git mv src/scrollytelling/storyParser.ts packages/stories/src/parser.ts`,
  importing `parseVerseFromUrl` and `SEARCH_KEYS` from `@torahmap/link`. Move
  `CameraPosition`, `CameraRef`, `StoryStop`, `StoryData`, `EasingName` into
  `packages/stories/src/types.ts`. Write `packages/stories/src/index.ts`:

```ts
import { STORY_MARKDOWN } from './generated';
import { parseStoryMarkdown } from './parser';
import type { StoryData } from './types';

export type { CameraPosition, CameraRef, StoryStop, StoryData, EasingName } from './types';
export { parseStoryMarkdown, STORY_HEADER_KEYS } from './parser';
export { STORY_MARKDOWN };

export const STORIES: readonly { id: string; data: StoryData }[] = Object.entries(
  STORY_MARKDOWN,
).map(([id, markdown]) => ({ id, data: parseStoryMarkdown(markdown) }));
```

  Delete `src/stories/index.ts`. Update importers
  (`grep -rln "stories/index\|storyParser\|scrollytelling/types" src`) to take
  moved names from `@torahmap/stories`.

- [ ] **Step 6: Run** — `npm run typecheck && npm test`. Expected: PASS, the
  story-file tests included (they now read `STORY_MARKDOWN` from the package).

- [ ] **Step 7: A fresh checkout typechecks.**
  `rm packages/stories/src/generated.ts && npm run typecheck`. Expected: PASS
  (the script regenerates it). Then `rm` it again and run `npm test`:
  Expected: PASS (the plugin regenerates it).

- [ ] **Step 8: Stories still hot-reload.** Start `npm run dev` as a
  background task. Open `/?story=tour&stop=intro`. Change the first sentence
  of `packages/stories/markdown/tour.md`: the page shows the new text without
  a restart. Copy `sample.md` to `scratch.md`: it appears under Stories.
  Delete `scratch.md`: it goes. Revert `tour.md`. Stop the server.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "Move the stories into @torahmap/stories, compiled by a generation step"`

---

### Task 5: Documentation, layout tests, and the pull request

**Files:** `CLAUDE.md`, `layout-report/shots/` (generated)

- [ ] **Step 1: Update `CLAUDE.md`.** Under "Guided stories", the stories are
  the Markdown files in `packages/stories/markdown/`. Under "Project
  Structure", add `packages/` — "the code the page and the Worker share, as
  npm workspace packages: `link` (reading and writing links),
  `overlay-catalog` (each overlay's name and link keys), `stories` (the
  stories, compiled from Markdown by `generate.mjs`)" — and remove `stories/`
  from the `src/` line. Under "Interactions", `src/urlState.ts` becomes
  "`@torahmap/link`, with the browser half in `src/urlState.ts`".

- [ ] **Step 2: Layout tests.** Run `npm run test:layout`. Expected: PASS
  with the same accepted failures as `layout/known.ts` lists on main. Read
  two or three PNGs from `layout-report/shots/` to see the map drew.

- [ ] **Step 3: Commit, push, open the PR.**

```bash
git add -A && git commit -m "Document the packages and query-string links"
git push -u origin share-view
gh pr create --base main --title "Sharing a view, part 1: packages and query-string links" --body "…"
```

  The body starts with `🤖 Claude:`, says what moved and why (the Worker will
  import the same code in part 3), that a reader sees only `?` in place of `#`,
  and a "Look at" list for the `workers.dev` preview: a verse link, a story
  stop link, Back/Forward, and an old `#` link opening the plain map. It refers
  to #232 and #245 without closing them.

- [ ] **Step 4: Check the preview.** Wait for the `cloudflare-workers-and-pages`
  comment (`gh pr view --json comments`). If the build failed, read its log and
  fix. If it passed, open the preview with the "Look at" links and confirm
  each.
