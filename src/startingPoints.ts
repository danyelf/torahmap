// What the overlay panel offers while None is chosen: search, every overlay
// by its tagline, and the stories.
import { CONTROL } from './panel.ts';
import { escapeHtml } from './utils/html.ts';

export type StartChoice =
  { kind: 'search' } | { kind: 'overlay'; id: string } | { kind: 'story'; id: string };

export interface StartOverlay {
  id: string;
  name: string;
  tagline?: string;
}

export interface StartStory {
  id: string;
  title: string;
  description: string;
}

const heading = (text: string): string => `<h3 class="start-heading">${text}</h3>`;

const row = (kind: StartChoice['kind'], id: string, label: string, detail = ''): string =>
  `<button type="button" class="${CONTROL.button} start-row" data-start="${kind}" data-id="${escapeHtml(id)}">
    <span class="start-label">${escapeHtml(label)}</span>
    <span class="start-detail">${escapeHtml(detail)}</span>
  </button>`;

export function startingPointsHtml(
  overlays: readonly StartOverlay[],
  stories: readonly StartStory[],
): string {
  return [
    row('search', '', 'Search…', 'Search for any word, Hebrew or English'),
    heading('Overlays'),
    ...overlays.map((o) => row('overlay', o.id, o.name, o.tagline)),
    heading('Stories'),
    ...stories.map((s) => row('story', s.id, s.title, s.description)),
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
