import { describe, it, expect } from 'vitest';
import { renderStoryPanel, stopLabel } from '../storyPanel';
import type { StoryStop } from '@torahmap/stories';

function stop(fields: Partial<StoryStop> = {}): StoryStop {
  return { id: 's', text: 'Text.', camera: 'initial', overlay: null, ...fields };
}

describe('renderStoryPanel', () => {
  it('shows a heading for a titled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop({ title: 'Abraham' })]);
    expect(el.querySelector('h2')?.textContent).toBe('Abraham');
  });

  it('shows no heading for an untitled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop()]);
    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('.story-text')?.textContent).toBe('Text.');
  });
});

describe('stopLabel', () => {
  it('is the title when the stop has one', () => {
    expect(stopLabel(stop({ title: 'The Rename', text: 'Five chapters later.' }))).toBe(
      'The Rename',
    );
  });

  it('is the first sentence when the stop has no title', () => {
    expect(stopLabel(stop({ text: 'Five chapters later. God renames him.' }))).toBe(
      'Five chapters later.',
    );
  });
});
