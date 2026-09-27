import type { StoryData } from './types';

/** A story and the file name, without `.md`, that the URL calls it by. */
export interface Story {
  id: string;
  data: StoryData;
}

const LIVE_HOSTS = ['torahmap.org', 'www.torahmap.org'];

/**
 * The stories to offer here, in menu order: by `order`, lowest first, then
 * those without one; ties by file name. Drafts are left out on the live site.
 */
export function listedStories(stories: Story[], hostname: string): Story[] {
  const live = LIVE_HOSTS.includes(hostname);
  const rank = (s: Story): number => s.data.order ?? Infinity;
  return stories
    .filter((s) => !live || !s.data.draft)
    .sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The story a link names, or the first listed when it names none or one not listed. */
export function storyToOpen(listed: Story[], id: string | null): Story {
  return listed.find((s) => s.id === id) ?? listed[0];
}
