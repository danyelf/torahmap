# Scripted Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a scripted, timed walk through the map to an MP4, and rehearse
the script live to set its times.

**Architecture:** Everything lives in `video/`. A text script (story.md's
comment syntax) and a times file are compiled to a timeline of scenes by pure
functions. A Node renderer drives the real app in headless Chromium on
Playwright's fake clock — writing the URL, scrolling the story, clicking and
typing — and pipes a screenshot per frame into `ffmpeg`. A rehearsal page runs
the same scenes in an iframe in real time and records when you press Space.

**Tech Stack:** TypeScript run directly by Node 24 (type stripping), Playwright
1.58 (`page.clock`), ffmpeg (installed at `/opt/homebrew/bin/ffmpeg`), Vite dev
server, Vitest.

**Spec:** `docs/plans/2026-09-27-video-harness-design.md`

## Global Constraints

- Nothing under `src/` changes. `video/` may *import* pure functions from
  `src/` (`lerpCamera`, `easingFunctions`), so a glide eases exactly as the
  app's own camera does.
- Files under `video/` are run by Node without a build step: every import names
  its `.ts` extension, and type-only imports use `import type`.
- The renderer starts its own dev server (port `VIDEO_PORT`, default 5198); it
  never reuses one already running.
- The browser launch arguments are the layout tests' (`layout/playwright.config.ts`).
  Reduced motion stays **off**: the video should show the app's motion.
- Comments follow AGENTS.md: present tense, no ticket or stage references, only
  what the code cannot say.

## Review Focus

1. A times file missing a scene, out of order, or too short for a scene's glide
   or steps must stop with an error naming the scene — never render a wrong
   video for an hour. (Task 2 tests.)
2. A `story:` scene naming a stop that is not in `story.md`, or a frame too
   narrow for the story to scroll, must fail before the first frame. (Task 3.)
3. A `click "text"` whose text is not on screen must fail within seconds,
   naming the scene, not hang. (Task 4.)
4. Hebrew — nikkud included — in `type "…"` and in unencoded `view:` values
   must reach the app unchanged. (Task 1 and Task 2 tests.)
5. A glide into a scene with a pinned verse must end on the verse, with the
   verse pinned, and must not flash it pinned mid-glide. (Task 2 test, Task 3
   check.)

---

## File Structure

| File | Responsibility |
|---|---|
| `video/script.ts` | Parse a script file into scenes. Pure. |
| `video/timeline.ts` | Times → segments; which scene is on at a second; camera glide; `do:` step schedule. Pure. |
| `video/inPage.ts` | Self-contained functions run inside the app's page: stop scroll positions, holding CSS animations. |
| `video/capture.ts` | Turn the app's URL hash into a scene line. Pure. |
| `video/browser.ts` | Launch Chromium, open the map, measure pinned-verse cameras. |
| `video/render.ts` | CLI: dev server, frame loop, ffmpeg. |
| `video/rehearse.html`, `video/rehearse.ts` | Rehearsal page and capture button. |
| `video/scripts/sample.md`, `video/scripts/sample.times.json` | A short script exercising every scene kind. |
| `video/__tests__/*.test.ts` | Vitest tests for the pure modules. |
| `video/tsconfig.json` | Typechecks `video/` with Node types. |

Modified: `package.json` (scripts), `vitest.config.ts` (include),
`.gitignore` (`video/out/`), `CLAUDE.md` (one line under Project Structure).

---

### Task 1: Script parser and the `video/` scaffolding

**Files:**
- Create: `video/tsconfig.json`, `video/script.ts`, `video/__tests__/script.test.ts`
- Modify: `vitest.config.ts` (the `include` line), `package.json` (`typecheck`), `.gitignore`

**Interfaces:**
- Produces:
  ```ts
  export type Step =
    | { kind: 'click'; text: string }
    | { kind: 'type'; text: string }
    | { kind: 'press'; key: string }
    | { kind: 'wait'; seconds: number };
  export type StoryScene = { id: string; narration: string; kind: 'story'; stop: string; over: number };
  export type ViewScene = { id: string; narration: string; kind: 'view'; params: Record<string, string>; over: number };
  export type DoScene = { id: string; narration: string; kind: 'do'; steps: Step[] };
  export type Scene = StoryScene | ViewScene | DoScene;
  export interface Script { width: number; height: number; fps: number; scenes: Scene[] }
  export const DEFAULT_OVER_S = 1.5;
  export function parseScript(markdown: string): Script;
  ```

- [ ] **Step 1: Scaffolding**

`video/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["."]
}
```

In `vitest.config.ts` change `include: ['src/**/*.test.ts'],` to
`include: ['src/**/*.test.ts', 'video/**/*.test.ts'],`.

In `package.json`, append ` && tsc --project video/tsconfig.json --noEmit` to
the `typecheck` script.

Append to `.gitignore`:
```
# Rendered video (npm run video)
video/out/
```

- [ ] **Step 2: Write the failing tests** — `video/__tests__/script.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseScript, DEFAULT_OVER_S } from '../script.ts';

const SCRIPT = `---
size: 1280x720
fps: 30
---

<!-- scene: open | story: intro -->
The Tanakh has almost twenty-three thousand verses.

<!-- scene: torah | story: intro_fivebooks | over: 3s -->
The Five Books.
<!-- a note to self, not narration -->

<!-- scene: tool | view: overlay=search&q=אַבְרָם,יצחק&zoom=0.39&x=2832.5&y=500 -->

