# More than one story: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve several stories from `public/data/stories/`, list them in the Stories panel, name the story and stop in the URL, and keep each story's place for the visit.

**Architecture:** A hand-written `index.json` orders the stories; a pure module decides which are listed on this host. `main.ts` keeps one current story (its data, resolved stops and rendered text) plus a remembered stop per story, and swaps the current story through one routine that both links and the Stories panel use.

**Tech Stack:** TypeScript, Vite, vitest, Playwright layout tests.

**Spec:** `docs/plans/2026-09-27-multiple-stories.md`

## Global Constraints

- Nothing in browser storage for story places; the page holds them for the visit.
- Drafts are hidden on `torahmap.org` and `www.torahmap.org`, listed everywhere else. No effort goes into draft links working on the live site.
- Reading URL: `#story=<id>&stop=<stopId>`. Exploring URL: the view, as today, with no story.
- Unknown story → first listed story. Unknown stop → that story's first stop.
- Menu item: `Continue <title>` with detail `7/21`.
- Telemetry: `story` is appended after each story event's existing blobs; no column moves.
- Comments: present tense, no ticket or step numbers, short (AGENTS.md).
- Run `npm run format` before each commit; the pre-commit hook checks formatting, types and tests.

## Review Focus

1. An old link, `#story=abraham_call`, opens the tour at its first stop without an error. (Task 3 test)
2. A story title holding `<`, `&` or quotes is escaped in the menu and the cards. (Task 5 tests)
3. Going A → B → back to A resumes A at the stop the reader left, not stop 1. (Task 4 manual check)
4. The browser's Back button from story B to story A swaps the story's text as well as the camera. (Task 4 manual check)
5. An index entry without a file, or a file without an entry, fails a test rather than a reader. (Task 2 test)

---

### Task 1: The parser reads a story's title and description

**Files:**
- Modify: `src/scrollytelling/types.ts` (`StoryData`)
- Modify: `src/scrollytelling/storyParser.ts` (`parseStoryMarkdown`, `parseFrontmatter`)
- Test: `src/__tests__/unit/storyParser.test.ts` (create if absent; check `ls src/__tests__/unit | grep -i parser` first and add to the existing file if there is one)

**Interfaces:**
- Produces: `StoryData { stops; defaults?; title?: string; description?: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseStoryMarkdown } from '../../scrollytelling/storyParser';

describe('story frontmatter', () => {
  const md = [
    '---',
    'title: Prose and Poetry: Job',
    'description: The prose frame and the poem look different.',
    'easing: linear',
    '---',
    '',
    '<!-- stop: a | camera: Job -->',
    'Text.',
  ].join('\n');

  it('reads the title and description, colons and all', () => {
    const story = parseStoryMarkdown(md);
    expect(story.title).toBe('Prose and Poetry: Job');
    expect(story.description).toBe('The prose frame and the poem look different.');
    expect(story.defaults?.easing).toBe('linear');
  });

  it('leaves them out when the story has no frontmatter', () => {
    const story = parseStoryMarkdown('<!-- stop: a | camera: Job -->\nText.');
    expect(story.title).toBeUndefined();
    expect(story.description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/__tests__/unit/storyParser.test.ts`
Expected: FAIL, `title` is undefined.

- [ ] **Step 3: Implement**

In `types.ts` add to `StoryData`:

```ts
  /** Shown in the Stories panel and the menu. */
  title?: string;
  description?: string;
```

In `storyParser.ts`, have the frontmatter reader return every key, and let `parseStoryMarkdown` pick out what it needs:

```ts
export function parseStoryMarkdown(markdown: string): StoryData {
  const front = parseFrontmatter(markdown);
  const stops = parseStops(stripFrontmatter(markdown));
  const easing = front.easing as EasingName | undefined;
  return {
    stops,
    defaults: easing ? { easing } : undefined,
    title: front.title,
    description: front.description,
  };
}

function parseFrontmatter(md: string): Record<string, string> {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  const fields: Record<string, string> = {};
  if (!match) return fields;
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (key.trim() && value) fields[key.trim()] = value;
  }
  return fields;
}
```

