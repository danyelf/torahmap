import { describe, it, expect } from 'vitest';
import { listedStories, storyToOpen } from '../../scrollytelling/storyIndex';

const index = [{ id: 'tour' }, { id: 'sample', draft: true }, { id: 'job' }];

describe('listedStories', () => {
  it('hides drafts on the live site', () => {
    for (const host of ['torahmap.org', 'www.torahmap.org']) {
      expect(listedStories(index, host).map((s) => s.id)).toEqual(['tour', 'job']);
    }
  });

  it('lists drafts everywhere else, in index order', () => {
    for (const host of ['localhost', 'torahmap-pr-12.danyelf.workers.dev', '']) {
      expect(listedStories(index, host).map((s) => s.id)).toEqual(['tour', 'sample', 'job']);
    }
  });
});

describe('storyToOpen', () => {
  const listed = [{ id: 'tour' }, { id: 'job' }];
  it('opens the story a link names', () => expect(storyToOpen(listed, 'job')).toBe('job'));
  it('opens the first story when a link names none', () =>
    expect(storyToOpen(listed, null)).toBe('tour'));
  it('opens the first story when a link names one not listed', () =>
    expect(storyToOpen(listed, 'abraham_call')).toBe('tour'));
});