<!-- scene: add | do: click "+ add a word"; type "יִצְחָק; x"; press Enter; wait 0.5s -->
`;

describe('parseScript', () => {
  it('reads the frame size and rate', () => {
    const s = parseScript(SCRIPT);
    expect([s.width, s.height, s.fps]).toEqual([1280, 720, 30]);
  });

  it('defaults to 1920x1080 at 60 frames a second', () => {
    const s = parseScript('<!-- scene: a | story: intro -->');
    expect([s.width, s.height, s.fps]).toEqual([1920, 1080, 60]);
  });

  it('reads a story scene, with its glide time', () => {
    const [open, torah] = parseScript(SCRIPT).scenes;
    expect(open).toMatchObject({ id: 'open', kind: 'story', stop: 'intro', over: DEFAULT_OVER_S });
    expect(torah).toMatchObject({ kind: 'story', stop: 'intro_fivebooks', over: 3 });
  });

  it('keeps the prose after a scene as its narration, without other comments', () => {
    const [open, torah] = parseScript(SCRIPT).scenes;
    expect(open.narration).toBe('The Tanakh has almost twenty-three thousand verses.');
    expect(torah.narration).toBe('The Five Books.');
  });

  it('reads a view scene as URL parameters, Hebrew and nikkud unchanged', () => {
    const tool = parseScript(SCRIPT).scenes[2];
    expect(tool).toMatchObject({
      kind: 'view',
      params: { overlay: 'search', q: 'אַבְרָם,יצחק', zoom: '0.39', x: '2832.5', y: '500' },
    });
  });

  it('reads do steps, keeping a semicolon inside quotes', () => {
    const add = parseScript(SCRIPT).scenes[3];
    expect(add).toMatchObject({
      kind: 'do',
      steps: [
        { kind: 'click', text: '+ add a word' },
        { kind: 'type', text: 'יִצְחָק; x' },
        { kind: 'press', key: 'Enter' },
        { kind: 'wait', seconds: 0.5 },
      ],
    });
  });

  it('refuses a scene with no kind, or two', () => {
    expect(() => parseScript('<!-- scene: a | over: 2s -->')).toThrow(/scene "a"/);
    expect(() => parseScript('<!-- scene: a | story: x | view: zoom=2 -->')).toThrow(/scene "a"/);
  });

  it('refuses a step it does not know', () => {
    expect(() => parseScript('<!-- scene: a | do: dance "x" -->')).toThrow(/scene "a".*dance/);
  });

  it('refuses a repeated scene name, and the name "end"', () => {
    expect(() =>
      parseScript('<!-- scene: a | story: x -->\n<!-- scene: a | story: y -->'),
    ).toThrow(/"a".*twice/);
    expect(() => parseScript('<!-- scene: end | story: x -->')).toThrow(/end/);
  });

  it('refuses a script with no scenes', () => {
    expect(() => parseScript('just words')).toThrow(/no scenes/);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run video/__tests__/script.test.ts`
Expected: FAIL, cannot resolve `../script.ts`.

- [ ] **Step 4: Implement** — `video/script.ts`

```ts
// A video script: the comment syntax of public/data/story.md, one comment per
// scene, and the prose after it the narration. See
// docs/plans/2026-09-27-video-harness-design.md.

export type Step =
  | { kind: 'click'; text: string }
  | { kind: 'type'; text: string }
  | { kind: 'press'; key: string }
  | { kind: 'wait'; seconds: number };

interface SceneBase {
  id: string;
  narration: string;
}
export type StoryScene = SceneBase & { kind: 'story'; stop: string; over: number };
export type ViewScene = SceneBase & { kind: 'view'; params: Record<string, string>; over: number };
export type DoScene = SceneBase & { kind: 'do'; steps: Step[] };
export type Scene = StoryScene | ViewScene | DoScene;

export interface Script {
  width: number;
  height: number;
  fps: number;
  scenes: Scene[];
}

export const DEFAULT_OVER_S = 1.5;

const SCENE_RE = /<!--\s*scene:\s*([^|>]+?)\s*(?:\|([\s\S]*?))?\s*-->/g;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const STEP_RE = /^(\w+)\s+(?:"([^"]*)"|(\S+))$/;

export function parseScript(markdown: string): Script {
  const front = markdown.match(FRONTMATTER_RE);
  const settings = front ? parseSettings(front[1]) : {};
  const body = front ? markdown.slice(front[0].length) : markdown;

  const size = settings.size ?? '1920x1080';
  const [width, height] = size.split('x').map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`size must be WIDTHxHEIGHT, not "${size}"`);
  const fps = Number(settings.fps ?? 60);
  if (!(fps > 0)) throw new Error(`fps must be a positive number, not "${settings.fps}"`);

  const matches = [...body.matchAll(SCENE_RE)];
  if (matches.length === 0) throw new Error('the script has no scenes');

  const scenes = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
    const narration = body
      .slice(start, end)
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    return parseScene(m[1], parseParams(m[2] ?? ''), narration);
  });

  const seen = new Set<string>();
  for (const { id } of scenes) {
    if (id === 'end') throw new Error('"end" names the end of the video; call the scene something else');
    if (seen.has(id)) throw new Error(`scene "${id}" is named twice`);
    seen.add(id);
  }
  return { width, height, fps, scenes };
}

function parseSettings(block: string): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) settings[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return settings;
}

function parseParams(source: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of source.split('|')) {
    const colon = part.indexOf(':');
    if (colon > 0) params[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return params;
}

function parseScene(id: string, params: Record<string, string>, narration: string): Scene {
  const kinds = (['story', 'view', 'do'] as const).filter((k) => k in params);
  if (kinds.length !== 1) {
    throw new Error(`scene "${id}" needs exactly one of story:, view: or do:`);
  }
  const over = params.over === undefined ? DEFAULT_OVER_S : parseSeconds(params.over, id);
  switch (kinds[0]) {
    case 'story':
      return { id, narration, kind: 'story', stop: params.story, over };
    case 'view':
      return {
        id,
        narration,
        kind: 'view',
        params: Object.fromEntries(new URLSearchParams(params.view)),
        over,
      };
    case 'do':
      return { id, narration, kind: 'do', steps: splitSteps(params.do).map((s) => parseStep(s, id)) };
  }
}

function parseSeconds(value: string, id: string): number {
  const m = value.match(/^(\d+(?:\.\d+)?)s?$/);
  if (!m) throw new Error(`scene "${id}": "${value}" is not a number of seconds`);
  return Number(m[1]);
}

/** Splits on semicolons, except inside double quotes. */
function splitSteps(source: string): string[] {
  const steps: string[] = [];
  let current = '';
  let quoted = false;
  for (const ch of source) {
    if (ch === '"') quoted = !quoted;
    if (ch === ';' && !quoted) {
      steps.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  steps.push(current);
  return steps.map((s) => s.trim()).filter(Boolean);
}

function parseStep(source: string, id: string): Step {
  const m = source.match(STEP_RE);
  const [verb, quoted, bare] = m ? [m[1], m[2], m[3]] : [source, undefined, undefined];
  if (verb === 'click' && quoted !== undefined) return { kind: 'click', text: quoted };
  if (verb === 'type' && quoted !== undefined) return { kind: 'type', text: quoted };
  if (verb === 'press' && bare !== undefined) return { kind: 'press', key: bare };
  if (verb === 'wait' && bare !== undefined) return { kind: 'wait', seconds: parseSeconds(bare, id) };
  throw new Error(
    `scene "${id}": cannot read the step "${source}" — expected click "…", type "…", press Key or wait 1s`,
  );
}
```

- [ ] **Step 5: Run the tests, typecheck and format**

