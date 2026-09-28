import { STORY_MARKDOWN } from './generated';
import { parseStoryMarkdown } from './parser';
import type { Story } from './types';

export type { CameraPosition, CameraRef, StoryStop, StoryData, EasingName, Story } from './types';
export { parseStoryMarkdown, STORY_HEADER_KEYS } from './parser';
export { STORY_MARKDOWN };

/** Every story, parsed. Drafts included; the page decides whether to list them. */
export const STORIES: readonly Story[] = Object.entries(STORY_MARKDOWN).map(([id, markdown]) => ({
  id,
  data: parseStoryMarkdown(markdown),
}));
