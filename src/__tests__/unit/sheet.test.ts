import { describe, it, expect } from 'vitest';
import { DRAG_PX, sheetAfterGesture } from '../../sheet';

describe('sheetAfterGesture', () => {
  it('grows one height on a drag up', () => {
    expect(sheetAfterGesture('down', -DRAG_PX)).toBe('normal');
    expect(sheetAfterGesture('normal', -DRAG_PX)).toBe('tall');
    expect(sheetAfterGesture('tall', -200)).toBe('tall');
  });

  it('shrinks one height on a drag down', () => {
    expect(sheetAfterGesture('tall', DRAG_PX)).toBe('normal');
    expect(sheetAfterGesture('normal', DRAG_PX)).toBe('down');
    expect(sheetAfterGesture('down', 200)).toBe('down');
  });

  it('toggles between normal and tall on a tap, and raises a lowered sheet', () => {
    expect(sheetAfterGesture('normal', 3)).toBe('tall');
    expect(sheetAfterGesture('tall', -3)).toBe('normal');
    expect(sheetAfterGesture('down', 0)).toBe('normal');
  });
});
