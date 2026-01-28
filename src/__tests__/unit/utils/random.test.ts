// Tests for src/utils/random.ts
import { describe, it, expect } from 'vitest';
import { seededRandom } from '../../../utils/random';

describe('seededRandom', () => {
  it('returns a number between 0 and 1', () => {
    const result = seededRandom(42);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1);
  });

  it('returns deterministic values for the same seed', () => {
    const seed = 12345;
    const result1 = seededRandom(seed);
    const result2 = seededRandom(seed);
    const result3 = seededRandom(seed);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('returns different values for different seeds', () => {
    const result1 = seededRandom(1);
    const result2 = seededRandom(2);
    const result3 = seededRandom(3);

    expect(result1).not.toBe(result2);
    expect(result2).not.toBe(result3);
    expect(result1).not.toBe(result3);
  });

  it('handles zero seed', () => {
    const result = seededRandom(0);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1);
  });

  it('produces well-distributed values across many seeds', () => {
    // Test that values are well-distributed
    const buckets = [0, 0, 0, 0, 0]; // 5 buckets for ranges [0, 0.2), [0.2, 0.4), etc.
    const numSamples = 1000;

    for (let i = 0; i < numSamples; i++) {
      const value = seededRandom(i);
      const bucketIndex = Math.floor(value * 5);
      buckets[bucketIndex]++;
    }

    // Each bucket should have roughly 200 samples (1000 / 5)
    // Allow for variance - check that each bucket has at least 100 and at most 300
    for (let i = 0; i < buckets.length; i++) {
      expect(buckets[i]).toBeGreaterThan(100);
      expect(buckets[i]).toBeLessThan(300);
    }
  });

  it('produces different values for consecutive seeds', () => {
    // Ensure that incrementing the seed produces different values
    const values: number[] = [];
    for (let i = 0; i < 10; i++) {
      values.push(seededRandom(i));
    }

    // Check that all values are unique
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('handles edge case seeds that might cause issues', () => {
    // Test seeds that might cause overflow or precision issues
    const edgeCases = [
      0,
      1,
      -1,
      -100,
      1000000,
      Number.MAX_SAFE_INTEGER,
      0.0001,
      -0.0001,
      3.14159,
      Math.PI,
      Math.E,
      Number.EPSILON,
      -Number.EPSILON,
    ];

    for (const seed of edgeCases) {
      const result = seededRandom(seed);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
      expect(Number.isFinite(result)).toBe(true);
      expect(Number.isNaN(result)).toBe(false);
    }
  });
});
