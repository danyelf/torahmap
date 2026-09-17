import type { TanakhIdentity } from '../types.ts';
import type { UrlParamSpec, UrlParamValues } from '../urlState.ts';
import type { Credit } from '../credits.ts';

export type { UrlParamSpec, UrlParamKind, UrlParamValues } from '../urlState.ts';
export type { Credit } from '../credits.ts';

export type Color = [number, number, number];

// Generic over the identity type T so that Talmud overlays can declare
// Overlay<TalmudIdentity>. Defaults to TanakhIdentity so existing Tanakh
// overlay imports compile unchanged.
export interface Overlay<T = TanakhIdentity> {
  id: string;
  name: string;

  // Shown in the help modal's Overlays tab (a test enforces one per registered
  // overlay). Optional because internal overlays, such as the ones the Talmud
  // view composes, are never offered to a reader.
  description?: string;

  init?(): Promise<void>;
  destroy?(): void;

  // null renders default gray; Color[] stipples multiple colors via noise dithering.
  getVerseColor(verse: T): Color | Color[] | null;

  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  getHoverInfo?(verse: T): string | null;

  // Returns true if the overlay needs a re-render for the new hover state.
  setHoveredVerse?(verse: T | null): boolean;

  onUpdate?(callback: () => void): void;

  // Settings worth putting in a shareable link. urlState.ts reads and validates
  // them against urlParams without knowing what they mean; getUrlParams/
  // applyUrlParams pass the values (already validated) back and forth.
  urlParams?: readonly UrlParamSpec[];
  getUrlParams?(): Record<string, string>;
  applyUrlParams?(params: UrlParamValues): void;

  renderSidebarInfo?(verse: T, isPinned: boolean): HTMLElement | null;

  highlightVerseText?(text: string, language: 'he' | 'en'): DocumentFragment;

  getLinkSubtitle?(verse: T): string | null;

  // The Sefaria `?with=` value this overlay wants a verse's link to open to
  // (e.g. a chosen commentary category). Absent overlays get `with=all`.
  getSefariaConnectionParam?(): string | null;

  // Outside sources this overlay depends on, shown in the help modal's Credits
  // tab. Omit when the overlay derives everything from already-credited text;
  // a test enforces this for everything else.
  credits?: readonly Credit[];
}
