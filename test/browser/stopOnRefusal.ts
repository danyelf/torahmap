// A reporter for both suites: the site lives inside the runner, so a refused connection means
// the run has no site, and every case after it would fail the same way. Interrupting the run
// lets Playwright still stop the site and delete the build.
import type { Reporter, TestResult } from '@playwright/test/reporter';

const REFUSED = /ERR_CONNECTION_REFUSED|ECONNREFUSED/;

export const refusedConnection = (messages: readonly string[]): boolean =>
  messages.some((m) => REFUSED.test(m));

export default class StopOnRefusal implements Reporter {
  private stopped = false;

  onTestEnd(_test: unknown, result: TestResult): void {
    if (this.stopped || !refusedConnection(result.errors.map((e) => e.message ?? ''))) return;
    this.stopped = true;
    console.error('\nThe suite lost its site (connection refused). Stopping the run.');
    process.kill(process.pid, 'SIGINT');
  }
}
