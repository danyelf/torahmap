import type { SpatialItem } from '@torahmap/engine';
import type { Color } from '@torahmap/utils';
import type { TextLanguage } from '../language.ts';
import type { UrlParamSpec, UrlParamValues } from '@torahmap/link';
import type { Credit } from '../credits.ts';
import type { TextRange } from '@torahmap/utils';

export type { UrlParamSpec, UrlParamValues } from '@torahmap/link';
export type { Credit } from '../credits.ts';

/** The overlay id that stands for none: the picker's first option, and what telemetry records. */
export const NO_OVERLAY = 'none';

/** The squares the reader has the pointer on and has pinned. */
export interface Focus<T> {
  hovered: SpatialItem<T> | null;
  pinned: SpatialItem<T> | null;
}

// A change to an overlay's settings: the next settings, worked out from the
// current ones and from `taken`, the PALETTE colours the other tool (the search,
// or the overlay) holds, which a new colour must avoid. Typed through a method so
// that its parameter is checked bivariantly, like the Overlay members below; as a
// plain function type, S would sit in both directions and no Overlay<T,
// SomeSettings> would be an Overlay.
export type SettingsUpdate<S> = {
  bivarianceHack(current: S, taken: readonly number[]): S;
}['bivarianceHack'];

// Generic over T, a text's own fields on a square; over the settings type S,
// which each overlay defines for itself; and over the data type D, the files it
// reads. The app holds an overlay's settings and data and hands them to every
// member that depends on them; the overlay keeps neither.
//
// Code that handles any overlay sees S as unknown, and only ever hands an
// overlay settings that the same overlay produced. An Overlay<T, SearchSettings>
// counts as an Overlay only because the members are declared as methods, which
// TypeScript checks bivariantly. Declare a member as a function-typed property
// and overlays with different settings can no longer share one list.
//
// An overlay either has settings, and implements every member of
// OverlayWithSettings, or has none and implements none of them.
export type Overlay<T, S = unknown, D = unknown> = OverlayMembers<T, S, D> &
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

export type FileNames<D> = { readonly [K in keyof D]: null extends D[K] ? OptionalFile : string };

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
  // `taken` is as for SettingsUpdate: the colours the search holds, which a link
  // does not carry, so what is lit in a colour takes the first free one.
  urlParams: readonly UrlParamSpec[];
  settingsFromUrl(params: UrlParamValues, taken: readonly number[]): S;
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

  // The PALETTE colours these settings use, as places in it. Absent for a tool
  // that draws in none of them.
  colorsInUse?(settings: S): readonly number[];

  // One colour per item, as the map and the story's blend ask for them: null
  // renders default gray; Color[] splits the square corner to corner, one band
  // per color. `hovered` is the item under the cursor and `pinned` the
  // pinned one; only some overlays' colours depend on either, and each decides which wins.
  colorsFor(
    items: SpatialItem<T>[],
    settings: S,
    hovered: SpatialItem<T> | null,
    data: D,
    pinned?: SpatialItem<T> | null,
  ): (Color | Color[] | null)[];

  // Which of `items` stand out, as a search match does: drawn over the rest and
  // never too small to see. For an overlay that can light only a few squares.
  // `hovered` and `pinned` are as for colorsFor.
  standoutsFor?(
    items: SpatialItem<T>[],
    settings: S,
    data: D,
    hovered?: SpatialItem<T> | null,
    pinned?: SpatialItem<T> | null,
  ): boolean[];

  // Which of the standouts also keep a faint halo when zoomed in, where a
  // standout is otherwise a plain square.
  halosFor?(
    items: SpatialItem<T>[],
    settings: S,
    data: D,
    hovered?: SpatialItem<T> | null,
    pinned?: SpatialItem<T> | null,
  ): boolean[];

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

  // Says in the panel what the overlay finds about the hovered or pinned square.
  // The container is emptied before each call; `travelTo` pins a square by id and
  // brings it into view.
  renderFocus?(
    container: HTMLElement,
    hovered: SpatialItem<T> | null,
    pinned: SpatialItem<T> | null,
    settings: S,
    data: D,
    travelTo: (id: string) => void,
  ): void;

  // What the panel's one-line summary shows after the overlay's name; colours
  // are CSS values. Absent, the line is the name alone.
  summary?(settings: S, data: D): OverlaySummary;

  getHoverInfo?(item: SpatialItem<T>, settings: S, data: D): string | null;

  // Declaring this marks an overlay's colours as depending on the hovered square:
  // the map recomputes them when it says so, and the story's blend does not
  // memoise them. True when moving the hover from `before` to `after` changes them.
  hoverChangesColors?(
    before: SpatialItem<T> | null,
    after: SpatialItem<T> | null,
    settings: S,
    data: D,
  ): boolean;

  // The same for the pinned square.
  pinChangesColors?(
    before: SpatialItem<T> | null,
    after: SpatialItem<T> | null,
    settings: S,
    data: D,
  ): boolean;

  renderSidebarInfo?(
    item: SpatialItem<T>,
    isPinned: boolean,
    settings: S,
    data: D,
  ): HTMLElement | null;

  // Marks words by their place in the item's text, so it is handed the item as well as its text;
  // only inside `within`, when given.
  highlightItemText?(
    item: SpatialItem<T>,
    text: string,
    language: TextLanguage,
    settings: S,
    data: D,
    within?: readonly TextRange[],
  ): DocumentFragment;

  // The Sefaria `?with=` value this overlay wants an item's link to open to
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
  /** Colours shown as squares. */
  colors?: string[];
  /** Colours shown as squares in groups, a small gap between the groups and none within. */
  groups?: string[][];
  /** Colours shown as squares, each labeled. */
  steps?: { color: string; label: string; glows?: boolean }[];
  /** A continuous scale: its CSS gradient, between words for its low and high ends. */
  strip?: { gradient: string; ends: [low: string, high: string] };
}

/** A tool on the map, with the settings the app holds for it and its data. */
export interface ToolOnMap<T> {
  tool: Overlay<T>;
  settings: unknown;
  data: unknown;
}

/** What colours the map: the overlay and the search, each null while off. */
export interface Tools<T> {
  overlay: ToolOnMap<T> | null;
  search: ToolOnMap<T> | null;
}
