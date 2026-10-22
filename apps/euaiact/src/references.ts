// Reads a reference to the Act, such as "Article 5(1)(h)", "Recital 12" or "Annex 3".

import type { GoTo, Reference } from '@torahmap/shell/app/text.ts';
import {
  placeCompleter,
  referenceReader,
  type Named,
  type Token,
} from '@torahmap/shell/references.ts';
import { fromRoman, toRoman } from '@torahmap/utils';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { actRef, layerOf, ownerOf, type Layer } from './ids.ts';

export const EXAMPLES = ['Article 7', 'Annex III'];

const LAYERS: Named<Layer>[] = [
  { key: 'article', names: ['Article', 'Articles', 'Art', 'Arts'] },
  { key: 'recital', names: ['Recital', 'Recitals', 'Rec'] },
  { key: 'annex', names: ['Annex', 'Annexes', 'Anx'] },
];

/** An annex's number as its id writes it, from Arabic or Roman numerals; null for anything else. */
function annexNumber(text: string): string | null {
  const n = /^\d+$/.test(text) ? Number(text) : fromRoman(text);
  return n ? toRoman(n) : null;
}

/** Reads a reference to the squares `ids` name: an article, recital or annex, or a part of one. */
export function provisionReader(ids: readonly string[]): Omit<GoTo, 'examples'> {
  const articles = new Set(ids.map(ownerOf));

  /** The squares that are `key` or inside it, `below` joining the parts of an id. */
  const within = (key: string, below: string) =>
    ids.filter((id) => id === key || id.startsWith(key + below));

  function placeIn(layer: Layer, tokens: Token[]): Reference | null {
    const [first, ...rest] = tokens.map((t) => t.text);
    if (!first) return null;
    switch (layer) {
      case 'recital': {
        const id = `Recital.${first}`;
        return rest.length === 0 && ids.includes(id) ? { ref: actRef(id), ids: [id] } : null;
      }
      case 'annex': {
        const number = annexNumber(first);
        if (!number) return null;
        const found = within(['Annex', number, ...rest].join('.'), '.');
        const ref = [actRef(`Annex.${number}`), rest.join('.')].filter(Boolean).join(' ');
        return found.length ? { ref, ids: found } : null;
      }
      case 'article': {
        if (!/^\d+$/.test(first)) return null;
        // "4a" is an article of its own, written as two tokens.
        const lettered = rest[0] && /^[a-z]$/.test(rest[0]) && articles.has(first + rest[0]);
        const article = lettered ? first + rest.shift() : first;
        const key = article + rest.map((p) => `(${p})`).join('');
        const found = within(key, '(');
        return found.length ? { ref: actRef(key), ids: found } : null;
      }
    }
  }

  const { read } = referenceReader({
    named: LAYERS,
    place: placeIn,
    // A bare number is an article's.
    unnamed: (tokens) => placeIn('article', tokens),
  });
  // Every article, then annex, then recital, as readers cite it.
  const places = (['article', 'annex', 'recital'] as const).flatMap((layer) => [
    ...new Set(
      ids
        .filter((id) => layerOf(id) === layer)
        .map((id) => actRef(layer === 'article' ? ownerOf(id) : id)),
    ),
  ]);
  return { read, complete: placeCompleter(places), languageOf: () => ENGLISH };
}
