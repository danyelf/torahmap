import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';
import { whenIdle } from '../utils/idle.ts';

/**
 * Call the prebuild of each overlay whose data `after` completes, with that
 * data, one per idle turn so none holds up a frame, and tell `settled` after
 * each whether it built. A prebuild that throws still throws.
 */
export function prebuildCompleted<T>(
  overlays: readonly Overlay<T>[],
  before: Loaded,
  after: Loaded,
  settled: (overlay: Overlay<T>, built: boolean) => void,
  schedule: (run: () => void) => void = whenIdle,
): void {
  const waiting = overlays.filter(
    (overlay) =>
      overlay.prebuild && dataFor(overlay, before) === null && dataFor(overlay, after) !== null,
  );
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    let built = false;
    try {
      overlay.prebuild?.(dataFor(overlay, after));
      built = true;
    } finally {
      schedule(next);
      settled(overlay, built);
    }
  };
  if (waiting.length > 0) schedule(next);
}
