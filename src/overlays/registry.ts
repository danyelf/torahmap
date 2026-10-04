// The registry is where overlays come from. Nothing outside this module should
// hold its own list: ask for an overlay by id, or ask for all of them.
import type { TanakhIdentity } from '../types.ts';
import type { Overlay } from './types.ts';
import { SEARCH_KEYS } from '@torahmap/link';

const overlays = new Map<string, Overlay<TanakhIdentity>>();

export function registerOverlay(overlay: Overlay<TanakhIdentity>): void {
  const claimed = (overlay.urlParams ?? []).map((p) => p.key).filter((k) => SEARCH_KEYS.has(k));
  if (claimed.length > 0) {
    throw new Error(`${overlay.id} claims ${claimed.join(', ')}, which belong to the search`);
  }
  overlays.set(overlay.id, overlay);
}

export function getOverlay(id: string): Overlay<TanakhIdentity> | undefined {
  return overlays.get(id);
}

export function getAllOverlays(): Overlay<TanakhIdentity>[] {
  return Array.from(overlays.values());
}

// Registration is process-wide, so a test that wants a controlled set of
// overlays clears first and registers what it needs.
export function clearOverlays(): void {
  overlays.clear();
}
