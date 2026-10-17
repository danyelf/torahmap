// A square's id, and what it names: a recital, an article's unit, or an annex's.

import { EUR_LEX } from './page.ts';

export type Layer = 'recital' | 'article' | 'annex';

export function layerOf(id: string): Layer {
  if (id.startsWith('Recital.')) return 'recital';
  return id.startsWith('Annex.') ? 'annex' : 'article';
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

/** A number from a square's id, the seed for its jitter. */
export function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

/** A square as readers cite it: "Recital 12", "Article 5(1)(h)", "Annex III". */
export function actRef(id: string): string {
  switch (layerOf(id)) {
    case 'recital':
      return `Recital ${id.slice('Recital.'.length)}`;
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
      return `${EUR_LEX}#rct_${id.slice('Recital.'.length)}`;
    case 'annex':
      return `${EUR_LEX}#anx_${id.split('.')[1]}`;
    default:
      return `${EUR_LEX}#art_${ownerOf(id)}`;
  }
}
