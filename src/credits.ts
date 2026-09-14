// src/credits.ts
//
// Where the map's data comes from, and how that is shown in the help modal's
// Credits tab.
//
// Sources that belong to one feature are declared by the overlay that uses
// them, through the optional `credits` field on Overlay. Sources the whole map
// rests on are declared here as APP_CREDITS. The tab renders the second first
// and then one block per overlay, so the reader sees what everything stands on
// before what each feature adds.
//
// This module imports nothing. In particular it does not import Overlay, since
// overlays/types.ts imports Credit from here and that would close a loop; the
// renderer takes the smallest shape it actually needs instead.

export interface Credit {
  /** How the source should be named. Some licences require a specific wording. */
  source: string;
  url?: string;
  /** Licence as it should be shown, e.g. "CC BY-SA". Omit if there is none to state. */
  license?: string;
  /**
   * When we last took the data, at month precision, e.g. "September 2026".
   *
   * Hand-maintained: no data file carries a generation timestamp, and git
   * commit dates cannot stand in for one, because a commit that moves or
   * refactors a data file would claim it had been re-collected that month.
   * Left undefined where no commit is plainly a collection event, and shown as
   * "not recorded" rather than guessed. DATA_REGENERATION.md asks whoever
   * regenerates a file to update the date here.
   */
  collected?: string;
  /** Reserved for licence obligations and caveats, not for describing the source. */
  note?: string;
}

/** What the map as a whole rests on, regardless of which overlay is showing. */
export const APP_CREDITS: readonly Credit[] = [
  {
    source: 'Miqra according to the Masorah',
    url: 'https://he.wikisource.org/wiki/%D7%9E%D7%A9%D7%AA%D7%9E%D7%A9:Dovi/%D7%9E%D7%A7%D7%A8%D7%90_%D7%A2%D7%9C_%D7%A4%D7%99_%D7%94%D7%9E%D7%A1%D7%95%D7%A8%D7%94',
    license: 'CC BY-SA',
    collected: 'September 2026',
    note: 'The Hebrew text, from Hebrew Wikisource. The marks the Trop overlay shows are part of it, and Hebrew search matches this text with its vowels and cantillation ignored.',
  },
  {
    source: 'THE JPS TANAKH: Gender-Sensitive Edition',
    url: 'https://jps.org/books/the-jps-tanakh-gender-sensitive-edition/',
    license: 'CC BY-NC',
    collected: 'September 2026',
    note: 'The English text, from the Jewish Publication Society, and what the English search index is built from.',
  },
  {
    source: 'Sefaria',
    url: 'https://www.sefaria.org/',
    license: "Sefaria's terms",
    note: 'Both editions are downloaded from Sefaria, which also supplies the chapter and verse counts the layout rests on.',
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSource(credit: Credit): string {
  const name = escapeHtml(credit.source);
  if (!credit.url) return `<span class="credit-source">${name}</span>`;

  return (
    `<a class="credit-source" href="${escapeHtml(credit.url)}"` +
    ` target="_blank" rel="noopener noreferrer">${name}</a>`
  );
}

function renderRow(credit: Credit): string {
  const licence = credit.license
    ? `<span class="credit-license">${escapeHtml(credit.license)}</span>`
    : '';

  const collected = credit.collected
    ? `Collected ${escapeHtml(credit.collected)}`
    : 'Collection date not recorded';
  const note = credit.note ? ` · ${escapeHtml(credit.note)}` : '';

  return (
    `<li class="credit-row">${renderSource(credit)}${licence}` +
    `<p class="credit-meta">${collected}${note}</p></li>`
  );
}

/**
 * One headed block of credits. Returns the empty string for an empty list, so
 * that a caller can hand over every overlay and let the ones with nothing to
 * declare disappear.
 */
export function renderCreditBlock(title: string, credits: readonly Credit[]): string {
  if (credits.length === 0) return '';

  return (
    `<section class="credit-block">` +
    `<h3 class="credit-block-title">${escapeHtml(title)}</h3>` +
    `<ul class="credit-rows">${credits.map(renderRow).join('')}</ul>` +
    `</section>`
  );
}

/**
 * The whole Credits tab: what the map rests on, then what each overlay adds.
 *
 * Takes the smallest shape it needs rather than Overlay, which keeps this
 * module a leaf and lets tests hand it a fabricated list.
 */
export function renderCreditsHtml(
  overlays: readonly { name: string; credits?: readonly Credit[] }[],
): string {
  const blocks = [
    renderCreditBlock('The map itself', APP_CREDITS),
    ...overlays.map((o) => renderCreditBlock(o.name, o.credits ?? [])),
  ];

  return `<div class="credits-list">${blocks.join('')}</div>`;
}
