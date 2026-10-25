// The trop overlay: colours, the mark chart, and marking a mark inside a verse.
//
// The presentation half of the trop feature. What the marks are and which
// verses carry them is in trop/marks.ts.

import {
  type Color,
  lingeringHover,
  colorToCss,
  memoByValue,
  memoByValueAndKey,
  oklchToRgb,
} from '@torahmap/utils';
import './trop.css';
import type { Overlay, UrlParamValues, SettingsUpdate } from '@torahmap/shell/overlays/types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { verseId } from '@torahmap/link/tanakh';
import { isNikkud } from '@torahmap/hebrew';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getRarityTier,
  offers,
  marksByGroup,
  nameIn,
  otherName,
  signPositions,
  signsOf,
  slugOf,
  SYSTEM_INFO,
  SYSTEMS,
  systemOf,
  type RarityTier,
  type System,
  type TropIndexEntry,
  type TropMark,
} from './trop/marks.ts';
import { legendCaption, legendRow } from './legend.ts';
import { TROP } from '@torahmap/overlay-catalog';

/**
 * The tab the chart shows; the mark clicked, and the mark the pointer is over
 * in the chart, each named by its URL slug. The map shows the hovered mark
 * while there is one; the tab and the clicked mark go into a link.
 */
export interface TropSettings {
  readonly tab: System;
  readonly mark: string | null;
  readonly preview: string | null;
}

/** The mark the map shows, if the tab offers it. */
function shownMark(settings: TropSettings): string | null {
  const slug = settings.preview ?? settings.mark;
  return slug && offers(settings.tab, slug) ? slug : null;
}

export interface TropData {
  texts: VerseTexts;
}

/** Every mark and the verses that carry it, by URL slug; once per data value. */
const marksOf = memoByValue((data: TropData) => buildTropIndex(data.texts));

function entryFor(data: TropData, mark: string | null): TropIndexEntry | null {
  return (mark && marksOf(data).get(mark)) || null;
}

// A verse without the mark, at every tier.
export const NO_MATCH_COLOR: Color = [0.25, 0.25, 0.25];

// A mark drawn by count has four steps, for 1, 2, 3 and 4 or more occurrences in
// a verse. They are picked in OKLCH, so each is as far from the next as the eye
// sees: equal steps in lightness, drifting in hue from violet-magenta through
// pink to pale peach. The first is well clear of NO_MATCH_COLOR; a darker one
// vanished when zoomed out.
const COUNT_STEPS: { label: string; color: Color }[] = [
  { label: '1', color: oklchToRgb(0.588, 0.181, 328) },
  { label: '2', color: oklchToRgb(0.7, 0.15, 345) },
  { label: '3', color: oklchToRgb(0.82, 0.1, 5) },
  { label: '4+', color: oklchToRgb(0.93, 0.03, 45) },
];

function stepFor(count: number): Color {
  return COUNT_STEPS[Math.min(count, COUNT_STEPS.length) - 1].color;
}

// A mark drawn as present or absent, and the verse highlight, are the brightest step.
export const RARE_MATCH_COLOR: Color = COUNT_STEPS[COUNT_STEPS.length - 1].color;

/** The key's colours, as CSS: "contains" and "does not" swatches, or the count steps. */
type TropLegend =
  | { kind: 'swatches'; contains: string; without: string }
  | { kind: 'steps'; steps: { color: string; label: string }[] };

interface TropDerivation {
  entry: TropIndexEntry;
  tier: RarityTier;
  verseLookup: Map<string, number>;
  /** A verse's colour, from how many times it carries the mark. */
  colorOf: (count: number) => Color;
  legend: TropLegend;
}

/** The colours and lookup table for one trop mark, named by its URL slug. */
function deriveTrop(data: TropData, mark: string | null): TropDerivation | null {
  const entry = entryFor(data, mark);
  if (!entry) return null;

  const verseLookup = new Map<string, number>();
  for (const loc of entry.verses) {
    verseLookup.set(verseId(loc.book, loc.chapter, loc.verse), loc.count);
  }

  const tier = getRarityTier(entry.totalCount);
  if (tier === 'rare') {
    const match = RARE_MATCH_COLOR;
    return {
      entry,
      tier,
      verseLookup,
      colorOf: (count) => (count ? match : NO_MATCH_COLOR),
      legend: {
        kind: 'swatches',
        contains: colorToCss(match),
        without: colorToCss(NO_MATCH_COLOR),
      },
    };
  }
  return {
    entry,
    tier,
    verseLookup,
    colorOf: (count) => (count ? stepFor(count) : NO_MATCH_COLOR),
    legend: {
      kind: 'steps',
      steps: COUNT_STEPS.map(({ label, color }) => ({ label, color: colorToCss(color) })),
    },
  };
}

