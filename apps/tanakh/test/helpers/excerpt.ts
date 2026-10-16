import {
  addTerm,
  setMode,
  type SearchResult,
  type SearchTerm,
  type Snippet,
} from '@torahmap/search';
import { type SearchMode } from '../../src/search/meanings.ts';
import type { SearchData } from '../../src/search/data.ts';
import { tanakhSearch } from '../../src/search/index.ts';

/** A result row's quotation of its verse for `term`, as the panel quotes it. */
export function excerptForTerm(
  result: Pick<SearchResult, 'id'>,
  term: SearchTerm,
  data: SearchData,
): Snippet | null {
  return tanakhSearch.excerptFor(data, { matchingTerms: [], ref: result.id, ...result }, term);
}

/** A result row's quotation of its verse, for a term typed as `text` in `mode`. */
export function excerptOf(
  result: Pick<SearchResult, 'id'>,
  text: string,
  mode: SearchMode,
  data: SearchData,
): Snippet | null {
  const [added] = addTerm([], text);
  const [term] = setMode([added], added.id, mode);
  return excerptForTerm(result, term, data);
}
