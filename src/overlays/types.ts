// src/overlays/types.ts
import type { TanakhIdentity, TanakhLayout } from "../types.ts";
import type { VerseTexts } from "../verseTexts.ts";
import type { UrlParamSpec } from "../urlState.ts";

export type { UrlParamSpec, UrlParamKind } from "../urlState.ts";

export type Color = [number, number, number];

/**
 * Standard configuration passed to overlays that need external data.
 * Use the configure() function exported by each overlay that needs this.
 */
export interface OverlayConfig {
  verses: TanakhLayout[];
  verseTexts: VerseTexts;
  callbacks?: {
    onVerseClick?: (verse: TanakhLayout) => void;
  };
}

// Each overlay manages its own module-level state. A factory-per-overlay pattern
// would make destroy() cleaner, but the current approach is simpler for 6 stable overlays.
//
// Generic over the identity type T so that Talmud overlays can declare
// Overlay<TalmudIdentity>. Defaults to TanakhIdentity so existing Tanakh
// overlay imports compile unchanged.
export interface Overlay<T = TanakhIdentity> {
  id: string;
  name: string;

  // Lifecycle - called once when app starts
  init?(): Promise<void>;
  destroy?(): void;

  // Core - called for each verse during applyOverlay
  // Return null to use default gray
  // Return Color[] for stipple effect (multiple colors shown via noise dithering)
  getVerseColor(verse: T): Color | Color[] | null;

  // UI - called when overlay becomes active
  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  // Hover - called when user hovers a verse
  getHoverInfo?(verse: T): string | null;

  // Called when hover state changes - enables cross-highlighting
  // Returns true if overlay needs re-render, false otherwise
  setHoveredVerse?(verse: T | null): boolean;

  // For dynamic overlays - register callback to trigger re-render
  onUpdate?(callback: () => void): void;

  // URL state persistence - for shareable links.
  //
  // An overlay that has settings worth sharing declares them here. `urlParams`
  // names the keys and says what shape each value has, so that urlState.ts can
  // read them out of the hash and check them without knowing what they mean.
  // getUrlParams() reports the current settings using those same keys, omitting
  // any that are still at their default; applyUrlParams() takes them back.
  urlParams?: readonly UrlParamSpec[];
  getUrlParams?(): Record<string, string>;
  applyUrlParams?(params: URLSearchParams): void;

  // Sidebar integration - for verse details display
  renderSidebarInfo?(
    verse: T,
    isPinned: boolean,
  ): HTMLElement | string | null;

  // Highlight or modify verse text display (e.g., search terms, trop marks)
  highlightVerseText?(
    text: string,
    language: "he" | "en",
  ): DocumentFragment | string;

  // Provide overlay-specific link subtitle (e.g., category-specific commentary counts)
  getLinkSubtitle?(verse: T): string | null;
}
