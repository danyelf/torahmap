import { describe, expect, it } from 'vitest';
import { cameraMoved } from '../../../telemetry/cameraMoved.ts';

const camera = (x: number, y: number, zoom: number) => ({ x, y, zoom });

describe('cameraMoved', () => {
  it('is true the first time, when there is no last position', () => {
    expect(cameraMoved(null, camera(0, 0, 1))).toBe(true);
  });

  it('is false when x, y and zoom are all unchanged', () => {
    expect(cameraMoved(camera(10, 20, 1), camera(10, 20, 1))).toBe(false);
  });

  it('is true when only x changed', () => {
    expect(cameraMoved(camera(10, 20, 1), camera(11, 20, 1))).toBe(true);
  });

  it('is true when only y changed', () => {
    expect(cameraMoved(camera(10, 20, 1), camera(10, 21, 1))).toBe(true);
  });

  it('is true when only zoom changed', () => {
    expect(cameraMoved(camera(10, 20, 1), camera(10, 20, 1.1))).toBe(true);
  });
});