Update the file's header comment: frontmatter holds `title`, `description` and `easing`, and the example lives in `public/data/stories/`.

- [ ] **Step 4: Run the story tests**

Run: `npx vitest run src/__tests__/unit/storyParser.test.ts src/__tests__/unit/story-file.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src && git commit -m "Read a story's title and description from its frontmatter"
```

---

### Task 2: Stories live in a directory with an index

**Files:**
- Move: `public/data/story.md` → `public/data/stories/tour.md` (`git mv`), adding `title` and `description` to its frontmatter
- Create: `public/data/stories/index.json`, `public/data/stories/sample.md`
- Create: `src/scrollytelling/storyIndex.ts`
- Modify: `src/scrollytelling/storyPanel.ts` (`loadStoryData`)
- Modify: `src/main.ts:1135` (startup load), `src/main.ts:1161-1177` (`reloadStory`, hot reload)
- Modify: `vite.config.ts:18-33` (watch the directory)
- Modify: `CLAUDE.md` (the line naming `public/data/story.md`)
- Test: `src/__tests__/unit/storyIndex.test.ts` (create), `src/__tests__/unit/story-file.test.ts` (every story)

**Interfaces:**
- Produces:
  - `interface StoryIndexEntry { id: string; draft?: boolean }`
  - `listedStories(index: StoryIndexEntry[], hostname: string): StoryIndexEntry[]`
  - `storyToOpen(listed: StoryIndexEntry[], id: string | null): string`
  - `loadStoryIndex(): Promise<StoryIndexEntry[]>`
  - `loadStoryData(id: string): Promise<StoryData>`
  - HMR event `story-update` with payload `{ id: string }`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit/storyIndex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listedStories, storyToOpen } from '../../scrollytelling/storyIndex';

const index = [{ id: 'tour' }, { id: 'sample', draft: true }, { id: 'job' }];

describe('listedStories', () => {
  it('hides drafts on the live site', () => {
    for (const host of ['torahmap.org', 'www.torahmap.org']) {
      expect(listedStories(index, host).map((s) => s.id)).toEqual(['tour', 'job']);
    }
  });

  it('lists drafts everywhere else, in index order', () => {
    for (const host of ['localhost', 'torahmap-pr-12.danyelf.workers.dev', '']) {
      expect(listedStories(index, host).map((s) => s.id)).toEqual(['tour', 'sample', 'job']);
    }
  });
});

describe('storyToOpen', () => {
  const listed = [{ id: 'tour' }, { id: 'job' }];
  it('opens the story a link names', () => expect(storyToOpen(listed, 'job')).toBe('job'));
  it('opens the first story when a link names none', () =>
    expect(storyToOpen(listed, null)).toBe('tour'));
  it('opens the first story when a link names one not listed', () =>
    expect(storyToOpen(listed, 'abraham_call')).toBe('tour'));
});
```

In `story-file.test.ts`, replace the single-file setup with every story in the index, and add the index/directory agreement:

```ts
const storiesDir = path.join(dataDir, 'stories');
const index: { id: string }[] = JSON.parse(
  fs.readFileSync(path.join(storiesDir, 'index.json'), 'utf-8'),
);

