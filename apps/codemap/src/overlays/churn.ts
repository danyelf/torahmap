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
/** What "how recently" is counted in: days, commits, or steps of the mainline. */
type By = 'day' | 'commit' | 'pr';

export interface ChurnSettings {
  readonly measure: Measure;
  readonly by: By;
}

const MEASURES: Readonly<Record<Measure, string>> = {
  recent: 'How recently',
  often: 'How often',
};

const BY: Readonly<Record<By, string>> = { day: 'By day', commit: 'By commit', pr: 'By PR' };

const PARAMS = [
  { key: 'measure', kind: 'token', allowed: ['recent', 'often'], default: 'recent' },
  { key: 'by', kind: 'token', allowed: ['day', 'commit', 'pr'], default: 'day' },
] as const satisfies readonly UrlParamSpec[];

// Dark to bright, so the lines that changed most lately or most often stand out on the dark map.
const STOPS: ColorStop[] = [
  { t: 0, color: hex('#25304a') },
  { t: 0.5, color: hex('#2f8fa8') },
  { t: 1, color: hex('#f4e66b') },
];

const GRADIENT = `linear-gradient(to right, ${STOPS.map(({ t, color }) => `${colorToCss(color)} ${t * 100}%`).join(', ')})`;

type Key = `${Measure}-${By}`;

const valuesOf = memoByValueAndKey((structure: CodeStructure, key: Key): number[][] => {
  const { changes } = structure;
  const of = (i: number) => {
    const change = changes[i];
    return key === 'recent-day' ? change.time : key === 'recent-commit' ? change.commit : change.pr;
  };
  return structure.files.map((f) =>
    key.startsWith('often') ? f.timesChanged : f.lastChange.map(of),
  );
});

const keyOf = ({ measure, by }: ChurnSettings): Key =>
  `${measure}-${measure === 'often' ? 'day' : by}`;

