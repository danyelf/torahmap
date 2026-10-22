// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { plan, suitesFor } from '../test-browser.ts';

const suites = (path: string) => suitesFor(path).suites;

describe('suitesFor', () => {
  it('sends a change to what downloads when to the loading suite alone', () => {
    for (const path of [
      'packages/shell/src/loader.ts',
      'packages/shell/src/downloads.ts',
      'apps/talmud/src/files.ts',
      'public/data/talmud/structure.json',
      'test/loading/loading.spec.ts',
    ])
      expect(suites(path), path).toEqual(['loading']);
  });

  it('sends a change to the interface to the layout suite alone', () => {
    for (const path of [
      'packages/shell/src/main.ts',
      'packages/engine/src/webgl.ts',
      'apps/tanakh/src/overlays/trope.ts',
      'apps/talmud/src/text.ts',
      'packages/stories/markdown/abraham.md',
      'test/layout/talmud.spec.ts',
      'test/layout/page.ts',
      'index.html',
    ])
      expect(suites(path), path).toEqual(['layout']);
  });

  it('runs both for the page, its server and dependencies, and what both suites read', () => {
    for (const path of ['vite.config.ts', 'package-lock.json', 'test/browser/page.ts'])
      expect(suites(path), path).toEqual(['layout', 'loading']);
  });

  it('runs neither for unit tests, the Worker, tooling and documents', () => {
    for (const path of [
      'packages/shell/test/frame.test.ts',
      'test/dev-server.test.ts',
      'test/layout/geometry.test.ts',
      'apps/worker/src/index.ts',
      'scripts/suite-lock.ts',
      'docs/plans/2026-10-22-browser-suites-by-change.md',
      'CLAUDE.md',
      '.github/workflows/review-freshness.yml',
      'tsconfig.json',
      'package.json',
    ])
      expect(suites(path), path).toEqual([]);
  });

  it('runs both for a file no rule names', () => {
    expect(suitesFor('somewhere/new.ts')).toEqual({ suites: ['layout', 'loading'], named: false });
  });
});

describe('plan', () => {
  it('lists each suite with the files that call for it, and leaves out a suite none does', () => {
    expect(plan(['packages/shell/src/main.ts', 'docs/x.md'])).toEqual(
      new Map([['layout', ['packages/shell/src/main.ts']]]),
    );
  });
});
