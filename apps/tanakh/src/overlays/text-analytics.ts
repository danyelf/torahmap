// Text Analytics: each verse coloured by how much of its wording repeats nearby, or by where in the
// Tanakh the verses that share a phrase with it are; computed ahead of time by
// scripts/overlays/text-analytics/generate.ts.

import {
  type Color,
  type ColorStop,
  brighten,
  colorToCss,
  scale,
  LINEAR,
  memoByValue,
  memoByValueAndKey,
} from '@torahmap/utils';
import { type GrownPointer, type Pointer, squareCentre } from '@torahmap/engine';
import './text-analytics.css';
import type { Focus, Overlay, UrlParamValues } from '@torahmap/shell/overlays/types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { optional } from '@torahmap/shell/dataFiles.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { axisGradient, legendCaption, renderAxis } from './legend.ts';
import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import { getDefaultColor } from '../baseColor.ts';
import { readingOrder, type Place } from '../books.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { verseRef } from '@torahmap/link/tanakh';
import { ECHO_WORDS, TEXT_ANALYSES, TEXT_ANALYTICS } from '@torahmap/overlay-catalog';
import {
  HIGH_PERCENTILE,
  LOW_PERCENTILE,
  SCORES_FILE,
  percent,
  percentile,
  type ScoresFile,
} from './text-analytics/scores.ts';
import { ECHOES_FILE, echoRun, echoesAt, type EchoesFile } from './text-analytics/echoes.ts';
import { DISTANCE_STEPS, SAME_CHAPTER, distanceStep } from './text-analytics/distance.ts';
import { NO_DATA } from './colors.ts';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import { wordsRead } from '../search/dictionary.ts';
import { sharedStretches, words as wordsOf } from './text-analytics/words.ts';

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
  const { places: all, positions } = readingOrder();
  const position = positions.get(verse.id)!;
  const places = echoPositions(data, settings, verse, position).map((p) => all[p]);
  const found = places.length
    ? { places, matches: new Set([verse.id, ...places.map(({ id }) => id)]) }
    : null;
  cache.set(key, found);
  return found;
}

/** The verse's id if it has echoes. */
const echoKey = (
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  verse: TanakhLayout | null,
): string | null => (verse && echoesOf(data, settings, verse) ? verse.id : null);

/**
 * The verse whose echoes the map shows, of the hovered and the pinned one. A pinned verse keeps
 * the focus, and the pointer compares it with one of its echoes.
 */
function focusedVerse(
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null,
): TanakhLayout | null {
  const withEchoes = (verse: TanakhLayout | null) =>
    verse && echoesOf(data, settings, verse) ? verse : null;
  return withEchoes(pinned) ?? withEchoes(hovered);
}

function focusEchoes(
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null,
): Echoes | null {
  const verse = focusedVerse(data, settings, hovered, pinned);
  return verse && echoesOf(data, settings, verse);
}

// While a verse is focused, the others go this far toward a dark blue-grey.
const OUT_OF_FOCUS: Color = [0.2, 0.24, 0.34];
const OUT_OF_FOCUS_SHARE = 0.6;

/** A verse's colour while another verse is focused, in either analysis. */
function outOfFocus(color: Color): Color {
  return color.map((c, i) => c + (OUT_OF_FOCUS[i] - c) * OUT_OF_FOCUS_SHARE) as Color;
}

function repetitionColorAt(data: TextAnalyticsData, verse: TanakhLayout, mute: boolean): Color {
  const score = scoreAt(data, verse);
  if (score === null) return NO_DATA;
  const color = scaleOf(data).scale.colorOf(score);
  return mute ? outOfFocus(color) : color;
}

// A verse without echoes keeps the map's grey pattern at this share of its brightness, so the
// palest distance step stands out from it.
const PLAIN_BRIGHTNESS = 0.6;
// Short of full white, which outshines the verse's lit echoes.
const FOCUSED_VERSE: Color = [0.85, 0.85, 0.85];

// The focused verse's echoes go this far toward white, so the darkest distance step still stands out.
const LIT_SHARE = 0.35;

const lit = (color: Color): Color => color.map((c) => c + (1 - c) * LIT_SHARE) as Color;

/**
 * A verse with echoes wears the colour of its farthest one; one without keeps the plain grey. With
 * a verse focused, it is pale grey, its echoes are lit and every other verse goes out of focus;
 * while it is compared with one echo, only that one is lit.
 */