Run: `npx vitest run video/__tests__/script.test.ts && npm run typecheck && npx prettier --write video`
Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add video vitest.config.ts package.json .gitignore
git commit -m "Parse video scripts: story, view and do scenes with narration"
```

---

### Task 2: Timeline

**Files:**
- Create: `video/timeline.ts`, `video/__tests__/timeline.test.ts`

**Interfaces:**
- Consumes: `Script`, `Scene`, `ViewScene`, `Step` from `video/script.ts`;
  `lerpCamera`, `easingFunctions` from `src/scrollytelling/interpolation.ts`.
- Produces:
  ```ts
  export interface Camera { x: number; y: number; zoom: number }
  export type Times = Record<string, number>;          // scene id → start second; plus "end"
  export interface Segment { scene: Scene; previous: Scene | null; start: number; end: number }
  export type Action = { kind: 'click'; text: string } | { kind: 'key'; text: string } | { kind: 'press'; key: string };
  export interface TimedAction { at: number; action: Action }   // `at` seconds after the scene starts
  export const TYPE_INTERVAL_S: number;   // 0.08
  export const CLICK_PAUSE_S: number;     // 0.5
  export function buildTimeline(script: Script, times: Times): Segment[];
  export function segmentAt(timeline: Segment[], t: number): Segment;
  export function duration(timeline: Segment[]): number;
  export function glides(segment: Segment): boolean;
  export function transition(segment: Segment, t: number): number;   // eased 0..1
  export function cameraOf(params: Record<string, string>): Camera | null;
  export function viewHash(scene: ViewScene, from: Camera | null, to: Camera, p: number): string;
  export function doEvents(steps: Step[]): TimedAction[];
  ```

- [ ] **Step 1: Write the failing tests** — `video/__tests__/timeline.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseScript, type ViewScene } from '../script.ts';
import {
  buildTimeline,
  segmentAt,
  duration,
  glides,
  transition,
  cameraOf,
  viewHash,
  doEvents,
  TYPE_INTERVAL_S,
  CLICK_PAUSE_S,
} from '../timeline.ts';

const script = parseScript(`
<!-- scene: a | story: intro -->
<!-- scene: b | story: intro_fivebooks | over: 2s -->
<!-- scene: c | view: zoom=0.5&x=100&y=200 -->
<!-- scene: d | view: zoom=2&x=300&y=400&verse=Genesis.12.1 | over: 2s -->
<!-- scene: e | do: click "+ add a word"; type "אב" -->
`);
const times = { a: 0, b: 2, c: 5, d: 7, e: 10, end: 12 };

describe('buildTimeline', () => {
  it('gives each scene its start and the next one’s start as its end', () => {
    const t = buildTimeline(script, times);
    expect(t.map((s) => [s.scene.id, s.start, s.end])).toEqual([
      ['a', 0, 2],
      ['b', 2, 5],
      ['c', 5, 7],
      ['d', 7, 10],
      ['e', 10, 12],
    ]);
    expect(t[1].previous?.id).toBe('a');
    expect(duration(t)).toBe(12);
  });

  it('names every scene the times leave out', () => {
    expect(() => buildTimeline(script, { a: 0, b: 2, end: 12 })).toThrow(/c, d, e/);
  });

  it('refuses times that do not start at zero', () => {
    expect(() => buildTimeline(script, { ...times, a: 1 })).toThrow(/"a".*0/);
  });

  it('refuses a scene that starts no later than the one before', () => {
    expect(() => buildTimeline(script, { ...times, c: 2 })).toThrow(/"b"/);
  });

  it('refuses a glide longer than its scene', () => {
    expect(() => buildTimeline(script, { ...times, c: 3 })).toThrow(/"b".*2s/);
  });

  it('refuses steps that run past the end of their scene', () => {
    expect(() => buildTimeline(script, { ...times, end: 10.5 })).toThrow(/"e"/);
  });
});

describe('segmentAt', () => {
  const t = buildTimeline(script, times);
  it('finds the scene on screen at a second', () => {
    expect(segmentAt(t, 0).scene.id).toBe('a');
    expect(segmentAt(t, 4.99).scene.id).toBe('b');
    expect(segmentAt(t, 5).scene.id).toBe('c');
    expect(segmentAt(t, 11.9).scene.id).toBe('e');
  });
});

describe('glides and transition', () => {
  const t = buildTimeline(script, times);
  it('glides between two scenes of the same kind, and cuts otherwise', () => {
    expect(t.map(glides)).toEqual([false, true, false, true, false]);
  });
  it('eases from 0 to 1 over the glide, then holds at 1', () => {
    const b = t[1];
    expect(transition(b, 2)).toBe(0);
    expect(transition(b, 3)).toBeCloseTo(0.5);
    expect(transition(b, 4)).toBe(1);
    expect(transition(b, 4.5)).toBe(1);
  });
  it('has arrived at once in a scene that cuts', () => {
    expect(transition(t[2], 5)).toBe(1);
  });
  it('lets a scene that cuts be shorter than its glide time', () => {
    // c cuts in after a story scene, so its default 1.5s glide is never played.
    expect(() => buildTimeline(script, { ...times, d: 6 })).not.toThrow();
  });
});

describe('cameraOf', () => {
  it('reads x, y and zoom, zoom defaulting to 1', () => {
    expect(cameraOf({ x: '1', y: '2', zoom: '3' })).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(cameraOf({ x: '1', y: '2' })).toEqual({ x: 1, y: 2, zoom: 1 });
  });
  it('has no camera without both x and y', () => {
    expect(cameraOf({ verse: 'Genesis.1.1', zoom: '2' })).toBeNull();
  });
});

describe('viewHash', () => {
  const d = script.scenes[3] as ViewScene;
  const from = { x: 100, y: 200, zoom: 0.5 };
  const to = { x: 300, y: 400, zoom: 2 };

  it('holds back the verse until the camera arrives', () => {
    const mid = new URLSearchParams(viewHash(d, from, to, 0.5).slice(1));
    expect(mid.get('verse')).toBeNull();
    expect(Number(mid.get('x'))).toBe(200);
    expect(Number(mid.get('zoom'))).toBeCloseTo(1); // by ratio: 0.5 → 1 → 2
    const end = new URLSearchParams(viewHash(d, from, to, 1).slice(1));
    expect(end.get('verse')).toBe('Genesis.12.1');
    expect(Number(end.get('x'))).toBe(300);
  });

  it('goes straight to the scene with nothing to glide from', () => {
    const h = new URLSearchParams(viewHash(d, null, to, 0).slice(1));
    expect(h.get('verse')).toBe('Genesis.12.1');
  });

  it('keeps Hebrew intact through the URL', () => {
    const [s] = parseScript('<!-- scene: s | view: overlay=search&q=אַבְרָם&x=1&y=2 -->').scenes;
    const h = new URLSearchParams(viewHash(s as ViewScene, null, { x: 1, y: 2, zoom: 1 }, 1).slice(1));
    expect(h.get('q')).toBe('אַבְרָם');
  });
});

