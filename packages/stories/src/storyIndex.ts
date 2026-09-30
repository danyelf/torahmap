import type { Story } from './types.ts';

/**
 * The stories to offer, in menu order: by `order`, lowest first, then those
 * without one; ties by file name. Drafts only when `showDrafts`.
 */
export function listedStories(stories: readonly Story[], showDrafts: boolean): Story[] {
  const rank = (s: Story): number => s.data.order ?? Infinity;
  return stories
    .filter((s) => showDrafts || !s.data.draft)
    .sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The story a link names, or the first listed when it names none or one not
 * listed; undefined when none is listed.
 */
export function storyToOpen(listed: readonly Story[], id: string | null): Story | undefined {
  return listed.find((s) => s.id === id) ?? listed[0];
}

/** Where in `story` the stop a link names is, or 0 when it names none or one the story lacks. */
export function stopToOpen(story: Story, id: string | null | undefined): number {
  return Math.max(
    0,
    story.data.stops.findIndex((s) => s.id === id),
  );
}
