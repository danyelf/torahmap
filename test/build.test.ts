// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { builtPages, isLiveBuild, unpublished } from '../build.ts';

describe('which build is the live site’s', () => {
  it('is a build of main', () => {
    expect(isLiveBuild('build', 'main')).toBe(true);
  });

  it('is not a build of any other branch, nor the dev server', () => {
    expect(isLiveBuild('build', 'some-feature')).toBe(false);
    expect(isLiveBuild('serve', 'main')).toBe(false);
  });
});

describe('the live site’s build', () => {
  it('writes the Tanakh’s page alone', () => {
    expect(builtPages(true)).toEqual(['main']);
  });

  it('leaves the Talmud’s data unpublished', () => {
    expect(unpublished(true)).toContain('data/talmud');
  });
});

describe('any other branch’s build', () => {
  it('writes the Talmud’s page too', () => {
    expect(builtPages(false)).toEqual(['main', 'talmud']);
  });

  it('publishes the Talmud’s data', () => {
    expect(unpublished(false)).not.toContain('data/talmud');
  });
});
