import { describe, it, expect } from 'vitest';
import { grayOf } from '../src/baseColor.ts';
import { MISHNAH_BASE_COLOR } from '../src/constants.ts';

describe('grayOf', () => {
  const mishnah: [number, number, number] = [...MISHNAH_BASE_COLOR];

  it('has no hue', () => {
    const [r, g, b] = grayOf(mishnah);
    expect(g).toBeCloseTo(r, 10);
    expect(b).toBeCloseTo(r, 10);
  });

  it('keeps a color about as bright as it was', () => {
    const [gray] = grayOf(mishnah);
    const luma = 0.299 * mishnah[0] + 0.587 * mishnah[1] + 0.114 * mishnah[2];
    expect(gray).toBeCloseTo(luma, 10);
  });
});
