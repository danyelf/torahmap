// Text Analytics: each verse coloured by how much of its wording repeats nearby, or by where in the
// Tanakh the verses that share a phrase with it are; computed ahead of time by
// scripts/overlays/text-analytics/generate.ts.

import { type Color, type ColorStop, scale, LINEAR, memoByValue } from '@torahmap/utils';
import './text-analytics.css';
import type { Overlay, UrlParamValues } from '@torahmap/shell/overlays/types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { optional } from '@torahmap/shell/dataFiles.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { axisGradient, buildLegendGradient, legendCaption, renderAxis } from './legend.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { ECHO_WORDS, TEXT_ANALYSES, TEXT_ANALYTICS } from '@torahmap/overlay-catalog';
import {
  HIGH_PERCENTILE,
  LOW_PERCENTILE,
  SCORES_FILE,
  percent,
  percentile,
  type ScoresFile,
} from './text-analytics/scores.ts';
import { ECHOES_FILE, echoesAt, type EchoesFile } from './text-analytics/echoes.ts';
import { readingOrder, spectrumOf, type Place } from './text-analytics/spectrum.ts';
import { NO_DATA } from './colors.ts';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import { wordsRead } from '../search/dictionary.ts';

// Cividis, slate blue through grey to yellow: even in lightness, made to read
// the same with red-green colour blindness, and unlike any other overlay's
// scale. Its darkest quarter, navy, is left off: on the dark map it is hard to
// tell from a verse with no score.
const CIVIDIS_STOPS: ColorStop[] = [
  { t: 0, color: [0x41 / 255, 0x4d / 255, 0x6b / 255] },
  { t: 1 / 3, color: [0x7c / 255, 0x7b / 255, 0x78 / 255] },
  { t: 2 / 3, color: [0xbc / 255, 0xaf / 255, 0x6f / 255] },
  { t: 1, color: [0xff / 255, 0xea / 255, 0x46 / 255] },
];

// The scale's two ends, in the panel's legend and on the legend card.
const ENDS: [low: string, high: string] = ['varied', 'repetitive'];

export interface TextAnalyticsSettings {
  analysis: (typeof TEXT_ANALYSES)[number];
  /** The words in a row two verses share to be echoes, for the echoes analysis. */
  words: number;
}

export interface TextAnalyticsData {
  scores: ScoresFile;
  echoes: EchoesFile;
  // Only the hover's word count needs the texts; the colours come before them.
  texts: VerseTexts | null;
}

function scoreAt(data: TextAnalyticsData, verse: TanakhLayout): number | null {
  return data.scores.repetition[verse.book]?.[verse.chapter]?.[verse.verse - 1] ?? null;
}

/** The colour scale and its ends, once per data value. */
const scaleOf = memoByValue((data: TextAnalyticsData) => {
  const values = Object.values(data.scores.repetition)
    .flatMap((chapters) => Object.values(chapters).flat())
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  const low = percentile(values, LOW_PERCENTILE);
  const high = percentile(values, HIGH_PERCENTILE);
  return { scale: scale(low, high, LINEAR, CIVIDIS_STOPS), low, high };
});

/** A verse's echoes, and the ids of it and them, by verse id; null for a verse with none. */
interface Echoes {
  places: Place[];
  matches: Set<string>;
}

const ANALYSIS_LABELS: Record<TextAnalyticsSettings['analysis'], string> = {
  'repetitive-wording': 'Repetitive wording',
  echoes: 'Echoes across the Tanakh',
};

const echoesCache = memoByValue((_data: TextAnalyticsData) => new Map<string, Echoes | null>());

/** The verses a verse shares a phrase with, by position in reading order. */
function echoPositions(
  data: TextAnalyticsData,
  { analysis, words }: TextAnalyticsSettings,
  verse: TanakhLayout,
  position: number,
): number[] {
  if (analysis === 'echoes') return echoesAt(data.echoes, position, words).map(([other]) => other);
  // The nearby echoes are offsets within the verse's own book.
  return (data.scores.echoes[verse.book]?.[verse.chapter]?.[verse.verse] ?? []).map(
    (offset) => position + offset,
  );
}

