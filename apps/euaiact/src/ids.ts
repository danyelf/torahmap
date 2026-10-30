// A square's id, and what it names: a recital, an article's unit, or an annex's.

import { EUR_LEX } from './page.ts';

export type Layer = 'recital' | 'article' | 'annex';

const RECITAL = 'Recital.';
const ANNEX = 'Annex.';

export const recitalId = (number: string): string => RECITAL + number;

/** An annex's id, or a part's within it: ("III", "2") is Annex III's point 2. */
export const annexId = (number: string, ...parts: string[]): string =>
  ANNEX + [number, ...parts].join('.');

export function layerOf(id: string): Layer {
  if (id.startsWith(RECITAL)) return 'recital';
  return id.startsWith(ANNEX) ? 'annex' : 'article';
}

/**
 * What a reference names for this square: the article it is in ("5" for "5(1)(h)"), "Annex III"
 * for any square of that annex, and a recital's own id.
 */
export function ownerOf(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return id;
    case 'annex':
      return `Annex ${id.split('.')[1]}`;
    default:
      return id.split('(')[0];
  }
}

/** A square as readers cite it: "Recital 12", "Article 5(1)(h)", "Annex III". */
export function actRef(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return `Recital ${id.slice(RECITAL.length)}`;
    case 'annex':
      return ownerOf(id);
    default:
      return `Article ${id}`;
  }
}

/** Where the square's text is on EUR-Lex: its recital, article or annex. */
export function sourceUrl(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return `${EUR_LEX}#rct_${id.slice(RECITAL.length)}`;
    case 'annex':
      return `${EUR_LEX}#anx_${id.split('.')[1]}`;
    default:
      return `${EUR_LEX}#art_${ownerOf(id)}`;
  }
}
