// Lights every passage that names the rabbis a reader picks, each rabbi in a colour of his own.

import './rabbis.css';
import type { Overlay, SettingsUpdate, UrlParamSpec } from '@torahmap/shell/overlays/types.ts';
import { HEBREW } from '@torahmap/shell/language.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { colorToCss, type Color } from '@torahmap/utils';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksToUrl,
  removePick,
  type PickSettings,
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
  pickSwatch,
  span,
  type PickFinder,
} from '@torahmap/shell/overlays/pickFinder.ts';
import { DATING_FILE, type Rabbi, type TalmudDating } from '../dating.ts';
import type { TalmudLayoutItem } from '../layout.ts';
import { GEMARA_BASE_COLOR, RABBIS_UNLIT_KEEPS } from '../constants.ts';
import { fadeTo, markNames, nameFor, row, type RabbiLink } from './dating.ts';
import {
  eraLine,
  namedIn,
  passagesOf,
  pickedPlaces,
  pickedSlots,
  quickPicks,
  readingOf,
  shortName,
  suggest,
  type Entry,
  type RabbiData,
} from './rabbiPicks.ts';

export const RABBIS_ID = 'rabbis';
export const RABBIS_URL_PARAMS = [
  { key: 'rabbis', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

/** How much of a rabbi's colour a passage keeps when a name there only might be him. */
const MAYBE_KEEPS = 0.8;

const faded = (color: Color): Color => fadeTo(color, MAYBE_KEEPS);

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "1273 passages", "21 passages, 91 unsure", "91 unsure passages". */
function passageCounts(sure: number, maybe: number): string {
  if (!sure) return count(maybe, 'unsure passage');
  return maybe ? `${count(sure, 'passage')}, ${maybe} unsure` : count(sure, 'passage');
}

/** What the finder keeps between drawings, per container it is drawn into. */
interface Finder extends PickFinder {
  /** The shared name the reader is choosing a person for. */
  asking: Entry | null;
  draw(): void;
  settings: PickSettings;
  data: RabbiData | null;
  onChange(update: SettingsUpdate<PickSettings>): void;
}

/** The overlay for a Talmud whose passages `base` colours when no tool does. */
export function rabbisOverlay(
  base: (item: TalmudLayoutItem) => Color,
  link: RabbiLink,
): Overlay<TalmudLayoutItem, PickSettings, RabbiData> {
  const unlit = (item: TalmudLayoutItem): Color => fadeTo(base(item), RABBIS_UNLIT_KEEPS);

  /** The colours to draw a passage in: one when one picked rabbi is named there, else a split. */
  function colorsOf(
    items: readonly TalmudLayoutItem[],
    settings: PickSettings,
    data: RabbiData,
  ): (Color | Color[])[] {
    const places = pickedPlaces(settings, data);
    if (!places.length) return items.map(base);
    const colors = pickColors(pickedSlots(settings, data));
    return items.map((item) => {
      const dim = unlit(item);
      const named = namedIn(data, item.id, places);
      const drawn = places.flatMap((place, i) => {
        const how = named.get(place);
        if (!how) return [];
        return [how === 'sure' ? colors[i] : faded(colors[i])];
      });
      if (!drawn.length) return dim;
      return drawn.length === 1 ? drawn[0] : drawn;
    });
  }

  /** A rabbi as every list of rabbis shows him: his names on one line, his generation and years under it. */
  const rabbiLine = (rabbi: Rabbi, dating: TalmudDating): HTMLElement => {
    const line = document.createElement('span');
    line.className = 'rabbi-line';
    const names = span('', '');
    names.append(span('rabbi-en', rabbi.en), ' ', span('rabbi-he', rabbi.he, 'he'));
    line.append(names, pickMeta(eraLine(rabbi, dating)));
    return line;
  };

  /** A rabbi as a row to choose: his names, generation and how often he is named. */
  function rabbiRow(
    data: RabbiData,
    place: number,
    onClick: () => void,
    matched: string | null = null,
  ): HTMLButtonElement {
    const rabbi = data.dating.rabbis[place];
    const { sure, maybe } = passagesOf(data, place);
    const lines = [rabbiLine(rabbi, data.dating), pickMeta(passageCounts(sure, maybe))];
    if (matched) lines.push(pickMeta(`also written ${matched.replace(/^#/, '')}`));
    return pickRow(lines, onClick);
  }

  function drawFinder(finder: Finder): void {
    const { settings, data, onChange, lists } = finder;
    lists.replaceChildren();
    if (!data) {
      lists.append(pickNote('Loading the rabbis…'));
      return;
    }
    const places = pickedPlaces(settings, data);
    const colors = pickColors(pickedSlots(settings, data));
    const full = places.length >= MAX_PICKS;
    const pick = (place: number) => {
      finder.input.value = '';
      finder.asking = null;
      onChange(addPick(data.dating.rabbis[place].id));
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
      back.setAttribute('aria-label', back.title);
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
      lists.append(
        pickSuggestions(
          full
            ? [pickNote(`${MAX_PICKS} at most: unpick one first.`)]
            : found.length
              ? found.map(({ place, matched }) => rabbiRow(data, place, () => pick(place), matched))
              : [pickNote('No rabbi by that name.')],
        ),
      );
    }

    if (places.length) {
      lists.append(
        pickedList(
          places.map((place, i) => {
            const rabbi = data.dating.rabbis[place];
            const { sure, maybe } = passagesOf(data, place);
            return {
              color: colors[i],
              text: [rabbiLine(rabbi, data.dating), pickMeta(passageCounts(sure, maybe))],
              removeTitle: `Unpick ${rabbi.en}`,
              onRemove: () => onChange(removePick(rabbi.id)),
            };
          }),
        ),
      );
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
      const chips = pickChips(
        entries.map((entry) =>
          pickChip(entry.single ? entry.en : `${entry.en}…`, {
            title: entry.single
              ? count(entry.named, 'passage')
              : `${count(entry.named, 'passage')} name this, and it can mean several people`,
            on: entry.single && places.includes(entry.rabbis[0]),
            disabled: entry.single
              ? full && !places.includes(entry.rabbis[0])
              : full || entry.rabbis.every((p) => places.includes(p)),
            onClick() {
              if (entry.single && places.includes(entry.rabbis[0]))
                onChange(removePick(data.dating.rabbis[entry.rabbis[0]].id));
              else if (entry.single) pick(entry.rabbis[0]);
              else {
                finder.asking = entry;
                finder.draw();
              }
            },
          }),
        ),
      );
      group.append(chips);
      quick.append(group);
    }
    lists.append(quick);
  }

  const finderIn = (container: HTMLElement): Finder =>
    pickFinderIn<Finder>(container, {
      placeholder: 'Find a rabbi by any of his names…',
      label: 'Find a rabbi',
      extend(parts) {
        const finder: Finder = {
          ...parts,
          asking: null,
          settings: { picked: [] },
          data: null,
          onChange: () => {},
          draw: () => drawFinder(finder),
        };
        return finder;
      },
      onType(finder) {
        finder.asking = null;
        finder.draw();
      },
    });

  return {
    id: RABBIS_ID,
    name: 'Rabbis',
    description:
      'Lights every passage that names the rabbis you pick, each rabbi in a color of his own; the rest of the map dims. ' +
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
    data: { dating: DATING_FILE },

    urlParams: RABBIS_URL_PARAMS,
    settingsFromUrl: (params) => ({ picked: picksFromUrl(params.rabbis) }),
    settingsToUrl: ({ picked }) =>
      Object.fromEntries(picked.length ? [['rabbis', picksToUrl(picked)]] : []),

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
      const colors = pickColors(pickedSlots(settings, data));
      container.innerHTML = [
        row(faded(colors[0]), 'Faded: a name that might be him'),
        row(fadeTo(GEMARA_BASE_COLOR, RABBIS_UNLIT_KEEPS), 'Names none of them'),
      ].join('');
      container.prepend(
        ...places.map((place, i) => {
          const line = document.createElement('div');
          line.className = 'legend-row';
          line.append(pickSwatch(colors[i]), rabbiLine(data.dating.rabbis[place], data.dating));
          return line;
        }),
      );
    },

    summary(settings, data) {
      const places = pickedPlaces(settings, data);
      const colors = pickColors(pickedSlots(settings, data));
      if (!places.length) return { detail: 'pick a rabbi' };
      // Names would not fit beside the overlay's own on a phone.
      return {
        detail:
          places.length === 1 ? data.dating.rabbis[places[0]].en : count(places.length, 'rabbi'),
        colors: colors.map(colorToCss),
      };
    },

    getHoverInfo(item, settings, data) {
      const places = pickedPlaces(settings, data);
      const named = namedIn(data, item.id, places);
      if (!named.size) return null;
      return [...named]
        .map(([place, how]) => shortName(data.dating.rabbis[place]) + (how === 'maybe' ? '?' : ''))
        .join(', ');
    },

    renderSidebarInfo(item, isPinned, settings, data) {
      const segment = data.dating.segments[item.id];
      if (!isPinned || !segment) return null;
      const places = pickedPlaces(settings, data);
      const colors = pickColors(pickedSlots(settings, data));
      const box = document.createElement('div');
      const seen = new Set<string>();
      for (const person of segment[2]) {
        const { sure, who } = readingOf(data.dating, person);
        const entry = document.createElement('span');
        entry.className = 'rabbi-entry';
        if (sure) {
          const rabbi = data.dating.rabbis[who[0]];
          if (seen.has(rabbi.id)) continue;
          seen.add(rabbi.id);
          const at = places.indexOf(who[0]);
          if (at >= 0) entry.append(pickSwatch(colors[at]));
          entry.classList.toggle('picked', at >= 0);
          entry.append(
            nameFor(rabbi.en, rabbi.id, link),
            ' · ',
            span('', rabbi.he, 'he'),
            ` (${eraLine(rabbi, data.dating)})`,
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
      const colors = pickColors(pickedSlots(settings, data));
      return markNames(fragment, text, segment[3], (person) => {
        const { sure, who } = readingOf(data.dating, person);
        const at = places.findIndex((p) => who.includes(p));
        if (at < 0) return null;
        return sure ? colors[at] : faded(colors[at]);
      });
    },
  };
}
