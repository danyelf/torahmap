// Lights the papers by what they cite: the people their references name, or the works. A
// toggle chooses the list; each list keeps its own picks.

import type { UrlParamSpec } from '@torahmap/link';
import { CONTROL } from '@torahmap/shell/panel.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { CitedData } from '../citations.ts';
import type { PieceItem } from '../layout.ts';
import { citedPeopleOverlay } from './citedPeople.ts';
import { citedWorksOverlay } from './citedWorks.ts';
import type { ListSettings } from './listPicks.ts';

const VIEWS = {
  people: { label: 'People', overlay: citedPeopleOverlay },
  works: { label: 'Works', overlay: citedWorksOverlay },
} as const;
type View = keyof typeof VIEWS;
const VIEW_NAMES = Object.keys(VIEWS) as View[];

export interface CitationSettings {
  view: View;
  /** The picks of each list. */
  lists: Record<View, ListSettings>;
}

const URL_PARAMS = [
  { key: 'cite', kind: 'token', allowed: VIEW_NAMES, default: VIEW_NAMES[0] },
  ...VIEW_NAMES.flatMap((view) => VIEWS[view].overlay.urlParams!),
] as const satisfies readonly UrlParamSpec[];

const shown = ({ view, lists }: CitationSettings) => ({
  overlay: VIEWS[view].overlay,
  settings: lists[view],
});

export const citationsOverlay: Overlay<PieceItem, CitationSettings, CitedData> = {
  id: 'citations',
  name: 'Citations',
  description:
    'Lights every paper by what its references cite, each pick in a color of its own; the rest of the map dims. Choose people or works. Names as written in references can stand for more than one person.',
  data: citedPeopleOverlay.data,

  urlParams: URL_PARAMS,
  settingsFromUrl(params, taken) {
    const lists = Object.fromEntries(
      VIEW_NAMES.map((view) => [view, VIEWS[view].overlay.settingsFromUrl!(params, taken)]),
    ) as CitationSettings['lists'];
    return { view: (params.cite as View | undefined) ?? VIEW_NAMES[0], lists };
  },
  settingsToUrl: (settings) => ({
    cite: settings.view,
    ...Object.assign(
      {},
      ...VIEW_NAMES.map((v) => VIEWS[v].overlay.settingsToUrl!(settings.lists[v])),
    ),
  }),
  colorsInUse(settings) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.colorsInUse!(picks);
  },

  colorsFor(items, settings, hovered, data, pinned) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.colorsFor(items, picks, hovered, data, pinned);
  },
  standoutsFor(items, settings, data, hovered, pinned) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.standoutsFor!(items, picks, data, hovered, pinned);
  },

  renderControls(container, settings, onChange, data) {
    if (!container.querySelector('.control-segments')) {
      const toggle = document.createElement('div');
      toggle.className = CONTROL.segments;
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', 'What to pick');
      for (const view of VIEW_NAMES) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = CONTROL.segment;
        button.dataset.view = view;
        button.textContent = VIEWS[view].label;
        button.addEventListener('click', () => onChange((current) => ({ ...current, view })));
        toggle.append(button);
      }
      container.replaceChildren(
        toggle,
        ...VIEW_NAMES.map((view) =>
          Object.assign(document.createElement('div'), { id: '', className: `citations-${view}` }),
        ),
      );
    }
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      const on = button.dataset.view === settings.view;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    for (const view of VIEW_NAMES) {
      const finder = container.querySelector<HTMLElement>(`.citations-${view}`)!;
      finder.hidden = view !== settings.view;
      if (finder.hidden) continue;
      VIEWS[view].overlay.renderControls!(
        finder,
        settings.lists[view],
        (update) =>
          onChange((current, taken) => ({
            ...current,
            lists: { ...current.lists, [view]: update(current.lists[view], taken) },
          })),
        data,
      );
    }
  },

  renderLegend(container, settings, data) {
    const { overlay, settings: picks } = shown(settings);
    overlay.renderLegend!(container, picks, data);
  },

  summary(settings, data) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.summary!(picks, data);
  },
  getHoverInfo(item, settings, data) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.getHoverInfo!(item, picks, data);
  },
  textMatches(item, text, language, settings, data) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.textMatches!(item, text, language, picks, data);
  },
  highlightItemText(item, text, language, settings, data, within) {
    const { overlay, settings: picks } = shown(settings);
    return overlay.highlightItemText!(item, text, language, picks, data, within);
  },
};
