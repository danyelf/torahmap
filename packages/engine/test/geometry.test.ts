import type { Color } from '@torahmap/utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildItemGeometry,
  createBuffer,
  packColor,
  FLOATS_PER_ITEM,
  MULTICOLOR_GROWTH,
  ITEM_ATTRIBUTES,
  ITEM_OFFSETS,
  type ItemAttributeName,
} from '../src/index.ts';
import { createItem, createItems, RED, GREEN, BLUE, WHITE } from './fixtures.ts';
import { createMockWebGL2Context } from './mocks.ts';

const SIZE = Object.fromEntries(ITEM_ATTRIBUTES.map((a) => [a.name, a.size])) as Record<
  ItemAttributeName,
  number
>;

function field(buffer: Float32Array, item: number, name: ItemAttributeName): number[] {
  const size = SIZE[name];
  const start = item * FLOATS_PER_ITEM + ITEM_OFFSETS[name];
  return Array.from(buffer.subarray(start, start + size));
}

/** Four stripes as the buffer holds them: packed, and zero where unused. */
const packed = (...colors: Color[]): number[] =>
  [0, 1, 2, 3].map((s) => (colors[s] ? packColor(colors[s]) : 0));

describe('packColor', () => {
  it('packs eight bits a channel, red highest', () => {
    expect(packColor([1, 0, 0])).toBe(0xff0000);
    expect(packColor([0, 1, 0])).toBe(0x00ff00);
    expect(packColor([0, 0, 1])).toBe(0x0000ff);
  });

  it('clamps what hover brightening pushes past 1, and rounds', () => {
    expect(packColor([1.5, -0.2, 0.5])).toBe(0xff0080);
  });

  it('survives the float buffer exactly', () => {
    const white = packColor([1, 1, 1]);
    expect(new Float32Array([white])[0]).toBe(white);
  });
});

