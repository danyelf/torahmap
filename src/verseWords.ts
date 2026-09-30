// Splitting displayed verse text into the words a reader can click.
//
// Where a word ends is decided in src/hebrew.ts, which is also what the
// dictionary index was built on. A click resolving a different word than
// search would find is the failure this shares a rule to avoid.

import {
  isSearchableWord,
  normalizeHebrewForSearch,
  splitIntoWords,
  type TextWord,
} from './hebrew.ts';

/** {פ} and {ס}: paragraph markers Sefaria leaves in the text. Not words. */
const SECTION_MARKER = /^\{[פס]\}$/;

export function isSectionMarker(word: string): boolean {
  return SECTION_MARKER.test(word);
}

/**
 * The words of a verse a reader can click, in order. A word's position in
 * this list is its index: what a click reports and the parse is looked up by.
 */
export function verseWords(text: string): TextWord[] {
  return splitIntoWords(text).filter(
    ({ word }) => !isSectionMarker(word) && isSearchableWord(word),
  );
}

/**
 * The spelling to look a clicked word up under.
 *
 * Sefaria writes a textual variant as a pair of words: the form the scribes
 * wrote, in round brackets, followed by the form that is actually read aloud,
 * in square brackets. Neither kind of bracket is a letter of the word, and no
 * dictionary key contains one, so every bracket is dropped before the lookup -
 * including the lone one each end of a phrase bracketed over two words
 * carries - while the verse and the panel go on showing the word exactly as it
 * is written, because that is what the reader clicked.
 */
export function lookupForm(displayed: string): string {
  return normalizeHebrewForSearch(displayed.replace(BRACKETS, ''));
}

const BRACKETS = /[[\]()]/g;

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
  // The walk below trusts that offsets into `text` line up with the
  // fragment's own text nodes. Nothing upstream guarantees that - an overlay
  // could hand back text that has drifted from the verse it was built from -
  // so check it here. Wrapping nothing leaves the words visibly inert rather
  // than clickable and wrong.
  if (fragment.textContent !== text) {
    console.warn(
      'wrapWordsInFragment: fragment text does not match verse text, leaving words unwrapped',
      { fragmentText: fragment.textContent, verseText: text },
    );
    return fragment;
  }

  const words = verseWords(text);

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
