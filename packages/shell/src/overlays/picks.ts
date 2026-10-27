// Picking a few things from a long list to light on the map: how many, the colour each gets, how
// they travel in a link, and how a typed name is compared. No page in here.

import { maxChroma, oklchToRgb, type Color } from '@torahmap/utils';
import type { SettingsUpdate } from './types.ts';

export interface PickSettings {
  /** Ids, in the order picked. */
  picked: string[];
}

/** At most this many picked: what the renderer can split one square into. */
export const MAX_PICKS = 4;

/** Lower case, without vowel points, accents or punctuation. */
export const plainName = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The OKLCH hue of each pick, in the order picked, and how much of the gamut's edge its chroma
 * uses. Four hues far apart: cyan, coral, green, pink. The green is held back, since at full
 * chroma it reads harsher than the others at the same lightness.
 */
const PICKS: readonly { hue: number; chroma: number }[] = [
  { hue: 215, chroma: 0.97 },
  { hue: 35, chroma: 0.97 },
  { hue: 150, chroma: 0.6 },
  { hue: 330, chroma: 0.97 },
];
/** Every pick is this light, so none looks brighter than another. */
const PICK_LIGHTNESS = 0.8;

/** A color for each of `count` picks, by the order picked. */
export function pickColors(count: number): Color[] {
  return Array.from({ length: count }, (_, i) => {
    const { hue, chroma } = PICKS[i];
    return oklchToRgb(PICK_LIGHTNESS, maxChroma(PICK_LIGHTNESS, hue) * chroma, hue);
  });
}

/** The link's value for the picks, and the picks a link's value names. */
export const picksToUrl = (picked: readonly string[]): string => picked.join(',');
export const picksFromUrl = (value: string | undefined): string[] =>
  [...new Set((value ?? '').split(',').filter(Boolean))].slice(0, MAX_PICKS);

export const addPick = (id: string): SettingsUpdate<PickSettings> =>
  function (current) {
    return current.picked.includes(id) || current.picked.length >= MAX_PICKS
      ? current
      : { picked: [...current.picked, id] };
  };

export const removePick = (id: string): SettingsUpdate<PickSettings> =>
  function (current) {
    return { picked: current.picked.filter((p) => p !== id) };
  };
