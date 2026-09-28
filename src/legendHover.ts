// A legend entry marked with `data-hover-verse` hovers that verse, colouring
// the map as the cursor over it would. The hover is the legend's own: it
// clears only what it set, and the verse popup does not show it.

import { lingeringHover } from './utils/hover.ts';

interface MapHover<V> {
  hovered(): V | null;
  setHovered(verse: V | null): void;
  /** The verse a `data-hover-verse` value names, if there is one. */
  find(ref: string): V | null;
}

type LegendPointer = Pick<PointerEvent, 'type' | 'pointerType' | 'target'>;

export function legendHover<V>(map: MapHover<V>) {
  let mine: V | null = null;

  const owns = () => mine !== null && map.hovered() === mine;

  const linger = lingeringHover<V>((verse) => {
    if (verse !== null) map.setHovered(verse);
    else if (owns()) map.setHovered(null);
    mine = verse;
  });

  return {
    /** For `pointerover` and `pointerleave` on the legend. */
    handle(e: LegendPointer): void {
      if (e.pointerType === 'touch') return;
      const entry =
        e.type === 'pointerleave' ? null : (e.target as Element).closest('[data-hover-verse]');
      const ref = entry instanceof HTMLElement ? entry.dataset.hoverVerse : undefined;
      const verse = ref ? map.find(ref) : null;

      if (verse !== null) linger.enter(verse);
      else linger.leave();
    },

    /** True while the map's hover is the one the legend set. */
    owns,

    /** Drop the legend's hover now, as when the legend is redrawn. */
    cancel(): void {
      linger.cancel();
      if (owns()) map.setHovered(null);
      mine = null;
    },
  };
}
