// What the Tanakh's site calls itself: torahmap.org.

import { SITE_NAME, describeLink } from '@torahmap/site';
import type { Site } from '../app/text.ts';

export const tanakhSite: Site = {
  name: SITE_NAME,
  squareName: 'verse',
  aboutHtml:
    '<p>An interactive visualization of the entire Tanakh (Hebrew Bible). Every verse has a fixed position.</p>',
  credits: [
    {
      source: 'Miqra according to the Masorah',
      url: 'https://he.wikisource.org/wiki/%D7%9E%D7%A9%D7%AA%D7%9E%D7%A9:Dovi/%D7%9E%D7%A7%D7%A8%D7%90_%D7%A2%D7%9C_%D7%A4%D7%99_%D7%94%D7%9E%D7%A1%D7%95%D7%A8%D7%94',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      collected: 'September 2026',
      note: 'The Hebrew text, from Hebrew Wikisource, downloaded via Sefaria. The Trop overlay reads its cantillation marks out of this edition, and Hebrew search matches it with vowels and cantillation ignored.',
    },
    {
      source: 'THE JPS TANAKH: Gender-Sensitive Edition',
      url: 'https://jps.org/books/the-jps-tanakh-gender-sensitive-edition/',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      collected: 'September 2026',
      note: 'The English text, from the Jewish Publication Society, downloaded via Sefaria. The English search index is built from it.',
    },
  ],
  title: (link) => describeLink(link).title,
};
