// @vitest-environment node
// A build has the Talmud's page on every branch but main, the live site's.
import { afterEach, describe, expect, it } from 'vitest';
import type { Plugin, UserConfig, UserConfigFnObject } from 'vite';
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

/** What the build tells Cloudflare not to publish, on `branch`. */
function unpublished(branch: string): string[] {
  process.env.WORKERS_CI_BRANCH = branch;
  const built = (config as UserConfigFnObject)({
    command: 'build',
    mode: 'production',
  }) as UserConfig;
  const emitted: string[] = [];
  for (const plugin of (built.plugins ?? []).flat() as Plugin[]) {
    const hook = plugin && plugin.generateBundle;
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    handler?.call(
      {
        emitFile: (file: { fileName: string; source: string }) => {
          if (file.fileName === '.assetsignore') emitted.push(...file.source.split('\n'));
          return '';
        },
      } as never,
      {} as never,
      {},
      false,
    );
  }
  return emitted.filter((line) => line && !line.startsWith('#'));
}

describe('the data a build publishes', () => {
  const before = process.env.WORKERS_CI_BRANCH;
  afterEach(() => {
    if (before === undefined) delete process.env.WORKERS_CI_BRANCH;
    else process.env.WORKERS_CI_BRANCH = before;
  });

  it('leaves out the Talmud’s on main, which has no Talmud page', () => {
    expect(unpublished('main')).toContain('data/talmud');
  });

  it('includes the Talmud’s on any other branch', () => {
    expect(unpublished('some-feature')).not.toContain('data/talmud');
  });
});