function echoColors(
  items: TanakhLayout[],
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  focus: Focus<TanakhIdentity>,
): Color[] {
  const { places, positions } = readingOrder();
  const farthestEcho = (id: string): Color | null => {
    const position = positions.get(id)!;
    const echoes = echoesAt(data.echoes, position, settings.words);
    if (echoes.length === 0) return null;
    const from = places[position];
    const farthest = Math.max(...echoes.map(([other]) => distanceStep(from, places[other])));
    return DISTANCE_STEPS[farthest].color;
  };
  const focused = focusedVerse(data, settings, focus.hovered, focus.pinned);
  const matches = focused && echoesOf(data, settings, focused)!.matches;
  return items.map(({ id }, i) => {
    if (id === focused?.id) return FOCUSED_VERSE;
    const color = farthestEcho(id);
    if (!color) return brighten(getDefaultColor(i), PLAIN_BRIGHTNESS);
    if (!matches) return color;
    if (!matches.has(id)) return outOfFocus(color);
    return !focus.compared || id === focus.compared.id ? lit(color) : color;
  });
}

// How far a pointer reaches toward an echo, in map units (a cell is SQUARE_SIZE): farther toward another
// section of the Tanakh.
const POINTER_LENGTH = 10;
const POINTER_LENGTH_FAR = 14;
// A verse with more pointers than this draws them shorter, by the fourth root of how many more, so a
// formula's fan of seventy does not drown the verses with one or two.
const FULL_LENGTH_POINTERS = 12;
// The rest of the focused verse's run of parallels is drawn this much fainter than its own echoes.
const RUN_OPACITY = 0.55;
// While the focused verse is compared with one echo, every grown pointer but the pair's is this faint.
const NOT_COMPARED_OPACITY = 0.25;
// The key of the pointer from one reading-order position toward another.
const pairKey = (from: number, to: number) => `${from} ${to}`;

/** Every echo's pointer, and where each one that can grow sits in the list, by the positions it joins. */
const echoPointerList = memoByValue((items: TanakhLayout[]) =>
  memoByValueAndKey((data: TextAnalyticsData, words: number) => {
    const { places, positions } = readingOrder();
    const centres = new Map(items.map((item) => [item.id, squareCentre(item)]));
    const far = DISTANCE_STEPS.length - 1;
    const pointers: Pointer[] = [];
    const at = new Map<string, number>();
    for (const { id } of items) {
      const position = positions.get(id)!;
      const drawn = echoesAt(data.echoes, position, words)
        .map(([other]) => ({
          other,
          to: centres.get(places[other].id),
          step: distanceStep(places[position], places[other]),
        }))
        .filter(({ to }) => to);
      const shorter = Math.min(1, (FULL_LENGTH_POINTERS / drawn.length) ** 0.25);
      for (const { other, to, step } of drawn) {
        // Grown, a pointer within the chapter would lie along its row of verses, so it never grows.
        if (step !== SAME_CHAPTER) at.set(pairKey(position, other), pointers.length);
        pointers.push({
          from: centres.get(id)!,
          to: to!,
          length: (step === far ? POINTER_LENGTH_FAR : POINTER_LENGTH) * shorter,
          color: DISTANCE_STEPS[step].color,
        });
      }
    }
    return { pointers, at };
  }),
);

/**
 * The focused verse's run of parallels, each pair grown to meet; its own echoes brightest, or
 * while it is compared with one echo, that pair alone.
 */
