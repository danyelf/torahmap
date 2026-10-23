// Text analytics: each verse coloured by a measure of its wording,
// computed ahead of time by scripts/overlays/text-analytics/generate.ts.

import {
  type Color,
  type ColorStop,
  scale,
  LINEAR,
  type Scale,
  memoByValue,
} from '@torahmap/utils';
import type { Overlay, UrlParamValues } from '@torahmap/shell/overlays/types.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { axisGradient, legendCaption, renderAxis } from './legend.ts';
import { TEXT_ANALYTICS, TEXT_ANALYTICS_MEASURES } from '@torahmap/overlay-catalog';
import {
  HIGH_PERCENTILE,
  LOW_PERCENTILE,
  MEASURE_LABELS,
  SCORES_FILE,
  percent,
  percentile,
  type Measure,
  type ScoreParameters,
  type ScoresFile,
} from './text-analytics/scores.ts';
import { NO_DATA } from './colors.ts';

// Cividis, slate blue through grey to yellow: even in
// lightness, made to read the same with red-green colour blindness, and unlike
// any other overlay's scale. Its darkest quarter, navy, is left off: on the dark
// map it is hard to tell from a verse with no score.
const CIVIDIS_STOPS: ColorStop[] = [
  { t: 0, color: [0x41 / 255, 0x4d / 255, 0x6b / 255] },
  { t: 1 / 3, color: [0x7c / 255, 0x7b / 255, 0x78 / 255] },
  { t: 2 / 3, color: [0xbc / 255, 0xaf / 255, 0x6f / 255] },
  { t: 1, color: [0xff / 255, 0xea / 255, 0x46 / 255] },
];

export interface TextAnalyticsSettings {
  readonly measure: Measure;
}

export interface TextAnalyticsData {
  scores: ScoresFile;
}

const MEASURES: Record<
  Measure,
  {
    format: (v: number) => string;
    hover: (v: number) => string;
    // The scale's low and high ends, in the panel's legend and on the legend card.
    ends: [low: string, high: string];
    legend: (p: ScoreParameters, ends: [low: string, high: string]) => string[];
  }
> = {
  repetition: {
    format: percent,
    hover: (v) => `${percent(v)} of its words repeated nearby`,
    ends: ['varied', 'repetitive'],
    legend: (p, [low, high]) => [
      `How much of each verse repeats wording from nearby: the share of its words that belong to ` +
        `a ${p.runWords}-word phrase the book uses again within ${p.reachVerses} verses`,
      `Common idioms such as "thus says the LORD, God of Israel" (found in ${p.formulaBooks} or more books) don't count`,
      `Blue = ${low} wording · Yellow = ${high} wording`,
    ],
  },
};

function scoreAt(data: TextAnalyticsData, measure: Measure, verse: TanakhLayout): number | null {
  return data.scores[measure][verse.book]?.[verse.chapter]?.[verse.verse - 1] ?? null;
}

/** Each measure's colour scale and the ends of it, once per data value. */
const scalesOf = memoByValue(
  (data: TextAnalyticsData): Record<Measure, { scale: Scale; low: number; high: number }> => {
    const build = (measure: Measure) => {
      const values = Object.values(data.scores[measure])
        .flatMap((chapters) => Object.values(chapters).flat())
        .filter((v) => v !== null)
        .sort((a, b) => a - b);
      const low = percentile(values, LOW_PERCENTILE);
      const high = percentile(values, HIGH_PERCENTILE);
      return { scale: scale(low, high, LINEAR, CIVIDIS_STOPS), low, high };
    };
    return { repetition: build('repetition') };
  },
);

function colorAt(data: TextAnalyticsData, measure: Measure, verse: TanakhLayout): Color {
  const score = scoreAt(data, measure, verse);
  return score === null ? NO_DATA : scalesOf(data)[measure].scale.colorOf(score);
}

export const textAnalyticsOverlay: Overlay<
  TanakhIdentity,
  TextAnalyticsSettings,
  TextAnalyticsData
> = {
  ...TEXT_ANALYTICS,
  data: { scores: SCORES_FILE },

  prebuild(data) {
    scalesOf(data);
  },

  getItemColor(verse, settings, data) {
    return colorAt(data, settings.measure, verse);
  },

  colorsFor(items, settings, _hovered, data) {
    return items.map((item) => colorAt(data, settings.measure, item));
  },

  settingsFromUrl(params: UrlParamValues<typeof TEXT_ANALYTICS.urlParams>): TextAnalyticsSettings {
    return { measure: params.measure };
  },

  settingsToUrl(settings: TextAnalyticsSettings): Record<string, string> {
    return { measure: settings.measure };
  },

  renderControls(container, settings, onChange) {
    // A single measure needs no choice.
    if (TEXT_ANALYTICS_MEASURES.length < 2) {
      container.innerHTML = '';
      return;
    }
    let buttons = container.querySelectorAll<HTMLButtonElement>('[data-measure]');
    if (!buttons.length) {
      container.innerHTML = `<div class="${CONTROL.segments}" role="group" aria-label="Measure">${TEXT_ANALYTICS_MEASURES.map(
        (m) =>
          `<button type="button" class="${CONTROL.segment}" data-measure="${m}">${MEASURE_LABELS[m]}</button>`,
      ).join('')}</div>`;
      buttons = container.querySelectorAll<HTMLButtonElement>('[data-measure]');
      buttons.forEach((button) =>
        button.addEventListener('click', () => {
          const measure = button.dataset.measure as Measure;
          onChange((current) => ({ ...current, measure }));
        }),
      );
    }
    buttons.forEach((button) => {
      const on = button.dataset.measure === settings.measure;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
  },

  renderLegend(container, settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const measure = MEASURES[settings.measure];
    const { scale, low, high } = scalesOf(data)[settings.measure];
    const parameters = data.scores.parameters;
    container.innerHTML =
      // Scores above the top of the scale are drawn in its colour too.
      renderAxis(scale, low < 0 && high > 0 ? [low, 0, high] : [low, high], (v) =>
        v === high ? `${measure.format(v)} or more` : measure.format(v),
      ) +
      [
        ...measure.legend(parameters, measure.ends),
        `Verses under ${parameters.minWords} words are not coloured; words joined by a maqaf count as one`,
      ]
        .map(legendCaption)
        .join('');
  },

  summary(settings, data) {
    return {
      strip: {
        gradient: axisGradient(scalesOf(data)[settings.measure].scale),
        ends: MEASURES[settings.measure].ends,
      },
    };
  },

  getHoverInfo(verse, settings, data) {
    const score = scoreAt(data, settings.measure, verse);
    return score === null ? null : MEASURES[settings.measure].hover(score);
  },
};
