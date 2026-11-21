import { describe, it, expect } from 'vitest';
import { computeTalmudLayout } from '../src/layout.ts';
import { talmudFixture as fixture } from './helpers/talmudFixture.ts';
import {
  BOOK_GAP,
  DAF_LABEL,
  DAF_LABEL_ROOM,
  MIN_PEREK_STUB_ROWS,
  PEREK_GAP,
  PEREK_LABEL_ZOOM,
  POSITION_JITTER,
  SEDER_GAP,
  SEGMENT_SIZE,
} from '../src/constants.ts';

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

  it('returns a daf row for every amud', () => {
    expect(result.dafRows.length).toBe(
      new Set(result.items.map((i) => `${i.tractate}:${i.daf}${i.amud}`)).size,
    );
  });

  it("puts each amud's daf label at its first row's edge and top", () => {
    const rows = result.dafRows.filter((r) => r.tractate === 'TractA');
    expect(rows.map((r) => `${r.daf}${r.amud}`)).toEqual(['2a', '2b', '3a', '3b']);
    expect(new Set(rows.map((r) => r.rightX)).size).toBe(1);
    const S = SEGMENT_SIZE;
    expect(rows.map((r) => r.topY - rows[0].topY)).toEqual([0, S, 2 * S, 3 * S + PEREK_GAP]);
  });
});

describe('a tractate long enough to wrap into columns', () => {
  const amudim = Array.from({ length: 60 }, (_, i) => ({
    daf: 2 + Math.floor(i / 2),
    amud: i % 2 === 0 ? ('a' as const) : ('b' as const),
    segmentCount: 3,
    perekIdx: 0,
    mishnahMask: [false, false, false],
  }));
  const result = computeTalmudLayout({
    tractates: [
      {
        name: 'Long',
        hebrewName: 'ארוך',
        seder: 'Moed',
        amudim,
        perakim: [
          {
            hebrewName: 'פרק א',
            startAmudIdx: 0,
            endAmudIdx: 59,
            startSegmentInFirstAmud: 1,
            endSegmentInLastAmud: 3,
          },
        ],
      },
    ],
  });
  const columnEdges = [...new Set(result.dafRows.map((r) => r.rightX))];

  it("numbers each column's amudim at that column's right edge, from the same top", () => {
    expect(columnEdges).toHaveLength(2);
    const firstOf = (edge: number) => result.dafRows.find((r) => r.rightX === edge)!;
    expect(firstOf(columnEdges[1]).topY).toBe(firstOf(columnEdges[0]).topY);
  });

  it("leaves the room beside a column clear for its daf numbers, where they're largest", () => {
    const tall = DAF_LABEL.fontSize / PEREK_LABEL_ZOOM;
    for (const { rightX, topY } of result.dafRows) {
      const inRoom = result.items.filter(
        (s) =>
          s.x < rightX + DAF_LABEL_ROOM.right &&
          s.x + s.size > rightX + POSITION_JITTER &&
          s.y < topY + tall &&
          s.y + s.size > topY,
      );
      expect(inRoom.map((s) => s.id)).toEqual([]);
    }
  });
});

describe("each tractate's cover", () => {
  // TractB and the shorter TractC share Moed's shelf; TractA, on Zeraim's, is the tallest.
  const tractB = fixture.tractates[1];
  const tractC = { ...tractB, name: 'TractC', amudim: tractB.amudim.slice(0, 1) };
  const result = computeTalmudLayout({ tractates: [...fixture.tractates, tractC] });
  const block = (name: string) => result.tractateBlocks.find((t) => t.name === name)!;
  const cover = (name: string) => block(name).cover;

  it("is as tall as the tallest tractate's on its shelf", () => {
    const height = (name: string) => cover(name).maxY - cover(name).minY;
    const squaresHeight = (name: string) => block(name).maxY - block(name).minY;
    expect(squaresHeight('TractC')).toBeLessThan(squaresHeight('TractB'));
    expect(height('TractC')).toBe(height('TractB'));
    expect(height('TractA')).toBeGreaterThan(height('TractB'));
  });

  it("holds its tractate's squares, and the room for its daf numbers", () => {
    for (const { name, cover } of result.tractateBlocks) {
      for (const s of result.items.filter((i) => i.tractate === name)) {
        expect(s.x).toBeGreaterThanOrEqual(cover.minX);
        expect(s.y).toBeGreaterThanOrEqual(cover.minY);
        expect(s.y + s.size).toBeLessThanOrEqual(cover.maxY);
      }
      for (const d of result.dafRows.filter((r) => r.tractate === name)) {
        expect(d.rightX + DAF_LABEL_ROOM.right).toBeLessThanOrEqual(cover.maxX);
      }
    }
  });

  it('stands BOOK_GAP from the next on its shelf', () => {
    expect(cover('TractB').minX - cover('TractC').maxX).toBe(BOOK_GAP);
    expect(cover('TractB').minY).toBe(cover('TractC').minY);
  });

  it('sets the bounds, starting at 0', () => {
    const covers = result.tractateBlocks.map((t) => t.cover);
    expect(Math.min(...covers.map((c) => c.minX))).toBe(0);
    expect(result.bounds.width).toBe(Math.max(...covers.map((c) => c.maxX)));
    expect(result.bounds.height).toBe(Math.max(...covers.map((c) => c.maxY)));
  });
});

