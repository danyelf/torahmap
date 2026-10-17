import { hebrew } from '@torahmap/hebrew';
import type { SearchLanguage } from '@torahmap/search';
import { english } from '@torahmap/search/english.ts';

/** The Tanakh's Hebrew, whose words take no prefixes: its dictionary separates them. */
export const tanakhHebrew: SearchLanguage = hebrew();

/** Hebrew first, so a term is Hebrew when it holds a Hebrew letter and English otherwise. */
export const TANAKH_LANGUAGES: readonly SearchLanguage[] = [tanakhHebrew, english];
