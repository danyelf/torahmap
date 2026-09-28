import { describe, it, expect } from 'vitest';
import { parseScript, type ViewScene } from '../script.ts';
import {
  buildTimeline,
  segmentAt,
  duration,
  glides,
  transition,
  cameraOf,
  viewHash,
  doEvents,
  actionsDue,
  captionOpacity,
  fadeRemaining,
  CAPTION_EASE_S,
  TYPE_INTERVAL_S,
  CLICK_PAUSE_S,
} from '../timeline.ts';

const script = parseScript(`
<!-- scene: a | story: intro -->
<!-- scene: b | story: intro_fivebooks | over: 2s -->
<!-- scene: c | view: zoom=0.5&x=100&y=200 -->
<!-- scene: d | view: zoom=2&x=300&y=400&verse=Genesis.12.1 | over: 2s -->
<!-- scene: e | do: click "+ add a word"; type "אב" -->
`);
const times = { a: 0, b: 2, c: 5, d: 7, e: 10, end: 12 };

describe('buildTimeline', () => {
  it('gives each scene its start and the next one’s start as its end', () => {
    const t = buildTimeline(script, times);
    expect(t.map((s) => [s.scene.id, s.start, s.end])).toEqual([
      ['a', 0, 2],
      ['b', 2, 5],
      ['c', 5, 7],
      ['d', 7, 10],
      ['e', 10, 12],
    ]);
    expect(t[1].previous?.id).toBe('a');
    expect(duration(t)).toBe(12);
  });

  it('names every scene the times leave out', () => {
    expect(() => buildTimeline(script, { a: 0, b: 2, end: 12 })).toThrow(/c, d, e/);
  });

  it('refuses times that do not start at zero', () => {
    expect(() => buildTimeline(script, { ...times, a: 1 })).toThrow(/"a".*0/);
  });

  it('refuses a scene that starts no later than the one before', () => {
    expect(() => buildTimeline(script, { ...times, c: 2 })).toThrow(/"b"/);
  });

  it('refuses a glide longer than its scene', () => {
    expect(() => buildTimeline(script, { ...times, c: 3 })).toThrow(/"b".*2s/);
  });

  it('refuses steps that run past the end of their scene', () => {
    expect(() => buildTimeline(script, { ...times, end: 10.5 })).toThrow(/"e"/);
  });

  it('rounds the seconds it reports', () => {
    const seven = parseScript('<!-- scene: s | do: type "abcdefg" -->');
    expect(() => buildTimeline(seven, { s: 0, end: 0.2 })).toThrow(/needs 0\.48s,/);
  });
});

describe('segmentAt', () => {
  const t = buildTimeline(script, times);
  it('finds the scene on screen at a second', () => {
    expect(segmentAt(t, 0).scene.id).toBe('a');
    expect(segmentAt(t, 4.99).scene.id).toBe('b');
    expect(segmentAt(t, 5).scene.id).toBe('c');
    expect(segmentAt(t, 11.9).scene.id).toBe('e');
  });
});

describe('glides and transition', () => {
  const t = buildTimeline(script, times);
  it('glides between two scenes of the same kind, and cuts otherwise', () => {
    expect(t.map(glides)).toEqual([false, true, false, true, false]);
  });
  it('eases from 0 to 1 over the glide, then holds at 1', () => {
    const b = t[1];
    expect(transition(b, 2)).toBe(0);
    expect(transition(b, 3)).toBeCloseTo(0.5);
    expect(transition(b, 4)).toBe(1);
    expect(transition(b, 4.5)).toBe(1);
  });
  it('has arrived at once in a scene that cuts', () => {
    expect(transition(t[2], 5)).toBe(1);
  });
  it('lets a scene that cuts be shorter than its glide time', () => {
    // c cuts in after a story scene, so its default 1.5s glide is never played.
    expect(() => buildTimeline(script, { ...times, d: 6 })).not.toThrow();
  });
});

describe('cameraOf', () => {
  it('reads x, y and zoom, zoom defaulting to 1', () => {
    expect(cameraOf({ x: '1', y: '2', zoom: '3' })).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(cameraOf({ x: '1', y: '2' })).toEqual({ x: 1, y: 2, zoom: 1 });
  });
  it('has no camera without both x and y', () => {
    expect(cameraOf({ verse: 'Genesis.1.1', zoom: '2' })).toBeNull();
  });
});

