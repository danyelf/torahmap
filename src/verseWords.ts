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

/**
 * Make every word in an already-built fragment clickable.
 *
 * The fragment may come from an overlay that has wrapped parts of the text in
 * <mark> elements - search marks whole matches, trop marks single accents
 * inside words. Rather than fight that, this walks the text nodes in order,
 * keeps count of where it is in the original string, and wraps each word's
 * text in a span.
 *
 * A word broken up by a mark becomes more than one span. They share a word
 * index, which is why the index is what a click reads rather than the span's
 * own text: one word, one answer, however many pieces it arrived in.
 */
export function wrapWordsInFragment(fragment: DocumentFragment, text: string): DocumentFragment {
  const words = splitVerseText(text).filter((piece) => piece.kind === 'word');

  // Which word covers a given offset, or null between words. Offsets are
  // visited in increasing order as the walk proceeds, so the search can pick
  // up from the last word it found instead of scanning from the start every
  // time.
  let searchFrom = 0;
  const wordAt = (offset: number): number | null => {
    while (searchFrom > 0 && words[searchFrom - 1].end > offset) searchFrom--;
    while (searchFrom < words.length && words[searchFrom].end <= offset) searchFrom++;
    const word = words[searchFrom];
    return word && offset >= word.start && offset < word.end ? searchFrom : null;
  };

  let offset = 0;

  const walk = (node: Node): void => {
    // Copy the child list first: wrapping replaces nodes as we go.
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const content = child.textContent ?? '';
        const replacement = document.createDocumentFragment();
        let cursor = 0;

        while (cursor < content.length) {
          const index = wordAt(offset + cursor);
          let run = cursor + 1;
          while (run < content.length && wordAt(offset + run) === index) run++;

          const slice = content.slice(cursor, run);
          if (index === null) {
            replacement.appendChild(document.createTextNode(slice));
          } else {
            const span = document.createElement('span');
            span.className = 'verse-word';
            span.dataset.wordIndex = String(index);
            span.textContent = slice;
            replacement.appendChild(span);
          }
          cursor = run;
        }

        offset += content.length;
        child.parentNode?.replaceChild(replacement, child);
      } else {
        walk(child);
      }
    }
  };

  walk(fragment);
  return fragment;
}
