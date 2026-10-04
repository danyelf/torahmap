import type { Color, TanakhIdentity, TextLanguage } from '../types.ts';
import type { UrlParamSpec, UrlParamValues } from '@torahmap/link';
import type { Credit } from '../credits.ts';

export type { UrlParamSpec, UrlParamKind, UrlParamValues } from '@torahmap/link';
export type { Credit } from '../credits.ts';

export type { Color };

// A change to an overlay's settings: the next settings, worked out from the
// current ones. Typed through a method so that its parameter is checked
// bivariantly, like the Overlay members below; as a plain function type, S would
// sit in both directions and no Overlay<T, SomeSettings> would be an Overlay.
export type SettingsUpdate<S> = { bivarianceHack(current: S): S }['bivarianceHack'];

// Generic over the identity type T, so that Talmud overlays can declare
// Overlay<TalmudIdentity, void, void> (they have no settings and no data); over
// the settings type S, which each overlay defines for itself; and over the data
// type D, the files it reads. The app holds an overlay's settings and data and
// hands them to every member that depends on them; the overlay keeps neither.
//
// Code that handles any overlay sees S as unknown, and only ever hands an
// overlay settings that the same overlay produced. An Overlay<T, SearchSettings>
// counts as an Overlay only because the members are declared as methods, which
// TypeScript checks bivariantly. Declare a member as a function-typed property
// and overlays with different settings can no longer share one list.
//
// An overlay either has settings, and implements every member of
// OverlayWithSettings, or has none and implements none of them.
export type Overlay<T = TanakhIdentity, S = unknown, D = unknown> = OverlayMembers<T, S, D> &
  (OverlayWithSettings<S> | OverlayWithoutSettings) &
  DataPart<D>;

// An overlay names its files exactly when it takes data. Code that handles any
// overlay sees D as unknown, and either kind.
type DataPart<D> = unknown extends D
  ? OverlayWithData<D> | OverlayWithoutData
  : [D] extends [void]
    ? OverlayWithoutData
    : OverlayWithData<D>;

// An overlay that reads files names each by its own short name, as a path under
// public/data/. The app loads every path once and hands the overlay D: each
// file's contents under its name. A file the overlay can work without is typed
// `T | null` in D and named with optional(). Whatever the overlay derives from
// its files it keeps per value of the file it is derived from.
interface OverlayWithData<D> {
  data: FileNames<D>;
  // Work out ahead of first use what the overlay derives from its data. The
  // app calls it when the browser is idle; a member called first works out the
  // same thing on demand, so this changes when the work happens, never the result.
  prebuild?(data: D): void;
}

/** A file its reader can work without: handed over as null until it is in, and never waited for. */
export interface OptionalFile {
  readonly optional: string;
}

type FileNames<D> = { readonly [K in keyof D]: null extends D[K] ? OptionalFile : string };

// The app hands an overlay that names no files undefined wherever it hands data.
interface OverlayWithoutData {
  data?: never;
  prebuild?: never;
}

interface OverlayWithSettings<S> {
  // Settings to and from a shareable link. @torahmap/link reads and validates
  // the link against urlParams without knowing what the values mean, so
  // settingsFromUrl receives only declared keys, with declared defaults filled
  // in; an empty link gives the settings the overlay starts with. A value
  // settingsToUrl writes at its declared default stays out of the link.
  urlParams: readonly UrlParamSpec[];
  settingsFromUrl(params: UrlParamValues): S;
  settingsToUrl(settings: S): Record<string, string>;
}

// The app hands an overlay without settings undefined wherever it hands settings.
interface OverlayWithoutSettings {
  urlParams?: never;
  settingsFromUrl?: never;
  settingsToUrl?: never;
}

interface OverlayMembers<T, S, D> {
  id: string;
  name: string;

  // Shown under the overlay picker, and its first sentence on the button that
  // offers it while None is chosen (a test enforces one for search and per
  // registered overlay). Optional because internal overlays, such as the ones
  // the Talmud view composes, are never offered to a reader.
  description?: string;

  destroy?(): void;

  // null renders default gray; Color[] splits the square corner to corner, one band per color.
  getVerseColor(verse: T, settings: S, data: D): Color | Color[] | null;

  // The same colours for many items at once, as the map and the story's blend
  // ask for them. `hovered` is the item under the cursor; only Haftarah's
  // colours depend on it.
  colorsFor(items: T[], settings: S, hovered: T | null, data: D): (Color | Color[] | null)[];

  // The panel may be drawn without the overlay's data; then data is null.
  //
  // Draw the controls for `settings`. The app calls this again with the same
  // container after a change, so bring what is there up to date rather than
  // rebuilding it: a box being typed in must keep its focus.
  //
  // A control asks for a change by handing onChange a function from the current
  // settings to the next. The app applies each update exactly once, immediately,
  // to the settings it holds, so a control never needs, and must never keep, a
  // copy of them to write from.
  renderControls?(
    container: HTMLElement,
    settings: S,
    onChange: (update: SettingsUpdate<S>) => void,
    data: D | null,
  ): void;
  renderLegend?(container: HTMLElement, settings: S, data: D | null): void;

  // What the panel's one-line summary shows after the overlay's name; colours
  // are CSS values. Absent, the line is the name alone.
  summary?(settings: S, data: D): OverlaySummary;

  getHoverInfo?(verse: T, settings: S, data: D): string | null;

  // Declaring this marks an overlay's colours as depending on the hovered verse:
  // the map recomputes them when it says so, and the story's blend does not
  // memoise them. True when moving the hover from `before` to `after` changes them.
  hoverChangesColors?(before: T | null, after: T | null, settings: S, data: D): boolean;

  renderSidebarInfo?(verse: T, isPinned: boolean, settings: S, data: D): HTMLElement | null;

  // Marks words by their place in the verse, so it is handed the verse as well as its text.
  highlightVerseText?(
    verse: T,
    text: string,
    language: TextLanguage,
    settings: S,
    data: D,
  ): DocumentFragment;

  // The Sefaria `?with=` value this overlay wants a verse's link to open to
  // (e.g. a chosen commentary category). Absent overlays get `with=all`.
  getSefariaConnectionParam?(settings: S): string | null;

  // Outside sources this overlay depends on, credited in the About & settings
  // panel. Omit when the overlay derives everything from already-credited text;
  // a test enforces this for everything else.
  credits?: readonly Credit[];
}

export interface OverlaySummary {
  /** Words, each in its own colour, as search shows its terms. */
  terms?: { text: string; color: string }[];
  detail?: string;
  colors?: string[];
}

/** A tool on the map, with the settings the app holds for it and its data. */
export interface ToolOnMap<T = TanakhIdentity> {
  tool: Overlay<T>;
  settings: unknown;
  data: unknown;
}

/** What colours the map: the overlay and the search, each null while off. */
export interface Tools<T = TanakhIdentity> {
  overlay: ToolOnMap<T> | null;
  search: ToolOnMap<T> | null;
}
