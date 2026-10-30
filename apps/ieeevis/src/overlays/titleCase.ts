// How a keyword is shown: in Title Case, leaving acronyms and mixed-case words as written.

/** Joining words that stay lower case, except as the first word. */
const SMALL = new Set(
  'a an and as at but by for from in into nor of on or per the to via vs with'.split(' '),
);

/** A word keeps its own case if it has a capital past its first letter, or a digit: LLM, t-SNE, 3D. */
const keepsCase = (word: string): boolean => /\d|\p{L}.*\p{Lu}/u.test(word);

const capitalised = (word: string): string => word.replace(/\p{L}/u, (c) => c.toUpperCase());

export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word, i) => {
      if (keepsCase(word)) return word;
      return word
        .split('-')
        .map((part, j) =>
          i + j > 0 && SMALL.has(part.toLowerCase()) ? part.toLowerCase() : capitalised(part),
        )
        .join('-');
    })
    .join(' ');
}
