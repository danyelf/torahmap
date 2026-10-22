import type { TextFiles } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { STRUCTURE_FILE, englishFile, textsFile } from './data.ts';
import type { TalmudLayoutItem } from './layout.ts';

export const talmudFiles: TextFiles<TalmudLayoutItem> = {
  first: [STRUCTURE_FILE],
  popup: (item, language) =>
    language === ENGLISH ? englishFile(item.tractate) : textsFile(item.tractate),
};
