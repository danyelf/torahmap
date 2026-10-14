// A Tanakh verse the Talmud cites, as a link to it on the Tanakh's map.

import { writeLink } from '@torahmap/link';
import { COMMENTARY, LINK_KEYS } from '@torahmap/overlay-catalog';

// The Tanakh's map is the site's root page.
const TANAKH_PAGE = '/';
// The commentary overlay's category for the Talmud, as public/data/overlays/commentary/ names it.
const TALMUD_CATEGORY = 'Talmud';

/** The Tanakh's map on `verse`, with each verse shaded by how often the Talmud cites it. */
export function tanakhLink(verse: string): string {
  const query = writeLink(
    { square: verse, overlay: COMMENTARY.id, overlayParams: { category: TALMUD_CATEGORY } },
    LINK_KEYS,
  );
  return `${TANAKH_PAGE}${query}`;
}
