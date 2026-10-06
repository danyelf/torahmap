import type { TanakhOverlay } from './tanakhTypes.ts';
import { registerOverlay, clearOverlays } from './registry.ts';
import { commentaryOverlay } from './commentary.ts';
import { tropOverlay } from './trop.ts';
import { haftarahOverlay } from './haftarah.ts';
import { verseLengthOverlay } from './verse-length.ts';
import { OVERLAYS, type OverlayId } from '@torahmap/overlay-catalog';

export type { Overlay, Color } from './types.ts';
export type { TanakhOverlay, TanakhTool, TanakhTools } from './tanakhTypes.ts';
export { registerOverlay, getOverlay, getAllOverlays } from './registry.ts';
export { createOverlaySettings, settingsFromLink } from './settings.ts';
export { highlightTropInText } from './trop.ts';
export { configure as configureSearch } from '../tanakh/search/index.ts';

// The catalog decides which overlays the menu offers and in what order; this
// supplies the drawing code for each.
const IMPLEMENTATIONS: Record<OverlayId, TanakhOverlay> = {
  commentary: commentaryOverlay,
  trop: tropOverlay,
  haftarah: haftarahOverlay,
  'verse-length': verseLengthOverlay,
};

// Lives here rather than in the Tanakh's text so a test can put the app's real
// overlays in the registry the same way the app does.
export function registerAllOverlays(): void {
  clearOverlays();
  OVERLAYS.forEach(({ id }) => registerOverlay(IMPLEMENTATIONS[id]));
}
