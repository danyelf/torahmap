// src/overlays/registry.ts
//
// The registry is where overlays come from. Nothing outside this module should
// hold its own list: ask for an overlay by id, or ask for all of them.
import type { Overlay } from './types.ts';

const overlays = new Map<string, Overlay>();

export function registerOverlay(overlay: Overlay): void {
  overlays.set(overlay.id, overlay);
}

export function getOverlay(id: string): Overlay | undefined {
  return overlays.get(id);
}

export function getAllOverlays(): Overlay[] {
  return Array.from(overlays.values());
}

/**
 * Empty the registry.
 *
 * Registration is process-wide, so a test that wants a controlled set of
 * overlays rather than the real ones clears first and registers what it needs.
 */
export function clearOverlays(): void {
  overlays.clear();
}
