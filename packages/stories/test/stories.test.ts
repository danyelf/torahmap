import { describe, it, expect } from 'vitest';
import { STORY_MARKDOWN, STORIES } from '@torahmap/stories';

// The folder as Vite lists it, without the generator. Not loaded, only listed.
const files = Object.keys(import.meta.glob('../markdown/*.md'));

describe('the stories', () => {
  it('include every Markdown file in the folder', () => {
    const ids = files.map((f) => f.slice('../markdown/'.length, -'.md'.length));
    expect(Object.keys(STORY_MARKDOWN).sort()).toEqual(ids.sort());
  });

  it('are each parsed once, by id', () => {
    expect(STORIES.map((s) => s.id).sort()).toEqual(Object.keys(STORY_MARKDOWN).sort());
    expect(STORIES.find((s) => s.id === 'tour')?.data.title).toBe('The Guided Tour');
  });

  // The URL names a stop by id, so a repeat makes a stop unreachable.
  it.each(STORIES.map((s) => [s.id, s.data.stops.map((stop) => stop.id)] as const))(
    '%s gives each stop its own id',
    (_, ids) => {
      expect(new Set(ids).size).toBe(ids.length);
    },
  );
});
