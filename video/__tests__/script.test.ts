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

  it('reads a caption, where it sits, and a fade in from the scene before', () => {
    const [a] = parseScript(
      '<!-- scene: a | view: x=1&y=2 | caption: Every row, a chapter. | caption-at: top | fade: 0.8s -->',
    ).scenes;
    expect(a).toMatchObject({ caption: 'Every row, a chapter.', captionAt: 'top', fade: 0.8 });
  });

  it('puts a caption at the bottom, and fades nothing, unless told', () => {
    const [a] = parseScript('<!-- scene: a | view: x=1&y=2 | caption: Hi -->').scenes;
    expect(a).toMatchObject({ caption: 'Hi', captionAt: 'bottom', fade: 0 });
  });

  it('reads the panel a scene wants, defaulting to the script’s', () => {
    const s = parseScript(`---
panel: closed
---
<!-- scene: a | view: x=1&y=2 -->
<!-- scene: b | view: x=1&y=2 | panel: search -->`);
    expect(s.scenes.map((sc) => sc.panel)).toEqual(['closed', 'search']);
  });

  it('leaves the panel alone when nothing names it', () => {
    const [a] = parseScript('<!-- scene: a | view: x=1&y=2 -->').scenes;
    expect(a.panel).toBeUndefined();
  });

  it('refuses a caption position or panel it does not know', () => {
    expect(() => parseScript('<!-- scene: a | view: x=1 | caption-at: middle -->')).toThrow(
      /scene "a".*middle/,
    );
    expect(() => parseScript('<!-- scene: a | view: x=1 | panel: sideways -->')).toThrow(
      /scene "a".*sideways/,
    );
  });

  it('reads a pan, in pixels, after a view arrives', () => {
    const [a] = parseScript('<!-- scene: a | view: verse=Genesis.1.1 | pan: 270,-365 -->').scenes;
    expect(a).toMatchObject({ kind: 'view', pan: { dx: 270, dy: -365 } });
  });

  it('names the story a stop belongs to, the tour unless told', () => {
    const [a, b] = parseScript(
      '<!-- scene: a | story: intro -->\n<!-- scene: b | story: sample/first -->',
    ).scenes;
    expect(a).toMatchObject({ kind: 'story', story: 'tour', stop: 'intro' });
    expect(b).toMatchObject({ kind: 'story', story: 'sample', stop: 'first' });
  });

  it('refuses a script with no scenes', () => {
    expect(() => parseScript('just words')).toThrow(/no scenes/);
  });
});
