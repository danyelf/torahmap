// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { suitePort } from './browser/screens.ts';

describe('a browser suite port', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TEST_SUITE_PORT;
  });

  it('is free, and the same for every process that reads it', async () => {
    const port = await suitePort('TEST_SUITE_PORT');
    expect(port).toBeGreaterThan(0);
    expect(await suitePort('TEST_SUITE_PORT')).toBe(port);
    expect(process.env.TEST_SUITE_PORT).toBe(String(port));
  });

  it('is the one the environment names', async () => {
    vi.stubEnv('TEST_SUITE_PORT_SET', '4321');
    expect(await suitePort('TEST_SUITE_PORT_SET')).toBe(4321);
  });
});
