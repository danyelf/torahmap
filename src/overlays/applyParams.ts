// src/overlays/applyParams.ts
import type { Overlay } from './types.ts';
import { validateOverlayParams, applyingExternalState } from '../urlState.ts';

/**
 * Give an overlay settings that came from outside the app — a shared link, a
 * story stop. This is the only way settings should reach an overlay, and it is
 * where two rules are kept, once, for every overlay there is or will be:
 *
 *  - the values are checked against the overlay's own declaration first, so an
 *    overlay never receives a key it did not name or a value it did not allow;
 *  - URL writes are off for the duration, so an overlay that announces the
 *    change it was just handed cannot write those settings back out. Restoring
 *    a link must not rewrite the link.
 */
export function applyOverlayParams(
  overlay: Overlay | null | undefined,
  raw: URLSearchParams | Readonly<Record<string, string | undefined>>,
): void {
  const apply = overlay?.applyUrlParams;
  if (!overlay || !apply) return;

  applyingExternalState(() => {
    apply.call(overlay, validateOverlayParams(overlay.urlParams, raw));
  });
}
