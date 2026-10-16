# EU AI Act Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the EU AI Act as a third text beside the Tanakh and the Talmud, on its own page at `/euaiact/`, drawn and browsable on the dev server and previews and absent from the live site.

**Architecture:** A new workspace package `apps/euaiact` that hands `createApp` a `MapText`, as `apps/talmud` does. Squares may now be wider than tall (an optional `MapItem.width`). A Python script turns the parsed Act into three shipped JSON files; the app reads them. Each extra page carries its own live flag in `build.ts`.

**Tech Stack:** TypeScript, Vite, WebGL 2 through `@torahmap/engine`, Vitest, Playwright, standard-library Python 3.9+.

**Spec:** `docs/plans/2026-10-15-eu-ai-act-text-design.md`. Read it first; the exploration it builds on is `docs/plans/2026-10-13-eu-ai-act-map-design.md`.

## Global Constraints

- Work only in this worktree (`.claude/worktrees/euaiact-text`, branch `euaiact-text`). Never branch in the primary checkout.
- Do only what a task says. No adjacent fixes or refactors.
- npm only (`package-lock.json`). `npx`, never `pnpm`.
- No ticket or stage references in code, tests or comments. Ticket numbers belong in commit messages and the PR.
- Comments say what the code cannot: a measured number, a decision and why, a constraint not visible locally. Present tense, never history. Shorter is better.
- Tests check behaviour: no assertions on text readers see, on counts taken from the shipped data, or on timings. A check that the shipped data is valid is a test.
- Python: standard library only, run as `python3 -I`, scripts written to files, never heredocs.
- A search term of one letter is never a word: never searched, returned or clickable.
- Links need no backward compatibility.
- The Act is not on torahmap.org until Danyel says so: its flag in `build.ts` is `live: false` and stays so.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J`
- Run `npx prettier --write <files>` on every TS, CSS, HTML and JSON file you touch before committing; the pre-commit hook checks formatting, typecheck and tests, and `public/data/` is excluded from formatting.
- Commit commands stand alone: never chain a `git -C <other folder>` step with a commit or push.

## Review Focus

Inputs the spec implies but no task's own happy path covers; each has a test in the task that owns the code.

1. A recital tile (`width` 2×`size`): clicking its right half pins it; arrow-key and search-result travel centre on its middle, not its left half (Task 1).
2. An item with no `width` behaves exactly as before: rectangle, hit, nearest and outline are unchanged (Task 1).
3. A live build contains no page and no data folder of an unpublished text, however many pages exist; flipping one page's flag publishes that page alone (Task 2).
4. Every cross-reference in the shipped data names a square that exists, including the whole-annex references (`Annex III`) and paragraph-level ones (`6(2)`) (Task 3).
5. A link to a square that does not exist pins nothing and does not throw (Task 9).
6. The page for a text with no Hebrew shows no "Hide Hebrew" control and never writes the Hebrew choice to storage (Task 5).
7. A search of a single letter finds nothing; a search of a word in a recital and in an article colours both (Task 8).

---

## File Structure

New:

- `apps/euaiact/package.json`, `apps/euaiact/src/{page,data,ids,layout,constants,site,baseColor,search,text,main}.ts`, `apps/euaiact/src/overlays/{amendment,references,index}.ts` — the text.
- `apps/euaiact/test/{layout,ids,overlays,search,data}.test.ts` and `apps/euaiact/test/helpers/actFixture.ts`.
- `scripts/euaiact/bundle.py` — writes `public/data/euaiact/{structure,texts,refs}.json` from `experiments/eu-ai-act/`.
- `public/data/euaiact/*.json` — generated; committed, as `public/data/talmud/` is.
- `layout/euaiact.spec.ts` — the page, in a real browser.

Modified:

- `packages/engine/src/{types,geometry,hitDetection,camera,outline}.ts` — optional `width`.
- `packages/shell/src/app/text.ts` (`Site.hasHebrew`), `aboutPanel.ts`, `hebrewDisplay.ts`, `main.ts` (two lines), and `apps/tanakh/src/site.ts`, `apps/talmud/src/site.ts` (`hasHebrew: true`).
- `build.ts`, `pages.ts`, `vite.config.ts`, `package.json` (root dependency), `layout/playwright.config.ts`, `test/{build,page,package-imports}.test.ts`, `DATA_REGENERATION.md`, `docs/plans/2026-10-15-eu-ai-act-text-design.md` (the assumptions table).

---

### Task 1: Squares of any width

**Files:**
- Modify: `packages/engine/src/types.ts:10-20`, `geometry.ts:133-134`, `hitDetection.ts:8-15,45-46`, `camera.ts:80-90,136-139`, `outline.ts:7,22-25`
- Test: `packages/engine/test/width.test.ts` (create)

**Interfaces:**
- Produces: `MapItem.width?: number` — a square's width in map units, defaulting to `size`; `size` stays its height. Later tasks set `width: 2 * size` on recitals.

- [ ] **Step 1: Write the failing test**

```ts
// packages/engine/test/width.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildItemGeometry,
  buildOutlineGeometry,
  centreForFocus,
  findExactHit,
  findNearestItem,
  SQUARE_GAP,
} from '../src/index.ts';
import { ITEM_OFFSETS } from '../src/geometry.ts';
import { createItem } from './fixtures.ts';

const tile = createItem({ id: 'tile', x: 100, y: 200, size: 6, width: 12 });
const square = createItem({ id: 'square', x: 100, y: 200, size: 6 });
const rect = (item: ReturnType<typeof createItem>) => {
  const data = buildItemGeometry([item]);
  const at = ITEM_OFFSETS.a_rect;
  return Array.from(data.slice(at, at + 4));
};

describe('an item wider than tall', () => {
  it('is drawn as wide as it says', () => {
    expect(rect(tile)).toEqual([100, 200, 100 + 12 - SQUARE_GAP, 200 + 6 - SQUARE_GAP]);
  });

  it('is hit across its whole width, and no further', () => {
    expect(findExactHit([tile], 111, 203)?.id).toBe('tile');
    expect(findExactHit([tile], 112, 203)).toBeNull();
  });

  it('has its centre in the middle of its width', () => {
    const other = createItem({ id: 'other', x: 130, y: 200, size: 6 });
    expect(findNearestItem([tile, other], 106, 203)?.id).toBe('tile');
    expect(findNearestItem([tile, other], 118, 203)?.id).toBe('tile');
  });

  it('is centred on screen at the middle of its width', () => {
    const viewport = { width: 800, height: 600 };
    const centre = centreForFocus(tile, 1, { x: 400, y: 300 }, viewport);
    expect(centre).toEqual({ x: 106, y: 203 });
  });

  it('is outlined across its whole width', () => {
    const wide = Array.from(buildOutlineGeometry(tile, 2));
    const narrow = Array.from(buildOutlineGeometry(square, 2));
    expect(Math.max(...wide.filter((_, i) => i % 2 === 0))).toBe(
      Math.max(...narrow.filter((_, i) => i % 2 === 0)) + 6,
    );
  });
});

describe('an item with no width', () => {
  it('is drawn, hit and centred as a square', () => {
    expect(rect(square)).toEqual([100, 200, 100 + 6 - SQUARE_GAP, 200 + 6 - SQUARE_GAP]);
    expect(findExactHit([square], 105, 203)?.id).toBe('square');
    expect(findExactHit([square], 106, 203)).toBeNull();
    expect(
      centreForFocus(square, 1, { x: 400, y: 300 }, { width: 800, height: 600 }),
    ).toEqual({ x: 103, y: 203 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run packages/engine/test/width.test.ts`
Expected: the "wider than tall" cases FAIL (the rectangle is 4 wide; the hit at x=111 misses); the "no width" case passes.

- [ ] **Step 3: Implement**

`types.ts`, in `MapItem`, after `size`:

```ts
  /** The square's width in map units when it is not as wide as it is tall; `size` is its height. */
  width?: number;
```

`geometry.ts` line 133: `data[rect + 2] = v.x + (v.width ?? v.size) - SQUARE_GAP;` (leave line 134 as is).

`hitDetection.ts`: in `isPointInItem` use `worldX < item.x + (item.width ?? item.size) &&`; in `findNearestItem` use `const centerX = v.x + (v.width ?? v.size) / 2;`.

`camera.ts`: change both `{ x: number; y: number; size: number }` parameter types (in `centreForFocus` and `viewFocusedOn`) to `Pick<MapItem, 'x' | 'y' | 'size' | 'width'>` (import `MapItem` from `./types.ts` if not already imported), and in `centreForFocus` use `item.x + (item.width ?? item.size) / 2`.

`outline.ts`: `OutlineBounds = Pick<MapItem, 'x' | 'y' | 'size' | 'width' | 'jitter'>` and `const x1 = left + (bounds.width ?? bounds.size) - SQUARE_GAP + thickness;`.

`packages/shell/src/viewState.ts:66` takes `{ x, y, size }` and passes it to `centreForFocus`; change its type to `Pick<MapItem, 'x' | 'y' | 'size' | 'width'> | null` (import the type from `@torahmap/engine`) so the width reaches the camera.

- [ ] **Step 4: Run the engine and shell tests**

Run: `npx vitest run packages/engine packages/shell`
Expected: all pass, including the new file.

- [ ] **Step 5: Look for any other place that builds a rectangle from `size`**

Run: `grep -rnE "\.size\b" packages apps --include='*.ts' | grep -vE "test|activeTouches|\.size\(\)|new (Set|Map)" `
Expected: no remaining use of `item.size` as a width. Anything else found gets `width ?? size` and a line in this task's commit message.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write packages/engine/src packages/engine/test/width.test.ts packages/shell/src/viewState.ts
git add packages/engine packages/shell/src/viewState.ts
git commit -m "Squares may be wider than tall

An optional width on MapItem, defaulting to size, read where a square's
rectangle, hit, centre and outline are worked out.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 2: The package, its page, and a live flag for each page

**Files:**
- Create: `apps/euaiact/package.json`, `apps/euaiact/src/page.ts`, `apps/euaiact/src/data.ts` (constants only for now)
- Modify: `build.ts`, `pages.ts`, `vite.config.ts`, `package.json` (root `dependencies`), `test/build.test.ts`, `test/page.test.ts`

**Interfaces:**
- Produces: `EUAIACT_PATH = '/euaiact/'`, `EUAIACT_PAGE: PageCopy` (`@torahmap/euaiact/page.ts`); `EUAIACT_DATA_DIR`, `STRUCTURE_FILE`, `TEXTS_FILE`, `REFS_FILE` (`@torahmap/euaiact/data.ts`); `build.ts`: `EXTRA_PAGES`, `builtPages(live, pages?)`, `unpublished(live, pages?)`.

- [ ] **Step 1: Create the package**

`apps/euaiact/package.json` — the Talmud's, renamed:

```json
{
  "name": "@torahmap/euaiact",
  "private": true,
  "type": "module",
  "exports": {
    "./*": "./src/*"
  },
  "dependencies": {
    "@torahmap/engine": "*",
    "@torahmap/link": "*",
    "@torahmap/shell": "*",
    "@torahmap/site": "*",
    "@torahmap/stories": "*",
    "@torahmap/utils": "*"
  }
}
```

Add `"@torahmap/euaiact": "*",` to the root `package.json` `dependencies`, alphabetically after `@torahmap/engine`. Run `npm install` (links the workspace and updates `package-lock.json`).

`apps/euaiact/src/page.ts`:

```ts
// What the AI Act's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the Act's page is served, under the site's address. */
export const EUAIACT_PATH = '/euaiact/';

