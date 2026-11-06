// How each line has changed over its file's whole history: how lately, or how often.

import type { UrlParamSpec, UrlParamValues } from '@torahmap/link';
import { legendRow } from '@torahmap/shell/overlays/swatchList.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import {
  colorToCss,
  hex,
  LINEAR,
  LOG,
  memoByValueAndKey,
  scale,
  type ColorStop,
  type Scale,
} from '@torahmap/utils';
import { STRUCTURE_DATA, type CodeStructure, type StructureData } from '../data.ts';
import type { CodeItem } from '../layout.ts';

type Measure = 'recent' | 'often';

export interface ChurnSettings {
  readonly measure: Measure;
}

const MEASURES: Readonly<Record<Measure, { label: string; ends: [low: string, high: string] }>> = {
  recent: { label: 'How recently', ends: ['old', 'new'] },
  often: { label: 'How often', ends: ['once', 'often'] },
};

const PARAMS = [
  { key: 'measure', kind: 'token', allowed: ['recent', 'often'], default: 'recent' },
] as const satisfies readonly UrlParamSpec[];

// Dark to bright, so the lines that changed most lately or most often stand out on the dark map.
const STOPS: ColorStop[] = [
  { t: 0, color: hex('#25304a') },
  { t: 0.5, color: hex('#2f8fa8') },
  { t: 1, color: hex('#f4e66b') },
];

const GRADIENT = `linear-gradient(to right, ${STOPS.map(({ t, color }) => `${colorToCss(color)} ${t * 100}%`).join(', ')})`;

const valuesOf = (structure: CodeStructure, measure: Measure) =>
  structure.files.map((f) => (measure === 'recent' ? f.lastChanged : f.timesChanged));

const scaleOf = memoByValueAndKey((structure: CodeStructure, measure: Measure): Scale => {
  let low = Infinity;
  let high = -Infinity;
  for (const values of valuesOf(structure, measure)) {
    for (const v of values) {
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  // On a linear count, a few lines changed hundreds of times would crowd the rest into the dark end.
  return scale(low, high, measure === 'recent' ? LINEAR : LOG, STOPS);
});

export const churnOverlay: Overlay<CodeItem, ChurnSettings, StructureData> = {
  id: 'churn',
  name: 'Churn',
  description:
    'Shows how each line has changed over its file’s whole history: brightest the newest, or the most often changed.',
  data: STRUCTURE_DATA,
  urlParams: PARAMS,
  settingsFromUrl: ({ measure }: UrlParamValues<typeof PARAMS>) => ({ measure }),
  settingsToUrl: ({ measure }): Record<string, string> => ({ measure }),

  colorsFor({ items, settings: { measure }, data: { structure } }) {
    const values = valuesOf(structure, measure);
    const s = scaleOf(structure, measure);
    return items.map((item) =>
      item.deletedFile ? null : s.colorOf(values[item.file][item.line - 1]),
    );
  },

  renderControls(container, { measure }, onChange) {
    if (!container.querySelector('[data-measure]')) {
      container.innerHTML =
        `<div class="${CONTROL.segments}" role="group" aria-label="Measure">` +
        (Object.keys(MEASURES) as Measure[])
          .map(
            (m) =>
              `<button type="button" class="${CONTROL.segment}" data-measure="${m}">${MEASURES[m].label}</button>`,
          )
          .join('') +
        `</div>`;
      for (const button of container.querySelectorAll<HTMLButtonElement>('[data-measure]')) {
        const m = button.dataset.measure as Measure;
        button.addEventListener('click', () => onChange(() => ({ measure: m })));
      }
    }
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-measure]')) {
      const on = button.dataset.measure === measure;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    }
  },

  renderLegend(container, { measure }) {
    const [low, high] = MEASURES[measure].ends;
    const strip = document.createElement('span');
    strip.style.cssText = `flex:1;height:10px;border-radius:2px;background:${GRADIENT}`;
    container.replaceChildren(legendRow(low, strip, high));
  },

  summary: ({ measure }) => ({ strip: { gradient: GRADIENT, ends: MEASURES[measure].ends } }),
};
