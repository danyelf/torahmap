// Letters and digits of any script. Points, accents and punctuation are not.
const LETTER = /[\p{L}\p{N}]/gu;

/**
 * Is this a word search deals in? A single letter is not: it is never
 * searched, returned or clickable.
 */
export function isSearchableWord(text: string): boolean {
  return (text.match(LETTER)?.length ?? 0) >= 2;
}
