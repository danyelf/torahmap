// Runs a browser test suite once no other is running on this machine, from any
// checkout: two at once slow each other into timeouts.
//
//   node scripts/suite-lock.ts playwright test -c test/layout [args...]
//
// SUITE_LOCK=off runs it at once. A suite still running after LIMIT_MS is
// stopped, so a hung one cannot keep the others waiting.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Owner {
  pid: number;
  dir: string;
  command: string;
  /** When the lock was taken, in ms since the epoch. */
  since?: number;
}

const POLL_MS = 2000;

// A full run takes about 5 minutes, and took 9 before the suites were sped up,
// with other suites running beside it.
const LIMIT_MS = 20 * 60_000;
/** How long a stopped suite has to exit before it is killed outright. */
const GRACE_MS = 10_000;
/**
 * A lock this old is stale even if its process number is running: after a
 * restart, an unrelated program can have that number.
 */
export const STALE_AFTER_MS = LIMIT_MS + GRACE_MS + 60_000;

const lockPath = () => join(tmpdir(), 'torahmap-browser-suite.lock');

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function ownerOf(lock: string): Owner | undefined {
  try {
    return JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Takes the lock unless a running process holds it, and returns whoever holds
 * it now. The lock is a directory holding its owner, renamed into place whole,
 * so no one ever sees it without one.
 */
export function tryAcquire(lock: string, me: Owner, now = Date.now()): Owner {
  const mine = `${lock}.${me.pid}`;
  for (;;) {
    mkdirSync(mine, { recursive: true });
    writeFileSync(join(mine, 'owner.json'), JSON.stringify({ ...me, since: now }));
    try {
      renameSync(mine, lock);
      return me;
    } catch (e) {
      rmSync(mine, { recursive: true, force: true });
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw e;
    }
    const owner = ownerOf(lock);
    if (owner && alive(owner.pid) && now - (owner.since ?? now) <= STALE_AFTER_MS) return owner;
    clearStale(lock, owner, me);
  }
}

/**
 * Deletes the lock `seen` held, its owner having exited or held it too long.
 * Moved aside before it is deleted, so of two processes that find it, only one
 * clears it; the other may move aside the lock the first has since taken, and
 * puts it back.
 */
export function clearStale(lock: string, seen: Owner | undefined, me: Owner): void {
  const aside = `${lock}.stale.${me.pid}`;
  try {
    renameSync(lock, aside);
  } catch {
    return; // Someone else moved it first.
  }
  if (ownerOf(aside)?.pid === seen?.pid) {
    rmSync(aside, { recursive: true, force: true });
    return;
  }
  try {
    renameSync(aside, lock);
  } catch {
    // A third process took the lock meanwhile; it holds it now.
    rmSync(aside, { recursive: true, force: true });
  }
}

export function release(lock: string, me: Owner): void {
  if (ownerOf(lock)?.pid === me.pid) rmSync(lock, { recursive: true, force: true });
}

async function acquire(lock: string, me: Owner): Promise<void> {
  let waitingFor: number | undefined;
  for (;;) {
    const owner = tryAcquire(lock, me);
    if (owner.pid === me.pid) return;
    if (owner.pid !== waitingFor) {
      console.log(
        `Waiting for the browser suite that process ${owner.pid} is running in ${owner.dir}: ` +
          `${owner.command}\n(lock: ${lock})`,
      );
      waitingFor = owner.pid;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function main([command, ...args]: string[]): Promise<void> {
  const lock = lockPath();
  const me = { pid: process.pid, dir: process.cwd(), command: [command, ...args].join(' ') };
  const locked = process.env.SUITE_LOCK !== 'off';
  let child: ReturnType<typeof spawn> | undefined;
  // Ctrl-C reaches the suite too; this waits for it to stop, then lets go.
  const stop = () => {
    if (!child) {
      if (locked) release(lock, me);
      process.exit(130);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', () => {
    stop();
    child?.kill('SIGTERM');
  });
  if (locked) await acquire(lock, me);
  child = spawn(command, args, { stdio: 'inherit' });
  const limit = Number(process.env.SUITE_LOCK_LIMIT_MS) || LIMIT_MS; // Shorter for its tests.
  let timedOut = false;
  setTimeout(() => {
    timedOut = true;
    console.error(
      `The browser suite was still running after ${limit / 60_000} minutes; stopping it.`,
    );
    child!.kill('SIGTERM');
    setTimeout(() => child!.kill('SIGKILL'), GRACE_MS).unref();
  }, limit).unref();
  child.on('error', (e) => {
    console.error(e.message);
    if (locked) release(lock, me);
    process.exit(1);
  });
  child.on('exit', (code) => {
    if (locked) release(lock, me);
    process.exit(timedOut ? 124 : (code ?? 1));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
