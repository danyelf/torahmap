import { describe, it, expect } from 'vitest';
import { mapPoint } from '../../mapPoint';

describe('mapPoint', () => {
  it('is the window point when the map starts at the window corner', () => {
    expect(mapPoint(120, 80, { left: 0, top: 0 })).toEqual({ x: 120, y: 80 });
  });

  it('measures from the map corner when the map starts to the right of a panel', () => {
    expect(mapPoint(500, 80, { left: 380, top: 0 })).toEqual({ x: 120, y: 80 });
  });
});
