// What a blank map offers: search, each overlay at a starting setting that
// shows something, and the stories.
import { COMMENTARY, HAFTARAH, TROP, VERSE_LENGTH } from '@torahmap/overlay-catalog';
import { CONTROL, panelHtml } from './panel.ts';
import { escapeHtml } from './utils/html.ts';

export type StartChoice =
  | { kind: 'search' }
  | { kind: 'overlay'; id: string; params: Readonly<Record<string, string>> }
  | { kind: 'story'; id: string };

export interface StartStory {
  id: string;
  title: string;
  description: string;
}

interface OverlayStart {
  overlay: { id: string; name: string };
  detail: string;
  /** Link keys for the overlay's starting settings; empty for its defaults. */
  params: Readonly<Record<string, string>>;
}

const OVERLAY_STARTS: OverlayStart[] = [
  { overlay: HAFTARAH, detail: 'Highlight the weekly cycles', params: {} },
  { overlay: COMMENTARY, detail: 'Show the most-referenced verses', params: {} },
  // Trop with no mark draws nothing. Geresh is in about one verse in six, in
  // every book but Psalms and Proverbs, so it shows at the opening zoom where
  // sparser marks such as Segol look like no change.
  { overlay: TROP, detail: 'See where one chanting mark falls', params: { trop: 'geresh' } },
  { overlay: VERSE_LENGTH, detail: 'Compare how long the verses are', params: {} },
];

const DIVIDER = '<div class="start-divider" role="separator"></div>';

const row = (kind: StartChoice['kind'], id: string, label: string, detail: string): string =>
  `<div class="start-row">
    <button type="button" class="${CONTROL.button}" data-start="${kind}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>
    <p class="start-detail">${escapeHtml(detail)}</p>
  </div>`;

export function startHtml(stories: readonly StartStory[]): string {
  return panelHtml(
    'start',
    [
      row('search', '', 'Search…', 'Search for any word, Hebrew or English'),
      DIVIDER,
      ...OVERLAY_STARTS.map(({ overlay, detail }) =>
        row('overlay', overlay.id, overlay.name, detail),
      ),
      DIVIDER,
      ...stories.map((s) => row('story', s.id, s.title, s.description)),
    ].join(''),
  );
}

/** The choice a click inside the panel made; null if none. */
export function startChosen(target: Element): StartChoice | null {
  const button = target.closest<HTMLElement>('[data-start]');
  const id = button?.dataset.id ?? '';
  switch (button?.dataset.start) {
    case 'search':
      return { kind: 'search' };
    case 'story':
      return { kind: 'story', id };
    case 'overlay': {
      const start = OVERLAY_STARTS.find((s) => s.overlay.id === id);
      return start ? { kind: 'overlay', id, params: start.params } : null;
    }
    default:
      return null;
  }
}
