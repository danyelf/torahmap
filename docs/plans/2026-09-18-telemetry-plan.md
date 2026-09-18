# Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google Analytics with cookieless events sent through the site's Worker into Workers Analytics Engine, covering the story, where readers look in explore mode, word clicks and the Sefaria link.

**Architecture:** The page posts JSON to `/api/event` with `navigator.sendBeacon`, only on `torahmap.org`. A Worker script (`src/worker/index.ts`) validates it and writes one Analytics Engine data point, laid out by one shared schema (`src/telemetry/schema.ts`). A shell script runs saved SQL against the Analytics Engine SQL API.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Cloudflare Workers + static assets, Workers Analytics Engine, wrangler 4 (installed globally, not a dependency), bash + curl.

**Spec:** `docs/plans/2026-09-18-telemetry-design.md`

## Global Constraints

- No new npm dependencies. No `@cloudflare/workers-types`; the Worker declares the one binding method it uses.
- No cookies, no `localStorage`/`sessionStorage`; the visit id lives in memory only.
- Nothing is sent unless `location.hostname === 'torahmap.org'`. The Worker accepts only `Origin: https://torahmap.org`.
- IP addresses are never written.
- Analytics Engine dataset name: `torahmap_events`; binding name: `EVENTS`.
- Column layout: `index1` = visit id; `blob1` event, `blob2` mode, `blob3` country, `blob4` device; event fields from `blob5` and `double1`, in the order the schema lists them.
- Comments follow AGENTS.md: short, present tense, no ticket numbers in code.
- Each task leaves `npm run typecheck && npm test` green; the pre-commit hook enforces it.

## File map

- Create `src/telemetry/schema.ts` — event names, their fields in column order, and `toDataPoint()`. DOM-free; imported by page and Worker.
- Create `src/worker/index.ts` — the `/api/event` handler.
- Create `src/telemetry/centreBook.ts` — which book is under the middle of the screen.
- Rewrite `src/analytics.ts` — tracker with injectable transport; one typed function per event.
- Modify `src/main.ts`, `index.html`, `wrangler.jsonc`.
- Create `scripts/telemetry/report.sh` and `scripts/telemetry/*.sql`.
- Tests: `src/__tests__/unit/telemetry/schema.test.ts`, `worker.test.ts`, `analytics.test.ts`, `centreBook.test.ts`; update `src/__tests__/unit/overlays/search.test.ts`.

---

### Task 1: Shared schema and `toDataPoint`

**Files:**
- Create: `src/telemetry/schema.ts`
- Test: `src/__tests__/unit/telemetry/schema.test.ts`

**Interfaces:**
- Produces:
  - `type EventName = keyof typeof EVENTS`
  - `type EventFields<E extends EventName>` — `{ [blob field]: string } & { [double field]: number }`
  - `interface EventPayload { event: string; visit: string; mode: string; fields: Record<string, unknown> }`
  - `interface DataPoint { indexes: string[]; blobs: string[]; doubles: number[] }`
  - `function toDataPoint(payload: unknown, context: { country: string; device: string }): DataPoint | null`
  - `const MAX_BODY_BYTES = 2048`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { toDataPoint } from '../../../telemetry/schema.ts';

const context = { country: 'IL', device: 'mobile' };

