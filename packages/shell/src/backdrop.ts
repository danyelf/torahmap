// A faint colour field behind the squares, drawn in the label layer as one conic gradient.
// A conic gradient is a hue by angle around a centre, so it needs no pass of the renderer's
// own, and its centre and stops are fractions of its box, which zooming does not change.

import type { Backdrop } from './overlays/types.ts';

interface Pan {
  x: number;
  y: number;
}

/** The field inside `parent`, below what is already there; `show` sets or clears it, and the returned `place` moves it with the map. */
export function createBackdrop(parent: HTMLElement) {
  const layer = document.createElement('div');
  layer.id = 'map-backdrop';
  const field = document.createElement('div');
  field.style.position = 'absolute';
  field.hidden = true;
  layer.appendChild(field);
  parent.prepend(layer);

  let shown: Backdrop | null = null;
  let placedAt = NaN;
  return {
    show(next: Backdrop | null): void {
      shown = next;
      placedAt = NaN;
      field.hidden = next === null;
      if (!next) return;
      const { rect, centre, stops, opacity } = next;
      const x = ((centre.x - rect.minX) / (rect.maxX - rect.minX)) * 100;
      const y = ((centre.y - rect.minY) / (rect.maxY - rect.minY)) * 100;
      field.style.background = `conic-gradient(from 0deg at ${x}% ${y}%, ${stops
        .map((colour, i) => `${colour} ${(i / stops.length) * 360}deg`)
        .join(', ')}, ${stops[0]} 360deg)`;
      field.style.opacity = String(opacity);
    },
    place(pan: Pan, zoom: number): void {
      layer.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
      if (!shown || zoom === placedAt) return;
      placedAt = zoom;
      const { rect } = shown;
      field.style.left = `${rect.minX * zoom}px`;
      field.style.top = `${rect.minY * zoom}px`;
      field.style.width = `${(rect.maxX - rect.minX) * zoom}px`;
      field.style.height = `${(rect.maxY - rect.minY) * zoom}px`;
    },
  };
}
