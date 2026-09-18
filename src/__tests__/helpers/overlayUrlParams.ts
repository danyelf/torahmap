import { getOverlay } from '../../overlays/registry.ts';
import type { OverlayParamSpecLookup } from '../../urlState.ts';

/**
 * The lookup parseUrlState takes, resolved through the registry — exactly what
 * main.ts passes. Requires the registry to be populated first, normally with
 * registerAllOverlays().
 */
export const overlayUrlParams: OverlayParamSpecLookup = (id) => getOverlay(id)?.urlParams;
