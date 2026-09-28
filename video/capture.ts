// Lines for a script, or for public/data/story.md, from the app's URL hash.

/**
 * A story.md stop showing what the URL shows, with an empty line for its text;
 * null for a URL that is the story itself. A pinned verse leaves the camera
 * out of the URL, so the stop centres the verse, as the app does.
 */
export function storyStopLine(name: string, hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.has('story')) return null;
  const zoom = params.get('zoom') ?? '1';
  const x = params.get('x');
  const y = params.get('y');
  const verse = params.get('verse');

  const parts = [`stop: ${name}`];
  if (x !== null && y !== null) parts.push(`camera: ${x},${y},${zoom}`);
  else if (verse) parts.push(`camera: ${verse}`, `zoom: ${zoom}`);
  const overlay = params.get('overlay');
  if (overlay) parts.push(`overlay: ${overlay}`);
  if (verse) parts.push(`verse: ${verse}`);
  for (const [key, value] of params) {
    if (!['overlay', 'verse', 'zoom', 'x', 'y'].includes(key)) parts.push(`${key}: ${value}`);
  }
  return `<!-- ${parts.join(' | ')} -->\n\n`;
}

export function captureLine(name: string, hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const story = params.get('story');
  const stop = params.get('stop');
  if (story) return `<!-- scene: ${name} | story: ${stop ? `${story}/${stop}` : story} -->`;
  const view = [...params]
    .map(([key, value]) => `${key}=${value.replace(/[&=+%#|]/g, encodeURIComponent)}`)
    .join('&');
  return `<!-- scene: ${name} | view: ${view} -->`;
}
