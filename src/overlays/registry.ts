// src/overlays/registry.ts
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
