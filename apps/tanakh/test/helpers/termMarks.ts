import { PALETTE } from '@torahmap/shell/overlays/palette.ts';

/** The channels of a PALETTE colour as CSS writes them in a colour: `r, g, b`. */
export const channelsOf = (place: number): string =>
  PALETTE[place].map((channel) => Math.round(channel * 255)).join(', ');

/** The place in PALETTE a search mark is coloured with, or -1 if it is none of them. */
export const placeOfMark = (mark: HTMLElement): number =>
  PALETTE.findIndex((_, place) => mark.style.background.includes(channelsOf(place)));