/** The Act's own page, where each square's source lives. */
export const EUR_LEX = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng';

const SUMMARY =
  'AI Act Map lays out the EU Artificial Intelligence Act as colored squares, one for each paragraph, each in a fixed place.';

export const EUAIACT_PAGE: PageCopy = {
  name: 'AI Act Map',
  tagline: 'A map of the EU Artificial Intelligence Act.',
  url: `${ORIGIN}${EUAIACT_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: EUR_LEX,
};
```

`apps/euaiact/src/data.ts`:

```ts
// The Act's data files in public/data/euaiact/, which scripts/euaiact/bundle.py writes.

/** The Act's folder in public/data/. */
export const EUAIACT_DATA_DIR = 'euaiact';

export const STRUCTURE_FILE = `${EUAIACT_DATA_DIR}/structure.json`;
export const TEXTS_FILE = `${EUAIACT_DATA_DIR}/texts.json`;
export const REFS_FILE = `${EUAIACT_DATA_DIR}/refs.json`;
```

- [ ] **Step 2: Write the failing build tests**

Replace the body of `test/build.test.ts` after the `isLiveBuild` block with:

```ts
const FAKE = [
  { page: 'talmud', dataDir: 'talmud', live: false },
  { page: 'euaiact', dataDir: 'euaiact', live: false },
] as const;

describe('the live site’s build', () => {
  it('writes the Tanakh’s page alone while no other page is live', () => {
    expect(builtPages(true)).toEqual(['main']);
  });

  it('leaves each unpublished page’s data out', () => {
    expect(unpublished(true)).toEqual(
      expect.arrayContaining(['data/talmud', 'data/euaiact']),
    );
  });

  it('publishes a page whose flag is on, and only that page', () => {
    const talmudLive = FAKE.map((p) => (p.page === 'talmud' ? { ...p, live: true } : p));
    expect(builtPages(true, talmudLive)).toEqual(['main', 'talmud']);
    expect(unpublished(true, talmudLive)).toContain('data/euaiact');
    expect(unpublished(true, talmudLive)).not.toContain('data/talmud');
  });
});

describe('any other branch’s build', () => {
  it('writes every page', () => {
    expect(builtPages(false)).toEqual(['main', 'talmud', 'euaiact']);
  });

  it('publishes every page’s data', () => {
    expect(unpublished(false)).toEqual(['.assetsignore']);
  });
});

describe('the Act’s page', () => {
  it('is not live', () => {
    expect(EXTRA_PAGES.find((p) => p.page === 'euaiact')?.live).toBe(false);
  });
});
```

and change the import to `import { builtPages, EXTRA_PAGES, isLiveBuild, unpublished } from '../build.ts';`.

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run test/build.test.ts`
Expected: FAIL (`EXTRA_PAGES` is not exported).

- [ ] **Step 4: Implement `build.ts`**

```ts
// What a build of the site holds: the live site's, built from main, has the Tanakh's page and
// the pages whose flag is on; every other branch's preview has every page.

import { TALMUD_DATA_DIR } from '@torahmap/talmud/data.ts';
import { EUAIACT_DATA_DIR } from '@torahmap/euaiact/data.ts';

export type BuiltPage = 'main' | 'talmud' | 'euaiact';

/** A page beside the Tanakh's: its data folder under public/data/, and whether the live site has it. */
export interface ExtraPage {
  page: Exclude<BuiltPage, 'main'>;
  dataDir: string;
  live: boolean;
}

export const EXTRA_PAGES: readonly ExtraPage[] = [
  { page: 'talmud', dataDir: TALMUD_DATA_DIR, live: false },
  { page: 'euaiact', dataDir: EUAIACT_DATA_DIR, live: false },
];

export function isLiveBuild(command: 'build' | 'serve', branch: string): boolean {
  return command === 'build' && branch === 'main';
}

export function builtPages(live: boolean, pages: readonly ExtraPage[] = EXTRA_PAGES): BuiltPage[] {
  return ['main', ...pages.filter((p) => !live || p.live).map((p) => p.page)];
}

/** What Cloudflare does not publish of the build: its own list, and the data of pages it lacks. */
export function unpublished(live: boolean, pages: readonly ExtraPage[] = EXTRA_PAGES): string[] {
  return [
    '.assetsignore',
    ...(live ? pages.filter((p) => !p.live).map((p) => `data/${p.dataDir}`) : []),
  ];
}
```

- [ ] **Step 5: Register the page and generalise the address plugin**

`pages.ts`: add `import { EUAIACT_PAGE, EUAIACT_PATH } from '@torahmap/euaiact/page.ts';` and a third entry
`{ path: EUAIACT_PATH, copy: EUAIACT_PAGE, entry: '/apps/euaiact/src/main.ts' },`; update the doc comment to "the Talmud's at /talmud/, the Act's at /euaiact/".

`vite.config.ts`: replace the Talmud-only plugin with one made per extra page. The existing `talmudPlugin()` body becomes `pageAddressPlugin(page: 'talmud' | 'euaiact', path: string)`:

```ts
const PAGE_PATHS = { talmud: TALMUD_PATH, euaiact: EUAIACT_PATH } as const;
const htmlPath = (page: keyof typeof PAGE_PATHS) => `${PAGE_PATHS[page]}index.html`;
// No such file: pageAddressPlugin gives the build index.html under this name.
const htmlFile = (page: keyof typeof PAGE_PATHS) => resolve(__dirname, `.${htmlPath(page)}`);
const PAGE_FILES: Record<BuiltPage, string> = {
  main: TEMPLATE,
  talmud: htmlFile('talmud'),
  euaiact: htmlFile('euaiact'),
};

// An extra page is index.html at its own address: the dev server serves it, sending the address
// without its slash there too, and a build reads it.
function pageAddressPlugin(page: keyof typeof PAGE_PATHS): Plugin {
  const path = PAGE_PATHS[page];
  const file = htmlFile(page);
  return {
    name: `${page}-address`,
    resolveId: (id) => (id === file ? id : null),
    load: (id) => (id === file ? readFile(TEMPLATE, 'utf8') : null),
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [requested, query] = (req.url ?? '').split('?');
        if (`${requested}/` === path) {
          res.writeHead(302, { Location: `${path}${query === undefined ? '' : `?${query}`}` });
          res.end();
          return;
        }
        if (pageAt(requested).path !== path) return next();
        try {
          const template = await readFile(TEMPLATE, 'utf8');
          const html = await server.transformIndexHtml(htmlPath(page), template, req.originalUrl);
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
```

Use it as `plugins: [storiesPlugin(), pagePlugin(), pageAddressPlugin('talmud'), pageAddressPlugin('euaiact'), assetsIgnorePlugin(live)]`, and import `EUAIACT_PATH`. Delete `TALMUD_HTML_PATH`, `TALMUD_HTML` and `talmudPlugin`.

`test/page.test.ts`: the destructure becomes `const [tanakh, talmud, euaiact] = PAGES;` and add

```ts
    for (const path of ['/euaiact/', '/euaiact/index.html', '/euaiact/?at=6(2)'])
      expect(pageAt(path)).toBe(euaiact);
```

(Do not yet assert `euaiact.copy` against the text; Task 6 does.)

- [ ] **Step 6: Verify**

Run: `npx vitest run test/build.test.ts test/page.test.ts` — expected PASS.
Run: `npm run typecheck` — expected clean (the entry `/apps/euaiact/src/main.ts` is only a string until Task 6).
Run the dev server as your own background task and confirm the Talmud's page still answers: `curl -s http://localhost:<port>/talmud/ | grep -c "<title>Talmud Map"` expected `1`. Then stop only your own server.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write build.ts pages.ts vite.config.ts apps/euaiact test/build.test.ts test/page.test.ts
git add apps/euaiact build.ts pages.ts vite.config.ts package.json package-lock.json test
git commit -m "A page of its own for the AI Act, and a live flag for each page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 3: The shipped data

**Files:**
- Create: `scripts/euaiact/bundle.py`, `public/data/euaiact/{structure,texts,refs}.json` (generated), `apps/euaiact/test/data.test.ts`
- Modify: `apps/euaiact/src/data.ts` (the types and readers), `DATA_REGENERATION.md`

**Interfaces:**
- Produces, in `@torahmap/euaiact/data.ts`:

```ts
export type Origin = 'B' | 'M1 inserted' | 'M1 replaced';
/** One square's identity in the data. */
export interface ActCell { id: string; origin: Origin }
/** A plain paragraph, or a list: its lead-in (null when it has no sentence of its own) and its points. */
export type ActGroup =
  | { kind: 'plain'; cell: ActCell }
  | { kind: 'list'; lead: ActCell | null; points: ActCell[] };
/** An article, or a part of an annex. */
export interface ActBlock { number: string; groups: ActGroup[] }
/** A column of blocks; `runs` are separated by a section gap. `label` names a split chapter's section. */
export interface ActColumn { label: string | null; runs: ActBlock[][] }
export interface ActChapter { number: string; columns: ActColumn[] }
export interface ActAnnex { number: string; blocks: ActBlock[] }
export interface ActStructure { recitals: number; chapters: ActChapter[]; annexes: ActAnnex[] }
export type ActTexts = Readonly<Record<string, string>>;
/** [from, to]: a square cites an article, paragraph, point or whole annex ("Annex III"). */
export type ActRef = readonly [string, string];
export function structureFrom(loaded: Loaded): ActStructure;
```

Square ids: recital `Recital.12`; article unit as the Act cites it, `6`, `6(2)`, `5(1)(h)`; annex unit `Annex.III.<part>.<n>` (part and n count from 1).

- [ ] **Step 1: Write the bundler**

```python
"""Write the AI Act's shipped data, public/data/euaiact/, from the parsed Act in experiments/eu-ai-act/.

    python3 -I scripts/euaiact/bundle.py

structure.json holds the layout's shape without any text; texts.json maps each square's id to its
text; refs.json lists who cites whom. Ids: Recital.12; an article unit as cited (6, 6(2), 5(1)(h));
an annex unit Annex.III.<part>.<n>.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'experiments' / 'eu-ai-act'
OUT = ROOT / 'public' / 'data' / 'euaiact'
SPLIT = ('III', 'IX')


def leaves(item, uid):
    for p in item.get('points', []):
        pid = f"{uid}({p['label'].strip('()')})"
        yield p, pid
        yield from leaves(p, pid)


class Ordinal:
    def __init__(self, prefix):
        self.prefix, self.n = prefix, 0

    def next(self):
        self.n += 1
        return f'{self.prefix}.{self.n}'


def group(p, uid, ordinal, texts):
    def cell(item, cited_as):
        cell_id = ordinal.next() if ordinal else cited_as
        texts[cell_id] = item['text']
        return {'id': cell_id, 'origin': item['origin']}

    if not p.get('points'):
        return {'kind': 'plain', 'cell': cell(p, uid)}
    lead = cell(p, uid) if p.get('text') else None
    return {'kind': 'list', 'lead': lead, 'points': [cell(q, qid) for q, qid in leaves(p, uid)]}


def article(a, texts):
    groups = []
    for p in a['paragraphs']:
        uid = f"{a['number']}({p['label']})" if p['label'] else a['number']
        groups.append(group(p, uid, None, texts))
    return {'number': a['number'], 'groups': groups}


def chapter(ch, texts):
    runs = [[article(a, texts) for a in s['articles']] for s in ch['sections']]
    if ch['number'] in SPLIT:
        columns = [{'label': f"Section {s['number']}", 'runs': [run]}
                   for s, run in zip(ch['sections'], runs)]
    else:
        columns = [{'label': None, 'runs': runs}]
    return {'number': ch['number'], 'columns': columns}


def annex(x, texts):
    blocks = []
    for i, part in enumerate(x['parts'], 1):
        ordinal = Ordinal(f"Annex.{x['number']}.{i}")
        blocks.append({'number': str(i),
                       'groups': [group(p, None, ordinal, texts) for p in part['paragraphs']]})
    return {'number': x['number'], 'blocks': blocks}


def main():
    act = json.loads((SOURCE / 'ai-act.json').read_text(encoding='utf-8'))
    refs = json.loads((SOURCE / 'refs.json').read_text(encoding='utf-8'))
    texts = {}
    for n, r in enumerate(act['recitals'], 1):
        assert r['number'] == str(n), f"recital {n} is numbered {r['number']}"
        texts[f'Recital.{n}'] = r['text']
    structure = {
        'recitals': len(act['recitals']),
        'chapters': [chapter(ch, texts) for ch in act['chapters']],
        'annexes': [annex(x, texts) for x in act['annexes']],
    }
    pairs = sorted({(r['from'], r['to']) for r in refs})
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (('structure', structure), ('texts', texts), ('refs', [list(p) for p in pairs])):
        text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        (OUT / f'{name}.json').write_text(text + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run it, then run it again and confirm the output does not change**

```bash
python3 -I scripts/euaiact/bundle.py
git add public/data/euaiact
python3 -I scripts/euaiact/bundle.py && git diff --exit-code public/data/euaiact && echo identical
```
Expected: three files written, then `identical`. Note the three file sizes in the commit message; `texts.json` is the one a reader waits for on first click.

- [ ] **Step 3: Write the data types and reader**

Add the interfaces from **Interfaces** above to `apps/euaiact/src/data.ts`, plus:

```ts
import type { Loaded } from '@torahmap/shell/dataFiles.ts';

export function structureFrom(loaded: Loaded): ActStructure {
  const structure = loaded.get(STRUCTURE_FILE) as ActStructure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}
```

- [ ] **Step 4: Write the data test, which fails if the shipped data is wrong**

```ts
// apps/euaiact/test/data.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActGroup, ActRef, ActStructure, ActTexts } from '../src/data.ts';
import { ownerOf } from '../src/ids.ts';

const shipped = <T>(file: string): T =>
  JSON.parse(readFileSync(`public/data/euaiact/${file}`, 'utf8'));
const structure = shipped<ActStructure>('structure.json');
const texts = shipped<ActTexts>('texts.json');
const refs = shipped<ActRef[]>('refs.json');

const cellIds = (g: ActGroup) =>
  g.kind === 'plain' ? [g.cell.id] : [...(g.lead ? [g.lead.id] : []), ...g.points.map((p) => p.id)];
const blocks = [
  ...structure.chapters.flatMap((c) => c.columns.flatMap((col) => col.runs.flat())),
  ...structure.annexes.flatMap((a) => a.blocks),
];
const ids = [
  ...Array.from({ length: structure.recitals }, (_, i) => `Recital.${i + 1}`),
  ...blocks.flatMap((b) => b.groups.flatMap(cellIds)),
];

describe('the shipped Act', () => {
  it('has no two squares with one id', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has text for every square and none for anything else', () => {
    expect(Object.keys(texts).sort()).toEqual([...ids].sort());
  });

  // A reference names a square, a paragraph or point that holds squares ("6(2)" for a list with
  // no lead-in sentence of its own), a whole article, or a whole annex.
  it('has only references whose ends are in the map', () => {
    const owners = new Set(ids.map(ownerOf));
    const resolves = (unit: string) =>
      owners.has(unit) || ids.some((id) => id === unit || id.startsWith(`${unit}(`));
    expect(refs.filter(([from, to]) => !resolves(from) || !resolves(to))).toEqual([]);
  });
});
```

This imports `ownerOf` from `ids.ts`, which Step 5 creates.

- [ ] **Step 5: Write `ids.ts` and its test**

```ts
// apps/euaiact/src/ids.ts
// A square's id, and what it names: a recital, an article's unit, or an annex's.

import { EUR_LEX } from './page.ts';

export type Layer = 'recital' | 'article' | 'annex';

export function layerOf(id: string): Layer {
  if (id.startsWith('Recital.')) return 'recital';
  return id.startsWith('Annex.') ? 'annex' : 'article';
}

/**
 * What a reference names for this square: the article it is in ("5" for "5(1)(h)"), "Annex III"
 * for any square of that annex, and a recital's own id.
 */
export function ownerOf(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return id;
    case 'annex':
      return `Annex ${id.split('.')[1]}`;
    default:
      return id.split('(')[0];
  }
}

/** A number from a square's id, the seed for its jitter. */
export function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

/** A square as readers cite it: "Recital 12", "Article 5(1)(h)", "Annex III". */
export function actRef(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return `Recital ${id.slice('Recital.'.length)}`;
    case 'annex':
      return ownerOf(id);
    default:
      return `Article ${id}`;
  }
}

/** Where the square's text is on EUR-Lex: its recital, article or annex. */
export function sourceUrl(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return `${EUR_LEX}#rct_${id.slice('Recital.'.length)}`;
    case 'annex':
      return `${EUR_LEX}#anx_${id.split('.')[1]}`;
    default:
      return `${EUR_LEX}#art_${ownerOf(id)}`;
  }
}
```

```ts
// apps/euaiact/test/ids.test.ts
import { describe, expect, it } from 'vitest';
import { actRef, layerOf, ownerOf, sourceUrl } from '../src/ids.ts';

