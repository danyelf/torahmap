// Echoes: each verse colored by where in the Tanakh the verses that share a phrase with it are;
// computed ahead of time by scripts/overlays/echoes/generate.ts.

import { type Color, brighten, colorToCss, memoByValue, memoByValueAndKey } from '@torahmap/utils';
import { type GrownPointer, type Pointer, squareCenter } from '@torahmap/engine';
import './echoes.css';
import type { Focus, Overlay, UrlParamValues } from '@torahmap/shell/overlays/types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { optional } from '@torahmap/shell/dataFiles.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { legendCaption } from './legend.ts';
import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import { getDefaultColor } from '../baseColor.ts';
import { readingOrder, type Place } from '../books.ts';
import { verseRef } from '@torahmap/link/tanakh';
import { ECHO_WORDS, ECHOES } from '@torahmap/overlay-catalog';
import { ECHOES_FILE, echoRun, echoesAt, type EchoesFile } from './echoes/data.ts';
import { DISTANCE_STEPS, SAME_CHAPTER, distanceStep } from './echoes/distance.ts';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import { wordsRead } from '../search/dictionary.ts';
import { sharedStretches, words as wordsOf } from './echoes/words.ts';

export interface EchoesSettings {
  /** The words in a row two verses share to be echoes. */
  words: number;
}

export interface EchoesData {
  echoes: EchoesFile;
  // Only the marked text and the list of parallels need the texts; the colors come before them.
  texts: VerseTexts | null;
}

/** A verse's echoes, and the ids of it and them, by verse id; null for a verse with none. */
interface Echoes {
  places: Place[];
  matches: Set<string>;
}

const echoesCache = memoByValue((_data: EchoesData) => new Map<string, Echoes | null>());

function echoesOf(data: EchoesData, settings: EchoesSettings, verse: TanakhLayout): Echoes | null {
  const cache = echoesCache(data);
  const key = `${settings.words} ${verse.id}`;
  if (cache.has(key)) return cache.get(key)!;
  const { places: all, positions } = readingOrder();
  const position = positions.get(verse.id)!;
  const places = echoesAt(data.echoes, position, settings.words).map(([other]) => all[other]);
  const found = places.length
    ? { places, matches: new Set([verse.id, ...places.map(({ id }) => id)]) }
    : null;
  cache.set(key, found);
  return found;
}

/** The verse, if it has echoes. */
const withEchoes = (
  data: EchoesData,
  settings: EchoesSettings,
  verse: TanakhLayout | null,
): TanakhLayout | null => (verse && echoesOf(data, settings, verse) ? verse : null);

/** Whether moving the pointer or the pin from one verse to the other changes the colors: only echoes show. */
const echoesDiffer = (
  before: TanakhLayout | null,
  after: TanakhLayout | null,
  settings: EchoesSettings,
  data: EchoesData,
): boolean => withEchoes(data, settings, before)?.id !== withEchoes(data, settings, after)?.id;

/**
 * The verse whose echoes the map shows, of the hovered and the pinned one. A pinned verse keeps
 * the focus, and the pointer compares it with one of its echoes.
 */
function focusedVerse(
  data: EchoesData,
  settings: EchoesSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null,
): TanakhLayout | null {
  return withEchoes(data, settings, pinned) ?? withEchoes(data, settings, hovered);
}

function focusEchoes(
  data: EchoesData,
  settings: EchoesSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null,
): Echoes | null {
  const verse = focusedVerse(data, settings, hovered, pinned);
  return verse && echoesOf(data, settings, verse);
}

// While a verse is focused, the others go this far toward a dark blue-gray.
const OUT_OF_FOCUS: Color = [0.2, 0.24, 0.34];
const OUT_OF_FOCUS_SHARE = 0.6;

function outOfFocus(color: Color): Color {
  return color.map((c, i) => c + (OUT_OF_FOCUS[i] - c) * OUT_OF_FOCUS_SHARE) as Color;
}

// A verse without echoes keeps the map's gray pattern at this share of its brightness, so the
// palest distance step stands out from it.
const PLAIN_BRIGHTNESS = 0.6;
// Short of full white, which outshines the verse's lit echoes.
const FOCUSED_VERSE: Color = [0.85, 0.85, 0.85];

// The focused verse's echoes go this far toward white, so the darkest distance step still stands out.
const LIT_SHARE = 0.35;

const lit = (color: Color): Color => color.map((c) => c + (1 - c) * LIT_SHARE) as Color;

/**
 * A verse with echoes wears the color of its farthest one; one without keeps the plain gray. With
 * a verse focused, it is pale gray, its echoes are lit and every other verse goes out of focus;
 * while it is compared with one echo, only that one is lit.
 */
