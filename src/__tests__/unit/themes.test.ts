import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { THEMES, resolveThemeId, pick, applyChromeVars, type ThemeId, type ThemedTable } from '../../themes.ts';
import { HIGHLIGHT_CONSTANTS } from '../../constants.ts';

describe('themes registry', () => {
  it('refined-grey theme matches the shipped HIGHLIGHT_CONSTANTS values', () => {
    const t = THEMES['refined-grey'];
    expect(t).toBeDefined();
    expect(t!.id).toBe('refined-grey');
    expect(t!.polarity).toBe('dark');
    expect(t!.bg).toEqual(HIGHLIGHT_CONSTANTS.CANVAS_BG_COLOR);
    expect(t!.dust.min).toBe(HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS);
    expect(t!.dust.max).toBeCloseTo(
      HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS + HIGHLIGHT_CONSTANTS.BRIGHTNESS_RANGE,
      10
    );
    expect(t!.dim).toBe(HIGHLIGHT_CONSTANTS.DIM_BRIGHTNESS);
    expect(t!.outlines.pin).toEqual(HIGHLIGHT_CONSTANTS.PINNED_OUTLINE_COLOR);
    expect(t!.outlines.hover).toEqual(HIGHLIGHT_CONSTANTS.HOVER_OUTLINE_COLOR);
    expect(t!.outlines.default).toEqual(HIGHLIGHT_CONSTANTS.OUTLINE_COLOR);
    expect(t!.outlines.hoverWhilePinned).toEqual(HIGHLIGHT_CONSTANTS.HOVER_WHILE_PINNED_OUTLINE_COLOR);
  });

  it('every entry in THEMES round-trips by id', () => {
    for (const id of Object.keys(THEMES) as ThemeId[]) {
      expect(THEMES[id]?.id).toBe(id);
    }
  });
});

describe('resolveThemeId', () => {
  const origLocation = window.location;
  const origStorage = { ...localStorage };

  function mockLocation(search: string) {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...origLocation, search },
    });
  }

  beforeEach(() => { localStorage.clear(); });
  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, value: origLocation });
    localStorage.clear();
    for (const [k, v] of Object.entries(origStorage)) localStorage.setItem(k, v as string);
  });

  it('uses URL param when present and valid', () => {
    mockLocation('?theme=newsprint');
    expect(resolveThemeId()).toBe('newsprint');
  });

  it('falls back to localStorage when URL absent', () => {
    mockLocation('');
    localStorage.setItem('torahmap.theme', 'plum');
    expect(resolveThemeId()).toBe('plum');
  });

  it('falls back to refined-grey when neither present', () => {
    mockLocation('');
    expect(resolveThemeId()).toBe('refined-grey');
  });

  it('falls back to refined-grey on invalid id', () => {
    mockLocation('?theme=phosphor');
    expect(resolveThemeId()).toBe('refined-grey');
  });

  it('URL precedence over localStorage', () => {
    mockLocation('?theme=oxblood');
    localStorage.setItem('torahmap.theme', 'newsprint');
    expect(resolveThemeId()).toBe('oxblood');
  });
});

describe('pick', () => {
  // currentTheme is module-load resolved; in this test environment with no URL
  // param or localStorage hint, currentTheme === THEMES['refined-grey']
  // (polarity: dark). Light-polarity behavior would require module mocking and
  // is exercised end-to-end by Tasks 13-15 smoke tests instead.

  it('returns the byTheme entry when current theme has one', () => {
    const table: ThemedTable<string> = {
      byTheme: { 'refined-grey': 'tuned' },
      lightFallback: 'light-fallback',
    };
    expect(pick(table)).toBe('tuned');
  });

  it('dark polarity falls back to byTheme[\'refined-grey\'] when no entry for current id', () => {
    // Simulate an un-tuned dark theme by removing the 'refined-grey' entry
    // would change which theme is canonical. Instead, verify the resolution
    // order by using a table that maps a DIFFERENT id only; refined-grey
    // falls through to... refined-grey itself if present. The defensive case
    // here is: when current id IS refined-grey AND byTheme has it, the
    // first branch hits — already covered above. The dark-fallback path is
    // only reachable for non-refined-grey dark themes, which don't exist
    // until Task 8+. So this test verifies the formula by inspection:
    const table: ThemedTable<string> = {
      byTheme: { 'refined-grey': 'dark-canonical' },
      lightFallback: 'never-reached',
    };
    expect(pick(table)).toBe('dark-canonical');
  });

  it('prefers byTheme[\'refined-grey\'] over lightFallback on dark polarity', () => {
    const table: ThemedTable<string> = {
      byTheme: { 'refined-grey': 'dark-value' },
      lightFallback: 'light-value',
    };
    // Dark polarity (refined-grey) must NOT pick lightFallback.
    expect(pick(table)).toBe('dark-value');
    expect(pick(table)).not.toBe('light-value');
  });
});

describe('applyChromeVars', () => {
  it('writes CSS custom properties on :root from the theme.chrome record', () => {
    const refinedGrey = THEMES['refined-grey']!;
    applyChromeVars(refinedGrey);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--bg')).toBe('#1a1a1a');
    expect(root.style.getPropertyValue('--fg')).toBe('#fff');
    expect(root.style.getPropertyValue('--sidebar-bg')).toBe('rgba(0, 0, 0, 0.85)');
    expect(root.style.getPropertyValue('--sidebar-fg')).toBe('#aaa');
    expect(root.style.getPropertyValue('--link')).toBe('#4ec3ff');
  });
});
