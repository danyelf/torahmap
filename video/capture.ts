// Lines for a script, or for a story's Markdown, from the app's URL query.

import { LINK_KEYS } from '@torahmap/overlay-catalog';
import { writeStopComment } from '@torahmap/stories';

/**
 * A story.md stop showing what the URL shows, with an empty line for its text;
 * null for a URL that is the story itself. A pinned verse leaves the camera
 * out of the URL, so the stop centres the verse, as the app does.
 */
export function storyStopLine(name: string, query: string): string | null {
  const params = new URLSearchParams(query);
  if (params.has('story')) return null;
  const zoom = params.get('zoom') ?? '1';
  const x = params.get('x');
  const y = params.get('y');
  const verse = params.get(LINK_KEYS.square) ?? undefined;
  const placed = x !== null && y !== null;
  const rest = [...params].filter(
    ([key]) => !['overlay', LINK_KEYS.square, 'zoom', 'x', 'y'].includes(key),
  );
  const comment = writeStopComment(
    name,
    {
      camera: placed ? `${x},${y},${zoom}` : verse,
      zoom: placed ? undefined : verse && zoom,
      overlay: params.get('overlay') ?? undefined,
      pin: verse,
    },
    Object.fromEntries(rest),
  );
  return `${comment}\n\n`;
}

export function captureLine(name: string, query: string): string {
  const params = new URLSearchParams(query);
  const story = params.get('story');
  const stop = params.get('stop');
  if (story) return `<!-- scene: ${name} | story: ${stop ? `${story}/${stop}` : story} -->`;
  const view = [...params]
    .map(([key, value]) => `${key}=${value.replace(/[&=+%#|]/g, encodeURIComponent)}`)
    .join('&');
  return `<!-- scene: ${name} | view: ${view} -->`;
}
