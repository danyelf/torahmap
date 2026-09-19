// Which searched terms are worth an analytics event: the ones the reader has
// changed since they were last recorded.
import { termQuery, type SearchTerm } from '../../search/terms.ts';

/** What was last recorded for each term, by term id. */
export type Recorded = ReadonlyMap<string, string>;

function recordOf(term: SearchTerm): string {
  return JSON.stringify(termQuery(term));
}

/**
 * The terms among `active` that are new or whose termQuery differs from `previous`, and the
 * record to keep afterwards: exactly the active terms, so a removed term is
 * forgotten.
 */
export function termsToRecord(
  previous: Recorded,
  active: readonly SearchTerm[],
): { send: SearchTerm[]; recorded: Recorded } {
  const recorded = new Map(active.map((term) => [term.id, recordOf(term)]));
  const send = active.filter((term) => previous.get(term.id) !== recorded.get(term.id));
  return { send, recorded };
}
