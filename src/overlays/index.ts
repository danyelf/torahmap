// src/overlays/index.ts
import type { Overlay } from './types.ts';
import { commentaryOverlay } from './commentary.ts';
import { tropOverlay } from './trop.ts';
import { searchOverlay } from './search.ts';
import { haftarahOverlay } from './haftarah.ts';
import { textDatingOverlay } from './text-dating.ts';
import { verseLengthOverlay } from './verse-length.ts';

export type { Overlay, Color, OverlayConfig, UrlParamSpec, UrlParamKind, UrlParamValues } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { commentaryOverlay, configure as configureCommentary, getVerseLinkCount } from './commentary.ts';
export { tropOverlay, configure as configureTrop, getSelectedTrop, highlightTropInText } from './trop.ts';
export { searchOverlay, configure as configureSearch, highlightSearchTerms } from './search.ts';
export { haftarahOverlay } from './haftarah.ts';
export { textDatingOverlay, getVerseDatingInfo } from './text-dating.ts';
export { verseLengthOverlay, configure as configureVerseLength } from './verse-length.ts';

/**
 * Every overlay the app ships, in the order they appear to the reader.
 *
 * This is the one list. main.ts registers from it, and tests that need to walk
 * the overlays read it rather than keeping a copy that could fall behind.
 */
export const ALL_OVERLAYS: readonly Overlay[] = [
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  haftarahOverlay,
  textDatingOverlay,
  verseLengthOverlay,
];
