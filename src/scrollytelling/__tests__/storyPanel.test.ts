import { describe, it, expect } from 'vitest';
import { renderStoryPanel } from '../storyPanel';
import type { StoryStop } from '../types';

const stop = (title?: string): StoryStop => ({
  id: 's',
  title,
  text: 'Text.',
  camera: 'initial',
  overlay: null,
});

describe('renderStoryPanel', () => {
  it('shows a heading for a titled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop('Abraham')]);
    expect(el.querySelector('h2')?.textContent).toBe('Abraham');
  });

  it('shows no heading for an untitled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop()]);
    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('.story-text')?.textContent).toBe('Text.');
  });
});
