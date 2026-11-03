// Which folder and file names show at a zoom, and where. A name keeps its size on screen, so
// zooming out crowds names together; those that run into one already shown are left out.

/** A name's place at rest and the room it has. Map units, except where it says pixels. */
export interface Name {
  x: number;
  y: number;
  /** Pixels added to `y` once scaled: a name standing above its point rises by its height. */
  dy: number;
  width: number; // pixels
  height: number; // pixels
  /** The edges the name must stay inside. */
  minY: number;
  maxX: number;
  maxY: number;
  /** A name that runs into one already shown moves down below it, if it still has room. */
  moves: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CELL = 128; // pixels; the grid of cells that finds the names a name might run into

const meets = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Each name's top in pixels at `zoom`, or null where it is left out. Names claim their places in
 * the order given.
 */
export function placeNames(names: readonly Name[], zoom: number): (number | null)[] {
  const grid = new Map<string, Rect[]>();
  const cells = (r: Rect) => {
    const keys = [];
    for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.width) / CELL); cx++) {
      for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.height) / CELL); cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  };
  const hit = (r: Rect) => {
    for (const key of cells(r)) {
      const found = grid.get(key)?.find((t) => meets(r, t));
      if (found) return found;
    }
    return null;
  };

  return names.map((name) => {
    const r = {
      x: name.x * zoom,
      y: name.y * zoom + name.dy,
      width: name.width,
      height: name.height,
    };
    const bottom = name.maxY * zoom;
    if (r.x + r.width > name.maxX * zoom || r.y < name.minY * zoom || r.y + r.height > bottom) {
      return null;
    }
    for (let blocker = hit(r); blocker; blocker = hit(r)) {
      if (!name.moves) return null;
      r.y = blocker.y + blocker.height;
      if (r.y + r.height > bottom) return null;
    }
    for (const key of cells(r)) {
      const cell = grid.get(key);
      if (cell) cell.push(r);
      else grid.set(key, [r]);
    }
    return r.y;
  });
}
