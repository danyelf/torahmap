import { verseId } from '@torahmap/link';
import type { Dictionary, SearchResult, TextIndex } from '../../tanakh/search/search';
import type { Parse } from '../../tanakh/search/dictionary';
import { addTerm, setMode, type SearchMode } from '../../tanakh/search/terms';
import { excerpt } from '../../tanakh/search/highlight';

/** A result row's quotation of its verse, for a term typed as `text` in `mode`. */
export function excerptOf(
  result: Pick<SearchResult, 'book' | 'chapter' | 'verse'>,
  text: string,
  mode: SearchMode,
  index: TextIndex,
  dictionary: Dictionary,
  parse: Parse | null = null,
): ReturnType<typeof excerpt> {
  const [added] = addTerm([], text);
  const [term] = setMode([added], added.id, mode);
  const id = verseId(result.book, result.chapter, result.verse);
  return excerpt({ matchingTerms: [], ...result, id }, term, index, dictionary, parse);
}
