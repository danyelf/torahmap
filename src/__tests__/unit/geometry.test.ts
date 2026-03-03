import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildVerseGeometry, createBuffer } from '../../geometry';
import { createVerse, createVerses, createVerseWithSegments, TEST_COLORS } from '../helpers';
import type { LayoutSegment } from '../../types';

describe('buildVerseGeometry', () => {
  describe('basic buffer properties', () => {
    it('returns Float32Array', () => {
      const verses = [createVerse()];
      const buffer = buildVerseGeometry(verses);
      expect(buffer).toBeInstanceOf(Float32Array);
    });

    it('returns correct buffer size for single verse', () => {
      const verses = [createVerse()];
      const buffer = buildVerseGeometry(verses);
      // 6 vertices * 19 floats per vertex = 114 floats
      expect(buffer.length).toBe(114);
    });

    it('returns correct buffer size for multiple verses', () => {
      const verses = createVerses(5);
      const buffer = buildVerseGeometry(verses);
      // 5 verses * 6 vertices * 19 floats = 570 floats
      expect(buffer.length).toBe(570);
    });

    it('handles empty verse array', () => {
      const buffer = buildVerseGeometry([]);
      expect(buffer).toBeInstanceOf(Float32Array);
      expect(buffer.length).toBe(0);
    });

    it('handles large verse arrays', () => {
      const verses = createVerses(1000);
      const buffer = buildVerseGeometry(verses);
      // 1000 verses * 6 vertices * 19 floats = 114,000 floats
      expect(buffer.length).toBe(114000);
    });
  });

  describe('vertex count and structure', () => {
    it('generates 6 vertices per verse (2 triangles)', () => {
      const verses = [createVerse()];
      const buffer = buildVerseGeometry(verses);
      const verticesPerQuad = 6;
      const floatsPerVertex = 19;
      const expectedFloats = verticesPerQuad * floatsPerVertex;
      expect(buffer.length).toBe(expectedFloats);
    });

    it('generates correct number of vertices for multiple verses', () => {
      const verseCount = 10;
      const verses = createVerses(verseCount);
      const buffer = buildVerseGeometry(verses);
      const floatsPerVertex = 19;
      const verticesPerQuad = 6;
      expect(buffer.length).toBe(verseCount * verticesPerQuad * floatsPerVertex);
    });

    it('each vertex has 19 floats (x, y, 4 colors of 3 channels, colorCount, u, v, seedX, seedY)', () => {
      const verses = [createVerse()];
      const buffer = buildVerseGeometry(verses);
      // Structure: x(1) + y(1) + color1(3) + color2(3) + color3(3) + color4(3) + colorCount(1) + u(1) + v(1) + seedX(1) + seedY(1) = 19
      const floatsPerVertex = 19;
      expect(buffer.length % floatsPerVertex).toBe(0);
    });
  });

  describe('position calculation', () => {
    it('correctly places vertices at verse position', () => {
      const verse = createVerse({ x: 100, y: 200, size: 10 });
      const buffer = buildVerseGeometry([verse]);

      // First vertex (top-left): should be at (100, 200)
      expect(buffer[0]).toBe(100);  // x
      expect(buffer[1]).toBe(200);  // y
    });

    it('applies 2px gap to verse size', () => {
      const verse = createVerse({ x: 100, y: 200, size: 10 });
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      // Second vertex (top-right): x should be x + size - 2
      const expectedX = 100 + 10 - 2; // 108
      expect(buffer[floatsPerVertex]).toBe(expectedX);
    });

    it('handles different verse sizes correctly', () => {
      const verse1 = createVerse({ x: 0, y: 0, size: 6 });
      const verse2 = createVerse({ x: 10, y: 10, size: 12 });
      const buffer = buildVerseGeometry([verse1, verse2]);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;

      // Verse 1: size 6, so width/height = 4 (6-2)
      expect(buffer[floatsPerVertex]).toBe(4); // top-right x

      // Verse 2: size 12, so width/height = 10 (12-2)
      expect(buffer[floatsPerQuad + floatsPerVertex]).toBe(20); // second verse top-right x (10 + 10)
    });

    it('handles floating point positions', () => {
      const verse = createVerse({ x: 100.5, y: 200.75, size: 8 });
      const buffer = buildVerseGeometry([verse]);

      expect(buffer[0]).toBe(100.5);
      expect(buffer[1]).toBe(200.75);
    });
  });

  describe('triangle winding order', () => {
    it('first triangle has correct vertex order (top-left, top-right, bottom-left)', () => {
      const verse = createVerse({ x: 10, y: 20, size: 8 });
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      const x0 = 10, y0 = 20;
      const x1 = 10 + 8 - 2, y1 = 20 + 8 - 2;

      // Vertex 0: top-left
      expect(buffer[0]).toBe(x0);
      expect(buffer[1]).toBe(y0);

      // Vertex 1: top-right
      expect(buffer[floatsPerVertex]).toBe(x1);
      expect(buffer[floatsPerVertex + 1]).toBe(y0);

      // Vertex 2: bottom-left
      expect(buffer[floatsPerVertex * 2]).toBe(x0);
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y1);
    });

    it('second triangle has correct vertex order (bottom-left, top-right, bottom-right)', () => {
      const verse = createVerse({ x: 10, y: 20, size: 8 });
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      const x0 = 10, y0 = 20;
      const x1 = 10 + 8 - 2, y1 = 20 + 8 - 2;

      // Vertex 3: bottom-left
      expect(buffer[floatsPerVertex * 3]).toBe(x0);
      expect(buffer[floatsPerVertex * 3 + 1]).toBe(y1);

      // Vertex 4: top-right
      expect(buffer[floatsPerVertex * 4]).toBe(x1);
      expect(buffer[floatsPerVertex * 4 + 1]).toBe(y0);

      // Vertex 5: bottom-right
      expect(buffer[floatsPerVertex * 5]).toBe(x1);
      expect(buffer[floatsPerVertex * 5 + 1]).toBe(y1);
    });

    it('triangles form a proper quad', () => {
      const verse = createVerse({ x: 0, y: 0, size: 10 });
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      const corners = [];
      for (let i = 0; i < 6; i++) {
        corners.push({
          x: buffer[i * floatsPerVertex],
          y: buffer[i * floatsPerVertex + 1],
        });
      }

      // Should have 4 unique corners
      const uniqueCorners = new Set(corners.map(c => `${c.x},${c.y}`));
      expect(uniqueCorners.size).toBe(4);
    });
  });

  describe('color handling - single color', () => {
    it('uses verse color when provided', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.RED]);

      // Color starts at index 2 (after x, y)
      const colorOffset = 2;

      // First color slot should be red
      expect(buffer[colorOffset]).toBe(1);     // r
      expect(buffer[colorOffset + 1]).toBe(0); // g
      expect(buffer[colorOffset + 2]).toBe(0); // b
    });

    it('uses base color when verse color is undefined', () => {
      const verse = createVerse();
      const baseColor: [number, number, number] = [0.7, 0.8, 0.9];
      const buffer = buildVerseGeometry([verse], undefined, baseColor);

      const colorOffset = 2;
      expect(buffer[colorOffset]).toBeCloseTo(0.7, 5);
      expect(buffer[colorOffset + 1]).toBeCloseTo(0.8, 5);
      expect(buffer[colorOffset + 2]).toBeCloseTo(0.9, 5);
    });

    it('uses default base color when neither provided', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse]);

      const colorOffset = 2;
      // Default base color is [0.6, 0.6, 0.6]
      expect(buffer[colorOffset]).toBeCloseTo(0.6, 5);
      expect(buffer[colorOffset + 1]).toBeCloseTo(0.6, 5);
      expect(buffer[colorOffset + 2]).toBeCloseTo(0.6, 5);
    });

    it('pads single color with 3 black colors', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.BLUE]);

      const colorOffset = 2;

      // Color 1: blue
      expect(buffer[colorOffset]).toBe(0);
      expect(buffer[colorOffset + 1]).toBe(0);
      expect(buffer[colorOffset + 2]).toBe(1);

      // Colors 2-4: should be black (0, 0, 0)
      for (let i = 1; i < 4; i++) {
        const offset = colorOffset + i * 3;
        expect(buffer[offset]).toBe(0);
        expect(buffer[offset + 1]).toBe(0);
        expect(buffer[offset + 2]).toBe(0);
      }
    });

    it('sets colorCount to 1 for single color', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.GREEN]);

      const colorCountOffset = 14; // After x, y, and 4 colors (2 + 12)
      expect(buffer[colorCountOffset]).toBe(1);
    });

    it('applies same color to all vertices', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.RED]);

      const floatsPerVertex = 19;
      const colorOffset = 2;

      // Check all 6 vertices have the same color
      for (let v = 0; v < 6; v++) {
        const offset = v * floatsPerVertex + colorOffset;
        expect(buffer[offset]).toBe(1);     // r
        expect(buffer[offset + 1]).toBe(0); // g
        expect(buffer[offset + 2]).toBe(0); // b
      }
    });
  });

  describe('color handling - multiple colors (stipple)', () => {
    it('handles 2 colors correctly', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [[TEST_COLORS.RED, TEST_COLORS.BLUE]]);

      const colorOffset = 2;

      // Color 1: red
      expect(buffer[colorOffset]).toBe(1);
      expect(buffer[colorOffset + 1]).toBe(0);
      expect(buffer[colorOffset + 2]).toBe(0);

      // Color 2: blue
      expect(buffer[colorOffset + 3]).toBe(0);
      expect(buffer[colorOffset + 4]).toBe(0);
      expect(buffer[colorOffset + 5]).toBe(1);

      // Colors 3-4: black
      for (let i = 2; i < 4; i++) {
        const offset = colorOffset + i * 3;
        expect(buffer[offset]).toBe(0);
        expect(buffer[offset + 1]).toBe(0);
        expect(buffer[offset + 2]).toBe(0);
      }
    });

    it('handles 3 colors correctly', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [[TEST_COLORS.RED, TEST_COLORS.GREEN, TEST_COLORS.BLUE]]);

      const colorOffset = 2;
      const colorCountOffset = 14;

      // Check all 3 colors
      expect(buffer[colorOffset]).toBe(1);     // red
      expect(buffer[colorOffset + 3]).toBe(0); // green
      expect(buffer[colorOffset + 4]).toBe(1);
      expect(buffer[colorOffset + 6]).toBe(0); // blue
      expect(buffer[colorOffset + 8]).toBe(1);

      expect(buffer[colorCountOffset]).toBe(3);
    });

    it('handles 4 colors correctly', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [[TEST_COLORS.RED, TEST_COLORS.GREEN, TEST_COLORS.BLUE, TEST_COLORS.YELLOW]]);

      const colorOffset = 2;
      const colorCountOffset = 14;

      // Check all 4 colors present
      expect(buffer[colorOffset]).toBe(1);      // red
      expect(buffer[colorOffset + 3]).toBe(0);  // green
      expect(buffer[colorOffset + 6]).toBe(0);  // blue
      expect(buffer[colorOffset + 9]).toBe(1);  // yellow

      expect(buffer[colorCountOffset]).toBe(4);
    });

    it('caps at 4 colors when more provided', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [[
        TEST_COLORS.RED,
        TEST_COLORS.GREEN,
        TEST_COLORS.BLUE,
        TEST_COLORS.YELLOW,
        TEST_COLORS.PURPLE, // This should be ignored
        TEST_COLORS.WHITE,  // This should be ignored
      ]]);

      const colorCountOffset = 14;
      // Should still be 4, not 6
      expect(buffer[colorCountOffset]).toBe(4);
    });

    it('sets correct colorCount for multiple colors', () => {
      const verses = [
        createVerse(),
        createVerse(),
        createVerse(),
      ];
      const colors = [
        [TEST_COLORS.RED, TEST_COLORS.BLUE],
        [TEST_COLORS.RED, TEST_COLORS.GREEN, TEST_COLORS.BLUE],
        TEST_COLORS.YELLOW,
      ];
      const buffer = buildVerseGeometry(verses, colors);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;
      const colorCountOffset = 14;

      // Verse 1: 2 colors
      expect(buffer[colorCountOffset]).toBe(2);

      // Verse 2: 3 colors
      expect(buffer[floatsPerQuad + colorCountOffset]).toBe(3);

      // Verse 3: 1 color
      expect(buffer[floatsPerQuad * 2 + colorCountOffset]).toBe(1);
    });
  });

  describe('UV coordinates for stipple effect', () => {
    it('sets correct UV coordinates for quad corners', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      const uvOffset = 15; // After x, y, 4 colors, colorCount

      // Vertex 0 (top-left): u=0, v=0
      expect(buffer[uvOffset]).toBe(0);
      expect(buffer[uvOffset + 1]).toBe(0);

      // Vertex 1 (top-right): u=1, v=0
      expect(buffer[floatsPerVertex + uvOffset]).toBe(1);
      expect(buffer[floatsPerVertex + uvOffset + 1]).toBe(0);

      // Vertex 2 (bottom-left): u=0, v=1
      expect(buffer[floatsPerVertex * 2 + uvOffset]).toBe(0);
      expect(buffer[floatsPerVertex * 2 + uvOffset + 1]).toBe(1);

      // Vertex 3 (bottom-left): u=0, v=1
      expect(buffer[floatsPerVertex * 3 + uvOffset]).toBe(0);
      expect(buffer[floatsPerVertex * 3 + uvOffset + 1]).toBe(1);

      // Vertex 4 (top-right): u=1, v=0
      expect(buffer[floatsPerVertex * 4 + uvOffset]).toBe(1);
      expect(buffer[floatsPerVertex * 4 + uvOffset + 1]).toBe(0);

      // Vertex 5 (bottom-right): u=1, v=1
      expect(buffer[floatsPerVertex * 5 + uvOffset]).toBe(1);
      expect(buffer[floatsPerVertex * 5 + uvOffset + 1]).toBe(1);
    });

    it('UV coordinates are consistent across all verses', () => {
      const verses = createVerses(5);
      const buffer = buildVerseGeometry(verses);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;
      const uvOffset = 15;

      // Check each verse has same UV pattern
      for (let i = 0; i < 5; i++) {
        const baseOffset = i * floatsPerQuad;

        // Top-left: 0,0
        expect(buffer[baseOffset + uvOffset]).toBe(0);
        expect(buffer[baseOffset + uvOffset + 1]).toBe(0);

        // Top-right: 1,0
        expect(buffer[baseOffset + floatsPerVertex + uvOffset]).toBe(1);
        expect(buffer[baseOffset + floatsPerVertex + uvOffset + 1]).toBe(0);

        // Bottom-right: 1,1
        expect(buffer[baseOffset + floatsPerVertex * 5 + uvOffset]).toBe(1);
        expect(buffer[baseOffset + floatsPerVertex * 5 + uvOffset + 1]).toBe(1);
      }
    });
  });

  describe('data layout integrity', () => {
    it('maintains correct stride between vertices', () => {
      const verses = createVerses(3);
      const buffer = buildVerseGeometry(verses);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;

      // Check that each verse quad is properly separated
      for (let i = 0; i < 3; i++) {
        const offset = i * floatsPerQuad;
        const x = buffer[offset];
        const y = buffer[offset + 1];

        // Verify this is a valid position
        expect(typeof x).toBe('number');
        expect(typeof y).toBe('number');
        expect(isNaN(x)).toBe(false);
        expect(isNaN(y)).toBe(false);
      }
    });

    it('all floats are finite numbers', () => {
      const verses = createVerses(10);
      const buffer = buildVerseGeometry(verses);

      for (let i = 0; i < buffer.length; i++) {
        expect(isFinite(buffer[i])).toBe(true);
        expect(isNaN(buffer[i])).toBe(false);
      }
    });

    it('no values exceed expected ranges', () => {
      const verses = createVerses(5);
      const buffer = buildVerseGeometry(verses);

      const floatsPerVertex = 19;

      for (let v = 0; v < 5 * 6; v++) {
        const offset = v * floatsPerVertex;

        // Colors should be in [0, 1] range
        for (let c = 0; c < 4; c++) {
          const colorOffset = offset + 2 + c * 3;
          expect(buffer[colorOffset]).toBeGreaterThanOrEqual(0);
          expect(buffer[colorOffset]).toBeLessThanOrEqual(1);
          expect(buffer[colorOffset + 1]).toBeGreaterThanOrEqual(0);
          expect(buffer[colorOffset + 1]).toBeLessThanOrEqual(1);
          expect(buffer[colorOffset + 2]).toBeGreaterThanOrEqual(0);
          expect(buffer[colorOffset + 2]).toBeLessThanOrEqual(1);
        }

        // ColorCount should be 1-4
        const colorCount = buffer[offset + 14];
        expect(colorCount).toBeGreaterThanOrEqual(1);
        expect(colorCount).toBeLessThanOrEqual(4);

        // UV should be 0 or 1
        expect([0, 1]).toContain(buffer[offset + 15]);
        expect([0, 1]).toContain(buffer[offset + 16]);
      }
    });
  });

  describe('edge cases', () => {
    it('handles verse at origin', () => {
      const verse = createVerse({ x: 0, y: 0, size: 6 });
      const buffer = buildVerseGeometry([verse]);

      expect(buffer[0]).toBe(0);
      expect(buffer[1]).toBe(0);
      expect(buffer.length).toBe(114);
    });

    it('handles verse with negative coordinates', () => {
      const verse = createVerse({ x: -10, y: -20, size: 8 });
      const buffer = buildVerseGeometry([verse]);

      expect(buffer[0]).toBe(-10);
      expect(buffer[1]).toBe(-20);
    });

    it('handles very large coordinates', () => {
      const verse = createVerse({ x: 10000, y: 20000, size: 6 });
      const buffer = buildVerseGeometry([verse]);

      expect(buffer[0]).toBe(10000);
      expect(buffer[1]).toBe(20000);
    });

    it('handles very small size', () => {
      const verse = createVerse({ x: 10, y: 10, size: 2 });
      const buffer = buildVerseGeometry([verse]);

      const floatsPerVertex = 19;
      // With size 2 and -2 gap, width/height should be 0
      expect(buffer[floatsPerVertex]).toBe(10 + 2 - 2); // x1 = x0 + 0
    });

    it('handles mixed color types in array', () => {
      const verses = [
        createVerse(), // single
        createVerse(), // double
        createVerse(), // default
      ];
      const colors: (typeof TEST_COLORS.RED | typeof TEST_COLORS.RED[] | undefined)[] = [
        TEST_COLORS.RED,
        [TEST_COLORS.BLUE, TEST_COLORS.GREEN],
        undefined,
      ];
      const buffer = buildVerseGeometry(verses, colors as any);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;
      const colorCountOffset = 14;

      expect(buffer[colorCountOffset]).toBe(1);
      expect(buffer[floatsPerQuad + colorCountOffset]).toBe(2);
      expect(buffer[floatsPerQuad * 2 + colorCountOffset]).toBe(1);
    });

    it('handles all black colors', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.BLACK]);

      const colorOffset = 2;
      expect(buffer[colorOffset]).toBe(0);
      expect(buffer[colorOffset + 1]).toBe(0);
      expect(buffer[colorOffset + 2]).toBe(0);
    });

    it('handles all white colors', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [TEST_COLORS.WHITE]);

      const colorOffset = 2;
      expect(buffer[colorOffset]).toBe(1);
      expect(buffer[colorOffset + 1]).toBe(1);
      expect(buffer[colorOffset + 2]).toBe(1);
    });

    it('handles zero-width color arrays', () => {
      const verse = createVerse();
      const buffer = buildVerseGeometry([verse], [[]]);

      // Empty array should fall back to base color [0.6, 0.6, 0.6]
      const colorOffset = 2;
      expect(buffer[colorOffset]).toBeCloseTo(0.6, 5);
      expect(buffer[colorOffset + 1]).toBeCloseTo(0.6, 5);
      expect(buffer[colorOffset + 2]).toBeCloseTo(0.6, 5);
    });
  });

  describe('multiple verses consistency', () => {
    it('verses maintain independent properties', () => {
      const verses = [
        createVerse({ x: 10, y: 20 }),
        createVerse({ x: 30, y: 40 }),
        createVerse({ x: 50, y: 60 }),
      ];
      const colors = [TEST_COLORS.RED, TEST_COLORS.GREEN, TEST_COLORS.BLUE];
      const buffer = buildVerseGeometry(verses, colors);

      const floatsPerVertex = 19;
      const floatsPerQuad = floatsPerVertex * 6;

      // Check each verse maintains its properties
      expect(buffer[0]).toBe(10); // verse 1 x
      expect(buffer[floatsPerQuad]).toBe(30); // verse 2 x
      expect(buffer[floatsPerQuad * 2]).toBe(50); // verse 3 x

      // Check colors
      expect(buffer[2]).toBe(1); // verse 1 red
      expect(buffer[floatsPerQuad + 3]).toBe(1); // verse 2 green
      expect(buffer[floatsPerQuad * 2 + 4]).toBe(1); // verse 3 blue
    });

    it('buffer size scales linearly with verse count', () => {
      for (const count of [1, 10, 50, 100]) {
        const verses = createVerses(count);
        const buffer = buildVerseGeometry(verses);
        expect(buffer.length).toBe(count * 6 * 19);
      }
    });
  });
});

