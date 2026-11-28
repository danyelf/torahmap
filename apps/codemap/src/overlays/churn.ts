// Where the work has gone over the repo's whole history: the files most worked on, or the oldest code.

import type { UrlParamSpec, UrlParamValues } from '@torahmap/link';
import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import {
  colorToCss,
  hex,
  interpolateGradient,
  memoByValue,
  type Color,
  type ColorStop,
} from '@torahmap/utils';
import { STRUCTURE_DATA, type CodeStructure, type StructureData } from '../data.ts';
import type { CodeItem } from '../layout.ts';

type Measure = 'worked' | 'oldest';

export interface ChurnSettings {
  readonly measure: Measure;
}

const MEASURES: Readonly<Record<Measure, string>> = {
  worked: 'Most worked on',
  oldest: 'Oldest',
};

const PARAMS = [
  { key: 'measure', kind: 'token', allowed: ['worked', 'oldest'], default: 'worked' },
] as const satisfies readonly UrlParamSpec[];

interface Band {
  color: Color;
  label: string;
}

// A line's count resets when it is rewritten, so the most rewritten code looks new; a file's
// count of commits does not, so the files are ranked by it and only the top quarter is filled.
const TIERS: readonly { share: number; color: Color }[] = [
  { share: 0.02, color: hex('#ffe164') },
  { share: 0.1, color: hex('#eb8232') },
  { share: 0.25, color: hex('#a0502d') },
];

interface Tier extends Band {
  min: number;
}

const tiersOf = memoByValue((structure: CodeStructure): Tier[] => {
  const counts = structure.files
    .filter((f) => !f.deleted)
    .map((f) => f.commitCount)
    .sort((a, b) => b - a);
  if (counts.length === 0) return [];
  const tiers: Tier[] = [];
  for (const { share, color } of TIERS) {
    const min = counts[Math.floor(counts.length * share)];
    if (tiers.at(-1)?.min === min) continue;
    const of = tiers.length === 0 ? 'of files ' : '';
    tiers.push({ min, color, label: `top ${share * 100}% ${of}(${min}+ commits)` });
  }
  return tiers;
});

// Oldest brightest; the newest two eras are grey, so the old code is the only colour.
const OLD: ColorStop[] = [
  { t: 0, color: hex('#ffd666') },
  { t: 0.5, color: hex('#f09646') },
  { t: 1, color: hex('#c85a78') },
];
const NEW: readonly Color[] = [hex('#5c6269'), hex('#3a3e43')];

/** Era lengths in months, shortest first; the shortest that gives at most MAX_ERAS is used. */
const ERA_MONTHS = [1, 2, 3, 6, 12, 24, 60, 120];
const MAX_ERAS = 6;

/** Months since year 0, in UTC. */
const monthOf = (time: number): number => {
  const d = new Date(time * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};

const monthName = (month: number, year: boolean): string =>
  new Date(Date.UTC(Math.floor(month / 12), month % 12)).toLocaleString('en-US', {
    month: 'short',
    year: year ? 'numeric' : undefined,
    timeZone: 'UTC',
  });

interface Eras {
  length: number; // months
  first: number; // the oldest era's index, in eras since year 0
  bands: Band[];
  ends: [string, string];
}

const erasOf = memoByValue((structure: CodeStructure): Eras => {
  let low = Infinity;
  let high = -Infinity;
  for (const { time } of structure.changes) {
    low = Math.min(low, monthOf(time));
    high = Math.max(high, monthOf(time));
  }
  if (low > high) return { length: 1, first: 0, bands: [], ends: ['', ''] };
  const length =
    ERA_MONTHS.find((n) => Math.floor(high / n) - Math.floor(low / n) < MAX_ERAS) ??
    ERA_MONTHS.at(-1)!;
  const first = Math.floor(low / length);
  const count = Math.floor(high / length) - first + 1;
  const grey = Math.min(NEW.length, count - 1);
  const bands = Array.from({ length: count }, (_, i) => {
    const start = Math.max((first + i) * length, low);
    const end = Math.min((first + i + 1) * length - 1, high);
    const label =
      start === end ? monthName(start, true) : `${monthName(start, false)}–${monthName(end, true)}`;
    const old = i < count - grey;
    const color = old
      ? interpolateGradient(count - grey === 1 ? 0 : i / (count - grey - 1), OLD)
      : NEW[i - (count - grey)];
    return { color, label };
  });
  return { length, first, bands, ends: [monthName(low, true), monthName(high, true)] };
});

function eraOf(structure: CodeStructure, item: CodeItem) {
  const change = structure.files[item.file].lastChange[item.line - 1];
  if (change === undefined) return null;
  const { length, first, bands } = erasOf(structure);
  return bands[Math.floor(monthOf(structure.changes[change].time) / length) - first] ?? null;
}

function colorOf(item: CodeItem, measure: Measure, structure: CodeStructure): Color | null {
  if (item.deletedFile) return null;
  if (measure === 'oldest') return eraOf(structure, item)?.color ?? null;
  const count = structure.files[item.file].commitCount;
  return tiersOf(structure).find((t) => count >= t.min)?.color ?? null;
}

/** The bands as one hard-edged strip. */
function bandStrip(bands: readonly Band[]): string {
  const width = 100 / bands.length;
  const stops = bands.map(
    ({ color }, i) => `${colorToCss(color)} ${i * width}% ${(i + 1) * width}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export const churnOverlay: Overlay<CodeItem, ChurnSettings, StructureData> = {
  id: 'churn',
  name: 'Churn',
  description:
    'Shows where the work has gone over the whole history: the files the most commits changed, or the code left unchanged longest.',
  data: STRUCTURE_DATA,
  urlParams: PARAMS,
  settingsFromUrl: ({ measure }: UrlParamValues<typeof PARAMS>) => ({ measure }),
  settingsToUrl: ({ measure }): Record<string, string> => ({ measure }),

  colorsFor: ({ items, settings, data: { structure } }) =>
    items.map((item) => colorOf(item, settings.measure, structure)),

  renderControls(container, { measure }, onChange) {
    if (!container.querySelector('[data-measure]')) {
      container.innerHTML =
        `<div class="${CONTROL.segments}" role="group" aria-label="Measure">` +
        Object.entries(MEASURES)
          .map(
            ([value, name]) =>
              `<button type="button" class="${CONTROL.segment}" data-measure="${value}">${name}</button>`,
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

  renderLegend(container, { measure }, data) {
    if (!data) {
      container.replaceChildren();
      return;
    }
    const bands = measure === 'oldest' ? erasOf(data.structure).bands : tiersOf(data.structure);
    container.replaceChildren(
      ...swatchList(bands.map(({ color, label }) => ({ color, name: label }))),
    );
  },

  summary: ({ measure }, { structure }) => {
    if (measure === 'worked') {
      return { colors: tiersOf(structure).map(({ color }) => colorToCss(color)) };
    }
    const { bands, ends } = erasOf(structure);
    return { strip: { gradient: bandStrip(bands), ends } };
  },
};
