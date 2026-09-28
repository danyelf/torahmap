# Sharing a view, part 3: link previews and telemetry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A link pasted into a chat app previews as what it points at, and
telemetry counts shares, shared links opened, and links pasted.

**Architecture:** The Worker runs first for `/`, fetches `index.html` from the
static files, and rewrites its title, description and `og:` tags from
`describeLink` — as text, by a pure function tested against the real
`index.html`. It records `link_preview` when a known preview fetcher asks. The
page records `share` and gains `arrived_with` on `page_view`.

**Tech Stack:** Cloudflare Workers (static assets + `run_worker_first`),
Analytics Engine, TypeScript, Vitest (Node environment for the Worker).

**Spec:** `docs/plans/2026-09-28-sharing-a-view.md` — "The Worker",
"Telemetry", "How it lands" item 3. Parts 1 (#278) and 2 (#279) are this
branch's base.

## Global Constraints

- Tagline, verbatim: `A Visual Concordance of the Hebrew Bible.` It replaces
  both descriptions in `index.html` (`description` and `og:description`).
- The Worker runs first for `/` only: `"run_worker_first": ["/"]` under
  `assets` in `wrangler.jsonc`. Every other path is served as a static file.
- `canonical` stays `https://torahmap.org/`. `og:url` becomes the request's
  full URL. No hostnames in source: take the origin from the request.
- The rewrite edits text; no `HTMLRewriter` (spec, "The Worker").
- Telemetry columns are appended, never reordered (`src/telemetry/schema.ts`
  header). No marker or id is added to links.
- `link_preview` is written only by the Worker; the page cannot send it.
- No new dependencies. Comments per AGENTS.md. Every commit passes the hook.

## Review Focus

1. **A reformatted `index.html`** (Prettier wraps a `<meta>` across lines,
   attributes reorder) — the rewrite still finds every tag, and if it cannot,
   a test fails rather than the site shipping plain previews. (Task 1.)
2. **A link whose values contain `"`, `<` or `&`** (a search for `"a" <b>`)
   — the written attributes are escaped; the page cannot be broken or injected
   into through a link. (Task 1.)
3. **A request the static files answer with something other than a 200 HTML
   page** (a 304 for a cached page, a HEAD request, a 404) — passed through
   untouched. (Task 1.)
4. **A preview fetcher on a page that names nothing** still records one
   `link_preview` with `what: 'nothing'`; an ordinary browser records none.
   (Task 2.)
5. **A reload or Back/Forward** records `arrived_with: 'nothing'`, not a new
   arrival. (Task 3.)

---

### Task 1: The Worker writes each link's title and preview tags

**Files:**
- Create: `src/worker/page.ts`, `src/__tests__/unit/telemetry/page.test.ts`
  (beside `worker.test.ts`, Node environment)
- Modify: `src/worker/index.ts`, `wrangler.jsonc`, `index.html`,
  `src/__tests__/unit/telemetry/worker.test.ts`

**Interfaces — produces:**
```ts
// src/worker/page.ts
export interface PageTags { title: string; description: string; url: string }
/** The page with its title, description and og: tags naming one link. */
export function rewritePage(html: string, tags: PageTags): string;
```
Consumes: `describeLink` and `readLink` (`@torahmap/link`), `overlayParamSpecs`
(`@torahmap/overlay-catalog`), `LINK_NAMES` (`src/linkNames.ts` — the same
names the tab title uses).

- [ ] **Step 1: Write the failing tests.** `page.test.ts`, headed with the
  comment that carries the chain (keep its substance; Danyel asked that this
  test say why it exists):

```ts
// @vitest-environment node
// Chat apps build a link's preview from the page's <title>, description and
// og: tags, so the Worker rewrites them for each link (rewritePage). It edits
// index.html as text rather than parsing it with Cloudflare's HTMLRewriter,
// which exists only in Cloudflare's runtime, not in Node where these tests
// run. Text matching depends on how index.html writes those tags, so the
// rewrite is tested on the real file: if a reformat of index.html breaks the
// match, this fails, instead of every shared link quietly previewing as the
// home page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rewritePage } from '../../../worker/page.ts';

const INDEX = readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8');
const tags = {
  title: 'Genesis 12:1 · Torahmap',
  description: 'Commentary overlay. A Visual Concordance of the Hebrew Bible.',
  url: 'https://torahmap.org/?verse=Genesis.12.1&overlay=commentary',
};

const content = (html: string, attr: string, name: string) =>
  new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe('rewritePage, on the real index.html', () => {
  const page = rewritePage(INDEX, tags);

  it('titles the page', () => {
    expect(page).toContain('<title>Genesis 12:1 · Torahmap</title>');
  });

  it('writes every tag a preview reads', () => {
    expect(content(page, 'name', 'description')).toBe(tags.description);
    expect(content(page, 'property', 'og:title')).toBe(tags.title);
    expect(content(page, 'property', 'og:description')).toBe(tags.description);
    expect(content(page, 'property', 'og:url')).toBe(tags.url.replace(/&/g, '&amp;'));
  });

  it('keeps canonical on the home page', () => {
    expect(page).toContain('<link rel="canonical" href="https://torahmap.org/" />');
  });

  it('changes nothing else', () => {
    const strip = (html: string) =>
      html
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<meta\s+(?:name="description"|property="og:(?:title|description|url)")[\s\S]*?\/>/g, '');
    expect(strip(page)).toBe(strip(INDEX));
  });
});

describe('rewritePage, on any layout of those tags', () => {
  it('finds a tag wrapped across lines, as Prettier writes a long one', () => {
    const html = '<title>x</title><meta\n  property="og:title"\n  content="x"\n/>';
    expect(rewritePage(html, { ...tags, description: 'd', url: 'u' })).toContain(
      'content="Genesis 12:1 · Torahmap"',
    );
  });

  it('escapes what a link can carry', () => {
    const page = rewritePage(INDEX, { ...tags, title: 'Search: "a" <b> & c · Torahmap' });
    expect(page).toContain('<title>Search: &quot;a&quot; &lt;b&gt; &amp; c · Torahmap</title>');
    expect(content(page, 'property', 'og:title')).toBe(
      'Search: &quot;a&quot; &lt;b&gt; &amp; c · Torahmap',
    );
  });
});
```

  If `content()` cannot read a tag because `index.html` writes its attributes
  in another order, make the helper order-free rather than the other way round.

  In `worker.test.ts`, add:

```ts
function page(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)', ...headers } });
}
function envWithIndex(html = '<title>Torahmap</title><meta property="og:title" content="Torahmap" />') {
  const e = env();
  e.ASSETS.fetch = vi.fn(async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }));
  return e;
}

describe('the page at /', () => {
  it('names the link it was asked for', async () => {
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1'), envWithIndex());
    const html = await response.text();
    expect(html).toContain('<title>Genesis 12:1 · Torahmap</title>');
    expect(html).toContain('content="Genesis 12:1 · Torahmap"');
  });

  it('passes through anything but a 200 HTML page', async () => {
    const e = env();
    e.ASSETS.fetch = vi.fn(async () => new Response(null, { status: 304 }));
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1'), e);
    expect(response.status).toBe(304);
  });

  it('leaves other paths to the static files', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/og-image.jpg'), e);
    expect(e.ASSETS.fetch).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/__tests__/unit/telemetry`. Expected: FAIL.

- [ ] **Step 3: Implement.** `src/worker/page.ts`: a small `escapeAttr`
  (`&`, `"`, `<`, `>`), then one regex per tag, each tolerant of whitespace
  and newlines inside the tag (`<meta\s+property="og:title"\s+content="[^"]*"\s*\/>`
  with `[\s]` spans), replacing only the `content` value (and the `<title>`
  text). `src/worker/index.ts`:

```ts
if (url.pathname === '/' && request.method === 'GET') return linkPage(request, env);
```

  where `linkPage` fetches `env.ASSETS.fetch(request)`, returns it untouched
  unless `status === 200` and `Content-Type` starts with `text/html`, else
  reads the text, rewrites it with
  `describeLink(readLink(url.search, overlayParamSpecs), LINK_NAMES)` and
  `url: request.url`, and returns a new `Response` with the original headers
  minus `Content-Length` and `ETag` (the body is no longer the file's).
  Update the Worker's header comment: it owns `/api/event` and the page at `/`.

  `wrangler.jsonc`: `"run_worker_first": ["/"]` inside `assets`.
  `index.html`: both descriptions become the tagline.

- [ ] **Step 4: Run** — the two test files, `npm run typecheck`, `npm test`,
  and `npm run build` (the Worker is bundled by Cloudflare's build from this
  source; confirm the build still succeeds). Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "The Worker names each link in the page's title and preview tags"`

---

### Task 2: The Worker records link previews

**Files:**
- Create: `src/worker/fetchers.ts`, `src/__tests__/unit/telemetry/fetchers.test.ts`
- Modify: `src/telemetry/schema.ts`, `src/worker/index.ts`,
  `src/__tests__/unit/telemetry/worker.test.ts`,
  `src/__tests__/unit/telemetry/schema.test.ts`

**Interfaces — produces:**
```ts
// src/worker/fetchers.ts
/** The chat app's preview fetcher a User-Agent names, or null for anything else. */
export function previewFetcher(userAgent: string): string | null;
// src/telemetry/schema.ts
EVENTS.link_preview = { blobs: ['fetcher', 'what'], doubles: [] };
/** Events only the Worker writes; toDataPoint refuses them from the page. */
export const WORKER_EVENTS: ReadonlySet<EventName>;
export function workerDataPoint<E extends EventName>(event: E, fields: EventFields<E>, context: …): DataPoint;
// @torahmap/link or src/linkNames.ts
export function linkKind(state: UrlState): 'nothing' | 'view' | 'stop'; // used by Tasks 2 and 3
```

- [ ] **Step 1: Write the failing tests.** `fetchers.test.ts`: each of
  Slackbot (`Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)`),
  `WhatsApp/2.23.20.0`, `Discordbot/2.0`, `TelegramBot (like TwitterBot)`,
  `LinkedInBot/1.0`, `Twitterbot/1.0`, `facebookexternalhit/1.1` maps to a
  short stable name (`slack`, `whatsapp`, `discord`, `telegram`, `linkedin`,
  `twitter`, `facebook`); an ordinary Safari, Chrome and Firefox string maps
  to null. (Telegram's string contains "TwitterBot": the more specific name
  wins — order the table so it does.)

  `worker.test.ts`: a Slackbot request for `/?verse=Genesis.12.1` writes one
  data point `{ blobs: ['link_preview', '', <country>, <device>, 'torahmap.org', 'slack', 'view'] … }`;
  for `/` alone, `what` is `'nothing'`; for `/?story=tour&stop=intro`,
  `'stop'`; a browser writes none. `schema.test.ts`: a page payload with
  `event: 'link_preview'` is refused.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.** The table of fetchers in `fetchers.ts`. `linkKind`
  sits beside `linkNamesAView` in `@torahmap/link` (it is the same question), used here
  and in Task 3. `workerDataPoint` fills the common columns with `mode: ''`
  and the index with the event name (Analytics Engine needs one; the Worker
  has no visit). `toDataPoint` refuses `WORKER_EVENTS`. In `linkPage`, write
  the data point when `previewFetcher(userAgent)` is non-null, whatever the
  static files answered.

- [ ] **Step 4: Run** the telemetry tests, then `npm run typecheck && npm test`. PASS.

- [ ] **Step 5: Commit** — `git commit -m "Record which chat apps fetch a link's preview"`

---

### Task 3: The page records shares and arrivals

**Files:**
- Modify: `src/telemetry/schema.ts`, `src/analytics.ts`, `src/main.ts`
  (`trackPageView` call ~`:1771`, `shareCurrentView` ~`:1462`),
  `src/__tests__/unit/telemetry/analytics.test.ts`

**Interfaces — produces:**
```ts
EVENTS.page_view = { blobs: ['story_stop', 'referrer', 'story', 'arrived_with'], doubles: [] }; // appended
EVENTS.share = {
  blobs: ['how', 'what', 'story', 'stop_id', 'overlay'],
  doubles: ['searching', 'pinned'],   // 1 or 0
};
export function trackPageView(story: string, storyStop: string, referrer: string, arrivedWith: string): void;
export function trackShare(fields: EventFields<'share'>): void;
/** What the first page's link named; a reload or Back/Forward is not an arrival. */
export function arrivedWith(state: UrlState, navigationType: string | undefined): 'nothing' | 'view' | 'stop';
```

- [ ] **Step 1: Write the failing tests** in `analytics.test.ts` (it already
  captures sent payloads): `trackPageView(…, 'view')` sends
  `fields.arrived_with: 'view'`; `trackShare({ how: 'copied', what: 'view',
  story: '', stop_id: '', overlay: 'commentary', searching: 1, pinned: 0 })`
  sends those fields; `arrivedWith` gives `'view'` for `?verse=…` on
  `'navigate'`, `'stop'` for `?story=tour&stop=intro`, `'nothing'` for a bare
  link, and `'nothing'` for any link on `'reload'` or `'back_forward'`.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.** In `main.ts`: pass
  `arrivedWith(parseUrlState(), performance.getEntriesByType('navigation')[0]?.type)`
  to `trackPageView`; after `shareLink` resolves in `shareCurrentView`, call
  `trackShare` with the outcome, `what` = `'stop'` when the link names a
  story else `'view'`, the story and stop from the link, the overlay, and
  whether the link searches and pins. Read all of it from the link that was
  shared (`parseUrlState(overlayParamSpecs)` after the `syncUrl`), so the
  event describes what was sent.

- [ ] **Step 4: Run** the telemetry tests, then `npm run typecheck && npm test`. PASS.

- [ ] **Step 5: Commit** — `git commit -m "Record shares, and whether a visit arrived by a link"`

---

### Task 4: Saved queries, documentation, and the pull request

**Files:** `scripts/telemetry/shares.sql`, `scripts/telemetry/arrivals.sql`,
`scripts/telemetry/link-previews.sql`, `CLAUDE.md`

- [ ] **Step 1: Queries**, in the style of `scripts/telemetry/overlays.sql`
  (column names from `columns()`; `{{SITE}}`; `SUM(_sample_interval)`):
  shares by `how` and `what`; page views by `arrived_with`; link previews by
  `fetcher` and `what`. `queries.test.ts` checks them against the schema.
- [ ] **Step 2: `CLAUDE.md`, Deployment:** the Worker owns `/api/event` and
  the page at `/`, where it writes each link's title and preview tags
  (`src/worker/page.ts`) and records preview fetchers; everything else is
  served as a static file first. One sentence on testing: previews are
  checked on torahmap.org after merge, since Access keeps chat apps off PR
  previews.
- [ ] **Step 3: Run** `npm run typecheck && npm test && npm run build`. PASS.
- [ ] **Step 4: Commit** — `git commit -m "Saved queries for shares, arrivals and link previews"`
