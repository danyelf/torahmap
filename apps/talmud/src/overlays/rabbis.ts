// Lights every passage that names the rabbis a reader picks, each rabbi in a colour of his own.

import './rabbis.css';
import type { Overlay, SettingsUpdate, UrlParamSpec } from '@torahmap/shell/overlays/types.ts';
import { HEBREW } from '@torahmap/shell/language.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { colorToCss, type Color } from '@torahmap/utils';
import { RABBIS_FILE, type Rabbi } from '../rabbis.ts';
import { DATING_FILE } from '../dating.ts';
import type { TalmudLayoutItem } from '../layout.ts';
import { GEMARA_BASE_COLOR, SEARCH_KEEPS_BASE } from '../constants.ts';
import {
  fadeTo,
  generationLabel,
  markNames,
  nameFor,
  row,
  yearsShort,
  type RabbiLink,
} from './dating.ts';
import {
  MAX_COLORS,
  MAX_PICKS,
  namedIn,
  passagesOf,
  pickColors,
  pickedPlaces,
  picksFromUrl,
  picksToUrl,
  quickPicks,
  readingOf,
  suggest,
  type Entry,
  type RabbiData,
  type RabbiSettings,
} from './rabbiPicks.ts';

export const RABBIS_ID = 'rabbis';
export const RABBIS_URL_PARAMS = [
  { key: 'rabbis', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

/** How much of a rabbi's colour a passage keeps when a name there only might be him. */
const MAYBE_KEEPS = 0.8;

export const addPick = (id: string): SettingsUpdate<RabbiSettings> =>
  function (current) {
    return current.picked.includes(id)
      ? current
      : { picked: [...current.picked, id].slice(-MAX_PICKS) };
  };

const removePick = (id: string): SettingsUpdate<RabbiSettings> =>
  function (current) {
    return { picked: current.picked.filter((p) => p !== id) };
  };

const faded = (color: Color): Color => fadeTo(color, MAYBE_KEEPS);

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "1273 passages", "21 passages, 91 unsure", "91 unsure passages". */
function passageCounts(sure: number, maybe: number): string {
  if (!sure) return `${count(maybe, 'unsure passage')}`;
  return maybe ? `${count(sure, 'passage')}, ${maybe} unsure` : count(sure, 'passage');
}

const span = (className: string, text: string, lang?: string): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  if (lang) {
    element.lang = lang;
    element.dir = 'rtl';
  }
  return element;
};

const swatch = (color: Color): HTMLSpanElement => {
  const element = span('swatch', '');
  element.style.background = colorToCss(color);
  return element;
};

/** What the finder keeps between drawings, per container it is drawn into. */
interface Finder {
  root: HTMLElement;
  input: HTMLInputElement;
  lists: HTMLElement;
  /** The shared name the reader is choosing a person for. */
  asking: Entry | null;
  draw(): void;
  settings: RabbiSettings;
  data: RabbiData | null;
  onChange(update: SettingsUpdate<RabbiSettings>): void;
}

const finders = new WeakMap<HTMLElement, Finder>();

/** The overlay for a Talmud whose passages `base` colours when no tool does. */
export function rabbisOverlay(
  base: (item: TalmudLayoutItem) => Color,
  link: RabbiLink,
): Overlay<TalmudLayoutItem, RabbiSettings, RabbiData> {
  const unlit = (item: TalmudLayoutItem): Color => fadeTo(base(item), SEARCH_KEEPS_BASE);

  /** The colours to draw a passage in: one when one picked rabbi is named there, else a split. */
  function colorsOf(
    items: readonly TalmudLayoutItem[],
    settings: RabbiSettings,
    data: RabbiData,
  ): (Color | Color[])[] {
    const places = pickedPlaces(settings, data);
    if (!places.length) return items.map(base);
    const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
    return items.map((item) => {
      const dim = unlit(item);
      const named = namedIn(data, item.id, places);
      const drawn = places.flatMap((place, i) => {
        const how = named.get(place);
        if (!how) return [];
        return [how === 'sure' ? colors[i] : faded(colors[i])];
      });
      if (!drawn.length) return dim;
      return drawn.length === 1 ? drawn[0] : drawn.slice(0, MAX_COLORS);
    });
  }

  const rabbiLine = (rabbi: Rabbi): HTMLElement => {
    const line = document.createElement('span');
    line.className = 'rabbi-line';
    line.append(span('rabbi-en', rabbi.en), ' ', span('rabbi-he', rabbi.he, 'he'));
    return line;
  };

  /** A rabbi as a row to choose: his names, generation and how often he is named. */
  function rabbiRow(
    data: RabbiData,
    place: number,
    onClick: () => void,
    matched: string | null = null,
  ): HTMLButtonElement {
    const rabbi = data.rabbis.rabbis[place];
    const { sure, maybe } = passagesOf(data, place);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'rabbi-row';
    const meta = [generationLabel(rabbi.gen, true), passageCounts(sure, maybe)];
    row.append(rabbiLine(rabbi), span('rabbi-meta', meta.join(' · ')));
    if (matched) row.append(span('rabbi-meta', `also written ${matched.replace(/^#/, '')}`));
    row.addEventListener('click', onClick);
    return row;
  }

  function drawFinder(finder: Finder): void {
    const { settings, data, onChange, lists } = finder;
    lists.replaceChildren();
    if (!data) {
      lists.append(span('rabbi-note', 'Loading the rabbis…'));
      return;
    }
    const places = pickedPlaces(settings, data);
    const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
    const full = places.length >= MAX_PICKS;
    const pick = (place: number) => {
      finder.input.value = '';
      finder.asking = null;
      onChange(addPick(data.rabbis.rabbis[place].id));
    };

    const typed = finder.input.value;
    if (finder.asking) {
      const who = document.createElement('div');
      who.className = 'rabbi-which';
      const heading = document.createElement('div');
      heading.className = 'panel-section-heading';
      heading.textContent = `Which ${finder.asking.en}?`;
      const back = document.createElement('button');
      back.type = 'button';
      back.className = `${CONTROL.icon} rabbi-back`;
      back.textContent = '×';
      back.title = 'Choose another';
      back.addEventListener('click', () => {
        finder.asking = null;
        finder.draw();
      });
      heading.append(back);
      who.append(heading);
      const candidates = finder.asking.rabbis.filter((p) => !places.includes(p));
      for (const place of candidates) who.append(rabbiRow(data, place, () => pick(place)));
      lists.append(who);
    } else if (typed.trim()) {
      const found = suggest(data, typed, places);
      const box = document.createElement('div');
      box.className = 'rabbi-suggestions';
      if (full) box.append(span('rabbi-note', `${MAX_PICKS} at most: unpick one first.`));
      else if (!found.length) box.append(span('rabbi-note', 'No rabbi by that name.'));
      else
        for (const { place, matched } of found)
          box.append(rabbiRow(data, place, () => pick(place), matched));
      lists.append(box);
    }

    if (places.length) {
      const chosen = document.createElement('div');
      chosen.className = 'rabbi-picked';
      places.forEach((place, i) => {
        const rabbi = data.rabbis.rabbis[place];
        const { sure, maybe } = passagesOf(data, place);
        const row = document.createElement('div');
        row.className = 'rabbi-picked-row';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = `${CONTROL.icon}`;
        remove.textContent = '×';
        remove.title = `Unpick ${rabbi.en}`;
        remove.addEventListener('click', () => onChange(removePick(rabbi.id)));
        const text = document.createElement('div');
        text.className = 'rabbi-picked-text';
        text.append(rabbiLine(rabbi), span('rabbi-meta', passageCounts(sure, maybe)));
        row.append(swatch(colors[i]), text, remove);
        chosen.append(row);
      });
      lists.append(chosen);
    }

    const quick = document.createElement('div');
    quick.className = 'rabbi-quick';
    const heading = document.createElement('div');
    heading.className = 'panel-section-heading';
    heading.textContent = 'Most named';
    quick.append(heading);
    for (const { heading: era, entries } of quickPicks(data)) {
      const group = document.createElement('div');
      group.className = 'rabbi-era';
      group.append(span('rabbi-era-name', era));
      const chips = document.createElement('div');
      chips.className = 'rabbi-chips';
      for (const entry of entries) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'rabbi-chip';
        chip.textContent = entry.single ? entry.en : `${entry.en}…`;
        chip.title = entry.single
          ? count(entry.named, 'passage')
          : `${count(entry.named, 'passage')} name this, and it can mean several people`;
        const already = entry.single && places.includes(entry.rabbis[0]);
        chip.classList.toggle('on', already);
        const unpicked = entry.rabbis.filter((p) => !places.includes(p));
        chip.disabled = full || unpicked.length === 0;
        chip.addEventListener('click', () => {
          if (entry.single) pick(entry.rabbis[0]);
          else {
            finder.asking = entry;
            finder.draw();
          }
        });
        chips.append(chip);
      }
      group.append(chips);
      quick.append(group);
    }
    lists.append(quick);
  }

  function finderIn(container: HTMLElement): Finder {
    const known = finders.get(container);
    if (known?.root.isConnected && container.contains(known.root)) return known;
    const root = document.createElement('div');
    root.className = 'rabbi-finder';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = `${CONTROL.input} rabbi-input`;
    input.placeholder = 'Find a rabbi by any of his names…';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Find a rabbi');
    const lists = document.createElement('div');
    lists.className = 'rabbi-lists';
    root.append(input, lists);
    container.replaceChildren(root);
    const finder: Finder = {
      root,
      input,
      lists,
      asking: null,
      settings: { picked: [] },
      data: null,
      onChange: () => {},
      draw: () => drawFinder(finder),
    };
    input.addEventListener('input', () => {
      finder.asking = null;
      finder.draw();
    });
    finders.set(container, finder);
    return finder;
  }

  return {
    id: RABBIS_ID,
    name: 'Rabbis',
    description:
      'Lights every passage that names the rabbis you pick, each rabbi in a color of his own. ' +
      'A passage naming two of them is split between their colors. A faded passage names someone ' +
      'who could be that rabbi, among others.',
    credits: [
      {
        source: 'Sefaria, people tagged in the Talmud',
        url: 'https://www.sefaria.org/topics',
        note: 'Which rabbis a segment names, and every name Sefaria records for them, from its topics.',
        collected: 'October 2026',
      },
    ],
    data: { dating: DATING_FILE, rabbis: RABBIS_FILE },

    urlParams: RABBIS_URL_PARAMS,
    settingsFromUrl: (params) => ({ picked: picksFromUrl(params.rabbis) }),
    settingsToUrl: ({ picked }) =>
      Object.fromEntries(picked.length ? [['rabbis', picksToUrl(picked)]] : []),

    getItemColor: (item, settings, data) => colorsOf([item], settings, data)[0],
    colorsFor: (items, settings, _hovered, data) => colorsOf(items, settings, data),
    standoutsFor(items, settings, data) {
      const places = pickedPlaces(settings, data);
      return items.map((item) => namedIn(data, item.id, places).size > 0);
    },

    renderControls(container, settings, onChange, data) {
      const finder = finderIn(container);
      Object.assign(finder, { settings, data, onChange });
      finder.draw();
    },

    renderLegend(container, settings, data) {
      if (!data) return;
      const places = pickedPlaces(settings, data);
      if (!places.length) {
        container.innerHTML = `<div class="legend-row">Pick a rabbi to light the passages that name him.</div>`;
        return;
      }
      const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
      container.innerHTML = [
        ...places.map((place, i) => row(colors[i], data.rabbis.rabbis[place].en)),
        row(faded(colors[0]), 'Faded: a name that might be him'),
        row(fadeTo(GEMARA_BASE_COLOR, SEARCH_KEEPS_BASE), 'Names none of them'),
      ].join('');
    },

    summary(settings, data) {
      const places = pickedPlaces(settings, data);
      const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
      if (!places.length) return { detail: 'pick a rabbi' };
      // Names would not fit beside the overlay's own on a phone.
      return {
        detail:
          places.length === 1 ? data.rabbis.rabbis[places[0]].en : count(places.length, 'rabbi'),
        colors: colors.map(colorToCss),
      };
    },

    getHoverInfo(item, settings, data) {
      const places = pickedPlaces(settings, data);
      const named = namedIn(data, item.id, places);
      if (!named.size) return null;
      return [...named]
        .map(([place, how]) => data.rabbis.rabbis[place].en + (how === 'maybe' ? '?' : ''))
        .join(', ');
    },

    renderSidebarInfo(item, isPinned, settings, data) {
      const segment = data.dating.segments[item.id];
      if (!isPinned || !segment) return null;
      const places = pickedPlaces(settings, data);
      const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
      const box = document.createElement('div');
      const seen = new Set<string>();
      for (const person of segment[2]) {
        const { sure, who } = readingOf(data.rabbis, person);
        const entry = document.createElement('span');
        entry.className = 'rabbi-entry';
        if (sure && who.length === 1) {
          const rabbi = data.rabbis.rabbis[who[0]];
          if (seen.has(rabbi.id)) continue;
          seen.add(rabbi.id);
          const at = places.indexOf(who[0]);
          if (at >= 0) entry.append(swatch(colors[at]));
          entry.classList.toggle('picked', at >= 0);
          const era = data.dating.generations.find((g) => g.code === rabbi.gen);
          const when = generationLabel(rabbi.gen, true) + (era ? `, ${yearsShort(era)}` : '');
          entry.append(
            nameFor(rabbi.en, rabbi.id, link),
            ' · ',
            span('', rabbi.he, 'he'),
            ` (${when})`,
          );
        } else {
          const name = data.dating.people[person];
          if (seen.has(name.id)) continue;
          seen.add(name.id);
          entry.append(`${name.en} · `, span('', name.he, 'he'), ' ?');
        }
        box.append(entry);
      }
      return box;
    },

    highlightItemText(item, text, language, settings, data) {
      const fragment = document.createDocumentFragment();
      fragment.append(text);
      const segment = data.dating.segments[item.id];
      const places = pickedPlaces(settings, data);
      if (language !== HEBREW || !segment || !places.length) return fragment;
      const colors = pickColors(places.map((p) => data.rabbis.rabbis[p]));
      return markNames(fragment, text, segment[3], (person) => {
        const { sure, who } = readingOf(data.rabbis, person);
        const at = places.findIndex((p) => who.includes(p));
        if (at < 0) return null;
        return sure ? colors[at] : faded(colors[at]);
      });
    },
  };
}
