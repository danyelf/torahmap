import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from './data.ts';
import type { CodeItem } from './layout.ts';

export const codemapFiles: TextFiles<CodeItem> = {
  first: [STRUCTURE_FILE],
  popup: () => TEXTS_FILE,
};
