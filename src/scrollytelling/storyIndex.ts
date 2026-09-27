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

export async function loadStoryIndex(): Promise<StoryIndexEntry[]> {
  const response = await fetch('/data/stories/index.json');
  return response.json();
}
