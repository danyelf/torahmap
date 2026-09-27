import { describe, it, expect } from 'vitest';
import { parseScript, DEFAULT_OVER_S } from '../script.ts';

const SCRIPT = `---
size: 1280x720
fps: 30
---

<!-- scene: open | story: intro -->
The Tanakh has almost twenty-three thousand verses.

<!-- scene: torah | story: intro_fivebooks | over: 3s -->
The Five Books.
<!-- a note to self, not narration -->

<!-- scene: tool | view: overlay=search&q=אַבְרָם,יצחק&zoom=0.39&x=2832.5&y=500 -->

<!-- scene: add | do: click "+ add a word"; type "יִצְחָק; x"; press Enter; wait 0.5s -->
`;

describe('parseScript', () => {
  it('reads the frame size and rate', () => {
    const s = parseScript(SCRIPT);
    expect([s.width, s.height, s.fps]).toEqual([1280, 720, 30]);
  });

  it('defaults to 1920x1080 at 60 frames a second', () => {
    const s = parseScript('<!-- scene: a | story: intro -->');
    expect([s.width, s.height, s.fps]).toEqual([1920, 1080, 60]);
  });

  it('reads a story scene, with its glide time', () => {
    const [open, torah] = parseScript(SCRIPT).scenes;
    expect(open).toMatchObject({ id: 'open', kind: 'story', stop: 'intro', over: DEFAULT_OVER_S });
    expect(torah).toMatchObject({ kind: 'story', stop: 'intro_fivebooks', over: 3 });
  });

  it('keeps the prose after a scene as its narration, without other comments', () => {
    const [open, torah] = parseScript(SCRIPT).scenes;
    expect(open.narration).toBe('The Tanakh has almost twenty-three thousand verses.');
    expect(torah.narration).toBe('The Five Books.');
  });

  it('reads a view scene as URL parameters, Hebrew and nikkud unchanged', () => {
    const tool = parseScript(SCRIPT).scenes[2];
    expect(tool).toMatchObject({
      kind: 'view',
      params: { overlay: 'search', q: 'אַבְרָם,יצחק', zoom: '0.39', x: '2832.5', y: '500' },
    });
  });

  it('reads do steps, keeping a semicolon inside quotes', () => {
    const add = parseScript(SCRIPT).scenes[3];
    expect(add).toMatchObject({
      kind: 'do',
      steps: [
        { kind: 'click', text: '+ add a word' },
        { kind: 'type', text: 'יִצְחָק; x' },
        { kind: 'press', key: 'Enter' },
        { kind: 'wait', seconds: 0.5 },
      ],
    });
  });

  it('refuses a scene with no kind, or two', () => {
    expect(() => parseScript('<!-- scene: a | over: 2s -->')).toThrow(/scene "a"/);
    expect(() => parseScript('<!-- scene: a | story: x | view: zoom=2 -->')).toThrow(/scene "a"/);
  });

  it('refuses a step it does not know', () => {
    expect(() => parseScript('<!-- scene: a | do: dance "x" -->')).toThrow(/scene "a".*dance/);
  });

  it('refuses a repeated scene name, and the name "end"', () => {
    expect(() => parseScript('<!-- scene: a | story: x -->\n<!-- scene: a | story: y -->')).toThrow(
      /"a".*twice/,
    );
    expect(() => parseScript('<!-- scene: end | story: x -->')).toThrow(/end/);
  });

  it('refuses a script with no scenes', () => {
    expect(() => parseScript('just words')).toThrow(/no scenes/);
  });
});
