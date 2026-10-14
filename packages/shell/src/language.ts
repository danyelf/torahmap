export const HEBREW = 'he';
export const ENGLISH = 'en';

/**
 * Which of a verse's two texts is in hand: the Hebrew or the English.
 *
 * It decides how text is folded for matching and where a word ends, so it
 * travels with the text rather than being guessed from it.
 */
export type TextLanguage = typeof HEBREW | typeof ENGLISH;
