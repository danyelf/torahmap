import { describe, it, expect } from 'vitest';
import { renderStoryPanel, stopLabel } from '../storyPanel';
import type { StoryStop } from '../types';

function stop(fields: Partial<StoryStop>): StoryStop {
  return { id: 'a', text: '', camera: 'initial', overlay: null, ...fields };
}

describe('stopLabel', () => {
  it('is the title when the stop has one', () => {
    expect(stopLabel(stop({ title: 'The Rename', text: 'Five chapters later.' }))).toBe(
      'The Rename',
    );
  });

  it('is the first sentence, without markup, when the stop has no title', () => {
    const text =
      'Five chapters later, God renames him: *no longer Abram, but **Abraham**.*\n\nAdd the new name.';
    expect(stopLabel(stop({ text }))).toBe(
      'Five chapters later, God renames him: no longer Abram, but Abraham.',
    );
  });

  it('is the whole text when it has no sentence end', () => {
    expect(stopLabel(stop({ text: 'Search for [Abram](https://example.org)' }))).toBe(
      'Search for Abram',
    );
  });
});

describe('renderStoryPanel', () => {
  it('draws no heading for an untitled stop', () => {
    const container = document.createElement('div');
    const [el] = renderStoryPanel(container, [stop({ text: 'Pull back.' })]);
    expect(el.querySelector('h2')).toBeNull();
  });
});
