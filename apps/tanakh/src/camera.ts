// Where the Tanakh's map opens.

import {
  LABEL_MARGIN,
  type Bounds,
  type Camera,
  type Viewport,
  type ZoomRange,
} from '@torahmap/engine';

// Opens with Genesis 1:1, the rightmost verse after the RTL mirror, this far
// in from the right edge of `windowWidth`: the map's own width unless a panel
// covers part of it.
const RIGHT_MARGIN = 320;

export function createCamera(
  viewport: Viewport,
  bounds: Bounds,
  range: ZoomRange,
  windowWidth: number = viewport.width,
): Camera {
  return {
    x: bounds.width - (windowWidth - RIGHT_MARGIN - viewport.width / 2),
    y: viewport.height / 2 - LABEL_MARGIN,
    zoom: range.start,
  };
}
