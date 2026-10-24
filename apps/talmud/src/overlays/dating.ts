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

// Each era has colours of its own, so an era shows at a glance, in two or three bands from early to
// late, dark to bright: the Zugot violet then magenta, the Tannaim orange, amber then yellow, the generation
// between the Tannaim and Amoraim a plain green, the Amoraim indigo, blue then cyan. The exact
// generation is in words, in the key and the caption.
const BANDS: { codes: string[]; h: number; l: number }[] = [
  { codes: ['Z1', 'Z2', 'Z3'], h: 275, l: 0.45 },
  { codes: ['Z4', 'Z5'], h: 315, l: 0.6 },
  { codes: ['T1', 'T2', 'T3'], h: 18, l: 0.5 },
  { codes: ['T4', 'T5'], h: 38, l: 0.55 },
  { codes: ['T6'], h: 56, l: 0.58 },
  { codes: ['TA'], h: 105, l: 0.5 },
  { codes: ['A1', 'A2'], h: 245, l: 0.45 },
  { codes: ['A3', 'A4', 'A5'], h: 215, l: 0.55 },
  { codes: ['A6', 'A7', 'A8'], h: 190, l: 0.64 },
];

const HSL: Record<string, { h: number; l: number }> = Object.fromEntries(
  BANDS.flatMap(({ codes, ...step }) => codes.map((code) => [code, step])),
);

/** How far an uncertain segment's colour is washed out toward grey. */
export const WASHED_OUT = 0.78;
const GREY = [0.62, 0.62, 0.64];
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

/** An uncertain segment: its era's colour so washed out that it reads as not sure, not as a generation. */
export const uncertainColor = (color: Color): Color => mix(color, GREY, WASHED_OUT);

/** "320–350", "100–60 BCE", "30 BCE–20 CE": the years, with an era only where it is not plainly CE. */
export function yearsShort({ from, to }: Generation): string {
  const [a, b] = [Math.abs(from), Math.abs(to)];
  if (from < 0 && to < 0) return `${a}–${b} BCE`;
  if (from >= 0 && to >= 0) return `${a}–${b}`;
  return `${a} BCE–${b} CE`;
}

/** "c. 320–350 CE", "c. 100–60 BCE", "c. 30 BCE–20 CE" */
export const yearsOf = (generation: Generation): string => {
  const years = yearsShort(generation);
  return `c. ${/^\d+–\d+$/.test(years) ? `${years} CE` : years}`;
};

/** The era a generation belongs to; the transitional generation is its own. */
export function eraOf(code: string): 'Zugot' | 'Tannaim' | 'transition' | 'Amoraim' {
  if (code === 'TA') return 'transition';
  return { Z: 'Zugot', T: 'Tannaim', A: 'Amoraim' }[code[0] as 'Z' | 'T' | 'A'] as 'Zugot';
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/**
 * A generation in words, from its code: "5th-generation Tanna", "3rd pair of the Zugot",
 * "Tanna/Amora transition". `short` is for a line of names: "5th-gen Tanna", "Zugot, 3rd pair".
 */
export function generationLabel(code: string, short = false): string {
  if (code === 'TA') return 'Tanna/Amora transition';
  const ordinal = ORDINALS[Number(code.slice(1))];
  if (code[0] === 'Z') return short ? `Zugot, ${ordinal} pair` : `${ordinal} pair of the Zugot`;
  const era = code[0] === 'T' ? 'Tanna' : 'Amora';
  return `${ordinal}${short ? '-gen' : '-generation'} ${era}`;
}

/** A generation as a key row gives it, under its era's heading: "4th generation", "3rd pair". */
export function rowLabel(code: string): string {
  if (code === 'TA') return 'Tanna/Amora transition';
  return `${ORDINALS[Number(code.slice(1))]} ${code[0] === 'Z' ? 'pair' : 'generation'}`;
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
    return segment[1] ? uncertainColor(color) : color;
  };

  return {
    id: 'dating',
    name: 'Dating',
    description:
      'Colours each segment by the generation of the latest rabbi it names. Each era has its ' +
      'own colours, in two or three bands from early to late: Zugot violet, Tannaim orange to ' +
      'yellow, Amoraim blue, and green between them. A grey segment names only a rabbi who ' +
      'could be one of several; a dim one names no rabbi whose generation Sefaria gives.',
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
      const { generations } = data.dating;
      const rowsOf = (era: string) =>
        generations
          .filter((g) => eraOf(g.code) === era)
          .map((g) => row(generationColor(g.code), `${rowLabel(g.code)} · ${yearsOf(g)}`));
      const section = (era: string, heading: string) => {
        const rows = rowsOf(era);
        return rows.length
          ? [
              `<div class="legend-heading" style="font-weight: 600; margin-top: 8px">${heading}</div>`,
              ...rows,
            ]
          : [];
      };
      container.innerHTML = [
        ...section('Zugot', 'Zugot'),
        ...section('Tannaim', 'Tannaim'),
        ...rowsOf('transition').map((r) =>
          r.replace('class="legend-row"', 'class="legend-row" style="margin-top: 8px"'),
        ),
        ...section('Amoraim', 'Amoraim'),
        row(uncertainColor(generationColor('A4')), 'Uncertain: the name could be several rabbis'),
        row(
          mix(MAP_BACKGROUND, GEMARA_BASE_COLOR, FAINT),
          'Names no rabbi with a known generation',
        ),
      ].join('');
    },

    // Six of the bands that occur, spread from early to late.
    summary: (_settings, { dating }) => {
      const colors = [
        ...new Set(dating.generations.map((g) => colorToCss(generationColor(g.code)))),
      ];
      const picks = Math.min(6, colors.length);
      return {
        colors: Array.from(
          { length: picks },
          (_, i) => colors[Math.round((i * (colors.length - 1)) / Math.max(1, picks - 1))],
        ),
      };
    },

    getHoverInfo(item, _settings, { dating }) {
      const segment = dating.segments[item.id];
      return segment ? generationLabel(dating.generations[segment[0]].code) : null;
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
        const era = dating.generations[person.gen];
        const entry = document.createElement(
          person.gen === generation && (!person.ambiguous || uncertain) ? 'strong' : 'span',
        );
        entry.append(
          `${person.en} · `,
          he,
          ` (${generationLabel(era.code, true)}${person.ambiguous ? '?' : ''}, ${yearsShort(era)})`,
        );
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
        const [r, g, b] = (person.ambiguous ? uncertainColor(color) : color).map((c) =>
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
