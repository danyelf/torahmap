import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from './data.ts';
import type { PieceItem } from './layout.ts';

export const ieeevisFiles: TextFiles<PieceItem> = {
  first: [STRUCTURE_FILE],
  popup: () => TEXTS_FILE,
};
