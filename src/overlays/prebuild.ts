import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';
import { whenIdle } from '../utils/idle.ts';

/**
 * Call the prebuild of each overlay whose data `after` completes, with that
 * data, one per idle turn so none holds up a frame, and tell `built` after each.
 */
export function prebuildCompleted(
  overlays: readonly Overlay[],
  before: Loaded,
  after: Loaded,
  built: (overlay: Overlay) => void,
  schedule: (run: () => void) => void = whenIdle,
): void {
  const waiting = overlays.filter(
    (overlay) =>
      overlay.prebuild && dataFor(overlay, before) === null && dataFor(overlay, after) !== null,
  );
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    try {
      overlay.prebuild?.(dataFor(overlay, after));
      built(overlay);
    } finally {
      schedule(next);
    }
  };
  if (waiting.length > 0) schedule(next);
}
