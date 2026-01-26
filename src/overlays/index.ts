// src/overlays/index.ts
export type { Overlay, Color, OverlayConfig } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export { createCommentaryOverlay } from './commentary.ts';
export { createTropOverlay } from './trop.ts';
export { createSearchOverlay } from './search.ts';
export { haftarahOverlay } from './haftarah.ts';
