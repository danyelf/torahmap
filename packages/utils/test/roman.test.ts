import { describe, it, expect } from 'vitest';
import { fromRoman, toRoman } from '../src/index.ts';

describe('Roman numerals', () => {
  it('reads back every number it writes, 1 to 399', () => {
    for (let n = 1; n < 400; n++) expect(fromRoman(toRoman(n))).toBe(n);
  });

  it('reads either case', () => {
    expect(fromRoman('iii')).toBe(fromRoman('III'));
  });

  it('reads nothing that is not a numeral as written', () => {
    for (const text of ['', 'iiii', 'ic', 'vx', 'abc', '3'])
      expect(fromRoman(text), text).toBeNull();
  });
});
