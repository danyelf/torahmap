import { describe, it, expect } from 'vitest';
import { storyTitle, stopOpening } from '@torahmap/stories';

describe('story names', () => {
  it('titles a story by id', () => {
    expect(storyTitle('tour')).toBe('The Guided Tour');
    expect(storyTitle('gone')).toBeUndefined();
  });

  it("opens with a stop's first sentence", () => {
    expect(stopOpening('tour', 'abraham_zoom')).toBe('We can overlay the map with data.');
  });

  it('gives plain text where the stop is written in Markdown', () => {
    const opening = stopOpening('tour', 'abraham_call');
    expect(opening).toBeDefined();
    expect(opening).not.toMatch(/[*_[\]]/);
  });

  it('knows nothing of a stop the story lacks', () => {
    expect(stopOpening('tour', 'missing')).toBeUndefined();
    expect(stopOpening('missing', 'intro')).toBeUndefined();
  });
});
