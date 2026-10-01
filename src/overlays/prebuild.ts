import type { Overlay } from './types.ts';
import { dataFor, type Loaded } from '../dataFiles.ts';
import { whenIdle } from '../utils/idle.ts';

/** Call each overlay's prebuild with its data, one per idle turn, so none holds up a frame. */
export function prebuildAll(
  overlays: readonly Overlay[],
  loaded: Loaded,
  schedule: (run: () => void) => void = whenIdle,
): void {
  const waiting = overlays.filter((overlay) => overlay.prebuild);
  const next = (): void => {
    const overlay = waiting.shift();
    if (!overlay) return;
    const data = dataFor(overlay, loaded);
    if (overlay.prebuild && data !== null) overlay.prebuild(data);
    schedule(next);
  };
  schedule(next);
}
