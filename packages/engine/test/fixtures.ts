import type { Color } from '@torahmap/utils';
import type { MapItem, ZoomRange } from '../src/index.ts';

export const ZOOM: ZoomRange = { min: 0.1, max: 10, start: 1 };

export const RED: Color = [1, 0, 0];
export const GREEN: Color = [0, 1, 0];
export const BLUE: Color = [0, 0, 1];
export const WHITE: Color = [1, 1, 1];

export function createItem(overrides: Partial<MapItem> = {}): MapItem {
  return { id: '1', x: 10, y: 20, size: 6, ...overrides };
}

/** Squares 8 apart in rows of ten, with ids 1, 2, 3 and on. */
export function createItems(count: number, overrides: Partial<MapItem> = {}): MapItem[] {
  return Array.from({ length: count }, (_, i) =>
    createItem({ id: String(i + 1), x: (i % 10) * 8, y: Math.floor(i / 10) * 8, ...overrides }),
  );
}
