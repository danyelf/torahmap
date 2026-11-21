import { addTerm, heldColors, type SearchTerm } from '@torahmap/search';
import { TERM_PALETTE } from '@torahmap/shell/overlays/palette.ts';

/** The channels of a PALETTE colour as CSS writes them in a colour: `r, g, b`. */
export const channelsOf = (place: number): string =>
  TERM_PALETTE[place].map((channel) => Math.round(channel * 255)).join(', ');

/** The place in PALETTE a search mark is coloured with, or -1 if it is none of them. */
export const placeOfMark = (mark: HTMLElement): number =>
  TERM_PALETTE.findIndex((_, place) => mark.style.background.includes(channelsOf(place)));

/** The places in PALETTE the words get when searched for one after another. */
export const placesOf = (...words: string[]): number[] =>
  words
    .reduce((terms, word) => addTerm(terms, word), [] as SearchTerm[])
    .map((term) => term.colorIndex);

/** The colours the words get when searched for one after another. */
export const colorsOf = (...words: string[]) =>
  placesOf(...words).map((place) => TERM_PALETTE[place]);

/** The colours the terms hold, in order. */
export const colorsHeld = (terms: SearchTerm[]) =>
  heldColors(terms).map((place) => TERM_PALETTE[place]);
