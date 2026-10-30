// Lights the papers that cite works the hovered or pinned paper also cites, the more the stronger.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { pickMeta, pickRow, pickSuggestions } from '@torahmap/shell/overlays/pickFinder.ts';
import { legendRow, swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import {
  brighten,
  colorToCss,
  hex,
  interpolateGradient,
  type Color,
  type ColorStop,
} from '@torahmap/utils';
import { baseColor, TEXT } from '../baseColor.ts';
import { sharedCitations, type CitedData } from '../citations.ts';
import { CITED_FILE, papersOf, STRUCTURE_FILE, type Paper } from '../data.ts';
import type { PieceItem } from '../layout.ts';

/** How much of its colour a paper keeps when it shares nothing with the focused paper. */
const UNLIT_KEEPS = 0.35;

const FOCUS = hex('#ffffff');
const STRENGTH: ColorStop[] = [
  { t: 0, color: hex('#f5dc8c') },
  { t: 1, color: hex('#e0402a') },
];

/** The most papers listed in the panel. */
const LISTED = 12;

const works = (n: number) => `${n} work${n === 1 ? '' : 's'}`;

/** The papers `paper` shares citations with, and how many works each shares. */
const sharedWith = (data: CitedData, paper: Paper | null): ReadonlyMap<number, number> =>
  (paper && sharedCitations(data).get(paper.index)) || new Map();

/** The focused paper: the hovered one if it shares citations with any, else the pinned one. */
function focusOf(
  data: CitedData,
  hovered: PieceItem | null | undefined,
  pinned: PieceItem | null | undefined,
): Paper | null {
  const hoveredPaper = hovered?.paper ?? null;
  return sharedWith(data, hoveredPaper).size ? hoveredPaper : (pinned?.paper ?? null);
}

const strongest = (shared: ReadonlyMap<number, number>) => Math.max(1, ...shared.values());
const colorFor = (n: number, most: number): Color =>
  interpolateGradient(most > 1 ? (n - 1) / (most - 1) : 1, STRENGTH);

const matchedPapers = (data: CitedData, focus: Paper | null): Set<number> =>
  focus ? new Set([focus.index, ...sharedWith(data, focus).keys()]) : new Set();

export const sharedCitationsOverlay: Overlay<PieceItem, Record<string, never>, CitedData> = {
  id: 'sharedcitations',
  name: 'Shared citations',
  description:
    'Hover or select a paper to light the papers that cite works it cites too. The more works they share, the stronger the color; the rest of the map dims.',
  data: { structure: STRUCTURE_FILE, cited: CITED_FILE },

  colorsFor(items, _settings, hovered, data, pinned) {
    const focus = focusOf(data, hovered, pinned);
    if (!focus) return items.map(baseColor);
    const shared = sharedWith(data, focus);
    const most = strongest(shared);
    return items.map((item) => {
      if (item.paper.index === focus.index) return FOCUS;
      const n = shared.get(item.paper.index);
      return n ? colorFor(n, most) : brighten(baseColor(item), UNLIT_KEEPS);
    });
  },

  standoutsFor(items, _settings, data, hovered, pinned) {
    const lit = matchedPapers(data, focusOf(data, hovered ?? null, pinned ?? null));
    return items.map((item) => lit.has(item.paper.index));
  },

  hoverChangesColors: (before, after, _settings, data) =>
    focusOf(data, before, null)?.index !== focusOf(data, after, null)?.index,
  pinChangesColors: (before, after) => before?.paper.index !== after?.paper.index,

  renderLegend(container) {
    container.replaceChildren(
      ...swatchList([
        { color: STRENGTH[1].color, name: 'Shares many cited works with it' },
        { color: STRENGTH[0].color, name: 'Shares one' },
        { color: FOCUS, name: 'The paper itself' },
        { color: brighten(TEXT, UNLIT_KEEPS), name: 'Shares none' },
      ]),
      legendRow('Hover or select a paper to see.'),
    );
  },

  renderFocus(container, hovered, pinned, _settings, data, travelTo) {
    const focus = focusOf(data, hovered, pinned);
    if (!focus) return;
    const shared = [...sharedWith(data, focus)].sort((a, b) => b[1] - a[1]);
    const listed = shared.slice(0, LISTED);
    const heading = document.createElement('div');
    heading.className = 'panel-section-heading';
    heading.textContent = shared.length
      ? `Papers citing works it cites (${shared.length}), most shared first`
      : 'Shares no cited work with another paper';
    const byIndex = new Map(papersOf(data.structure).map((paper) => [paper.index, paper]));
    container.append(
      heading,
      pickSuggestions(
        listed.map(([index, n]) =>
          pickRow([byIndex.get(index)!.title, pickMeta(works(n))], () => travelTo(`${index}.0`)),
        ),
      ),
    );
  },

  summary: () => ({
    strip: {
      gradient: `linear-gradient(to right, ${STRENGTH.map((s) => colorToCss(s.color)).join(', ')})`,
      ends: ['one work', 'many'],
    },
  }),
};