describe('stories/index.json', () => {
  it('lists every story in the directory, and only those', () => {
    const files = fs
      .readdirSync(storiesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    expect(index.map((s) => s.id).sort()).toEqual(files);
  });

  it('gives every story a title and a description', () => {
    const missing = index
      .map((s) => ({ id: s.id, story: read(s.id) }))
      .filter(({ story }) => !story.title || !story.description)
      .map(({ id }) => id);
    expect(missing).toEqual([]);
  });
});

function read(id: string) {
  return parseStoryMarkdown(fs.readFileSync(path.join(storiesDir, `${id}.md`), 'utf-8'));
}

describe.each(index.map((s) => s.id))('%s.md', (id) => {
  const markdown = fs.readFileSync(path.join(storiesDir, `${id}.md`), 'utf-8');
  const { stops } = parseStoryMarkdown(markdown);
  const comments = [...markdown.matchAll(/<!--\s*stop:\s*([^|>]+?)(?:\s*\|(.+?))?\s*-->/g)];
  // …the existing six `it` blocks, unchanged, moved inside this describe
});
```

Keep the file's header comment, now saying "every shipped story".

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/__tests__/unit/storyIndex.test.ts src/__tests__/unit/story-file.test.ts`
Expected: FAIL, the module and `stories/index.json` do not exist.

- [ ] **Step 3: Move the tour and write the index and the sample**

```bash
mkdir -p public/data/stories && git mv public/data/story.md public/data/stories/tour.md
```

Frontmatter of `tour.md` becomes:

```
---
title: The guided tour
description: What the map shows, how to read it, and how Abraham is remembered across the Tanakh.
easing: ease-in-out
---
```

(The description is a draft for Danyel to rewrite; say so in the PR.)

`public/data/stories/index.json`:

```json
[{ "id": "tour" }, { "id": "sample", "draft": true }]
```

`public/data/stories/sample.md`:

```
---
title: A short sample
description: Two stops, for trying the list of stories. Never shown on torahmap.org.
---

<!-- stop: book | camera: Job | overlay: verse-length -->

The Book of Job, coloured by the length of each verse.

<!-- stop: close | camera: Job.42.7 | zoom: 2 | verse: Job.42.7 | overlay: verse-length -->

Job 42:7, where the prose frame returns.
```

- [ ] **Step 4: Write `src/scrollytelling/storyIndex.ts`**

```ts
/** A story as `public/data/stories/index.json` lists it, in menu order. */
export interface StoryIndexEntry {
  id: string;
  /** Listed while it is being written, except on the live site. */
  draft?: boolean;
}

const LIVE_HOSTS = ['torahmap.org', 'www.torahmap.org'];

export function listedStories(index: StoryIndexEntry[], hostname: string): StoryIndexEntry[] {
  const live = LIVE_HOSTS.includes(hostname);
  return index.filter((story) => !live || !story.draft);
}

/** The story a link names, or the first listed when it names none or one not listed. */
export function storyToOpen(listed: StoryIndexEntry[], id: string | null): string {
  return listed.find((story) => story.id === id)?.id ?? listed[0].id;
}

export async function loadStoryIndex(): Promise<StoryIndexEntry[]> {
  const response = await fetch('/data/stories/index.json');
  return response.json();
}
```

In `storyPanel.ts`:

```ts
export async function loadStoryData(id: string): Promise<StoryData> {
  const response = await fetch(`/data/stories/${id}.md`);
  return parseStoryMarkdown(await response.text());
}
```

- [ ] **Step 5: Load the first listed story in `main.ts`**

At `main.ts:1135`:

```ts
  const listed = listedStories(await loadStoryIndex(), location.hostname);
  let storyId = storyToOpen(listed, null);
  let storyData = await loadStoryData(storyId);
```

`reloadStory` loads `storyId`. The hot-reload listener becomes:

```ts
    import.meta.hot.on('story-update', ({ id }: { id: string }) => {
      if (id === storyId) reloadStory();
    });
```

In `vite.config.ts`, watch the directory and name the file that changed:

```ts
/**
 * Vite plugin: send HMR event when a story in public/data/stories/ changes.
 * The app listens for this to hot-reload the story without a full page refresh.
 */
function storyHotReload(): Plugin {
  const dir = resolve(__dirname, 'public/data/stories');
  return {
    name: 'story-hot-reload',
    configureServer(server) {
      server.watcher.add(dir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(dir) && file.endsWith('.md')) {
          server.ws.send({
            type: 'custom',
            event: 'story-update',
            data: { id: basename(file, '.md') },
          });
        }
      });
    },
  };
}
```

(`import { basename, resolve } from 'path'`.)

In `CLAUDE.md`, the guided-story bullet: "The stories are in `public/data/stories/`, listed in order in its `index.json`; the dev server hot-reloads them."

- [ ] **Step 6: Run the tests, the typecheck and the app**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

Start a dev server in the background (`npm run dev`, read its port from the output) and confirm `curl -s http://localhost:PORT/data/stories/index.json` returns the index and the page opens on the tour. Edit a line in `tour.md` and confirm the text updates without a reload.

- [ ] **Step 7: Commit**

```bash
npm run format && git add -A && git commit -m "Keep stories in a directory, listed by an index"
```

---

### Task 3: The URL names the story and the stop

**Files:**
- Modify: `src/urlState.ts` (`RESERVED_KEYS`, `UrlState`, `parseUrlState`, `buildUrlHash`)
- Modify: `src/viewState.ts` (`ViewState`, `resolveViewState`)
- Modify: `src/main.ts` — `syncUrl` (`:818`), `applyViewState` (`:1476`), startup (`storyToOpen` with the URL), `trackPageView` call (`:1494`)
- Test: `src/__tests__/unit/urlState.test.ts`, `src/__tests__/integration/view-state-restore.test.ts`

**Interfaces:**
- Consumes: `storyToOpen` (Task 2)
- Produces: `UrlState.story` (story id), `UrlState.stop` (stop id); `ViewState.story: string | null`, `ViewState.stop: string | null` (replaces `storyStop`)

- [ ] **Step 1: Write the failing tests**

In `urlState.test.ts`, beside the existing `updateUrl` tests:

```ts
  it('writes a story and its stop together', () => {
    expect(buildUrlHash({ story: 'tour', stop: 'abraham_call', overlayParams: {} })).toBe(
      '#story=tour&stop=abraham_call',
    );
  });

  it('reads a story and its stop', () => {
    mockWindowLocation('#story=tour&stop=abraham_call');
    const state = parseUrlState();
    expect(state.story).toBe('tour');
    expect(state.stop).toBe('abraham_call');
  });
```

(Match the helper names the file already uses for setting the hash; update the existing `#story=intro` test at `:531` to `#story=tour&stop=intro` with `{ story: 'tour', stop: 'intro', … }`, and add `'stop'` to the reserved list at `:1037`.)

In `view-state-restore.test.ts`, replace the `storyStop` expectations:

```ts
    it('opens a hash naming a story and stop as that story at that stop', () => {
      const view = viewFor('#story=tour&stop=intro');
      expect(view.mode).toBe('story');
      expect(view.story).toBe('tour');
      expect(view.stop).toBe('intro');
    });

    it('opens an old single-story link as a story, naming no stop', () => {
      const view = viewFor('#story=abraham_call');
      expect(view.mode).toBe('story');
      expect(view.story).toBe('abraham_call');
      expect(view.stop).toBeNull();
    });
```

and in the empty-hash test, `story: null, stop: null` in place of `storyStop: null`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/__tests__/unit/urlState.test.ts src/__tests__/integration/view-state-restore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`urlState.ts`:

```ts
const RESERVED_KEYS = new Set(['story', 'stop', 'overlay', 'verse', 'zoom', 'x', 'y']);
```

`UrlState` gains `stop?: string;` beside `story`. In `parseUrlState`, after the story:

```ts
  const stop = validateString(params.get('stop'));
  if (stop) state.stop = stop;
```

`buildUrlHash`:

```ts
  if (state.story) {
    const params = new URLSearchParams({ story: state.story });
    if (state.stop) params.set('stop', state.stop);
    return `#${params.toString()}`;
  }
