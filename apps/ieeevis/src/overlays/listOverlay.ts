// An overlay that lights the papers listed under the authors, or the keywords, a reader picks,
// each pick in a colour of its own.

import type { Overlay, SettingsUpdate, UrlParamSpec } from '@torahmap/shell/overlays/types.ts';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksToUrl,
  removePick,
} from '@torahmap/shell/overlays/picks.ts';
import {
  pickedList,
  pickFinderIn,
  pickMeta,
  pickNote,
  pickRow,
  pickSwatch,
  type PickFinder,
} from '@torahmap/shell/overlays/pickFinder.ts';
import { brighten, colorToCss, type Color } from '@torahmap/utils';
import { baseColor, TEXT } from '../baseColor.ts';
import { STRUCTURE_FILE, type Paper } from '../data.ts';
import type { PieceItem } from '../layout.ts';
import { listedBy, picksOf, type Entry, type ListData, type ListSettings } from './listPicks.ts';

/** How much of its colour a paper keeps when it is under none of the picks. */
const UNLIT_KEEPS = 0.35;

const papers = (n: number) => `${n} paper${n === 1 ? '' : 's'}`;

export interface ListKind {
  id: string;
  name: string;
  /** The link's parameter for the picks. */
  urlKey: string;
  /** What a pick is called, in the singular and the plural: "author", "authors", "an author". */
  noun: { one: string; many: string; a: string };
  /** What the overlay does, said in the picker. */
  description: string;
  namesOf(paper: Paper): readonly string[];
  /** Under the legend: what the picks do not cover. */
  legendNote?(listing: { papers: number; total: number }): string;
}

interface Finder extends PickFinder {
  settings: ListSettings;
  data: ListData | null;
  onChange(update: SettingsUpdate<ListSettings>): void;
}

export function listOverlay(kind: ListKind): {
  overlay: Overlay<PieceItem, ListSettings, ListData>;
  urlParams: readonly UrlParamSpec[];
} {
  const { noun } = kind;
  const urlParams = [{ key: kind.urlKey, kind: 'text' }] as const satisfies readonly UrlParamSpec[];
  const picks = picksOf(kind.namesOf);
  const finders = new WeakMap<PickFinder, Finder>();

  function drawFinder({ settings, data, onChange, input, lists }: Finder): void {
    lists.replaceChildren();
    if (!data) {
      lists.append(pickNote(`Loading the ${noun.many}…`));
      return;
    }
    const picked = picks.picked(settings, data);
    const colors = pickColors(picked.length);
    const full = picked.length >= MAX_PICKS;
    const choose = (entry: Entry) => {
      input.value = '';
      onChange(addPick(entry.name));
    };

    if (input.value.trim()) {
      const found = picks.suggest(data, input.value, picked);
      const box = document.createElement('div');
      box.className = 'pick-suggestions';
      if (full) box.append(pickNote(`${MAX_PICKS} at most: unpick one first.`));
      else if (!found.length) box.append(pickNote(`No ${noun.one} by that name.`));
      else
        for (const entry of found)
          box.append(pickRow([entry.name, pickMeta(papers(entry.papers))], () => choose(entry)));
      lists.append(box);
    }

    if (picked.length)
      lists.append(
        pickedList(
          picked.map((entry, i) => ({
            color: colors[i],
            text: [entry.name, pickMeta(papers(entry.papers))],
            removeTitle: `Unpick ${entry.name}`,
            onRemove: () => onChange(removePick(entry.name)),
          })),
        ),
      );

    const heading = document.createElement('div');
    heading.className = 'panel-section-heading';
    heading.textContent = 'Most papers';
    const chips = document.createElement('div');
    chips.className = 'pick-chips';
    for (const entry of picks.quick(data)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pick-chip';
      chip.textContent = entry.name;
      chip.title = papers(entry.papers);
      chip.classList.toggle('on', picked.includes(entry));
      chip.disabled = full || picked.includes(entry);
      chip.addEventListener('click', () => choose(entry));
      chips.append(chip);
    }
    const quick = document.createElement('div');
    quick.append(heading, chips);
    lists.append(quick);
  }

  function finderIn(container: HTMLElement): Finder {
    const base: PickFinder = pickFinderIn(container, {
      placeholder: `Find ${noun.a} by name…`,
      label: `Find ${noun.a}`,
      onType: () => drawFinder(finders.get(base)!),
    });
    const known = finders.get(base);
    if (known) return known;
    const finder: Finder = { ...base, settings: { picked: [] }, data: null, onChange: () => {} };
    finders.set(base, finder);
    return finder;
  }

  const unlit = (item: PieceItem): Color => brighten(baseColor(item), UNLIT_KEEPS);

  const overlay: Overlay<PieceItem, ListSettings, ListData> = {
    id: kind.id,
    name: kind.name,
    description: kind.description,
    data: { structure: STRUCTURE_FILE },

    urlParams,
    settingsFromUrl: (params) => ({ picked: picksFromUrl(params[kind.urlKey]) }),
    settingsToUrl: ({ picked }) =>
      Object.fromEntries(picked.length ? [[kind.urlKey, picksToUrl(picked)]] : []),

    colorsFor(items, settings, _hovered, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return items.map(baseColor);
      const colors = pickColors(picked.length);
      return items.map((item) => {
        const lit = listedBy(picked, kind.namesOf(item.paper)).map((i) => colors[i]);
        if (!lit.length) return unlit(item);
        return lit.length === 1 ? lit[0] : lit;
      });
    },

    standoutsFor(items, settings, data) {
      const picked = picks.picked(settings, data);
      return items.map((item) => listedBy(picked, kind.namesOf(item.paper)).length > 0);
    },

    renderControls(container, settings, onChange, data) {
      const finder = finderIn(container);
      Object.assign(finder, { settings, data, onChange });
      drawFinder(finder);
    },

    renderLegend(container, settings, data) {
      if (!data) return;
      const picked = picks.picked(settings, data);
      const rows: HTMLElement[] = [];
      const row = (...content: (Node | string)[]) => {
        const line = document.createElement('div');
        line.className = 'legend-row';
        line.append(...content);
        rows.push(line);
      };
      if (!picked.length) row(`Pick ${noun.a} to light its papers.`);
      else {
        const colors = pickColors(picked.length);
        picked.forEach((entry, i) => row(pickSwatch(colors[i]), entry.name));
        row(pickSwatch(brighten(TEXT, UNLIT_KEEPS)), 'Papers under none of them');
      }
      const note = kind.legendNote?.(picks.listing(data));
      if (note) row(note);
      container.replaceChildren(...rows);
    },

    summary(settings, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return { detail: `pick ${noun.a}` };
      return {
        detail: picked.length === 1 ? picked[0].name : `${picked.length} ${noun.many}`,
        colors: pickColors(picked.length).map(colorToCss),
      };
    },

    getHoverInfo(item, settings, data) {
      const picked = picks.picked(settings, data);
      const names = listedBy(picked, kind.namesOf(item.paper)).map((i) => picked[i].name);
      return names.length ? names.join(', ') : null;
    },
  };
  return { overlay, urlParams };
}
