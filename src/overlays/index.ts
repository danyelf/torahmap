// src/overlays/index.ts
export type { Overlay, Color, OverlayConfig } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export { createCommentaryOverlay, commentaryOverlay, configureCommentary, getVerseLinkCount } from './commentary.ts';
export { createTropOverlay, tropOverlay, configureTrop, getSelectedTrop, highlightTropInText } from './trop.ts';
export { createSearchOverlay, searchOverlay, configure as configureSearch, highlightSearchTerms } from './search.ts';
export { haftarahOverlay } from './haftarah.ts';
