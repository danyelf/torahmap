import type { SearchLanguage } from './language.ts';
import type { SearchTerm } from './terms.ts';

/**
 * A way of matching a term that a text brings beside substring and whole word,
 * such as the Tanakh's meanings. `X` is what it works from, built from the
 * search's files; null while they are missing.
 */
export interface ExtraMode<X> {
  /** The term's `mode` while matched this way. */
  readonly id: string;
  /** Its letter in the link's `mode`. */
  readonly letter: string;
  /** Offered in this term's mode control. */
  offered(term: SearchTerm, language: SearchLanguage): boolean;
  /** Can match this term now; where not, the term is matched as a whole word. */
  possible(x: X | null, term: SearchTerm, language: SearchLanguage): boolean;
  /** The term's mode while the reader has not chosen one. */
  isDefault(term: SearchTerm, language: SearchLanguage): boolean;
}