```

`viewState.ts`: `storyStop` becomes `story: string | null; stop: string | null;`, filled from `url.story ?? null` and `url.stop ?? null`.

`main.ts`:
- Startup: `let storyId = storyToOpen(listed, parseUrlState().story ?? null);`
- `syncUrl`: `{ story: storyId, stop: resolvedStops[storyStopIndex()].id, overlayParams: {} }`
- `applyViewState`: `resolvedStops.findIndex((s) => s.id === next.stop)`. A link naming another story is Task 4's; for now it opens the current story.
- `trackPageView` keeps its current argument for now, `parseUrlState().stop ?? ''`; Task 6 adds the story.

- [ ] **Step 4: Run all tests and the typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. Fix any other `storyStop` reader the compiler finds.

- [ ] **Step 5: Check in the browser**

On the dev server: `#story=tour&stop=abraham_call` opens that stop; scrolling rewrites the URL as `#story=tour&stop=…`; `#story=abraham_call` opens the tour at its first stop.

- [ ] **Step 6: Commit**

```bash
npm run format && git add -A && git commit -m "Name the story and the stop in the URL"
```

---

### Task 4: Switching stories, and a place kept for each

**Files:**
- Modify: `src/main.ts` — story state near `:1135`, `restoreFromUrl` / `applyViewState` (`:1440-1480`), the chrome click handler (`:1229-1242`), `setStoryOpen` (`:385`)

