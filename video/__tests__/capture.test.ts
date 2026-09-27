import { describe, it, expect } from 'vitest';
import { captureLine } from '../capture.ts';
import { parseScript } from '../script.ts';

describe('captureLine', () => {
  it('captures a story stop', () => {
    expect(captureLine('s1', '#story=abraham_zoom')).toBe(
      '<!-- scene: s1 | story: abraham_zoom -->',
    );
  });

  it('captures a view, Hebrew readable, and parses back to the same state', () => {
    const hash = `#${new URLSearchParams({ overlay: 'search', q: 'אברם,יצחק', zoom: '2.5', x: '3320.5', y: '91.8' })}`;
    const line = captureLine('s2', hash);
    expect(line).toBe(
      '<!-- scene: s2 | view: overlay=search&q=אברם,יצחק&zoom=2.5&x=3320.5&y=91.8 -->',
    );
    const [scene] = parseScript(line).scenes;
    expect(scene).toMatchObject({ kind: 'view', params: { q: 'אברם,יצחק', x: '3320.5' } });
  });

  it('keeps a value encoded when it holds a character the URL needs', () => {
    const hash = `#${new URLSearchParams({ q: 'a&b' })}`;
    const [scene] = parseScript(captureLine('s3', hash)).scenes;
    expect(scene).toMatchObject({ params: { q: 'a&b' } });
  });
});
