// Colours each segment by the generation of the latest rabbi it names, so that a discussion reads
// from its early voices to its late ones.

import { MAP_BACKGROUND } from '@torahmap/engine';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, escapeHtml, hslToRgb, type Color } from '@torahmap/utils';
import { DATING_FILE, type Generation, type TalmudDating } from '../dating.ts';
import type { TalmudLayoutItem } from '../layout.ts';
import { GEMARA_BASE_COLOR } from '../constants.ts';
import { HEBREW } from '@torahmap/shell/language.ts';
import { wrapRuns } from '@torahmap/shell/textRuns.ts';

export interface DatingData {
  dating: TalmudDating;
}

// Each era has a family of its own, so an era shows at a glance and its generations step within
// it, early to late: the Zugot violet to magenta, the Tannaim orange to yellow, the generation
// between the Tannaim and Amoraim a plain green, the Amoraim cyan to deep blue.
const FAMILIES: Record<
  string,
  { codes: string[]; hue: [number, number]; light: [number, number] }
> = {
  zugot: { codes: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'], hue: [270, 320], light: [0.45, 0.65] },
  tannaim: { codes: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], hue: [15, 55], light: [0.48, 0.6] },
  between: { codes: ['TA'], hue: [105, 105], light: [0.5, 0.5] },
  amoraim: {
    codes: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
    hue: [190, 240],
    light: [0.66, 0.46],
  },
};

const HSL: Record<string, { h: number; l: number }> = Object.fromEntries(
  Object.values(FAMILIES).flatMap(({ codes, hue, light }) =>
    codes.map((code, i) => {
      const t = codes.length > 1 ? i / (codes.length - 1) : 0;
      return [code, { h: hue[0] + (hue[1] - hue[0]) * t, l: light[0] + (light[1] - light[0]) * t }];
    }),
  ),
);

/** How far an uncertain segment's colour moves toward white. */
export const PALE = 0.55;
/** How much of its usual colour a segment that names no rabbi keeps. */
export const FAINT = 0.3;

const mix = (a: readonly number[], b: readonly number[], toward: number): Color => [
  a[0] + (b[0] - a[0]) * toward,
  a[1] + (b[1] - a[1]) * toward,
  a[2] + (b[2] - a[2]) * toward,
];

export const generationColor = (code: string): Color => {
  const step = HSL[code];
  if (!step) throw new Error(`No colour for generation ${code}`);
  return hslToRgb({ ...step, s: 0.75 });
};

export const paleColor = (color: Color): Color => mix(color, [1, 1, 1], PALE);

/** "c. 320–350 CE", "c. 100–60 BCE", "c. 30 BCE–20 CE" */
export function yearsOf({ from, to }: Generation): string {
  const [a, b] = [Math.abs(from), Math.abs(to)];
  if (from < 0 && to < 0) return `c. ${a}–${b} BCE`;
  if (from >= 0 && to >= 0) return `c. ${a}–${b} CE`;
  return `c. ${a} BCE–${b} CE`;
}

const swatch = (color: Color) =>
  `<span class="swatch" style="background: ${colorToCss(color)}"></span>`;
const row = (color: Color, label: string) =>
  `<div class="legend-row">${swatch(color)}<span>${escapeHtml(label)}</span></div>`;

/** The overlay for a Talmud whose segments `base` colours when no tool does. */
export function datingOverlay(
  base: (item: TalmudLayoutItem) => Color,
): Overlay<TalmudLayoutItem, void, DatingData> {
  const colorOf = (item: TalmudLayoutItem, { dating }: DatingData): Color => {
    const segment = dating.segments[item.id];
    if (!segment) return mix(MAP_BACKGROUND, base(item), FAINT);
    const color = generationColor(dating.generations[segment[0]].code);
    return segment[1] ? paleColor(color) : color;
  };

  return {
    id: 'dating',
    name: 'Dating',
    description:
      'Colours each segment by the generation of the latest rabbi it names. Each era has its ' +
      'own colours: Zugot violet, Tannaim orange to yellow, Amoraim blue, and green between ' +
      'them. A pale segment names only a rabbi who could be one of several; a dim one names ' +
      'no rabbi whose generation Sefaria gives.',
    credits: [
      {
        source: 'Sefaria, people tagged in the Talmud',
        url: 'https://www.sefaria.org/topics',
        note: 'Which rabbis a segment names, and each rabbi’s generation, from Sefaria’s topics.',
        collected: 'October 2026',
      },
    ],
    data: { dating: DATING_FILE },

    getItemColor: (item, _settings, data) => colorOf(item, data),
    colorsFor: (items, _settings, _hovered, data) => items.map((item) => colorOf(item, data)),

    renderLegend(container, _settings, data) {
      if (!data) return;
      const { dating } = data;
      const rows = dating.generations.map((g) =>
        row(generationColor(g.code), `${g.code} · ${g.name} · ${yearsOf(g)}`),
      );
      container.innerHTML = [
        ...rows,
        row(paleColor(generationColor('A4')), 'Uncertain: the name could be several rabbis'),
        row(
          mix(MAP_BACKGROUND, GEMARA_BASE_COLOR, FAINT),
          'Names no rabbi with a known generation',
        ),
      ].join('');
    },

    // Six steps spread across the generations that occur.
    summary: (_settings, { dating }) => {
      const { generations } = dating;
      const picks = Math.min(6, generations.length);
      return {
        colors: Array.from({ length: picks }, (_, i) =>
          colorToCss(
            generationColor(
              generations[Math.round((i * (generations.length - 1)) / Math.max(1, picks - 1))].code,
            ),
          ),
        ),
      };
    },

    getHoverInfo(item, _settings, { dating }) {
      const segment = dating.segments[item.id];
      return segment ? dating.generations[segment[0]].name : null;
    },

    renderSidebarInfo(item, isPinned, _settings, { dating }) {
      const segment = dating.segments[item.id];
      if (!isPinned || !segment) return null;
      const [generation, uncertain, people] = segment;
      const box = document.createElement('div');
      people.forEach((place, i) => {
        const person = dating.people[place];
        const he = document.createElement('span');
        he.lang = 'he';
        he.dir = 'rtl';
        he.textContent = person.he;
        const code = dating.generations[person.gen].code;
        const entry = document.createElement(
          person.gen === generation && (!person.ambiguous || uncertain) ? 'strong' : 'span',
        );
        entry.append(`${person.en} · `, he, ` (${code}${person.ambiguous ? '?' : ''})`);
        box.append(...(i ? ['; '] : []), entry);
      });
      return box;
    },

    highlightItemText(item, text, language, _settings, { dating }) {
      const fragment = document.createDocumentFragment();
      fragment.append(text);
      const segment = dating.segments[item.id];
      if (language !== HEBREW || !segment) return fragment;
      const spans = segment[3];
      const spanAt = (offset: number) => {
        for (let i = 0; i < spans.length; i += 3) {
          if (spans[i] <= offset && offset < spans[i + 1]) return i;
        }
        return null;
      };
      return wrapRuns(fragment, text, spanAt, (i, run) => {
        const person = dating.people[spans[i + 2]];
        const color = generationColor(dating.generations[person.gen].code);
        const [r, g, b] = (person.ambiguous ? paleColor(color) : color).map((c) =>
          Math.round(c * 255),
        );
        const mark = document.createElement('mark');
        mark.style.cssText = `background: rgba(${r}, ${g}, ${b}, 0.5); color: inherit; border-radius: 2px`;
        mark.textContent = run;
        return mark;
      });
    },
  };
}
