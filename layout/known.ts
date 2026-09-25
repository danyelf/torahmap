/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

const UNTIL =
  'Accepted until the redesigned panel replaces the footer links, the controls toggle and the help window';
const REPLACED = `${UNTIL}.`;
const REPLACED_OR_KEPT = `${UNTIL}, and keeps the other controls listed here at 24px or larger.`;

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does. The sizes are measured in
 * Chromium on macOS with its system fonts, so a font or platform change moves
 * every entry at once, and the run says so loudly.
 */
export const KNOWN: Record<string, Known> = {
  'story-opening/tablet/touch-targets': {
    reason: REPLACED,
    violations: [
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'story-stop-with-verse/tablet/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      'a.sefaria-link is 103×15px, under 24',
      'button.close-btn is 20×20px, under 24',
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-no-overlay/tablet/touch-targets': {
    reason: REPLACED,
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-commentary/tablet/touch-targets': {
    reason: REPLACED,
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-search/tablet/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#search-clear is 17×20px, under 24',
      'button.term-mode-option is 64×17px, under 24',
      'button.term-mode-option is 42×17px, under 24',
      'button.term-mode-option.on is 64×17px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-verse-pinned/tablet/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      'a.sefaria-link is 103×15px, under 24',
      'button.close-btn is 20×20px, under 24',
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'about-open/tablet/touch-targets': {
    reason: REPLACED,
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
      'button.link-button is 121×21px, under 24',
    ],
  },
  'story-opening/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'story-stop-with-verse/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      'a.sefaria-link is 103×15px, under 24',
      'button.close-btn is 20×20px, under 24',
      '#sheet-grabber is 390×20px, under 24',
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-no-overlay/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-commentary/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-search/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#search-clear is 17×20px, under 24',
      'button.term-mode-option is 64×17px, under 24',
      'button.term-mode-option is 42×17px, under 24',
      'button.term-mode-option.on is 64×17px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-verse-pinned/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      'a.sefaria-link is 103×15px, under 24',
      'button.close-btn is 20×20px, under 24',
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'about-open/phone/touch-targets': {
    reason: REPLACED_OR_KEPT,
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
      'button.link-button is 121×21px, under 24',
    ],
  },
};