describe('buildItemGeometry', () => {
  it('holds one entry per square', () => {
    expect(buildItemGeometry(createItems(7))).toHaveLength(7 * FLOATS_PER_ITEM);
    expect(buildItemGeometry([])).toHaveLength(0);
  });

  describe('rectangle', () => {
    it('spans the square, less the 2-unit gap between squares', () => {
      const buffer = buildItemGeometry([createItem({ x: 100, y: 200, size: 10 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100, 200, 108, 208]);
    });

    it('keeps fractional positions', () => {
      const buffer = buildItemGeometry([createItem({ x: 100.5, y: 200.75, size: 8 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100.5, 200.75, 106.5, 206.75]);
    });

    it('gives each square its own rectangle', () => {
      const items = [createItem({ x: 10, y: 20 }), createItem({ x: 30, y: 40 })];
      const buffer = buildItemGeometry(items);
      expect(field(buffer, 0, 'a_rect').slice(0, 2)).toEqual([10, 20]);
      expect(field(buffer, 1, 'a_rect').slice(0, 2)).toEqual([30, 40]);
    });
  });

  describe('growth', () => {
    it('grows by less than half the gap, so neighbours never touch', () => {
      expect(MULTICOLOR_GROWTH).toBeGreaterThan(0);
      expect(MULTICOLOR_GROWTH).toBeLessThan(1); // the gap between squares is 2
    });

    it('grows a square with several colours fully, and one with one colour not at all', () => {
      const buffer = buildItemGeometry(createItems(2), { colors: [[RED, BLUE], RED] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(1);
      expect(field(buffer, 1, 'a_shape')[1]).toBe(0);
    });

    it('grows a square whose ring has several colours', () => {
      const buffer = buildItemGeometry([createItem()], { colors: [RED], rings: [[GREEN, BLUE]] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(1);
    });

    it('grows a square by the fraction it is given, whatever its colours', () => {
      const buffer = buildItemGeometry([createItem()], { colors: [[RED, BLUE]], growth: [0.5] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(0.5);
    });
  });

  describe('colours', () => {
    it('packs the square colour, zero after it, and a count of 1', () => {
      const buffer = buildItemGeometry([createItem()], { colors: [RED] });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(1);
    });

    it('falls back to the base colour, then to the default fill', () => {
      const base: Color = [0.2, 0.3, 0.4];
      const given = buildItemGeometry([createItem()], undefined, undefined, base);
      expect(field(given, 0, 'a_fill')[0]).toBe(packColor(base));

      const fallback = buildItemGeometry([createItem()], { colors: [[]] });
      expect(field(fallback, 0, 'a_fill')[0]).toBe(packColor([0.6, 0.6, 0.6]));
    });

    it('keeps several colours in order with their count', () => {
      const buffer = buildItemGeometry([createItem()], { colors: [[RED, GREEN, BLUE]] });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, GREEN, BLUE));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(3);
    });

    it('keeps at most four colours', () => {
      const buffer = buildItemGeometry([createItem()], {
        colors: [[RED, GREEN, BLUE, WHITE, RED]],
      });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, GREEN, BLUE, WHITE));
      expect(field(buffer, 0, 'a_shape')[0]).toBe(4);
    });

    it('colours each square independently', () => {
      const buffer = buildItemGeometry(createItems(3), {
        colors: [RED, [BLUE, GREEN], undefined as never],
      });
      expect([0, 1, 2].map((i) => field(buffer, i, 'a_shape')[0])).toEqual([1, 2, 1]);
    });
  });

  describe('rings', () => {
    it('holds no ring for a square without one', () => {
      const buffer = buildItemGeometry([createItem()], { colors: [RED], rings: [null] });
      expect(field(buffer, 0, 'a_ring')).toEqual([0, 0, 0, 0]);
      expect(field(buffer, 0, 'a_shape')[2]).toBe(0);
    });

    it('holds a ring in stripes of its own beside the fill', () => {
      const buffer = buildItemGeometry([createItem()], {
        colors: [GREEN],
        rings: [[RED, BLUE]],
      });
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(GREEN));
      expect(field(buffer, 0, 'a_ring')).toEqual(packed(RED, BLUE));
      expect(field(buffer, 0, 'a_shape')).toEqual([1, 1, 2, 0]);
    });

    it('keeps at most four ring stripes', () => {
      const buffer = buildItemGeometry([createItem()], {
        colors: [GREEN],
        rings: [[RED, GREEN, BLUE, WHITE, RED]],
      });
      expect(field(buffer, 0, 'a_ring')).toEqual(packed(RED, GREEN, BLUE, WHITE));
      expect(field(buffer, 0, 'a_shape')[2]).toBe(4);
    });
  });

  describe('two pictures', () => {
    it('holds the same picture twice when given one', () => {
      const buffer = buildItemGeometry([createItem()], {
        colors: [[RED, BLUE]],
        rings: [GREEN],
      });
      expect(field(buffer, 0, 'a_nextFill')).toEqual(field(buffer, 0, 'a_fill'));
      expect(field(buffer, 0, 'a_nextRing')).toEqual(field(buffer, 0, 'a_ring'));
      expect(field(buffer, 0, 'a_nextShape')).toEqual(field(buffer, 0, 'a_shape'));
    });

    it('holds each picture whole, with its own stripes, growth and ring', () => {
      const buffer = buildItemGeometry(
        [createItem()],
        { colors: [[RED, BLUE]] },
        { colors: [[RED, BLUE, GREEN]], growth: [0.25], rings: [RED] },
      );
      expect(field(buffer, 0, 'a_fill')).toEqual(packed(RED, BLUE));
      expect(field(buffer, 0, 'a_shape')).toEqual([2, 1, 0, 0]);
      expect(field(buffer, 0, 'a_nextFill')).toEqual(packed(RED, BLUE, GREEN));
      expect(field(buffer, 0, 'a_nextRing')).toEqual(packed(RED));
      expect(field(buffer, 0, 'a_nextShape')).toEqual([3, 0.25, 1, 0]);
    });

    it('marks each picture uncoloured on its own, for the shader to hover', () => {
      const buffer = buildItemGeometry(
        [createItem()],
        { colors: [WHITE], uncoloured: [true] },
        { colors: [RED] },
      );
      expect(field(buffer, 0, 'a_shape')[3]).toBe(1);
      expect(field(buffer, 0, 'a_nextShape')[3]).toBe(0);
    });
  });
});

describe('createBuffer', () => {
  let mockGl: WebGL2RenderingContext;
  let mockBuffer: WebGLBuffer;

  beforeEach(() => {
    mockBuffer = {} as WebGLBuffer;
    mockGl = createMockWebGL2Context();
    vi.mocked(mockGl.createBuffer).mockReturnValue(mockBuffer);
  });

  it('creates a WebGL buffer', () => {
    const data = new Float32Array([1, 2, 3]);
    const buffer = createBuffer(mockGl, data);

    expect(mockGl.createBuffer).toHaveBeenCalled();
    expect(buffer).toBe(mockBuffer);
  });

  it('binds buffer to ARRAY_BUFFER', () => {
    const data = new Float32Array([1, 2, 3]);
    createBuffer(mockGl, data);

    expect(mockGl.bindBuffer).toHaveBeenCalledWith(34962, mockBuffer);
  });

  it('uploads data with STATIC_DRAW', () => {
    const data = new Float32Array([1, 2, 3]);
    createBuffer(mockGl, data);

    expect(mockGl.bufferData).toHaveBeenCalledWith(34962, data, 35044);
  });

  it('throws error when buffer creation fails', () => {
    mockGl.createBuffer = vi.fn().mockReturnValue(null);
    const data = new Float32Array([1, 2, 3]);

    expect(() => createBuffer(mockGl, data)).toThrow('Failed to create buffer');
  });

  it('handles empty data', () => {
    const data = new Float32Array([]);
    const buffer = createBuffer(mockGl, data);

    expect(buffer).toBe(mockBuffer);
    expect(mockGl.bufferData).toHaveBeenCalledWith(34962, data, 35044);
  });

  it('handles large data arrays', () => {
    const data = new Float32Array(100000);
    const buffer = createBuffer(mockGl, data);

    expect(buffer).toBe(mockBuffer);
    expect(mockGl.bufferData).toHaveBeenCalledWith(34962, data, 35044);
  });
});
