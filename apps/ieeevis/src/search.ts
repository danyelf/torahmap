// Every piece's text, with its paper's title, authors and session.
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

/** What a square shows and search reads: its paper's title, authors and session, then its text. */
export function squareBody(item: PieceItem, text: string | undefined): string {
  const { title, authors, when } = item.paper;
  const head = [title, authors.join(', '), [item.session, when].filter(Boolean).join(' · ')];
  return text ? `${head.join('\n')}\n\n${text}` : head.join('\n');
}

function* entries({ structure, texts }: VisSearchData): Iterable<SearchEntry> {
  for (const day of structure.days) {
    for (const session of day.sessions) {
      for (const paper of session.papers) {
        for (let n = 0; n < paper.pieces.length; n++) {
          const id = pieceId(paper.index, n);
          const body = squareBody({ paper, session: session.name } as PieceItem, texts[id]);
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
  description: 'Finds a word or phrase in any paper’s title, authors, session or text.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const visSearch = search.tool;
export const configureSearch = search.configure;
