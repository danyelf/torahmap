import type { Dictionary, SearchResult, TextIndex } from '../../search';
import type { Parse } from '../../search/dictionary';
import { addTerm, setMode, type SearchMode } from '../../search/terms';
import { excerpt } from '../../overlays/search/highlight';

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
  return excerpt({ matchingTerms: [], ...result }, term, index, dictionary, parse);
}
