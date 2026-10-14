// Custom assertions and matchers for Torah Map tests
import { expect } from 'vitest';

// All channels must be in [0, 1]. Accepts Color | Color[] (overlay
// getVerseColor's return type).
export function assertValidColor(
  color: number[] | [number, number, number] | (number[] | [number, number, number])[],
) {
  // If it's an array of colors, validate the first one
  if (Array.isArray(color) && Array.isArray(color[0])) {
    const firstColor = color[0] as number[] | [number, number, number];
    expect(firstColor).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(firstColor[i]).toBeGreaterThanOrEqual(0);
      expect(firstColor[i]).toBeLessThanOrEqual(1);
    }
  } else {
    expect(color).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect((color as number[])[i]).toBeGreaterThanOrEqual(0);
      expect((color as number[])[i]).toBeLessThanOrEqual(1);
    }
  }
}

export function assertColorEquals(
  actual: number[] | [number, number, number],
  expected: number[] | [number, number, number],
  epsilon: number = 0.01,
) {
  expect(actual).toHaveLength(3);
  expect(expected).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThan(epsilon);
  }
}

export function assertApproximately(actual: number, expected: number, epsilon: number = 0.01) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}
