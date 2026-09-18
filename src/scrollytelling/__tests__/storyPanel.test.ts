import { describe, it, expect } from 'vitest';
import { renderStoryPanel, stopLabel } from '../storyPanel';
import type { StoryStop } from '../types';

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

  it('is the first sentence, without markup, when the stop has no title', () => {
    const text =
      'Five chapters later, God renames him: *no longer Abram, but **Abraham**.*\n\nAdd the new name.';
    expect(stopLabel(stop({ text }))).toBe(
      'Five chapters later, God renames him: no longer Abram, but Abraham.',
    );
  });

  it('ends a sentence inside a closing quote', () => {
    const text = 'God gives Abram a new name: “your name shall be Abraham.” We can add it.';
    expect(stopLabel(stop({ text }))).toBe(
      'God gives Abram a new name: “your name shall be Abraham.”',
    );
  });

  it('is the whole text when it has no sentence end', () => {
    expect(stopLabel(stop({ text: 'Search for [Abram](https://example.org)' }))).toBe(
      'Search for Abram',
    );
  });

  it('cuts a long label at the last whole word within the limit', () => {
    const text =
      'In Genesis, he is everywhere: even after his burial in chapter 25, his name is present.';
    const label = stopLabel(stop({ text }), 50);
    expect(label).toBe('In Genesis, he is everywhere: even after his…');
    expect(label.length).toBeLessThanOrEqual(51);
  });

  it('leaves a label within the limit whole', () => {
    expect(stopLabel(stop({ text: 'And then he almost disappears.' }), 50)).toBe(
      'And then he almost disappears.',
    );
  });
});
