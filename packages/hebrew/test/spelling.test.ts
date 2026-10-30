import { describe, it, expect } from 'vitest';
import { foldFinalLetters } from '../src/index.ts';

describe('foldFinalLetters', () => {
  it('writes each final letter as its plain one, and leaves the rest', () => {
    expect(foldFinalLetters('ךםןףץ שלום')).toBe('כמנפצ שלומ');
    expect(foldFinalLetters('Genesis')).toBe('Genesis');
  });
});
