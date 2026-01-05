import { describe, it, expect } from 'vitest';
import {
  calculateWrapPoints,
  seededRandom,
  getSection,
  getLayoutBounds,
} from '../layout';

describe('calculateWrapPoints', () => {
  it('returns single element for chapters under threshold', () => {
    expect(calculateWrapPoints(30)).toEqual([30]);
    expect(calculateWrapPoints(50)).toEqual([50]);
  });

  it('avoids widow lines (< 3 verses)', () => {
    // 52 verses: would be 50+2 (widow), so becomes 49+3
    expect(calculateWrapPoints(52)).toEqual([49, 3]);
    // 51 verses: 50+1 → 48+3
    expect(calculateWrapPoints(51)).toEqual([48, 3]);
  });

  it('handles exact multiples of threshold', () => {
    expect(calculateWrapPoints(100)).toEqual([50, 50]);
    expect(calculateWrapPoints(150)).toEqual([50, 50, 50]);
  });

  it('handles Psalm 119 (176 verses)', () => {
    const result = calculateWrapPoints(176);
    // 176 = 50 + 50 + 50 + 26
    expect(result).toEqual([50, 50, 50, 26]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(176);
  });

  it('never produces lines with fewer than 3 verses', () => {
    // Test various verse counts that could produce widows
    for (const count of [51, 52, 53, 101, 102, 103, 151, 152, 153]) {
      const lines = calculateWrapPoints(count);
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(3);
      }
      expect(lines.reduce((a, b) => a + b, 0)).toBe(count);
    }
  });
});

describe('seededRandom', () => {
  it('produces deterministic output', () => {
    const value1 = seededRandom(42);
    const value2 = seededRandom(42);
    expect(value1).toBe(value2);
  });

  it('produces different values for different seeds', () => {
    const value1 = seededRandom(1);
    const value2 = seededRandom(2);
    expect(value1).not.toBe(value2);
  });

  it('produces values in [0, 1) range', () => {
    for (let i = 0; i < 100; i++) {
      const value = seededRandom(i);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('getSection', () => {
  it('classifies Torah books correctly', () => {
    expect(getSection('Genesis')).toBe('torah');
    expect(getSection('Exodus')).toBe('torah');
    expect(getSection('Leviticus')).toBe('torah');
    expect(getSection('Numbers')).toBe('torah');
    expect(getSection('Deuteronomy')).toBe('torah');
  });

  it('classifies Nevi\'im books correctly', () => {
    expect(getSection('Joshua')).toBe('neviim');
    expect(getSection('Isaiah')).toBe('neviim');
    expect(getSection('Jeremiah')).toBe('neviim');
    expect(getSection('Hosea')).toBe('neviim');
    expect(getSection('Malachi')).toBe('neviim');
  });

  it('classifies Ketuvim books correctly', () => {
    expect(getSection('Psalms')).toBe('ketuvim');
    expect(getSection('Proverbs')).toBe('ketuvim');
    expect(getSection('Job')).toBe('ketuvim');
    expect(getSection('Ruth')).toBe('ketuvim');
    expect(getSection('Daniel')).toBe('ketuvim');
  });
});

describe('getLayoutBounds', () => {
  it('calculates bounds from verse positions', () => {
    const verses = [
      { x: 10, y: 20, size: 6, book: 'Test', chapter: 1, verse: 1, color: [0.5, 0.5, 0.5] as [number, number, number] },
      { x: 100, y: 200, size: 6, book: 'Test', chapter: 1, verse: 2, color: [0.5, 0.5, 0.5] as [number, number, number] },
    ];
    const bounds = getLayoutBounds(verses);
    expect(bounds.width).toBe(106); // 100 + 6
    expect(bounds.height).toBe(206); // 200 + 6
  });

  it('handles empty array', () => {
    const bounds = getLayoutBounds([]);
    expect(bounds.width).toBe(0);
    expect(bounds.height).toBe(0);
  });
});