describe('toDataPoint', () => {
  it('lays out common columns, then the event fields in schema order', () => {
    const point = toDataPoint(
      {
        event: 'story_stop',
        visit: 'v1',
        mode: 'story',
        fields: { stop_id: 'abraham', stop_number: 3, total_stops: 9 },
      },
      context,
    );
    expect(point).toEqual({
      indexes: ['v1'],
      blobs: ['story_stop', 'story', 'IL', 'mobile', 'abraham'],
      doubles: [3, 9],
    });
  });

  it('fills a missing field with an empty string or zero', () => {
    const point = toDataPoint(
      { event: 'view_settled', visit: 'v1', mode: 'explore', fields: { book: 'Genesis' } },
      context,
    );
    expect(point?.blobs).toEqual(['view_settled', 'explore', 'IL', 'mobile', 'Genesis', '', '']);
    expect(point?.doubles).toEqual([0]);
  });

  it('rejects an unknown event, a bad mode and a missing visit id', () => {
    expect(toDataPoint({ event: 'nope', visit: 'v', mode: 'story', fields: {} }, context)).toBeNull();
    expect(toDataPoint({ event: 'page_view', visit: 'v', mode: 'x', fields: {} }, context)).toBeNull();
    expect(toDataPoint({ event: 'page_view', visit: '', mode: 'story', fields: {} }, context)).toBeNull();
    expect(toDataPoint('junk', context)).toBeNull();
  });

  it('truncates long strings and ignores fields of the wrong type', () => {
    const point = toDataPoint(
      {
        event: 'search_execute',
        visit: 'v',
        mode: 'explore',
        fields: { term: 'x'.repeat(500), language: 7, search_mode: 'root', result_count: 'many' },
      },
      context,
    );
    expect(point?.blobs[4]).toHaveLength(100);
    expect(point?.blobs[5]).toBe('');
    expect(point?.doubles).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/__tests__/unit/telemetry/schema.test.ts`
Expected: FAIL, cannot resolve `telemetry/schema.ts`.

- [ ] **Step 3: Implement**

```ts
// The one place that says which Analytics Engine column holds what. Columns
// are positional: blob1-4 and index1 are common to every event, then each
// event's own strings from blob5 and numbers from double1, in the order below.
// Appending a field is safe; reordering one silently changes what old rows mean.

export const EVENTS = {
  page_view: { blobs: ['story_stop', 'referrer'], doubles: [] },
  story_stop: { blobs: ['stop_id'], doubles: ['stop_number', 'total_stops'] },
  story_exit: { blobs: ['stop_id'], doubles: ['stop_number'] },
  story_return: { blobs: ['stop_id'], doubles: [] },
  view_settled: { blobs: ['book', 'section', 'zoom_band'], doubles: ['zoom'] },
  overlay_switch: { blobs: ['overlay', 'previous_overlay'], doubles: [] },
  search_execute: { blobs: ['term', 'language', 'search_mode'], doubles: ['result_count'] },
  verse_click: { blobs: ['book'], doubles: ['chapter', 'verse'] },
  word_menu_open: { blobs: ['word', 'verse', 'palette_full'], doubles: ['meanings'] },
  word_search: { blobs: ['word', 'choice', 'verse'], doubles: [] },
  sefaria_click: { blobs: ['book', 'overlay'], doubles: ['chapter', 'verse'] },
} as const satisfies Record<string, { blobs: readonly string[]; doubles: readonly string[] }>;

export type EventName = keyof typeof EVENTS;
type Blobs<E extends EventName> = (typeof EVENTS)[E]['blobs'][number];
type Doubles<E extends EventName> = (typeof EVENTS)[E]['doubles'][number];
export type EventFields<E extends EventName> = { [K in Blobs<E>]: string } & {
  [K in Doubles<E>]: number;
};

export type Mode = 'story' | 'explore';

export interface EventPayload {
  event: string;
  visit: string;
  mode: string;
  fields: Record<string, unknown>;
}

export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

export const MAX_BODY_BYTES = 2048;
const MAX_BLOB_CHARS = 100;

function isEventName(name: unknown): name is EventName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, name);
}

/** The data point for a payload from the page, or null if it is not one we accept. */
export function toDataPoint(
  payload: unknown,
  context: { country: string; device: string },
): DataPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { event, visit, mode, fields } = payload as Partial<EventPayload>;
  if (!isEventName(event)) return null;
  if (typeof visit !== 'string' || visit.length === 0 || visit.length > 64) return null;
  if (mode !== 'story' && mode !== 'explore') return null;
  const given = typeof fields === 'object' && fields !== null ? fields : {};

  const schema = EVENTS[event];
  const blob = (name: string) => {
    const value = given[name];
    return typeof value === 'string' ? value.slice(0, MAX_BLOB_CHARS) : '';
  };
  const double = (name: string) => {
    const value = given[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  return {
    indexes: [visit],
    blobs: [event, mode, context.country, context.device, ...schema.blobs.map(blob)],
    doubles: schema.doubles.map(double),
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/__tests__/unit/telemetry/schema.test.ts`
Expected: PASS. Then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/telemetry/schema.ts src/__tests__/unit/telemetry/schema.test.ts
git commit -m "Telemetry: one schema for which column holds which event field"
```

---

### Task 2: The Worker endpoint

**Files:**
- Create: `src/worker/index.ts`
- Modify: `wrangler.jsonc`
- Test: `src/__tests__/unit/telemetry/worker.test.ts`

**Interfaces:**
- Consumes: `toDataPoint`, `MAX_BODY_BYTES` from Task 1.
- Produces: `export default { fetch(request: Request, env: Env): Promise<Response> }`, `interface Env { EVENTS: EventsDataset; ASSETS: { fetch(request: Request): Promise<Response> } }`.

Cloudflare serves a matching static file before the script runs, so the script sees only requests that match no file. Anything that is not `/api/event` goes to `env.ASSETS` so the site's 404 stays as it is.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
// Node, because happy-dom enforces the browser rule that a page cannot set Origin or User-Agent.
import { describe, expect, it, vi } from 'vitest';
import worker from '../../../worker/index.ts';

function env() {
  return {
    EVENTS: { writeDataPoint: vi.fn() },
    ASSETS: { fetch: vi.fn(async () => new Response('asset', { status: 404 })) },
  };
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('https://torahmap.org/api/event', {
    method: 'POST',
    body,
    headers: { Origin: 'https://torahmap.org', 'User-Agent': 'Mozilla/5.0 (iPhone) Mobile', ...headers },
  });
}

const valid = JSON.stringify({
  event: 'story_exit',
  visit: 'v1',
  mode: 'story',
  fields: { stop_id: 'sinai', stop_number: 4 },
});

describe('telemetry worker', () => {
  it('writes an accepted event and answers 204', async () => {
    const e = env();
    const response = await worker.fetch(post(valid), e);
    expect(response.status).toBe(204);
    expect(e.EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: ['story_exit', 'story', '', 'mobile', 'sinai'],
      doubles: [4],
    });
  });

  it('writes nothing from another origin', async () => {
    const e = env();
    const response = await worker.fetch(post(valid, { Origin: 'http://localhost:5173' }), e);
    expect(response.status).toBe(403);
    expect(e.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('writes nothing for an oversized body, bad JSON or an unknown event', async () => {
    const e = env();
    expect((await worker.fetch(post('x'.repeat(3000)), e)).status).toBe(413);
    expect((await worker.fetch(post('{not json'), e)).status).toBe(400);
    expect((await worker.fetch(post('{"event":"nope","visit":"v","mode":"story"}'), e)).status).toBe(400);
    expect(e.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('refuses a GET on the endpoint and hands other paths to the static assets', async () => {
    const e = env();
    expect((await worker.fetch(new Request('https://torahmap.org/api/event'), e)).status).toBe(405);
    await worker.fetch(new Request('https://torahmap.org/missing'), e);
    expect(e.ASSETS.fetch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/__tests__/unit/telemetry/worker.test.ts`
Expected: FAIL, cannot resolve `worker/index.ts`.

- [ ] **Step 3: Implement**

```ts
// The site's Worker. Static files are served before this runs; the only route
// it owns is /api/event, which writes one Analytics Engine data point.

import { MAX_BODY_BYTES, toDataPoint, type DataPoint } from '../telemetry/schema.ts';

interface EventsDataset {
  writeDataPoint(point: DataPoint): void;
}

export interface Env {
  EVENTS: EventsDataset;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SITE_ORIGIN = 'https://torahmap.org';

async function handleEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (request.headers.get('Origin') !== SITE_ORIGIN) return new Response(null, { status: 403 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  // Cloudflare attaches `cf` to incoming requests; the DOM Request type has no such field.
  const country = (request as { cf?: { country?: string } }).cf?.country ?? '';
  const device = /Mobi|Android/i.test(request.headers.get('User-Agent') ?? '') ? 'mobile' : 'desktop';
  const point = toDataPoint(payload, { country, device });
  if (!point) return new Response(null, { status: 400 });

  env.EVENTS.writeDataPoint(point);
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/api/event') return handleEvent(request, env);
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 4: Wire it in `wrangler.jsonc`**

```jsonc
{
  "$schema": "https://unpkg.com/wrangler/config-schema.json",
  "name": "torahmap",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-08-27",
  "assets": { "directory": "./dist", "binding": "ASSETS" },
  "analytics_engine_datasets": [{ "binding": "EVENTS", "dataset": "torahmap_events" }],
  "routes": [{ "pattern": "torahmap.org", "custom_domain": true }],
}
```

- [ ] **Step 5: Run tests, typecheck, and check wrangler accepts the config**

Run: `npx vitest run src/__tests__/unit/telemetry/ && npm run typecheck && npm run build && wrangler deploy --dry-run --outdir .wrangler/dryrun`
Expected: tests pass; dry run lists the `EVENTS` and `ASSETS` bindings and uploads nothing.

- [ ] **Step 6: Commit**

```bash
git add src/worker/index.ts wrangler.jsonc src/__tests__/unit/telemetry/worker.test.ts
git commit -m "Telemetry: a Worker route that writes accepted events to Analytics Engine"
```

---

### Task 3: The page-side tracker, replacing Google Analytics

**Files:**
- Rewrite: `src/analytics.ts`
- Modify: `index.html:7-15` (delete the gtag script tags), `src/main.ts` (drop `trackZoomLevel` and `debouncedTrackZoom`), `src/__tests__/unit/overlays/search.test.ts:1367-1378`
- Test: `src/__tests__/unit/telemetry/analytics.test.ts`

**Interfaces:**
- Consumes: `EventName`, `EventFields`, `Mode` from Task 1.
- Produces, all in `src/analytics.ts`:
  - `configureAnalytics(options: { hostname?: string; send?: (body: string) => void; getMode?: () => Mode; visitId?: string }): void` — tests and `main.ts` call this; unset options keep their defaults (`location.hostname`, `navigator.sendBeacon('/api/event', body)`, `() => 'story'`, `crypto.randomUUID()`).
  - `trackPageView(storyStop: string, referrer: string)`
  - `trackStoryStop(stopId: string, stopNumber: number, totalStops: number)` — sends each stop id once per visit.
  - `trackStoryExit(stopId: string, stopNumber: number)`, `trackStoryReturn(stopId: string)`
  - `trackViewSettled(book: string, section: string, zoom: number)` — computes the zoom band.
  - `trackOverlaySwitch(overlay: string, previousOverlay: string)`
  - `trackSearchExecute(term: string, language: TextLanguage, searchMode: string, resultCount: number)`
  - `trackVerseClick(book: string, chapter: number, verse: number)`
  - `trackWordMenuOpen(word: string, verse: string, meanings: number, paletteFull: boolean)`
  - `trackWordSearch(word: string, choice: string, verse: string)`
  - `trackSefariaClick(book: string, chapter: number, verse: number, overlay: string)`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAnalytics,
  trackSearchExecute,
  trackStoryStop,
  trackViewSettled,
} from '../../../analytics.ts';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  send = vi.fn();
  configureAnalytics({ hostname: 'torahmap.org', send, getMode: () => 'explore', visitId: 'v1' });
});

const sent = () => send.mock.calls.map(([body]) => JSON.parse(body as string));

describe('analytics', () => {
  it('sends the event with the visit id and the current mode', () => {
    trackSearchExecute('light', 'en', 'word', 12);
    expect(sent()).toEqual([
      {
        event: 'search_execute',
        visit: 'v1',
        mode: 'explore',
        fields: { term: 'light', language: 'en', search_mode: 'word', result_count: 12 },
      },
    ]);
  });

  it('sends nothing off torahmap.org', () => {
    configureAnalytics({ hostname: 'localhost' });
    trackSearchExecute('light', 'en', 'word', 12);
    configureAnalytics({ hostname: 'torahmap.workers.dev' });
    trackSearchExecute('light', 'en', 'word', 12);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends each story stop once per visit', () => {
    trackStoryStop('creation', 1, 9);
    trackStoryStop('flood', 2, 9);
    trackStoryStop('creation', 1, 9);
    expect(sent().map((e) => e.fields.stop_id)).toEqual(['creation', 'flood']);
  });

  it('counts stops afresh for a new visit', () => {
    trackStoryStop('creation', 1, 9);
    configureAnalytics({ visitId: 'v2' });
    trackStoryStop('creation', 1, 9);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('bands the zoom of a settled view', () => {
    trackViewSettled('Isaiah', 'neviim', 4);
    trackViewSettled('Isaiah', 'neviim', 0.5);
    expect(sent().map((e) => e.fields.zoom_band)).toEqual(['close', 'far']);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/__tests__/unit/telemetry/analytics.test.ts`
Expected: FAIL, `configureAnalytics` is not exported.

- [ ] **Step 3: Implement `src/analytics.ts`**

```ts
// Events for the site's own Worker (src/worker/index.ts). No cookies and no
// browser storage: the visit id lives in memory, so a reload is a new visit.
import type { TextLanguage } from './types.ts';
import type { EventFields, EventName, Mode } from './telemetry/schema.ts';

const SITE_HOSTNAME = 'torahmap.org';

interface Options {
  hostname: string;
  send: (body: string) => void;
  getMode: () => Mode;
  visitId: string;
}

const options: Options = {
  hostname: typeof location === 'undefined' ? '' : location.hostname,
  send: (body) => navigator.sendBeacon('/api/event', body),
  getMode: () => 'story',
  visitId: crypto.randomUUID(),
};
let storyStopsSent = new Set<string>();

export function configureAnalytics(changes: Partial<Options>): void {
  if (changes.visitId !== undefined && changes.visitId !== options.visitId) {
    storyStopsSent = new Set();
  }
  Object.assign(options, changes);
}

function track<E extends EventName>(event: E, fields: EventFields<E>): void {
  if (options.hostname !== SITE_HOSTNAME) return;
  options.send(JSON.stringify({ event, visit: options.visitId, mode: options.getMode(), fields }));
}

export function trackPageView(storyStop: string, referrer: string): void {
  track('page_view', { story_stop: storyStop, referrer });
}

export function trackStoryStop(stopId: string, stopNumber: number, totalStops: number): void {
  if (storyStopsSent.has(stopId)) return;
  storyStopsSent.add(stopId);
  track('story_stop', { stop_id: stopId, stop_number: stopNumber, total_stops: totalStops });
}

export function trackStoryExit(stopId: string, stopNumber: number): void {
  track('story_exit', { stop_id: stopId, stop_number: stopNumber });
}

export function trackStoryReturn(stopId: string): void {
  track('story_return', { stop_id: stopId });
}

export function trackViewSettled(book: string, section: string, zoom: number): void {
  const zoomBand = zoom > 3 ? 'close' : zoom >= 1 ? 'medium' : 'far';
  track('view_settled', { book, section, zoom_band: zoomBand, zoom: Math.round(zoom * 100) / 100 });
}

export function trackOverlaySwitch(overlay: string, previousOverlay: string): void {
  track('overlay_switch', { overlay, previous_overlay: previousOverlay });
}

export function trackSearchExecute(
  term: string,
  language: TextLanguage,
  searchMode: string,
  resultCount: number,
): void {
  track('search_execute', {
    term: term.slice(0, 40),
    language,
    search_mode: searchMode,
    result_count: resultCount,
  });
}

export function trackVerseClick(book: string, chapter: number, verse: number): void {
  track('verse_click', { book, chapter, verse });
}

export function trackWordMenuOpen(
  word: string,
  verse: string,
  meanings: number,
  paletteFull: boolean,
): void {
  track('word_menu_open', { word, verse, meanings, palette_full: paletteFull ? 'yes' : 'no' });
}

export function trackWordSearch(word: string, choice: string, verse: string): void {
  track('word_search', { word, choice, verse });
}

export function trackSefariaClick(
  book: string,
  chapter: number,
  verse: number,
  overlay: string,
): void {
  track('sefaria_click', { book, chapter, verse, overlay });
}
```

- [ ] **Step 4: Remove Google Analytics and the zoom event**

In `index.html`, delete the `<script async src="https://www.googletagmanager.com/...">` tag and the inline `<script>` that defines `gtag` (lines 7-15).

In `src/main.ts`: remove `trackZoomLevel` from the `./analytics.ts` import, the `debouncedTrackZoom();` call in the wheel handler, and the line `const debouncedTrackZoom = debounce(() => trackZoomLevel(camera.zoom), 1000);`. Task 5 replaces them.

In `search.test.ts`, the test at line 1367 spies on `window.gtag`. Replace the spy with the tracker's transport:

```ts
    it('answers for a query it is handed without changing the search or firing analytics', async () => {
      const send = vi.fn();
      configureAnalytics({ hostname: 'torahmap.org', send });
      await searchOverlay.overlay.init?.();
      searchOverlay.restore({ q: 'אור' });
      send.mockClear();

      colorsFor([createVerse({ book: 'Genesis', chapter: 1, verse: 3 })], 'אברם');

      expect(searchOverlay.toUrl().q).toBe('אור');
      expect(send).not.toHaveBeenCalled();
      configureAnalytics({ hostname: 'localhost' });
    });
```

and add `import { configureAnalytics } from '../../../analytics.ts';` to that file's imports. Before relying on it, check the test still fails when the guarantee breaks: temporarily add `trackSearchExecute('x', 'en', 'word', 0)` inside the search overlay's colour function, run the test, see it fail, and revert.

- [ ] **Step 5: Run everything**

Run: `grep -rn "gtag" src index.html` — expected: no output. Then `npm run typecheck && npm test`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analytics.ts index.html src/main.ts src/__tests__/unit/telemetry/analytics.test.ts src/__tests__/unit/overlays/search.test.ts
git commit -m "Telemetry: send events to our own endpoint and remove Google Analytics"
```

---

### Task 4: Mode, page view and story events

**Files:**
- Modify: `src/main.ts` — near `let appMode` (line ~271), the scroll handler (~870), `exit-story` (~820) and `back-to-story` (~831) handlers, and the end of startup (~962).

**Interfaces:**
- Consumes: `configureAnalytics`, `trackPageView`, `trackStoryStop`, `trackStoryExit`, `trackStoryReturn` from Task 3.

- [ ] **Step 1: Give the tracker the mode.** Right after `let appMode: AppMode = 'story';`:

```ts
  configureAnalytics({ getMode: () => appMode });
```

- [ ] **Step 2: Record stops reached.** In the scroll handler, inside the existing `if (lastSyncedStopId !== dominantStop.id) { ... }` block, after `lastSyncedStopId = dominantStop.id;`:

```ts
        const stopIndex = resolvedStops.findIndex((s) => s.id === dominantStop.id);
        trackStoryStop(dominantStop.id, stopIndex + 1, resolvedStops.length);
```

`resolvedStops` is the array the handler passes to `computeInterpolatedState`.

- [ ] **Step 3: Record leaving and returning.** Declare `let storyExitStopId = '';` beside `lastStoryScrollTop`. In the `exit-story` handler, first lines:

```ts
    storyExitStopId = lastSyncedStopId ?? '';
    const exitIndex = resolvedStops.findIndex((s) => s.id === storyExitStopId);
    trackStoryExit(storyExitStopId, exitIndex + 1);
```

In the `back-to-story` handler, first line after `e.preventDefault();`:

```ts
    trackStoryReturn(storyExitStopId);
```

The story resumes at the scroll position it was left at, so the stop it was left at is the stop it returns to.

- [ ] **Step 4: Record the page view.** Directly after the `if (window.location.hash) { restoreFromUrl(); }` block:

```ts
  const urlStop = parseUrlState().story ?? '';
  const referrer = document.referrer ? new URL(document.referrer).hostname : '';
  trackPageView(urlStop, referrer === location.hostname ? '' : referrer);
```

- [ ] **Step 5: Run everything.** `npm run typecheck && npm test`. The tracker is silent off `torahmap.org`, so these events are checked by hand in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "Telemetry: record the page view, story stops reached, and leaving and returning to the story"
```

---

### Task 5: Where readers look — `view_settled`

**Files:**
- Create: `src/telemetry/centreBook.ts`
- Test: `src/__tests__/unit/telemetry/centreBook.test.ts`
- Modify: `src/main.ts` — `debouncedSaveUrlState` (line ~546) and its callers.

**Interfaces:**
- Produces: `centreBook(verses: TanakhLayout[], camera: Camera, cssWidth: number, cssHeight: number): string` — the book of the verse nearest the middle of the screen.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { centreBook } from '../../../telemetry/centreBook.ts';
import type { TanakhLayout } from '../../../types.ts';

const verse = (book: string, x: number, y: number): TanakhLayout => ({
  book, chapter: 1, verse: 1, x, y, size: 2,
});
const verses = [verse('Genesis', 0, 0), verse('Exodus', 100, 0)];

describe('centreBook', () => {
  it('names the book under the middle of the screen', () => {
    // At zoom 1 the world point under the screen centre is (W/2 - camera.x, H/2 - camera.y).
    expect(centreBook(verses, { x: 400, y: 300, zoom: 1 }, 800, 600)).toBe('Genesis');
    expect(centreBook(verses, { x: 300, y: 300, zoom: 1 }, 800, 600)).toBe('Exodus');
  });

  it('names the nearest book when the middle falls between books', () => {
    expect(centreBook(verses, { x: 330, y: 300, zoom: 1 }, 800, 600)).toBe('Exodus');
  });

  it('accounts for zoom', () => {
    // At zoom 2 the world centre is (W/2/2 - camera.x) = 200 - 100 = 100.
    expect(centreBook(verses, { x: 100, y: 150, zoom: 2 }, 800, 600)).toBe('Exodus');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/__tests__/unit/telemetry/centreBook.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import type { Camera } from '../camera.ts';
import type { TanakhLayout } from '../types.ts';

/** The book of the verse nearest the middle of the screen. */
export function centreBook(
  verses: TanakhLayout[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
): string {
  // The inverse of panToCenter in camera.ts.
  const cx = cssWidth / 2 / camera.zoom - camera.x;
  const cy = cssHeight / 2 / camera.zoom - camera.y;
  let best = '';
  let bestDistance = Infinity;
  for (const v of verses) {
    const dx = v.x + v.size / 2 - cx;
    const dy = v.y + v.size / 2 - cy;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = v.book;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/__tests__/unit/telemetry/centreBook.test.ts` — expected PASS.

- [ ] **Step 5: Send it when the camera settles.** Every reader-driven camera move already calls `debouncedSaveUrlState` (glide end, wheel, zoom buttons, touch end, drag end). Rename it to `debouncedCameraSettled` at its definition and all its call sites, and make it do both jobs:

```ts
  const debouncedCameraSettled = debounce(() => {
    saveUrlState(false);
    if (appMode !== 'explore') return;
    const book = centreBook(verses, camera, window.innerWidth, window.innerHeight);
    trackViewSettled(book, sections.get(book) ?? '', camera.zoom);
  }, URL_UPDATE_DEBOUNCE_MS);
```

`sections` (book name → section) is defined at line ~364, above this. 300 ms (`URL_UPDATE_DEBOUNCE_MS`) is short for "settled"; wheel zooming fires repeatedly within it, so one event per gesture is expected. If a manual check in Task 8 shows several events per gesture, give the tracking its own 1000 ms debounce instead of sharing this one.

Run: `grep -n "debouncedSaveUrlState" src/main.ts` — expected: no output.

- [ ] **Step 6: Run everything and commit**

Run: `npm run typecheck && npm test`

```bash
git add src/telemetry/centreBook.ts src/__tests__/unit/telemetry/centreBook.test.ts src/main.ts
git commit -m "Telemetry: record which book and section a reader settles on in explore mode"
```

---

### Task 6: Word clicks and the Sefaria link

**Files:**
- Modify: `src/main.ts` — `setWordClickHandler` block (~692) and after `const sidebarElements = getSidebarElements();` (~508).

**Interfaces:**
- Consumes: `trackWordMenuOpen`, `trackWordSearch`, `trackSefariaClick` from Task 3. `Meaning` has `form` and `gloss`; `onChoose(null)` means "exact spelling".

- [ ] **Step 1: Word menu.** Inside `setWordClickHandler((click) => { ... })`, after `meanings` is computed and before `openWordMenu(`:

```ts
    const ref = `${click.book} ${click.chapter}:${click.verse}`;
    const paletteFull = !canAddTerm(overlaySettings.get(searchOverlay));
    trackWordMenuOpen(click.text, ref, meanings.length, paletteFull);
```

Pass `paletteFull` to `openWordMenu` instead of recomputing it. In `onChoose`, after the `canAddTerm` early return (a refused choice searches nothing, so it is not a search):

```ts
        trackWordSearch(click.text, meaning ? `${meaning.form} ${meaning.gloss}` : 'exact', ref);
```

- [ ] **Step 2: Sefaria link.** After `const sidebarElements = getSidebarElements();`:

```ts
  sidebarElements.link?.addEventListener('click', () => {
    const verse = pinnedVerse ?? mouseState.hoveredVerse;
    if (verse) trackSefariaClick(verse.book, verse.chapter, verse.verse, currentOverlayId);
  });
```

Confirm `pinnedVerse`, `mouseState` and `currentOverlayId` are declared before this line; if not, move the listener below them. `sendBeacon` survives the page navigating away, so the link opening Sefaria does not lose the event.

- [ ] **Step 3: Run everything and commit**

Run: `npm run typecheck && npm test`

```bash
git add src/main.ts
git commit -m "Telemetry: record word-menu use and clicks through to Sefaria"
```

---

### Task 7: The report script

**Files:**
- Create: `scripts/telemetry/report.sh`, `scripts/telemetry/visits.sql`, `story-reach.sql`, `story-exits.sql`, `explore-views.sql`, `overlays.sql`, `searches.sql`, `word-searches.sql`, `sefaria.sql`

`{{DAYS}}` in each `.sql` file is replaced by the script. Counts use `SUM(_sample_interval)`, which stays correct if Cloudflare samples.

- [ ] **Step 1: The queries**

`visits.sql`:
```sql
SELECT toStartOfDay(timestamp) AS day, blob2 AS opened_in, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'page_view' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY day, opened_in
ORDER BY day, opened_in
```

`story-reach.sql`:
```sql
SELECT double1 AS stop_number, blob5 AS stop, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'story_stop' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY stop_number, stop
ORDER BY stop_number
```

`story-exits.sql`:
```sql
SELECT double1 AS stop_number, blob5 AS stop, SUM(_sample_interval) AS exits
FROM torahmap_events
WHERE blob1 = 'story_exit' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY stop_number, stop
ORDER BY stop_number
```

`explore-views.sql`:
```sql
SELECT blob7 AS zoom_band, blob6 AS section, blob5 AS book, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'view_settled' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY zoom_band, section, book
ORDER BY zoom_band, views DESC
```

`overlays.sql`:
```sql
SELECT blob2 AS mode, blob5 AS overlay, SUM(_sample_interval) AS switches
FROM torahmap_events
WHERE blob1 = 'overlay_switch' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY mode, overlay
ORDER BY switches DESC
```

`searches.sql`:
```sql
SELECT blob5 AS term, blob6 AS language, blob7 AS search_mode, SUM(_sample_interval) AS searches
FROM torahmap_events
WHERE blob1 = 'search_execute' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY term, language, search_mode
ORDER BY searches DESC
LIMIT 25
```

`word-searches.sql`:
```sql
SELECT blob1 AS event, blob5 AS word, blob6 AS choice_or_verse, SUM(_sample_interval) AS n
FROM torahmap_events
WHERE blob1 IN ('word_menu_open', 'word_search') AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY event, word, choice_or_verse
ORDER BY n DESC
LIMIT 25
```

`sefaria.sql`:
```sql
SELECT blob5 AS book, blob6 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'sefaria_click' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY book, overlay
ORDER BY clicks DESC
```

- [ ] **Step 2: The script**

```bash
#!/usr/bin/env bash
# Print each saved query's result over the last N days (default 30).
# Needs CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_API_TOKEN with Account Analytics: Read.
# Column meanings are in src/telemetry/schema.ts.
set -euo pipefail

days="${1:-30}"
here="$(cd "$(dirname "$0")" && pwd)"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"

for file in "$here"/*.sql; do
  echo "== $(basename "$file" .sql) (last $days days)"
  sed "s/{{DAYS}}/$days/g" "$file" | tr '\n' ' ' | sed 's/$/ FORMAT JSON/' |
    curl -sS --fail-with-body \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" --data-binary @- |
    jq -r '(.meta | map(.name)) as $c | ($c | @tsv), (.data[] | [.[$c[]]] | @tsv)' |
    column -t -s $'\t'
  echo
done
```

- [ ] **Step 3: Check it without credentials**

Run: `chmod +x scripts/telemetry/report.sh && scripts/telemetry/report.sh`
Expected: exits non-zero with `CLOUDFLARE_ACCOUNT_ID: set CLOUDFLARE_ACCOUNT_ID`. Then `bash -n scripts/telemetry/report.sh` — no output. The queries themselves can only be checked against the live API after deploy (Task 8).

- [ ] **Step 4: Commit**

```bash
git add scripts/telemetry/
git commit -m "Telemetry: a report script and the queries it runs"
```

---

### Task 8: End to end, docs, follow-up, PR

- [ ] **Step 1: Run the Worker locally.** `npm run build`, then start `wrangler dev` as a background task and read its port from the output. Then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:PORT/                       # 200, the map
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:PORT/api/event \
  -H 'Origin: https://torahmap.org' \
  --data '{"event":"page_view","visit":"v","mode":"story","fields":{}}'                # 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:PORT/api/event \
  --data '{"event":"page_view","visit":"v","mode":"story","fields":{}}'                # 403
```

Stop only the `wrangler dev` process you started (by its PID).

- [ ] **Step 2: Watch the page send.** Page and Worker both refuse anything but `torahmap.org`, so for this check only, temporarily set `SITE_HOSTNAME` in `src/analytics.ts` to `'localhost'` and `SITE_ORIGIN` in `src/worker/index.ts` to `http://localhost:PORT`, rebuild, and restart `wrangler dev`. In Chrome at that URL, with DevTools' Network panel filtered to `api/event`: scroll the story, press "Explore freely", pan and zoom, click a word and pick a meaning, click the Sefaria link. Confirm every request returns 204; payloads match the design's table; each stop is sent once; one wheel gesture gives one `view_settled`; no `view_settled` while in the story. Then revert both constants and confirm `git diff` shows nothing for those two files.

- [ ] **Step 3: Update the design doc.** In `docs/plans/2026-09-18-telemetry-design.md`, replace "Worker types come from `wrangler types`, not a new dependency." with "The Worker declares the one binding method it uses, so it needs no Worker types package." and add the column table from `src/telemetry/schema.ts` by reference, not by copy.

- [ ] **Step 4: File the follow-up.**

```bash
gh issue create --label enhancement,P3 --title "Telemetry: overlay controls and the Talmud page" \
  --body "Follow-up to #213. Not yet recorded: what is chosen inside each overlay (commentary category, trop mark, haftarah tradition, dating period), and anything on talmud.html. Add fields to src/telemetry/schema.ts and a tracker function per event."
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "Telemetry through our own Worker, replacing Google Analytics" --body "..."
```

The PR body says, in plain prose: what is recorded, that Google Analytics and its cookies are gone, and the three things only Danyel can do after merge — deploy (`npm run build && wrangler deploy`), create an API token with Account Analytics: Read, and run `scripts/telemetry/report.sh 1` after visiting the live site to see his own visit. Ends with `Closes #213`.
