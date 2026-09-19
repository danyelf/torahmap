# Telemetry Implementation Plan

**Status:** Shipped — see `2026-09-18-telemetry-design.md`.

**Goal:** Replace Google Analytics with cookieless events sent through the site's Worker into Workers Analytics Engine, covering the story, where readers look once they take the map from the story, word clicks and the Sefaria link.

This records how the work was divided. The code is the reference for how it works now.

### Task 1: Shared schema and `toDataPoint`

**Files:** `src/telemetry/schema.ts`; test `src/__tests__/unit/telemetry/schema.test.ts`.

One module, imported by page and Worker, lists each event's fields in column order and turns a payload into an Analytics Engine data point, or rejects it.

### Task 2: The Worker endpoint

**Files:** `src/worker/index.ts`, `wrangler.jsonc`; test `src/__tests__/unit/telemetry/worker.test.ts`.

The Worker answers `/api/event`, validates the request and writes one data point; every other path goes to the static assets.

### Task 3: The page-side tracker, replacing Google Analytics

**Files:** `src/analytics.ts`, `index.html`, `src/main.ts`, `src/__tests__/unit/overlays/search.test.ts`; test `src/__tests__/unit/telemetry/analytics.test.ts`.

`src/analytics.ts` became a tracker with one typed function per event and an injectable transport. The Google Analytics tags and the zoom event were removed.

### Task 4: Mode, page view and story events

**Files:** `src/main.ts`.

Every event carries its mode, who drives the map (story or reader), and the page records its view, each story stop reached, and each time the reader takes the map or the story takes it back.

### Task 5: Where readers look — `view_settled`

**Files:** `src/main.ts`, `src/hitDetection.ts`; test `src/__tests__/unit/hitDetection.test.ts`.

When the camera settles somewhere new while the reader drives the map, the page records the book under the middle of the screen, its section and the zoom.

### Task 6: Word clicks and the Sefaria link

**Files:** `src/main.ts`.

The word menu's opening and the choice picked in it are recorded, and so is a click through to Sefaria.

### Task 7: The report script

**Files:** `scripts/telemetry/report.sh` and the `.sql` queries beside it.

A shell script runs each saved query against the Analytics Engine SQL API and prints it as a table.

### Task 8: End to end, docs, follow-up, PR

The Worker was run locally with `wrangler dev`, the design doc updated, the follow-up filed and the PR opened.
