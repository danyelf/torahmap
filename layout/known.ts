/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

const POPUP = 'The verse popup is unchanged from before the frame; accepted as it is for now.';
const SEARCH = "Search's controls are rebuilt when search becomes a tool of its own.";
const MENU_OVER_MAP =
  "By design: on a phone the story's menu grows the sheet over the map, as full height does, " +
  'so the map neither moves nor resizes under it.';

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does. The sizes are measured in
 * Chromium on macOS with its system fonts, so a font or platform change moves
 * every entry at once, and the run says so loudly.
 */
export const KNOWN: Record<string, Known> = {
  'explore-search/phone/touch-targets': {
    reason: SEARCH,
    violations: [
      '#search-clear is 17×20px, under 24',
      'button.term-mode-option is 64×17px, under 24',
      'button.term-mode-option is 42×17px, under 24',
      'button.term-mode-option.on is 64×17px, under 24',
    ],
  },
  'explore-search/tablet/touch-targets': {
    reason: SEARCH,
    violations: [
      '#search-clear is 17×20px, under 24',
      'button.term-mode-option is 64×17px, under 24',
      'button.term-mode-option is 42×17px, under 24',
      'button.term-mode-option.on is 64×17px, under 24',
    ],
  },
  'explore-verse-pinned/phone/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
  'explore-verse-pinned/tablet/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
  'story-menu-down/phone/map-clear-of-panel': {
    reason: MENU_OVER_MAP,
    violations: ['#canvas overlaps #panel by 390×133px'],
  },
  'story-menu-down/tablet/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
  'story-stop-with-verse/phone/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
  'story-stop-with-verse/tablet/touch-targets': {
    reason: POPUP,
    violations: ['a.sefaria-link is 103×15px, under 24', 'button.close-btn is 20×20px, under 24'],
  },
};
