/**
 * Run `run` once the app has finished starting up, off the critical path: at
 * the moment this is called the first frame has been drawn but the browser may
 * still be laying out and painting. Safari has no `requestIdleCallback`, hence
 * the timer. The deadline matters more than the idleness: on a page that never
 * goes idle the callback must still run.
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
