import { PANEL_TITLES } from './frame.ts';
import { escapeHtml } from './utils/html.ts';
import type { StoryPlace } from './menu.ts';

export interface StoryCard {
  id: string;
  title: string;
  description: string;
  draft: boolean;
  /** Where the reader left it this visit; null if they have not opened it. */
  place: (StoryPlace & { label: string }) | null;
}

const OPEN_STORY = 'open-story';
type From = 'place' | 'start';

const button = (from: From, label: string, secondary = false): string =>
  `<button type="button" class="story-card-action${secondary ? ' secondary' : ''}" ` +
  `data-action="${OPEN_STORY}" data-from="${from}">${label}</button>`;

/** The story a click inside the panel chose, and whether from its start; null if none. */
export function storyChosen(target: Element): { id: string; fromStart: boolean } | null {
  const button = target.closest<HTMLElement>(`[data-action="${OPEN_STORY}"]`);
  const id = button?.closest<HTMLElement>('[data-story]')?.dataset.story;
  if (!button || !id) return null;
  return { id, fromStart: (button.dataset.from as From) === 'start' };
}

function cardHtml({ id, title, description, draft, place }: StoryCard): string {
  const actions = place
    ? button('place', 'Continue') + button('start', 'Start from the beginning', true)
    : button('start', 'Read');
  return `
    <div class="story-card" data-story="${escapeHtml(id)}">
      <h3>${escapeHtml(title)}${draft ? ' <span class="story-draft">draft</span>' : ''}</h3>
      <p class="story-card-description">${escapeHtml(description)}</p>
      ${place ? `<p class="story-card-place">Stop ${place.number} of ${place.total}: ${escapeHtml(place.label)}</p>` : ''}
      <div class="story-card-actions">${actions}</div>
    </div>`;
}

/** The stories on offer, in the index's order. Each keeps its place for the visit. */
export function storiesHtml(cards: StoryCard[]): string {
  return `<h2 class="panel-title">${escapeHtml(PANEL_TITLES.stories)}</h2>${cards.map(cardHtml).join('')}`;
}
