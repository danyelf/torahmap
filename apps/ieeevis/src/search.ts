// Search over the papers' titles, authors and text.
import { memoByValue } from '@torahmap/utils';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { buildTextIndex, createTermSearch, english, type SearchEntry } from '@torahmap/search';
import { papersOf, STRUCTURE_FILE, TEXTS_FILE, type PaperTexts, type Structure } from './data.ts';
import { pieceId } from './layout.ts';
import type { PieceItem } from './layout.ts';

interface VisSearchData {
  structure: Structure;
  texts: PaperTexts;
}

/** A piece's id is its paper's number, a dot and its place in the paper. */
export const paperOf = (pieceId: string) => pieceId.slice(0, pieceId.indexOf('.'));

const LANGUAGES = [english];

/** What a square shows and search reads: its text, after the authors on a paper's first piece. */
export function squareBody(
  { paper, piece }: Pick<PieceItem, 'paper' | 'piece'>,
  text = '',
): string {
  return [piece === 0 ? paper.authors.join(', ') : '', text].filter(Boolean).join('\n\n');
}

/** One entry for each piece that has words to find: a paper's first also has its title. */
export function* pieceEntries({ structure, texts }: VisSearchData): Iterable<SearchEntry> {
  for (const paper of papersOf(structure)) {
    for (let n = 0; n < paper.pieces.length; n++) {
      const id = pieceId(paper.index, n);
      const body = squareBody({ paper, piece: n }, texts[id]);
      // The title is the popup's heading, so only a paper's first square shows it to search.
      const words = n === 0 ? `${paper.title}\n\n${body}` : body;
      if (words) yield { id, ref: paper.title, text: { [english.id]: words } };
    }
  }
}

const indexes = memoByValue((data: VisSearchData) => buildTextIndex(pieceEntries(data), LANGUAGES));

const search = createTermSearch<PieceItem, VisSearchData>({
  languages: LANGUAGES,
  data: { structure: STRUCTURE_FILE, texts: TEXTS_FILE },
  index: (data) => indexes(data),
  noun: { one: 'piece', many: 'pieces' },
  countedAs: { noun: { one: 'paper', many: 'papers' }, of: paperOf },
  placeholder: 'Search the papers…',
  description: 'Finds a word or phrase in any paper’s title, authors or text.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const visSearch = search.tool;
export const configureSearch = search.configure;
