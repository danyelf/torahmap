import { describe, it, expect } from 'vitest';
import { DRAG_PX, sheetAfterDrag, sheetAfterTap } from '../../sheet';

describe('sheetAfterDrag', () => {
  it('grows one height on a drag up', () => {
    expect(sheetAfterDrag('down', -DRAG_PX)).toBe('normal');
    expect(sheetAfterDrag('normal', -DRAG_PX)).toBe('tall');
    expect(sheetAfterDrag('tall', -200)).toBe('tall');
  });

  it('shrinks one height on a drag down', () => {
    expect(sheetAfterDrag('tall', DRAG_PX)).toBe('normal');
    expect(sheetAfterDrag('normal', DRAG_PX)).toBe('down');
    expect(sheetAfterDrag('down', 200)).toBe('down');
  });

  it('is not a drag below the threshold', () => {
    expect(sheetAfterDrag('normal', DRAG_PX - 1)).toBeNull();
    expect(sheetAfterDrag('normal', -(DRAG_PX - 1))).toBeNull();
  });
});

describe('sheetAfterTap', () => {
  it('toggles normal and tall, and raises a lowered sheet', () => {
    expect(sheetAfterTap('normal')).toBe('tall');
    expect(sheetAfterTap('tall')).toBe('normal');
    expect(sheetAfterTap('down')).toBe('normal');
  });
});
