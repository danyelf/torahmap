// A faint tinted panel behind a group of squares: the Talmud's tractates, the VIS Map's days.

/** A panel's extent in map units. */
export interface CoverBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A panel tinted `rgb` (0-255 each) at `opacity`, with a one-pixel edge at `edgeOpacity` if given. */
export function coverElement(
  [r, g, b]: readonly [number, number, number],
  opacity: number,
  edgeOpacity?: number,
): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute;
    box-sizing:border-box;
    background:rgba(${r},${g},${b},${opacity});
    border-radius:4px;
    ${edgeOpacity === undefined ? '' : `border:1px solid rgba(${r},${g},${b},${edgeOpacity});`}
  `;
  return el;
}

/** Puts `el` over `box` at `zoom`, in the container's own coordinates. */
export function placeCover(el: HTMLElement, box: CoverBox, zoom: number): void {
  el.style.left = `${box.minX * zoom}px`;
  el.style.top = `${box.minY * zoom}px`;
  el.style.width = `${(box.maxX - box.minX) * zoom}px`;
  el.style.height = `${(box.maxY - box.minY) * zoom}px`;
}
