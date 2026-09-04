// The full set of overlays, for tests that need to walk all of them.
//
// This reads ALL_OVERLAYS — the same list main.ts registers from — rather than
// keeping a copy, so there is nothing here that can drift out of step with the
// app. It deliberately does not read the registry: registerOverlay() is only
// called by main.ts, which unit tests never run, so under test the registry is
// empty and a test that walked it would pass without checking anything.
//
// Importing this pulls in every overlay, including the search overlay and its
// on-screen keyboard. Only import it where you actually need the whole set.

import { ALL_OVERLAYS } from '../../overlays/index.ts';
import type { OverlayParamSpecLookup } from '../../urlState.ts';

export { ALL_OVERLAYS };

const byId = new Map(ALL_OVERLAYS.map((overlay) => [overlay.id, overlay]));

/** The lookup parseUrlState takes, wired to the overlays the app ships. */
export const overlayUrlParams: OverlayParamSpecLookup = (id) =>
  byId.get(id)?.urlParams;
