// An overlay that lights the papers listed under the authors, keywords, cited people or cited works a reader picks,
// each pick in a colour of its own.

import type { FileNames, Overlay, SettingsUpdate } from '@torahmap/shell/overlays/types.ts';
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
import { mark } from '@torahmap/search';
import { baseColor } from '../baseColor.ts';
import { entriesOf } from '../citations.ts';
import { REFERENCES_SECTION } from '../data.ts';
import type { PieceItem } from '../layout.ts';
import { legendRow, swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import {
  listedBy,
  picksOf,
  type Entry,
  type ListData,
  type PickSource,
  type ListSettings,
  type Picked,
} from './listPicks.ts';

/** How much of its colour a paper keeps when it is under none of the picks. */
const UNLIT_KEEPS = 0.35;

const colorsOf = (picked: readonly Picked[]) => pickColors(picked.map((p) => p.slot));

/** Longest a pick may be in the one-line summary. */
const SUMMARY_LENGTH = 24;
const short = (label: string) =>
  label.length > SUMMARY_LENGTH ? `${label.slice(0, SUMMARY_LENGTH - 1)}…` : label;

export interface ListKind<D extends ListData> extends PickSource<D> {
  id: string;
  name: string;
  /** The link's parameter for the picks. */
  urlKey: string;
  /** What a pick is called, in the singular and the plural: "author", "authors". */
  noun: { one: string; many: string };
  /** What the overlay does, said in the picker. */
  description?: string;
  /** The files it reads. */
  data: FileNames<D>;
  /** Said before the picked names in the popup: "cites". */
  popupLead?: string;
  /** Said before how many papers list a name: "cited by". */
  countLead?: string;
  /** The heading over the names most papers list: "Most cited". */
  quickHeading?: string;
  /** The titles in a square's text that a picked name stands for; the popup marks their entries. */
  titlesOf?(name: string, data: D): readonly string[];
}

interface Finder<D> extends PickFinder {
  settings: ListSettings;
  data: D | null;
  onChange(update: SettingsUpdate<ListSettings>): void;
}

export function listOverlay<D extends ListData>(
  kind: ListKind<D>,
): Overlay<PieceItem, ListSettings, D> {
  const { noun } = kind;
  const aNoun = `${/^[aeiou]/.test(noun.one) ? 'an' : 'a'} ${noun.one}`;
  const picks = picksOf(kind);
  const lead = kind.popupLead ? `${kind.popupLead}: ` : '';
  const papers = (n: number) =>
    `${kind.countLead ? `${kind.countLead} ` : ''}${n} paper${n === 1 ? '' : 's'}`;
  /** A pick's lines: what it is called, what says which one it is, and how many papers list it. */
  const linesOf = (entry: Entry) => [
    entry.label,
    ...(entry.detail ? [pickMeta(entry.detail)] : []),
    pickMeta(papers(entry.papers)),
  ];
  const namesAt = kind.namesAt ?? ((item: PieceItem, data: D) => kind.namesOf(item.paper, data));
  const listedUnder = (item: PieceItem, settings: ListSettings, data: D) => {
    const picked = picks.picked(settings, data);
    return listedBy(picked, namesAt(item, data)).map((i) => picked[i]);
  };

  /** The entries of the picked names' works in a reference list's `text`, in order, each with its pick's colour. */
  function entrySpans(item: PieceItem, text: string, settings: ListSettings, data: D) {
    if (item.section !== REFERENCES_SECTION) return [];
    const picked = picks.picked(settings, data);
    return listedBy(picked, namesAt(item, data))
      .flatMap((i) =>
        entriesOf(text, kind.titlesOf!(picked[i].name, data)).map((span) => ({
          ...span,
          slot: picked[i].slot,
        })),
      )
      .sort((a, b) => a.start - b.start);
  }

  function markEntries(
    item: PieceItem,
    text: string,
    _language: unknown,
    settings: ListSettings,
    data: D,
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let at = 0;
    for (const { start, end, slot } of entrySpans(item, text, settings, data)) {
      if (start < at) continue;
      fragment.append(text.slice(at, start), mark(text.slice(start, end), slot));
      at = end;
    }
    fragment.append(text.slice(at));
    return fragment;
  }

  function drawFinder({ settings, data, onChange, input, lists }: Finder<D>): void {
    lists.replaceChildren();
    if (!data) {
      lists.append(pickNote(`Loading the ${noun.many}…`));
      return;
    }
    const picked = picks.picked(settings, data);
    const colors = colorsOf(picked);
    const isPicked = (entry: Entry) => picked.some((p) => p.name === entry.name);
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
              ? found.map((entry) => pickRow(linesOf(entry), () => choose(entry)))
              : [pickNote(`No ${noun.one} by that name.`)],
        ),
      );
    }

    if (picked.length)
      lists.append(
        pickedList(
          picked.map((entry, i) => ({
            color: colors[i],
            text: linesOf(entry),
            removeTitle: `Unpick ${entry.label}`,
            onRemove: () => onChange(removePick(entry.name)),
          })),
        ),
      );

    const heading = document.createElement('div');
    heading.className = 'panel-section-heading';
    heading.textContent = kind.quickHeading ?? 'Most papers';
    const chips = pickChips(
      picks.quick(data).map((entry) =>
        pickChip(entry.label, {
          title: papers(entry.papers),
          on: isPicked(entry),
          disabled: full && !isPicked(entry),
          onClick: () => (isPicked(entry) ? onChange(removePick(entry.name)) : choose(entry)),
        }),
      ),
    );
    const quick = document.createElement('div');
    quick.append(heading, chips);
    lists.append(quick);
  }

  const finderIn = (container: HTMLElement): Finder<D> =>
    pickFinderIn<Finder<D>>(container, {
      placeholder: `Find ${aNoun} by name…`,
      label: `Find ${aNoun}`,
      extend: (parts) => ({ ...parts, settings: { picked: [] }, data: null, onChange: () => {} }),
      onType: drawFinder,
    });

  const unlit = (item: PieceItem): Color => brighten(baseColor(item), UNLIT_KEEPS);

  return {
    id: kind.id,
    name: kind.name,
    description: kind.description,
    data: kind.data,

    urlParams: [{ key: kind.urlKey, kind: 'text' }],
    settingsFromUrl: (params, taken) => ({ picked: picksFromUrl(params[kind.urlKey], taken) }),
    colorsInUse: picksInUse,
    settingsToUrl: ({ picked }) =>
      Object.fromEntries(picked.length ? [[kind.urlKey, picksToUrl(picked)]] : []),

    colorsFor(items, settings, _hovered, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return items.map(baseColor);
      const colors = colorsOf(picked);
      return items.map((item) => {
        const lit = listedBy(picked, namesAt(item, data)).map((i) => colors[i]);
        if (!lit.length) return unlit(item);
        return lit.length === 1 ? lit[0] : lit;
      });
    },

    standoutsFor(items, settings, data) {
      const picked = picks.picked(settings, data);
      return items.map((item) => listedBy(picked, namesAt(item, data)).length > 0);
    },

    renderControls(container, settings, onChange, data) {
      const finder = finderIn(container);
      Object.assign(finder, { settings, data, onChange });
      drawFinder(finder);
    },

    renderLegend(container, settings, data) {
      if (!data) return;
      const picked = picks.picked(settings, data);
      const colors = colorsOf(picked);
      container.replaceChildren(
        ...(picked.length
          ? swatchList(picked.map((entry, i) => ({ color: colors[i], name: entry.label })))
          : [legendRow(`Pick ${aNoun} to light its papers.`)]),
      );
    },

    summary(settings, data) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return { detail: `pick ${aNoun}` };
      return {
        detail: picked.length === 1 ? short(picked[0].label) : `${picked.length} ${noun.many}`,
        colors: colorsOf(picked).map(colorToCss),
      };
    },

    getHoverInfo(item, settings, data) {
      const names = listedUnder(item, settings, data).map((entry) => entry.label);
      return names.length ? `${lead}${names.join(', ')}` : null;
    },

    highlightItemText: kind.titlesOf ? markEntries : undefined,
    textMatches: kind.titlesOf
      ? (item, text, _language, settings, data) => entrySpans(item, text, settings, data)
      : undefined,
  };
}