function echoColors(
  items: TanakhLayout[],
  data: EchoesData,
  settings: EchoesSettings,
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
  memoByValueAndKey((data: EchoesData, words: number) => {
    const { places, positions } = readingOrder();
    const centers = new Map(items.map((item) => [item.id, squareCenter(item)]));
    const far = DISTANCE_STEPS.length - 1;
    const pointers: Pointer[] = [];
    const at = new Map<string, number>();
    for (const { id } of items) {
      const position = positions.get(id)!;
      const drawn = echoesAt(data.echoes, position, words)
        .map(([other]) => ({
          other,
          to: centers.get(places[other].id),
          step: distanceStep(places[position], places[other]),
        }))
        .flatMap((echo) => (echo.to ? [{ ...echo, to: echo.to }] : []));
      const shorter = Math.min(1, (FULL_LENGTH_POINTERS / drawn.length) ** 0.25);
      for (const { other, to, step } of drawn) {
        // Grown, a pointer within the chapter would lie along its row of verses, so it never grows.
        if (step !== SAME_CHAPTER) at.set(pairKey(position, other), pointers.length);
        pointers.push({
          from: centers.get(id)!,
          to,
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
  data: EchoesData,
  settings: EchoesSettings,
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
  data: EchoesData,
  settings: EchoesSettings,
  hovered: TanakhLayout | null | undefined,
  pinned: TanakhLayout | null | undefined,
): boolean[] {
  const matches = focusEchoes(data, settings, hovered ?? null, pinned ?? null)?.matches;
  return items.map((item) => !!matches?.has(item.id));
}

export const echoesOverlay: Overlay<TanakhIdentity, EchoesSettings, EchoesData> = {
  ...ECHOES,
  data: { echoes: ECHOES_FILE, texts: optional(TEXTS_FILE) },

  settingsFromUrl(params: UrlParamValues<typeof ECHOES.urlParams>): EchoesSettings {
    return { words: Number(params.words) };
  },

  settingsToUrl(settings: EchoesSettings): Record<string, string> {
    return { words: String(settings.words) };
  },

  renderControls(container, settings, onChange) {
    if (!container.querySelector('input')) {
      container.innerHTML =
        `<label class="echo-words"><span class="echo-words-label"></span>` +
        `<input type="range" min="${ECHO_WORDS[0]}" max="${ECHO_WORDS[ECHO_WORDS.length - 1]}" step="1"></label>`;
      container.querySelector('input')!.addEventListener('input', (event) => {
        const words = Number((event.target as HTMLInputElement).value);
        onChange((current) => ({ ...current, words }));
      });
    }
    container.querySelector('.echo-words-label')!.textContent =
      `Shared phrase: at least ${settings.words} words in a row`;
    container.querySelector('input')!.value = String(settings.words);
  },

  colorsFor({ items, settings, data, focus }) {
    return echoColors(items, data, settings, focus);
  },

  pointersFor({ items, settings, data }) {
    return echoPointerList(items)(data, settings.words).pointers;
  },

  grownPointersFor({ items, settings, data, focus }) {
    return grownEchoPointers(items, data, settings, focus);
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
          // Traveling redraws the list, and the row under the pointer never sees it leave.
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

  hoverChangesColors: echoesDiffer,
  pinChangesColors: echoesDiffer,

  renderLegend(container, _settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    container.replaceChildren(...swatchList(DISTANCE_STEPS));
    container.insertAdjacentHTML(
      'beforeend',
      [
        `Color shows how far away a verse's farthest echo is`,
        `A verse with no echo is gray`,
        `Hover or select a verse to light its parallels`,
        `With a verse selected, hover or click a parallel to compare the two`,
      ]
        .map(legendCaption)
        .join(''),
    );
  },

  summary() {
    return { colors: DISTANCE_STEPS.map(({ color }) => colorToCss(color)) };
  },

  getHoverInfo(verse, settings, data) {
    const count = echoesAt(
      data.echoes,
      readingOrder().positions.get(verse.id)!,
      settings.words,
    ).length;
    if (count === 0) return null;
    return `Shares a phrase with ${count} other ${count === 1 ? 'verse' : 'verses'}`;
  },

  // One color for every shared word; the stretch is marked whole, spaces and all.
  highlightItemText(verse, text: string, language: TextLanguage, settings, data): DocumentFragment {
    return markStretches(
      text,
      language === HEBREW ? sharedWithEchoes(verse, text, settings, data) : [],
    );
  },

  comparesWith(pinned, other, settings, data) {
    return other.id !== pinned.id && !!echoesOf(data, settings, pinned)?.matches.has(other.id);
  },

  // The phrase the two share is marked in both; what else the pinned verse shares keeps a
  // fainter mark.
  compareTexts(pinned, [pinnedText, comparedText], settings, data) {
    return [
      markStretches(
        pinnedText,
        sharedWith(pinnedText, [comparedText], settings),
        sharedWithEchoes(pinned, pinnedText, settings, data),
      ),
      markStretches(comparedText, sharedWith(comparedText, [pinnedText], settings)),
    ];
  },
};

/** The stretches of a verse's Hebrew that sit in a phrase it shares with one of `others`. */
const sharedWith = (text: string, others: string[], settings: EchoesSettings): number[] =>
  sharedStretches(wordsOf(text), others.filter(Boolean).map(wordsOf), settings.words);

/** The stretches of a verse's Hebrew that it shares with any of its echoes. */
const sharedWithEchoes = (
  verse: TanakhLayout,
  text: string,
  settings: EchoesSettings,
  data: EchoesData,
): number[] =>
  sharedWith(
    text,
    (echoesOf(data, settings, verse)?.places ?? []).map((place) => textOf(data, place)),
    settings,
  );

const COMPARED_ROW = 'parallel-compared';
const HELD_ROW = 'parallel-held';

// What each container's list was last drawn for, so a call that changes none of it keeps the list.
const listDrawnFor = new WeakMap<HTMLElement, unknown[]>();

const parallelRows = (container: HTMLElement) =>
  container.querySelectorAll<HTMLButtonElement>('.parallel-list button');

/** The focused verse among its parallels, in reading order; `click` is told whether the row is held. */
function parallelList(
  focus: TanakhLayout,
  settings: EchoesSettings,
  data: EchoesData,
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
    quote.append(markStretches(he, sharedWith(he, partners, settings)));
    row.append(ref, quote);
    row.classList.toggle('parallel-source', place.id === focus.id);
    row.addEventListener('click', () => click(place.id, row.classList.contains(HELD_ROW)));
    list.appendChild(row);
  }
  note.append(heading, list);
  return note;
}

const textOf = (data: EchoesData, verse: TanakhIdentity): string =>
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
