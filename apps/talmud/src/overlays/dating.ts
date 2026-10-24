// Colours each segment by the generation of the latest rabbi it names, so that a discussion reads
// from its early voices to its late ones.

import { MAP_BACKGROUND } from '@torahmap/engine';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, escapeHtml, hslToRgb, type Color } from '@torahmap/utils';
import { DATING_FILE, type Generation, type TalmudDating } from '../dating.ts';
import type { TalmudLayoutItem } from '../layout.ts';
import { GEMARA_BASE_COLOR } from '../constants.ts';

export interface DatingData {
  dating: TalmudDating;
}

/** Every generation Sefaria codes, earliest first. */
const CODES = [
  ...['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
  ...['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
  'TA',
  ...['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
];

// Warm for the Zugot and Tannaim, a cool green for the generation between them, and cool for the
// Amoraim, one step of hue per generation.
const HUES: Record<string, number> = Object.fromEntries(
  CODES.map((code, i) => {
    if (i < 11) return [code, (i / 10) * 50];
    if (code === 'TA') return [code, 110];
    return [code, 160 + ((i - 12) / 7) * 95];
  }),
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

export const generationColor = (code: string): Color =>
  hslToRgb({ h: HUES[code] ?? 0, s: 0.75, l: 0.55 });

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
      'Colours each segment by the generation of the latest rabbi it names, warm for the ' +
      'Tannaim and cool for the Amoraim. A pale segment names only a rabbi who could be ' +
      'one of several; a dim one names no rabbi whose generation Sefaria gives.',
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
        row(generationColor(g.code), `${g.name} · ${yearsOf(g)}`),
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
      const [generation, uncertain, ...people] = segment;
      const g = dating.generations[generation];
      const box = document.createElement('div');
      const head = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = g.name;
      head.append(strong, ` (${yearsOf(g)})${uncertain ? ', uncertain' : ''}`);
      box.append(head);
      for (const place of people) {
        const person = dating.people[place];
        const line = document.createElement('div');
        const he = document.createElement('span');
        he.lang = 'he';
        he.dir = 'rtl';
        he.textContent = person.he;
        const gen = dating.generations[person.gen].name;
        line.append(
          `${person.en} · `,
          he,
          ` · ${person.ambiguous ? `could be several; the latest, ${gen}` : gen}`,
        );
        box.append(line);
      }
      return box;
    },
  };
}
