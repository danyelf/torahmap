// Which searched terms are worth an analytics event: the ones the reader has
// changed since they were last recorded.
import { ENGLISH, HEBREW } from '../../types.ts';
import { effectiveMode, termIsHebrew, type SearchTerm } from '../../search/terms.ts';

/** What was last recorded for each term, by term id. */
export type Recorded = ReadonlyMap<string, string>;

/** What a term is recorded as: what was typed and chosen, none of it looked up. */
function recordOf(term: SearchTerm): string {
  return JSON.stringify({
    text: term.text.trim(),
    language: termIsHebrew(term) ? HEBREW : ENGLISH,
    mode: effectiveMode(term),
    // Chosen meanings narrow a term only while it is matched by its meanings.
    chosen: effectiveMode(term) === 'meanings' ? term.chosen : null,
  });
}

/**
 * The terms among `active` that are new or whose record differs from `previous`, and the
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
