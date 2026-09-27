import { describe, it, expect } from 'vitest';
import { listedStories, storyToOpen, type Story } from '../../scrollytelling/storyIndex';

const story = (id: string, over: Partial<Story['data']> = {}): Story => ({
  id,
  data: { stops: [], title: id, description: '', draft: false, ...over },
});
const ids = (stories: Story[]): string[] => stories.map((s) => s.id);

describe('listedStories', () => {
  it('puts every story with an order before every story without one', () => {
    const stories = [story('a'), story('z', { order: 99 })];
    expect(ids(listedStories(stories, 'localhost'))).toEqual(['z', 'a']);
  });

  it('puts a lower order before a higher one', () => {
    const stories = [story('a', { order: 2 }), story('b', { order: -1 }), story('c', { order: 1 })];
    expect(ids(listedStories(stories, 'localhost'))).toEqual(['b', 'c', 'a']);
  });

  it('orders ties, and stories without an order, by file name', () => {
    const stories = [
      story('job'),
      story('haftarah'),
      story('tour', { order: 1 }),
      story('shalshelet', { order: 1 }),
    ];
    expect(ids(listedStories(stories, 'localhost'))).toEqual([
      'shalshelet',
      'tour',
      'haftarah',
      'job',
    ]);
  });

  it('hides drafts on the live site', () => {
    const stories = [story('tour'), story('sample', { draft: true })];
    for (const host of ['torahmap.org', 'www.torahmap.org']) {
      expect(ids(listedStories(stories, host))).toEqual(['tour']);
    }
  });

  it('lists drafts everywhere else', () => {
    const stories = [story('tour'), story('sample', { draft: true })];
    for (const host of ['localhost', 'torahmap-pr-12.danyelf.workers.dev', '']) {
      expect(ids(listedStories(stories, host))).toEqual(['sample', 'tour']);
    }
  });
});

describe('storyToOpen', () => {
  const listed = [story('tour'), story('job')];
  it('opens the story a link names', () => expect(storyToOpen(listed, 'job').id).toBe('job'));
  it('opens the first story when a link names none', () =>
    expect(storyToOpen(listed, null).id).toBe('tour'));
  it('opens the first story when a link names one not listed', () =>
    expect(storyToOpen(listed, 'abraham_call').id).toBe('tour'));
});
