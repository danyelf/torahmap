import { describe, it, expect } from 'vitest';
import { THEMES, type ThemeId } from '../../themes.ts';
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
