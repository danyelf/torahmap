// src/themes.ts
// Core palette registry — one canonical record per shipped theme.

import type { Color } from './overlays/types.ts';

export type ThemeId =
  | 'refined-grey'
  | 'newsprint'
  | 'plum'
  | 'oxblood'
  | 'manuscript'
  | 'okabe';

/**
 * Structural-color overrides for the Talmud surface. Optional — themes that
 * don't define it fall back to a polarity-keyed default (see Task 12).
 */
export interface TalmudTheme {
  mishnahBase: Color;
  gemaraBase: Color;
  sederBackgrounds: Record<string, Color>;       // keyed by SEDER_ORDER strings
  sederBackgroundOpacity: number;
  segmentLength: { pale: Color; dark: Color };
}

export interface CoreTheme {
  id: ThemeId;
  name: string;
  polarity: 'dark' | 'light';
  bg: Color;
  cssBg: string;
  dust: { min: number; max: number; tint?: Color };
  dim: number;
  searchHues: Color[];
  outlines: {
    default: Color;
    hover: Color;
    pin: Color;
    hoverWhilePinned: Color;
  };
  chrome: {
    fg: string;
    sidebarBg: string;
    sidebarFg: string;
    link: string;
  };
  talmud?: TalmudTheme;                          // optional; polarity fallback handles missing
}

/**
 * Generic per-overlay theme contribution table. Used by data overlays to
 * declare per-theme color sets with a polarity fallback.
 *
 * Resolution order at runtime (see pick<T> in Task 2):
 *   1. byTheme[currentTheme.id] — explicit per-theme tuning
 *   2. light polarity → lightFallback
 *   3. dark polarity → byTheme['refined-grey'] (always defined)
 *
 * Refined-grey is the canonical dark fallback. If a future palette ever
 * displaces it, update pick() rather than touching every overlay.
 */
export interface ThemedTable<T> {
  byTheme: Partial<Record<ThemeId, T>>;
  lightFallback: T;
}

export const THEMES: Partial<Record<ThemeId, CoreTheme>> = {
  'refined-grey': {
    id: 'refined-grey',
    name: 'Refined Grey',
    polarity: 'dark',
    bg: [0.102, 0.102, 0.102],
    cssBg: '#1a1a1a',
    dust: { min: 0.50, max: 0.92 },
    dim: 0.30,
    searchHues: [
      [0.00, 0.85, 1.00],
      [1.00, 0.55, 0.00],
      [0.20, 1.00, 0.30],
      [1.00, 0.15, 0.85],
      [1.00, 0.95, 0.05],
    ],
    outlines: {
      default: [0.6, 0.6, 0.6],
      hover:   [1.0, 1.0, 1.0],
      pin:     [0.2, 0.9, 1.0],
      hoverWhilePinned: [1.0, 0.8, 0.2],
    },
    chrome: {
      fg: '#fff',
      sidebarBg: 'rgba(0, 0, 0, 0.85)',
      sidebarFg: '#aaa',
      link: '#4ec3ff',
    },
  },
  // newsprint, plum, oxblood, manuscript, okabe added in Tasks 7–11.
};
