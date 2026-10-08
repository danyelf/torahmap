// A text's page: index.html, filled from its site. The Vite config runs it.

import type { Site } from './text.ts';
import { escapeHtml } from '../utils/html.ts';

/** `html` with each %PLACEHOLDER% filled for `site`, its map run by the script at `entry`. */
export function fillPage(html: string, site: Site, entry: string): string {
  const { page } = site;
  const image = page.image
    ? [
        `<meta property="og:image" content="${escapeHtml(page.image.url)}" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        `<meta property="og:image:alt" content="${escapeHtml(page.image.alt)}" />`,
      ].join('\n    ')
    : '';
  const fills: Record<string, string> = {
    SITE_NAME: escapeHtml(site.name),
    TAGLINE: escapeHtml(page.tagline),
    URL: escapeHtml(page.url),
    PREVIEW_IMAGE: image,
    NO_SCRIPT: escapeHtml(page.noScript),
    NO_WEBGL: escapeHtml(page.noWebGl),
    TEXT_URL: escapeHtml(page.textUrl),
    ENTRY: escapeHtml(entry),
  };
  return html.replace(/%([A-Z_]+)%/g, (whole, name: string) => fills[name] ?? whole);
}
