// Which searched terms are worth an analytics event, and when: once the reader
// has stopped changing the search and search has its data.
import type { SearchTelemetry } from '../../app/search.ts';
import type { TextLanguage } from '../../types.ts';
import { termQuery, type SearchMode, type SearchTerm } from './terms.ts';
import type { Dictionary } from './search.ts';
import { dictionaryOf, type SearchData } from './data.ts';
import { debounce } from '../../utils/debounce.ts';
import { activeTerms, termHitCount, type SearchSettings } from './index.ts';

/** What was last recorded for each term, by term id. */
export type Recorded = ReadonlyMap<string, string>;

/** What a term is recorded as: its query, with the meanings as chosen rather than looked up. */
function recordOf(dictionary: Dictionary, term: SearchTerm): string {
  const { text, language, mode } = termQuery(dictionary, term);
  // Chosen meanings narrow a term only while it is matched by its meanings.
  return JSON.stringify({ text, language, mode, chosen: mode === 'meanings' ? term.chosen : null });
}

/**
 * The terms among `active` that are new or whose record differs from `previous`, and the
 * record to keep afterwards: exactly the active terms, so a removed term is
 * forgotten.
 */
export function termsToRecord(
  dictionary: Dictionary,
  previous: Recorded,
  active: readonly SearchTerm[],
): { send: SearchTerm[]; recorded: Recorded } {
  const recorded = new Map(active.map((term) => [term.id, recordOf(dictionary, term)]));
  const send = active.filter((term) => previous.get(term.id) !== recorded.get(term.id));
  return { send, recorded };
}

/** A search a link or a story stop put in place counts as already sent, and drops one waiting. */
export function searchTelemetry(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): SearchTelemetry<SearchSettings, SearchData> {
  let recorded: Recorded = new Map();
  /**
   * A search that replaced the reader's, to count as sent. A term's record
   * needs the dictionary, so it waits for search's data.
   */
  let replacement: SearchSettings | null = null;
  /** The reader's last change, not yet sent. */
  let waiting: SearchSettings | null = null;
  let settled = false;
  let data: SearchData | null = null;

  /** termsToRecord, leaving the dictionary unbuilt while no word is typed: search's prebuild builds it. */
  function record(ready: SearchData, previous: Recorded, active: readonly SearchTerm[]) {
    return active.length === 0
      ? { send: [], recorded: new Map() }
      : termsToRecord(dictionaryOf(ready), previous, active);
  }

  function sendIfReady(): void {
    if (!data) return;
    if (replacement) {
      recorded = record(data, new Map(), activeTerms(replacement)).recorded;
      replacement = null;
    }
    if (!waiting || !settled) return;
    const settings = waiting;
    waiting = null;
    const { send, recorded: next } = record(data, recorded, activeTerms(settings));
    recorded = next;
    for (const term of send) {
      const { language, mode } = termQuery(dictionaryOf(data), term);
      options.send(term.text, language, mode, termHitCount(data, settings, term)!);
    }
  }

  const settle = debounce(() => {
    settled = true;
    sendIfReady();
  }, options.delayMs);

  return {
    readerChanged(settings, next) {
      waiting = settings;
      settled = false;
      data = next;
      settle();
    },
    replaced(settings, next) {
      settle.cancel();
      waiting = null;
      replacement = settings;
      data = next;
      sendIfReady();
    },
    dataLoaded(next) {
      data = next;
      sendIfReady();
    },
  };
}
