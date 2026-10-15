// The registry is where overlays come from. Nothing outside this module should
// hold its own list: ask for an overlay by id, or ask for all of them.
import type { TanakhOverlay } from './tanakhTypes.ts';
import { SEARCH_KEYS } from '@torahmap/overlay-catalog';

const overlays = new Map<string, TanakhOverlay>();

export function registerOverlay(overlay: TanakhOverlay): void {
  const claimed = (overlay.urlParams ?? []).map((p) => p.key).filter((k) => SEARCH_KEYS.has(k));
  if (claimed.length > 0) {
    throw new Error(`${overlay.id} claims ${claimed.join(', ')}, which belong to the search`);
  }
  overlays.set(overlay.id, overlay);
}

export function getOverlay(id: string): TanakhOverlay | undefined {
  return overlays.get(id);
}

export function getAllOverlays(): TanakhOverlay[] {
  return Array.from(overlays.values());
}

// Registration is process-wide, so a test that wants a controlled set of
// overlays clears first and registers what it needs.
export function clearOverlays(): void {
  overlays.clear();
}
