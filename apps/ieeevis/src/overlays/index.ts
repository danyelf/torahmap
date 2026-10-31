import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { PieceItem } from '../layout.ts';
import { authorsOverlay } from './authors.ts';
import { citationsOverlay } from './citations.ts';
import { COUPLING_SKETCH } from './couplingSketch.ts';
import { keywordsOverlay } from './keywords.ts';
import { kindsOverlay } from './kinds.ts';
import { sectionsOverlay } from './sections.ts';

export const VIS_OVERLAYS: Overlay<PieceItem>[] = [
  sectionsOverlay,
  kindsOverlay,
  authorsOverlay,
  keywordsOverlay,
  citationsOverlay,
  ...COUPLING_SKETCH,
];

/** The link parameters of the overlay with this id, if it has any. */
export const visOverlayParams = (id: string): readonly UrlParamSpec[] | undefined => {
  const overlay = VIS_OVERLAYS.find((o) => o.id === id);
  return overlay && 'urlParams' in overlay ? overlay.urlParams : undefined;
};