function grownEchoPointers(
  items: TanakhLayout[],
  data: TextAnalyticsData,
  settings: TextAnalyticsSettings,
  focus: Focus<TanakhIdentity>,
): GrownPointer[] {
  const focused = focusedVerse(data, settings, focus.hovered, focus.pinned);
  if (!focused) return [];
  const { positions } = readingOrder();
  const focusedAt = positions.get(focused.id)!;
  const { at } = echoPointerList(items)(data, settings.words);
  const compared = focus.compared && positions.get(focus.compared.id);
  // An echo with no pointer that grows, as one in the same chapter, dims none when compared.
  const comparedAt = compared != null && at.has(pairKey(focusedAt, compared)) ? compared : null;
  return echoRun(data.echoes, focusedAt, settings.words).flatMap(([a, b]) => {
    const own = a === focusedAt || b === focusedAt;
    const opacity =
      comparedAt === null
        ? own
          ? 1
          : RUN_OPACITY
        : own && (a === comparedAt || b === comparedAt)
          ? 1
          : NOT_COMPARED_OPACITY;
    return [at.get(pairKey(a, b)), at.get(pairKey(b, a))]
      .filter((index) => index !== undefined)
      .map((index) => ({ index, opacity }));
  });
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

  colorsFor({ items, settings, data, focus }) {
    if (settings.analysis === 'echoes') return echoColors(items, data, settings, focus);
    const lit = focusEchoes(data, settings, focus.hovered, focus.pinned)?.matches;
    return items.map((item) => repetitionColorAt(data, item, !!lit && !lit.has(item.id)));
  },

  pointersFor({ items, settings, data }) {
    return settings.analysis === 'echoes'
      ? echoPointerList(items)(data, settings.words).pointers
      : [];
  },

  grownPointersFor({ items, settings, data, focus }) {
    return settings.analysis === 'echoes' ? grownEchoPointers(items, data, settings, focus) : [];
  },

  // The matches stay visible zoomed out, as search matches do, and ring when zoomed in.
  standoutsFor({ items, settings, data, focus }) {
    return matched(items, data, settings, focus.hovered, focus.pinned);
  },

  halosFor({ items, settings, data, focus }) {
    return matched(items, data, settings, focus.hovered, focus.pinned);
  },

  renderFocus(container, hovered, pinned, settings, data, travelTo, compare) {
    const focus = focusedVerse(data, settings, hovered, pinned);
    if (!focus) {
      container.replaceChildren();
      listDrawnFor.delete(container);
      return;
    }
    // A click on a parallel of the pinned verse holds the two for comparison before it travels.
    const compares = compare && pinned?.id === focus.id;
    const drawnFor = [
      focus.id,
      settings.analysis,
      settings.words,
      data,
      travelTo,
      compares && compare.hover,
      compares && compare.hold,
    ];
    const before = listDrawnFor.get(container);
    // The app empties the container itself when another overlay takes the panel.
    if (!container.firstChild || !before?.every((part, i) => part === drawnFor[i])) {
      listDrawnFor.set(container, drawnFor);
      container.replaceChildren(
        parallelList(focus, settings, data, (id, held) => {
          if (compares && id !== focus.id && !held) return compare.hold(id);
          // Travelling redraws the list, and the row under the pointer never sees it leave.
          if (compares) compare.hover(null);
          travelTo(id);
        }),
      );
      if (compares) {
        for (const row of parallelRows(container)) {
          if (row.dataset.verse === focus.id) continue;
          row.addEventListener('mouseenter', () => compare.hover(row.dataset.verse!));
          row.addEventListener('mouseleave', () => compare.hover(null));
        }
      }
    }
    for (const row of parallelRows(container)) {
      const names = (verse: TanakhLayout | null | undefined) =>
        !!compares && row.dataset.verse === verse?.id;
      row.classList.toggle(COMPARED_ROW, names(compare?.compared));
      row.classList.toggle(HELD_ROW, names(compare?.held));
    }
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
      container.replaceChildren(...swatchList(DISTANCE_STEPS));
      container.insertAdjacentHTML(
        'beforeend',
        [
          `Colour shows how far away a verse's farthest echo is`,
          `A verse with no echo is grey`,
          ...FOCUS_CAPTIONS,
        ]
          .map(legendCaption)
          .join(''),
      );
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
        ...FOCUS_CAPTIONS,
      ]
        .map(legendCaption)
        .join('');
  },

  summary(settings, data) {
    if (settings.analysis === 'echoes') {
      return { colors: DISTANCE_STEPS.map(({ color }) => colorToCss(color)) };
    }
    return { strip: { gradient: axisGradient(scaleOf(data).scale), ends: ENDS } };
  },

  getHoverInfo(verse, settings, data) {
    if (settings.analysis === 'echoes') {
      const count = echoesAt(
        data.echoes,
        readingOrder().positions.get(verse.id)!,
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
    return markStretches(text, language === HEBREW ? repeatedIn(verse, text, settings, data) : []);
  },

  comparesWith(pinned, other, settings, data) {
    return other.id !== pinned.id && !!echoesOf(data, settings, pinned)?.matches.has(other.id);
  },

  // The phrase the two share is marked in both; what else the pinned verse repeats keeps a
  // fainter mark.
  compareTexts(pinned, _compared, [pinnedText, comparedText], settings, data) {
    return [
      markStretches(
        pinnedText,
        sharedWith(pinnedText, [comparedText], settings, data),
        repeatedIn(pinned, pinnedText, settings, data),
      ),
      markStretches(comparedText, sharedWith(comparedText, [pinnedText], settings, data)),
    ];
  },
};

const FOCUS_CAPTIONS = [
  `Hover or select a verse to light its parallels`,
  `With a verse selected, hover or click a parallel to compare the two`,
];

/** How many words in a row make a shared phrase in the analysis shown. */
const phraseWords = (settings: TextAnalyticsSettings, data: TextAnalyticsData): number =>
  settings.analysis === 'echoes' ? settings.words : data.scores.parameters.runWords;

/** The stretches of a verse's Hebrew that sit in a phrase it shares with one of `others`. */
const sharedWith = (
  text: string,
  others: string[],
  settings: TextAnalyticsSettings,
  data: TextAnalyticsData,
): number[] =>
  sharedStretches(wordsOf(text), others.filter(Boolean).map(wordsOf), phraseWords(settings, data));

/** The stretches of a verse's Hebrew that the analysis shown counts as repeated. */
function repeatedIn(
  verse: TanakhLayout,
  text: string,
  settings: TextAnalyticsSettings,
  data: TextAnalyticsData,
): readonly number[] {
  if (settings.analysis !== 'echoes') {
    return data.scores.repeated[verse.book]?.[verse.chapter]?.[verse.verse] ?? [];
  }
  const echoes = echoesOf(data, settings, verse)?.places ?? [];
  return sharedWith(
    text,
    echoes.map((place) => textOf(data, place)),
    settings,
    data,
  );
}

const COMPARED_ROW = 'parallel-compared';
const HELD_ROW = 'parallel-held';

// What each container's list was last drawn for, so a call that changes none of it keeps the list.
const listDrawnFor = new WeakMap<HTMLElement, unknown[]>();

const parallelRows = (container: HTMLElement) =>
  container.querySelectorAll<HTMLButtonElement>('.parallel-list button');

/** The focused verse among its parallels, in reading order; `click` is told whether the row is held. */
function parallelList(
  focus: TanakhLayout,
  settings: TextAnalyticsSettings,
  data: TextAnalyticsData,
  click: (id: string, held: boolean) => void,
): HTMLElement {
  const found = echoesOf(data, settings, focus)!;
  const note = document.createElement('div');
  note.className = 'parallel-verses';
  const heading = document.createElement('p');
  heading.textContent = `Parallel verses (${found.places.length})`;
  const list = document.createElement('div');
  list.className = 'parallel-list';
  const { positions } = readingOrder();
  const inOrder = [...found.places, focus].sort(
    (a, b) => positions.get(a.id)! - positions.get(b.id)!,
  );
  for (const place of inOrder) {
    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.verse = place.id;
    const ref = document.createElement('span');
    ref.className = 'parallel-ref';
    ref.textContent = verseRef(place);
    const quote = document.createElement('span');
    quote.className = 'parallel-quote';
    quote.dir = 'auto';
    const he = textOf(data, place);
    // A parallel is marked against the focused verse, the focused verse against its parallels.
    const partners = (place.id === focus.id ? found.places : [focus]).map((other) =>
      textOf(data, other),
    );
    quote.append(markStretches(he, sharedWith(he, partners, settings, data)));
    row.append(ref, quote);
    row.classList.toggle('parallel-source', place.id === focus.id);
    row.addEventListener('click', () => click(place.id, row.classList.contains(HELD_ROW)));
    list.appendChild(row);
  }
  note.append(heading, list);
  return note;
}

const textOf = (data: TextAnalyticsData, verse: TanakhIdentity): string =>
  data.texts?.[verse.book]?.[verse.chapter]?.[verse.verse]?.he ?? '';

const MARK = 'repeated-words';
const FAINTER_MARK = `${MARK} fainter`;

/**
 * The text with each stretch, as start, end pairs of word numbers, marked whole; the `fainter`
 * stretches in a fainter mark where no other covers them.
 */
function markStretches(
  text: string,
  stretches: readonly number[],
  fainter: readonly number[] = [],
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const read = stretches.length || fainter.length ? wordsRead(text) : [];
  const marks: (string | null)[] = read.map(() => null);
  for (const [list, mark] of [
    [fainter, FAINTER_MARK],
    [stretches, MARK],
  ] as const) {
    for (let i = 0; i < list.length; i += 2) marks.fill(mark, list[i], list[i + 1]);
  }
  let at = 0;
  for (let first = 0, end; first < marks.length; first = end) {
    end = first + 1;
    while (marks[end] === marks[first]) end++;
    if (!marks[first]) continue;
    fragment.appendChild(document.createTextNode(text.slice(at, read[first].start)));
    const mark = document.createElement('mark');
    mark.className = marks[first]!;
    mark.textContent = text.slice(read[first].start, read[end - 1].end);
    fragment.appendChild(mark);
    at = read[end - 1].end;
  }
  fragment.appendChild(document.createTextNode(text.slice(at)));
  return fragment;
}