describe('a square’s id', () => {
  it.each([
    ['Recital.12', 'recital', 'Recital.12', 'Recital 12'],
    ['6', 'article', '6', 'Article 6'],
    ['5(1)(h)', 'article', '5', 'Article 5(1)(h)'],
    ['75a(2)', 'article', '75a', 'Article 75a(2)'],
    ['Annex.III.2.5', 'annex', 'Annex III', 'Annex III'],
  ])('%s', (id, layer, owner, ref) => {
    expect(layerOf(id)).toBe(layer);
    expect(ownerOf(id)).toBe(owner);
    expect(actRef(id)).toBe(ref);
  });

  it('points at the recital, article or annex it is in', () => {
    expect(sourceUrl('Recital.12')).toMatch(/#rct_12$/);
    expect(sourceUrl('5(1)(h)')).toMatch(/#art_5$/);
    expect(sourceUrl('Annex.III.2.5')).toMatch(/#anx_III$/);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run apps/euaiact`
Expected: PASS. If the references test lists unresolved ends, read the list before changing anything: the exploration notes about a dozen lone "point (a)" references go unresolved, and those are left out of `refs.json` already, so any failure here is new. Report it instead of loosening the test.

- [ ] **Step 7: Document regeneration, format and commit**

Add to `DATA_REGENERATION.md`, after the Talmud section, a short "AI Act" section: the source lives in `experiments/eu-ai-act/` (`parse.py`, `refs.py`), and `python3 -I scripts/euaiact/bundle.py` rebuilds `public/data/euaiact/`; an empty `git diff` after regenerating means nothing changed.

```bash
npx prettier --write apps/euaiact
git add scripts/euaiact public/data/euaiact apps/euaiact DATA_REGENERATION.md
git commit -m "Ship the AI Act's data: structure, texts and references

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 4: The layout

**Files:**
- Create: `packages/utils/src/jitter.ts`, `packages/utils/test/jitter.test.ts`, `apps/euaiact/src/constants.ts`, `apps/euaiact/src/layout.ts`, `apps/euaiact/test/helpers/actFixture.ts`, `apps/euaiact/test/layout.test.ts`
- Modify: `packages/utils/src/index.ts` (export the helpers)

**Interfaces:**
- Consumes: `ActStructure` and friends (Task 3); `MapItem.width` (Task 1); `BookBox` from `@torahmap/shell/mapLabels.ts`.
- Produces:

```ts
export interface ActItem extends MapItem {
  layer: Layer; origin: Origin; lead: boolean; chapter: string;
}
export interface ActLayout { items: ActItem[]; books: BookBox[]; bounds: { width: number; height: number } }
export function computeActLayout(structure: ActStructure): ActLayout;
```

- [ ] **Step 0: The shared jitter helpers**

The Tanakh and the Talmud each have their own copy of this; moving them onto it is #391, not this plan. Create `packages/utils/src/jitter.ts`, export both from `packages/utils/src/index.ts`, and test them in `packages/utils/test/jitter.test.ts`:

```ts
// packages/utils/src/jitter.ts
// A square's nudge in place and in brightness, fixed by a seed so it is the same on every load.

import type { Color } from './color.ts';
import { seededRandom } from './random.ts';

/** An offset of up to ±range on each axis. */
export function positionJitter(seed: number, range: number): { x: number; y: number } {
  return {
    x: (seededRandom(seed * 2) - 0.5) * 2 * range,
    y: (seededRandom(seed * 2 + 1) - 0.5) * 2 * range,
  };
}

/** The colour up to ±range lighter or darker; multiplied, so the hue holds. */
export function brightnessJitter(color: Color, seed: number, range: number): Color {
  const f = 1 + (seededRandom(seed) - 0.5) * 2 * range;
  return color.map((c) => Math.max(0, Math.min(1, c * f))) as Color;
}
```

```ts
// packages/utils/test/jitter.test.ts
import { describe, expect, it } from 'vitest';
import { brightnessJitter, positionJitter } from '../src/index.ts';

const seeds = [1, 2, 3, 4, 5, -77, 123456];

describe('position jitter', () => {
  it('stays within its range, repeats for a seed, and varies between seeds', () => {
    for (const s of seeds) {
      const j = positionJitter(s, 0.7);
      expect(Math.abs(j.x)).toBeLessThanOrEqual(0.7);
      expect(Math.abs(j.y)).toBeLessThanOrEqual(0.7);
      expect(positionJitter(s, 0.7)).toEqual(j);
    }
    expect(new Set(seeds.map((s) => positionJitter(s, 0.7).x)).size).toBeGreaterThan(1);
  });
});

describe('brightness jitter', () => {
  it('scales every channel by one factor within its range, and clamps to 1', () => {
    for (const s of seeds) {
      const [r, g, b] = brightnessJitter([0.2, 0.4, 0.6], s, 0.18);
      expect(g / r).toBeCloseTo(2);
      expect(b / r).toBeCloseTo(3);
      expect(r / 0.2).toBeGreaterThanOrEqual(0.82 - 1e-9);
      expect(r / 0.2).toBeLessThanOrEqual(1.18 + 1e-9);
    }
    expect(Math.max(...seeds.flatMap((s) => brightnessJitter([1, 1, 1], s, 0.18)))).toBe(1);
  });
});
```

Run `npx vitest run packages/utils`, expecting PASS.

- [ ] **Step 1: Constants**

```ts
// apps/euaiact/src/constants.ts
import type { BookTab, SectionLabelSize, SectionName } from '@torahmap/shell/mapLabels.ts';

export const SQUARE_SIZE = 6; // map units a square is tall, and a column's pitch

// Each square is nudged by a fixed amount from its id, as the Tanakh's and the Talmud's are.
// The Talmud's squares are the same size, so its ±0.7 map units and ±18% brightness carry over.
export const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

export const COLUMN_WIDTH = 8; // squares across an article's column
export const RECITALS_PER_LINE = 50;

export const ARTICLE_GAP = SQUARE_SIZE;
export const SECTION_GAP = 3 * SQUARE_SIZE; // between a chapter's sections, where it is not split
export const SPLIT_GAP = 2 * SQUARE_SIZE; // between a split chapter's columns
export const CHAPTER_GAP = 6 * SQUARE_SIZE;
export const LAYER_GAP = 12 * SQUARE_SIZE;
// Room above each layer's first row for the chapter tabs.
export const LABEL_ROOM = 40;

/** The chapter and annex names, tabs above their columns that scale with the map. */
export const CHAPTER_TAB: BookTab = { fontSize: 12, above: 28, inset: 4, minPx: 7 };
export const LAYER_LABEL_SIZE: SectionLabelSize = { fontSize: 14, gapEm: 0.5 };

export const LAYER_NAMES: Readonly<Record<string, SectionName>> = {
  Recitals: { he: '', en: 'Recitals' },
  Articles: { he: '', en: 'Articles' },
  Annexes: { he: '', en: 'Annexes' },
};
```

- [ ] **Step 2: A small fixture**

`apps/euaiact/test/helpers/actFixture.ts` — a structure with three recitals, one plain chapter holding one article of two plain paragraphs and one list of three points, one split chapter of two sections, and one annex:

```ts
import type { ActStructure } from '../../src/data.ts';

const cell = (id: string) => ({ id, origin: 'B' as const });
const plain = (id: string) => ({ kind: 'plain' as const, cell: cell(id) });

export const actFixture: ActStructure = {
  recitals: 3,
  chapters: [
    {
      number: 'I',
      columns: [
        {
          label: null,
          runs: [
            [
              {
                number: '1',
                groups: [
                  plain('1(1)'),
                  plain('1(2)'),
                  {
                    kind: 'list',
                    lead: cell('1(3)'),
                    points: [cell('1(3)(a)'), cell('1(3)(b)'), cell('1(3)(c)')],
                  },
                ],
              },
            ],
            [{ number: '2', groups: [plain('2')] }],
          ],
        },
      ],
    },
    {
      number: 'III',
      columns: [
        { label: 'Section 1', runs: [[{ number: '6', groups: [plain('6')] }]] },
        { label: 'Section 2', runs: [[{ number: '7', groups: [plain('7')] }]] },
      ],
    },
  ],
  annexes: [
    {
      number: 'I',
      blocks: [{ number: '1', groups: [plain('Annex.I.1.1'), plain('Annex.I.1.2')] }],
    },
  ],
};
```

- [ ] **Step 3: Write the failing layout tests**

```ts
// apps/euaiact/test/layout.test.ts
import { indexItems } from '@torahmap/engine';
import { describe, expect, it } from 'vitest';
import { computeActLayout } from '../src/layout.ts';
import { COLUMN_WIDTH, POSITION_JITTER, SQUARE_SIZE } from '../src/constants.ts';
import { actFixture } from './helpers/actFixture.ts';

const order = { recital: 0, article: 1, annex: 2 } as const;
const laid = computeActLayout(actFixture);
const at = (id: string) => laid.items.find((i) => i.id === id)!;

describe('the Act’s layout', () => {
  it('holds every square once, recitals then articles then annexes', () => {
    expect(() => indexItems(laid.items)).not.toThrow();
    const layers = laid.items.map((i) => i.layer);
    expect(layers).toEqual([...layers].sort((a, b) => order[a] - order[b]));
    expect(laid.items.filter((i) => i.layer === 'recital')).toHaveLength(3);
    expect(laid.items.filter((i) => i.layer === 'annex')).toHaveLength(2);
  });

  it('draws a recital twice as wide as it is tall', () => {
    const r = at('Recital.1');
    expect(r.width).toBe(2 * SQUARE_SIZE);
    expect(r.size).toBe(SQUARE_SIZE);
    expect(at('Recital.2').x).toBe(r.x + 2 * SQUARE_SIZE);
  });

  it('keeps every square inside the bounds', () => {
    for (const i of laid.items) {
      expect(i.x + (i.width ?? i.size)).toBeLessThanOrEqual(laid.bounds.width);
      expect(i.y + i.size).toBeLessThanOrEqual(laid.bounds.height);
      expect(i.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('flows plain paragraphs along a line and starts a list on its own', () => {
    expect(at('1(2)').y).toBe(at('1(1)').y);
    expect(at('1(2)').x).toBe(at('1(1)').x + SQUARE_SIZE);
    expect(at('1(3)').y).toBeGreaterThan(at('1(2)').y);
  });

  it('puts a list’s points under its lead-in, indented one column', () => {
    const lead = at('1(3)');
    expect(lead.lead).toBe(true);
    expect(at('1(3)(a)').x).toBe(lead.x + SQUARE_SIZE);
    expect(at('1(3)(a)').y).toBe(lead.y + SQUARE_SIZE);
    expect(at('1(3)(b)').x).toBe(at('1(3)(a)').x + SQUARE_SIZE);
  });

  it('wraps a column after eight squares', () => {
    const wide = computeActLayout({
      ...actFixture,
      chapters: [
        {
          number: 'I',
          columns: [
            {
              label: null,
              runs: [[{ number: '1', groups: Array.from({ length: COLUMN_WIDTH + 1 }, (_, i) => ({
                kind: 'plain' as const, cell: { id: `1(${i + 1})`, origin: 'B' as const } })) }]],
            },
          ],
        },
      ],
    });
    const last = wide.items.find((i) => i.id === `1(${COLUMN_WIDTH + 1})`)!;
    const first = wide.items.find((i) => i.id === '1(1)')!;
    expect(last.x).toBe(first.x);
    expect(last.y).toBe(first.y + SQUARE_SIZE);
  });

  it('puts a split chapter’s sections in columns side by side, and a plain chapter in one', () => {
    expect(at('7').x).toBeGreaterThan(at('6').x + COLUMN_WIDTH * SQUARE_SIZE - 1);
    expect(at('7').y).toBe(at('6').y);
    expect(at('2').x).toBe(at('1(1)').x);
    expect(at('2').y).toBeGreaterThan(at('1(3)(c)').y);
  });

  it('stands the layers one over the next', () => {
    const bottom = (layer: string) =>
      Math.max(...laid.items.filter((i) => i.layer === layer).map((i) => i.y + i.size));
    const top = (layer: string) =>
      Math.min(...laid.items.filter((i) => i.layer === layer).map((i) => i.y));
    expect(top('article')).toBeGreaterThan(bottom('recital'));
    expect(top('annex')).toBeGreaterThan(bottom('article'));
  });

  it('boxes each chapter and annex for its label, with the layer it belongs to', () => {
    expect(laid.books.map((b) => [b.name, b.section])).toEqual([
      ['Recitals', 'Recitals'],
      ['Ch. I', 'Articles'],
      ['Ch. III', 'Articles'],
      ['Annex I', 'Annexes'],
    ]);
    const three = laid.books.find((b) => b.name === 'Ch. III')!;
    expect(three.minX).toBe(at('6').x);
    expect(three.maxX).toBeGreaterThanOrEqual(at('7').x + COLUMN_WIDTH * SQUARE_SIZE - 1);
  });

  it('nudges each square by an amount its id fixes', () => {
    const again = computeActLayout(actFixture);
    for (const item of laid.items) {
      expect(Math.abs(item.jitter!.x)).toBeLessThanOrEqual(POSITION_JITTER);
      expect(Math.abs(item.jitter!.y)).toBeLessThanOrEqual(POSITION_JITTER);
      expect(again.items.find((i) => i.id === item.id)!.jitter).toEqual(item.jitter);
    }
    expect(new Set(laid.items.map((i) => i.jitter!.x)).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 4: Run to see it fail**

Run: `npx vitest run apps/euaiact/test/layout.test.ts` — expected FAIL (`layout.ts` does not exist).

- [ ] **Step 5: Implement `layout.ts`**

```ts
// apps/euaiact/src/layout.ts
// Where every square of the Act stands: recitals over articles over annexes.

import type { MapItem } from '@torahmap/engine';
import { positionJitter } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { ActBlock, ActCell, ActGroup, ActStructure, Origin } from './data.ts';
import type { Layer } from './ids.ts';
import {
  ARTICLE_GAP,
  CHAPTER_GAP,
  COLUMN_WIDTH,
  LABEL_ROOM,
  LAYER_GAP,
  RECITALS_PER_LINE,
  SECTION_GAP,
  SPLIT_GAP,
  POSITION_JITTER,
  SQUARE_SIZE as S,
} from './constants.ts';
import { idHash } from './ids.ts';

const jitterFor = (id: string) => positionJitter(idHash(id), POSITION_JITTER);

export interface ActItem extends MapItem {
  layer: Layer;
  origin: Origin;
  /** A list's lead-in sentence, drawn darker than the points beneath it. */
  lead: boolean;
  /** The chapter an article is in; empty for recitals and annexes. */
  chapter: string;
}

export interface ActLayout {
  items: ActItem[];
  books: BookBox[];
  bounds: { width: number; height: number };
}

interface Placed {
  cell: ActCell;
  lead: boolean;
  col: number;
  row: number;
}

/**
 * A block's squares by column and row, and how many rows it takes. Plain paragraphs flow along a
 * line; a list starts a new line with its lead-in, its points wrapped beneath it, indented.
 */
function placeGroups(groups: readonly ActGroup[]): { placed: Placed[]; rows: number } {
  const placed: Placed[] = [];
  let row = 0;
  let col = 0;
  for (const group of groups) {
    if (group.kind === 'plain') {
      if (col >= COLUMN_WIDTH) {
        row++;
        col = 0;
      }
      placed.push({ cell: group.cell, lead: false, col, row });
      col++;
      continue;
    }
    if (col) {
      row++;
      col = 0;
    }
    if (group.lead) {
      placed.push({ cell: group.lead, lead: true, col: 0, row });
      row++;
    }
    const across = COLUMN_WIDTH - 1;
    group.points.forEach((cell, i) =>
      placed.push({ cell, lead: false, col: 1 + (i % across), row: row + Math.floor(i / across) }),
    );
    if (group.points.length) row += Math.floor((group.points.length - 1) / across) + 1;
  }
  return { placed, rows: row + (col ? 1 : 0) };
}

export function computeActLayout(structure: ActStructure): ActLayout {
  const items: ActItem[] = [];
  const books: BookBox[] = [];

  /** Stands a column of blocks at (x, top) and returns the y below it. */
  const column = (
    runs: readonly (readonly ActBlock[])[],
    x: number,
    top: number,
    layer: Layer,
    chapter: string,
  ): number => {
    let y = top;
    runs.forEach((run, i) => {
      if (i) y += SECTION_GAP;
      for (const block of run) {
        const { placed, rows } = placeGroups(block.groups);
        for (const p of placed) {
          items.push({
            id: p.cell.id,
            x: x + p.col * S,
            y: y + p.row * S,
            size: S,
            jitter: jitterFor(p.cell.id),
            layer,
            origin: p.cell.origin,
            lead: p.lead,
            chapter,
          });
        }
        y += rows * S + ARTICLE_GAP;
      }
    });
    return y;
  };

  // Recitals: a paragraph apiece, so twice as wide as a square.
  const recitalsTop = LABEL_ROOM;
  const lines = Math.ceil(structure.recitals / RECITALS_PER_LINE);
  for (let i = 0; i < structure.recitals; i++) {
    items.push({
      id: `Recital.${i + 1}`,
      x: (i % RECITALS_PER_LINE) * 2 * S,
      y: recitalsTop + Math.floor(i / RECITALS_PER_LINE) * S,
      size: S,
      width: 2 * S,
      jitter: jitterFor(`Recital.${i + 1}`),
      layer: 'recital',
      origin: 'B',
      lead: false,
      chapter: '',
    });
  }
  books.push({
    name: 'Recitals',
    hebrewName: '',
    section: 'Recitals',
    minX: 0,
    maxX: Math.min(structure.recitals, RECITALS_PER_LINE) * 2 * S,
    minY: recitalsTop,
  });

  // Articles: a column per chapter, or per section where a chapter is split.
  const articlesTop = recitalsTop + lines * S + LAYER_GAP + LABEL_ROOM;
  let x = 0;
  let articlesBottom = articlesTop;
  for (const chapter of structure.chapters) {
    const minX = x;
    chapter.columns.forEach((col, i) => {
      articlesBottom = Math.max(articlesBottom, column(col.runs, x, articlesTop, 'article', chapter.number));
      const last = i === chapter.columns.length - 1;
      x += COLUMN_WIDTH * S + (last ? CHAPTER_GAP : SPLIT_GAP);
    });
    books.push({
      name: `Ch. ${chapter.number}`,
      hebrewName: '',
      section: 'Articles',
      minX,
      maxX: x - CHAPTER_GAP,
      minY: articlesTop,
    });
  }
  const articlesRight = x - CHAPTER_GAP;

  // Annexes: a column each, their parts one under the next.
  const annexesTop = articlesBottom + LAYER_GAP + LABEL_ROOM;
  x = 0;
  let annexesBottom = annexesTop;
  for (const annex of structure.annexes) {
    annexesBottom = Math.max(annexesBottom, column([annex.blocks], x, annexesTop, 'annex', ''));
    books.push({
      name: `Annex ${annex.number}`,
      hebrewName: '',
      section: 'Annexes',
      minX: x,
      maxX: x + COLUMN_WIDTH * S,
      minY: annexesTop,
    });
    x += COLUMN_WIDTH * S + CHAPTER_GAP;
  }

  const width = Math.max(articlesRight, x - CHAPTER_GAP, books[0].maxX);
  return { items, books, bounds: { width, height: annexesBottom } };
}
```

Format it with Prettier before running; the long `Math.max(...)` line will wrap.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run apps/euaiact` — expected PASS. If "the layers stand one over the next" fails, the likely cause is `LABEL_ROOM` or the `bottom`/`top` arithmetic, not the assertion.

- [ ] **Step 7: Check against the real data, once, and compare with the exploration's picture**

Write a throwaway script in the scratchpad (not in the repo) that loads `public/data/euaiact/structure.json`, runs `computeActLayout`, and prints the item count and bounds. Expected: 180 + 1075 + 264 = 1519 items (the exploration's figures: 1,075 article squares, 264 annex squares, 180 recitals). A different count means the bundler or the layout drops or doubles squares; stop and find out which. Delete the script.

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write apps/euaiact packages/utils
git add apps/euaiact packages/utils
git commit -m "Lay out the AI Act: three layers, chapter columns, recitals as wide tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 5: A text with no Hebrew

**Files:**
- Modify: `packages/shell/src/app/text.ts` (`Site`), `packages/shell/src/aboutPanel.ts:23-28`, `packages/shell/src/hebrewDisplay.ts`, `packages/shell/src/main.ts:557,1111`, `apps/tanakh/src/site.ts`, `apps/talmud/src/site.ts`
- Test: `test/aboutPanel.test.ts`, `test/hebrewDisplay.test.ts` (create)

**Interfaces:**
- Produces: `Site.hasHebrew: boolean`. `applyHebrewChoice(hasHebrew: boolean)`: for a text without Hebrew the page is English-only, whatever the reader once chose elsewhere on the same origin.

- [ ] **Step 1: Write the failing tests**

In `test/aboutPanel.test.ts`, beside the existing toggle test (read it first and match its setup), add:

```ts
  it('has no Hebrew toggle for a text with no Hebrew', () => {
    const div = document.createElement('div');
    div.innerHTML = aboutHtml({ ...site, hasHebrew: false }, []);
    expect(div.querySelector('#hebrew-toggle')).toBeNull();
  });
```

`test/hebrewDisplay.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { applyHebrewChoice } from '../packages/shell/src/hebrewDisplay.ts';

afterEach(() => {
  document.body.className = '';
  localStorage.clear();
});

describe('the Hebrew choice', () => {
  it('shows English only on a page with no Hebrew, whatever was chosen before', () => {
    localStorage.setItem('torahMap.englishOnly', 'false');
    applyHebrewChoice(false);
    expect(document.body.classList.contains('english-only')).toBe(true);
  });

  it('does not write the choice for a page with no Hebrew', () => {
    applyHebrewChoice(false);
    expect(localStorage.getItem('torahMap.englishOnly')).toBeNull();
  });

  it('follows the stored choice on a page with Hebrew', () => {
    localStorage.setItem('torahMap.englishOnly', 'true');
    applyHebrewChoice(true);
    expect(document.body.classList.contains('english-only')).toBe(true);
    localStorage.setItem('torahMap.englishOnly', 'false');
    applyHebrewChoice(true);
    expect(document.body.classList.contains('english-only')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run test/aboutPanel.test.ts test/hebrewDisplay.test.ts` — expected FAIL (`hasHebrew` is not a `Site` field; `applyHebrewChoice` takes no argument).

- [ ] **Step 3: Implement**

`Site` in `text.ts`, after `squareName`:

```ts
  /** Whether the text has Hebrew: if not, the popup and labels are English only and the Hebrew control is not offered. */
  hasHebrew: boolean;
```

`aboutPanel.ts`: wrap the first `about-section` (Settings) so it renders only when `site.hasHebrew`:

```ts
  const settings = site.hasHebrew
    ? `<section class="about-section">
      <h3 class="panel-section-heading">Settings</h3>
      <button type="button" id="hebrew-toggle" class="${CONTROL.toggle}"></button>
    </section>`
    : '';
```
and put `${settings}` where the section was.

`hebrewDisplay.ts`:

```ts
/** Applies the reader's stored choice, or English only for a text with no Hebrew. Runs at startup, before any panel exists. */
export function applyHebrewChoice(hasHebrew: boolean): void {
  document.body.classList.toggle(CLASS, !hasHebrew || load());
}
```

`main.ts`: line 557 becomes
```ts
      aboutPanel.querySelector<HTMLButtonElement>('#hebrew-toggle')?.let
```
— no: write it plainly:
```ts
      const hebrewToggle = aboutPanel.querySelector<HTMLButtonElement>('#hebrew-toggle');
      if (hebrewToggle) bindHebrewToggle(hebrewToggle);
```
and line 1111 `applyHebrewChoice(source.site.hasHebrew);` (use whatever name that scope gives the text; line 548 uses `source.site`).

`apps/tanakh/src/site.ts` and `apps/talmud/src/site.ts`: add `hasHebrew: true,` after `squareName`.

- [ ] **Step 4: Run, typecheck, fix every `Site` the compiler finds**

Run: `npm run typecheck` — any test or fixture that builds a `Site` by hand gets `hasHebrew: true`. Then `npx vitest run` — expected all pass.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write packages/shell apps/tanakh/src/site.ts apps/talmud/src/site.ts test
git add -A packages apps test
git commit -m "A text may have no Hebrew: no toggle, English only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 6: The text, running with no overlays

**Files:**
- Create: `apps/euaiact/src/{site,baseColor,search,text,main}.ts`
- Modify: `test/page.test.ts`, `test/package-imports.test.ts`
- Test: `apps/euaiact/test/text.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `euaiactText: MapText<ActItem, ActSearchSettings>` (`@torahmap/euaiact/text.ts`); `euaiactSite: Site`. `search.ts` starts as the Talmud's finds-nothing stub, renamed; Task 8 replaces it.

- [ ] **Step 1: The site**

```ts
// apps/euaiact/src/site.ts
// What the AI Act's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { actRef } from './ids.ts';
import { EUAIACT_PAGE, EUR_LEX } from './page.ts';

export const euaiactSite: Site = {
  page: EUAIACT_PAGE,
  squareName: 'paragraph',
  hasHebrew: false,
  aboutHtml:
    '<p>An interactive visualization of the EU Artificial Intelligence Act, as amended in 2026. Every paragraph has a fixed position: recitals above, articles in the middle, annexes below.</p>',
  credits: [
    {
      source: 'EUR-Lex',
      url: EUR_LEX,
      note: 'Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744: the consolidated text of 27 July 2026, and the 2024 Official Journal text for the recitals.',
      collected: 'October 2026',
    },
  ],
  title(link) {
    return viewTitle(EUAIACT_PAGE.name, link.square ? actRef(link.square) : null, link);
  },
};
```

Check `viewTitle`'s signature in `packages/site` and `Credit`'s fields in `packages/shell/src/credits.ts`; match them exactly.

- [ ] **Step 2: Base colour**

```ts
// apps/euaiact/src/baseColor.ts
// A square's colour while no tool colours it: its layer.

import { brightnessJitter, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER } from './constants.ts';
import { idHash } from './ids.ts';
import type { ActItem } from './layout.ts';

/** A colour from its hex digits. */
export const hex = (rgb: string): Color => [
  parseInt(rgb.slice(1, 3), 16) / 255,
  parseInt(rgb.slice(3, 5), 16) / 255,
  parseInt(rgb.slice(5, 7), 16) / 255,
];

export const RECITAL = hex('#b9a27a');
export const ARTICLE = hex('#9aa3ad');
export const ANNEX = hex('#5b8fc9');

export function layerColor(item: ActItem): Color {
  const base = item.layer === 'recital' ? RECITAL : item.layer === 'annex' ? ANNEX : ARTICLE;
  return brightnessJitter(base, idHash(item.id), BRIGHTNESS_JITTER);
}
```

And a test beside it:

```ts
// apps/euaiact/test/baseColor.test.ts
import { describe, expect, it } from 'vitest';
import { ARTICLE, layerColor } from '../src/baseColor.ts';
import { BRIGHTNESS_JITTER } from '../src/constants.ts';
import type { ActItem } from '../src/layout.ts';

const item = (id: string): ActItem => ({
  id, x: 0, y: 0, size: 6, layer: 'article', origin: 'B', lead: false, chapter: 'I',
});

describe('a square’s base colour', () => {
  it('varies by square, within the brightness range, the same every time', () => {
    const colours = ['1', '2', '3', '4', '5'].map((id) => layerColor(item(id)));
    expect(new Set(colours.map((c) => c[0])).size).toBeGreaterThan(1);
    for (const c of colours) {
      const f = c[0] / ARTICLE[0];
      expect(f).toBeGreaterThanOrEqual(1 - BRIGHTNESS_JITTER - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + BRIGHTNESS_JITTER + 1e-9);
    }
    expect(layerColor(item('1'))).toEqual(colours[0]);
  });
});
```

- [ ] **Step 3: Search stub**

Copy `apps/talmud/src/search.ts` to `apps/euaiact/src/search.ts`, renaming `Talmud` to `Act` throughout (`ActSearchSettings`, `ACT_SEARCH_PARAMS`, `actSearch`), `TalmudLayoutItem` to `ActItem` (from `./layout.ts`), and the strings to "No matching paragraphs". Keep its header comment but say it finds nothing until its own task.

- [ ] **Step 4: The text**

```ts
// apps/euaiact/src/text.ts
// The EU AI Act as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import type { LinkKeys } from '@torahmap/link';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { createMapLabels, sectionLabelReach } from '@torahmap/shell/mapLabels.ts';
import type { Story } from '@torahmap/stories';
import { layerColor } from './baseColor.ts';
import { CHAPTER_TAB, LAYER_LABEL_SIZE, LAYER_NAMES } from './constants.ts';
import { TEXTS_FILE, STRUCTURE_FILE, structureFrom, type ActTexts } from './data.ts';
import { actRef, sourceUrl } from './ids.ts';
import { computeActLayout, type ActItem } from './layout.ts';
import { ACT_SEARCH_PARAMS, actSearch, type ActSearchSettings } from './search.ts';
import { euaiactSite } from './site.ts';

// Shortcut: the Act's one story is a single stop showing the whole map, until its first real
// story is written.
const WHOLE_MAP: Story = {
  id: 'euaiact',
  data: {
    title: 'The AI Act',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'The EU AI Act, one square per paragraph.',
        camera: 'initial',
        overlay: null,
      },
    ],
  },
};

const ACT_LINK_KEYS: LinkKeys = {
  square: 'at',
  search: ACT_SEARCH_PARAMS,
  overlayParams: () => undefined,
  // Low enough for the whole Act to fit across a phone.
  zoom: { min: 0.1, max: 12, start: 1 },
};

export const euaiactText: MapText<ActItem, ActSearchSettings> = {
  site: euaiactSite,
  link: ACT_LINK_KEYS,
  firstFiles: [STRUCTURE_FILE],

  open(loaded) {
    const laid = computeActLayout(structureFrom(loaded));

    return {
      items: laid.items,

      startCamera(viewport) {
        // The layer labels stand to the right of the map.
        const width = laid.bounds.width + sectionLabelReach(LAYER_LABEL_SIZE);
        const box = { minX: 0, minY: 0, maxX: width, maxY: laid.bounds.height };
        return cameraToFit(box, viewport.width, viewport.height, ACT_LINK_KEYS.zoom);
      },

      baseColor: (item) => layerColor(item),

      labels: (container) =>
        createMapLabels(laid.books, container, {
          sectionNames: LAYER_NAMES,
          sectionSize: LAYER_LABEL_SIZE,
          tab: CHAPTER_TAB,
        }),

      popupFile: () => TEXTS_FILE,

      popupText(item, loadedFiles) {
        const texts = loadedFiles.get(TEXTS_FILE) as ActTexts | undefined;
        return { ref: actRef(item.id), hebrew: '', english: texts?.[item.id] ?? '', link: sourceUrl(item.id) };
      },

      overlays: [],

      search: actSearch,

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      area: (item) => ({
        area: item.layer === 'article' ? `Chapter ${item.chapter}` : actRef(item.id),
        section: item.layer,
      }),
    };
  },
};
```

`main.ts`:

```ts
// The AI Act map: the app shell given the Act.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { euaiactText } from './text.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(euaiactText).catch((error) => reportError('main', error));
```

- [ ] **Step 5: Register the page's copy and its import boundary**

`test/page.test.ts`: import `euaiactText` from `@torahmap/euaiact/text.ts` and add
`expect(euaiact.copy).toBe(euaiactText.site.page);` to "gives each text the copy its site shows".

`test/package-imports.test.ts`: add a constant `const EUAIACT_CODE = (file: string) => file.startsWith('apps/euaiact/');` and three cases in `describe('the code each page runs'`:

```ts
  it('in the app shell, is no text’s own', ...)  // extend the existing filter with || EUAIACT_CODE(file)

  it('for the Act, is none of the Tanakh’s or the Talmud’s', () => {
    const files = reached('apps/euaiact/src/main.ts');
    expect(files.filter((file) => TANAKH_CODE(file) || TALMUD_CODE(file))).toEqual([]);
  });

  it('for the Tanakh and the Talmud, is none of the Act’s', () => {
    expect(reached('apps/tanakh/src/main.ts').filter(EUAIACT_CODE)).toEqual([]);
    expect(reached('apps/talmud/src/main.ts').filter(EUAIACT_CODE)).toEqual([]);
  });
```

Also add `'@torahmap/euaiact': []` to `TANAKH_IMPORTS` so the per-package import check treats the Act as importing none of the Tanakh's code; read how `importProblems` reads that table and make the smallest change that covers the new app.

- [ ] **Step 6: A test of what the text hands the shell**

```ts
// apps/euaiact/test/text.test.ts
import { describe, expect, it } from 'vitest';
import { euaiactText } from '../src/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from '../src/data.ts';
import { actFixture } from './helpers/actFixture.ts';

const open = euaiactText.open(new Map([[STRUCTURE_FILE, actFixture]]));
const item = (id: string) => open.items.find((i) => i.id === id)!;

describe('the Act as a text', () => {
  it('shows a square’s text, in English, with a link to its source', () => {
    const texts = new Map<string, unknown>([[TEXTS_FILE, { '1(1)': 'The purpose is…' }]]);
    const popup = open.popupText(item('1(1)'), texts, null);
    expect(popup.hebrew).toBe('');
    expect(popup.english).toBe('The purpose is…');
    expect(popup.link).toContain('#art_1');
    expect(popup.ref).toBe('Article 1(1)');
  });

  it('shows no text before the texts file is in', () => {
    expect(open.popupText(item('1(1)'), new Map(), null).english).toBe('');
  });

  it('has a story to open on', () => {
    expect(open.stories.list.length).toBeGreaterThan(0);
  });

  it('has no Hebrew', () => {
    expect(euaiactText.site.hasHebrew).toBe(false);
  });
});
```

- [ ] **Step 7: Run, typecheck, and look at the page**

Run: `npx vitest run` and `npm run typecheck` — expected clean.
Start your own dev server as a background task; read the port from its output; confirm `curl -s http://localhost:<port>/euaiact/ | grep "<title>AI Act Map"`. Open `http://localhost:<port>/euaiact/` in Chrome (load the Chrome tools with one ToolSearch call; use a new tab) and Read a screenshot. Expected: three layers drawn, the recitals as wide tiles, chapter tabs readable, layer names at the right. If labels overlap or clip, adjust `CHAPTER_TAB` and `LAYER_LABEL_SIZE` in `constants.ts` by looking, and note the sizes you land on in a comment only if they come from a measurement. Click a square: the popup shows its text. Tell Danyel the port, the branch (`euaiact-text`) and the project when you report.

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write apps/euaiact test
git add apps/euaiact test
git commit -m "The AI Act as a text: the map draws, its labels and popup work

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 7: Two overlays: Amendment and What points here

**Files:**
- Create: `apps/euaiact/src/overlays/{amendment,references,index}.ts`, `apps/euaiact/test/overlays.test.ts`
- Modify: `apps/euaiact/src/text.ts` (`overlays`, link keys)

**Interfaces:**
- Consumes: `ActItem`, `ActRef`, `ownerOf`, `hex`, `REFS_FILE`.
- Produces: `amendmentOverlay`, `referencesOverlay` (`id: 'references'`, settings `{ article: string }`, URL key `article`, default `'6'`), and `ACT_OVERLAYS: Overlay<ActItem>[]`, `actOverlayParams(id)`.

Read `apps/tanakh/src/overlays/verse-length.ts` (an overlay with settings, legend and controls) before writing, and match how it builds its controls and legend DOM and which CSS classes it uses.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/euaiact/test/overlays.test.ts
import { describe, expect, it } from 'vitest';
import type { ActRef } from '../src/data.ts';
import type { ActItem } from '../src/layout.ts';
import { amendmentOverlay, AMENDED } from '../src/overlays/amendment.ts';
import { referencesOverlay, CITES, CITED_BY, FOCUS, QUIET } from '../src/overlays/references.ts';

const item = (id: string, over: Partial<ActItem> = {}): ActItem => ({
  id, x: 0, y: 0, size: 6, layer: 'article', origin: 'B', lead: false, chapter: 'I', ...over,
});

describe('the amendment overlay', () => {
  it('colours text inserted and replaced in 2026 differently from the rest', () => {
    const colour = (origin: ActItem['origin']) =>
      amendmentOverlay.getItemColor(item('1', { origin }), undefined as never, undefined as never);
    expect(colour('M1 inserted')).not.toEqual(colour('B'));
    expect(colour('M1 replaced')).not.toEqual(colour('B'));
    expect(colour('M1 replaced')).not.toEqual(colour('M1 inserted'));
  });

  it('draws a list’s lead-in darker than its points', () => {
    const colour = (lead: boolean) =>
      amendmentOverlay.getItemColor(item('1', { lead }), undefined as never, undefined as never);
    expect(colour(true)).not.toEqual(colour(false));
  });
});

describe('the what-points-here overlay', () => {
  // Article 6 cites 5(1) and Annex III; 9(2) and 40 cite Article 6; 6(1) cites 6(2) inside itself.
  const refs: ActRef[] = [
    ['6(1)', '5(1)'],
    ['6(2)', 'Annex III'],
    ['9(2)', '6(1)'],
    ['40', '6'],
    ['6(1)', '6(2)'],
  ];
  const colours = (squares: ActItem[], article = '6') =>
    referencesOverlay.colorsFor(squares, { article }, null, { refs });

  it('marks the article itself', () => {
    expect(colours([item('6(2)')])[0]).toEqual(FOCUS);
  });

  it('marks what the article cites, down to the paragraph and point', () => {
    expect(colours([item('5(1)'), item('5(1)(a)'), item('5(2)')])).toEqual([CITES, CITES, QUIET]);
  });

  it('marks a whole annex the article cites, and no other', () => {
    const annex = (n: string) => item(`Annex.${n}.1.1`, { layer: 'annex' });
    expect(colours([annex('III'), annex('IV')])).toEqual([CITES, QUIET]);
  });

  it('marks what cites the article', () => {
    expect(colours([item('9(2)'), item('9(3)')])).toEqual([CITED_BY, QUIET]);
    expect(colours([item('40')])[0]).toEqual(CITED_BY);
  });

  it('colours no recital', () => {
    expect(colours([item('Recital.3', { layer: 'recital' })])[0]).toEqual(QUIET);
  });

  it('reads its article from a link and writes it back, leaving the default out', () => {
    expect(referencesOverlay.settingsFromUrl({ article: '9' })).toEqual({ article: '9' });
    expect(referencesOverlay.settingsFromUrl({})).toEqual({ article: '6' });
    expect(referencesOverlay.settingsToUrl({ article: '9' })).toEqual({ article: '9' });
    expect(referencesOverlay.settingsToUrl({ article: '6' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run to see them fail** — `npx vitest run apps/euaiact/test/overlays.test.ts`, expected FAIL (modules missing).

- [ ] **Step 3: Implement the amendment overlay**

```ts
// apps/euaiact/src/overlays/amendment.ts
// Colours each article square by whether the 2026 amendment inserted or replaced its text.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { Color } from '@torahmap/utils';
import { ANNEX, RECITAL, hex } from '../baseColor.ts';
import type { Origin } from '../data.ts';
import type { ActItem } from '../layout.ts';

export const AMENDED: Readonly<Record<Origin, { plain: Color; lead: Color; name: string }>> = {
  B: { plain: hex('#9aa3ad'), lead: hex('#4f5963'), name: 'Unchanged since 2024' },
  'M1 inserted': { plain: hex('#e8833a'), lead: hex('#b85a17'), name: 'Inserted in 2026' },
  'M1 replaced': { plain: hex('#e6c229'), lead: hex('#b39410'), name: 'Replaced in 2026' },
};
const ANNEX_LEAD = hex('#2a5a92');

function colorOf(item: ActItem): Color {
  if (item.layer === 'recital') return RECITAL;
  if (item.layer === 'annex') return item.lead ? ANNEX_LEAD : ANNEX;
  return item.lead ? AMENDED[item.origin].lead : AMENDED[item.origin].plain;
}

export const amendmentOverlay: Overlay<ActItem> = {
  id: 'amendment',
  name: 'Amendment',
  description:
    'Shows which paragraphs the 2026 amendment inserted or replaced. Orange is new, yellow is reworded.',
  getItemColor: (item) => colorOf(item),
  colorsFor: (items) => items.map(colorOf),
  renderLegend(container) {
    container.replaceChildren(
      ...Object.values(AMENDED).map(({ plain, name }) => {
        const row = document.createElement('div');
        const swatch = document.createElement('span');
        swatch.style.cssText = `display:inline-block;width:0.8em;height:0.8em;margin-right:0.5em;background:rgb(${plain.map((c) => Math.round(c * 255)).join(',')})`;
        row.append(swatch, name);
        return row;
      }),
    );
  },
};
```

Adjust the legend's markup to match the Tanakh overlays' legend (their classes and the legend CSS), found when you read `verse-length.ts`.

- [ ] **Step 4: Implement the references overlay**

```ts
// apps/euaiact/src/overlays/references.ts
// What one article cites, and what cites it.

import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { hex } from '../baseColor.ts';
import { REFS_FILE, type ActRef } from '../data.ts';
import { ownerOf } from '../ids.ts';
import type { ActItem } from '../layout.ts';

export const QUIET = hex('#dcdfe3');
export const FOCUS = hex('#1f2933');
export const CITES = hex('#1b9e77');
export const CITED_BY = hex('#c2257a');

export interface ReferenceSettings {
  readonly article: string;
}
export interface ReferenceData {
  refs: readonly ActRef[];
}

export const REFERENCE_PARAMS = [
  { key: 'article', kind: 'text', default: '6' },
] as const satisfies readonly UrlParamSpec[];

/** Whether `unit` is `target` or inside it: "5(1)(h)" is inside "5(1)" and "5". */
const inside = (unit: string, target: string): boolean =>
  unit === target || unit.startsWith(`${target}(`);

export const referencesOverlay: Overlay<ActItem, ReferenceSettings, ReferenceData> = {
  id: 'references',
  name: 'What points here',
  description:
    'Pick an article: it shows dark, what it cites in green, and what cites it in magenta.',
  data: { refs: REFS_FILE },
  urlParams: REFERENCE_PARAMS,
  settingsFromUrl: (params) => ({ article: params.article ?? '6' }),
  settingsToUrl: ({ article }) => (article === '6' ? {} : { article }),

  getItemColor: (item, settings, data) => colorOf([item], settings, data)[0],
  colorsFor: (items, settings, _hovered, data) => colorOf(items, settings, data),

  renderControls(container, settings, onChange) {
    let box = container.querySelector<HTMLInputElement>('input');
    if (!box) {
      container.innerHTML = '<label>Article <input type="text" inputmode="text" size="6"></label>';
      box = container.querySelector('input')!;
      box.addEventListener('input', () => onChange(() => ({ article: box!.value.trim() })));
    }
    if (box.value !== settings.article) box.value = settings.article;
  },
};

function colorOf(items: ActItem[], { article }: ReferenceSettings, { refs }: ReferenceData) {
  const mine = (unit: string) => ownerOf(unit) === article;
  const cites = new Set(refs.filter(([f, t]) => mine(f) && !mine(t)).map(([, t]) => t));
  const citedBy = new Set(refs.filter(([f, t]) => mine(t) && !mine(f)).map(([f]) => f));
  return items.map((item) => {
    if (item.layer === 'recital') return QUIET;
    if (item.layer === 'annex') return cites.has(ownerOf(item.id)) ? CITES : QUIET;
    if (mine(item.id)) return FOCUS;
    if ([...cites].some((t) => inside(item.id, t))) return CITES;
    // A citing unit marks itself, and a list's lead-in marks the list when its points cite.
    if ([...citedBy].some((f) => inside(item.id, f) || (item.lead && inside(f, item.id)))) {
      return CITED_BY;
    }
    return QUIET;
  });
}
```

If `Overlay`'s `renderControls` signature or the `data` typing rejects this, follow the compiler and `verse-length.ts`, not the sketch. The article box is free text on purpose: an article that does not exist colours everything quiet.

- [ ] **Step 5: Register them**

```ts
// apps/euaiact/src/overlays/index.ts
import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { ActItem } from '../layout.ts';
import { amendmentOverlay } from './amendment.ts';
import { REFERENCE_PARAMS, referencesOverlay } from './references.ts';

export const ACT_OVERLAYS: Overlay<ActItem>[] = [amendmentOverlay, referencesOverlay];

export const actOverlayParams = (id: string): readonly UrlParamSpec[] | undefined =>
  id === referencesOverlay.id ? REFERENCE_PARAMS : undefined;
```

In `text.ts`: `overlays: ACT_OVERLAYS,` and `overlayParams: actOverlayParams,`.

- [ ] **Step 6: Run, typecheck, look**

Run: `npx vitest run` and `npm run typecheck`. In the dev page, choose each overlay from the menu, Read a screenshot of each, and load `…/euaiact/?overlay=references&article=6` directly (a hard load, not through a story). Expected: the Article 6 picture from the exploration (`docs/plans/images/2026-10-13-eu-ai-act-map/6-article-6-references.png`): compare the two. A different picture means a port error; find it.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write apps/euaiact
git add apps/euaiact
git commit -m "Two overlays for the AI Act: amendment, and what points here

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 8: Plain-word search

**Files:**
- Modify: `apps/euaiact/src/search.ts` (replace the stub)
- Test: `apps/euaiact/test/search.test.ts` (create)

**Interfaces:**
- Consumes: `ActTexts`, `TEXTS_FILE`, `SearchTool` from `@torahmap/shell/app/search.ts`.
- Produces: `actSearch: SearchTool<ActItem, ActSearchSettings, ActSearchData>`, with `ActSearchData = { texts: ActTexts }`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/euaiact/test/search.test.ts
import { describe, expect, it } from 'vitest';
import type { ActItem } from '../src/layout.ts';
import { actSearch, wordMatcher } from '../src/search.ts';

const item = (id: string, layer: ActItem['layer'] = 'article'): ActItem => ({
  id, x: 0, y: 0, size: 6, layer, origin: 'B', lead: false, chapter: 'I',
});
const texts = {
  'Recital.1': 'Deployers should keep records.',
  '9(2)': 'The provider shall keep records of the system.',
  '9(3)': 'Nothing here.',
};
const colours = (text: string) =>
  actSearch.colorsFor([item('Recital.1', 'recital'), item('9(2)'), item('9(3)')], { text }, null, { texts });

describe('searching the Act for a word', () => {
  it('colours every paragraph that has the word, in a recital or an article', () => {
    const [recital, article, none] = colours('records');
    expect(recital).not.toBeNull();
    expect(article).not.toBeNull();
    expect(none).toBeNull();
  });

  it('matches a whole word, in any case', () => {
    expect(colours('RECORD').every((c) => c === null)).toBe(true);
    expect(colours('Provider')[1]).not.toBeNull();
  });

  it('finds nothing for a single letter', () => {
    expect(colours('a').every((c) => c === null)).toBe(true);
    expect(actSearch.isSearching({ text: 'a' })).toBe(false);
  });

  it('treats what a reader types as letters, not as a pattern', () => {
    expect(() => colours('(a')).not.toThrow();
    expect(wordMatcher('a.b')?.test('a-b')).toBe(false);
  });

  it('reads its word from a link and writes it back', () => {
    expect(actSearch.settingsFromUrl({ search: 'records' })).toEqual({ text: 'records' });
    expect(actSearch.settingsToUrl({ text: ' records ' })).toEqual({ search: 'records' });
    expect(actSearch.settingsToUrl({ text: '' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run to see it fail** — expected FAIL (`wordMatcher` missing; the stub finds nothing).

- [ ] **Step 3: Implement**

Replace `search.ts`'s matching with:

```ts
// apps/euaiact/src/search.ts
// The Act's search: a whole English word, in any case, found in any paragraph's text.

import type { UrlParamSpec } from '@torahmap/link';
import { SEARCH_BOX_ID, type SearchTool } from '@torahmap/shell/app/search.ts';
import { hex } from './baseColor.ts';
import { TEXTS_FILE, type ActTexts } from './data.ts';
import type { ActItem } from './layout.ts';

export interface ActSearchSettings {
  readonly text: string;
}
export interface ActSearchData {
  texts: ActTexts;
}

export const ACT_SEARCH_PARAMS = [
  { key: 'search', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

const FOUND = hex('#e8833a');

const wordIn = (settings: ActSearchSettings): string => settings.text.trim();

/** A matcher for `word` as a whole word in any case; null when it is under two letters. */
export function wordMatcher(word: string): RegExp | null {
  if (word.length < 2) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

function colorsFor(items: ActItem[], settings: ActSearchSettings, data: ActSearchData) {
  const matcher = wordMatcher(wordIn(settings));
  return items.map((item) => (matcher?.test(data.texts[item.id] ?? '') ? FOUND : null));
}

export const actSearch: SearchTool<ActItem, ActSearchSettings, ActSearchData> = {
  id: 'search',
  name: 'Search',
  description: 'Finds a word in any recital, article or annex.',
  data: { texts: TEXTS_FILE },

  isSearching: (settings) => wordMatcher(wordIn(settings)) !== null,

  telemetry: { readerChanged() {}, replaced() {}, dataLoaded() {} },

  getItemColor: (item, settings, data) => colorsFor([item], settings, data)[0],
  colorsFor: (items, settings, _hovered, data) => colorsFor(items, settings, data),

  urlParams: ACT_SEARCH_PARAMS,
  settingsFromUrl: (params) => ({ text: params.search ?? '' }),
  settingsToUrl: (settings): Record<string, string> => {
    const word = wordIn(settings);
    return word ? { search: word } : {};
  },

  renderControls(container, settings, onChange, data) {
    let box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`);
    if (!box) {
      container.innerHTML = `<input id="${SEARCH_BOX_ID}" type="search" aria-label="Search"><p></p>`;
      box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`)!;
      box.addEventListener('input', () => onChange(() => ({ text: box!.value })));
    }
    if (box.value !== settings.text) box.value = settings.text;
    const word = wordIn(settings);
    const matcher = wordMatcher(word);
    const found =
      data && matcher ? Object.values(data.texts).filter((t) => matcher.test(t)).length : null;
    container.querySelector('p')!.textContent = !word
      ? 'Type to search'
      : found === null
        ? ''
        : `${found} matching paragraphs`;
  },
};
```

- [ ] **Step 4: Run, typecheck, look**

Run: `npx vitest run` and `npm run typecheck`. In the dev page open `…/euaiact/?search=deployer`; Read a screenshot: squares in all three layers coloured. Open the search panel: the count shows. Check the network panel or `read_network_requests`: `texts.json` is fetched once for search and the popup, not twice.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write apps/euaiact
git add apps/euaiact
git commit -m "Plain-word search for the AI Act

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PuNHFLh8NB9vxtScbcui5J"
```

---

### Task 9: The page in a real browser, the log, and the pull request

**Files:**
- Create: `layout/euaiact.spec.ts`
- Modify: `layout/playwright.config.ts:24`, `docs/plans/2026-10-15-eu-ai-act-text-design.md`

- [ ] **Step 1: Write the page's browser test**

Read `layout/talmud.spec.ts` (above in this plan's source) and `layout/page.ts` (`openMap`, `boxes`, `shown`, `allLoaded`) first, then write:

```ts
// layout/euaiact.spec.ts
// The AI Act's page, at /euaiact/: it draws, its labels sit over the map, and a pinned square shows its text.
import { expect, test } from '@playwright/test';
import { allLoaded, boxes, openMap } from './page.ts';
import { EUAIACT_PAGE, EUAIACT_PATH as ACT } from '@torahmap/euaiact/page.ts';

test('the Act map draws, and has no Hebrew control', async ({ page }) => {
  const errors = await openMap(page, '', ACT);
  expect((await boxes(page, '#canvas')).length).toBe(1);
  await page.locator('#menu-toggle').click();
  expect(errors).toEqual([]);
});

test('the dev server fills the Act’s page with its own copy', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop', 'what the server sends does not depend on the screen');
  for (const address of [ACT, `${ACT}index.html`, `${ACT}?at=6(2)`]) {
    const html = await (await request.get(address)).text();
    expect(html).toContain(`<title>${EUAIACT_PAGE.name}</title>`);
  }
});

test("a pinned square's popup shows its text, in English", async ({ page }) => {
  const errors = await openMap(page, 'at=6(2)', ACT);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Article 6(2)');
  await expect(page.locator('#popup .popup-english')).not.toBeEmpty();
  await expect(page.locator('#popup .popup-hebrew')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('a recital is pinned by a click on its right half', async ({ page }) => {
  await openMap(page, 'at=Recital.1&zoom=6', ACT);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Recital 1');
});

test('a link to a square that does not exist pins nothing', async ({ page }) => {
  await openMap(page, 'at=999(9)', ACT);
  await expect(page.locator('#popup.visible')).toHaveCount(0);
});

test('/euaiact, without the slash, opens the same page and keeps the link', async ({ page }) => {
  await page.goto('/euaiact?at=6(2)');
  await expect(page).toHaveURL(/\/euaiact\/\?at=6\(2\)$/);
});

test('the Hebrew choice is never written', async ({ page }) => {
  await openMap(page, '', ACT);
  expect(await page.evaluate(() => localStorage.getItem('torahMap.englishOnly'))).toBeNull();
});
```

The "right half" test as written only checks that a link pins the recital; make it a real click test: compute the recital's right-half screen point from `computeActLayout` the way `layout/talmud.spec.ts`'s `squaresOnScreen` does, click there, and assert the same popup. If that proves awkward, say so in the PR rather than leaving a weaker test under that name.

Add `'euaiact.spec.ts'` to `testMatch` in `layout/playwright.config.ts`.

- [ ] **Step 2: Run the browser suites**

Run: `npm run test:layout` — expected: the new file passes at all four sizes, and the existing Tanakh and Talmud states are unchanged. Anything in `layout/known.ts` that changes is a regression, not an update: stop and find why.
Run: `npm run test:loading` — expected pass (nothing here changes startup).

- [ ] **Step 3: Pictures for the PR**

`npm run test:layout` writes `layout-report/shots/`. Take the Act's states (the opening view at desktop and phone; an overlay on; a pinned recital; a search) and commit the ones the PR cites into `docs/plans/images/2026-10-15-eu-ai-act-text/`, linking them in the PR by commit-pinned URL (`https://github.com/danyelf/torahmap/blob/<sha>/…?raw=true`), never by relative path.

- [ ] **Step 4: Fill in the assumptions table in the design doc**

In `docs/plans/2026-10-15-eu-ai-act-text-design.md`, "Where the machinery assumed something else", update each row with what building found. What is already known from reading the code, to be confirmed or corrected against what you saw:

- **2 (popup, Hebrew):** the popup copes with empty Hebrew; the real assumptions were the "Hide Hebrew" control and the stored Hebrew choice, now `Site.hasHebrew` (Task 5).
- **3 (labels):** `mapLabels.ts` wants both names and hides the English of a narrow book unless the page is English-only; an English-only text gets that for free from `hasHebrew: false`. The Hebrew span still exists, empty and hidden.
- **4 (a story):** a text still needs one; the Act's is the Talmud's stopgap.
- **5 (overlays and link keys):** the shell never reads `overlay-catalog`; it takes `text.overlays` and `link.overlayParams`, so the Act's overlays needed nothing from it. The catalog is the Tanakh's own list. Say so, and drop the row's "first test of this seam" line if the build bore it out.
- **6 (telemetry):** an event does not record which text sent it, so the Talmud's page sends none and the Act's does the same. Telemetry for a second text is its own piece of work.
- **New, found here:** a link's square id may be any text without a slash, pipe, semicolon or backslash, up to 100 characters (`SQUARE_ID` in `packages/link/src/params.ts`), so the Act's ids — parentheses and all — need nothing from it.
- **New, if true:** the first-version Hebrew-choice key `torahMap.englishOnly` is shared by every page on an origin.

Add rows for anything else you met. The EUR-Lex links (`#art_6`, `#rct_12`, `#anx_III`) were not opened by script, since EUR-Lex answers scripts with a bot check: open three in the Chrome tools (a real browser passes the check), take a screenshot of each, and record whether the anchor lands on the right recital, article or annex. If the bot check blocks the browser too, say so with the loud-failure line and leave the links as they are.

- [ ] **Step 5: The final gates**

Run: `npm test`, `npm run typecheck`, `npm run build`. After the build, confirm the gating is real, not only tested:
- `ls dist` on this branch: `euaiact/` and `data/euaiact/` present.
- `WORKERS_CI_BRANCH=main npm run build` into a scratch copy is not needed; instead read `dist/.assetsignore` after a normal build (expect only `.assetsignore`) and trust `test/build.test.ts` for the live case. Say that this was checked by test and not by a live build.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base eu-ai-act-map --title "The EU AI Act as a third text" --body "<see below>"
```

Base it on `eu-ai-act-map` (#372), since it stacks on that branch; say so at the top of the body and that it retargets to `main` once #372 merges. The body leads with the problem and the approach in plain English, lists what changed in the shared machinery (the optional width, the per-page flag, `hasHebrew`) and what the Act found there, embeds the pictures by commit-pinned URL, says what to look at on the branch preview link, states what was verified and what was not (the live-build gate is tested, not built; EUR-Lex anchors per Step 4), and ends with the attribution line from the Global Constraints. Open it ready for review, not as a draft. Then `gh pr view` to confirm it is open.

---

## Self-Review

**Spec coverage.** Shape (Tasks 2, 4, 6); data shipped as JSON with the Python beside `scripts/` (Task 3); per-page flag and its test (Task 2); first version's layout, labels, popup, two overlays, plain-word search and one story (Tasks 4, 6, 7, 8); optional `width` in six places with the unchanged-for-others test (Task 1); the assumptions table filled in (Task 9); layout and loading tests, pictures (Task 9). Open questions (address, "What points here" as overlay or mode) are carried, not decided: the address stays a placeholder and the overlay is a menu entry.

**Placeholders.** Three places say "read X and match it" where the right form depends on code not reproduced here (`viewTitle`/`Credit` shapes in Task 6, the legend markup and `renderControls` typing in Task 7, the `importProblems` table in Task 6). Each names the file to read and the rule to follow; none leaves behaviour open. The Task 1 and Task 4 test snippets contain two sentences telling the engineer to correct a line before running; they were left explicit rather than silently fixed so the reason is visible.

**Type consistency.** `ActCell`, `ActGroup`, `ActBlock`, `ActColumn`, `ActChapter`, `ActAnnex`, `ActStructure`, `ActTexts`, `ActRef` are defined in Task 3 and used with those names after; `ActItem` in Task 4; `ownerOf`, `layerOf`, `actRef`, `sourceUrl` in Task 3; `hex` and the layer colours in Task 6 and reused in Tasks 7 and 8; `EXTRA_PAGES` in Task 2.
