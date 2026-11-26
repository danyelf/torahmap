/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

/**
 * Controls accepted for now under the touch minimum, wherever they show: the verse popup's link to
 * the text's source, and its close button. Named without a size, which the platform's fonts change.
 */
export const SMALL_CONTROLS = ['a.sefaria-link', 'button.close-btn'];

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does.
 */
export const KNOWN: Record<string, Known> = {
  'talmud-rabbis-typing/phone/map-clear-of-panel': {
    reason: 'Typing in a finder opens the phone sheet to full height, over the map.',
    violations: ['#canvas overlaps #panel by 390×232px'],
  },
};
