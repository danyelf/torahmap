// A text's page: index.html, filled from its copy.

import { escapeHtml } from '../utils/html.ts';

/** What a text's page says before the map runs, and to link previews; plain text throughout. */
export interface PageCopy {
  name: string;
  tagline: string;
  /** The page's address once deployed. */
  url: string;
  /** The link preview's picture. */
  image?: { url: string; alt: string };
  /** What the map is, to a browser that runs no script. */
  noScript: string;
  /** What the map is, ahead of why this browser cannot draw it. */
  noWebGl: string;
  /** Where the text can be read meanwhile. */
  textUrl: string;
}

/** `html` with each %PLACEHOLDER% filled from `copy`, its map run by the script at `entry`. */
export function fillPage(html: string, copy: PageCopy, entry: string): string {
  const preview = copy.image
    ? [
        `<meta property="og:image" content="${escapeHtml(copy.image.url)}" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        `<meta property="og:image:alt" content="${escapeHtml(copy.image.alt)}" />`,
        '<meta name="twitter:card" content="summary_large_image" />',
      ]
    : ['<meta name="twitter:card" content="summary" />'];
  const fills: Record<string, string> = {
    SITE_NAME: escapeHtml(copy.name),
    TAGLINE: escapeHtml(copy.tagline),
    URL: escapeHtml(copy.url),
    PREVIEW: preview.join(''),
    NO_SCRIPT: escapeHtml(copy.noScript),
    NO_WEBGL: escapeHtml(copy.noWebGl),
    TEXT_URL: escapeHtml(copy.textUrl),
    ENTRY: escapeHtml(entry),
  };
  return html.replace(/%([A-Z_]+)%/g, (whole, name: string) => fills[name] ?? whole);
}