**Interfaces:**
- Consumes: `loadStoryData`, `storyToOpen`, `listed` (Task 2); `ViewState.story/stop` (Task 3)
- Produces, inside `main.ts`:
  - `storyCache: Map<string, Promise<StoryData>>`, read through `story(id)`
  - `places: Map<string, number>` — the stop each story was left at this visit
  - `switchStory(id: string): Promise<void>` — makes `id` the current story, keeping the old one's place
  - `readStory(id: string, fromStart: boolean): Promise<void>` — what a Stories card calls
  - click action `open-story` with `data-story` and `data-from="place" | "start"` (Task 5 draws the buttons)

This task has no unit test of its own: every piece is `main.ts` wiring around state the earlier tasks test. It is checked in the browser in Step 3, and by the layout state added in Task 7.

- [ ] **Step 1: Hold stories by id, and switch between them**

Beside the startup load:

```ts
  const storyCache = new Map<string, Promise<StoryData>>();
  const story = (id: string): Promise<StoryData> => {
    if (!storyCache.has(id)) storyCache.set(id, loadStoryData(id));
    return storyCache.get(id)!;
  };
  // The stop each story was left at, for this visit.
  const places = new Map<string, number>();

  let storyId = storyToOpen(listed, parseUrlState().story ?? null);
  let storyData = await story(storyId);
```

```ts
  /** Makes `id` the current story, remembering where the one it replaces was left. */
  async function switchStory(id: string): Promise<void> {
    if (id === storyId) return;
    places.set(storyId, storyStopIndex());
    const next = await story(id);
    storyId = id;
    storyData = next;
    resolvedStops = resolveStory();
    stopElements = renderStoryPanel(storyContent, storyData.stops);
    lastSyncedStopId = null;
  }
```

`reloadStory` and the hot-reload listener drop the cached copy first: `storyCache.delete(id)`.

`setStoryOpen(false)` also records the place: after `heldStop = storyStopIndex();` add `places.set(storyId, heldStop);`.

- [ ] **Step 2: Route links and cards through `switchStory`**

`restoreFromUrl` loads the named story before applying the view, so the apply stays synchronous inside `applyingExternalState`:

```ts
  async function restoreFromUrl(): Promise<void> {
    const next = resolveViewState(/* unchanged */);
    if (next.mode === 'story') await switchStory(storyToOpen(listed, next.story));
    applyingExternalState(() => applyViewState(next));
    markViewSettled();
  }
```

Its two callers `await` it (startup) or call it without awaiting (the hash-change subscription).

The Stories card action, in `onChromeClick` beside `restart`:

```ts
    if (action === 'open-story') {
      const card = target.closest<HTMLElement>('[data-story]')!;
      return void readStory(card.dataset.story!, card.dataset.from === 'start');
    }
```

```ts
  /** Opens a story from the Stories panel: where it was left this visit, or its start. */
  async function readStory(id: string, fromStart: boolean): Promise<void> {
    const left = id === storyId ? storyStopIndex() : (places.get(id) ?? 0);
    await switchStory(id);
    readerOpensStory(fromStart ? 0 : left);
  }
```

- [ ] **Step 3: Check in the browser**

On the dev server: `#story=sample&stop=close` opens the sample's second stop; editing the hash to `#story=tour&stop=intro` swaps the text back to the tour. The checks that need the cards come in Task 5, Step 5.

- [ ] **Step 4: Run all tests and the typecheck, then commit**

```bash
npx vitest run && npx tsc --noEmit
npm run format && git add -A && git commit -m "Switch between stories, keeping each one's place"
```

---

### Task 5: The Stories panel lists every story; the menu names the current one

