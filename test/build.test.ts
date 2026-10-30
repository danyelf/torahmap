// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { builtPages, EXTRA_PAGES, type ExtraPage, isLiveBuild, unpublished } from '../build.ts';

describe('which build is the live site’s', () => {
  it('is a build of main', () => {
    expect(isLiveBuild('build', 'main')).toBe(true);
  });

  it('is not a build of any other branch, nor the dev server', () => {
    expect(isLiveBuild('build', 'some-feature')).toBe(false);
    expect(isLiveBuild('serve', 'main')).toBe(false);
  });
});

const NONE_LIVE: readonly ExtraPage[] = [
  { page: 'talmud', dataDir: 'talmud', live: false },
  { page: 'euaiact', dataDir: 'euaiact', live: false },
];
const TALMUD_LIVE = NONE_LIVE.map((p) => (p.page === 'talmud' ? { ...p, live: true } : p));

describe('the live site’s build', () => {
  it('writes the Tanakh’s page alone while no other page is live', () => {
    expect(builtPages(true, NONE_LIVE)).toEqual(['main']);
  });

  it('leaves each unpublished page’s data out', () => {
    expect(unpublished(true, NONE_LIVE)).toEqual(
      expect.arrayContaining(['data/talmud', 'data/euaiact']),
    );
  });

  it('publishes a page whose flag is on, and only that page', () => {
    expect(builtPages(true, TALMUD_LIVE)).toEqual(['main', 'talmud']);
    expect(unpublished(true, TALMUD_LIVE)).toContain('data/euaiact');
    expect(unpublished(true, TALMUD_LIVE)).not.toContain('data/talmud');
  });

  it('holds no page and no data of an unpublished text', () => {
    const held = builtPages(true);
    for (const page of EXTRA_PAGES.filter((p) => !p.live)) {
      expect(held).not.toContain(page.page);
      expect(unpublished(true)).toContain(`data/${page.dataDir}`);
    }
  });
});

describe('any other branch’s build', () => {
  it('writes every page and publishes all their data', () => {
    expect(builtPages(false, TALMUD_LIVE)).toEqual(['main', 'talmud', 'euaiact']);
    expect(unpublished(false, TALMUD_LIVE)).toEqual(['.assetsignore']);
  });
});
