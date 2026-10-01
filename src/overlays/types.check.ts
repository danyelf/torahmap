// Checked by `npm run typecheck`, never run: an overlay names its files exactly
// when it takes data.
import type { Overlay } from './types.ts';

const colour = { getVerseColor: () => null, colorsFor: () => [] };

// @ts-expect-error An overlay that takes data names its files.
export const takesDataNamesNone: Overlay<unknown, void, { texts: string[] }> = {
  id: 'a',
  name: 'A',
  ...colour,
};

export const takesDataNamesThem: Overlay<unknown, void, { texts: string[] }> = {
  id: 'b',
  name: 'B',
  data: { texts: 'all-texts.json' },
  ...colour,
};

export const takesNoData: Overlay<unknown, void, void> = { id: 'c', name: 'C', ...colour };

export const takesNoDataNamesOne: Overlay<unknown, void, void> = {
  id: 'd',
  name: 'D',
  // @ts-expect-error An overlay that takes no data names no files.
  data: { texts: 'all-texts.json' },
  ...colour,
};

// Any overlay, with or without data, is an Overlay.
export const anyOverlay: Overlay[] = [takesDataNamesThem, takesNoData];
