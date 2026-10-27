// Picking a few things from a long list to light on the map: how many, the colour each gets, how
// they travel in a link, and how a typed name is compared.

import { maxChroma, oklchToRgb, type Color } from '@torahmap/utils';
import type { SettingsUpdate } from './types.ts';

export interface PickSettings {
  /** Ids by colour: a pick keeps its place, and so its colour, until it is removed. An empty place is free. */
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

/** The colours of the given places among the picks. */
export const pickColors = (slots: readonly number[]): Color[] =>
  slots.map((slot) => {
    const { hue, chroma } = PICKS[slot];
    return oklchToRgb(PICK_LIGHTNESS, maxChroma(PICK_LIGHTNESS, hue) * chroma, hue);
  });

/** The picks that `known` accepts, each with its place among the picks. */
export const pickSlots = (
  { picked }: PickSettings,
  known: (id: string) => boolean = () => true,
): { id: string; slot: number }[] =>
  picked.flatMap((id, slot) => (id && known(id) ? [{ id, slot }] : []));

/** The link's value for the picks, with a free place left empty, and the picks it names. */
export const picksToUrl = (picked: readonly string[]): string => picked.join(',');
export function picksFromUrl(value: string | undefined): string[] {
  const seen = new Set<string>();
  const picked = (value ?? '').split(',').filter((id) => !id || (!seen.has(id) && seen.add(id)));
  return trimFree(picked.slice(0, MAX_PICKS));
}

const trimFree = (picked: string[]): string[] => {
  let end = picked.length;
  while (end > 0 && !picked[end - 1]) end--;
  return picked.slice(0, end);
};

/** A new pick takes the first free place. */
export const addPick = (id: string): SettingsUpdate<PickSettings> =>
  function (current) {
    const { picked } = current;
    if (picked.includes(id) || pickSlots(current).length >= MAX_PICKS) return current;
    const free = picked.indexOf('');
    return {
      picked: free < 0 ? [...picked, id] : picked.map((p, slot) => (slot === free ? id : p)),
    };
  };

export const removePick = (id: string): SettingsUpdate<PickSettings> =>
  function ({ picked }) {
    return { picked: trimFree(picked.map((p) => (p === id ? '' : p))) };
  };
