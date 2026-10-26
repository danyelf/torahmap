// Text Analytics: each verse coloured by how much of its wording repeats nearby,
// computed ahead of time by scripts/overlays/text-analytics/generate.ts.

import { type Color, type ColorStop, scale, LINEAR, memoByValue } from '@torahmap/utils';
import './text-analytics.css';
import type { Overlay, UrlParamValues } from '@torahmap/shell/overlays/types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { optional } from '@torahmap/shell/dataFiles.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { axisGradient, legendCaption, renderAxis } from './legend.ts';
import { DIMMED_GREY } from '@torahmap/shell/constants.ts';
import { verseId } from '@torahmap/link/tanakh';
import { TEXT_ANALYSES, TEXT_ANALYTICS } from '@torahmap/overlay-catalog';
import {
  HIGH_PERCENTILE,
  LOW_PERCENTILE,
  SCORES_FILE,
  percent,
  percentile,
  type ScoresFile,
} from './text-analytics/scores.ts';
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
}

export interface TextAnalyticsData {
  scores: ScoresFile;
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

/** Each book's verses in reading order, as chapter and verse numbers, and where each begins. */
const readingOrder = memoByValue((data: TextAnalyticsData) => {
  const order = new Map<string, { chapter: number; verse: number }[]>();
  const index = new Map<string, number>();
  for (const [book, chapters] of Object.entries(data.scores.repetition)) {
    const verses: { chapter: number; verse: number }[] = [];
    for (const [chapter, scores] of Object.entries(chapters)) {
      index.set(`${book} ${chapter}`, verses.length);
      scores.forEach((_, i) => verses.push({ chapter: Number(chapter), verse: i + 1 }));
    }
    order.set(book, verses);
  }
  return { order, index };
});

/** The ids of the verses that share a repeated run with `verse`, none when it has no echoes. */
function echoesOf(data: TextAnalyticsData, verse: TanakhLayout): string[] {
  const offsets = data.scores.echoes[verse.book]?.[verse.chapter]?.[verse.verse] ?? [];
  const { order, index } = readingOrder(data);
  const start = (index.get(`${verse.book} ${verse.chapter}`) ?? 0) + verse.verse - 1;
  return offsets.map((offset) => {
    const { chapter, verse: v } = order.get(verse.book)![start + offset];
    return verseId(verse.book, chapter, v);
  });
}

function colorAt(data: TextAnalyticsData, verse: TanakhLayout): Color {
  const score = scoreAt(data, verse);
  return score === null ? NO_DATA : scaleOf(data).scale.colorOf(score);
}

export const textAnalyticsOverlay: Overlay<
  TanakhIdentity,
  TextAnalyticsSettings,
  TextAnalyticsData
> = {
  ...TEXT_ANALYTICS,
  data: { scores: SCORES_FILE, texts: optional(TEXTS_FILE) },

  settingsFromUrl(params: UrlParamValues<typeof TEXT_ANALYTICS.urlParams>): TextAnalyticsSettings {
    return { analysis: params.analysis ?? TEXT_ANALYSES[0] };
  },

  settingsToUrl(settings: TextAnalyticsSettings): Record<string, string> {
    return { analysis: settings.analysis };
  },

  prebuild(data) {
    scaleOf(data);
  },

  // A hovered verse with echoes lights them and itself; every other verse goes grey.
  colorsFor(items, _settings, hovered, data) {
    const echoes = hovered ? echoesOf(data, hovered) : [];
    if (!hovered || echoes.length === 0) return items.map((item) => colorAt(data, item));
    const lit = new Set([hovered.id, ...echoes]);
    return items.map((item) => (lit.has(item.id) ? colorAt(data, item) : DIMMED_GREY));
  },

  hoverChangesColors(before, after, _settings, data) {
    const hasEchoes = (verse: TanakhLayout | null) =>
      verse && echoesOf(data, verse).length > 0 ? verse.id : null;
    return hasEchoes(before) !== hasEchoes(after);
  },

  renderLegend(container, _settings, data) {
    if (!data) {
      container.innerHTML = '';
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
        `Hover a verse to light the verses it shares a phrase with; select it to mark the words`,
      ]
        .map(legendCaption)
        .join('');
  },

  summary(_settings, data) {
    return { strip: { gradient: axisGradient(scaleOf(data).scale), ends: ENDS } };
  },

  getHoverInfo(verse, _settings, data) {
    const score = scoreAt(data, verse);
    if (score === null) return null;
    const text = data.texts?.[verse.book][verse.chapter][verse.verse].he;
    if (!text) return `${percent(score)} of its words repeat nearby`;
    const words = wordsRead(text).length;
    const repeated = Math.round(score * words);
    return `${repeated} of its ${words} words ${repeated === 1 ? 'repeats' : 'repeat'} nearby`;
  },

  // One colour for every repeated word; the stretch is marked whole, spaces and all.
  highlightItemText(
    verse,
    text: string,
    language: TextLanguage,
    _settings,
    data,
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const stretches = data.scores.repeated[verse.book]?.[verse.chapter]?.[verse.verse] ?? [];
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
