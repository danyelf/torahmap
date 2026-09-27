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

  it('reads the order as a number and a draft as true', () => {
    const story = parseStoryMarkdown('---\norder: 2.5\ndraft: true\n---\n');
    expect(story.order).toBe(2.5);
    expect(story.draft).toBe(true);
  });

  it('gives no order for a value that is not a number, and is not a draft unless it says so', () => {
    const story = parseStoryMarkdown('---\norder: first\ndraft: no\n---\n');
    expect(story.order).toBeUndefined();
    expect(story.draft).toBe(false);
  });

  it('leaves them out when the story has no frontmatter', () => {
    const story = parseStoryMarkdown('<!-- stop: a | camera: Job -->\nText.');
    expect(story.title).toBeUndefined();
    expect(story.description).toBeUndefined();
  });
});
