import type { SearchLanguage, TextRange } from './language.ts';
import type { SearchTerm } from './terms.ts';

/**
 * A way of matching a term that a text brings beside substring and whole word,
 * such as the Tanakh's meanings. `X` is what it works from, built from the
 * search's files; null while they are missing. `D` is those files.
 *
 * What it has chosen for a term lives in the term's `chosen`, which the search
 * keeps and clears but never reads.
 */
export interface ExtraMode<X, D = unknown> {
  /** The term's `mode` while matched this way. */
  readonly id: string;
  /** Its letter in the link's `mode`. */
  readonly letter: string;
  /** Its name in the mode control. */
  readonly label: string;
  /** The mode control's note on the option while it cannot be chosen. */
  readonly unavailable?: string;
  /** Offered in this term's mode control. */
  offered(term: SearchTerm, language: SearchLanguage): boolean;
  /** Can match this term now; where not, the term is matched as a whole word. */
  possible(x: X | null, term: SearchTerm, language: SearchLanguage): boolean;
  /** The term's mode while the reader has not chosen one. */
  isDefault(term: SearchTerm, language: SearchLanguage): boolean;

  /** What it works from. The same files give the same object. */
  build?(data: D): X;
  /** The ids of the items a term in this mode finds. */
  itemsFor?(x: X, term: SearchTerm): ReadonlySet<string>;
  /** The stretches of an item's text, in its own positions, that a term in this mode claims. */
  ranges?(
    x: X,
    term: SearchTerm,
    at: { itemId: string; text: string; language: SearchLanguage },
  ): TextRange[];
  /** The stretch a result row quotes around, from the term's `ranges` in that item. */
  quoted?(term: SearchTerm, text: string, ranges: TextRange[]): TextRange;
  /** What hovering an item says of a term in this mode, in place of the term's text. */
  hoverNote?(x: X, term: SearchTerm, itemId: string): string;
  /** What a collapsed row says after the mode's name, or null for nothing. */
  summary?(x: X, term: SearchTerm): string | null;
  /** A button in the open row that undoes what was chosen, shown while there is something to undo. */
  readonly restore?: {
    readonly label: string;
    readonly title: string;
    shown(x: X, term: SearchTerm): boolean;
    apply(terms: SearchTerm[], id: string): SearchTerm[];
  };
  /**
   * Draw its choices for the open row, below the mode control, or clear them
   * while the term is not matched this way. `x` is null while the data is missing.
   */
  renderBody?(
    body: HTMLElement,
    term: SearchTerm,
    inThisMode: boolean,
    x: X | null,
    edit: (change: (terms: SearchTerm[]) => SearchTerm[]) => void,
  ): void;
  /** The link key holding each term's choice, and how it is written and read. */
  readonly param?: {
    readonly key: string;
    write(terms: SearchTerm[]): string;
    read(terms: SearchTerm[], value: string): SearchTerm[];
  };
}