describe('doEvents', () => {
  it('types one letter at a time, after a pause for the click', () => {
    const e = script.scenes[4];
    if (e.kind !== 'do') throw new Error('expected a do scene');
    expect(doEvents(e.steps)).toEqual([
      { at: 0, action: { kind: 'click', text: '+ add a word' } },
      { at: CLICK_PAUSE_S, action: { kind: 'key', text: 'א' } },
      { at: CLICK_PAUSE_S + TYPE_INTERVAL_S, action: { kind: 'key', text: 'ב' } },
    ]);
  });

  it('keeps nikkud with nothing lost, and waits add time', () => {
    const events = doEvents([
      { kind: 'wait', seconds: 1 },
      { kind: 'type', text: 'אַ' },
    ]);
    expect(events[0].at).toBe(1);
    expect(events.map((e) => (e.action.kind === 'key' ? e.action.text : '')).join('')).toBe('אַ');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run video/__tests__/timeline.test.ts`
Expected: FAIL, cannot resolve `../timeline.ts`.

- [ ] **Step 3: Implement** — `video/timeline.ts`

```ts
// When each scene is on screen, and what it shows at a given second.

import { easingFunctions, lerpCamera } from '../src/scrollytelling/interpolation.ts';
import type { Scene, Script, Step, ViewScene } from './script.ts';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Scene id → the second it starts, plus `end`, when the video ends. */
export type Times = Record<string, number>;

export interface Segment {
  scene: Scene;
  previous: Scene | null;
  start: number;
  end: number;
}

export type Action =
  | { kind: 'click'; text: string }
  | { kind: 'key'; text: string }
  | { kind: 'press'; key: string };

/** An action `at` seconds after its scene starts. */
export interface TimedAction {
  at: number;
  action: Action;
}

export const TYPE_INTERVAL_S = 0.08;
export const CLICK_PAUSE_S = 0.5;

export function buildTimeline(script: Script, times: Times): Segment[] {
  const missing = [...script.scenes.map((s) => s.id), 'end'].filter(
    (id) => typeof times[id] !== 'number',
  );
  if (missing.length > 0) throw new Error(`the times file has no time for: ${missing.join(', ')}`);

  const first = script.scenes[0];
  if (times[first.id] !== 0) throw new Error(`the first scene, "${first.id}", must start at 0`);

  return script.scenes.map((scene, i) => {
    const start = times[scene.id];
    const end = i + 1 < script.scenes.length ? times[script.scenes[i + 1].id] : times.end;
    if (!(end > start)) {
      throw new Error(`scene "${scene.id}" starts at ${start}s, but what follows it starts at ${end}s`);
    }
    const segment = { scene, previous: i > 0 ? script.scenes[i - 1] : null, start, end };
    const needs =
      scene.kind === 'do' ? lastActionAt(scene.steps) : glides(segment) ? scene.over : 0;
    if (needs > end - start) {
      throw new Error(
        `scene "${scene.id}" needs ${needs}s, but lasts only ${end - start}s before what follows`,
      );
    }
    return segment;
  });
}

export function segmentAt(timeline: Segment[], t: number): Segment {
  let found = timeline[0];
  for (const segment of timeline) if (segment.start <= t) found = segment;
  return found;
}

export function duration(timeline: Segment[]): number {
  return timeline[timeline.length - 1].end;
}

/** A scene glides in from one of its own kind; any other change is a cut. */
export function glides(segment: Segment): boolean {
  return segment.scene.kind !== 'do' && segment.previous?.kind === segment.scene.kind;
}

/**
 * How far through its glide a scene is at `t`, eased: 0 at its start, 1 once
 * arrived. A scene that cuts has arrived from its first frame.
 */
export function transition(segment: Segment, t: number): number {
  const { scene } = segment;
  if (scene.kind === 'do' || !glides(segment) || scene.over <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (t - segment.start) / scene.over));
  return easingFunctions['ease-in-out'](linear);
}

export function cameraOf(params: Record<string, string>): Camera | null {
  if (params.x === undefined || params.y === undefined) return null;
  return { x: Number(params.x), y: Number(params.y), zoom: Number(params.zoom ?? 1) };
}

/**
 * The URL hash for `scene`, its camera `p` of the way from `from` to `to`. A
 * pinned verse centres the camera on itself, so the verse is held back until
 * the camera has arrived.
 */
export function viewHash(scene: ViewScene, from: Camera | null, to: Camera, p: number): string {
  const arrived = from === null || p >= 1;
  const camera = arrived ? to : lerpCamera(from, to, p);
  const params: Record<string, string> = {
    ...scene.params,
    x: String(camera.x),
    y: String(camera.y),
    zoom: String(camera.zoom),
  };
  if (!arrived) delete params.verse;
  return `#${new URLSearchParams(params).toString()}`;
}

export function doEvents(steps: Step[]): TimedAction[] {
  const events: TimedAction[] = [];
  let at = 0;
  for (const step of steps) {
    switch (step.kind) {
      case 'click':
        events.push({ at, action: { kind: 'click', text: step.text } });
        at += CLICK_PAUSE_S;
        break;
      case 'press':
        events.push({ at, action: { kind: 'press', key: step.key } });
        at += TYPE_INTERVAL_S;
        break;
      case 'type':
        for (const ch of step.text) {
          events.push({ at, action: { kind: 'key', text: ch } });
          at += TYPE_INTERVAL_S;
        }
        break;
      case 'wait':
        at += step.seconds;
        break;
    }
  }
  return events;
}

function lastActionAt(steps: Step[]): number {
  const events = doEvents(steps);
  return events.length > 0 ? events[events.length - 1].at : 0;
}
```

Note for the implementer: `for (const ch of text)` walks code points, so a
nikkud mark is typed as its own key after its letter — which is how a Hebrew
keyboard types it. The test checks the joined text survives.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run video/__tests__ && npm run typecheck && npx prettier --write video`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add video
git commit -m "Build a video timeline: scene times, glides and typed steps"
```

---

### Task 3: Renderer for story and view scenes

**Files:**
- Create: `video/inPage.ts`, `video/browser.ts`, `video/render.ts`,
  `video/scripts/sample.md`, `video/scripts/sample.times.json`
- Modify: `package.json` (add `"video": "node video/render.ts"`)

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces:
  ```ts
  // video/inPage.ts — each function is self-contained, so page.evaluate can send it into the page
  export function restingScrollTops(doc?: Document): Record<string, number> | null;
  export function holdCssAnimations(): void;
  // video/browser.ts
  export const LAUNCH_ARGS: string[];
  export function launch(): Promise<Browser>;
  export function openMap(browser: Browser, url: string, width: number, height: number, fakeClock: boolean): Promise<Page>;
  export function measureCameras(browser: Browser, baseUrl: string, script: Script): Promise<Map<string, Camera>>;
  ```

- [ ] **Step 1: In-page functions** — `video/inPage.ts`

```ts
// Functions run inside the app's page. Each is self-contained — no imports, no
// outer variables — because page.evaluate sends a function as its source text.

/**
 * The scroll position at which the story rests on each stop, by stop id: the
 * stop's middle at the middle of the story, as computeStopScrollCenters in
 * src/scrollytelling/controller.ts places it. Null when the stops sit side by
 * side, as on a phone, where the story pages rather than scrolls.
 */
export function restingScrollTops(doc: Document = document): Record<string, number> | null {
  const content = doc.getElementById('story-content');
  const view = doc.defaultView ?? window;
  if (!content || view.getComputedStyle(content).display === 'flex') return null;
  const max = content.scrollHeight - content.clientHeight;
  const tops: Record<string, number> = {};
  for (const el of content.querySelectorAll<HTMLElement>('.story-stop')) {
    const centre = el.offsetTop + el.offsetHeight / 2 - content.clientHeight / 2;
    tops[el.dataset.stopId ?? ''] = Math.max(0, Math.min(max, centre));
  }
  return tops;
}

/**
 * Sets every CSS animation and transition to the fake clock's time. They run
 * on the browser's real clock, and a frame takes a third of a second of real
 * time to capture, so a short transition would otherwise finish between two
 * frames.
 */
export function holdCssAnimations(): void {
  const now = performance.now();
  for (const animation of document.getAnimations()) {
    const held = animation as Animation & { videoStart?: number };
    if (held.videoStart === undefined) {
      held.videoStart = now - Number(animation.currentTime ?? 0);
      animation.pause();
    }
    animation.currentTime = now - held.videoStart;
  }
}
```

- [ ] **Step 2: Browser helpers** — `video/browser.ts`

```ts
// Opening the map in headless Chromium, and what can only be learned by asking it.

import { chromium, type Browser, type Page } from 'playwright';
import type { Script } from './script.ts';
import { cameraOf, type Camera } from './timeline.ts';

/** As layout/playwright.config.ts: headless Chromium has no WebGL2 without software rendering. */
export const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export function launch(): Promise<Browser> {
  return chromium.launch({ args: LAUNCH_ARGS });
}

/**
 * Opens the map at `url` and waits until it has drawn and its fonts have
 * arrived. With `fakeClock`, time in the page moves only when the caller
 * advances it.
 */
export async function openMap(
  browser: Browser,
  url: string,
  width: number,
  height: number,
  fakeClock: boolean,
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: 'no-preference',
  });
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  if (fakeClock) await page.clock.install();
  await page.goto(url);

  const wait = (ms: number) => (fakeClock ? page.clock.runFor(ms) : page.waitForTimeout(ms));
  for (let i = 0; !(await page.locator('html[data-map-ready]').count()); i++) {
    if (i === 300) throw new Error('the map did not start within 30 seconds');
    await wait(100);
  }
  await page.evaluate(() => document.fonts.ready);
  await wait(1000);
  return page;
}

/**
 * The camera each view scene ends on. A scene that pins a verse leaves x and y
 * to the app, which centres the verse; unpinning it with Escape makes the app
 * write the camera it chose into the URL.
 */
export async function measureCameras(
  browser: Browser,
  baseUrl: string,
  script: Script,
): Promise<Map<string, Camera>> {
  const cameras = new Map<string, Camera>();
  let page: Page | null = null;
  for (const scene of script.scenes) {
    if (scene.kind !== 'view') continue;
    const given = cameraOf(scene.params);
    if (given) {
      cameras.set(scene.id, given);
      continue;
    }
    if (!scene.params.verse) {
      throw new Error(`scene "${scene.id}" needs x and y, or a verse to centre on`);
    }
    page ??= await openMap(browser, baseUrl, script.width, script.height, false);
    await page.evaluate((h) => (location.hash = h), `#${new URLSearchParams(scene.params)}`);
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const measured = cameraOf(
      Object.fromEntries(new URLSearchParams((await page.evaluate(() => location.hash)).slice(1))),
    );
    if (!measured) throw new Error(`scene "${scene.id}": could not read the camera for its verse`);
    cameras.set(scene.id, measured);
  }
  await page?.close();
  return cameras;
}
```

- [ ] **Step 3: Renderer** — `video/render.ts`

```ts
// Renders a video script to MP4, one screenshot per frame on a fake clock.
//
//   npm run video -- video/scripts/sample.md [--out file.mp4]
//     [--fps 10] [--scale 0.5] [--from 30] [--to 45]
//
// The times come from the file beside the script, sample.times.json. The last
// four options make a rough cut: fewer, smaller frames, of one stretch.

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Page } from 'playwright';
import { parseScript } from './script.ts';
import {
  buildTimeline,
  duration,
  glides,
  segmentAt,
  transition,
  viewHash,
  doEvents,
  type Camera,
  type Segment,
  type TimedAction,
} from './timeline.ts';
import { launch, measureCameras, openMap } from './browser.ts';
import { holdCssAnimations, restingScrollTops } from './inPage.ts';