describe('viewHash', () => {
  const d = script.scenes[3] as ViewScene;
  const from = { x: 100, y: 200, zoom: 0.5 };
  const to = { x: 300, y: 400, zoom: 2 };

  it('holds back the verse until the camera arrives', () => {
    const mid = new URLSearchParams(viewHash(d, from, to, 0.5).slice(1));
    expect(mid.get('verse')).toBeNull();
    expect(Number(mid.get('x'))).toBe(200);
    expect(Number(mid.get('zoom'))).toBeCloseTo(1); // by ratio: 0.5 → 1 → 2
    const end = new URLSearchParams(viewHash(d, from, to, 1).slice(1));
    expect(end.get('verse')).toBe('Genesis.12.1');
    expect(Number(end.get('x'))).toBe(300);
  });

  it('goes straight to the scene with nothing to glide from', () => {
    const h = new URLSearchParams(viewHash(d, null, to, 0).slice(1));
    expect(h.get('verse')).toBe('Genesis.12.1');
  });

  it('keeps Hebrew intact through the URL', () => {
    const [s] = parseScript('<!-- scene: s | view: overlay=search&q=אַבְרָם&x=1&y=2 -->').scenes;
    const h = new URLSearchParams(
      viewHash(s as ViewScene, null, { x: 1, y: 2, zoom: 1 }, 1).slice(1),
    );
    expect(h.get('q')).toBe('אַבְרָם');
  });
});

describe('doEvents', () => {
  it('types one letter at a time, after a pause for the click', () => {
    const e = script.scenes[4];
    if (e.kind !== 'do') throw new Error('expected a do scene');
    expect(doEvents(e.steps)).toEqual([
      { at: 0, action: { kind: 'click', text: '+ add a word' } },
      { at: CLICK_PAUSE_S, action: { kind: 'key', text: 'א' } },
      { at: CLICK_PAUSE_S + TYPE_INTERVAL_S, action: { kind: 'key', text: 'ב' } },
    ]);
  });

  it('owes every action once its scene has ended, even one no frame reached', () => {
    const [ab] = parseScript('<!-- scene: ab | do: type "ab" -->').scenes;
    if (ab.kind !== 'do') throw new Error('expected a do scene');
    const events = doEvents(ab.steps);
    const segment = { scene: ab, previous: null, start: 0, end: 0.1 };
    // At 10 frames a second the only frame inside the scene is t = 0.
    expect(actionsDue(segment, events, 0)).toHaveLength(1);
    expect(actionsDue(segment, events, 0.1)).toHaveLength(2);
  });

  it('keeps nikkud with nothing lost, and waits add time', () => {
    const events = doEvents([
      { kind: 'wait', seconds: 1 },
      { kind: 'type', text: 'אַ' },
    ]);
    expect(events[0].at).toBe(1);
    expect(events.map((e) => (e.action.kind === 'key' ? e.action.text : '')).join('')).toBe('אַ');
  });
});

describe('captionOpacity', () => {
  const captioned = parseScript(`
<!-- scene: a | view: x=1&y=2 | caption: One -->
<!-- scene: b | view: x=1&y=2 | caption: One -->
<!-- scene: c | view: x=1&y=2 | caption: Two -->
<!-- scene: d | view: x=1&y=2 -->
`);
  const t = buildTimeline(captioned, { a: 0, b: 2, c: 4, d: 6, end: 8 });

  it('eases a caption in at the start of its scene', () => {
    expect(captionOpacity(t, 0, 0)).toBe(0);
    expect(captionOpacity(t, 0, CAPTION_EASE_S / 2)).toBeCloseTo(0.5);
    expect(captionOpacity(t, 0, 1)).toBe(1);
  });

  it('holds a caption the next scene repeats, across the change', () => {
    expect(captionOpacity(t, 0, 2 - 0.01)).toBe(1);
    expect(captionOpacity(t, 1, 2)).toBe(1);
  });

  it('eases a caption out before a scene with another, or none', () => {
    expect(captionOpacity(t, 1, 4 - CAPTION_EASE_S / 2)).toBeCloseTo(0.5);
    expect(captionOpacity(t, 2, 6 - 0.001)).toBeCloseTo(0, 2);
  });

  it('shows nothing in a scene with no caption', () => {
    expect(captionOpacity(t, 3, 7)).toBe(0);
  });
});

describe('fadeRemaining', () => {
  const faded = parseScript(`
<!-- scene: a | view: x=1&y=2 -->
<!-- scene: b | view: x=5&y=2 | fade: 1s -->
`);
  const t = buildTimeline(faded, { a: 0, b: 2, end: 5 });

  it('is all of the old picture as a fade begins, and none once it is over', () => {
    expect(fadeRemaining(t[1], 2)).toBe(1);
    expect(fadeRemaining(t[1], 2.5)).toBeCloseTo(0.5);
    expect(fadeRemaining(t[1], 3)).toBe(0);
  });

  it('is nothing in a scene that cuts', () => {
    expect(fadeRemaining(t[0], 0)).toBe(0);
  });

  it('refuses a fade longer than its scene', () => {
    expect(() =>
      buildTimeline(parseScript('<!-- scene: a | view: x=1&y=2 | fade: 3s -->'), { a: 0, end: 2 }),
    ).toThrow(/"a".*fade/);
  });
});
