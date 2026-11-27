// Zoomed out, the grey lines average into a haze that hides the folder edges and any colour, so
// they dim and the outer folders' edges thicken.

const FULL = 0.5; // the zoom at and above which nothing changes: a line 3 pixels tall
const OUT = 0.1; // the zoom at and below which the change is whole

/** How far zoomed out the map is: 0 at FULL and above, 1 at OUT and below. */
export function zoomedOut(zoom: number): number {
  const t = Math.min(Math.max((FULL - zoom) / (FULL - OUT), 0), 1);
  return t * t * (3 - 2 * t);
}

/** How bright a grey line is drawn. */
export const greyBrightness = (zoom: number): number => 1 - 0.55 * zoomedOut(zoom);

/** A folder's edge in pixels: the outer two thicken as the map zooms out. */
export const edgeWidth = (depth: number, zoom: number): number =>
  1 + (depth === 1 ? 2 : depth === 2 ? 1 : 0) * zoomedOut(zoom);
