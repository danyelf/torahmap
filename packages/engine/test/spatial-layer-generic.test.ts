import { describe, it, expect } from 'vitest';
import { type SpatialItem, buildItemGeometry, findExactHit } from '../src/index.ts';

// A text's own fields on its squares, which the engine carries but never reads.
interface Place {
  book: string;
  line: number;
}

const items: SpatialItem<Place>[] = [
  { id: 'a.1', book: 'a', line: 1, x: 10, y: 20, size: 6 },
  { id: 'a.2', book: 'a', line: 2, x: 16, y: 20, size: 6 },
];

describe('squares that carry a text’s own fields', () => {
  it('are drawn', () => {
    const geom = buildItemGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it('come back from a hit with their fields', () => {
    expect(findExactHit(items, 12, 22)?.line).toBe(1);
  });
});
