// src/overlays/index.ts
import type { Overlay } from './types.ts';
import { registerOverlay, clearOverlays } from './registry.ts';
import { commentaryOverlay } from './commentary.ts';
import { tropOverlay } from './trop.ts';
import { searchOverlay } from './search.ts';
import { haftarahOverlay } from './haftarah.ts';
import { textDatingOverlay } from './text-dating.ts';
import { verseLengthOverlay } from './verse-length.ts';

export type { Overlay, Color, OverlayConfig, UrlParamSpec, UrlParamKind, UrlParamValues } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays, clearOverlays } from './registry.ts';
export { applyOverlayParams } from './applyParams.ts';
export { configure as configureCommentary, getVerseLinkCount } from './commentary.ts';
export { configure as configureTrop, getSelectedTrop, highlightTropInText } from './trop.ts';
export { configure as configureSearch, highlightSearchTerms } from './search.ts';
export { getVerseDatingInfo } from './text-dating.ts';
export { configure as configureVerseLength } from './verse-length.ts';

/**
 * Every overlay the app ships, in the order they appear to the reader.
 *
 * This is the input to registration and nothing else. Code that wants an
 * overlay asks the registry for it; only registerAllOverlays reads this list.
 */
const ALL_OVERLAYS: readonly Overlay[] = [
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  haftarahOverlay,
  textDatingOverlay,
  verseLengthOverlay,
];

/**
 * Fill the registry with the overlays the app ships.
 *
 * This lives here rather than inside main(), so that a test can put the app's
 * real overlays in the registry the same way the app does and then read them
 * back out of the registry, instead of importing them behind its back.
 */
export function registerAllOverlays(): void {
  clearOverlays();
  ALL_OVERLAYS.forEach(registerOverlay);
}
