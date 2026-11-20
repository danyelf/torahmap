import { memoByValueAndKey, memoByValueAndLatestKey } from '../src/index.ts';
import { describe, it, expect, vi } from 'vitest';

describe('memoByValueAndKey', () => {
  it('derives once per value and key', () => {
    const derive = vi.fn((_value: object, key: string) => ({ key }));
    const memo = memoByValueAndKey(derive);
    const value = {};
    const first = memo(value, 'a');
    expect(memo(value, 'a')).toBe(first);
    expect(memo(value, 'b')).not.toBe(first);
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('derives again for a new value', () => {
    const derive = vi.fn((_value: object, key: string) => ({ key }));
    const memo = memoByValueAndKey(derive);
    const first = memo({}, 'a');
    expect(memo({}, 'a')).not.toBe(first);
    expect(derive).toHaveBeenCalledTimes(2);
  });
});

describe('memoByValueAndLatestKey', () => {
  it('derives once while the key stays the same', () => {
    const derive = vi.fn((_value: object, key: string) => ({ key }));
    const memo = memoByValueAndLatestKey(derive);
    const value = {};
    expect(memo(value, 'a')).toBe(memo(value, 'a'));
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('lets go of the earlier key when asked with a new one', () => {
    const derive = vi.fn((_value: object, key: string) => ({ key }));
    const memo = memoByValueAndLatestKey(derive);
    const value = {};
    const first = memo(value, 'a');
    memo(value, 'b');
    expect(memo(value, 'a')).not.toBe(first);
    expect(derive).toHaveBeenCalledTimes(3);
  });
});
