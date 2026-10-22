// Text analytics: each verse coloured by a measure of the passage around it,
// computed ahead of time by scripts/overlays/text-analytics/generate.ts.

import {
  type Color,
  type ColorStop,
  scale,
  LINEAR,
  type Scale,
  memoByValue,
  escapeHtml,
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
  listed,
  percent,
  percentile,
  type DivisionExample,
  type Measure,
  type ScoreParameters,
  timesRarer,
  type ScoresFile,
} from './text-analytics/scores.ts';
import { NO_DATA } from './colors.ts';
import './text-analytics.css';

// Cividis, slate blue through grey to yellow, for both measures: even in
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
    hover: (v) => `${percent(v)} of nearby words repeated`,
    ends: ['varied', 'repetitive'],
    legend: (p, [low, high]) => [
      `How much of the passage around each verse repeats itself: the share of the words in its ` +
        `${p.windowVerses} verses that belong to a ${p.runWords}-word phrase the book uses again ` +
        `within ${p.reachVerses} verses`,
      `Common idioms such as "thus says the LORD" (found in ${p.formulaBooks} or more books) don't count`,
      `Blue = ${low} wording · Yellow = ${high} wording`,
    ],
  },
  division: {
    format: timesRarer,
    hover: (v) =>
      timesRarer(v) === 'usual'
        ? 'Divisions usual for verses this long'
        : `Divisions ${timesRarer(v)} than usual for verses this long`,
    ends: ['common', 'unusual'],
    legend: (p, [low, high]) => [
      `How unusually the trop divides the ${p.windowVerses} verses around each verse, ` +
        'compared with verses of the same length',
      '1.2× rarer: on average, each split the trop makes here is 1.2 times less common ' +
        'than in a typical verse',
      `Blue = ${low} divisions · Yellow = ${high} ones`,
      `${listed(p.poeticBooks)} use other marks and are not coloured`,
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
    return { repetition: build('repetition'), division: build('division') };
  },
);

function colorAt(data: TextAnalyticsData, measure: Measure, verse: TanakhLayout): Color {
  const score = scoreAt(data, measure, verse);
  return score === null ? NO_DATA : scalesOf(data)[measure].scale.colorOf(score);
}

// Under 10%, a whole percent rounds 0.7% and 1.4% alike.
const shareOf = (share: number): string =>
  share < 0.1 ? `${(share * 100).toFixed(1)}%` : percent(share);

const markClass = (mark: string): string => `ta-mark-${mark.toLowerCase().replace(/ /g, '-')}`;

function exampleHtml({ ref, share, words }: DivisionExample): string {
  const verse = words
    .map(({ text, mark, secondHalf }) => {
      const cls = mark ? `ta-mark ${markClass(mark)}` : secondHalf ? 'ta-second-half' : '';
      return `<span class="${cls}">${escapeHtml(text)}</span>`;
    })
    .join(' ');
  return `<div class="ta-example">
      <div class="ta-example-meta"><span>${shareOf(share)} of verses</span><span>${escapeHtml(ref)}</span></div>
      <div class="ta-example-verse" lang="he" dir="rtl">${verse}</div>
    </div>`;
}

/** A link to, and a popup of, verses showing common and uncommon ways a first half is divided. */
function examplesHtml(examples: DivisionExample[]): string {
  const marks = [...new Set(examples.flatMap((e) => e.words.flatMap((w) => w.mark ?? [])))];
  const group = (common: boolean, title: string) =>
    `<h3 class="ta-examples-group">${title}</h3>` +
    examples
      .filter((e) => e.common === common)
      .map(exampleHtml)
      .join('');
  return `<button type="button" class="ta-examples-open">See common and uncommon divisions</button>
    <dialog class="ta-examples" aria-labelledby="ta-examples-title">
      <div class="ta-examples-body">
      <div class="ta-examples-head">
        <h2 id="ta-examples-title">How a verse's first half is divided</h2>
        <button type="button" class="${CONTROL.icon} ta-examples-close" aria-label="Close">&times;</button>
      </div>
      <p>The trop divides each verse at its strongest pause, etnachta, then each half at its own strongest pauses. These are ways the first half is divided, with how often each happens across the prose books.</p>
      <div class="ta-examples-key">${marks
        .map((m) => `<span><i class="${markClass(m)}"></i>${escapeHtml(m)}</span>`)
        .join('')}</div>
      ${group(true, 'Common')}
      ${group(false, 'Uncommon')}
      </div>
    </dialog>`;
}

function wireExamples(container: HTMLElement): void {
  const dialog = container.querySelector<HTMLDialogElement>('.ta-examples');
  if (!dialog) return;
  container.querySelector('.ta-examples-open')!.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.ta-examples-close')!.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog itself.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
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
      renderAxis(scale, low < 0 && high > 0 ? [low, 0, high] : [low, high], measure.format) +
      [
        ...measure.legend(parameters, measure.ends),
        `Verses under ${parameters.minWords} words are not coloured; words joined by a maqaf count as one`,
      ]
        .map(legendCaption)
        .join('') +
      (settings.measure === 'division' ? examplesHtml(data.scores.divisionExamples) : '');
    wireExamples(container);
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
