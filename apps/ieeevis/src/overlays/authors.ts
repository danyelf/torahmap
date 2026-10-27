// Lights every paper by the authors a reader picks, each author in a colour of their own.

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
import { STRUCTURE_FILE } from '../data.ts';
import type { PieceItem } from '../layout.ts';
import {
  pickedAuthors,
  quickPicks,
  suggest,
  wroteIt,
  type Author,
  type AuthorData,
  type AuthorSettings,
} from './authorPicks.ts';

export const AUTHORS_ID = 'authors';
export const AUTHORS_URL_PARAMS = [
  { key: 'authors', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

/** How much of its colour a paper keeps when none of the picked authors wrote it. */
const UNLIT_KEEPS = 0.35;

const papers = (n: number) => `${n} paper${n === 1 ? '' : 's'}`;

interface Finder extends PickFinder {
  settings: AuthorSettings;
  data: AuthorData | null;
  onChange(update: SettingsUpdate<AuthorSettings>): void;
}

const finders = new WeakMap<PickFinder, Finder>();

function drawFinder({ settings, data, onChange, input, lists }: Finder): void {
  lists.replaceChildren();
  if (!data) {
    lists.append(pickNote('Loading the authors…'));
    return;
  }
  const picked = pickedAuthors(settings, data);
  const colors = pickColors(picked.length);
  const full = picked.length >= MAX_PICKS;
  const choose = (author: Author) => {
    input.value = '';
    onChange(addPick(author.name));
  };

  if (input.value.trim()) {
    const found = suggest(data, input.value, picked);
    const box = document.createElement('div');
    box.className = 'pick-suggestions';
    if (full) box.append(pickNote(`${MAX_PICKS} at most: unpick one first.`));
    else if (!found.length) box.append(pickNote('No author by that name.'));
    else
      for (const author of found)
        box.append(pickRow([author.name, pickMeta(papers(author.papers))], () => choose(author)));
    lists.append(box);
  }

  if (picked.length)
    lists.append(
      pickedList(
        picked.map((author, i) => ({
          color: colors[i],
          text: [author.name, pickMeta(papers(author.papers))],
          removeTitle: `Unpick ${author.name}`,
          onRemove: () => onChange(removePick(author.name)),
        })),
      ),
    );

  const quick = document.createElement('div');
  const heading = document.createElement('div');
  heading.className = 'panel-section-heading';
  heading.textContent = 'Most papers';
  const chips = document.createElement('div');
  chips.className = 'pick-chips';
  for (const author of quickPicks(data)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pick-chip';
    chip.textContent = author.name;
    chip.title = papers(author.papers);
    chip.classList.toggle('on', picked.includes(author));
    chip.disabled = full || picked.includes(author);
    chip.addEventListener('click', () => choose(author));
    chips.append(chip);
  }
  quick.append(heading, chips);
  lists.append(quick);
}

function finderIn(container: HTMLElement): Finder {
  const base: PickFinder = pickFinderIn(container, {
    placeholder: 'Find an author by name…',
    label: 'Find an author',
    onType: () => drawFinder(finders.get(base)!),
  });
  const known = finders.get(base);
  if (known) return known;
  const finder: Finder = { ...base, settings: { picked: [] }, data: null, onChange: () => {} };
  finders.set(base, finder);
  return finder;
}

const unlit = (item: PieceItem): Color => brighten(baseColor(item), UNLIT_KEEPS);

export const authorsOverlay: Overlay<PieceItem, AuthorSettings, AuthorData> = {
  id: AUTHORS_ID,
  name: 'Authors',
  description:
    'Lights every paper by the authors you pick, each author in a color of their own; the rest of the map dims. A paper by two of them is split between their colors.',
  data: { structure: STRUCTURE_FILE },

  urlParams: AUTHORS_URL_PARAMS,
  settingsFromUrl: (params) => ({ picked: picksFromUrl(params.authors) }),
  settingsToUrl: ({ picked }) =>
    Object.fromEntries(picked.length ? [['authors', picksToUrl(picked)]] : []),

  colorsFor(items, settings, _hovered, data) {
    const picked = pickedAuthors(settings, data);
    if (!picked.length) return items.map(baseColor);
    const colors = pickColors(picked.length);
    return items.map((item) => {
      const lit = wroteIt(picked, item.paper.authors).map((i) => colors[i]);
      if (!lit.length) return unlit(item);
      return lit.length === 1 ? lit[0] : lit;
    });
  },

  standoutsFor(items, settings, data) {
    const picked = pickedAuthors(settings, data);
    return items.map((item) => wroteIt(picked, item.paper.authors).length > 0);
  },

  renderControls(container, settings, onChange, data) {
    const finder = finderIn(container);
    Object.assign(finder, { settings, data, onChange });
    drawFinder(finder);
  },

  renderLegend(container, settings, data) {
    if (!data) return;
    const picked = pickedAuthors(settings, data);
    if (!picked.length) {
      container.innerHTML = `<div class="legend-row">Pick an author to light their papers.</div>`;
      return;
    }
    const colors = pickColors(picked.length);
    container.replaceChildren(
      ...picked.map((author, i) => {
        const line = document.createElement('div');
        line.className = 'legend-row';
        line.append(pickSwatch(colors[i]), author.name);
        return line;
      }),
    );
    const rest = document.createElement('div');
    rest.className = 'legend-row';
    rest.append(pickSwatch(brighten(TEXT, UNLIT_KEEPS)), 'Papers by none of them');
    container.append(rest);
  },

  summary(settings, data) {
    const picked = pickedAuthors(settings, data);
    if (!picked.length) return { detail: 'pick an author' };
    return {
      detail: picked.length === 1 ? picked[0].name : `${picked.length} authors`,
      colors: pickColors(picked.length).map(colorToCss),
    };
  },

  getHoverInfo(item, settings, data) {
    const picked = pickedAuthors(settings, data);
    const names = wroteIt(picked, item.paper.authors).map((i) => picked[i].name);
    return names.length ? names.join(', ') : null;
  },
};
