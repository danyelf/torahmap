// A story's and a stop's names, for a tab title and a chat preview.

import { STORIES } from './stories';

export function storyTitle(id: string): string | undefined {
  return STORIES.find((s) => s.id === id)?.data.title || undefined;
}

/** The first sentence of a stop's text, as plain text. */
export function stopOpening(storyId: string, stopId: string): string | undefined {
  const stop = STORIES.find((s) => s.id === storyId)?.data.stops.find((s) => s.id === stopId);
  if (!stop) return undefined;
  const text = plainText(stop.text);
  return text.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? (text || undefined);
}

/** Markdown emphasis and links reduced to their words, on one line. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}
