// Splitting displayed verse text into the words a reader can click.
//
// The rule has to match normalizeHebrewForSearch() in src/search.ts, which is
// what the dictionary index was built on: whitespace and maqaf separate words,
// and points and accents belong to the word they sit on. If the two drift
// apart, a click resolves the wrong word and nothing says so.

/** Maqaf, paseq, sof pasuq, nun hafukha - the separators search folds to spaces. */
const SEPARATORS = new Set([0x05be, 0x05c0, 0x05c3, 0x05c6]);

/** {פ} and {ס}: paragraph markers Sefaria leaves in the text. Not words. */
const MARKER = /^\{[פס]\}$/;

export interface VersePiece {
  text: string;
  start: number;
  end: number;
  kind: 'word' | 'separator' | 'marker';
}

function isSeparator(char: string): boolean {
  return /\s/.test(char) || SEPARATORS.has(char.codePointAt(0)!) || char === '-';
}

export function splitVerseText(text: string): VersePiece[] {
  const pieces: VersePiece[] = [];
  let index = 0;

  while (index < text.length) {
    const start = index;
    const separator = isSeparator(text[index]);
    while (index < text.length && isSeparator(text[index]) === separator) index++;

    const slice = text.slice(start, index);
    pieces.push({
      text: slice,
      start,
      end: index,
      kind: separator ? 'separator' : MARKER.test(slice) ? 'marker' : 'word',
    });
  }

  return pieces;
}