function rangeOf(values: readonly (readonly number[])[]): [low: number, high: number] {
  let low = Infinity;
  let high = -Infinity;
  for (const line of values) {
    for (const v of line) {
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  return [low, high];
}

const scaleOf = memoByValueAndKey((structure: CodeStructure, key: Key): Scale => {
  const [low, high] = rangeOf(valuesOf(structure, key));
  // On a linear count, a few lines changed hundreds of times would crowd the rest into the dark end.
  return scale(low, high, key.startsWith('often') ? LOG : LINEAR, STOPS);
});

/** The oldest and newest a line last changed, as dates, or as months for the panel's one line. */
function dateEnds(structure: CodeStructure, chars = 10): [string, string] {
  const [low, high] = rangeOf(valuesOf(structure, 'recent-day'));
  const date = (t: number) => new Date(t * 1000).toISOString().slice(0, chars);
  return [date(low), date(high)];
}

/** One block for each count from the fewest to the most, each in its own colour. */
function countSteps(structure: CodeStructure): { count: number; css: string }[] {
  const [low, high] = rangeOf(valuesOf(structure, 'often-day'));
  const s = scaleOf(structure, 'often-day');
  return Array.from({ length: high - low + 1 }, (_, i) => ({
    count: low + i,
    css: colorToCss(s.colorOf(low + i)),
  }));
}

/** Labels at most this many of the steps, evenly, so the scale reads whatever the most is. */
/** The steps as one strip, hard-edged, between the fewest and the most. */
function stepStrip(steps: readonly { count: number; css: string }[]) {
  const width = 100 / steps.length;
  const stops = steps.map(({ css }, i) => `${css} ${i * width}% ${(i + 1) * width}%`);
  return {
    gradient: `linear-gradient(to right, ${stops.join(', ')})`,
    ends: [String(steps[0].count), String(steps.at(-1)!.count)] as [string, string],
  };
}

const MAX_STEP_LABELS = 12;

function stepsLegend(steps: readonly { count: number; css: string }[]): HTMLElement {
  const every = Math.ceil(steps.length / MAX_STEP_LABELS);
  const scaleEl = document.createElement('div');
  scaleEl.style.cssText = 'display:flex;flex:1;gap:1px';
  scaleEl.append(
    ...steps.map(({ count, css }, i) => {
      const step = document.createElement('div');
      step.style.cssText = 'flex:1;text-align:center;font-size:10px;line-height:1.4';
      const block = document.createElement('div');
      block.style.cssText = `height:10px;background:${css}`;
      step.append(block);
      const labelled = i % every === 0 || i === steps.length - 1;
      step.append(labelled ? String(count) : ' ');
      step.title = `changed ${count} time${count === 1 ? '' : 's'}`;
      return step;
    }),
  );
  return scaleEl;
}

function segments(label: string, key: string, options: Readonly<Record<string, string>>): string {
  return (
    `<div class="${CONTROL.segments}" role="group" aria-label="${label}">` +
    Object.entries(options)
      .map(
        ([value, name]) =>
          `<button type="button" class="${CONTROL.segment}" data-${key}="${value}">${name}</button>`,
      )
      .join('') +
    `</div>`
  );
}

function press(container: HTMLElement, key: string, value: string): void {
  for (const button of container.querySelectorAll<HTMLButtonElement>(`[data-${key}]`)) {
    const on = button.dataset[key] === value;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  }
}

export const churnOverlay: Overlay<CodeItem, ChurnSettings, StructureData> = {
  id: 'churn',
  name: 'Churn',
  description:
    'Shows how each line has changed over its file’s whole history: brightest the newest, or the most often changed.',
  data: STRUCTURE_DATA,
  urlParams: PARAMS,
  settingsFromUrl: ({ measure, by }: UrlParamValues<typeof PARAMS>) => ({ measure, by }),
  settingsToUrl: ({ measure, by }): Record<string, string> =>
    measure === 'often' ? { measure } : { measure, by },

  colorsFor({ items, settings, data: { structure } }) {
    const key = keyOf(settings);
    const values = valuesOf(structure, key);
    const s = scaleOf(structure, key);
    return items.map((item) =>
      item.deletedFile ? null : s.colorOf(values[item.file][item.line - 1]),
    );
  },

  renderControls(container, { measure, by }, onChange) {
    if (!container.querySelector('[data-measure]')) {
      container.innerHTML =
        `<div>${segments('Measure', 'measure', MEASURES)}</div>` +
        `<div style="margin-top:6px">${segments('Counted', 'by', BY)}</div>`;
      for (const button of container.querySelectorAll<HTMLButtonElement>('[data-measure]')) {
        const m = button.dataset.measure as Measure;
        button.addEventListener('click', () => onChange((s) => ({ ...s, measure: m })));
      }
      for (const button of container.querySelectorAll<HTMLButtonElement>('[data-by]')) {
        const b = button.dataset.by as By;
        button.addEventListener('click', () => onChange((s) => ({ ...s, by: b })));
      }
    }
    press(container, 'measure', measure);
    press(container, 'by', by);
    const counted = container.querySelector<HTMLElement>('[aria-label="Counted"]')!.parentElement!;
    counted.style.display = measure === 'recent' ? '' : 'none';
  },

  renderLegend(container, { measure }, data) {
    if (measure === 'often' && data) {
      container.replaceChildren(legendRow(stepsLegend(countSteps(data.structure))));
      return;
    }
    const [low, high] = data
      ? dateEnds(data.structure)
      : measure === 'often'
        ? ['once', 'often']
        : ['old', 'new'];
    const strip = document.createElement('span');
    strip.style.cssText = `flex:1;height:10px;border-radius:2px;background:${GRADIENT}`;
    container.replaceChildren(legendRow(low, strip, high));
  },

  summary: ({ measure }, { structure }) => ({
    strip:
      measure === 'often'
        ? stepStrip(countSteps(structure))
        : { gradient: GRADIENT, ends: dateEnds(structure, 7) },
  }),
};
