// src/overlays/types.ts
import type { VerseIdentity, VerseLayout } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';

export type Color = [number, number, number];

/**
 * Standard configuration passed to overlays that need external data.
 * Use the configure() function exported by each overlay that needs this.
 */
export interface OverlayConfig {
  verses: VerseLayout[];
  verseTexts: VerseTexts;
  callbacks?: {
    onVerseClick?: (verse: VerseLayout) => void;
  };
}

export interface Overlay {
  id: string;
  name: string;

  // Lifecycle - called once when app starts
  init?(): Promise<void>;

  // Cleanup - called when overlay is deactivated or app is unmounted
  // Implement this if your overlay:
  // - Adds event listeners (e.g., click handlers, input handlers)
  // - Caches state that should be cleared (e.g., maps, sets, arrays)
  // - Stores callbacks or DOM references
  // Even if your overlay doesn't need cleanup, consider adding an empty destroy()
  // for consistency and future-proofing
  destroy?(): void;

  // Configuration - called to provide runtime data (verses, callbacks, etc.)
  // Use this for overlays that need access to app state or external data
  // The config parameter type is overlay-specific
  configure?(config: unknown): void;

  // Core - called for each verse during applyOverlay
  // Return null to use default gray
  // Return Color[] for stipple effect (multiple colors shown via noise dithering)
  // Takes VerseIdentity since overlays only need book/chapter/verse for domain logic
  getVerseColor(verse: VerseIdentity): Color | Color[] | null;

  // UI - called when overlay becomes active
  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  // Hover - called when user hovers a verse
  // Takes VerseIdentity since hover info is based on verse content, not position
  getHoverInfo?(verse: VerseIdentity): string | null;

  // Called when hover state changes - enables cross-highlighting
  // Returns true if overlay needs re-render, false otherwise
  // Takes VerseLayout in case overlay needs spatial info for highlighting
  setHoveredVerse?(verse: VerseLayout | null): boolean;

  // For dynamic overlays - register callback to trigger re-render
  onUpdate?(callback: () => void): void;

  // URL state persistence - for shareable links
  getUrlParams?(): Record<string, string>;
  applyUrlParams?(params: URLSearchParams): void;

  // Sidebar integration - for verse details display
  // Render overlay-specific info in the sidebar (e.g., dating info, parshah name)
  renderSidebarInfo?(verse: VerseIdentity, isPinned: boolean): HTMLElement | string | null;

  // Highlight or modify verse text display (e.g., search terms, trop marks)
  highlightVerseText?(text: string, language: 'he' | 'en'): DocumentFragment | string;

  // Provide overlay-specific link subtitle (e.g., category-specific commentary counts)
  getLinkSubtitle?(verse: VerseIdentity): string | null;
}
