// What one article cites, and what cites it.

import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { hex } from '../baseColor.ts';
import { REFS_FILE, type ActRef } from '../data.ts';
import { ownerOf } from '../ids.ts';
import type { ActItem } from '../layout.ts';

// For the map's dark ground: the article bright, what it does not touch dim.
export const QUIET = hex('#3a3f46');
export const FOCUS = hex('#f5f7fa');
export const CITES = hex('#1b9e77');
export const CITED_BY = hex('#c2257a');

export interface ReferenceSettings {
  readonly article: string;
}
export interface ReferenceData {
  refs: readonly ActRef[];
}

export const REFERENCE_PARAMS = [
  { key: 'article', kind: 'text', default: '6' },
] as const satisfies readonly UrlParamSpec[];

/** Whether `unit` is `target` or inside it: "5(1)(h)" is inside "5(1)" and "5". */
const inside = (unit: string, target: string): boolean =>
  unit === target || unit.startsWith(`${target}(`);

export const referencesOverlay: Overlay<ActItem, ReferenceSettings, ReferenceData> = {
  id: 'references',
  name: 'What points here',
  description:
    'Pick an article: it shows white, what it cites in green, and what cites it in magenta.',
  data: { refs: REFS_FILE },
  urlParams: REFERENCE_PARAMS,
  settingsFromUrl: (params) => ({ article: params.article ?? '6' }),
  settingsToUrl: ({ article }): Record<string, string> => (article === '6' ? {} : { article }),

  getItemColor: (item, settings, data) => colorOf([item], settings, data)[0],
  colorsFor: (items, settings, _hovered, data) => colorOf(items, settings, data),

  renderControls(container, settings, onChange) {
    let box = container.querySelector<HTMLInputElement>('input');
    if (!box) {
      container.innerHTML = `<label>Article <input class="${CONTROL.input}" type="text" size="6"></label>`;
      box = container.querySelector('input')!;
      box.addEventListener('input', () => onChange(() => ({ article: box!.value.trim() })));
    }
    if (box.value !== settings.article) box.value = settings.article;
  },
};

function colorOf(items: ActItem[], { article }: ReferenceSettings, { refs }: ReferenceData) {
  const mine = (unit: string) => ownerOf(unit) === article;
  const cites = new Set(refs.filter(([f, t]) => mine(f) && !mine(t)).map(([, t]) => t));
  const citedBy = new Set(refs.filter(([f, t]) => mine(t) && !mine(f)).map(([f]) => f));
  return items.map((item) => {
    if (item.layer === 'recital') return QUIET;
    if (item.layer === 'annex') return cites.has(ownerOf(item.id)) ? CITES : QUIET;
    if (mine(item.id)) return FOCUS;
    if ([...cites].some((t) => inside(item.id, t))) return CITES;
    // A citing unit marks itself, and a list's lead-in marks the list when its points cite.
    if ([...citedBy].some((f) => inside(item.id, f) || (item.lead && inside(f, item.id)))) {
      return CITED_BY;
    }
    return QUIET;
  });
}