const derivationOf = memoByValueAndKey(deriveTrop);

function derivationFor(data: TropData, settings: TropSettings): TropDerivation | null {
  return derivationOf(data, shownMark(settings));
}

/** What the tab calls the mark that is shown. */
function shownName(derived: TropDerivation, settings: TropSettings): string {
  return nameIn(derived.entry.mark, settings.tab).name;
}

function countAt(verse: TanakhLayout, derived: TropDerivation): number {
  return derived.verseLookup.get(verse.id) ?? 0;
}

function tropColorAt(verse: TanakhLayout, derived: TropDerivation | null): Color | null {
  return derived && derived.colorOf(countAt(verse, derived));
}

function markButton(mark: TropMark, system: System): HTMLButtonElement {
  const { name, hebrewName } = nameIn(mark, system);
  const other = otherName(mark, system);
  const button = document.createElement('button');
  button.dataset.slug = slugOf(mark);
  button.innerHTML = `
    <span class="trop-sign">ב${signsOf(mark, system)[0]}</span>
    <span class="trop-labels">
      <span class="trop-name">${name}</span>
      <span class="trop-hebrew-name"><span lang="he">${hebrewName}</span>${
        other ? ` <span class="trop-other-name">[${other}]</span>` : ''
      }</span>
    </span>`;
  return button;
}

/**
 * Draw the mark chart for `settings`, or bring an already-drawn chart's
 * selection up to date. Built once per container; a redraw only toggles which
 * tab is shown and which buttons are marked selected.
 */
function renderTropChart(
  container: HTMLElement,
  settings: TropSettings,
  onChange: (update: SettingsUpdate<TropSettings>) => void,
  data: TropData | null,
): void {
  if (!data) return;
  if (!container.querySelector('.trop-chart')) {
    container.innerHTML = `
      <div class="trop-controls">
        <div class="trop-tabs" role="tablist"></div>
        <div class="trop-chart"></div>
      </div>
    `;
    const tabs = container.querySelector('.trop-tabs')!;
    const chart = container.querySelector('.trop-chart')!;
    const preview = lingeringHover<string>((slug) =>
      onChange((current) => ({ ...current, preview: slug })),
    );

    for (const system of SYSTEMS) {
      const tab = document.createElement('button');
      tab.setAttribute('role', 'tab');
      tab.dataset.tab = system;
      tab.textContent = SYSTEM_INFO[system].label;
      tab.addEventListener('click', () =>
        onChange((current) => ({
          ...current,
          tab: system,
          preview: null,
          mark: current.mark && offers(system, current.mark) ? current.mark : null,
        })),
      );
      tabs.appendChild(tab);

      const panel = document.createElement('div');
      panel.dataset.tab = system;
      const intro = document.createElement('p');
      intro.className = 'trop-intro';
      intro.textContent = SYSTEM_INFO[system].intro;
      panel.appendChild(intro);
      for (const { group, marks } of marksByGroup(system)) {
        const heading = document.createElement('h4');
        heading.innerHTML = `${group.title} <span>${group.blurb}</span>`;
        const grid = document.createElement('div');
        grid.className = 'trop-grid';
        for (const mark of marks) {
          const button = markButton(mark, system);
          const slug = slugOf(mark);
          button.addEventListener('mouseenter', () => preview.enter(slug));
          button.addEventListener('mouseleave', () => preview.leave());
          button.addEventListener('click', () =>
            onChange((current) => ({ ...current, mark: current.mark === slug ? null : slug })),
          );
          grid.appendChild(button);
        }
        panel.append(heading, grid);
      }
      chart.appendChild(panel);
    }
  }

  container.querySelectorAll<HTMLElement>('[data-tab]').forEach((element) => {
    const shown = element.dataset.tab === settings.tab;
    if (element.matches('button')) {
      element.setAttribute('aria-selected', String(shown));
      element.classList.toggle('selected', shown);
    } else {
      element.hidden = !shown;
    }
  });
  container.querySelectorAll<HTMLButtonElement>('.trop-grid button').forEach((button) => {
    button.classList.toggle('selected', button.dataset.slug === settings.mark);
  });
}