function echoesOf(
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  verse: TanakhLayout,
): Echoes | null {
  const cache = echoesCache(data);
  const key = `${settings.analysis} ${settings.words} ${verse.id}`;
  if (cache.has(key)) return cache.get(key)!;
  const { places: all, positions } = readingOrder(data.scores);
  const position = positions.get(verse.id)!;
  const places = echoPositions(data, settings, verse, position).map((p) => all[p]);
  const found = places.length
    ? { places, matches: new Set([verse.id, ...places.map(({ id }) => id)]) }
    : null;
  cache.set(key, found);
  return found;
}

/** The echoes the map shows: the hovered verse's if it has any, else the pinned verse's. */
const echoKey = (
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  verse: TanakhLayout | null,
): string | null => (verse && echoesOf(data, settings, verse) ? verse.id : null);

function focusEchoes(
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null,
): Echoes | null {
  return (
    (hovered && echoesOf(data, settings, hovered)) ||
    (pinned && echoesOf(data, settings, pinned)) ||
    null
  );
}

// The scale from this share of the way up turns toward a dull red, fully red by the second: the
// yellow is left to the matches.
const REDDEN_FROM = 0.25;
const REDDEN_FULL = 0.55;
const MUTED_RED: Color = [0.5, 0.13, 0.1];

/** A scale colour for a verse out of focus: the low end as it is, the bright end turned toward red. */
function muted(color: Color, position: number): Color {
  const toward = Math.min(1, Math.max(0, (position - REDDEN_FROM) / (REDDEN_FULL - REDDEN_FROM)));
  return color.map((c, i) => c + (MUTED_RED[i] - c) * toward) as Color;
}

function repetitionColorAt(data: TextAnalyticsData, verse: TanakhLayout, mute: boolean): Color {
  const score = scoreAt(data, verse);
  if (score === null) return NO_DATA;
  const { scale, low, high } = scaleOf(data);
  const color = scale.colorOf(score);
  return mute ? muted(color, (score - low) / (high - low)) : color;
}

/**
 * A verse with echoes is the colour of the spectrum where its farthest echo lies; one without, or
 * one out of focus, takes the map's grey.
 */
function echoColorAt(
  data: TextAnalyticsData,
  { words }: TextAnalyticsSettings,
  verse: TanakhLayout,
  mute: boolean,
): Color | null {
  const position = readingOrder(data.scores).positions.get(verse.id)!;
  const echoes = mute ? [] : echoesAt(data.echoes, position, words);
  if (echoes.length === 0) return null;
  const [farthest] = echoes.reduce((far, e) =>
    Math.abs(e[0] - position) > Math.abs(far[0] - position) ? e : far,
  );
  return spectrumOf(data.scores).bright[farthest];
}

function colorAt(
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  verse: TanakhLayout,
  mute = false,
): Color | null {
  return settings.analysis === 'echoes'
    ? echoColorAt(data, settings, verse, mute)
    : repetitionColorAt(data, verse, mute);
}

/** Which of `items` are the focused verse or its echoes. */
function matched(
  items: TanakhLayout[],
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  hovered: TanakhLayout | null | undefined,
  pinned: TanakhLayout | null | undefined,
): boolean[] {
  const matches = focusEchoes(data, settings, hovered ?? null, pinned ?? null)?.matches;
  return items.map((item) => !!matches?.has(item.id));
}

/** The spectrum with the sections of the Tanakh marked along it. */
function renderSpectrum(data: TextAnalyticsData): string {
  const { sections } = spectrumOf(data.scores);
  const gradient = spectrumGradient(data);
  const ticks = sections
    .map(({ name, at }, i) => {
      const edge = i === 0 ? ' tick-start' : '';
      return `<span class="tick${edge}" style="left: ${at * 100}%">${name}</span>`;
    })
    .join('');
  return `<div class="legend-gradient" style="background: ${gradient}"></div><div class="legend-ticks">${ticks}</div>`;
}

const SPECTRUM_SAMPLES = 60;

