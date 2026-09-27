import { describe, it, expect } from 'vitest';
import { parseStoryMarkdown } from '../../scrollytelling/storyParser';

describe('story frontmatter', () => {
  const md = [
    '---',
    'title: Prose and Poetry: Job',
    'description: The prose frame and the poem look different.',
    'easing: linear',
    '---',
    '',
    '<!-- stop: a | camera: Job -->',
    'Text.',
  ].join('\n');

  it('reads the title and description, colons and all', () => {
    const story = parseStoryMarkdown(md);
    expect(story.title).toBe('Prose and Poetry: Job');
    expect(story.description).toBe('The prose frame and the poem look different.');
    expect(story.defaults?.easing).toBe('linear');
  });

  it('leaves them out when the story has no frontmatter', () => {
    const story = parseStoryMarkdown('<!-- stop: a | camera: Job -->\nText.');
    expect(story.title).toBeUndefined();
    expect(story.description).toBeUndefined();
  });
});
