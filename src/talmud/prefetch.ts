// Background prefetch for Talmud tractate texts with click-time precedence.
//
// Design: docs/plans/2026-04-07-talmud-integration-design.md §3.12

import { getTractateText, hasTractateText } from "./data.ts";
import { PREFETCH_CONCURRENCY } from "./constants.ts";

let queue: string[] = [];
let inFlight = 0;

/**
 * Kick off background prefetch of all listed tractates.
 * Honors a concurrency cap; calls getTractateText (which populates the cache).
 */
export function startBackgroundPrefetch(
  tractateNames: string[],
  concurrency: number = PREFETCH_CONCURRENCY,
): void {
  queue = [...tractateNames];
  pump(concurrency);
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
}
