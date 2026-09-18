import type { TanakhIdentity, TextLanguage } from '../types.ts';
import type { UrlParamSpec, UrlParamValues } from '../urlState.ts';
import type { Credit } from '../credits.ts';

export type { UrlParamSpec, UrlParamKind, UrlParamValues } from '../urlState.ts';
export type { Credit } from '../credits.ts';

export type Color = [number, number, number];

// Generic over the identity type T, so that Talmud overlays can declare
// Overlay<TalmudIdentity, void> (they have no settings), and over the settings
// type S, which each overlay defines for itself. The app holds an overlay's
// settings and hands them to every member that depends on them; the overlay
// keeps none of its own.
//
// Code that handles any overlay sees S as unknown, and only ever hands an
// overlay settings that the same overlay produced.
export interface Overlay<T = TanakhIdentity, S = unknown> {
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

  // The same colours for many items at once, as the story's blend asks for
  // them. `hovered` is the item under the cursor; only Haftarah's colours
  // depend on it.
  colorsFor?(items: T[], settings: S, hovered: T | null): (Color | Color[] | null)[];

  // The settings an overlay starts with, before the reader or a link says otherwise.
  defaultSettings?(): S;

  // Settings to and from a shareable link. urlState.ts reads and validates the
  // link against urlParams without knowing what the values mean, so
  // settingsFromUrl receives only declared keys, with declared defaults filled
  // in. settingsToUrl leaves out any value at its default.
  urlParams?: readonly UrlParamSpec[];
  settingsFromUrl?(params: UrlParamValues): S;
  settingsToUrl?(settings: S): Record<string, string>;

  // Draw the controls for `settings`. Called again with the same container
  // after every change, so bring what is there up to date rather than
  // rebuilding it: a box being typed in must keep its focus. A control asks for
  // a change through onChange and never makes one itself.
  renderControls?(container: HTMLElement, settings: S, onChange: (next: S) => void): void;
  renderLegend?(container: HTMLElement, settings: S): void;

  getHoverInfo?(verse: T, settings: S): string | null;

  // Returns true if the overlay needs a re-render for the new hover state.
  setHoveredVerse?(verse: T | null): boolean;

  // For a repaint the overlay needs when something other than its settings
  // changes what it shows.
  onUpdate?(callback: () => void): void;

  renderSidebarInfo?(verse: T, isPinned: boolean, settings: S): HTMLElement | null;

  highlightVerseText?(text: string, language: TextLanguage, settings: S): DocumentFragment;

  // The Sefaria `?with=` value this overlay wants a verse's link to open to
  // (e.g. a chosen commentary category). Absent overlays get `with=all`.
  getSefariaConnectionParam?(settings: S): string | null;

  // Outside sources this overlay depends on, shown in the help modal's Credits
  // tab. Omit when the overlay derives everything from already-credited text;
  // a test enforces this for everything else.
  credits?: readonly Credit[];

  // TRANSITIONAL: the members of an overlay that still holds its own settings.
  // Such an overlay reads its settings from itself and ignores the settings
  // argument above. src/overlays/settings.ts is the one place that tells the
  // two kinds apart; these members, and that branch, go once every overlay
  // implements settingsFromUrl.
  getUrlParams?(): Record<string, string>;
  applyUrlParams?(params: UrlParamValues): void;
}
