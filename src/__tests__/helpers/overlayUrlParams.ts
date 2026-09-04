// Test-side plumbing for overlay URL parameters.
//
// applyOverlayParams is the app's own function, re-exported so that tests use
// the same door the app uses rather than a look-alike.

import { getOverlay } from '../../overlays/registry.ts';
import type { OverlayParamSpecLookup } from '../../urlState.ts';

export { applyOverlayParams } from '../../overlays/applyParams.ts';

/**
 * The lookup parseUrlState takes, resolved through the registry — exactly what
 * main.ts passes. Requires the registry to be populated first, normally with
 * registerAllOverlays().
 */
export const overlayUrlParams: OverlayParamSpecLookup = (id) =>
  getOverlay(id)?.urlParams;
