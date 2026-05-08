// Background prefetch for Talmud tractate texts with click-time precedence.
//
// Design: docs/plans/2026-04-07-talmud-integration-design.md §3.12

import { getTractateText, hasTractateText } from "./data.ts";
import { PREFETCH_CONCURRENCY } from "./constants.ts";
import type { TalmudTractateText } from "./data.ts";

let queue: string[] = [];
let inFlight = 0;
let onLoadedCb: ((name: string, text: TalmudTractateText) => void) | null = null;

export interface PrefetchOptions {
  concurrency?: number;
  onLoaded?: (name: string, text: TalmudTractateText) => void;
}

/**
 * Kick off background prefetch of all listed tractates.
 * Honors a concurrency cap; calls getTractateText (which populates the cache).
 *
 * The optional `onLoaded` callback fires once per tractate in *completion
 * order* (i.e. as fetches resolve), not in the order they were queued. This
 * matters because `promoteTractateToFront` can reorder pending work in
 * response to user clicks, and downstream consumers (e.g. the segment-length
 * overlay's ingest) want to see prioritized tractates first.
 */
export function startBackgroundPrefetch(
  tractateNames: string[],
  options: PrefetchOptions = {},
): void {
  queue = [...tractateNames];
  onLoadedCb = options.onLoaded ?? null;
  pump(options.concurrency ?? PREFETCH_CONCURRENCY);
}

/**
 * Move a specific tractate to the front of the queue.
 * Used when the user clicks a segment from a tractate that hasn't loaded yet.
 */
export function promoteTractateToFront(name: string): void {
  const idx = queue.indexOf(name);
  if (idx >= 0) {
    queue.splice(idx, 1);
    queue.unshift(name);
  }
}

function pump(concurrency: number): void {
  while (inFlight < concurrency && queue.length > 0) {
    const name = queue.shift()!;
    if (hasTractateText(name)) continue;
    inFlight += 1;
    getTractateText(name)
      .then((text) => {
        onLoadedCb?.(name, text);
      })
      .catch((err) => {
        console.warn(`[prefetch] ${name} failed:`, err);
      })
      .finally(() => {
        inFlight -= 1;
        if (queue.length > 0) pump(concurrency);
      });
  }
}

/**
 * Test-only: clear the queue and in-flight counter.
 */
export function resetPrefetchState(): void {
  queue = [];
  inFlight = 0;
  onLoadedCb = null;
}
