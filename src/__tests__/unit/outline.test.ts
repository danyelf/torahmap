import { describe, it, expect } from 'vitest';
import { buildOutlineGeometry } from '../../outline';
import type { OutlineBounds } from '../../outline';

const floatsPerVertex = 2; // x, y

describe('buildOutlineGeometry', () => {
  describe('basic buffer properties', () => {
    it('returns Float32Array', () => {
      const bounds: OutlineBounds = { x: 10, y: 20, size: 10 };
      const buffer = buildOutlineGeometry(bounds);
      expect(buffer).toBeInstanceOf(Float32Array);
    });

    it('holds 4 borders of 6 corners, x and y each', () => {
      const bounds: OutlineBounds = { x: 10, y: 20, size: 10 };
      expect(buildOutlineGeometry(bounds)).toHaveLength(48);
    });
  });

  describe('default thickness', () => {
    it('uses default thickness of 2 when not specified', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      const x0 = 100 - thickness; // Extends outside by thickness
      const y0 = 200 - thickness;

      // Top border extends outside verse by thickness
      // First vertex of top border (top-left)
      expect(buffer[0]).toBe(x0);
      expect(buffer[1]).toBe(y0);

      // Third vertex of top border (bottom-left of top border)
      expect(buffer[floatsPerVertex * 2]).toBe(x0);
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y0 + thickness); // y0 - 2 + 2 = 200
    });
  });

  describe('custom thickness', () => {
    it('uses custom thickness when provided', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds, 5);

      const thickness = 5;
      const y0 = 200 - thickness; // Extends outside

      // Third vertex of top border (bottom-left of top border)
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y0 + thickness); // 200 - 5 + 5 = 200
    });
  });

  describe('border positions', () => {
    it('top border spans full width extending outside verse', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      const x0 = 100 - thickness; // extends left
      const y0 = 200 - thickness; // extends up
      const x1 = 100 + 10 - 2 + thickness; // extends right (size - gap + thickness)

      // Top border: first 6 vertices (indices 0-5)
      // Vertex 0 (top-left): x0, y0
      expect(buffer[0]).toBe(x0);
      expect(buffer[1]).toBe(y0);

      // Vertex 1 (top-right): x1, y0
      expect(buffer[floatsPerVertex]).toBe(x1);
      expect(buffer[floatsPerVertex + 1]).toBe(y0);

      // Vertex 2 (bottom-left): x0, y0 + thickness
      expect(buffer[floatsPerVertex * 2]).toBe(x0);
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y0 + thickness);

      // Vertex 5 (bottom-right): x1, y0 + thickness
      expect(buffer[floatsPerVertex * 5]).toBe(x1);
      expect(buffer[floatsPerVertex * 5 + 1]).toBe(y0 + thickness);
    });

    it('right border spans full height extending outside verse', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const floatsPerBorder = floatsPerVertex * 6;
      const thickness = 2;
      const y0 = 200 - thickness; // extends up
      const y1 = 200 + 10 - 2 + thickness; // extends down (size - gap + thickness)
      const x1 = 100 + 10 - 2 + thickness; // extends right

      // Right border: vertices 6-11 (second border)
      const rightBorderOffset = floatsPerBorder;

      // Vertex 6 (top-left of right border): x1 - thickness, y0
      expect(buffer[rightBorderOffset]).toBe(x1 - thickness);
      expect(buffer[rightBorderOffset + 1]).toBe(y0);

      // Vertex 7 (top-right of right border): x1, y0
      expect(buffer[rightBorderOffset + floatsPerVertex]).toBe(x1);
      expect(buffer[rightBorderOffset + floatsPerVertex + 1]).toBe(y0);

      // Vertex 11 (bottom-right of right border): x1, y1
      expect(buffer[rightBorderOffset + floatsPerVertex * 5]).toBe(x1);
      expect(buffer[rightBorderOffset + floatsPerVertex * 5 + 1]).toBe(y1);
    });

    it('bottom border spans full width extending outside verse', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const floatsPerBorder = floatsPerVertex * 6;
      const thickness = 2;
      const x0 = 100 - thickness; // extends left
      const x1 = 100 + 10 - 2 + thickness; // extends right
      const y1 = 200 + 10 - 2 + thickness; // extends down

      // Bottom border: vertices 12-17 (third border)
      const bottomBorderOffset = floatsPerBorder * 2;

      // Vertex 12 (top-left of bottom border): x0, y1 - thickness
      expect(buffer[bottomBorderOffset]).toBe(x0);
      expect(buffer[bottomBorderOffset + 1]).toBe(y1 - thickness);

      // Vertex 13 (top-right of bottom border): x1, y1 - thickness
      expect(buffer[bottomBorderOffset + floatsPerVertex]).toBe(x1);
      expect(buffer[bottomBorderOffset + floatsPerVertex + 1]).toBe(y1 - thickness);

      // Vertex 17 (bottom-right of bottom border): x1, y1
      expect(buffer[bottomBorderOffset + floatsPerVertex * 5]).toBe(x1);
      expect(buffer[bottomBorderOffset + floatsPerVertex * 5 + 1]).toBe(y1);
    });

    it('left border spans full height extending outside verse', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const floatsPerBorder = floatsPerVertex * 6;
      const thickness = 2;
      const x0 = 100 - thickness; // extends left
      const y0 = 200 - thickness; // extends up
      const y1 = 200 + 10 - 2 + thickness; // extends down

      // Left border: vertices 18-23 (fourth border)
      const leftBorderOffset = floatsPerBorder * 3;

      // Vertex 18 (top-left of left border): x0, y0
      expect(buffer[leftBorderOffset]).toBe(x0);
      expect(buffer[leftBorderOffset + 1]).toBe(y0);

      // Vertex 19 (top-right of left border): x0 + thickness, y0
      expect(buffer[leftBorderOffset + floatsPerVertex]).toBe(x0 + thickness);
      expect(buffer[leftBorderOffset + floatsPerVertex + 1]).toBe(y0);

      // Vertex 23 (bottom-right of left border): x0 + thickness, y1
      expect(buffer[leftBorderOffset + floatsPerVertex * 5]).toBe(x0 + thickness);
      expect(buffer[leftBorderOffset + floatsPerVertex * 5 + 1]).toBe(y1);
    });

    it('extends outside verse bounds by thickness', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      const expectedX0 = 100 - thickness; // 98
      const expectedY0 = 200 - thickness; // 198
      const expectedX1 = 100 + 10 - 2 + thickness; // 110 (size - gap + thickness)
      const expectedY1 = 200 + 10 - 2 + thickness; // 210

      // Top border starts outside the verse
      expect(buffer[0]).toBe(expectedX0); // top-left x
      expect(buffer[1]).toBe(expectedY0); // top-left y

      // Top border extends to right edge plus thickness
      expect(buffer[floatsPerVertex]).toBe(expectedX1); // top-right x

      // Bottom border extends to bottom edge plus thickness
      const bottomBorderOffset = floatsPerVertex * 6 * 2; // Third border
      expect(buffer[bottomBorderOffset + floatsPerVertex * 5 + 1]).toBe(expectedY1);
    });
  });

  describe('data layout integrity', () => {
    it('all floats are finite numbers', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      for (let i = 0; i < buffer.length; i++) {
        expect(isFinite(buffer[i])).toBe(true);
        expect(isNaN(buffer[i])).toBe(false);
      }
    });

    it('maintains correct stride between vertices', () => {
      const bounds: OutlineBounds = { x: 50, y: 75, size: 12 };
      const buffer = buildOutlineGeometry(bounds);

      // Check each vertex position is valid
      for (let v = 0; v < 24; v++) {
        const offset = v * floatsPerVertex;
        const x = buffer[offset];
        const y = buffer[offset + 1];

        expect(typeof x).toBe('number');
        expect(typeof y).toBe('number');
        expect(isNaN(x)).toBe(false);
        expect(isNaN(y)).toBe(false);
      }
    });

    it('each border has 6 vertices (2 triangles)', () => {
      const bounds: OutlineBounds = { x: 0, y: 0, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const verticesPerBorder = 6;
      const floatsPerBorder = floatsPerVertex * verticesPerBorder;

      // Should have exactly 4 borders
      expect(buffer.length).toBe(floatsPerBorder * 4);
    });
  });

  describe('edge cases', () => {
    it('handles bounds at origin', () => {
      const bounds: OutlineBounds = { x: 0, y: 0, size: 6 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      expect(buffer[0]).toBe(0 - thickness); // extends left (negative)
      expect(buffer[1]).toBe(0 - thickness); // extends up (negative)
      expect(buffer.length).toBe(48);
    });

    it('handles negative coordinates', () => {
      const bounds: OutlineBounds = { x: -100, y: -200, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      expect(buffer[0]).toBe(-100 - thickness); // extends further left
      expect(buffer[1]).toBe(-200 - thickness); // extends further up
      expect(buffer.length).toBe(48);
    });

    it('handles very large coordinates', () => {
      const bounds: OutlineBounds = { x: 10000, y: 20000, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      expect(buffer[0]).toBe(10000 - thickness);
      expect(buffer[1]).toBe(20000 - thickness);
    });

    it('handles floating point positions', () => {
      const bounds: OutlineBounds = { x: 100.5, y: 200.75, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      expect(buffer[0]).toBe(100.5 - thickness);
      expect(buffer[1]).toBe(200.75 - thickness);
    });

    it('handles very small size', () => {
      const bounds: OutlineBounds = { x: 10, y: 10, size: 2 };
      const buffer = buildOutlineGeometry(bounds);

      // x0 = 10 - 2 = 8
      // x1 = 10 + 2 - 2 + 2 = 12 (x + size - gap + thickness)
      expect(buffer[floatsPerVertex]).toBe(12);
    });

    it('handles very large size', () => {
      const bounds: OutlineBounds = { x: 0, y: 0, size: 1000 };
      const buffer = buildOutlineGeometry(bounds);

      const thickness = 2;
      const expectedX1 = 1000 - 2 + thickness; // 1000
      expect(buffer[floatsPerVertex]).toBe(expectedX1);
    });

    it('handles zero thickness', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 10 };
      const buffer = buildOutlineGeometry(bounds, 0);

      const thickness = 0;
      const y0 = 200 - thickness; // No extension

      // Top border with zero thickness (bottom edge of top border)
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y0 + thickness);
    });

    it('handles very thick outline', () => {
      const bounds: OutlineBounds = { x: 100, y: 200, size: 20 };
      const buffer = buildOutlineGeometry(bounds, 10);

      const thickness = 10;
      const y0 = 200 - thickness; // Extends up by 10

      // Top border with thickness 10 (bottom edge of top border)
      expect(buffer[floatsPerVertex * 2 + 1]).toBe(y0 + thickness); // 200 - 10 + 10 = 200
    });
  });

  describe('triangle winding order', () => {
    it('each border forms proper rectangles', () => {
      const bounds: OutlineBounds = { x: 10, y: 20, size: 10 };
      const buffer = buildOutlineGeometry(bounds);

      const floatsPerBorder = floatsPerVertex * 6;

      // Check each border
      for (let border = 0; border < 4; border++) {
        const offset = border * floatsPerBorder;
        const corners = [];

        // Extract 6 vertices for this border
        for (let v = 0; v < 6; v++) {
          corners.push({
            x: buffer[offset + v * floatsPerVertex],
            y: buffer[offset + v * floatsPerVertex + 1],
          });
        }

        // Should have 4 unique corners (2 triangles sharing vertices)
        const uniqueCorners = new Set(corners.map((c) => `${c.x},${c.y}`));
        expect(uniqueCorners.size).toBe(4);
      }
    });
  });
});
