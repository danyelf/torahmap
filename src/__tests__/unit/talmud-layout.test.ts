import { describe, it, expect } from 'vitest';
import { computeTalmudLayout } from '../../talmud/layout.ts';
import { talmudFixture as fixture } from '../helpers/talmudFixture.ts';
import { SEGMENT_SIZE, PEREK_GAP, SEDER_GAP } from '../../talmud/constants.ts';

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

  it('each amud row within a tractate shares the same right edge (within ±jitter)', () => {
    const tractA = result.items.filter((i) => i.tractate === 'TractA');
    const rows = new Map<string, typeof result.items>();
    for (const item of tractA) {
      const key = `${item.daf}${item.amud}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(item);
    }
    const rightEdges: number[] = [];
    for (const row of rows.values()) {
      const rightmost = row.reduce((acc, cur) => (cur.segment < acc.segment ? cur : acc));
      rightEdges.push(rightmost.x + rightmost.size);
    }
    // All right edges should fall inside a small jitter window (±2 × jitter,
    // since both x and the size end can move).
    const min = Math.min(...rightEdges);
    const max = Math.max(...rightEdges);
    expect(max - min).toBeLessThanOrEqual(2 * 2 * 1.5); // 2px jitter window per side, with margin
  });

  it('row width equals segment count × SEGMENT_SIZE (within ±jitter)', () => {
    const row0 = result.items.filter(
      (i) => i.tractate === 'TractA' && i.daf === 2 && i.amud === 'a',
    );
    expect(row0.length).toBe(5);
    const minX = Math.min(...row0.map((i) => i.x));
    const maxX = Math.max(...row0.map((i) => i.x + i.size));
    // ±POSITION_JITTER on both sides, so window is up to 2*2*jitter wide.
    expect(maxX - minX).toBeGreaterThanOrEqual(5 * SEGMENT_SIZE - 4);
    expect(maxX - minX).toBeLessThanOrEqual(5 * SEGMENT_SIZE + 4);
  });

  it('places a PEREK_GAP between perakim (within ±jitter)', () => {
    const perek0LastRow = result.items.filter(
      (i) => i.tractate === 'TractA' && i.daf === 3 && i.amud === 'a',
    );
    const perek1FirstRow = result.items.filter(
      (i) => i.tractate === 'TractA' && i.daf === 3 && i.amud === 'b',
    );
    const perek0Bottom = Math.max(...perek0LastRow.map((i) => i.y + i.size));
    const perek1Top = Math.min(...perek1FirstRow.map((i) => i.y));
    const gap = perek1Top - perek0Bottom;
    // PEREK_GAP ±jitter on each side.
    expect(gap).toBeGreaterThanOrEqual(PEREK_GAP - 4);
    expect(gap).toBeLessThanOrEqual(PEREK_GAP + 4);
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

  it("anchors each amud's daf label at its row's right edge and top", () => {
    expect(result.dafRows.length).toBe(
      new Set(result.items.map((i) => `${i.tractate}:${i.daf}${i.amud}`)).size,
    );
    for (const row of result.dafRows) {
      const squares = result.items.filter(
        (i) => i.tractate === row.tractate && i.daf === row.daf && i.amud === row.amud,
      );
      expect(row.rightX).toBe(Math.max(...squares.map((s) => s.x + s.size)));
      expect(row.topY).toBe(Math.min(...squares.map((s) => s.y)));
    }
  });
});
