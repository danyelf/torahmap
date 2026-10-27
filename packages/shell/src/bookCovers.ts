// A faint panel behind each book, tinted. Both maps draw them: the Talmud's tractates by seder,
// and the Tanakh's books while an overlay asks for it.

import './bookCovers.css';

/** A cover's edges, in map units. */
export interface CoverRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Tint = readonly number[];

const rgb = (color: Tint): string => color.map((c) => Math.round(c * 255)).join(',');

/**
 * One panel per rect, each drawn at `opacity` in its tint, none while it has none. `place` moves
 * them for the zoom, and only when the zoom has changed since; the caller pans the container.
 */
export function createBookCovers(
  id: string,
  rects: readonly CoverRect[],
  tints: readonly (Tint | null)[],
  opacity: number,
) {
  const el = document.createElement('div');
  el.id = id;
  el.style.setProperty('--cover-opacity', String(opacity));
  const panels = rects.map(() => {
    const panel = document.createElement('div');
    panel.className = 'map-cover';
    el.appendChild(panel);
    return panel;
  });
  const tint = (i: number, color: Tint | null): void => {
    panels[i].hidden = color === null;
    if (color) panels[i].style.setProperty('--tint', rgb(color));
  };
  tints.forEach((color, i) => tint(i, color));

  let placedAt = NaN;
  return {
    el,
    tint,
    place(zoom: number): void {
      if (zoom === placedAt) return;
      placedAt = zoom;
      rects.forEach((rect, i) => {
        const style = panels[i].style;
        style.left = `${rect.minX * zoom}px`;
        style.top = `${rect.minY * zoom}px`;
        style.width = `${(rect.maxX - rect.minX) * zoom}px`;
        style.height = `${(rect.maxY - rect.minY) * zoom}px`;
      });
    },
  };
}
