// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { plan, specsOf, suitesFor, textOf } from '../test-browser.ts';

const suites = (path: string) => suitesFor(path).suites;

describe('suitesFor', () => {
  it('sends a change to what downloads when to the loading suite alone', () => {
    for (const path of [
      'packages/shell/src/loader.ts',
      'packages/shell/src/viewFiles.ts',
      'packages/shell/src/downloads.ts',
      'packages/shell/src/overlays/prebuild.ts',
      'packages/shell/src/dataFiles.ts',
      'packages/shell/src/loadNotice.ts',
      'apps/talmud/src/files.ts',
      'test/loading/tanakh.spec.ts',
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
      'public/favicon.png',
      'scripts/ieeevis/pack.ts',
    ])
      expect(suites(path), path).toEqual(['layout']);
  });

  it('runs both for the page, its server and dependencies, and what both suites read', () => {
    for (const path of [
      'vite.config.ts',
      'package-lock.json',
      'test/browser/page.ts',
      'public/data/talmud/structure.json',
      'packages/shell/src/analytics.ts',
      'apps/talmud/src/data.ts',
      'apps/tanakh/src/verseTexts.ts',
      'apps/tanakh/src/search/data.ts',
    ])
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
      'vitest.config.ts',
      '.prettierrc.json',
    ])
      expect(suites(path), path).toEqual([]);
  });

  it('runs both for a file no rule names', () => {
    expect(suitesFor('somewhere/new.ts')).toEqual({ suites: ['layout', 'loading'], named: false });
  });
});

describe('textOf', () => {
  it('names the text whose app, data or tests a file is', () => {
    expect(textOf('apps/talmud/src/text.ts')).toBe('talmud');
    expect(textOf('public/data/euaiact/structure.json')).toBe('euaiact');
    expect(textOf('test/layout/ieeevis.spec.ts')).toBe('ieeevis');
    expect(textOf('test/layout/tanakh-analytics.spec.ts')).toBe('tanakh');
    expect(textOf('test/loading/talmud.spec.ts')).toBe('talmud');
  });

  it('gives the Tanakh the rest of the data, and the stories', () => {
    expect(textOf('public/data/all-texts.json')).toBe('tanakh');
    expect(textOf('public/data/search/lexicon.json')).toBe('tanakh');
    expect(textOf('packages/stories/markdown/tour.md')).toBe('tanakh');
  });

  it('names no text for what the texts share', () => {
    for (const path of [
      'packages/shell/src/main.ts',
      'test/layout/check.ts',
      'test/layout/shareCards.spec.ts',
      'index.html',
    ])
      expect(textOf(path), path).toBeUndefined();
  });
});

describe('plan', () => {
  it('lists each suite with the files that call for it, and leaves out a suite none does', () => {
    expect(plan(['apps/talmud/src/text.ts', 'docs/x.md'])).toEqual(
      new Map([['layout', { files: ['apps/talmud/src/text.ts'], texts: new Set(['talmud']) }]]),
    );
  });

  it("runs only the texts the files are each one's own", () => {
    const runs = plan(['apps/talmud/src/text.ts', 'apps/euaiact/src/text.ts']);
    expect(runs.get('layout')!.texts).toEqual(new Set(['talmud', 'euaiact']));
  });

  it('runs every text once any file is shared', () => {
    const runs = plan(['apps/talmud/src/text.ts', 'packages/shell/src/main.ts']);
    expect(runs.get('layout')!.texts).toBe('every');
  });
});

describe('specsOf', () => {
  it("takes each text's spec files by their names, and nothing else", () => {
    const files = [
      'tanakh.spec.ts',
      'tanakh-analytics.spec.ts',
      'talmud.spec.ts',
      'shareCards.spec.ts',
      'page.ts',
    ];
    expect(specsOf(new Set(['tanakh']), files)).toEqual([
      'tanakh.spec.ts',
      'tanakh-analytics.spec.ts',
    ]);
    expect(specsOf(new Set(['euaiact']), files)).toEqual([]);
  });
});
