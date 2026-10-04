import type { MapItem } from './types.ts';

/** Whether a and b are the same square. Two nulls are. */
export function sameItem(a: MapItem | null, b: MapItem | null): boolean {
  return (a?.id ?? null) === (b?.id ?? null);
}

export interface ItemIndex<I extends MapItem> {
  /** The square with this id, or null if the map holds none. */
  find(id: string): I | null;
  /** The square `by` places from `from` in layout order, or null past either end. */
  step(from: I, by: 1 | -1): I | null;
}

/** Indexes a layout by id. Two squares with one id are a layout bug, so it throws. */
export function indexItems<I extends MapItem>(items: readonly I[]): ItemIndex<I> {
  const at = new Map<string, number>();
  items.forEach((item, i) => {
    if (at.has(item.id)) throw new Error(`Two squares share the id ${item.id}`);
    at.set(item.id, i);
  });
  const nth = (i: number | undefined): I | null => (i === undefined ? null : (items[i] ?? null));
  return {
    find: (id) => nth(at.get(id)),
    step: (from, by) => {
      const i = at.get(from.id);
      return i === undefined ? null : nth(i + by);
    },
  };
}
