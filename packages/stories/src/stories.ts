import { STORY_MARKDOWN } from './generated';
import { parseStoryMarkdown } from './parser';
import type { StoryData } from './types';

/** Every story, parsed. Drafts included; the page decides whether to list them. */
export const STORIES: readonly { id: string; data: StoryData }[] = Object.entries(
  STORY_MARKDOWN,
).map(([id, markdown]) => ({ id, data: parseStoryMarkdown(markdown) }));
