import { describe, it, expect } from 'vitest';
import { listedStories, storyToOpen, type Story } from '@torahmap/stories';

const story = (id: string, over: Partial<Story['data']> = {}): Story => ({
  id,
  data: { stops: [], title: id, description: '', draft: false, ...over },
});
const ids = (stories: Story[]): string[] => stories.map((s) => s.id);

describe('listedStories', () => {
  it('puts every story with an order before every story without one', () => {
    const stories = [story('a'), story('z', { order: 99 })];
    expect(ids(listedStories(stories, true))).toEqual(['z', 'a']);
  });

  it('puts a lower order before a higher one', () => {
    const stories = [story('a', { order: 2 }), story('b', { order: -1 }), story('c', { order: 1 })];
    expect(ids(listedStories(stories, true))).toEqual(['b', 'c', 'a']);
  });

  it('orders ties, and stories without an order, by file name', () => {
    const stories = [
      story('job'),
      story('haftarah'),
      story('tour', { order: 1 }),
      story('shalshelet', { order: 1 }),
    ];
    expect(ids(listedStories(stories, true))).toEqual(['shalshelet', 'tour', 'haftarah', 'job']);
  });

  it('leaves drafts out unless asked for them', () => {
    const stories = [story('tour'), story('sample', { draft: true })];
    expect(ids(listedStories(stories, false))).toEqual(['tour']);
    expect(ids(listedStories(stories, true))).toEqual(['sample', 'tour']);
  });
});

describe('storyToOpen', () => {
  const listed = [story('tour'), story('job')];
  it('opens the story a link names', () => expect(storyToOpen(listed, 'job')?.id).toBe('job'));
  it('opens the first story when a link names none', () =>
    expect(storyToOpen(listed, null)?.id).toBe('tour'));
  it('opens the first story when a link names one not listed', () =>
    expect(storyToOpen(listed, 'abraham_call')?.id).toBe('tour'));
});
