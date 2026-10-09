// The Tanakh's stories: the Markdown files in markdown/.

import { SEARCH_KEYS } from '@torahmap/overlay-catalog';
import { STORY_MARKDOWN } from './generated.ts';
import { parseStoryMarkdown } from './parser.ts';
import type { Story } from './types.ts';

export { STORY_MARKDOWN };

/** Every story, parsed. Drafts included; the page decides whether to list them. */
export const STORIES: readonly Story[] = Object.entries(STORY_MARKDOWN).map(([id, markdown]) => ({
  id,
  data: parseStoryMarkdown(markdown, SEARCH_KEYS),
}));
