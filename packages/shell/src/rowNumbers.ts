// Numbers at the rows of a column, which show by zoom level: the Talmud's daf numbers beside
// each row, and the Act's article numbers above each article.

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

/** A row's number, where it stands in map units, and the zoom it shows from. */
export interface RowNumber {
  text: string;
  x: number;
  y: number;
  zoom: number;
}

/**
 * The numbers' size in pixels, which does not change with the zoom, and which side of its point
 * each stands, `offset` pixels off it. Beside a column, the point is the column's edge at the row's
 * top; above, the number's left edge lines up with the point.
 */
export interface RowNumberStyle {
  fontSize: number;
  offset: number;
  side: 'left' | 'right' | 'above';
}

function shift({ side, offset }: RowNumberStyle): string {
  if (side === 'above') return `translate(0, calc(-100% - ${offset}px))`;
  if (side === 'right') return `translate(${offset}px, 0)`;
  return `translate(calc(-100% - ${offset}px), 0)`;
}

/** Draws the numbers in a container of their own inside `parent`, and returns what moves them with the map. */
export function createRowNumbers(
  id: string,
  rows: readonly RowNumber[],
  parent: HTMLElement,
  style: RowNumberStyle,
): (pan: Pan, zoom: number) => void {
  const label = (row: RowNumber): Placed => {
    const el = document.createElement('div');
    el.className = 'row-number';
    el.style.cssText = `
      position:absolute;
      color:#888;
      font-family:system-ui, sans-serif;
      font-size:${style.fontSize}px;
      white-space:nowrap;
      line-height:1;
      transform:${shift(style)};
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
