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
  pickQuick,
  pickResultsBox,
  pickRow,
  pickSuggestions,
  type PickFinder,
} from '@torahmap/shell/overlays/pickFinder.ts';
import { trackOverlayPick, type PickHow } from '@torahmap/shell/analytics.ts';
import { brighten, colorToCss, type Color } from '@torahmap/utils';
import { createResultsList, mark } from '@torahmap/search';
import { baseColor, isPlaceholder } from '../baseColor.ts';
import { entriesOf } from '../citations.ts';
import { REFERENCES_SECTION, type Paper } from '../data.ts';
import { pieceId, type PieceItem } from '../layout.ts';
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
/** How much of its pick's colour a lit paper keeps where it has no text, so it still reads as missing. */
const PLACEHOLDER_KEEPS = 0.6;

const paperCount = (n: number) => `${n} paper${n === 1 ? '' : 's'}`;

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

/** How the citation overlays word their picks. */
export const CITED_WORDING = {
  popupLead: 'cites',
  countLead: 'cited by',
  quickHeading: 'Most cited',
};

interface Finder<D> extends PickFinder {
  settings: ListSettings;
  data: D | null;
  onChange(update: SettingsUpdate<ListSettings>): void;
  travelTo(id: string): void;
}

export function listOverlay<D extends ListData>(
  kind: ListKind<D>,
): Overlay<PieceItem, ListSettings, D> {
  const { noun } = kind;
  const aNoun = `${/^[aeiou]/.test(noun.one) ? 'an' : 'a'} ${noun.one}`;
  const picks = picksOf(kind);
  const lead = kind.popupLead ? `${kind.popupLead}: ` : '';
  const papers = (n: number) => `${kind.countLead ? `${kind.countLead} ` : ''}${paperCount(n)}`;
  /** A pick's lines: what it is called, what says which one it is, and how many papers list it. */
  const linesOf = (entry: Entry) => [
    entry.label,
    ...(entry.detail ? [pickMeta(entry.detail)] : []),
    pickMeta(papers(entry.papers)),
  ];
  /** Which of `picked` light the square `id` of `paper`, as places among them. */
  const litBy = (picked: readonly Entry[], paper: Paper, id: string, data: D) =>
    listedBy(picked, kind.namesAt?.(id, data) ?? kind.namesOf(paper, data));
  const listedUnder = (item: PieceItem, settings: ListSettings, data: D) => {
    const picked = picks.picked(settings, data);
    return litBy(picked, item.paper, item.id, data).map((i) => picked[i]);
  };

  /** The entries of the picked names' works in a reference list's `text`, in order, each with its pick's colour. */
  function entrySpans(item: PieceItem, text: string, settings: ListSettings, data: D) {
    if (item.section !== REFERENCES_SECTION) return [];
    const picked = picks.picked(settings, data);
    return litBy(picked, item.paper, item.id, data)
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

  function drawFinder({ settings, data, onChange, travelTo, input, lists }: Finder<D>): void {
    lists.replaceChildren();
    if (!data) {
      lists.append(pickNote(`Loading the ${noun.many}…`));
      return;
    }
    const picked = picks.picked(settings, data);
    const colors = colorsOf(picked);
    const isPicked = (entry: Entry) => picked.some((p) => p.name === entry.name);
    const full = picked.length >= MAX_PICKS;
    const choose = (entry: Entry, how: Exclude<PickHow, 'unpick'>) => {
      input.value = '';
      trackOverlayPick(kind.id, entry.label, how);
      onChange(addPick(entry.name));
    };
    const unpick = (entry: Entry) => {
      trackOverlayPick(kind.id, entry.label, 'unpick');
      onChange(removePick(entry.name));
    };

    if (input.value.trim()) {
      const found = picks.suggest(data, input.value, picked);
      lists.append(
        full || !found.length
          ? pickSuggestions(1, () =>
              pickNote(
                full ? `${MAX_PICKS} at most: unpick one first.` : `No ${noun.one} by that name.`,
              ),
            )
          : pickSuggestions(found.length, (i) =>
              pickRow(linesOf(found[i]), () => choose(found[i], 'typed')),
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
            onRemove: () => unpick(entry),
          })),
        ),
      );
    const chips = pickChips(
      picks.quick(data).map((entry) =>
        pickChip(entry.label, {
          title: `${entry.label} · ${papers(entry.papers)}`,
          on: isPicked(entry),
          disabled: full && !isPicked(entry),
          onClick: () => (isPicked(entry) ? unpick(entry) : choose(entry, 'quick')),
        }),
      ),
    );
    lists.append(
      ...pickQuick(
        kind.quickHeading ?? 'Most papers',
        [chips],
        picked.length ? paperList(picked, colors, data, travelTo) : [],
      ),
    );
  }

  /** The papers the picks light, in program order; a click on one pins its first lit square and brings it into view. */
  function paperList(
    picked: readonly Picked[],
    colors: readonly Color[],
    data: D,
    travelTo: (id: string) => void,
  ): HTMLElement[] {
    const listed = data.structure.days.flatMap((day) =>
      day.sessions.flatMap((session) =>
        session.papers.flatMap((paper) => {
          const lit = [...paper.pieces].flatMap((_, n) => {
            const id = pieceId(paper.index, n);
            const under = litBy(picked, paper, id, data);
            return under.length ? [{ id, under }] : [];
          });
          if (!lit.length) return [];
          const under = [...new Set(lit.flatMap((square) => square.under))].sort((a, b) => a - b);
          return [{ paper, session, under, first: lit[0].id }];
        }),
      ),
    );
    if (!listed.length) return [];
    const { box, list } = pickResultsBox(paperCount(listed.length));
    createResultsList<(typeof listed)[number]>().render(
      list,
      listed,
      ({ paper, session, under, first }) => ({
        colors: under.map((i) => colors[i]),
        ref: paper.title,
        snippet: document.createTextNode([paper.when, session.name].filter(Boolean).join(' · ')),
        onSelect: () => travelTo(first),
      }),
    );
    return [box];
  }

  const finderIn = (container: HTMLElement): Finder<D> =>
    pickFinderIn<Finder<D>>(container, {
      placeholder: `Find ${aNoun} by name…`,
      label: `Find ${aNoun}`,
      extend: (parts) => ({
        ...parts,
        settings: { picked: [] },
        data: null,
        onChange: () => {},
        travelTo: () => {},
      }),
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

    colorsFor({ items, settings, data }) {
      const picked = picks.picked(settings, data);
      if (!picked.length) return items.map(baseColor);
      const colors = colorsOf(picked);
      return items.map((item) => {
        const lit = litBy(picked, item.paper, item.id, data).map((i) => colors[i]);
        if (!lit.length) return unlit(item);
        const shown = isPlaceholder(item) ? lit.map((c) => brighten(c, PLACEHOLDER_KEEPS)) : lit;
        return shown.length === 1 ? shown[0] : shown;
      });
    },

    standoutsFor({ items, settings, data }) {
      const picked = picks.picked(settings, data);
      return items.map((item) => litBy(picked, item.paper, item.id, data).length > 0);
    },

    renderControls(container, settings, onChange, data, travelTo) {
      const finder = finderIn(container);
      Object.assign(finder, { settings, data, onChange, travelTo });
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
