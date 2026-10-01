// Which searched terms are worth an analytics event, and when: once the reader
// has stopped changing the search and search has its data.
import type { TextLanguage } from '../../types.ts';
import { termQuery, type SearchMode, type SearchTerm } from '../../search/terms.ts';
import type { Dictionary } from '../../search.ts';
import { dictionaryOf, type SearchData } from '../../search/data.ts';
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

export interface SearchRecorder {
  /** The reader changed the search: send it once it has sat unchanged and its data is in. */
  readerChanged(settings: SearchSettings, data: SearchData | null): void;
  /** A link or a story stop replaced the search: its terms count as sent, and a search waiting is dropped. */
  replaced(settings: SearchSettings, data: SearchData | null): void;
  /** Search's data changed: a search waiting only for it is sent now. */
  dataChanged(data: SearchData | null): void;
}

export function createSearchRecorder(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): SearchRecorder {
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

  function sendIfReady(): void {
    if (!data) return;
    const dictionary = dictionaryOf(data);
    if (replacement) {
      recorded = termsToRecord(dictionary, new Map(), activeTerms(replacement)).recorded;
      replacement = null;
    }
    if (!waiting || !settled) return;
    const settings = waiting;
    waiting = null;
    const { send, recorded: next } = termsToRecord(dictionary, recorded, activeTerms(settings));
    recorded = next;
    for (const term of send) {
      const { language, mode } = termQuery(dictionary, term);
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
    dataChanged(next) {
      data = next;
      sendIfReady();
    },
  };
}
