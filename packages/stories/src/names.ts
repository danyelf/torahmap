// A stop's opening words, for a link's description and a folded story's label.

import type { StoryStop } from './types.ts';

/** The first sentence of a stop's text, as plain text; undefined when it has no text. */
export function firstSentence(stop: Pick<StoryStop, 'text'>): string | undefined {
  const text = plainText(stop.text);
  // A closing quote or bracket can sit between the terminal punctuation and
  // the word break: Abraham.”
  return text.match(/^.*?[.!?]["'”’)\]]*(?=\s|$)/s)?.[0] ?? (text || undefined);
}

/** Markdown emphasis, links and tags reduced to their words, on one line. */
function plainText(markdown: string): string {
  return markdown
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}
