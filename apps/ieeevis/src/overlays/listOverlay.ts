// An overlay that lights the papers listed under the authors, or the keywords, a reader picks,
// each pick in a colour of its own.

import type { Overlay, SettingsUpdate } from '@torahmap/shell/overlays/types.ts';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksInUse,
  picksToUrl,
  removePick,
} from '@torahmap/shell/overlays/picks.ts';
import {
  pickChip,
  pickChips,
  pickedList,
  pickFinderIn,
  pickMeta,
  pickNote,
  pickRow,
  pickSuggestions,
  type PickFinder,
} from '@torahmap/shell/overlays/pickFinder.ts';
import { brighten, colorToCss, type Color } from '@torahmap/utils';
import { baseColor, TEXT } from '../baseColor.ts';
import { STRUCTURE_FILE, type Paper } from '../data.ts';
import type { PieceItem } from '../layout.ts';
import { legendRow, swatchRow } from './legend.ts';
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
  /** How a name is shown; the name itself, as written, is still what is picked and linked. */
  display?(name: string): string;
  /** Under the legend: what the picks do not cover. */
  legendNote?(listing: { papers: number; total: number }): string;
}

interface Finder extends PickFinder {
  settings: ListSettings;
  data: ListData | null;
  onChange(update: SettingsUpdate<ListSettings>): void;
}

export function listOverlay(kind: ListKind): Overlay<PieceItem, ListSettings, ListData> {
  const { noun } = kind;
  const picks = picksOf(kind.namesOf);
  const show = kind.display ?? ((name: string) => name);

  function drawFinder({ settings, data, onChange, input, lists }: Finder): void {
    lists.replaceChildren();
    if (!data) {
      lists.append(pickNote(`Loading the ${noun.many}…`));
      return;
    }
    const picked = picks.picked(settings, data);
    const colors = pickColors(picks.slots(settings, data));
    const full = picked.length >= MAX_PICKS;
    const choose = (entry: Entry) => {
      input.value = '';
      onChange(addPick(entry.name));
    };

    if (input.value.trim()) {
      const found = picks.suggest(data, input.value, picked);
      lists.append(
        pickSuggestions(
          full
            ? [pickNote(`${MAX_PICKS} at most: unpick one first.`)]
            : found.length
              ? found.map((entry) =>
                  pickRow([show(entry.name), pickMeta(papers(entry.papers))], () => choose(entry)),
                )
              : [pickNote(`No ${noun.one} by that name.`)],
        ),
      );
    }

    if (picked.length)
      lists.append(
        pickedList(
          picked.map((entry, i) => ({
            color: colors[i],
            text: [show(entry.name), pickMeta(papers(entry.papers))],
            removeTitle: `Unpick ${show(entry.name)}`,
            onRemove: () => onChange(removePick(entry.name)),
          })),
        ),
      );

    const heading = document.createElement('div');
    heading.className = 'panel-section-heading';
    heading.textContent = 'Most papers';
    const chips = pickChips(
      picks.quick(data).map((entry) =>
        pickChip(show(entry.name), {
          title: papers(entry.papers),
          on: picked.includes(entry),
          disabled: full && !picked.includes(entry),
          onClick: () =>
            picked.includes(entry) ? onChange(removePick(entry.name)) : choose(entry),
        }),
      ),
    );
    const quick = document.createElement('div');
    quick.append(heading, chips);
    lists.append(quick);
  }

  const finderIn = (container: HTMLElement): Finder =>
    pickFinderIn<Finder>(container, {
      placeholder: `Find ${noun.a} by name…`,
      label: `Find ${noun.a}`,
      extend: (parts) => ({ ...parts, settings: { picked: [] }, data: null, onChange: () => {} }),
      onType: drawFinder,
    });

  const unlit = (item: PieceItem): Color => brighten(baseColor(item), UNLIT_KEEPS);

  return {
    id: kind.id,
    name: kind.name,
    description: kind.description,
    data: { structure: STRUCTURE_FILE },

    urlParams: [{ key: kind.urlKey, kind: 'text' }],
    settingsFromUrl: (params, taken) => ({ picked: picksFromUrl(params[kind.urlKey], taken) }),
    colorsInUse: picksInUse,
    settingsToUrl: ({ picked }) =>
      Object.fromEntries(picked.length ? [[kind.urlKey, picksToUrl(picked)]] : []),

    colorsFor(items, settings, _hovered, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return items.map(baseColor);
      const colors = pickColors(picks.slots(settings, data));
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
      if (!picked.length) rows.push(legendRow(`Pick ${noun.a} to light its papers.`));
      else {
        const colors = pickColors(picks.slots(settings, data));
        rows.push(...picked.map((entry, i) => swatchRow(colors[i], show(entry.name))));
        rows.push(swatchRow(brighten(TEXT, UNLIT_KEEPS), 'Papers under none of them'));
      }
      const note = kind.legendNote?.(picks.listing(data));
      if (note) rows.push(legendRow(note));
      container.replaceChildren(...rows);
    },

    summary(settings, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return { detail: `pick ${noun.a}` };
      return {
        detail: picked.length === 1 ? show(picked[0].name) : `${picked.length} ${noun.many}`,
        colors: pickColors(picks.slots(settings, data)).map(colorToCss),
      };
    },

    getHoverInfo(item, settings, data) {
      const picked = picks.picked(settings, data);
      const names = listedBy(picked, kind.namesOf(item.paper)).map((i) => show(picked[i].name));
      return names.length ? names.join(', ') : null;
    },
  };
}
