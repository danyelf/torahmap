// Checked by `npm run typecheck`, never run: an overlay names its files exactly
// when it takes data.
import { optional } from '../dataFiles.ts';
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

interface WithParse {
  texts: string[];
  parse: { words: string[] } | null;
}

export const namesAnOptionalFile: Overlay<unknown, void, WithParse> = {
  id: 'e',
  name: 'E',
  data: { texts: 'a.json', parse: optional('b.json') },
  ...colour,
};

export const waitsForAFileItCanDoWithout: Overlay<unknown, void, WithParse> = {
  id: 'f',
  name: 'F',
  // @ts-expect-error A file the overlay takes as T | null is named with optional().
  data: { texts: 'a.json', parse: 'b.json' },
  ...colour,
};

export const doesWithoutAFileItNeeds: Overlay<unknown, void, WithParse> = {
  id: 'g',
  name: 'G',
  // @ts-expect-error A file the overlay cannot do without is named by its path.
  data: { texts: optional('a.json'), parse: optional('b.json') },
  ...colour,
};

// Any overlay, with or without data, is an Overlay.
export const anyOverlay: Overlay<unknown>[] = [
  takesDataNamesThem,
  takesNoData,
  namesAnOptionalFile,
];
