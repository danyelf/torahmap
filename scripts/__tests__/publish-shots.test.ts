import { describe, expect, it } from 'vitest';
import { markdown, repoOf, shotsOf } from '../publish-shots.ts';

const FILES = [
  'vis-default--phone.png',
  'vis-default--desktop.png',
  'vis-default--laptop.png',
  'act-amendment-legend--desktop.png',
  'act-amendment-legend--phone.png',
  'act-amendment-legend-before--desktop.png',
];

describe('shotsOf', () => {
  it('takes each named state on each named screen, and nothing else', () => {
    expect(shotsOf(['vis-default', 'act-amendment-legend'], ['desktop', 'phone'], FILES)).toEqual([
      'act-amendment-legend--desktop.png',
      'act-amendment-legend--phone.png',
      'vis-default--desktop.png',
      'vis-default--phone.png',
    ]);
  });

  it('refuses a state missing on a screen', () => {
    expect(() => shotsOf(['vis-default', 'nowhere'], ['desktop'], FILES)).toThrow(/nowhere/);
    expect(() => shotsOf(['act-amendment-legend-before'], ['phone'], FILES)).toThrow(
      /act-amendment-legend-before--phone/,
    );
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
