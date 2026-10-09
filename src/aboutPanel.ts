import './styles/about.css';
import { renderCreditsHtml, type Credit } from './credits.ts';
import { CONTROL, panelHtml } from './panel.ts';
import type { Site } from './app/text.ts';
import { escapeHtml } from './utils/html.ts';

// GitHub's Octicons (MIT): mark-github and mail.
const icon = (path: string): string =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"/></svg>`;
const GITHUB_ICON = icon(
  'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z',
);
const EMAIL_ICON = icon(
  'M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2ZM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.809L8.38 9.397a.75.75 0 0 1-.76 0L1.5 5.809v6.442Zm13-8.181v-.32a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25v.32L8 7.88Z',
);

/** About & settings: one scrolling panel, settings first because they are what a returning reader wants. */
export function aboutHtml(
  site: Site,
  overlays: readonly { name: string; credits?: readonly Credit[] }[],
): string {
  const square = escapeHtml(site.squareName);
  return panelHtml(
    'about',
    `<section class="about-section">
      <h3 class="panel-section-heading">Settings</h3>
      <button type="button" id="hebrew-toggle" class="${CONTROL.toggle}"></button>
    </section>
    <section class="about-section">
      <h3 class="panel-section-heading">${escapeHtml(site.name)}</h3>
      ${site.aboutHtml}
      <p class="byline">
        By <a href="https://danyelfisher.info" target="_blank" rel="noopener noreferrer">Danyel Fisher</a>
        <a class="byline-icon" href="https://github.com/danyelf/torahmap" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">${GITHUB_ICON}</a>
        <a class="byline-icon" href="mailto:danyel@torahmap.org" aria-label="Email" title="Email">${EMAIL_ICON}</a>
      </p>
    </section>
    <section class="about-section">
      <h3 class="panel-section-heading">Controls</h3>
      <table class="controls-table">
        <tr><td>Scroll / Pinch</td><td>Zoom in/out</td></tr>
        <tr><td>Drag</td><td>Pan the map</td></tr>
        <tr><td>Hover</td><td>Preview ${square} details</td></tr>
        <tr><td>Click / Tap</td><td>Pin ${square} details; repeat to unpin</td></tr>
        <tr><td>&larr; &rarr; arrow keys</td><td>Navigate ${square}s</td></tr>
        <tr><td>Escape</td><td>Close the menu, unpin the ${square}, or close the panel or the story</td></tr>
        <tr><td>Legend</td><td>Shows colors for the map; tap a row to open its tool</td></tr>
        <tr><td>Grabber (phone)</td><td>Tap for full height and back; drag down to fold</td></tr>
      </table>
    </section>
    <section class="about-section">
      <h3 class="panel-section-heading">Sources and credits</h3>
      ${renderCreditsHtml(site.credits, overlays)}
    </section>`,
  );
}
