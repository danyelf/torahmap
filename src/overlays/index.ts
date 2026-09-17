import type { Overlay } from './types.ts';
import { registerOverlay, clearOverlays } from './registry.ts';
import { commentaryOverlay } from './commentary.ts';
import { tropOverlay } from './trop.ts';
import { searchOverlay } from './search.ts';
import { haftarahOverlay } from './haftarah.ts';
import { textDatingOverlay } from './text-dating.ts';
import { verseLengthOverlay } from './verse-length.ts';

export type { Overlay, Color, UrlParamSpec, UrlParamKind, UrlParamValues } from './types.ts';
export { registerOverlay, getOverlay, getAllOverlays, clearOverlays } from './registry.ts';
export { applyOverlayParams } from './applyParams.ts';
export { configure as configureCommentary, getVerseLinkCount } from './commentary.ts';
export { configure as configureTrop, getSelectedTrop, highlightTropInText } from './trop.ts';
export { configure as configureSearch, highlightSearchTerms } from './search.ts';
export { getVerseDatingInfo } from './text-dating.ts';
export { configure as configureVerseLength } from './verse-length.ts';

// Every overlay the app ships, in the order the reader sees them in the menu.
const ALL_OVERLAYS: readonly Overlay[] = [
  searchOverlay,
  commentaryOverlay,
  tropOverlay,
  haftarahOverlay,
  textDatingOverlay,
  verseLengthOverlay,
];

// Lives here rather than inside main() so a test can put the app's real
// overlays in the registry the same way the app does.
export function registerAllOverlays(): void {
  clearOverlays();
  ALL_OVERLAYS.forEach(registerOverlay);
}
