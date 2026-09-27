import { parseStoryMarkdown } from '../scrollytelling/storyParser';
import type { Story } from '../scrollytelling/storyIndex';

// Every story is small, so all of them are built into the page.
const files = import.meta.glob<string>('./*.md', { query: '?raw', import: 'default', eager: true });

export const STORIES: Story[] = Object.entries(files).map(([path, markdown]) => ({
  id: path.slice(2, -3),
  data: parseStoryMarkdown(markdown),
}));
