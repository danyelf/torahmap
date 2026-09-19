import type { TanakhIdentity, TextLanguage } from '../types.ts';
import type { UrlParamSpec, UrlParamValues } from '../urlState.ts';
import type { Credit } from '../credits.ts';

export type { UrlParamSpec, UrlParamKind, UrlParamValues } from '../urlState.ts';
export type { Credit } from '../credits.ts';

export type Color = [number, number, number];

// A change to an overlay's settings: the next settings, worked out from the
// current ones. Typed through a method so that its parameter is checked
// bivariantly, like the Overlay members below; as a plain function type, S would
// sit in both directions and no Overlay<T, SomeSettings> would be an Overlay.
export type SettingsUpdate<S> = { bivarianceHack(current: S): S }['bivarianceHack'];

// Generic over the identity type T, so that Talmud overlays can declare
// Overlay<TalmudIdentity, void> (they have no settings), and over the settings
// type S, which each overlay defines for itself. The app holds an overlay's
// settings and hands them to every member that depends on them; the overlay
// keeps none of its own.
//
// Code that handles any overlay sees S as unknown, and only ever hands an
// overlay settings that the same overlay produced. An Overlay<T, SearchSettings>
// counts as an Overlay only because the members are declared as methods, which
// TypeScript checks bivariantly. Declare a member as a function-typed property
// and overlays with different settings can no longer share one list.
//
// An overlay either has settings, and implements every member of
// OverlayWithSettings, or has none and implements none of them. An overlay
// missing one of those members, with urlParams written inline, gets a tsc error
// that `kind: string` is not assignable to `UrlParamKind`, not one naming the
// missing member.
export type Overlay<T = TanakhIdentity, S = unknown> = OverlayMembers<T, S> &
  (OverlayWithSettings<S> | OverlayWithoutSettings);

interface OverlayWithSettings<S> {
  // The settings an overlay starts with, before the reader or a link says otherwise.
  defaultSettings(): S;

  // Settings to and from a shareable link. urlState.ts reads and validates the
  // link against urlParams without knowing what the values mean, so
  // settingsFromUrl receives only declared keys, with declared defaults filled
  // in. settingsToUrl leaves out any value at its default.
  urlParams: readonly UrlParamSpec[];
  settingsFromUrl(params: UrlParamValues): S;
  settingsToUrl(settings: S): Record<string, string>;
}

// The app hands an overlay without settings undefined wherever it hands settings.
interface OverlayWithoutSettings {
  defaultSettings?: never;
  urlParams?: never;
  settingsFromUrl?: never;
  settingsToUrl?: never;
}

interface OverlayMembers<T, S> {
  id: string;
  name: string;

  // Shown in the help modal's Overlays tab (a test enforces one per registered
  // overlay). Optional because internal overlays, such as the ones the Talmud
  // view composes, are never offered to a reader.
  description?: string;

  init?(): Promise<void>;
  destroy?(): void;

  // null renders default gray; Color[] stipples multiple colors via noise dithering.
  getVerseColor(verse: T, settings: S): Color | Color[] | null;

  // The same colours for many items at once, as the map and the story's blend
  // ask for them. `hovered` is the item under the cursor; only Haftarah's
  // colours depend on it.
  colorsFor?(items: T[], settings: S, hovered: T | null): (Color | Color[] | null)[];

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
  ): void;
  renderLegend?(container: HTMLElement, settings: S): void;

  // What the panel's one-line summary shows after the overlay's name; colours
  // are CSS values. Absent, the line is the name alone.
  summary?(settings: S): OverlaySummary;

  getHoverInfo?(verse: T, settings: S): string | null;

  // Declaring this marks an overlay's colours as depending on the hovered verse:
  // the map recomputes them when it says so, and the story's blend does not
  // memoise them. True when moving the hover from `before` to `after` changes them.
  hoverChangesColors?(before: T | null, after: T | null, settings: S): boolean;

  renderSidebarInfo?(verse: T, isPinned: boolean, settings: S): HTMLElement | null;

  highlightVerseText?(text: string, language: TextLanguage, settings: S): DocumentFragment;

  // The Sefaria `?with=` value this overlay wants a verse's link to open to
  // (e.g. a chosen commentary category). Absent overlays get `with=all`.
  getSefariaConnectionParam?(settings: S): string | null;

  // Outside sources this overlay depends on, shown in the help modal's Credits
  // tab. Omit when the overlay derives everything from already-credited text;
  // a test enforces this for everything else.
  credits?: readonly Credit[];
}

export interface OverlaySummary {
  /** Words, each in its own colour, as search shows its terms. */
  terms?: { text: string; color: string }[];
  detail?: string;
  colors?: string[];
}
