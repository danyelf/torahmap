/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

const POPUP_KNOWN: Known = {
  reason: "The verse popup's Sefaria link and close button are under 24px; accepted for now.",
  violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
};

const TROP_FOLD: Known = {
  reason:
    "The sheet's fold cuts through the trop chart's second row, and the check measures the sliver above it; the buttons are full size.",
  violations: Array(6).fill('button is 55×10px, under 24'),
};

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does. The sizes are measured in
 * Chromium on macOS with its system fonts, so a font or platform change moves
 * every entry at once, and the run says so loudly.
 */
export const KNOWN: Record<string, Known> = {
  'explore-verse-pinned/phone/touch-targets': POPUP_KNOWN,
  'explore-verse-pinned/tablet/touch-targets': POPUP_KNOWN,
  'explore-word-menu/phone/touch-targets': POPUP_KNOWN,
  'explore-word-menu/tablet/touch-targets': POPUP_KNOWN,
  'story-menu-down/tablet/touch-targets': POPUP_KNOWN,
  'story-stop-with-verse/phone/touch-targets': POPUP_KNOWN,
  'story-stop-with-verse/tablet/touch-targets': POPUP_KNOWN,
  'explore-search-and-overlay-pinned/phone/touch-targets': POPUP_KNOWN,
  'explore-search-and-overlay-pinned/tablet/touch-targets': POPUP_KNOWN,
  'explore-trop/phone/touch-targets': TROP_FOLD,
  'start-here-trop/phone/touch-targets': TROP_FOLD,
  'start-here/phone/touch-targets': {
    reason:
      "The sheet's fold cuts through the Verse Length button, and the check measures the sliver above it; the button is full size.",
    violations: ['button.control-button is 152×5px, under 24'],
  },
};
