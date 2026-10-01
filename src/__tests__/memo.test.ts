import { describe, it, expect, vi } from 'vitest';
import { memoByValueAndKey } from '../overlays/memo';

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
