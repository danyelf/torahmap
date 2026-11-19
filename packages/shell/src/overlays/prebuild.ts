import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';

/**
 * Call the prebuild of each overlay whose data `after` completes or changes,
 * one per idle turn so none holds up a frame, and tell `settled` after each
 * whether it built. An overlay's data changes when an optional file of its
 * lands, and what it built from the data before is then stale.
 *
 * Each runs with the data `current` gives when its turn comes, so a prebuild
 * queued before a later file landed builds from everything in, and the one
 * that file queued finds it built. A prebuild that throws still throws.
 */
export function prebuildCompleted<T>(
  overlays: readonly Overlay<T>[],
  before: Loaded,
  after: Loaded,
  settled: (overlay: Overlay<T>, built: boolean) => void,
  schedule: (run: () => void) => void,
  current: () => Loaded = () => after,
): void {
  const waiting = overlays.filter(
    (overlay) =>
      overlay.prebuild &&
      dataFor(overlay, after) !== null &&
      dataFor(overlay, after) !== dataFor(overlay, before),
  );
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    let built = false;
    try {
      overlay.prebuild?.(dataFor(overlay, current()));
      built = true;
    } finally {
      schedule(next);
      settled(overlay, built);
    }
  };
  if (waiting.length > 0) schedule(next);
}
