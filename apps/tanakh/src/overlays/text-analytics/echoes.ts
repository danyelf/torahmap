// The echoes file: for each verse, the verses anywhere in the Tanakh that share a repeated run of
// words with it. Free of the page, so the script that writes the file can use it too.

export const ECHOES_FILE = 'overlays/text-analytics/echoes.json';

/**
 * Verse position → the positions of the verses it echoes, ascending. A position counts verses
 * from Genesis 1:1 in the order of the verse texts file (books, then chapters, then verses). Pairs
 * are listed under both verses; a verse with no echoes is left out.
 */
export type EchoesFile = Record<string, number[]>;
