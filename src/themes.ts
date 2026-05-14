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
  newsprint: {
    id: 'newsprint',
    name: 'Newsprint',
    polarity: 'light',
    bg: [0.957, 0.937, 0.902],
    cssBg: '#f4efe6',
    dust: { min: 0.10, max: 0.42, tint: [0.20, 0.16, 0.12] },
    dim: 0.78,
    searchHues: [
      [0.722, 0.200, 0.118], // Vermillion
      [0.122, 0.239, 0.416], // Lapis
      [0.180, 0.420, 0.227], // Verdigris
      [0.486, 0.227, 0.686], // Imperial
      [0.784, 0.588, 0.122], // Ochre
    ],
    outlines: {
      default: [0.30, 0.25, 0.20],
      hover:   [0.10, 0.08, 0.06],
      pin:     [0.45, 0.10, 0.05],
      hoverWhilePinned: [0.55, 0.40, 0.05],
    },
    chrome: {
      fg: '#1a1410',
      sidebarBg: 'rgba(244, 239, 230, 0.92)',
      sidebarFg: '#5a4a3a',
      link: '#3a4a8a',
    },
  },
  plum: {
    id: 'plum',
    name: 'Risograph Plum',
    polarity: 'dark',
    bg: [0.118, 0.078, 0.161],
    cssBg: '#1e1429',
    dust: { min: 0.62, max: 0.95, tint: [1.0, 0.95, 0.85] },
    dim: 0.40,
    searchHues: [
      [1.000, 0.369, 0.569], // Fluoro pink
      [0.231, 0.420, 0.820], // Federal blue
      [0.435, 0.831, 0.659], // Mint
      [1.000, 0.761, 0.227], // Marigold
      [0.169, 0.706, 0.659], // Teal
    ],
    outlines: {
      default: [0.65, 0.60, 0.55],
      hover:   [1.0, 0.95, 0.85],
      pin:     [1.000, 0.369, 0.569],
      hoverWhilePinned: [1.000, 0.761, 0.227],
    },
    chrome: {
      fg: '#f5ecdc',
      sidebarBg: 'rgba(30, 20, 41, 0.92)',
      sidebarFg: '#b8a4c8',
      link: '#ff8eb5',
    },
  },
  oxblood: {
    id: 'oxblood',
    name: 'Oxblood Folio',
    polarity: 'dark',
    bg: [0.110, 0.078, 0.063],
    cssBg: '#1c1410',
    dust: { min: 0.30, max: 0.88, tint: [1.00, 0.55, 0.45] },
    dim: 0.32,
    searchHues: [
      [0.306, 0.804, 0.769], // Teal
      [0.957, 0.827, 0.369], // Gold
      [0.655, 0.525, 0.875], // Violet
      [0.616, 0.851, 0.953], // Ice-blue
      [0.784, 0.910, 0.478], // Lime
    ],
    outlines: {
      default: [0.55, 0.45, 0.40],
      hover:   [0.92, 0.86, 0.78],
      pin:     [0.957, 0.827, 0.369],
      hoverWhilePinned: [0.306, 0.804, 0.769],
    },
    chrome: {
      fg: '#ebdfd1',
      sidebarBg: 'rgba(28, 20, 16, 0.92)',
      sidebarFg: '#b39e88',
      link: '#f4d35e',
    },
  },
  // manuscript, okabe added in Tasks 10–11.
};

// Must stay in sync with the ThemeId union above. The `satisfies` check
// catches typos (e.g. 'oxbloodd') but cannot detect missing entries.
const VALID_ID_LIST = [
  'refined-grey', 'newsprint', 'plum', 'oxblood', 'manuscript', 'okabe',
] as const satisfies readonly ThemeId[];
const VALID_IDS = new Set<ThemeId>(VALID_ID_LIST);

function isThemeId(s: string | null | undefined): s is ThemeId {
  return !!s && VALID_IDS.has(s as ThemeId);
}

export function resolveThemeId(): ThemeId {
  const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('theme');
  if (isThemeId(fromUrl)) return fromUrl;
  const fromStorage = globalThis.localStorage?.getItem('torahmap.theme') ?? null;
  if (isThemeId(fromStorage)) return fromStorage;
  return 'refined-grey';
}

// Single resolution at module load. A theme swap is a page reload.
// THEMES['refined-grey'] is always defined (set in Task 1), so the non-null
// assertion is safe and reflects the actual invariant.
export const currentTheme: CoreTheme =
  THEMES[resolveThemeId()] ?? THEMES['refined-grey']!;

/**
 * Look up an overlay's per-theme value, with polarity fallback. See
 * `ThemedTable<T>` for the resolution order. Read once at the call site —
 * `currentTheme` is fixed for the page's lifetime.
 */
export function pick<T>(t: ThemedTable<T>): T {
  return t.byTheme[currentTheme.id]
      ?? (currentTheme.polarity === 'light' ? t.lightFallback : t.byTheme['refined-grey']!);
}

/**
 * Write the theme's chrome colors to `:root` as CSS custom properties.
 * Call once at app boot; the theme is fixed for the page lifetime.
 *
 * CSS files read these via `var(--bg)`, `var(--fg)`, etc. The body bg and
 * chrome surfaces (controls, sidebar, help modal) consume them — keeping
 * the WebGL canvas clear color (via currentTheme.bg) and the page bg
 * (via this var) consistent without literal duplication.
 */
export function applyChromeVars(t: CoreTheme = currentTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--bg', t.cssBg);
  root.style.setProperty('--fg', t.chrome.fg);
  root.style.setProperty('--sidebar-bg', t.chrome.sidebarBg);
  root.style.setProperty('--sidebar-fg', t.chrome.sidebarFg);
  root.style.setProperty('--link', t.chrome.link);
}
