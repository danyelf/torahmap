import type { SearchResult } from '../../search';
import { addTerm, setMode, type SearchMode } from '../../search/terms';
import { excerpt } from '../../overlays/search/highlight';

/** A result row's quotation of its verse, for a term typed as `text` in `mode`. */
export function excerptOf(
  result: Pick<SearchResult, 'book' | 'chapter' | 'verse'>,
  text: string,
  mode: SearchMode,
): ReturnType<typeof excerpt> {
  const [added] = addTerm([], text);
  const [term] = setMode([added], added.id, mode);
  return excerpt({ language: 'he', matchingTerms: [], ...result }, term);
}
