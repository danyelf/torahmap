// @vitest-environment node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearStale, release, tryAcquire, type Owner } from '../suite-lock.ts';

const SCRIPT = fileURLToPath(new URL('../suite-lock.ts', import.meta.url));

let dir: string;
let lock: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'suite-lock-'));
  lock = join(dir, 'torahmap-browser-suite.lock');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const owner = (pid: number): Owner => ({ pid, dir: '/somewhere', command: 'playwright test' });
const exitedPid = () => spawnSync(process.execPath, ['-e', '']).pid!;
const heldBy = () => JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8')).pid;

describe('tryAcquire', () => {
  it('takes a free lock', () => {
    expect(tryAcquire(lock, owner(exitedPid()))).toEqual(owner(heldBy()));
  });

  it('leaves a lock whose owner is running', () => {
    tryAcquire(lock, owner(process.pid));
    expect(tryAcquire(lock, owner(exitedPid())).pid).toBe(process.pid);
    expect(heldBy()).toBe(process.pid);
  });

  it('takes over a lock whose owner has exited', () => {
    tryAcquire(lock, owner(exitedPid()));
    const me = owner(process.pid);
    expect(tryAcquire(lock, me)).toEqual(me);
    expect(heldBy()).toBe(process.pid);
  });
});

describe('clearStale', () => {
  it('leaves a lock taken since its dead owner was seen', () => {
    const dead = owner(exitedPid());
    tryAcquire(lock, owner(process.pid));
    clearStale(lock, dead, owner(exitedPid()));
    expect(heldBy()).toBe(process.pid);
  });
});

describe('release', () => {
  it("lets go of its own lock and leaves another's", () => {
    const other = owner(exitedPid());
    tryAcquire(lock, owner(process.pid));
    release(lock, other);
    expect(existsSync(lock)).toBe(true);
    release(lock, owner(process.pid));
    expect(existsSync(lock)).toBe(false);
  });
});

/** Runs the script on `code`, with the lock in this test's folder. */
function run(code: string) {
  return spawn(process.execPath, [SCRIPT, process.execPath, '-e', code], {
    env: { ...process.env, TMPDIR: dir, SUITE_LOCK: '', LOCK: lock },
  });
}
const exited = (child: ReturnType<typeof spawn>) =>
  new Promise<number | null>((resolve) => child.on('exit', resolve));

describe('the script', () => {
  it('holds the lock while the suite runs, then lets go and passes on its exit code', async () => {
    const child = run('process.exit(require("fs").existsSync(process.env.LOCK) ? 3 : 9)');
    expect(await exited(child)).toBe(3);
    expect(existsSync(lock)).toBe(false);
  });

  it('waits for a running owner to let go', async () => {
    tryAcquire(lock, owner(process.pid));
    const child = run('process.exit(0)');
    let done = false;
    const code = exited(child).then((c) => ((done = true), c));
    await new Promise((resolve) => child.stdout!.once('data', resolve));
    expect(done).toBe(false);
    release(lock, owner(process.pid));
    expect(await code).toBe(0);
    expect(existsSync(lock)).toBe(false);
  });

  it('lets go when it is stopped', async () => {
    const child = run('setInterval(() => {}, 1000)');
    await expect.poll(() => existsSync(lock)).toBe(true);
    child.kill('SIGTERM');
    await exited(child);
    expect(existsSync(lock)).toBe(false);
  });
});
