import type { StoryData } from './types';

/** A story as `public/data/stories/index.json` lists it, in menu order. */
export interface StoryIndexEntry {
  id: string;
  /** Listed while it is being written, except on the live site. */
  draft?: boolean;
}

const LIVE_HOSTS = ['torahmap.org', 'www.torahmap.org'];

export function listedStories(index: StoryIndexEntry[], hostname: string): StoryIndexEntry[] {
  const live = LIVE_HOSTS.includes(hostname);
  return index.filter((story) => !live || !story.draft);
}

/** The story a link names, or the first listed when it names none or one not listed. */
export function storyToOpen(listed: StoryIndexEntry[], id: string | null): string {
  return listed.find((story) => story.id === id)?.id ?? listed[0].id;
}

/** Each story loaded once. A failed load is not kept, so asking again retries it. */
export function storyCache(load: (id: string) => Promise<StoryData>): {
  get(id: string): Promise<StoryData>;
  forget(id: string): void;
} {
  const stories = new Map<string, Promise<StoryData>>();
  return {
    get(id) {
      let story = stories.get(id);
      if (!story) {
        story = load(id).catch((error: unknown) => {
          stories.delete(id);
          throw error;
        });
        stories.set(id, story);
      }
      return story;
    },
    forget(id) {
      stories.delete(id);
    },
  };
}

export async function loadStoryIndex(): Promise<StoryIndexEntry[]> {
  const response = await fetch('/data/stories/index.json');
  return response.json();
}
