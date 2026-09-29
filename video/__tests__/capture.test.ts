import { describe, it, expect } from 'vitest';
import { captureLine, storyStopLine } from '../capture.ts';
import { parseScript } from '../script.ts';
import { parseStoryMarkdown } from '@torahmap/stories';

const hashOf = (params: Record<string, string>) => `#${new URLSearchParams(params)}`;

describe('storyStopLine', () => {
  it('writes the camera as x,y,zoom, with the overlay and its settings', () => {
    const line = storyStopLine(
      'abram',
      hashOf({ overlay: 'search', zoom: '0.39', x: '2832.5', y: '500', q: 'אברם,יצחק' }),
    );
    expect(line).toBe(
      '<!-- stop: abram | camera: 2832.5,500,0.39 | overlay: search | q: אברם,יצחק -->\n\n',
    );
    const [stop] = parseStoryMarkdown(line!).stops;
    expect(stop).toMatchObject({
      id: 'abram',
      camera: { x: 2832.5, y: 500, zoom: 0.39 },
      overlay: 'search',
      overlayParams: { q: 'אברם,יצחק' },
    });
  });

  it('takes the zoom the URL leaves out as 1', () => {
    const [stop] = parseStoryMarkdown(storyStopLine('a', hashOf({ x: '1', y: '2' }))!).stops;
    expect(stop.camera).toEqual({ x: 1, y: 2, zoom: 1 });
  });

  it('centres a pinned verse, as the app does, at the zoom the URL holds', () => {
    const line = storyStopLine('call', hashOf({ verse: 'Genesis.12.1', zoom: '2.5' }));
    expect(line).toBe(
      '<!-- stop: call | camera: Genesis.12.1 | zoom: 2.5 | verse: Genesis.12.1 -->\n\n',
    );
    const [stop] = parseStoryMarkdown(line!).stops;
    expect(stop).toMatchObject({
      camera: { kind: 'verse', ref: 'Genesis.12.1' },
      zoom: 2.5,
      verse: 'Genesis.12.1',
    });
  });

  it('writes the zoom of a pinned verse even when the URL leaves it out', () => {
    // A verse stop with no zoom is drawn at 3; the URL's missing zoom means 1.
    expect(storyStopLine('v', hashOf({ verse: 'Genesis.1.1' }))).toContain('| zoom: 1 |');
  });

  it('has nothing to write for a view of the story itself', () => {
    expect(storyStopLine('s', '#story=tour&stop=abraham_zoom')).toBeNull();
  });
});

describe('captureLine', () => {
  it('captures a story stop, naming its story', () => {
    expect(captureLine('s1', '#story=tour&stop=abraham_zoom')).toBe(
      '<!-- scene: s1 | story: tour/abraham_zoom -->',
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
