// A 2D canvas over the map that draws an overlay's pointers as thin wedges, widest where they leave
// their square. A prototype: drawn apart from the WebGL renderer, with nothing done about moiré.

import { colorToCss } from '@torahmap/utils';
import type { Pointer } from './overlays/types.ts';

// Half the width of a wedge where it leaves its square, in CSS pixels; a full-length one is wider.
const HALF_WIDTH = 0.9;
const HALF_WIDTH_FULL = 1.4;

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
    // One path per colour and width, filled once.
    const paths = new Map<string, Path2D>();
    for (const { from, to, length, color } of pointers) {
      const x0 = (from.x + offset.x) * zoom;
      const y0 = (from.y + offset.y) * zoom;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const d = Math.hypot(dx, dy);
      if (d === 0) continue;
      const t = length === null ? 1 : Math.min(1, length / d);
      const x1 = x0 + dx * t * zoom;
      const y1 = y0 + dy * t * zoom;
      if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > width) continue;
      if (Math.max(y0, y1) < 0 || Math.min(y0, y1) > height) continue;
      const w = length === null ? HALF_WIDTH_FULL : HALF_WIDTH;
      const nx = (-dy / d) * w;
      const ny = (dx / d) * w;
      const key = `${colorToCss(color)} ${w}`;
      let path = paths.get(key);
      if (!path) paths.set(key, (path = new Path2D()));
      path.moveTo(x0 + nx, y0 + ny);
      path.lineTo(x1, y1);
      path.lineTo(x0 - nx, y0 - ny);
      path.closePath();
    }
    for (const [key, path] of paths) {
      g.fillStyle = key.slice(0, key.lastIndexOf(' '));
      g.fill(path);
    }
  };
}