**Files:**
- Modify: `src/storiesPanel.ts`, `src/menu.ts`
- Modify: `src/main.ts` — `storyPlace` (`:393`), `applyFrame` (`:405-425`)
- Modify: `src/styles/` — the file holding `.story-card` (find with `grep -rln story-card src/styles`) for the draft tag
- Test: `src/__tests__/unit/storiesPanel.test.ts`, `src/__tests__/unit/menu.test.ts`

**Interfaces:**
- Consumes: `StoryData.title/description` (Task 1), `listed`, `story(id)`, `places`, `readStory` via action `open-story` (Task 4)
- Produces:
  - `interface StoryCard { id: string; title: string; description: string; draft: boolean; place: (StoryPlace & { label: string }) | null }`
  - `storiesHtml(cards: StoryCard[]): string`
  - `menuHtml(place: StoryPlace & { title: string }): string`

- [ ] **Step 1: Write the failing tests**

Replace `storiesPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { storiesHtml, type StoryCard } from '../../storiesPanel';

const card = (over: Partial<StoryCard>): StoryCard => ({
  id: 'tour',
  title: 'The guided tour',
  description: 'What the map shows.',
  draft: false,
  place: null,
  ...over,
});

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const actions = (el: Element) =>
  [...el.querySelectorAll<HTMLElement>('button[data-action]')].map(
    (b) => `${b.dataset.action}:${b.closest<HTMLElement>('[data-story]')?.dataset.story}:${b.dataset.from}`,
  );

describe('storiesHtml', () => {
  it('draws a card per story, in order, with its title and description', () => {
    const div = parse(storiesHtml([card({}), card({ id: 'job', title: 'Job' })]));
    const cards = [...div.querySelectorAll<HTMLElement>('.story-card')];
    expect(cards.map((c) => c.dataset.story)).toEqual(['tour', 'job']);
    expect(cards[0].textContent).toContain('What the map shows.');
  });

  it('offers a story not yet read from its start', () => {
    expect(actions(parse(storiesHtml([card({})])))).toEqual(['open-story:tour:start']);
  });

  it('offers a story already read from where it was left, or again from the start', () => {
    const div = parse(
      storiesHtml([card({ place: { number: 7, total: 21, label: "Abraham's call" } })]),
    );
    expect(div.textContent).toContain('7 of 21');
    expect(div.textContent).toContain("Abraham's call");
    expect(actions(div)).toEqual(['open-story:tour:place', 'open-story:tour:start']);
  });

  it('tags a draft', () => {
    expect(parse(storiesHtml([card({ draft: true })])).querySelector('.story-draft')).not.toBeNull();
    expect(parse(storiesHtml([card({})])).querySelector('.story-draft')).toBeNull();
  });

  it('escapes what the story file says', () => {
    const div = parse(
      storiesHtml([
        card({
          title: '<img src=x>',
          description: '<img src=y>',
          place: { number: 1, total: 1, label: '<img src=z>' },
        }),
      ]),
    );
    expect(div.querySelector('img')).toBeNull();
  });
});
```

In `menu.test.ts`, the first test becomes:

```ts
  it('offers the current story first, by name, with where it is', () => {
    const [first] = items(menuHtml({ number: 7, total: 21, title: 'The guided tour' }));
    expect(first.dataset.action).toBe('story');
    expect(first.textContent).toContain('Continue The guided tour');
    expect(first.textContent).toContain('7/21');
  });

  it("escapes the story's title", () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml({ number: 1, total: 2, title: '<img src=x>' });
    expect(div.querySelector('img')).toBeNull();
  });
```

and the other `menuHtml(...)` calls gain `title: 'x'`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/__tests__/unit/storiesPanel.test.ts src/__tests__/unit/menu.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`storiesPanel.ts`:

