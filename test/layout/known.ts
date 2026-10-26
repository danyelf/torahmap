/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

const POPUP_KNOWN: Known = {
  reason: "The verse popup's Sefaria link and close button are under 24px; accepted for now.",
  violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
};

// The same popup on the AI Act's page, its link naming EUR-Lex.
const ACT_POPUP_KNOWN: Known = {
  reason: POPUP_KNOWN.reason,
  violations: ['a.sefaria-link is 112×15px, under 24', 'button.close-btn is 20×20px, under 24'],
};

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does. The sizes are measured in
 * Chromium on macOS with its system fonts, so a font or platform change moves
 * every entry at once, and the run says so loudly.
 */
export const KNOWN: Record<string, Known> = {
  'explore-text-analytics-pinned/phone/touch-targets': POPUP_KNOWN,
  'explore-text-analytics-pinned/tablet/touch-targets': POPUP_KNOWN,
  'explore-verse-pinned/phone/touch-targets': POPUP_KNOWN,
  'explore-verse-pinned/tablet/touch-targets': POPUP_KNOWN,
  'explore-word-menu/phone/touch-targets': POPUP_KNOWN,
  'explore-word-menu/tablet/touch-targets': POPUP_KNOWN,
  'story-menu-down/tablet/touch-targets': POPUP_KNOWN,
  'story-stop-with-verse/phone/touch-targets': POPUP_KNOWN,
  'story-stop-with-verse/tablet/touch-targets': POPUP_KNOWN,
  'explore-search-and-overlay-pinned/phone/touch-targets': POPUP_KNOWN,
  'explore-search-and-overlay-pinned/tablet/touch-targets': POPUP_KNOWN,
  'talmud-dating-pinned/phone/touch-targets': POPUP_KNOWN,
  'talmud-dating-pinned/tablet/touch-targets': POPUP_KNOWN,
  'talmud-rabbis-pinned/phone/touch-targets': POPUP_KNOWN,
  'talmud-rabbis-pinned/tablet/touch-targets': POPUP_KNOWN,
  'goto-chapter-taken/phone/touch-targets': POPUP_KNOWN,
  'goto-chapter-taken/tablet/touch-targets': POPUP_KNOWN,
  ...Object.fromEntries(
    ['hebrew', 'both', 'english'].flatMap((c) =>
      ['phone', 'tablet'].map((s) => [`languages-${c}/${s}/touch-targets`, POPUP_KNOWN]),
    ),
  ),
  'act-recital-pinned/phone/touch-targets': ACT_POPUP_KNOWN,
  'act-recital-pinned/tablet/touch-targets': ACT_POPUP_KNOWN,
  'act-goto-taken/phone/touch-targets': ACT_POPUP_KNOWN,
  'act-goto-taken/tablet/touch-targets': ACT_POPUP_KNOWN,
};
