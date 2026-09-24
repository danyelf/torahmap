import './styles/about.css';
import { renderCreditsHtml, type Credit } from './credits.ts';

/** About & settings: one scrolling panel, settings first because they are what a returning reader wants. */
export function aboutHtml(
  overlays: readonly { name: string; credits?: readonly Credit[] }[],
): string {
  return `
    <h2 class="panel-title">About &amp; settings</h2>
    <section class="about-section">
      <h3>Settings</h3>
      <button type="button" id="hebrew-toggle" class="setting-toggle"></button>
    </section>
    <section class="about-section">
      <h3>Torahmap</h3>
      <p>An interactive visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position.</p>
      <p>The map is divided into three sections, stacked vertically:</p>
      <ul>
        <li><strong>Torah</strong> — The Five Books of Moses</li>
        <li><strong>Nevi'im</strong> — The Prophets</li>
        <li><strong>Ketuvim</strong> — The Writings</li>
      </ul>
      <p>Switch between different analytical overlays to reveal patterns across 23,000+ verses.</p>
      <p class="byline">
        By <a href="https://danyelfisher.info" target="_blank" rel="noopener noreferrer">Danyel Fisher</a> ·
        <a href="https://github.com/danyelf/torahmap" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    </section>
    <section class="about-section">
      <h3>Controls</h3>
      <table class="controls-table">
        <tr><td>Scroll / Pinch</td><td>Zoom in/out</td></tr>
        <tr><td>Drag</td><td>Pan around</td></tr>
        <tr><td>Hover</td><td>Preview verse details</td></tr>
        <tr><td>Click / Tap</td><td>Pin verse details</td></tr>
        <tr><td>Click pinned / Tap again</td><td>Unpin verse</td></tr>
        <tr><td>&larr; &rarr; arrow keys</td><td>Navigate verses</td></tr>
        <tr><td>Escape</td><td>Unpin verse, or close the menu</td></tr>
        <tr><td>☰</td><td>The menu: continue the story, overlays, stories, About &amp; settings</td></tr>
        <tr><td>Rail (desktop)</td><td>Open a tool's panel; anything on but not open folds to a line at the bottom of the panel</td></tr>
        <tr><td>Folded line</td><td>Tap to open it</td></tr>
        <tr><td>Grabber (phone)</td><td>Tap for full height and back; drag down to fold</td></tr>
      </table>
    </section>
    <section class="about-section">
      <h3>Sources and credits</h3>
      ${renderCreditsHtml(overlays)}
    </section>`;
}
