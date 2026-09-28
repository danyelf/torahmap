import type { Story } from '@torahmap/stories';

export type { Story };

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

/** The story a link names, or the first listed when it names none or one not listed. */
export function storyToOpen(listed: Story[], id: string | null): Story {
  return listed.find((s) => s.id === id) ?? listed[0];
}
