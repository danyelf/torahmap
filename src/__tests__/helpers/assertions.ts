// Custom assertions and matchers for Torah Map tests
import { expect } from 'vitest';
import type { Verse } from '../../types';

/**
 * Asserts that a color is valid (all channels in [0, 1] range)
 */
export function assertValidColor(color: number[] | [number, number, number]) {
  expect(color).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    expect(color[i]).toBeGreaterThanOrEqual(0);
    expect(color[i]).toBeLessThanOrEqual(1);
  }
}

/**
 * Asserts that all colors in an array are valid
 */
export function assertValidColors(colors: (number[] | [number, number, number])[]) {
  for (const color of colors) {
    assertValidColor(color);
  }
}

/**
 * Asserts that two colors are approximately equal (within epsilon)
 */
export function assertColorEquals(
  actual: number[] | [number, number, number],
  expected: number[] | [number, number, number],
  epsilon: number = 0.01
) {
  expect(actual).toHaveLength(3);
  expect(expected).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThan(epsilon);
  }
}

/**
 * Asserts that a verse has all required properties
 */
export function assertValidVerse(verse: Verse) {
  expect(verse.book).toBeDefined();
  expect(typeof verse.book).toBe('string');
  expect(verse.book.length).toBeGreaterThan(0);

  expect(verse.chapter).toBeDefined();
  expect(typeof verse.chapter).toBe('number');
  expect(verse.chapter).toBeGreaterThan(0);

  expect(verse.verse).toBeDefined();
  expect(typeof verse.verse).toBe('number');
  expect(verse.verse).toBeGreaterThan(0);

  expect(verse.x).toBeDefined();
  expect(typeof verse.x).toBe('number');

  expect(verse.y).toBeDefined();
  expect(typeof verse.y).toBe('number');

  expect(verse.size).toBeDefined();
  expect(typeof verse.size).toBe('number');
  expect(verse.size).toBeGreaterThan(0);

  if (verse.color) {
    if (Array.isArray(verse.color[0])) {
      // Multiple colors (stipple)
      assertValidColors(verse.color as [number, number, number][]);
    } else {
      // Single color
      assertValidColor(verse.color as [number, number, number]);
    }
  }
}

/**
 * Asserts that all verses in an array are valid
 */
export function assertValidVerses(verses: Verse[]) {
  for (const verse of verses) {
    assertValidVerse(verse);
  }
}

/**
 * Asserts that two verses represent the same location (book, chapter, verse)
 */
export function assertSameVerseLocation(actual: Verse, expected: Verse) {
  expect(actual.book).toBe(expected.book);
  expect(actual.chapter).toBe(expected.chapter);
  expect(actual.verse).toBe(expected.verse);
}

/**
 * Asserts that a number is within a range
 */
export function assertInRange(value: number, min: number, max: number) {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Asserts that all verses have unique positions (no overlaps)
 * Allows for small floating point differences
 */
export function assertUniquePositions(verses: Verse[], tolerance: number = 0.01) {
  const positions = new Map<string, Verse>();

  for (const verse of verses) {
    const key = `${Math.round(verse.x / tolerance)},${Math.round(verse.y / tolerance)}`;
    const existing = positions.get(key);

    if (existing) {
      const xDiff = Math.abs(verse.x - existing.x);
      const yDiff = Math.abs(verse.y - existing.y);

      // If they're in the same "bucket", they should still differ in actual position
      if (xDiff < tolerance && yDiff < tolerance) {
        throw new Error(
          `Overlapping verses found: ${existing.book} ${existing.chapter}:${existing.verse} ` +
          `at (${existing.x}, ${existing.y}) and ${verse.book} ${verse.chapter}:${verse.verse} ` +
          `at (${verse.x}, ${verse.y})`
        );
      }
    }

    positions.set(key, verse);
  }
}

/**
 * Asserts that a value is approximately equal to expected (within epsilon)
 */
export function assertApproximately(actual: number, expected: number, epsilon: number = 0.01) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

/**
 * Asserts that an array contains elements matching a predicate
 */
export function assertContains<T>(array: T[], predicate: (item: T) => boolean) {
  const found = array.some(predicate);
  if (!found) {
    throw new Error('Array does not contain element matching predicate');
  }
}

/**
 * Asserts that all elements in an array match a predicate
 */
export function assertAll<T>(array: T[], predicate: (item: T) => boolean) {
  for (let i = 0; i < array.length; i++) {
    if (!predicate(array[i])) {
      throw new Error(`Element at index ${i} does not match predicate: ${JSON.stringify(array[i])}`);
    }
  }
}

/**
 * Asserts that a URL contains expected query parameters
 */
export function assertURLHasParams(url: string, expectedParams: Record<string, string>) {
  const urlObj = new URL(url, 'http://localhost');
  const params = new URLSearchParams(urlObj.search);

  for (const [key, value] of Object.entries(expectedParams)) {
    expect(params.get(key)).toBe(value);
  }
}

/**
 * Asserts that an object has specific properties
 */
export function assertHasProperties<T extends object>(
  obj: T,
  properties: (keyof T)[]
) {
  for (const prop of properties) {
    expect(obj).toHaveProperty(prop);
    expect(obj[prop]).toBeDefined();
  }
}

/**
 * Asserts that a color is grayscale (all channels equal)
 */
export function assertGrayscale(color: [number, number, number], epsilon: number = 0.01) {
  assertValidColor(color);
  expect(Math.abs(color[0] - color[1])).toBeLessThan(epsilon);
  expect(Math.abs(color[1] - color[2])).toBeLessThan(epsilon);
}

/**
 * Asserts that verses are sorted by a property
 */
export function assertSortedBy<T, K extends keyof T>(
  items: T[],
  property: K,
  order: 'asc' | 'desc' = 'asc'
) {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1][property];
    const curr = items[i][property];

    if (order === 'asc') {
      expect(prev).toBeLessThanOrEqual(curr);
    } else {
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  }
}

/**
 * Asserts that a Hebrew string contains trop marks
 */
export function assertHasTropMarks(text: string) {
  // Trop marks are in Unicode range U+0591 to U+05AF
  const hasTrop = /[\u0591-\u05AF]/.test(text);
  expect(hasTrop).toBe(true);
}

/**
 * Asserts that a Hebrew string does NOT contain trop marks
 */
export function assertNoTropMarks(text: string) {
  const hasTrop = /[\u0591-\u05AF]/.test(text);
  expect(hasTrop).toBe(false);
}
