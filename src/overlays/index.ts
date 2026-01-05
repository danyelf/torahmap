// src/overlays/index.ts
export type { Overlay, Color, OverlayConfig } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { divineNamesOverlay } from './divine-names.ts';
export {
  commentaryOverlay,
  configure as configureCommentary,
  setVerses as setCommentaryVerses, // @deprecated
  getVerseLinkCount,
} from './commentary.ts';
export {
  tropOverlay,
  configure as configureTrop,
  setVerseTexts as setTropVerseTexts, // @deprecated
  getSelectedTrop,
  highlightTropInText,
} from './trop.ts';
export {
  searchOverlay,
  configure as configureSearch,
  setSearchVerses, // @deprecated
  setSearchCallbacks, // @deprecated
} from './search.ts';
