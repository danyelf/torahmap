// A text's search: the tool beside the overlay, with its own panel, legend row
// and link keys. What its settings and data are is the search's own business;
// the shell holds them and hands them back.
import type { Overlay } from '../overlays/types.ts';

// Members are methods so that, as with Overlay, a SearchTool<T, SomeSettings>
// is a SearchTool<T>.
export type SearchTool<T, S = unknown, D = unknown> = Overlay<T, S, D> & SearchMembers<S, D>;

interface SearchMembers<S, D> {
  /** Whether `settings` search on anything. While not, search colours nothing. */
  isSearching(settings: S): boolean;
  /** Puts the cursor in the search box. */
  focus(): void;
  /** Hears what happens to the search, for telemetry. */
  recorder: SearchRecorder<S, D>;
  /** Whether a menu search opened over the popup is showing, so the popup must not be redrawn under it. */
  holdsPopup?(): boolean;
}

export interface SearchRecorder<S, D> {
  /** The reader changed the search. */
  readerChanged(settings: S, data: D | null): void;
  /** A link or a story stop replaced the search. */
  replaced(settings: S, data: D | null): void;
  /** Search's files loaded: a search waiting for them can now be recorded. */
  dataLoaded(data: D): void;
}
