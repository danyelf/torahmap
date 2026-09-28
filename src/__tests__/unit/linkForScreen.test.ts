import { describe, it, expect, vi } from 'vitest';
import { linkForScreen } from '../../linkForScreen';

const view = { verse: 'Genesis.12.1', overlay: 'commentary', overlayParams: {} };
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
