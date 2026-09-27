import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildItemGeometry,
  createBuffer,
  FLOATS_PER_VERSE,
  MULTICOLOR_GROWTH,
  VERSE_ATTRIBUTES,
  VERSE_OFFSETS,
  type VerseAttributeName,
} from '../../geometry';
import { createVerse, createVerses, TEST_COLORS, createMockWebGL2Context } from '../helpers';

const SIZE = Object.fromEntries(VERSE_ATTRIBUTES.map((a) => [a.name, a.size])) as Record<
  VerseAttributeName,
  number
>;

function field(buffer: Float32Array, verse: number, name: VerseAttributeName): number[] {
  const size = SIZE[name];
  const start = verse * FLOATS_PER_VERSE + VERSE_OFFSETS[name];
  return Array.from(buffer.subarray(start, start + size));
}

const colorsOf = (buffer: Float32Array, verse = 0) =>
  (['a_color', 'a_color2', 'a_color3', 'a_color4'] as const).map((n) => field(buffer, verse, n));

const nextColorsOf = (buffer: Float32Array, verse = 0) =>
  (['a_nextColor', 'a_nextColor2', 'a_nextColor3', 'a_nextColor4'] as const).map((n) =>
    field(buffer, verse, n),
  );

const { RED, GREEN, BLUE, WHITE, BLACK } = TEST_COLORS;

describe('buildItemGeometry', () => {
  it('holds one entry per verse', () => {
    expect(buildItemGeometry(createVerses(7))).toHaveLength(7 * FLOATS_PER_VERSE);
    expect(buildItemGeometry([])).toHaveLength(0);
  });

  describe('rectangle', () => {
    it('spans the verse, less the 2-unit gap between squares', () => {
      const buffer = buildItemGeometry([createVerse({ x: 100, y: 200, size: 10 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100, 200, 108, 208]);
    });

    it('keeps fractional positions', () => {
      const buffer = buildItemGeometry([createVerse({ x: 100.5, y: 200.75, size: 8 })]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100.5, 200.75, 106.5, 206.75]);
    });

    it('gives each verse its own rectangle', () => {
      const verses = [createVerse({ x: 10, y: 20 }), createVerse({ x: 30, y: 40 })];
      const buffer = buildItemGeometry(verses);
      expect(field(buffer, 0, 'a_rect').slice(0, 2)).toEqual([10, 20]);
      expect(field(buffer, 1, 'a_rect').slice(0, 2)).toEqual([30, 40]);
    });
  });

  describe('growth', () => {
    it('grows by less than half the gap, so neighbours never touch', () => {
      expect(MULTICOLOR_GROWTH).toBeGreaterThan(0);
      expect(MULTICOLOR_GROWTH).toBeLessThan(1); // the gap between squares is 2
    });

    it('grows a verse with several colours fully, and one with one colour not at all', () => {
      const buffer = buildItemGeometry(createVerses(2), { colors: [[RED, BLUE], RED] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(1);
      expect(field(buffer, 1, 'a_shape')[1]).toBe(0);
    });

    it('grows a verse by the fraction it is given, whatever its colours', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [[RED, BLUE]], growth: [0.5] });
      expect(field(buffer, 0, 'a_shape')[1]).toBe(0.5);
    });
  });

  describe('colours', () => {
    it('uses the verse colour, padded with black, and a count of 1', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [RED] });
      expect(colorsOf(buffer)).toEqual([RED, BLACK, BLACK, BLACK]);
      expect(field(buffer, 0, 'a_shape')[0]).toBe(1);
    });

    it('falls back to the base colour, then to the default fill', () => {
      const base: [number, number, number] = [0.2, 0.3, 0.4];
      const given = buildItemGeometry([createVerse()], undefined, undefined, base);
      expect(field(given, 0, 'a_color')).toEqual(Array.from(new Float32Array(base)));

      const fallback = buildItemGeometry([createVerse()], { colors: [[]] });
      field(fallback, 0, 'a_color').forEach((c) => expect(c).toBeCloseTo(0.6, 5));
    });

    it('keeps several colours in order with their count', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [[RED, GREEN, BLUE]] });
      expect(colorsOf(buffer)).toEqual([RED, GREEN, BLUE, BLACK]);
      expect(field(buffer, 0, 'a_shape')[0]).toBe(3);
    });

    it('keeps at most four colours', () => {
      const buffer = buildItemGeometry([createVerse()], {
        colors: [[RED, GREEN, BLUE, WHITE, BLACK]],
      });
      expect(colorsOf(buffer)).toEqual([RED, GREEN, BLUE, WHITE]);
      expect(field(buffer, 0, 'a_shape')[0]).toBe(4);
    });

    it('colours each verse independently', () => {
      const buffer = buildItemGeometry(createVerses(3), {
        colors: [RED, [BLUE, GREEN], undefined as never],
      });
      expect([0, 1, 2].map((i) => field(buffer, i, 'a_shape')[0])).toEqual([1, 2, 1]);
    });
  });

  describe('two pictures', () => {
    it('holds the same picture twice when given one', () => {
      const buffer = buildItemGeometry([createVerse()], { colors: [[RED, BLUE]] });
      expect(nextColorsOf(buffer)).toEqual(colorsOf(buffer));
      expect(field(buffer, 0, 'a_nextShape')).toEqual(field(buffer, 0, 'a_shape'));
    });

    it('holds each picture whole, with its own stripe count and growth', () => {
      const buffer = buildItemGeometry(
        [createVerse()],
        { colors: [[RED, BLUE]] },
        { colors: [[RED, BLUE, GREEN]], growth: [0.25] },
      );
      expect(colorsOf(buffer)).toEqual([RED, BLUE, BLACK, BLACK]);
      expect(field(buffer, 0, 'a_shape')).toEqual([2, 1]);
      expect(nextColorsOf(buffer)).toEqual([RED, BLUE, GREEN, BLACK]);
      expect(field(buffer, 0, 'a_nextShape')).toEqual([3, 0.25]);
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