```ts
import { PANEL_TITLES } from './frame.ts';
import { escapeHtml } from './utils/html.ts';
import type { StoryPlace } from './menu.ts';

export interface StoryCard {
  id: string;
  title: string;
  description: string;
  draft: boolean;
  /** Where the reader left it this visit; null if they have not opened it. */
  place: (StoryPlace & { label: string }) | null;
}

const button = (from: 'place' | 'start', label: string, secondary = false): string =>
  `<button type="button" class="story-card-action${secondary ? ' secondary' : ''}" ` +
  `data-action="open-story" data-from="${from}">${label}</button>`;

function cardHtml(card: StoryCard): string {
  const place = card.place;
  return `
    <div class="story-card" data-story="${escapeHtml(card.id)}">
      <h3>${escapeHtml(card.title)}${card.draft ? ' <span class="story-draft">draft</span>' : ''}</h3>
      <p class="story-card-description">${escapeHtml(card.description)}</p>
      ${place ? `<p class="story-card-place">Stop ${place.number} of ${place.total}: ${escapeHtml(place.label)}</p>` : ''}
      <div class="story-card-actions">
        ${place ? button('place', 'Continue') + button('start', 'Start from the beginning', true) : button('start', 'Read')}
      </div>
    </div>`;
}

/** The stories on offer, in the index's order. Each keeps its place for the visit. */
export function storiesHtml(cards: StoryCard[]): string {
  return `<h2 class="panel-title">${escapeHtml(PANEL_TITLES.stories)}</h2>${cards.map(cardHtml).join('')}`;
}
```

`menu.ts`:

```ts
export function menuHtml(place: StoryPlace & { title: string }): string {
  return [
    '<h2 class="menu-title">Torahmap</h2>',
    item('story', `Continue ${escapeHtml(place.title)}`, `${place.number}/${place.total}`),
    // …unchanged
  ].join('');
}
```

`main.ts`: `menuHtml({ ...storyPlace(), title: storyData.title ?? storyId })`. In `applyFrame`, the Stories branch calls `drawStories()`:

```ts
  /** Fills the Stories panel once every listed story has been read for its title. */
  async function drawStories(): Promise<void> {
    const cards = await Promise.all(
      listed.map(async ({ id, draft }): Promise<StoryCard> => {
        const data = await story(id);
        const at = id === storyId ? storyStopIndex() : places.get(id);
        return {
          id,
          draft: !!draft,
          title: data.title ?? id,
          description: data.description ?? '',
          place:
            at === undefined
              ? null
              : { ...stopAt(data.stops, at), total: data.stops.length, label: stopLabel(data.stops[at]) },
        };
      }),
    );
    if (frame.open === 'stories') storiesPanel.innerHTML = storiesHtml(cards);
  }
```

The current story always has a place: it is the one the page opened on. Remove the old `action === 'story'` / `'restart'` handling only if nothing else emits them — the menu's first item still uses `story`; `restart` goes.

CSS, beside `.story-card`:

```css
.story-draft {
  font-size: 0.7em;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.4em;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: 0.7;
  vertical-align: middle;
}

.story-card-description {
  margin: 0.25em 0 0.5em;
}
```

Adjust to match the neighbouring rules' units and colour tokens.

- [ ] **Step 4: Run all tests and the typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Check in the browser** — the checks deferred from Task 4:
- The Stories panel shows the tour (with its place) and the sample (with the draft tag and Read).
- Tour at stop 7 → Read the sample → menu reads "Continue A short sample 1/2" → Stories → Continue the tour resumes at stop 7.
- Browser Back from the sample to the tour swaps the text as well as the camera.

- [ ] **Step 6: Commit**

```bash
npm run format && git add -A && git commit -m "List every story, and name the current one in the menu"
```

---

### Task 6: Telemetry names the story

**Files:**
- Modify: `src/telemetry/schema.ts` (`EVENTS`), `src/analytics.ts` (four track functions), `src/main.ts` (their callers)
- Modify: `scripts/telemetry/story-reach.sql`, `story-exits.sql`, `story-returns.sql`
- Test: `src/__tests__/unit/telemetry/analytics.test.ts`, `schema.test.ts` (and `queries.test.ts` checks the SQL)

**Interfaces:**
- Produces:
  - `trackPageView(story: string, stop: string, referrer: string)`
  - `trackStoryStop(story: string, stopId: string, stopNumber: number, totalStops: number)`
  - `trackStoryExit(story: string, stopId: string, stopNumber: number, how: ExitHow)`
  - `trackStoryReturn(story: string, stopId: string, how: ReturnHow)`

