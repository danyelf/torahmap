import { addTerm, setMode, type SearchResult, type TextIndex } from '@torahmap/search';
import type { Dictionary } from '../../src/search/search';
import type { Parse } from '../../src/search/dictionary';
import { type SearchMode } from '../../src/search/meanings.ts';
import { excerpt } from '../../src/search/index.ts';

/** A result row's quotation of its verse, for a term typed as `text` in `mode`. */
export function excerptOf(
  result: Pick<SearchResult, 'id'>,
  text: string,
  mode: SearchMode,
  index: TextIndex,
  dictionary: Dictionary,
  parse: Parse | null = null,
): ReturnType<typeof excerpt> {
  const [added] = addTerm([], text);
  const [term] = setMode([added], added.id, mode);
  return excerpt({ matchingTerms: [], ref: result.id, ...result }, term, index, dictionary, parse);
}