describe('a tractate split into columns', () => {
  // One amud a row, three squares each, perakim of the given lengths in rows.
  const tractateOf = (perekRows: number[]) => {
    const amudim = perekRows.flatMap((count, perekIdx) =>
      Array.from({ length: count }, () => ({ perekIdx })),
    );
    return {
      name: 'Split',
      hebrewName: 'פיצול',
      seder: 'Moed',
      amudim: amudim.map(({ perekIdx }, i) => ({
        daf: 2 + Math.floor(i / 2),
        amud: i % 2 === 0 ? ('a' as const) : ('b' as const),
        segmentCount: 3,
        perekIdx,
        mishnahMask: [false, false, false],
      })),
      perakim: perekRows.map((_, i) => ({
        hebrewName: `פרק ${i}`,
        startAmudIdx: 0,
        endAmudIdx: 0,
        startSegmentInFirstAmud: 1,
        endSegmentInLastAmud: 3,
      })),
    };
  };

  /** Each column's rows, as the perek each belongs to, read off the squares. */
  const columnsOf = (perekRows: number[]) => {
    const tractate = tractateOf(perekRows);
    const result = computeTalmudLayout({ tractates: [tractate] });
    const perekOf = (daf: number, amud: string) =>
      tractate.amudim[(daf - 2) * 2 + (amud === 'b' ? 1 : 0)].perekIdx;
    const edges = [...new Set(result.dafRows.map((r) => r.rightX))].sort((a, b) => b - a);
    const columns = edges.map((edge, c) => {
      const rows = new Map<number, number>();
      for (const s of result.items) {
        if (s.x < edge && (c === edges.length - 1 || s.x >= edges[c + 1])) {
          rows.set(s.y, perekOf(s.daf, s.amud));
        }
      }
      return [...rows].sort((a, b) => a[0] - b[0]);
    });
    return { result, columns };
  };

  it('cuts through a perek only where each side keeps at least MIN_PEREK_STUB_ROWS rows', () => {
    // Perakim whose natural cut points all fall near a few rows of a perek.
    for (const perekRows of [
      [53, 53, 53, 53],
      [52, 3, 52, 3, 52],
      [27, 27, 27, 27, 27, 27, 27, 27],
    ]) {
      const { columns } = columnsOf(perekRows);
      expect(columns.length).toBeGreaterThan(1);
      for (let c = 0; c < columns.length - 1; c++) {
        const lastPerek = columns[c].at(-1)![1];
        if (columns[c + 1][0][1] !== lastPerek) continue;
        const rowsOf = (col: (typeof columns)[number]) =>
          col.filter(([, p]) => p === lastPerek).length;
        expect(rowsOf(columns[c])).toBeGreaterThanOrEqual(MIN_PEREK_STUB_ROWS);
        expect(rowsOf(columns[c + 1])).toBeGreaterThanOrEqual(MIN_PEREK_STUB_ROWS);
      }
    }
  });

  it('cuts so the columns come out as tall as each other, to within a couple of rows', () => {
    // Perakim of 60 and 40 rows: cutting between them leaves a column 20 rows taller.
    const { columns } = columnsOf([60, 40]);
    const heights = columns.map((c) => c.at(-1)![0] - c[0][0] + SEGMENT_SIZE);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2 * SEGMENT_SIZE);
  });

  it('marks a perek that carries on into the next column, and only that one', () => {
    const { result, columns } = columnsOf([40, 40, 40]);
    const continued = result.perekAnchors.filter((a) => a.continued);
    const carriedOn = columns.slice(1).filter((col, c) => col[0][1] === columns[c].at(-1)![1]);
    expect(continued).toHaveLength(carriedOn.length);
    expect(continued.every((a) => a.topY === result.perekAnchors[0].topY)).toBe(true);
  });
});
