import { describe, it, expect, vi } from 'vitest';
import { linkForScreen, pushes } from '../../linkForScreen';

const view = { verse: 'Genesis.12.1', overlay: 'commentary', overlayParams: {} };
const otherView = { verse: 'Genesis.17.5', overlay: 'commentary', overlayParams: {} };
const stop = { story: 'tour', stop: 'abraham_call', overlayParams: {} };
const otherStop = { story: 'tour', stop: 'abraham_rename', overlayParams: {} };
const story = { id: 'tour', stop: 'abraham_call' };

describe('linkForScreen', () => {
  it('names the stop while the story has the map', () => {
    const explore = vi.fn(() => view);
    expect(linkForScreen({ mode: 'story', driver: 'story', story, explore })).toEqual({
      story: 'tour',
      stop: 'abraham_call',
      overlayParams: {},
    });
    expect(explore).not.toHaveBeenCalled();
  });

  it("is the reader's view once they take the map inside a story", () => {
    expect(linkForScreen({ mode: 'story', driver: 'reader', story, explore: () => view })).toBe(
      view,
    );
  });

  it("is the reader's view while exploring", () => {
    expect(linkForScreen({ mode: 'explore', driver: 'reader', story, explore: () => view })).toBe(
      view,
    );
  });
});

describe('pushes', () => {
  it('leaving a story for the reader’s own view pushes even if not asked', () => {
    expect(pushes(stop, view, false)).toBe(true);
    expect(pushes({ stop: 'abraham_call', overlayParams: {} }, view, false)).toBe(true);
  });

  it('a story taking the map back does not push unless asked', () => {
    expect(pushes(view, stop, false)).toBe(false);
    expect(pushes(view, stop, true)).toBe(true);
  });

  it('one explore view to another follows what was asked', () => {
    expect(pushes(view, otherView, false)).toBe(false);
    expect(pushes(view, otherView, true)).toBe(true);
  });

  it('one stop to another follows what was asked', () => {
    expect(pushes(stop, otherStop, false)).toBe(false);
    expect(pushes(stop, otherStop, true)).toBe(true);
  });
});