const PORT = Number(process.env.VIDEO_PORT ?? 5198);
const BASE = `http://localhost:${PORT}/`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    fps: { type: 'string' },
    scale: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
  },
});
const scriptPath = positionals[0];
if (!scriptPath) throw new Error('usage: npm run video -- <script.md> [options]');

const script = parseScript(readFileSync(scriptPath, 'utf8'));
const timeline = buildTimeline(
  script,
  JSON.parse(readFileSync(scriptPath.replace(/\.md$/, '.times.json'), 'utf8')),
);
const fps = Number(values.fps ?? script.fps);
const scale = Number(values.scale ?? 1);
const from = Number(values.from ?? 0);
const to = Math.min(Number(values.to ?? Infinity), duration(timeline));
const out = values.out ?? join(dirname(scriptPath), '..', 'out', `${basename(scriptPath, '.md')}.mp4`);
mkdirSync(dirname(out), { recursive: true });

const server = await startServer();
const browser = await launch();
try {
  await render();
  console.log(`\nwrote ${out}`);
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}

async function render(): Promise<void> {
  const cameras = await measureCameras(browser, BASE, script);
  const page = await openMap(browser, BASE, script.width, script.height, true);
  const stopTops = await page.evaluate(restingScrollTops);
  checkStops(stopTops);

  const encoder = startEncoder(out, fps, scale);
  const scene = sceneDriver(page, cameras, stopTops ?? {});
  try {
    for (let frame = 0; frame / fps <= to; frame++) {
      const t = frame / fps;
      await scene.show(segmentAt(timeline, t), t);
      await page.clock.runFor(1000 / fps);
      if (t < from) continue;
      await page.evaluate(holdCssAnimations);
      await encoder.write(
        await page.screenshot(scale < 1 ? { type: 'jpeg', quality: 85 } : { type: 'png' }),
      );
      process.stdout.write(`\r${t.toFixed(1)}s of ${to.toFixed(1)}s`);
    }
    await encoder.finish();
  } catch (e) {
    encoder.abort();
    throw e;
  }
}

