// What the overlay panel offers while None is chosen: search, every overlay
// and every story, each in its own words.
import type { Story, StoryData } from '@torahmap/stories';
import type { Overlay } from './overlays/types.ts';
import { CONTROL } from './panel.ts';
import { escapeHtml } from './utils/html.ts';

export type StartChoice =
  { kind: 'search' } | { kind: 'overlay'; id: string } | { kind: 'story'; id: string };

export type StartOverlay = Pick<Overlay, 'id' | 'name' | 'tagline'>;
export type StartStory = Pick<Story, 'id'> & { data: Pick<StoryData, 'title' | 'description'> };

const heading = (text: string): string => `<h3 class="panel-section-heading">${text}</h3>`;

function row(choice: StartChoice, label: string, detail = ''): string {
  const id = 'id' in choice ? ` data-id="${escapeHtml(choice.id)}"` : '';
  return `<button type="button" class="${CONTROL.button} start-row" data-start="${choice.kind}"${id}>
    <span class="start-label">${escapeHtml(label)}</span>
    <span class="start-detail">${escapeHtml(detail)}</span>
  </button>`;
}

export function startingPointsHtml(
  search: StartOverlay,
  overlays: readonly StartOverlay[],
  stories: readonly StartStory[],
): string {
  return [
    row({ kind: 'search' }, `${search.name}…`, search.tagline),
    heading('Overlays'),
    ...overlays.map((o) => row({ kind: 'overlay', id: o.id }, o.name, o.tagline)),
    heading('Stories'),
    ...stories.map((s) => row({ kind: 'story', id: s.id }, s.data.title, s.data.description)),
  ].join('');
}

/** The choice a click inside the panel made; null if none. */
export function startChosen(target: Element): StartChoice | null {
  const button = target.closest<HTMLElement>('[data-start]');
  const kind = button?.dataset.start;
  const id = button?.dataset.id;
  if (kind === 'search') return { kind };
  if ((kind === 'overlay' || kind === 'story') && id) return { kind, id };
  return null;
}
