// Numbers beside a column, each at the top of the row it numbers, which show by zoom level: the
// Talmud's daf numbers and the Act's article numbers.

interface Pan {
  x: number;
  y: number;
}

export interface Placed {
  el: HTMLElement;
  x: number;
  y: number;
}

/**
 * Labels that show and hide together. They are placed only when the zoom has
 * changed since they last were, and only while they show: a pan moves their
 * whole container.
 */
export function labelGroup(id: string, labels: Placed[]) {
  const el = document.createElement('div');
  if (id) el.id = id;
  for (const label of labels) el.appendChild(label.el);
  let placedAt = NaN;
  return {
    el,
    show(shown: boolean, zoom: number): void {
      el.style.display = shown ? '' : 'none';
      if (!shown || zoom === placedAt) return;
      placedAt = zoom;
      for (const { el, x, y } of labels) {
        el.style.left = `${x * zoom}px`;
        el.style.top = `${y * zoom}px`;
      }
    },
  };
}

/** A row's number: the edge of its column it stands beside, the row's top, and the zoom it shows from. */
export interface RowNumber {
  text: string;
  x: number;
  y: number;
  zoom: number;
}

/**
 * The numbers' size in pixels, which does not change with the zoom, how many pixels they stand
 * off their column, and which side of it.
 */
export interface RowNumberStyle {
  fontSize: number;
  offset: number;
  side: 'left' | 'right';
}

/** Draws the numbers in a container of their own inside `parent`, and returns what moves them with the map. */
export function createRowNumbers(
  id: string,
  rows: readonly RowNumber[],
  parent: HTMLElement,
  { fontSize, offset, side }: RowNumberStyle,
): (pan: Pan, zoom: number) => void {
  const shift = side === 'right' ? `${offset}px` : `calc(-100% - ${offset}px)`;
  const label = (row: RowNumber): Placed => {
    const el = document.createElement('div');
    el.className = 'row-number';
    el.style.cssText = `
      position:absolute;
      color:#888;
      font-family:system-ui, sans-serif;
      font-size:${fontSize}px;
      white-space:nowrap;
      line-height:1;
      transform:translate(${shift}, 0);
    `;
    el.textContent = row.text;
    return { el, x: row.x, y: row.y };
  };

  const container = document.createElement('div');
  container.id = id;
  const groups = [...new Set(rows.map((r) => r.zoom))].map((from) => ({
    from,
    group: labelGroup('', rows.filter((r) => r.zoom === from).map(label)),
  }));
  for (const { group } of groups) container.appendChild(group.el);
  parent.appendChild(container);

  return (pan, zoom) => {
    container.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    for (const { from, group } of groups) group.show(zoom >= from, zoom);
  };
}
