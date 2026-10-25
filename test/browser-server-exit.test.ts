// @vitest-environment node
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OWNER_PID_ENV } from './browser/owner.ts';
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

describe('a browser suite dev server', () => {
  it('exits once the process that started the run has gone', async () => {
    const owner = spawn('sleep', ['60']);
    const port = await suitePort('TEST_SERVER_PORT');
    // Vite itself, not npx, so that killing the server kills the server.
    const server = spawn('node_modules/.bin/vite', ['--port', String(port), '--strictPort'], {
      env: { ...process.env, [OWNER_PID_ENV]: String(owner.pid) },
      stdio: 'ignore',
    });
    const code = new Promise((done) => server.on('exit', done));
    owner.kill('SIGKILL');
    try {
      expect(await code).toBe(0);
    } finally {
      server.kill('SIGKILL');
      owner.kill('SIGKILL');
      delete process.env.TEST_SERVER_PORT;
    }
  }, 60_000);
});
