// Sketch: three ways into the citations. Throwaway.

import { brighten, hex, type Color } from '@torahmap/utils';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { baseColor, TEXT } from '../baseColor.ts';
import { STRUCTURE_FILE, papersOf, type Paper, type Structure } from '../data.ts';
import type { PieceItem } from '../layout.ts';
import { listOverlay } from './listOverlay.ts';

export const citedPeopleOverlay = listOverlay({
  id: 'citedpeople',
  name: 'Cited people',
  urlKey: 'cpeople',
  noun: { one: 'cited person', many: 'cited people' },
  description:
    'Lights every paper whose references name the people you pick; the rest of the map dims.',
  namesOf: (paper) => paper.cited ?? [],
});

export const citedWorksOverlay = listOverlay({
  id: 'citedworks',
  name: 'Cited works',
  urlKey: 'cworks',
  noun: { one: 'cited work', many: 'cited works' },
  description: 'Lights every paper that cites the works you pick; the rest of the map dims.',
  namesOf: (paper) => paper.works ?? [],
});

const byIndex = (structure: Structure) =>
  new Map(papersOf(structure).map((p) => [p.index, p] as const));

const focus = (hovered: PieceItem | null, pinned: PieceItem | null) =>
  (pinned ?? hovered)?.paper ?? null;

const LOW = hex('#f3d9a4');
const HIGH = hex('#c4251a');
const mix = (a: Color, b: Color, t: number): Color =>
  a.map((v, i) => v + (b[i] - v) * t) as Color;

export const sharedCitationsOverlay: Overlay<PieceItem, Record<string, never>, { structure: Structure }> = {
  id: 'sharedcitations',
  name: 'Shared citations',
  description:
    'Pin a paper to light the other papers that cite the same works; the more works shared, the stronger the color.',
  data: { structure: STRUCTURE_FILE },
  hoverChangesColors: () => true,
  pinChangesColors: () => true,
  colorsFor(items, _s, hovered, _d, pinned) {
    const p = focus(hovered as PieceItem | null, pinned as PieceItem | null);
    if (!p) return items.map(baseColor);
    const shared = new Map(p.shared ?? []);
    const max = Math.max(1, ...shared.values());
    return items.map((item) => {
      if (item.paper.index === p.index) return hex("#ffffff");
      const n = shared.get(item.paper.index);
      if (!n) return brighten(baseColor(item), 0.3);
      return mix(LOW, HIGH, Math.sqrt(n / max));
    });
  },
  standoutsFor(items, _s, _d, hovered, pinned) {
    const p = focus(hovered as PieceItem | null, pinned as PieceItem | null);
    const shared = new Map(p?.shared ?? []);
    return items.map((item) => !!p && (item.paper.index === p.index || shared.has(item.paper.index)));
  },
  renderLegend(container) {
    container.textContent = 'Pale to red: 1 to 40 cited works in common with the pinned paper. Dark: the pinned paper.';
  },
  renderFocus(container, hovered, pinned, _s, data, travelTo) {
    const p = focus(hovered as PieceItem | null, pinned as PieceItem | null);
    if (!p) {
      container.textContent = 'Pin or hover a paper to see who shares its references.';
      return;
    }
    const idx = byIndex(data.structure);
    const h = document.createElement('div');
    h.textContent = `${p.shared?.length ?? 0} papers share references with this one`;
    h.style.fontWeight = '600';
    const list = document.createElement('ol');
    list.style.cssText = 'padding-left:1.2em;font-size:12px;margin:4px 0';
    for (const [i, n] of (p.shared ?? []).slice(0, 8)) {
      const li = document.createElement('li');
      li.textContent = `${n} works: ${idx.get(i)?.title ?? i}`;
      li.style.cursor = 'pointer';
      li.onclick = () => travelTo(`${i}.0`);
      list.append(li);
    }
    container.replaceChildren(h, list);
  },
  summary: () => ({ detail: 'pin a paper' }),
};

void TEXT;
void (undefined as unknown as Paper);