describe('segment geometry', () => {
  it('generates vertices for each segment instead of one square', () => {
    const segments: LayoutSegment[] = [
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 0, y: 10, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const buffer = buildVerseGeometry([verse]);
    // 2 segments * 6 vertices * 19 floats = 228
    expect(buffer.length).toBe(228);
  });

  it('uses segment bounds for vertex positions', () => {
    const segments: LayoutSegment[] = [
      { x: 100, y: 200, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const buffer = buildVerseGeometry([verse]);
    // First vertex x should be 100 (segment x)
    expect(buffer[0]).toBe(100);
    // First vertex y should be 200
    expect(buffer[1]).toBe(200);
  });

  it('mixes segment and non-segment verses correctly', () => {
    const segmentVerse = createVerseWithSegments(
      { book: 'Genesis', verse: 1 },
      [
        { x: 0, y: 0, width: 50, height: 10 },
        { x: 0, y: 10, width: 50, height: 10 },
        { x: 0, y: 20, width: 30, height: 10 },
      ]
    );
    const squareVerse = createVerse({ book: 'Isaiah', verse: 1, x: 500, y: 500 });
    const buffer = buildVerseGeometry([segmentVerse, squareVerse]);
    // 3 segments + 1 square = 4 quads * 6 vertices * 19 floats = 456
    expect(buffer.length).toBe(456);
  });

  it('all segments share the same seed position', () => {
    const segments: LayoutSegment[] = [
      { x: 100, y: 200, width: 50, height: 10 },
      { x: 100, y: 210, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({ x: 10, y: 20 }, segments);
    const buffer = buildVerseGeometry([verse]);
    const floatsPerVertex = 19;
    // Seed should be verse.x/y (10, 20) for all segments
    // First segment, first vertex
    expect(buffer[17]).toBe(10); // seedX
    expect(buffer[18]).toBe(20); // seedY
    // Second segment, first vertex
    expect(buffer[6 * floatsPerVertex + 17]).toBe(10);
    expect(buffer[6 * floatsPerVertex + 18]).toBe(20);
  });

  it('applies colors to all segments of a verse', () => {
    const segments: LayoutSegment[] = [
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 0, y: 10, width: 50, height: 10 },
    ];
    const verse = createVerseWithSegments({}, segments);
    const buffer = buildVerseGeometry([verse], [TEST_COLORS.RED]);
    const floatsPerVertex = 19;
    // First segment color
    expect(buffer[2]).toBe(1); // r
    expect(buffer[3]).toBe(0); // g
    expect(buffer[4]).toBe(0); // b
    // Second segment color
    expect(buffer[6 * floatsPerVertex + 2]).toBe(1); // r
    expect(buffer[6 * floatsPerVertex + 3]).toBe(0); // g
    expect(buffer[6 * floatsPerVertex + 4]).toBe(0); // b
  });
});

describe('createBuffer', () => {
  let mockGl: WebGL2RenderingContext;
  let mockBuffer: WebGLBuffer;

  beforeEach(() => {
    mockBuffer = {} as WebGLBuffer;
    mockGl = {
      createBuffer: vi.fn().mockReturnValue(mockBuffer),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
    } as any;
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
