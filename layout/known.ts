/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does.
 */
export const KNOWN: Record<string, Known> = {
  'story-opening/tablet/touch-targets': {
    reason: 'the footer links go when the panel becomes a menu',
    violations: [
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'story-stop-with-verse/tablet/touch-targets': {
    reason:
      "the footer links go when the panel becomes a menu; the verse popup's close button and " +
      'Sefaria link carry over to the new panel, held to 24 there',
    violations: [
      'a.sefaria-link is 103×15px, under 24',
      'button.close-btn is 20×20px, under 24',
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-no-overlay/tablet/touch-targets': {
    reason: 'the controls-toggle bar and footer links go when the panel becomes a menu',
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-commentary/tablet/touch-targets': {
    reason: 'the controls-toggle bar and footer links go when the panel becomes a menu',
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-search/tablet/touch-targets': {
    reason:
      'the controls-toggle bar and footer links go when the panel becomes a menu; the search ' +
      'clear button and match-mode chips carry over to the new panel, held to 24 there',
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
    reason:
      "the controls-toggle bar and footer links go when the panel becomes a menu; the verse popup's " +
      'close button and Sefaria link carry over to the new panel, held to 24 there',
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
    reason:
      'the controls-toggle bar, footer links and help window go when the panel becomes a menu',
    violations: [
      '#controls-toggle is 379×23px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
      'button.link-button is 121×21px, under 24',
    ],
  },
  'story-opening/phone/touch-targets': {
    reason:
      "the footer links go when the panel becomes a menu; the phone sheet's grabber carries " +
      'over to the new panel, held to 24 there',
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#leave-story is 70×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'story-stop-with-verse/phone/touch-targets': {
    reason:
      'the footer links go when the panel becomes a menu; the sheet grabber, verse ' +
      "popup's close button and Sefaria link carry over to the new panel, held to 24 there",
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
    reason:
      "the footer links go when the panel becomes a menu; the phone sheet's grabber carries " +
      'over to the new panel, held to 24 there',
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-commentary/phone/touch-targets': {
    reason:
      "the footer links go when the panel becomes a menu; the phone sheet's grabber carries " +
      'over to the new panel, held to 24 there',
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
    ],
  },
  'explore-search/phone/touch-targets': {
    reason:
      'the footer links go when the panel becomes a menu; the sheet grabber, search clear ' +
      'button and match-mode chips carry over to the new panel, held to 24 there',
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
    reason:
      'the footer links go when the panel becomes a menu; the sheet grabber, ' +
      "verse popup's close button and Sefaria link carry over to the new panel, held to 24 there",
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
    reason:
      "the footer links and help window go when the panel becomes a menu; the phone sheet's " +
      'grabber carries over to the new panel, held to 24 there',
    violations: [
      '#sheet-grabber is 390×20px, under 24',
      '#return-to-story is 90×16px, under 24',
      '#hebrew-toggle is 78×16px, under 24',
      '#about-btn is 94×16px, under 24',
      'button.link-button is 121×21px, under 24',
    ],
  },
};
