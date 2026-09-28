import { parseStoryMarkdown } from '../scrollytelling/storyParser';
import type { Story } from '../scrollytelling/storyIndex';

// Every story is small, so all of them are built into the page.
const files = import.meta.glob<string>('./*.md', { query: '?raw', import: 'default', eager: true });

/** Each story's Markdown, by id: its file name without `.md`. */
export const STORY_MARKDOWN: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, markdown]) => [path.slice(2, -3), markdown]),
);

export const STORIES: Story[] = Object.entries(STORY_MARKDOWN).map(([id, markdown]) => ({
  id,
  data: parseStoryMarkdown(markdown),
}));
