import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { OWNER_PID_ENV } from './browser/owner.ts';
import { suitePort } from './browser/screens.ts';

describe('a browser suite port', () => {
  it('is free, and the same for every process that reads it', async () => {
    delete process.env.TEST_SUITE_PORT;
    const port = await suitePort('TEST_SUITE_PORT');
    expect(port).toBeGreaterThan(0);
    expect(await suitePort('TEST_SUITE_PORT')).toBe(port);
    expect(process.env.TEST_SUITE_PORT).toBe(String(port));
  });

  it('is the one the environment names', async () => {
    process.env.TEST_SUITE_PORT_SET = '5199';
    expect(await suitePort('TEST_SUITE_PORT_SET')).toBe(5199);
  });
});

describe('a browser suite dev server', () => {
  it('exits once the process that started the run has gone', async () => {
    const owner = spawn('sleep', ['60']);
    const server = spawn('npx', ['vite', '--port', '0'], {
      env: { ...process.env, [OWNER_PID_ENV]: String(owner.pid) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const exited = new Promise<void>((done) => server.on('exit', () => done()));
    await new Promise<void>((ready) =>
      server.stdout!.on('data', (chunk: Buffer) => chunk.includes('Local:') && ready()),
    );
    owner.kill('SIGKILL');
    const outcome = await Promise.race([
      exited.then(() => 'exited'),
      new Promise((done) => setTimeout(() => done('still running'), 10_000)),
    ]);
    if (outcome !== 'exited') server.kill('SIGKILL');
    expect(outcome).toBe('exited');
  }, 60_000);
});
