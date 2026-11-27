// Picking a few things from a long list to light on the map: how many, the color each gets, how
// they travel in a link, and how a typed name is compared.

import type { Color } from '@torahmap/utils';
import { freeColor, PICK_PALETTE } from './palette.ts';
import type { SettingsUpdate } from './types.ts';

export interface PickSettings {
  /**
   * Ids by place in PICK_PALETTE. A pick keeps its place, and so its color, until it is removed; a link
   * carries only the order, so opening it places the picks again. An empty place is unused.
   */
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

/** The colors of the given places in PICK_PALETTE. */
export const pickColors = (slots: readonly number[]): Color[] =>
  slots.map((slot) => PICK_PALETTE[slot]);

/** The picks that `known` accepts, each with its place in PICK_PALETTE. */
export const pickSlots = (
  { picked }: PickSettings,
  known: (id: string) => boolean = () => true,
): { id: string; slot: number }[] =>
  picked.flatMap((id, slot) => (id && known(id) ? [{ id, slot }] : []));

/**
 * The link's value for the picks, in order, and the picks it names. A link does not carry colors:
 * each pick in it takes the first color no earlier pick uses.
 */
export const picksToUrl = (picked: readonly string[]): string => picked.filter(Boolean).join(',');
export function picksFromUrl(value: string | undefined): string[] {
  const ids = [...new Set((value ?? '').split(',').filter(Boolean))].slice(0, MAX_PICKS);
  return ids.reduce<string[]>((picked, id) => placeAt(picked, id), []);
}

const trimFree = (picked: string[]): string[] => {
  let end = picked.length;
  while (end > 0 && !picked[end - 1]) end--;
  return picked.slice(0, end);
};

/** `id` in the first place in PICK_PALETTE that no pick already uses. */
const placeAt = (picked: string[], id: string): string[] => {
  const place = freeColor(
    pickSlots({ picked }).map(({ slot }) => slot),
    PICK_PALETTE.length,
  );
  const next = Array.from(
    { length: Math.max(picked.length, place + 1) },
    (_, i) => picked[i] ?? '',
  );
  next[place] = id;
  return next;
};

/** A new pick takes the first color no pick uses. */
export const addPick = (id: string): SettingsUpdate<PickSettings> =>
  function (current) {
    if (current.picked.includes(id) || pickSlots(current).length >= MAX_PICKS) return current;
    return { picked: placeAt(current.picked, id) };
  };

export const removePick = (id: string): SettingsUpdate<PickSettings> =>
  function ({ picked }) {
    return { picked: trimFree(picked.map((p) => (p === id ? '' : p))) };
  };
