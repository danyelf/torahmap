// How long the search must sit unchanged before it is recorded, so typing a
// word is one event rather than one per letter
export const SEARCH_RECORD_DELAY_MS = 1000;

/**
 * What separates one search term from the next: English comma, Arabic comma,
 * left-to-right mark, Hebrew gershayim.
 *
 * Read both when a query string arrives and when the reader types, so that a
 * term can never hold a character that would later split it: such a term
 * comes back as two, shifting every later term's mode and meaning onto the
 * wrong word.
 */
export const TERM_SEPARATORS = /[,،‎״]/;

export const SEARCH_SNIPPET_MAX_LENGTH = 60;
export const SEARCH_SNIPPET_CONTEXT_BEFORE = 20; // characters shown before the match
