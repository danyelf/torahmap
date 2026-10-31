// Colours each segment by the generation of the latest rabbi it names, so that a discussion reads
// from its early voices to its late ones.

import { MAP_BACKGROUND } from '@torahmap/engine';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, colorToCssAlpha, hslToRgb, type Color } from '@torahmap/utils';
import { DATING_FILE, isSure, UNDATED, type Generation, type TalmudDating } from '../dating.ts';
import type { TalmudLayoutItem } from '../layout.ts';
import { HEBREW } from '@torahmap/shell/language.ts';
import { legendHeading, swatchRow } from '@torahmap/shell/overlays/swatchList.ts';
import { wrapRuns } from '@torahmap/shell/textRuns.ts';

export interface DatingData {
  dating: TalmudDating;
}

export const TRANSITION = 'TA';

// An era is one hue; its bands run dark (earliest) to light (latest) in lightness alone. The
// transitional generation, TRANSITION, is the lightest step of the Tannaim.
export const ERAS = [
  {
    name: 'Zugot',
    hue: 285,
    bands: [
      { codes: ['Z1', 'Z2', 'Z3'], l: 0.4 },
      { codes: ['Z4', 'Z5'], l: 0.65 },
    ],
  },
  {
    name: 'Tannaim',
    hue: 28,
    bands: [
      { codes: ['T1', 'T2', 'T3'], l: 0.38 },
      { codes: ['T4', 'T5'], l: 0.52 },
      { codes: ['T6'], l: 0.66 },
      { codes: [TRANSITION], l: 0.8 },
    ],
  },
  {
    name: 'Amoraim',
    hue: 212,
    bands: [
      { codes: ['A1', 'A2'], l: 0.4 },
      { codes: ['A3', 'A4', 'A5'], l: 0.54 },
      { codes: ['A6', 'A7', 'A8'], l: 0.68 },
    ],
  },
] as const;

const HSL: Record<string, { h: number; l: number }> = Object.fromEntries(
  ERAS.flatMap(({ hue, bands }) =>
    bands.flatMap(({ codes, l }) => codes.map((c) => [c, { h: hue, l }])),
  ),
);

/** The era a generation's colour belongs to; the transitional generation is counted with the Tannaim. */
export const eraOf = (code: string): string =>
  ERAS.find((e) => e.bands.some((b) => (b.codes as readonly string[]).includes(code)))!.name;

/** How far an uncertain segment's colour is washed out toward grey. */
const WASHED_OUT = 0.9;
/** What the wash leaves of an uncertain segment's colour is almost this grey, which the key shows. */
const GREY: Color = [0.62, 0.62, 0.62];
/** How much of its usual colour a segment that names no rabbi keeps. */
const FAINT = 0.3;

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

/** "320–350", "100–60 BCE", "30 BCE–20 CE"; `ce` adds CE where both ends are plainly CE. */
export function yearsShort({ from, to }: Generation, ce = false): string {
  const [a, b] = [Math.abs(from), Math.abs(to)];
  if (from < 0 && to < 0) return `${a}–${b} BCE`;
  if (from >= 0 && to >= 0) return `${a}–${b}${ce ? ' CE' : ''}`;
  return `${a} BCE–${b} CE`;
}

/** "c. 320–350 CE" */
export const yearsOf = (generation: Generation): string => `c. ${yearsShort(generation, true)}`;

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/**
 * A generation in words, from its code: "5th-generation Tanna", "3rd pair of the Zugot",
 * "Tanna/Amora transition". `short` is for a line of names: "5th-gen Tanna", "Zugot, 3rd pair".
 */
export function generationLabel(code: string, short = false): string {
  if (code === UNDATED) return 'Undated';
  if (code === TRANSITION) return 'Tanna/Amora transition';
  const ordinal = ORDINALS[Number(code.slice(1))];
  if (code[0] === 'Z') return short ? `Zugot, ${ordinal} pair` : `${ordinal} pair of the Zugot`;
  const era = code[0] === 'T' ? 'Tanna' : 'Amora';
  return `${ordinal}${short ? '-gen' : '-generation'} ${era}`;
}

/** "5th-gen Tanna, 135-170": a generation by its code and years, `mark` after the label where it is a guess; no years without a generation. */
export const eraText = (code: string, years: Generation | undefined, mark = ''): string =>
  generationLabel(code, true) + mark + (years ? `, ${yearsShort(years)}` : '');

/** `color` with only `keeps` of it left over the map's background. */
export const fadeTo = (color: readonly number[], keeps: number): Color =>
  mix(MAP_BACKGROUND, color, keeps);

const faint = (color: readonly number[]): Color => fadeTo(color, FAINT);

/** A generation's colour, washed out where only a shared name gives it. */
const shade = (code: string, uncertain: boolean): Color =>
  uncertain ? uncertainColor(generationColor(code)) : generationColor(code);

