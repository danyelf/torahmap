// A suite's dev server stops itself once the process that started the run has gone, so a run
// cut short leaves no server holding a port. This guards vite.config.ts and the Vite release.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { desktopOnly } from '../browser/page.ts';
import { OWNER_PID_ENV } from '../browser/owner.ts';
import { suitePort } from '../browser/screens.ts';

test('the dev server exits once the process that started the run has gone', async () => {
  desktopOnly('no page is involved, so one screen is enough');
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const owner = spawn('sleep', ['60']);
  const port = await suitePort('SERVER_EXIT_PORT');
  // Vite itself, not npx, so that killing the server kills the server.
  const server = spawn('node_modules/.bin/vite', ['--port', String(port), '--strictPort'], {
    cwd: root,
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
  }
});
