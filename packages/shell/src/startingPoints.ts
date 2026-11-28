// What the overlay panel offers while None is chosen: search, every overlay
// and every story, each in its own words.
import { escapeHtml } from '@torahmap/utils';
import { firstSentence, type Story, type StoryData } from '@torahmap/stories';
import type { Overlay } from './overlays/types.ts';
import { CONTROL } from './panel.ts';

export type StartChoice =
  { kind: 'search' } | { kind: 'overlay'; id: string } | { kind: 'story'; id: string };

export type StartOverlay = Pick<Overlay<unknown>, 'id' | 'name' | 'description'>;

const summary = (tool: StartOverlay): string | undefined =>
  firstSentence({ text: tool.description ?? '' });
export type StartStory = Pick<Story, 'id'> & { data: Pick<StoryData, 'title' | 'description'> };

const heading = (text: string): string => `<h3 class="panel-section-heading">${text}</h3>`;

function row(choice: StartChoice, label: string, detail = ''): string {
  const id = 'id' in choice ? ` data-id="${escapeHtml(choice.id)}"` : '';
  return `<button type="button" class="${CONTROL.button} start-row" data-start="${choice.kind}"${id}>
    <span class="start-label">${escapeHtml(label)}</span>
    <span class="start-detail">${escapeHtml(detail)}</span>
  </button>`;
}

// An open book, so a story reads as something to read, unlike the overlays and search, which are tools.
const BOOK =
  '<svg class="start-story-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M8 3.5C6.5 2.5 4 2 1.5 2.5v10C4 12 6.5 12.5 8 13.5c1.5-1 4-1.5 6.5-1v-10C12 2 9.5 2.5 8 3.5ZM8 3.5v10"/></svg>';

const storyRow = ({ id, data }: StartStory): string =>
  `<button type="button" class="start-story" data-start="story" data-id="${escapeHtml(id)}">
    ${BOOK}
    <span class="start-label">${escapeHtml(data.title)}</span>
    <span class="start-read">Read →</span>
    <span class="start-detail">${escapeHtml(data.description)}</span>
  </button>`;

export function startingPointsHtml(
  search: StartOverlay,
  overlays: readonly StartOverlay[],
  stories: readonly StartStory[],
): string {
  return [
    row({ kind: 'search' }, `${search.name}…`, summary(search)),
    heading('Overlays'),
    ...overlays.map((o) => row({ kind: 'overlay', id: o.id }, o.name, summary(o))),
    heading('Stories'),
    ...stories.map(storyRow),
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
