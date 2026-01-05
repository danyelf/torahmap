// src/overlays/index.ts
export type { Overlay, Color, OverlayConfig } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export {
  commentaryOverlay,
  configure as configureCommentary,
  getVerseLinkCount,
} from './commentary.ts';
export {
  tropOverlay,
  configure as configureTrop,
  getSelectedTrop,
  highlightTropInText,
} from './trop.ts';
export {
  searchOverlay,
  configure as configureSearch,
} from './search.ts';
