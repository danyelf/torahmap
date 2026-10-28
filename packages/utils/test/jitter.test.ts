import { describe, expect, it } from 'vitest';
import { brightnessJitter, idHash, positionJitter } from '../src/index.ts';

const seeds = [1, 2, 3, 4, 5, -77, 123456];

describe('position jitter', () => {
  it('stays within its range, repeats for a seed, and varies between seeds', () => {
    for (const s of seeds) {
      const j = positionJitter(s, 0.7);
      expect(Math.abs(j.x)).toBeLessThanOrEqual(0.7);
      expect(Math.abs(j.y)).toBeLessThanOrEqual(0.7);
      expect(positionJitter(s, 0.7)).toEqual(j);
    }
    expect(new Set(seeds.map((s) => positionJitter(s, 0.7).x)).size).toBeGreaterThan(1);
  });
});

describe('brightness jitter', () => {
  it('scales every channel by one factor within its range, and clamps to 1', () => {
    for (const s of seeds) {
      const [r, g, b] = brightnessJitter([0.2, 0.4, 0.6], s, 0.18);
      expect(g / r).toBeCloseTo(2);
      expect(b / r).toBeCloseTo(3);
      expect(r / 0.2).toBeGreaterThanOrEqual(0.82 - 1e-9);
      expect(r / 0.2).toBeLessThanOrEqual(1.18 + 1e-9);
    }
    expect(Math.max(...seeds.flatMap((s) => brightnessJitter([1, 1, 1], s, 0.18)))).toBe(1);
  });
});

describe('an id’s seed', () => {
  it('differs between ids and repeats for one', () => {
    const ids = ['6(1)', '6(2)', '5(1)(h)', 'Recital.1', 'Recital.2'];
    expect(new Set(ids.map(idHash)).size).toBe(ids.length);
    expect(idHash('6(1)')).toBe(idHash('6(1)'));
  });
});
