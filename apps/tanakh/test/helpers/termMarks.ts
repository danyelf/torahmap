import { addTerm, heldColors, type SearchTerm } from '@torahmap/search';
import { TERM_PALETTE } from '@torahmap/shell/overlays/palette.ts';

/** The channels of a TERM_PALETTE color as CSS writes them in a color: `r, g, b`. */
export const channelsOf = (place: number): string =>
  TERM_PALETTE[place].map((channel) => Math.round(channel * 255)).join(', ');

/** The place in TERM_PALETTE a search mark is colored with, or -1 if it is none of them. */
export const placeOfMark = (mark: HTMLElement): number =>
  TERM_PALETTE.findIndex((_, place) => mark.style.background.includes(channelsOf(place)));

/** The places in TERM_PALETTE the words get when searched for one after another. */
export const placesOf = (...words: string[]): number[] =>
  words
    .reduce((terms, word) => addTerm(terms, word), [] as SearchTerm[])
    .map((term) => term.colorIndex);

/** The colors the words get when searched for one after another. */
export const colorsOf = (...words: string[]) =>
  placesOf(...words).map((place) => TERM_PALETTE[place]);

/** The colors the terms hold, in order. */
export const colorsHeld = (terms: SearchTerm[]) =>
  heldColors(terms).map((place) => TERM_PALETTE[place]);
