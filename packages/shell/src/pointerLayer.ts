// A 2D canvas over the map that draws an overlay's pointers as thin wedges, widest where they leave
// their square. One that reaches all the way is an hourglass: from each end it flares in to a hairline
// that runs to the other. A prototype: drawn apart from the WebGL renderer, with nothing done about
// moiré.

import { colorToCss } from '@torahmap/utils';
import type { Pointer } from './overlays/types.ts';

// Half the width of a wedge where it leaves its square, in CSS pixels; a full-length one is wider.
const HALF_WIDTH = 0.9;
const HALF_WIDTH_FULL = 1.4;
// An hourglass narrows to a hairline at its waist, never to nothing.
const HALF_WIDTH_WAIST = 0.3;
// How far along each half of an hourglass it reaches the hairline: a share of the half, at most so
// many CSS pixels.
const FLARE_SHARE = 0.25;
const FLARE_MAX = 40;

/** Lays a canvas over `map` and returns what draws `pointers` at the camera's offset and zoom. */
export function createPointerLayer(map: HTMLCanvasElement) {
  const layer = document.createElement('canvas');
  layer.id = 'map-pointers';
  map.after(layer);
  const g = layer.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  function fit(): void {
    const rect = map.getBoundingClientRect();
    Object.assign(layer.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    layer.width = Math.round(rect.width * dpr);
    layer.height = Math.round(rect.height * dpr);
  }
  fit();
  new ResizeObserver(fit).observe(map);

  return function draw(
    pointers: readonly Pointer[],
    offset: { x: number; y: number },
    zoom: number,
  ) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, layer.width, layer.height);
    if (pointers.length === 0) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = layer.width / dpr;
    const height = layer.height / dpr;
    // One path per colour and opacity, filled once.
    const paths = new Map<string, Path2D>();
    // From (x0, y0), half `w` wide, to a point at (x1, y1).
    const wedge = (path: Path2D, x0: number, y0: number, x1: number, y1: number, w: number) => {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const ux = -(y1 - y0) / d;
      const uy = (x1 - x0) / d;
      path.moveTo(x0 + ux * w, y0 + uy * w);
      path.lineTo(x1, y1);
      path.lineTo(x0 - ux * w, y0 - uy * w);
      path.closePath();
    };
    // From (x0, y0), half `w` wide, curving in to a hairline that runs on to (x1, y1).
    const flare = (path: Path2D, x0: number, y0: number, x1: number, y1: number, w: number) => {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const ax = (x1 - x0) / d;
      const ay = (y1 - y0) / d;
      const at = (along: number, side: number) =>
        [x0 + ax * along - ay * side, y0 + ay * along + ax * side] as const;
      const f = Math.min(d * FLARE_SHARE, FLARE_MAX);
      const t = HALF_WIDTH_WAIST;
      path.moveTo(...at(0, w));
      path.quadraticCurveTo(...at(f * 0.3, t), ...at(f, t));
      path.lineTo(...at(d, t));
      path.lineTo(...at(d, -t));
      path.lineTo(...at(f, -t));
      path.quadraticCurveTo(...at(f * 0.3, -t), ...at(0, -w));
      path.closePath();
    };
    for (const { from, to, length, color, opacity = 1 } of pointers) {
      const x0 = (from.x + offset.x) * zoom;
      const y0 = (from.y + offset.y) * zoom;
      const x2 = (to.x + offset.x) * zoom;
      const y2 = (to.y + offset.y) * zoom;
      const d = Math.hypot(x2 - x0, y2 - y0);
      if (d === 0) continue;
      const t = length === null ? 1 : Math.min(1, (length * zoom) / d);
      const x1 = x0 + (x2 - x0) * t;
      const y1 = y0 + (y2 - y0) * t;
      if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > width) continue;
      if (Math.max(y0, y1) < 0 || Math.min(y0, y1) > height) continue;
      const key = `${colorToCss(color)} ${opacity}`;
      let path = paths.get(key);
      if (!path) paths.set(key, (path = new Path2D()));
      if (length !== null) wedge(path, x0, y0, x1, y1, HALF_WIDTH);
      else {
        const mx = (x0 + x2) / 2;
        const my = (y0 + y2) / 2;
        flare(path, x0, y0, mx, my, HALF_WIDTH_FULL);
        flare(path, x2, y2, mx, my, HALF_WIDTH_FULL);
      }
    }
    for (const [key, path] of paths) {
      const split = key.lastIndexOf(' ');
      g.fillStyle = key.slice(0, split);
      g.globalAlpha = Number(key.slice(split + 1));
      g.fill(path);
    }
    g.globalAlpha = 1;
  };
}
