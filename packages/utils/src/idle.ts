/**
 * Run `run` off the critical path, once the browser is idle. Safari has no
 * `requestIdleCallback`, hence the timer. The deadline matters more than the
 * idleness: on a page that never goes idle the callback must still run.
 */
export function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(run, IDLE_TIMEOUT_MS);
  }
}

/** Long enough to be clear of first paint, short enough to beat a deliberate click. */
const IDLE_TIMEOUT_MS = 2000;
