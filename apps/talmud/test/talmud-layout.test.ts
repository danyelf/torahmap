import { describe, it, expect } from 'vitest';
import { computeTalmudLayout, dafRowsOf } from '../src/layout.ts';
import { talmudFixture as fixture } from './helpers/talmudFixture.ts';
import { SEGMENT_SIZE, PEREK_GAP, SEDER_GAP, POSITION_JITTER } from '../src/constants.ts';

describe('computeTalmudLayout', () => {
  const result = computeTalmudLayout(fixture);

  it('emits one item per segment across all tractates', () => {
    // TractA: 5+4+6+3 = 18. TractB: 4+2 = 6. Total: 24.
    expect(result.items.length).toBe(24);
  });

  it('emits one tractateBlock per tractate', () => {
    expect(result.tractateBlocks.length).toBe(2);
    expect(result.tractateBlocks.map((t) => t.name).sort()).toEqual(['TractA', 'TractB']);
  });

  it('emits one sederBlock per represented seder', () => {
    expect(result.sederBlocks.length).toBe(2);
    expect(result.sederBlocks.map((s) => s.name).sort()).toEqual(['Seder Moed', 'Seder Zeraim']);
  });

  const amud = (daf: number, a: 'a' | 'b') =>
    result.items.filter((i) => i.tractate === 'TractA' && i.daf === daf && i.amud === a);

  it("puts an amud's segments side by side in one row, a square apart, from one right edge", () => {
    const rightEdges = new Set<number>();
    for (const row of [amud(2, 'a'), amud(2, 'b'), amud(3, 'a'), amud(3, 'b')]) {
      expect(new Set(row.map((i) => i.y)).size).toBe(1);
      const xs = row.map((i) => i.x);
      expect(xs.slice(1).map((x, k) => xs[k] - x)).toEqual(xs.slice(1).map(() => SEGMENT_SIZE));
      rightEdges.add(xs[0] + SEGMENT_SIZE);
    }
    expect(rightEdges.size).toBe(1);
  });

  it('places a PEREK_GAP between perakim', () => {
    expect(amud(3, 'b')[0].y - (amud(3, 'a')[0].y + SEGMENT_SIZE)).toBe(PEREK_GAP);
  });

  it('nudges each segment by its own jitter, at most POSITION_JITTER each way', () => {
    for (const { jitter } of result.items) {
      expect(Math.abs(jitter!.x)).toBeLessThanOrEqual(POSITION_JITTER);
      expect(Math.abs(jitter!.y)).toBeLessThanOrEqual(POSITION_JITTER);
    }
    expect(new Set(result.items.map((i) => i.jitter!.x)).size).toBeGreaterThan(1);
  });

  it('places a SEDER_GAP between shelves', () => {
    const tractA = result.tractateBlocks.find((t) => t.name === 'TractA')!;
    const tractB = result.tractateBlocks.find((t) => t.name === 'TractB')!;
    expect(tractB.minY - tractA.maxY).toBeGreaterThanOrEqual(SEDER_GAP);
  });

  it('produces non-negative coordinates (shifted into first quadrant)', () => {
    for (const item of result.items) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes bounds consistent with item positions', () => {
    let maxX = 0;
    let maxY = 0;
    for (const item of result.items) {
      if (item.x + item.size > maxX) maxX = item.x + item.size;
      if (item.y + item.size > maxY) maxY = item.y + item.size;
    }
    expect(result.bounds.width).toBe(maxX);
    expect(result.bounds.height).toBe(maxY);
  });

  it('returns a daf row for every amud', () => {
    expect(result.dafRows.length).toBe(
      new Set(result.items.map((i) => `${i.tractate}:${i.daf}${i.amud}`)).size,
    );
  });
});

describe('dafRowsOf', () => {
  const square = (amud: 'a' | 'b', segment: number, x: number, y: number) => ({
    tractate: 'T',
    daf: 2,
    amud,
    segment,
    id: `T.2${amud}.${segment}`,
    x,
    y,
    size: 6,
  });

  it("anchors each amud's label at its squares' right edge and top", () => {
    const rows = dafRowsOf([
      square('a', 1, 40, 12),
      square('a', 2, 30, 10),
      square('b', 1, 20, 30),
    ]);
    expect(rows).toEqual([
      { tractate: 'T', daf: 2, amud: 'a', rightX: 46, topY: 10 },
      { tractate: 'T', daf: 2, amud: 'b', rightX: 26, topY: 30 },
    ]);
  });
});
