// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { grepFor } from '../shots.ts';

describe('grepFor', () => {
  // As Playwright matches it: the file, any describe titles and the test's title.
  const grep = new RegExp(grepFor(['vis-default', 'act-search']));

  it('matches the named states and the share cards', () => {
    expect(grep.test('check.ts vis-default')).toBe(true);
    expect(grep.test('check.ts act-search')).toBe(true);
    expect(grep.test('shareCards.spec.ts share cards the Tanakh card shows the whole map')).toBe(
      true,
    );
  });

  it('matches no other state, even one whose name holds a named one', () => {
    expect(grep.test('check.ts vis-default-pinned')).toBe(false);
    expect(grep.test('check.ts act-search-panel')).toBe(false);
  });
});
