import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildItemGeometry,
  createBuffer,
  FLOATS_PER_VERSE,
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

describe('buildItemGeometry', () => {
  it('holds one entry per verse', () => {
    expect(buildItemGeometry(createVerses(7))).toHaveLength(7 * FLOATS_PER_VERSE);
    expect(buildItemGeometry([])).toHaveLength(0);
  });

  describe('rectangle', () => {
    it('spans a single-color verse, less the 2-unit gap between squares', () => {
      const verse = createVerse({ x: 100, y: 200, size: 10 });
      const buffer = buildItemGeometry([verse], [TEST_COLORS.RED]);
      expect(field(buffer, 0, 'a_rect')).toEqual([100, 200, 108, 208]);
    });

    it('grows a multi-color verse by less than half the gap, so neighbours never touch', () => {
      const verse = createVerse({ x: 100, y: 200, size: 10 });
      const buffer = buildItemGeometry([verse], [[TEST_COLORS.RED, TEST_COLORS.BLUE]]);
      const [left, top, right, bottom] = field(buffer, 0, 'a_rect');
      const growth = 100 - left;
      expect(growth).toBeGreaterThan(0);
      expect(growth).toBeLessThan(1); // the gap between squares is 2
      expect([top, right, bottom]).toEqual([200 - growth, 108 + growth, 208 + growth]);
    });

    it('grows a verse by the fraction it is given, whatever its colors', () => {
      const verse = createVerse({ x: 100, y: 200, size: 10 });
      const colors = [[TEST_COLORS.RED, TEST_COLORS.BLUE]];
      const full = 100 - buildItemGeometry([verse], colors)[0];

      expect(100 - buildItemGeometry([verse], colors, undefined, [0.5])[0]).toBeCloseTo(full / 2);
      expect(buildItemGeometry([verse], colors, undefined, [0])[0]).toBe(100);
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

  describe('colours', () => {
    it('uses the verse colour, padded with black, and a count of 1', () => {
      const buffer = buildItemGeometry([createVerse()], [TEST_COLORS.RED]);
      expect(colorsOf(buffer)).toEqual([TEST_COLORS.RED, [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
      expect(field(buffer, 0, 'a_colorCount')).toEqual([1]);
    });

    it('falls back to the base colour, then to the default fill', () => {
      const base: [number, number, number] = [0.2, 0.3, 0.4];
      const given = buildItemGeometry([createVerse()], undefined, base);
      expect(field(given, 0, 'a_color')).toEqual(Array.from(new Float32Array(base)));

      const fallback = buildItemGeometry([createVerse()], [[]]);
      field(fallback, 0, 'a_color').forEach((c) => expect(c).toBeCloseTo(0.6, 5));
    });

    it('keeps several colours in order with their count', () => {
      const { RED, GREEN, BLUE } = TEST_COLORS;
      const buffer = buildItemGeometry([createVerse()], [[RED, GREEN, BLUE]]);
      expect(colorsOf(buffer)).toEqual([RED, GREEN, BLUE, [0, 0, 0]]);
      expect(field(buffer, 0, 'a_colorCount')).toEqual([3]);
    });

    it('keeps at most four colours', () => {
      const { RED, GREEN, BLUE, WHITE, BLACK } = TEST_COLORS;
      const buffer = buildItemGeometry([createVerse()], [[RED, GREEN, BLUE, WHITE, BLACK]]);
      expect(colorsOf(buffer)).toEqual([RED, GREEN, BLUE, WHITE]);
      expect(field(buffer, 0, 'a_colorCount')).toEqual([4]);
    });

    it('colours each verse independently', () => {
      const verses = createVerses(3);
      const buffer = buildItemGeometry(verses, [
        TEST_COLORS.RED,
        [TEST_COLORS.BLUE, TEST_COLORS.GREEN],
        undefined as never,
      ]);
      expect([0, 1, 2].map((i) => field(buffer, i, 'a_colorCount')[0])).toEqual([1, 2, 1]);
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
