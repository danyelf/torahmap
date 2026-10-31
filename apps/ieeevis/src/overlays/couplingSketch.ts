// Sketch: papers grouped and compared by the works they cite. Throwaway, not for merge.

import { brighten, hex, oklchToRgb, type Color } from '@torahmap/utils';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { swatchList, legendRow } from '@torahmap/shell/overlays/swatchList.ts';
import { baseColor, jittered, PLACEHOLDER, isPlaceholder } from '../baseColor.ts';
import { STRUCTURE_FILE, papersOf, type Structure } from '../data.ts';
import type { PieceItem } from '../layout.ts';

interface Sketch {
  /** Paper index -> [other paper, works shared, cosine, tf-idf cosine]. */
  neighbours: Record<string, [number, number, number, number][]>;
  /** k -> paper index -> cluster rank (0 = largest). */
  clusterings: Record<string, Record<string, number>>;
  clusterNames: Record<string, string[]>;
}
type Data = { structure: Structure; sketch: Sketch };
const DATA = { structure: STRUCTURE_FILE, sketch: 'ieeevis/coupling-sketch.json' };

const NO_REFS = brighten(PLACEHOLDER, 1.3);
const BIGGEST = hex('#5b6470');
const hues = (n: number): Color[] =>
  Array.from({ length: n }, (_, i) => oklchToRgb(0.74, 0.14, (i * 360) / n + 20));

function clusterOverlay(k: number): Overlay<PieceItem, Record<string, never>, Data> {
  const colors = [BIGGEST, ...hues(k - 1)];
  return {
    id: `clusters${k}`,
    name: `Citation clusters (k=${k})`,
    description: `Papers grouped by k-means on the works they cite (tf-idf weighted). Grey: the largest group, papers with no strong tie. Dark: no reference list.`,
    data: DATA,
    colorsFor: (items, _s, _h, data) =>
      items.map((item) => {
        if (isPlaceholder(item)) return PLACEHOLDER;
        const c = data.sketch.clusterings[k][item.paper.index];
        return c === undefined ? NO_REFS : jittered(colors[c], item);
      }),
    renderLegend(container, _s, data) {
      if (!data) return;
      const names = data.sketch.clusterNames[k];
      container.replaceChildren(
        ...swatchList(
          names.map((n, i) => ({
            color: colors[i],
            name: `${i === 0 ? '(largest) ' : ''}${n.slice(0, 70)}`,
          })),
        ),
        ...swatchList([{ color: NO_REFS, name: 'No reference list' }]),
      );
    },
  };
}

const MEASURES = [
  { id: 'count', name: 'works shared', at: 1 },
  { id: 'cosine', name: 'cosine', at: 2 },
  { id: 'tfidf', name: 'tf-idf cosine', at: 3 },
] as const;

const LOW = hex('#f3d9a4');
const HIGH = hex('#c4251a');
const mix = (a: Color, b: Color, t: number): Color => a.map((v, i) => v + (b[i] - v) * t) as Color;
const focusOf = (hovered: PieceItem | null, pinned: PieceItem | null | undefined) =>
  (pinned ?? hovered)?.paper ?? null;
/** How many neighbours light: the strongest, by the measure. */
const SHOWN = 15;

function overlapOverlay(
  m: (typeof MEASURES)[number],
): Overlay<PieceItem, Record<string, never>, Data> {
  const strongest = (data: Data, paper: number) =>
    [...(data.sketch.neighbours[paper] ?? [])].sort((a, b) => b[m.at] - a[m.at]).slice(0, SHOWN);
  return {
    id: `overlap${m.id}`,
    name: `Overlap: ${m.name}`,
    description: `Pin a paper: its ${SHOWN} strongest neighbours by ${m.name} light, pale to red.`,
    data: DATA,
    hoverChangesColors: () => true,
    pinChangesColors: () => true,
    colorsFor(items, _s, hovered, data, pinned) {
      const p = focusOf(hovered, pinned);
      if (!p) return items.map(baseColor);
      const top = strongest(data, p.index);
      const max = Math.max(...top.map((n) => n[m.at]), 1e-9);
      const of = new Map(top.map((n) => [n[0], n[m.at] / max]));
      return items.map((item) => {
        if (item.paper.index === p.index) return hex('#ffffff');
        const t = of.get(item.paper.index);
        return t === undefined ? brighten(baseColor(item), 0.3) : mix(LOW, HIGH, t);
      });
    },
    standoutsFor(items, _s, data, hovered, pinned) {
      const p = focusOf(hovered ?? null, pinned);
      const lit = new Set(p ? [p.index, ...strongest(data, p.index).map((n) => n[0])] : []);
      return items.map((item) => lit.has(item.paper.index));
    },
    renderLegend(container) {
      container.replaceChildren(
        legendRow(`Pale to red: the ${SHOWN} strongest by ${m.name}, scaled to the strongest.`),
      );
    },
    renderFocus(container, hovered, pinned, _s, data, travelTo) {
      const p = focusOf(hovered, pinned);
      if (!p) return;
      const titles = new Map(papersOf(data.structure).map((q) => [q.index, q.title]));
      const list = document.createElement('ol');
      list.style.cssText = 'padding-left:1.4em;font-size:12px;margin:4px 0';
      for (const [q, n, cos, tf] of strongest(data, p.index).slice(0, 10)) {
        const li = document.createElement('li');
        li.textContent = `${n} shared · cos ${cos.toFixed(2)} · tf-idf ${tf.toFixed(2)} — ${titles.get(q)}`;
        li.style.cursor = 'pointer';
        li.onclick = () => travelTo(`${q}.0`);
        list.append(li);
      }
      container.replaceChildren(list);
    },
  };
}

export const COUPLING_SKETCH = [
  clusterOverlay(8),
  clusterOverlay(12),
  ...MEASURES.map(overlapOverlay),
] as unknown as Overlay<PieceItem>[];
