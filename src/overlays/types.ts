// src/overlays/types.ts
import type { Verse } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';

export type Color = [number, number, number];

/**
 * Standard configuration passed to overlays that need external data.
 * Use the configure() function exported by each overlay that needs this.
 */
export interface OverlayConfig {
  verses: Verse[];
  verseTexts: VerseTexts;
  callbacks?: {
    onVerseClick?: (verse: Verse) => void;
  };
}

export interface Overlay {
  id: string;
  name: string;

  // Lifecycle - called once when app starts
  init?(): Promise<void>;
  destroy?(): void;

  // Core - called for each verse during applyOverlay
  // Return null to use default gray
  getVerseColor(verse: Verse): Color | null;

  // UI - called when overlay becomes active
  renderControls?(container: HTMLElement): void;
  renderLegend?(container: HTMLElement): void;

  // Hover - called when user hovers a verse
  getHoverInfo?(verse: Verse): string | null;

  // For dynamic overlays - register callback to trigger re-render
  onUpdate?(callback: () => void): void;

  // URL state persistence - for shareable links
  getUrlParams?(): Record<string, string>;
  applyUrlParams?(params: URLSearchParams): void;
}
