// A scene line for the script from the app's URL hash.

export function captureLine(name: string, hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const story = params.get('story');
  if (story) return `<!-- scene: ${name} | story: ${story} -->`;
  const view = [...params]
    .map(([key, value]) => `${key}=${value.replace(/[&=+%#|]/g, encodeURIComponent)}`)
    .join('&');
  return `<!-- scene: ${name} | view: ${view} -->`;
}
