// Colours each square from its swatch, through the same overlay path as a real text.
//
// Glow and halo for standout squares (`standoutsFor`) would be added here.

import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { SwatchItem } from './layout.ts';

export const swatchOverlay: Overlay<SwatchItem> = {
  id: 'swatches',
  name: 'Swatches',
  description: 'Colours each square as its palette says.',
  getItemColor: (item) => item.color,
  colorsFor: (items) => items.map((item) => item.color),
};
