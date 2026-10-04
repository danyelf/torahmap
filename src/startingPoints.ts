// What the overlay panel offers while None is chosen: search, every overlay
// and every story, each in its own words.
import { CONTROL } from './panel.ts';
import { escapeHtml } from './utils/html.ts';

export type StartChoice =
  { kind: 'search' } | { kind: 'overlay'; id: string } | { kind: 'story'; id: string };

export interface StartOverlay {
  id: string;
  name: string;
  tagline?: string;
}

/** A story as @torahmap/stories lists it; only what the button shows. */
export interface StartStory {
  id: string;
  data: { title: string; description: string };
}

const heading = (text: string): string => `<h3 class="start-heading">${text}</h3>`;

const row = (kind: StartChoice['kind'], id: string, label: string, detail = ''): string =>
  `<button type="button" class="${CONTROL.button} start-row" data-start="${kind}" data-id="${escapeHtml(id)}">
    <span class="start-label">${escapeHtml(label)}</span>
    <span class="start-detail">${escapeHtml(detail)}</span>
  </button>`;

export function startingPointsHtml(
  search: StartOverlay,
  overlays: readonly StartOverlay[],
  stories: readonly StartStory[],
): string {
  return [
    row('search', '', `${search.name}…`, search.tagline),
    heading('Overlays'),
    ...overlays.map((o) => row('overlay', o.id, o.name, o.tagline)),
    heading('Stories'),
    ...stories.map((s) => row('story', s.id, s.data.title, s.data.description)),
  ].join('');
}

/** The choice a click inside the panel made; null if none. */
export function startChosen(target: Element): StartChoice | null {
  const button = target.closest<HTMLElement>('[data-start]');
  const kind = button?.dataset.start;
  const id = button?.dataset.id ?? '';
  if (kind === 'search') return { kind };
  if (kind === 'overlay' || kind === 'story') return { kind, id };
  return null;
}