function checkStops(stopTops: Record<string, number> | null): void {
  const stories = script.scenes.filter((s) => s.kind === 'story');
  if (stories.length === 0) return;
  if (!stopTops) {
    throw new Error(`the story cannot scroll at ${script.width}x${script.height}; use a wider size`);
  }
  for (const s of stories) {
    if (!(s.stop in stopTops)) throw new Error(`scene "${s.id}": story.md has no stop "${s.stop}"`);
  }
}

/** Puts the page into the state `segment` has at `t`. */
function sceneDriver(page: Page, cameras: Map<string, Camera>, stopTops: Record<string, number>) {
  let current: Segment | null = null;
  let hash = '';
  let fromTop = 0;
  let fromCamera: Camera | null = null;
  let pending: TimedAction[] = [];

  const setHash = async (next: string) => {
    if (next === hash) return;
    hash = next;
    await page.evaluate((h) => (location.hash = h), next);
  };
  const storyTop = () =>
    page.evaluate(() => document.getElementById('story-content')?.scrollTop ?? 0);

  async function enter(segment: Segment): Promise<void> {
    const { scene } = segment;
    // The app rewrites the URL itself as it goes, so the last hash written
    // here says nothing about the page once a scene is over.
    hash = '';
    if (scene.kind === 'story') {
      if (!glides(segment)) {
        await setHash(`#story=${scene.stop}`);
        await page.clock.runFor(50);
      }
      fromTop = await storyTop();
    } else if (scene.kind === 'view') {
      const previous = segment.previous;
      fromCamera = glides(segment) && previous ? (cameras.get(previous.id) ?? null) : null;
    } else {
      pending = doEvents(scene.steps);
    }
  }

  return {
    async show(segment: Segment, t: number): Promise<void> {
      if (segment !== current) {
        current = segment;
        await enter(segment);
      }
      const { scene } = segment;
      const p = transition(segment, t);
      if (scene.kind === 'story') {
        const top = fromTop + (stopTops[scene.stop] - fromTop) * p;
        await page.evaluate((y) => {
          const content = document.getElementById('story-content');
          if (content && content.scrollTop !== y) content.scrollTop = y;
        }, top);
      } else if (scene.kind === 'view') {
        await setHash(viewHash(scene, fromCamera, cameras.get(scene.id)!, p));
      } else {
        while (pending.length > 0 && segment.start + pending[0].at <= t) {
          await act(page, scene.id, pending.shift()!);
        }
      }
    },
  };
}

async function act(page: Page, sceneId: string, { action }: TimedAction): Promise<void> {
  switch (action.kind) {
    case 'click': {
      // Playwright's own click waits for the element to hold still across
      // animation frames, which never come on a paused clock; clicking at the
      // element's centre does not wait.
      const box = await page
        .getByText(action.text, { exact: true })
        .first()
        .boundingBox({ timeout: 2000 })
        .catch(() => null);
      if (!box) throw new Error(`scene "${sceneId}": nothing on screen says "${action.text}"`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      break;
    }
    case 'key':
      await page.keyboard.type(action.text);
      break;
    case 'press':
      await page.keyboard.press(action.key);
      break;
  }
}

function startEncoder(file: string, rate: number, factor: number) {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(rate), '-i', '-'];
  if (factor !== 1) args.push('-vf', `scale=trunc(iw*${factor}/2)*2:-2`);
  args.push('-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '18', file);
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', (e) => reject(new Error(`could not run ffmpeg: ${e.message}`)));
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  return {
    write: (image: Buffer) =>
      new Promise<void>((resolve) => {
        if (ffmpeg.stdin.write(image)) resolve();
        else ffmpeg.stdin.once('drain', () => resolve());
      }),
    finish: async () => {
      ffmpeg.stdin.end();
      await done;
    },
    abort: () => {
      done.catch(() => {});
      ffmpeg.kill();
    },
  };
}

async function startServer(): Promise<ChildProcess> {
  const vite = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) return vite;
    await new Promise((r) => setTimeout(r, 300));
  }
  vite.kill();
  throw new Error(`the dev server did not answer on port ${PORT}`);
}
```

Note: `act` and the `do` branch are written here so the file is whole; Task 4
verifies them.

- [ ] **Step 4: Sample script** — `video/scripts/sample.md`

```markdown
---
size: 1920x1080
fps: 60
---

<!-- scene: open | story: intro -->
The Tanakh — the Hebrew Bible — has almost twenty-three thousand verses.

<!-- scene: torah | story: intro_fivebooks | over: 2s -->
The Five Books of the Torah run across the top.

<!-- scene: search | view: overlay=search&q=אברם&zoom=0.39&x=2832.5&y=500 -->
Outside the story, you can search for yourself.

<!-- scene: call | view: overlay=search&q=אברם&zoom=2.5&verse=Genesis.12.1 | over: 2s -->
Here God calls to Abram.