function spectrumGradient(data: TextAnalyticsData): string {
  const { bright } = spectrumOf(data.scores);
  return buildLegendGradient(
    SPECTRUM_SAMPLES,
    (i) => bright[Math.round((i / (SPECTRUM_SAMPLES - 1)) * (bright.length - 1))],
  );
}

export const textAnalyticsOverlay: Overlay<
  TanakhIdentity,
  TextAnalyticsSettings,
  TextAnalyticsData
> = {
  ...TEXT_ANALYTICS,
  data: { scores: SCORES_FILE, echoes: ECHOES_FILE, texts: optional(TEXTS_FILE) },

  settingsFromUrl(params: UrlParamValues<typeof TEXT_ANALYTICS.urlParams>): TextAnalyticsSettings {
    return { analysis: params.analysis ?? TEXT_ANALYSES[0], words: Number(params.words) };
  },

  settingsToUrl(settings: TextAnalyticsSettings): Record<string, string> {
    return settings.analysis === 'echoes'
      ? { analysis: settings.analysis, words: String(settings.words) }
      : { analysis: settings.analysis };
  },

  prebuild(data) {
    scaleOf(data);
    spectrumOf(data.scores);
  },

  renderControls(container, settings, onChange) {
    if (!container.querySelector('[data-analysis]')) {
      container.innerHTML =
        `<div class="${CONTROL.segments}" role="group" aria-label="Analysis">${TEXT_ANALYSES.map(
          (a) =>
            `<button type="button" class="${CONTROL.segment}" data-analysis="${a}">${ANALYSIS_LABELS[a]}</button>`,
        ).join('')}</div>` +
        `<label class="echo-words"><span class="echo-words-label"></span>` +
        `<input type="range" min="${ECHO_WORDS[0]}" max="${ECHO_WORDS[ECHO_WORDS.length - 1]}" step="1"></label>`;
      container.querySelectorAll<HTMLButtonElement>('[data-analysis]').forEach((button) =>
        button.addEventListener('click', () => {
          const analysis = button.dataset.analysis as TextAnalyticsSettings['analysis'];
          onChange((current) => ({ ...current, analysis }));
        }),
      );
      container.querySelector('input')!.addEventListener('input', (event) => {
        const words = Number((event.target as HTMLInputElement).value);
        onChange((current) => ({ ...current, words }));
      });
    }
    container.querySelectorAll<HTMLButtonElement>('[data-analysis]').forEach((button) => {
      const on = button.dataset.analysis === settings.analysis;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
    container.querySelector<HTMLElement>('.echo-words')!.hidden = settings.analysis !== 'echoes';
    container.querySelector('.echo-words-label')!.textContent =
      `Shared phrase: at least ${settings.words} words in a row`;
    container.querySelector('input')!.value = String(settings.words);
  },

  // The focused verse with echoes keeps them and itself in full colour; the rest are muted.
  colorsFor(items, settings, hovered, data, pinned) {
    const lit = focusEchoes(data, settings, hovered, pinned ?? null)?.matches;
    return items.map((item) => colorAt(data, settings, item, !!lit && !lit.has(item.id)));
  },

  // The matches stay visible zoomed out, as search matches do, and ring when zoomed in.
  standoutsFor(items, settings, data, hovered, pinned) {
    return matched(items, data, settings, hovered, pinned);
  },

  halosFor(items, settings, data, hovered, pinned) {
    return matched(items, data, settings, hovered, pinned);
  },

  renderFocus(container, hovered, pinned, settings, data, travelTo) {
    const found = focusEchoes(data, settings, hovered, pinned);
    if (!found) return;
    const byBook = new Map<string, Place[]>();
    for (const place of found.places) {
      byBook.set(place.book, [...(byBook.get(place.book) ?? []), place]);
    }
    const note = document.createElement('p');
    note.className = 'parallel-verses';
    note.append('Parallel verses: ');
    let firstBook = true;
    for (const [book, inBook] of byBook) {
      note.append(`${firstBook ? '' : '; '}${book} `);
      firstBook = false;
      inBook.forEach(({ id, chapter, verse }, i) => {
        const link = document.createElement('button');
        link.type = 'button';
        link.textContent = `${chapter}:${verse}`;
        link.addEventListener('click', () => travelTo(id));
        note.append(i > 0 ? ', ' : '', link);
      });
    }
    container.appendChild(note);
  },

  // A hovered verse without echoes leaves the pinned verse's showing, so only echoes count.
  hoverChangesColors(before, after, settings, data) {
    return echoKey(data, settings, before) !== echoKey(data, settings, after);
  },

  pinChangesColors(before, after, settings, data) {
    return echoKey(data, settings, before) !== echoKey(data, settings, after);
  },

  renderLegend(container, settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    if (settings.analysis === 'echoes') {
      container.innerHTML =
        renderSpectrum(data) +
        [
          `A verse that shares a phrase with others takes the colour of the place of the echo ` +
            `farthest from it; the colours run in reading order, from Genesis to Chronicles`,
          `A verse with no echo is grey. Each book's panel is the colour of its middle`,
          `Phrases that recur in many verses wherever they appear don't count`,
          `Hover or select a verse to light its parallels`,
        ]
          .map(legendCaption)
          .join('');
      return;
    }
    const { scale, low, high } = scaleOf(data);
    const p = data.scores.parameters;
    container.innerHTML =
      // Scores above the top of the scale are drawn in its colour too.
      renderAxis(scale, [low, high], (v) => (v === high ? `${percent(v)} or more` : percent(v))) +
      [
        `The share of a verse's words that belong to a ${p.runWords}-word phrase the book uses ` +
          `again within ${p.reachVerses} verses`,
        `Common idioms such as "thus says the LORD, God of Israel" (found in ${p.formulaBooks} ` +
          `or more books) don't count`,
        `Blue = ${ENDS[0]} wording · Yellow = ${ENDS[1]} wording`,
        `Verses under ${p.minWords} words are not coloured`,
        `Hover or select a verse to light its parallels`,
      ]
        .map(legendCaption)
        .join('');
  },

  bookTints(settings, data) {
    return settings.analysis === 'echoes' ? spectrumOf(data.scores).books : null;
  },

  summary(settings, data) {
    if (settings.analysis === 'echoes') {
      return { strip: { gradient: spectrumGradient(data), ends: ['Torah', 'Writings'] } };
    }
    return { strip: { gradient: axisGradient(scaleOf(data).scale), ends: ENDS } };
  },

  getHoverInfo(verse, settings, data) {
    if (settings.analysis === 'echoes') {
      const count = echoesAt(
        data.echoes,
        readingOrder(data.scores).positions.get(verse.id)!,
        settings.words,
      ).length;
      if (count === 0) return null;
      return `Shares a phrase with ${count} other ${count === 1 ? 'verse' : 'verses'}`;
    }
    const score = scoreAt(data, verse);
    if (score === null) return null;
    const text = data.texts?.[verse.book][verse.chapter][verse.verse].he;
    if (!text) return `${percent(score)} of its words repeat nearby`;
    const words = wordsRead(text).length;
    const repeated = Math.round(score * words);
    return `${repeated} of its ${words} words ${repeated === 1 ? 'repeats' : 'repeat'} nearby`;
  },

  // One colour for every repeated word; the stretch is marked whole, spaces and all.
  highlightItemText(verse, text: string, language: TextLanguage, settings, data): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const stretches =
      settings.analysis === 'echoes'
        ? []
        : (data.scores.repeated[verse.book]?.[verse.chapter]?.[verse.verse] ?? []);
    if (language !== HEBREW || stretches.length === 0) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const words = wordsRead(text);
    let at = 0;
    for (let i = 0; i < stretches.length; i += 2) {
      const first = words[stretches[i]];
      const last = words[stretches[i + 1] - 1];
      if (!first || !last) continue;
      fragment.appendChild(document.createTextNode(text.slice(at, first.start)));
      const mark = document.createElement('mark');
      mark.className = 'repeated-words';
      mark.textContent = text.slice(first.start, last.end);
      fragment.appendChild(mark);
      at = last.end;
    }
    fragment.appendChild(document.createTextNode(text.slice(at)));
    return fragment;
  },
};
