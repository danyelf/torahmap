import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from './data.ts';

export const codemapFiles: TextFiles<unknown> = {
  first: [STRUCTURE_FILE],
  popup: () => TEXTS_FILE,
};