<!-- scene: isaac | do: click "+ add a word"; type "יצחק" -->
Add a second name, and both light up.
```

`video/scripts/sample.times.json`:
```json
{ "open": 0, "torah": 2, "search": 5, "call": 7, "isaac": 10.5, "end": 13 }
```

Add `"video": "node video/render.ts",` to `package.json` scripts, after `test:layout`.

- [ ] **Step 5: Typecheck and format**

Run: `npm run typecheck && npx prettier --write video package.json`
Expected: no errors.

- [ ] **Step 6: Render a rough cut and look at it**

Run: `npm run video -- video/scripts/sample.md --fps 10 --scale 0.5 --to 10`
Expected: ends with `wrote video/out/sample.mp4`, no page errors.

Pull frames and read them:
```bash
for s in 0.5 3 6 8 9.8; do ffmpeg -loglevel error -y -ss $s -i video/out/sample.mp4 -frames:v 1 video/out/at-$s.png; done
```
Read each PNG. Expect: 0.5 s the story's first stop; 3 s partway into the
Torah; 6 s explore mode, Abram search panel, map wide; 8 s mid-glide, **no
verse pinned**; 9.8 s Genesis 12:1 pinned and centred, sidebar showing it.

Then check a bad stop fails before any frame: copy the sample to
`video/out/nostop.md` with `story: intro_fivebooks` changed to
`story: no_such_stop`, copy the times beside it as `nostop.times.json`, and run
`npm run video -- video/out/nostop.md --fps 10 --scale 0.5`.
Expected: `scene "torah": story.md has no stop "no_such_stop"`, exit code 1,
no progress counter printed, and nothing left listening on port 5198.

- [ ] **Step 7: Commit**

```bash
git add video package.json
git commit -m "Render video scripts frame by frame: story and view scenes"
```

---

### Task 4: `do:` scenes and CSS motion

**Files:**
- Modify: none expected — `act`, `doEvents` and `holdCssAnimations` are already
  in place. Fix what the check below finds.

- [ ] **Step 1: Render the acted-out scene at full frame rate**

Run: `npm run video -- video/scripts/sample.md --from 10 --to 13 --out video/out/isaac.mp4`
Expected: `wrote video/out/isaac.mp4`.

- [ ] **Step 2: Check the typing and the panel**

```bash
for s in 0.2 0.7 0.9 2.5; do ffmpeg -loglevel error -y -ss $s -i video/out/isaac.mp4 -frames:v 1 video/out/isaac-$s.png; done
```
Read each PNG. Expect: 0.2 s a second search row appearing (if it animates in,
partway); 0.7 s `י` typed; 0.9 s `יצח`; 2.5 s both names coloured on the map.

If the letters land nowhere, because clicking "+ add a word" does not focus
the new row's input, stop and report it: there is no step yet that can aim at
an input with no text on it, and choosing how to add one is Danyel's call.

- [ ] **Step 3: Check a missing click fails fast**

Copy the sample to `video/out/bad.md` with `"+ add a word"` changed to
`"no such button"`, copy the times file beside it as `bad.times.json`, and run
`npm run video -- video/out/bad.md --fps 10 --scale 0.5`.
Expected: within a few seconds of reaching 10.5 s, the error
`scene "isaac": nothing on screen says "no such button"`, and the dev server
stops (check `lsof -i :5198` is empty).

- [ ] **Step 4: Commit any fixes**

```bash
git add video
git commit -m "Act out do: scenes in the rendered video"
```

---

### Task 5: Rehearsal page and capture

**Files:**
- Create: `video/capture.ts`, `video/__tests__/capture.test.ts`,
  `video/rehearse.html`, `video/rehearse.ts`
- Modify: `package.json` (add `"rehearse"`), `CLAUDE.md` (Project Structure)

**Interfaces:**
- Consumes: `parseScript`, `Scene` (Task 1); `cameraOf`, `viewHash`,
  `doEvents`, `transition`-style easing via `easingFunctions` (Task 2);
  `restingScrollTops` (Task 3).
- Produces:
  ```ts
  export function captureLine(name: string, hash: string): string;
  ```

- [ ] **Step 1: Write the failing test** — `video/__tests__/capture.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { captureLine } from '../capture.ts';
import { parseScript } from '../script.ts';

describe('captureLine', () => {
  it('captures a story stop', () => {
    expect(captureLine('s1', '#story=abraham_zoom')).toBe('<!-- scene: s1 | story: abraham_zoom -->');
  });

  it('captures a view, Hebrew readable, and parses back to the same state', () => {
    const hash = `#${new URLSearchParams({ overlay: 'search', q: 'אברם,יצחק', zoom: '2.5', x: '3320.5', y: '91.8' })}`;
    const line = captureLine('s2', hash);
    expect(line).toBe('<!-- scene: s2 | view: overlay=search&q=אברם,יצחק&zoom=2.5&x=3320.5&y=91.8 -->');
    const [scene] = parseScript(line).scenes;
    expect(scene).toMatchObject({ kind: 'view', params: { q: 'אברם,יצחק', x: '3320.5' } });
  });

  it('keeps a value encoded when it holds a character the URL needs', () => {
    const hash = `#${new URLSearchParams({ q: 'a&b' })}`;
    const [scene] = parseScript(captureLine('s3', hash)).scenes;
    expect(scene).toMatchObject({ params: { q: 'a&b' } });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run video/__tests__/capture.test.ts`
Expected: FAIL, cannot resolve `../capture.ts`.

- [ ] **Step 3: Implement** — `video/capture.ts`

```ts
// A scene line for the script from the app's URL hash.

export function captureLine(name: string, hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const story = params.get('story');
  if (story) return `<!-- scene: ${name} | story: ${story} -->`;
  const view = [...params]
    .map(([key, value]) => `${key}=${value.replace(/[&=+%#|]/g, encodeURIComponent)}`)
    .join('&');
  return `<!-- scene: ${name} | view: ${view} -->`;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run video/__tests__/capture.test.ts`
Expected: PASS.

- [ ] **Step 5: The page** — `video/rehearse.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Rehearse</title>
    <style>
      body {
        margin: 0;
        display: flex;
        height: 100vh;
        background: #111;
        color: #eee;
        font: 16px system-ui, sans-serif;
      }
      #stage {
        flex: 2;
        position: relative;
        overflow: hidden;
      }
      #app {
        border: 0;
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
      }
      #prompter {
        flex: 1;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: auto;
      }
      #now {
        font-size: 28px;
        line-height: 1.4;
      }
      #next {
        color: #888;
      }
      #captured {
        white-space: pre-wrap;
        font: 12px ui-monospace, monospace;
      }
    </style>
  </head>
  <body>
    <div id="stage"><iframe id="app" src="/"></iframe></div>
    <div id="prompter">
      <div id="status">Space: start · R: restart</div>
      <div id="now"></div>
      <div id="next"></div>
      <div>
        <button id="copy-times">Copy timings</button>
        <button id="capture">Capture</button>
      </div>
      <div id="captured"></div>
    </div>
    <script type="module" src="./rehearse.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: The page's script** — `video/rehearse.ts`

