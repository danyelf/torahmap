// A URL-parameter lookup wired to the real overlays.
//
// URL tests use this instead of a hand-written table so that they exercise the
// same parameter declarations the app ships with. If an overlay changes which
// keys it owns, these tests see the change.

import type { Overlay } from '../../overlays/types.ts';
import type { OverlayParamSpecLookup } from '../../urlState.ts';
import { commentaryOverlay } from '../../overlays/commentary.ts';
import { tropOverlay } from '../../overlays/trop.ts';
import { searchOverlay } from '../../overlays/search.ts';
import { haftarahOverlay } from '../../overlays/haftarah.ts';
import { textDatingOverlay } from '../../overlays/text-dating.ts';
import { verseLengthOverlay } from '../../overlays/verse-length.ts';

export const allOverlays: Overlay[] = [
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  haftarahOverlay,
  textDatingOverlay,
  verseLengthOverlay,
];

const byId = new Map(allOverlays.map((overlay) => [overlay.id, overlay]));

export const overlayUrlParams: OverlayParamSpecLookup = (id) =>
  byId.get(id)?.urlParams;
