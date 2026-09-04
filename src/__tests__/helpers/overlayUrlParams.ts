// Handing settings to an overlay the way the app does.
//
// Kept deliberately light: it pulls in urlState and nothing else, so a test for
// one overlay does not end up loading all six. Loading the whole overlay barrel
// into a single-overlay test drags in the search overlay's on-screen-keyboard
// dependency, after which happy-dom's NodeList.forEach visits nothing and
// unrelated DOM tests start failing. The list of every overlay therefore lives
// in allOverlays.ts, imported only by tests that genuinely need all of them.

import type { Overlay } from '../../overlays/types.ts';
import { validateOverlayParams } from '../../urlState.ts';

/**
 * Hand an overlay some settings the way the app does: through the validator,
 * so a test never gives an overlay a value the app could not have given it.
 */
export function applyOverlayParams(
  overlay: Overlay | undefined | null,
  raw: string | URLSearchParams | Record<string, string>,
): void {
  if (!overlay?.applyUrlParams) return;
  const params = typeof raw === 'string' ? new URLSearchParams(raw) : raw;
  overlay.applyUrlParams(validateOverlayParams(overlay.urlParams, params));
}
