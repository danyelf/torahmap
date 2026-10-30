import { describe, expect, it } from 'vitest';
import { markdown, repoOf, shotsOf } from '../publish-shots.ts';

const FILES = [
  'vis-default--phone.png',
  'vis-default--desktop.png',
  'act-amendment-legend--desktop.png',
  'act-amendment-legend-before--desktop.png',
];

describe('shotsOf', () => {
  it('takes every size of each named state, and only that state', () => {
    expect(shotsOf(['vis-default', 'act-amendment-legend'], FILES)).toEqual([
      'act-amendment-legend--desktop.png',
      'vis-default--desktop.png',
      'vis-default--phone.png',
    ]);
  });

  it('refuses a state with no screenshots', () => {
    expect(() => shotsOf(['vis-default', 'nowhere'], FILES)).toThrow(/nowhere/);
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
  });
});
