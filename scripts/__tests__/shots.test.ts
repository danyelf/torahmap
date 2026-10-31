// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { grepFor, markdown, repoOf, shotNames } from '../shots.ts';

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

describe('shotNames', () => {
  it('names each state on each screen', () => {
    expect(shotNames(['vis-default', 'act-search'], ['desktop', 'phone'])).toEqual([
      'act-search--desktop.png',
      'act-search--phone.png',
      'vis-default--desktop.png',
      'vis-default--phone.png',
    ]);
  });
});

describe('repoOf', () => {
  it('reads owner/repo from HTTPS and SSH remotes', () => {
    expect(repoOf('https://github.com/o/r')).toBe('o/r');
    expect(repoOf('https://github.com/o/r.git')).toBe('o/r');
    expect(repoOf('git@github.com:o/r.git')).toBe('o/r');
  });
});

describe('markdown', () => {
  it('links each picture by commit', () => {
    expect(markdown('o/r', 'abc', ['s--phone.png'])).toBe(
      '![s--phone](https://github.com/o/r/blob/abc/s--phone.png?raw=true)',
    );
    expect(markdown('o/r', 'abc', ['og-image.jpg'])).toBe(
      '![og-image](https://github.com/o/r/blob/abc/og-image.jpg?raw=true)',
    );
  });
});
