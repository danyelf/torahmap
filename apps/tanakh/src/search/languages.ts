import { hebrew } from '@torahmap/hebrew';
import { english, type SearchLanguage } from '@torahmap/search';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';

/** The Tanakh's Hebrew, whose words take no prefixes: its dictionary separates them. */
export const tanakhHebrew: SearchLanguage = hebrew();

export function searchLanguage(language: TextLanguage): SearchLanguage {
  return language === HEBREW ? tanakhHebrew : english;
}

/** Hebrew first, so a term is Hebrew when it holds a Hebrew letter and English otherwise. */
export const TANAKH_LANGUAGES: readonly SearchLanguage[] = [tanakhHebrew, english];
