import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';

/**
 * Call the prebuild of each overlay whose data `loaded()` completes or changes
 * since `before` (an optional file landing), one per idle turn so none holds up
 * a frame, and tell `settled` after each whether it built. Each builds from
 * `loaded()` when its turn comes, so none builds from data already stale. A
 * prebuild that throws still throws.
 */
export function prebuildCompleted<T>(
  overlays: readonly Overlay<T>[],
  before: Loaded,
  loaded: () => Loaded,
  settled: (overlay: Overlay<T>, built: boolean) => void,
  schedule: (run: () => void) => void,
): void {
  const after = loaded();
  const waiting = overlays.filter((overlay) => {
    const data = dataFor(overlay, after);
    return overlay.prebuild && data !== null && data !== dataFor(overlay, before);
  });
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    let built = false;
    try {
      overlay.prebuild?.(dataFor(overlay, loaded()));
      built = true;
    } finally {
      schedule(next);
      settled(overlay, built);
    }
  };
  if (waiting.length > 0) schedule(next);
}
