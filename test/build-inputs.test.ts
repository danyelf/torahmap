// @vitest-environment node
// A build has the Talmud's page on every branch but main, the live site's.
import { afterEach, describe, expect, it } from 'vitest';
import type { UserConfig, UserConfigFnObject } from 'vite';
import config from '../vite.config.ts';

function buildInputs(branch: string): string[] {
  process.env.WORKERS_CI_BRANCH = branch;
  const built = (config as UserConfigFnObject)({ command: 'build', mode: 'production' });
  return Object.keys((built as UserConfig).build?.rollupOptions?.input ?? {});
}

describe('the pages a build writes', () => {
  const before = process.env.WORKERS_CI_BRANCH;
  afterEach(() => {
    if (before === undefined) delete process.env.WORKERS_CI_BRANCH;
    else process.env.WORKERS_CI_BRANCH = before;
  });

  it('are the Tanakh’s alone on main', () => {
    expect(buildInputs('main')).toEqual(['main']);
  });

  it('include the Talmud’s on any other branch', () => {
    expect(buildInputs('some-feature')).toEqual(['main', 'talmud']);
  });
});