export const tropOverlay: Overlay<TanakhIdentity, TropSettings, TropData> = {
  ...TROP,
  data: { texts: TEXTS_FILE },

  prebuild(data) {
    marksOf(data);
  },

  getItemColor(verse, settings, data) {
    return tropColorAt(verse, derivationFor(data, settings));
  },

  colorsFor(items, settings, _hovered, data) {
    const derived = derivationFor(data, settings);
    return items.map((item) => tropColorAt(item, derived));
  },

  standoutsFor(items, settings, data) {
    const derived = derivationFor(data, settings);
    if (derived?.tier !== 'rare') return items.map(() => false);
    return items.map((item) => countAt(item, derived) > 0);
  },

  settingsFromUrl(params: UrlParamValues<typeof TROP.urlParams>): TropSettings {
    return { tab: params.tab, mark: params.trop ?? null, preview: null };
  },

  settingsToUrl(settings: TropSettings): Record<string, string> {
    return {
      ...(settings.mark ? { trop: settings.mark } : {}),
      tab: settings.tab,
    };
  },

  renderControls(container, settings, onChange, data) {
    renderTropChart(container, settings, onChange, data);
  },

  renderLegend(container, settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const derived = derivationFor(data, settings);
    if (!derived) {
      container.innerHTML = legendCaption('Select a trop mark above');
      return;
    }

    const { legend } = derived;
    if (legend.kind === 'swatches') {
      container.innerHTML =
        legendRow(legend.contains, `Contains ${shownName(derived, settings)}`) +
        legendRow(legend.without, 'Does not contain');
    } else {
      container.innerHTML = `
        <div class="trop-steps">${legend.steps
          .map(
            ({ color, label }) =>
              `<span class="trop-step"><i style="background: ${color}"></i>${label}</span>`,
          )
          .join('')}</div>
      `;
    }
  },

  summary(settings, data) {
    const slug = shownMark({ ...settings, preview: null });
    const derived = derivationOf(data, slug);
    if (!derived) return {};
    const detail = shownName(derived, settings);
    const { legend } = derived;
    return legend.kind === 'swatches'
      ? { detail, colors: [legend.contains] }
      : { detail, steps: legend.steps };
  },

  getHoverInfo(verse, settings, data) {
    const derived = derivationFor(data, settings);
    if (!derived) return null;
    const count = countAt(verse, derived);
    return count ? `${shownName(derived, settings)} ×${count}` : null;
  },

  highlightItemText(verse, text: string, language: TextLanguage, settings, data): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const derived = derivationFor(data, settings);
    if (language !== HEBREW || !derived) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const holder = document.createElement('div');
    const signs = signsOf(derived.entry.mark, systemOf(verse.book, verse.chapter, verse.verse));
    holder.innerHTML = highlightTropInText(text, signs);
    fragment.append(...holder.childNodes);
    return fragment;
  },
};

// Wraps each of `signs` together with its base letter and any other combining
// marks between them (Hebrew points/accents, U+0591-U+05C7), so the <mark>
// highlights a whole grapheme instead of just the trop character.
export function highlightTropInText(hebrewText: string, signs: readonly string[]): string {
  const positions = signPositions(hebrewText, signs);
  const result: string[] = [];

  for (let i = 0; i < hebrewText.length; i++) {
    const char = hebrewText[i];
    if (!positions.has(i)) {
      result.push(char);
      continue;
    }
    const highlighted: string[] = [];
    while (result.length > 0) {
      const last = result.pop()!;
      highlighted.unshift(last);
      if (!isNikkud(last.codePointAt(0) || 0)) break;
    }
    highlighted.push(char);
    result.push(
      `<mark class="trop-highlight" style="background: ${colorToCss(RARE_MATCH_COLOR)}">${highlighted.join('')}</mark>`,
    );
  }

  return result.join('');
}
