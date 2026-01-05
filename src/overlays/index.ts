// src/overlays/index.ts
export type { Overlay, Color } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export { commentaryOverlay, setVerses as setCommentaryVerses, getVerseLinkCount } from './commentary.ts';
