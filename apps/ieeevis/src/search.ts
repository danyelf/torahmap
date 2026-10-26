// Every piece’s text; a paper’s first piece also carries its title and authors.
import { memoByValue } from '@torahmap/utils';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { buildTextIndex, createTermSearch, english, type SearchEntry } from '@torahmap/search';
import { STRUCTURE_FILE, TEXTS_FILE, type PaperTexts, type Structure } from './data.ts';
import { pieceId } from './layout.ts';
import type { PieceItem } from './layout.ts';

export interface VisSearchData {
  structure: Structure;
  texts: PaperTexts;
}

const LANGUAGES = [english];

/** What a square shows and search reads: its text, after the authors on a paper's first piece. */
export function squareBody(
  { paper, piece }: Pick<PieceItem, 'paper' | 'piece'>,
  text?: string,
): string {
  const parts = [piece === 0 ? paper.authors.join(', ') : '', text ?? 'No text yet.'];
  return parts.filter(Boolean).join('\n\n');
}

function* entries({ structure, texts }: VisSearchData): Iterable<SearchEntry> {
  for (const day of structure.days) {
    for (const session of day.sessions) {
      for (const paper of session.papers) {
        for (let n = 0; n < paper.pieces.length; n++) {
          const id = pieceId(paper.index, n);
          // The title is the popup's heading, so only a paper's first square shows it to search.
          const shown = squareBody({ paper, piece: n }, texts[id]);
          const body = n === 0 ? `${paper.title}\n\n${shown}` : shown;
          yield { id, ref: paper.title, text: { [english.id]: body } };
        }
      }
    }
  }
}

const indexes = memoByValue((data: VisSearchData) => buildTextIndex(entries(data), LANGUAGES));

const search = createTermSearch<PieceItem, VisSearchData>({
  languages: LANGUAGES,
  data: { structure: STRUCTURE_FILE, texts: TEXTS_FILE },
  index: (data) => indexes(data),
  noun: { one: 'piece', many: 'pieces' },
  placeholder: 'Search the papers…',
  description: 'Finds a word or phrase in any paper’s title, authors or text.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const visSearch = search.tool;
export const configureSearch = search.configure;
