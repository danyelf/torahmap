// Test the test infrastructure itself
import { describe, it, expect } from 'vitest';
import {
  createVerse,
  createVerses,
  SAMPLE_VERSES,
  SAMPLE_TORAH_DATA,
  SAMPLE_COMMENTARY_DATA,
  TEST_COLORS,
  assertValidColor,
  assertValidVerse,
  assertValidVerses,
  createMockWebGL2Context,
  createMockCanvas,
} from './index';

describe('Test Infrastructure', () => {
  describe('Fixtures', () => {
    it('createVerse creates valid verse with defaults', () => {
      const verse = createVerse();
      assertValidVerse(verse);
      expect(verse.book).toBe('Genesis');
      expect(verse.chapter).toBe(1);
      expect(verse.verse).toBe(1);
    });

    it('createVerse accepts overrides', () => {
      const verse = createVerse({ book: 'Exodus', chapter: 2, verse: 3 });
      expect(verse.book).toBe('Exodus');
      expect(verse.chapter).toBe(2);
      expect(verse.verse).toBe(3);
    });

    it('createVerses creates multiple verses', () => {
      const verses = createVerses(5);
      expect(verses).toHaveLength(5);
      assertValidVerses(verses);
      expect(verses[0].verse).toBe(1);
      expect(verses[4].verse).toBe(5);
    });

    it('SAMPLE_VERSES contains valid verses', () => {
      expect(SAMPLE_VERSES.length).toBeGreaterThan(0);
      assertValidVerses(SAMPLE_VERSES);
    });

    it('SAMPLE_TORAH_DATA has valid structure', () => {
      expect(SAMPLE_TORAH_DATA.books).toBeDefined();
      expect(SAMPLE_TORAH_DATA.books.length).toBeGreaterThan(0);
      for (const book of SAMPLE_TORAH_DATA.books) {
        expect(book.name).toBeDefined();
        expect(book.hebrewName).toBeDefined();
        expect(book.chapters).toBeDefined();
        expect(book.chapters.length).toBeGreaterThan(0);
      }
    });

    it('SAMPLE_COMMENTARY_DATA has valid structure', () => {
      expect(SAMPLE_COMMENTARY_DATA).toBeDefined();
      const genesis = SAMPLE_COMMENTARY_DATA['Genesis'];
      expect(genesis).toBeDefined();
      const chapter1 = genesis['1'];
      expect(chapter1).toBeDefined();
      const verse1 = chapter1['1'];
      expect(verse1).toBeDefined();
      expect(verse1.total).toBeGreaterThan(0);
      expect(verse1.categories).toBeDefined();
    });

    it('TEST_COLORS contains valid colors', () => {
      for (const color of Object.values(TEST_COLORS)) {
        assertValidColor(color);
      }
    });
  });

  describe('Assertions', () => {
    it('assertValidColor passes for valid colors', () => {
      assertValidColor([0.5, 0.5, 0.5]);
      assertValidColor([0, 0, 0]);
      assertValidColor([1, 1, 1]);
    });

    it('assertValidColor fails for invalid colors', () => {
      expect(() => assertValidColor([2, 0, 0])).toThrow();
      expect(() => assertValidColor([-1, 0, 0])).toThrow();
      expect(() => assertValidColor([0.5, 0.5])).toThrow(); // Wrong length
    });

    it('assertValidVerse passes for valid verse', () => {
      const verse = createVerse();
      assertValidVerse(verse);
    });

    it('assertValidVerses passes for valid verse array', () => {
      const verses = createVerses(3);
      assertValidVerses(verses);
    });
  });

  describe('Mocks', () => {
    it('createMockWebGL2Context creates valid mock', () => {
      const gl = createMockWebGL2Context();
      expect(gl).toBeDefined();
      expect(gl.createShader).toBeDefined();
      expect(gl.createProgram).toBeDefined();
      expect(gl.createBuffer).toBeDefined();
    });

    it('mock WebGL2 context returns expected values', () => {
      const gl = createMockWebGL2Context();
      const shader = gl.createShader(gl.VERTEX_SHADER);
      expect(shader).toBeDefined();

      const program = gl.createProgram();
      expect(program).toBeDefined();

      const location = gl.getAttribLocation(program!, 'a_position');
      expect(location).toBe(0);
    });

    it('createMockCanvas creates valid canvas', () => {
      const canvas = createMockCanvas();
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(canvas.getContext).toBeDefined();
    });

    it('mock canvas returns WebGL2 context', () => {
      const canvas = createMockCanvas();
      const gl = canvas.getContext('webgl2');
      expect(gl).toBeDefined();
      expect(gl).not.toBeNull();
    });
  });
});