```ts
// Rehearsal: the app in an iframe, the narration beside it. Space moves to the
// next scene and notes the time; Copy timings hands over the times file.
//
//   npm run rehearse   (opens /video/rehearse.html?script=sample)

import { parseScript, type Scene } from './script.ts';
import { cameraOf, doEvents, viewHash } from './timeline.ts';
import { restingScrollTops } from './inPage.ts';
import { captureLine } from './capture.ts';
import { easingFunctions } from '../src/scrollytelling/interpolation.ts';

const name = new URLSearchParams(location.search).get('script') ?? 'sample';
const script = parseScript(await (await fetch(`/video/scripts/${name}.md`)).text());

const frame = document.querySelector<HTMLIFrameElement>('#app')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const status = document.querySelector<HTMLElement>('#status')!;
const now = document.querySelector<HTMLElement>('#now')!;
const next = document.querySelector<HTMLElement>('#next')!;
const captured = document.querySelector<HTMLElement>('#captured')!;

// The app is laid out at the video's size, then scaled to fit, so what you
// rehearse over is what renders.
frame.width = String(script.width);
frame.height = String(script.height);
function fit(): void {
  const scale = Math.min(stage.clientWidth / script.width, stage.clientHeight / script.height);
  frame.style.transform = `scale(${scale})`;
}
addEventListener('resize', fit);
fit();

let index = -1;
let startedAt = 0;
let times: Record<string, number> = {};
let playing = 0; // bumped to cancel a glide or steps still running

function advance(): void {
  const at = (performance.now() - startedAt) / 1000;
  if (index === -1) startedAt = performance.now();
  index++;
  if (index === script.scenes.length) {
    times.end = Math.round(at * 10) / 10;
    status.textContent = `Done: ${times.end}s. Copy timings, or R to go again.`;
    return;
  }
  const scene = script.scenes[index];
  times[scene.id] = index === 0 ? 0 : Math.round(at * 10) / 10;
  status.textContent = `Scene ${index + 1} of ${script.scenes.length}: ${scene.id}`;
  now.textContent = scene.narration;
  next.textContent = script.scenes[index + 1]?.narration.split('\n')[0] ?? '(last scene)';
  play(scene, script.scenes[index - 1] ?? null);
}

function restart(): void {
  index = -1;
  times = {};
  playing++;
  status.textContent = 'Space: start · R: restart';
  now.textContent = script.scenes[0].narration;
  next.textContent = '';
}

function play(scene: Scene, previous: Scene | null): void {
  const run = ++playing;
  const win = frame.contentWindow!;
  const doc = frame.contentDocument!;

  if (scene.kind === 'story') {
    if (previous?.kind !== 'story' || !win.location.hash.startsWith('#story=')) {
      win.location.hash = `#story=${scene.stop}`;
      return;
    }
    const top = restingScrollTops(doc)?.[scene.stop];
    if (top !== undefined) doc.getElementById('story-content')?.scrollTo({ top, behavior: 'smooth' });
    return;
  }

  if (scene.kind === 'view') {
    const to = cameraOf(scene.params);
    const from = previous?.kind === 'view' ? cameraOf(previous.params) : null;
    // Cut straight to the scene's own URL state when there is nothing to glide
    // from, or no camera to glide to: rehearsal does not measure verse cameras.
    if (!to || !from) {
      win.location.hash = `#${new URLSearchParams(scene.params)}`;
      return;
    }
    const began = performance.now();
    const step = () => {
      if (run !== playing) return;
      const linear = Math.min(1, (performance.now() - began) / 1000 / scene.over);
      win.location.hash = viewHash(scene, from, to, easingFunctions['ease-in-out'](linear));
      if (linear < 1) requestAnimationFrame(step);
    };
    step();
    return;
  }

  for (const { at, action } of doEvents(scene.steps)) {
    setTimeout(() => {
      if (run !== playing) return;
      if (action.kind === 'click') {
        const target = [...doc.querySelectorAll<HTMLElement>('body *')]
          .reverse()
          .find((el) => el.textContent?.trim() === action.text);
        target?.click();
      } else if (action.kind === 'key') {
        doc.execCommand('insertText', false, action.text);
      } else {
        doc.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: action.key, bubbles: true }),
        );
      }
    }, at * 1000);
  }
}

function onKey(e: KeyboardEvent): void {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (typing) return;
  if (e.key === ' ') {
    e.preventDefault();
    advance();
  } else if (e.key === 'r' || e.key === 'R') {
    restart();
  }
}
addEventListener('keydown', onKey);
frame.addEventListener('load', () => frame.contentWindow?.addEventListener('keydown', onKey));

let captures = 0;
document.querySelector('#capture')!.addEventListener('click', async () => {
  const line = captureLine(`shot${++captures}`, frame.contentWindow!.location.hash);
  captured.textContent += `${line}\n`;
  await navigator.clipboard.writeText(line);
});

document.querySelector('#copy-times')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(times, null, 2));
  status.textContent = 'Timings copied: save them beside the script as <name>.times.json';
});

restart();
```

- [ ] **Step 7: Scripts and docs**

`package.json` scripts, after `"video"`:
```json
"rehearse": "vite --open '/video/rehearse.html?script=sample'",
```

`CLAUDE.md`, under Project Structure after the `layout/` line:
```markdown
- `video/` — scripted video of the map: `npm run rehearse` to time a script
  against your narration, `npm run video -- <script.md>` to render it to MP4.
  See `docs/plans/2026-09-27-video-harness-design.md`.
```

- [ ] **Step 8: Typecheck, test, format**

Run: `npm run typecheck && npx vitest run video && npx prettier --write video package.json`
Expected: pass.

- [ ] **Step 9: Check the page in a real browser**

Start a dev server of your own (`npx vite --port 5197 --strictPort`, in the
background), then drive it with a throwaway Playwright script in the
scratchpad (not the extension browser: its tab is hidden, and rAF and
smooth scrolling stall there). The script should: open
`/video/rehearse.html?script=sample` at 1600×900 with clipboard permission;
press Space five times with a 2.5 s pause between; screenshot after the third
and fifth press; press Space once more; click **Copy timings** and print the
clipboard; click **Capture** and print the clipboard.

Read the screenshots. Expect: the app scaled into the left two thirds, the
narration for the current scene on the right; after the fifth press, a second
search row with `יצחק` in it. Expect the timings JSON to name all five scenes
and `end`, `open` at 0, each later than the last; and the capture to be a
`<!-- scene: shot1 | view: … -->` line that `parseScript` reads back.

Stop your dev server by its PID.

- [ ] **Step 10: Commit**

```bash
git add video package.json CLAUDE.md
git commit -m "Rehearse a video script against the narration, and capture scenes"
```

---

### Task 6: Open the pull request

- [ ] **Step 1:** `npm test && npm run typecheck && npm run build` — all pass,
  and `dist/` has no `video/` in it.
- [ ] **Step 2:** Commit two frames from the sample render (mid-glide and the
  typed search) to `docs/plans/images/`, then push and open a PR against main.
  In the body: what the harness does, what to try (`npm run rehearse`, then
  `npm run video -- video/scripts/sample.md --fps 10 --scale 0.5`), and the two
  frames embedded by commit-pinned URL. There is no issue to close.
