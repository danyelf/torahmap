/** A layout failure accepted for now: why, and exactly what it measures. */
export interface Known {
  reason: string;
  violations: string[];
}

/**
 * Layout failures accepted for now, keyed "<state>/<screen>/<rule>". A known
 * failure whose violations change — fixed, or joined by another — fails the
 * run, so update or remove its entry when it does. The sizes are measured in
 * Chromium on macOS with its system fonts, so a font or platform change moves
 * every entry at once, and the run says so loudly.
 */
export const KNOWN: Record<string, Known> = {};