/** A generation as a key row gives it, under its era's heading: "4th generation", "3rd pair". */
function rowLabel(code: string): string {
  if (code === TRANSITION) return 'Tanna/Amora transition';
  return `${ORDINALS[Number(code.slice(1))]} ${code[0] === 'Z' ? 'pair' : 'generation'}`;
}

/** Opens the Rabbis overlay at a rabbi. Set once the shell is running; names are plain text until then. */
export interface RabbiLink {
  open?(id: string): void;
}

/** A rabbi's name in a pinned passage: a button that opens him in Rabbis, once there is a way to. */
export function nameFor(label: string, id: string | null, link: RabbiLink): Node {
  if (!id || !link.open) return document.createTextNode(label);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rabbi-name';
  button.title = 'Show this rabbi on the Rabbis map';
  button.textContent = label;
  button.addEventListener('click', () => link.open?.(id));
  return button;
}

/**
 * `fragment` with each name in `spans` (a segment's, as dating.json gives them) marked in the
 * colour `colorOf` gives its person, or left plain where that is null.
 */
export function markNames(
  fragment: DocumentFragment,
  text: string,
  spans: readonly number[],
  colorOf: (person: number) => Color | null,
): DocumentFragment {
  const spanAt = (offset: number) => {
    for (let i = 0; i < spans.length; i += 3) {
      if (spans[i] <= offset && offset < spans[i + 1] && colorOf(spans[i + 2])) return i;
    }
    return null;
  };
  return wrapRuns(fragment, text, spanAt, (i, run) => {
    const mark = document.createElement('mark');
    mark.style.cssText = `background: ${colorToCssAlpha(colorOf(spans[i + 2])!, 0.5)}; color: inherit; border-radius: 2px`;
    mark.textContent = run;
    return mark;
  });
}

/** The overlay for a Talmud whose segments `base` colours when no tool does. */
export function datingOverlay(
  base: (item: TalmudLayoutItem) => Color,
  link: RabbiLink = {},
): Overlay<TalmudLayoutItem, void, DatingData> {
  const colorOf = (item: TalmudLayoutItem, { dating }: DatingData): Color => {
    const segment = dating.segments[item.id];
    if (!segment) return faint(base(item));
    return shade(dating.generations[segment[0]].code, segment[1] === 1);
  };

  return {
    id: 'dating',
    name: 'Dating',
    description:
      'Colors each segment by the generation of the latest rabbi it names. Each era has one ' +
      'color, going from darker earlier generations to lighter later ones. A gray segment ' +
      'names only a rabbi who could be one of several; a dim one names no dated rabbi.',
    credits: [
      {
        source: 'Sefaria, people tagged in the Talmud',
        url: 'https://www.sefaria.org/topics',
        note: 'Which rabbis a segment names, and each rabbi’s generation, from Sefaria’s topics.',
        collected: 'October 2026',
      },
    ],
    data: { dating: DATING_FILE },

    colorsFor: (items, _settings, _hovered, data) => items.map((item) => colorOf(item, data)),

    renderLegend(container, _settings, data) {
      if (!data) return;
      const { generations } = data.dating;
      const rowsOf = (include: (code: string) => boolean, apart = false) =>
        generations
          .filter((g) => include(g.code))
          .map((g) => {
            const row = swatchRow(
              generationColor(g.code),
              `${rowLabel(g.code)} · ${yearsOf(g)}`,
              apart,
            );
            row.classList.add('scale');
            return row;
          });
      const sections = ERAS.flatMap(({ name }) => {
        const rows = rowsOf((code) => eraOf(code) === name && code !== TRANSITION);
        const heading = rows.length ? [legendHeading(name), ...rows] : [];
        // The transitional generation stands between the Tannaim and the Amoraim, a row of its own.
        return name === 'Tannaim'
          ? [...heading, ...rowsOf((code) => code === TRANSITION, true)]
          : heading;
      });
      container.replaceChildren(
        ...sections,
        swatchRow(GREY, 'Uncertain: the name could be several rabbis'),
      );
    },

    // One square for each colour band that occurs, in a group for each era.
    summary: (_settings, { dating }) => ({
      groups: ERAS.map(({ name }) => [
        ...new Set(
          dating.generations
            .filter((g) => eraOf(g.code) === name)
            .map((g) => colorToCss(generationColor(g.code))),
        ),
      ]).filter((group) => group.length > 0),
    }),

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
        const sure = isSure(person);
        const entry = document.createElement(
          person.gen === generation && (sure || uncertain) ? 'strong' : 'span',
        );
        // A shared name gives its latest candidate only where it dates the passage.
        const where = !sure && !uncertain ? ' ?' : ` (${eraText(era.code, era, sure ? '' : '?')})`;
        entry.append(
          nameFor(person.en, sure ? dating.rabbis[person.means[0]].id : null, link),
          ' · ',
          he,
          where,
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
      return markNames(fragment, text, segment[3], (place) => {
        const person = dating.people[place];
        return shade(dating.generations[person.gen].code, !isSure(person));
      });
    },
  };
}
