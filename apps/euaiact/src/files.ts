// What the shell downloads for the EU AI Act, apart from its overlays' and search's files.
import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from './data.ts';
import type { ActItem } from './layout.ts';

export const euaiactFiles: TextFiles<ActItem> = {
  first: [STRUCTURE_FILE],
  popup: () => TEXTS_FILE,
};