- [ ] **Step 1: Write the failing tests**

In `analytics.test.ts`, update the existing calls to the new argument order and add:

```ts
  it('sends a stop once per story, though two stories share its id', () => {
    trackStoryStop('tour', 'intro', 1, 9);
    trackStoryStop('job', 'intro', 1, 4);
    trackStoryStop('tour', 'intro', 1, 9);
    expect(sent().map((e) => `${e.fields.story}/${e.fields.stop_id}`)).toEqual([
      'tour/intro',
      'job/intro',
    ]);
  });
```

In `schema.test.ts`, the `story_stop` data-point expectation gains `story` as the last blob (`…, 'abraham', 'tour'`) with `story: 'tour'` in its fields.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/__tests__/unit/telemetry`
Expected: FAIL.

- [ ] **Step 3: Implement**

`schema.ts`:

```ts
  page_view: { blobs: ['story_stop', 'referrer', 'story'], doubles: [] },
  story_stop: { blobs: ['stop_id', 'story'], doubles: ['stop_number', 'total_stops'] },
  story_exit: { blobs: ['stop_id', 'how', 'story'], doubles: ['stop_number'] },
  story_return: { blobs: ['stop_id', 'how', 'story'], doubles: [] },
```

`analytics.ts`: each function takes `story` first and passes it in `fields`; `trackStoryStop` dedupes on `` `${story}/${stopId}` ``.

`main.ts`: pass `storyId` in `setDriver` and `arriveAtStop`; the page view is `trackPageView(url.story ?? '', url.stop ?? '', referrer)` where `url = parseUrlState()`.

SQL (blob7 is `story` for `story_stop`; blob8 for the other two):

`story-reach.sql`:
```sql
SELECT blob7 AS story, double1 AS stop_number, blob6 AS stop_id, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'story_stop' AND {{SITE}}
GROUP BY story, stop_number, stop_id
ORDER BY story, stop_number
```

`story-exits.sql`:
```sql
SELECT blob8 AS story, double1 AS stop_number, blob6 AS stop_id, blob7 AS how, SUM(_sample_interval) AS exits
FROM torahmap_events
WHERE blob1 = 'story_exit' AND {{SITE}}
GROUP BY story, stop_number, stop_id, how
ORDER BY story, stop_number, how
```

`story-returns.sql`:
```sql
SELECT blob8 AS story, blob6 AS stop_id, blob7 AS how, SUM(_sample_interval) AS returns
FROM torahmap_events
WHERE blob1 = 'story_return' AND {{SITE}}
GROUP BY story, stop_id, how
ORDER BY returns DESC
```

- [ ] **Step 4: Run all tests and the typecheck, then commit**

```bash
npx vitest run && npx tsc --noEmit
npm run format && git add -A && git commit -m "Name the story in every story event"
```

---

### Task 7: Layout tests, screenshots and the PR

**Files:**
- Modify: `layout/app.ts` (story hashes, the Stories panel state, a sample-story state)

- [ ] **Step 1: Update the states**

- `story=intro` → `story=tour&stop=intro`; `story=abraham_call` → `story=tour&stop=abraham_call` (every occurrence).
- `stories-panel`: `shown: ['.story-card[data-story="tour"]', '.story-card[data-story="sample"]']`.
- Add:

```ts
  {
    name: 'story-sample',
    hash: 'story=sample&stop=book',
    shown: [stop('book')],
  },
```

- [ ] **Step 2: Run the layout tests**

Run: `npm run test:layout`
Expected: PASS, or only failures already listed in `layout/known.ts`. Open `layout-report/index.html` and read the PNGs for `stories-panel`, `story-menu-down` (phone width especially, for the longer menu item) and `story-sample`.

- [ ] **Step 3: Commit the screenshots, push and open the PR**

Commit the screenshots for those three states from `layout-report/shots/`, push, and open a PR against main with `Closes #235` and `Part of #232`, embedding them by commit-pinned URL. Say in the PR: the tour's description is a draft to rewrite; on the `workers.dev` preview the sample story is listed with a draft tag, and on torahmap.org it will not be.
