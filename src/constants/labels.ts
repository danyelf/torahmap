// Typography shared by the Tanakh and Talmud map labels

/**
 * The face the map's Hebrew headings are set in. The verse text is a separate
 * stack (see src/styles/verse-popup.css) — headings and body do not share one.
 *
 * Both entry points must request this family from Google Fonts, or the labels
 * fall back to a system face and take the correction below anyway. A test in
 * src/__tests__/unit/labelTypography.test.ts holds them together.
 */
export const HEBREW_LABEL_FONT = '"David Libre", system-ui, sans-serif';

/**
 * How much larger a label sets its Hebrew than its nominal size. David Libre's
 * letter bodies fill 53% of the em against about 61% for the sans faces beside
 * them (measured: 105.5px against 121.3px for מ, ב and ת set at 200px), so the
 * plain number reads small.
 *
 * Applied outside the zoom clamps — an em on the Hebrew span in labels.ts, a
 * multiplier on the clamped size in talmudLabels.ts — so MIN and MAX go on
 * meaning the size a label appears to be.
 */
export const HEBREW_LABEL_SCALE = 1.15;
