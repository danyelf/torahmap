import { escapeHtml } from './utils/html.ts';
import type { StoryPlace } from './menu.ts';

/** The stories on offer. There is one, the guided tour, and it keeps its place. */
export function storiesHtml(place: StoryPlace & { label: string }): string {
  return `
    <h2 class="panel-title">Stories</h2>
    <div class="story-card">
      <h3>The guided tour</h3>
      <p class="story-card-place">Stop ${place.number} of ${place.total}: ${escapeHtml(place.label)}</p>
      <div class="story-card-actions">
        <button type="button" class="story-card-action" data-action="story">Continue</button>
        <button type="button" class="story-card-action secondary" data-action="restart">Start from the beginning</button>
      </div>
    </div>`;
}
