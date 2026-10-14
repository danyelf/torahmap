/** A passage's page on Sefaria: the book, then each part of the place in it, as in Genesis.1.1 or Berakhot.17b.11. */
export function sefariaUrl(book: string, place: readonly (string | number)[]): string {
  return `https://www.sefaria.org/${[book.replace(/ /g, '_'), ...place].join('.')}`;
}
