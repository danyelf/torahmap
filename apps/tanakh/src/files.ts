// What the shell downloads for the Tanakh, apart from its overlays' and search's files.
import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from './verseTexts.ts';
import type { TanakhLayout } from './types.ts';

export const tanakhFiles: TextFiles<TanakhLayout> = {
  first: [STRUCTURE_FILE],
  timed: TEXTS_FILE,
  popup: () => TEXTS_FILE,
};
