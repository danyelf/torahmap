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
  /** Told what happens to the search; what it sends, if anything, is its own business. */
  telemetry: SearchTelemetry<S, D>;
}

export interface SearchTelemetry<S, D> {
  /** The reader changed the search. */
  readerChanged(settings: S, data: D | null): void;
  /** A link or a story stop replaced the search. */
  replaced(settings: S, data: D | null): void;
  /** Search's files loaded: a search waiting for them can now be recorded. */
  dataLoaded(data: D): void;
}
