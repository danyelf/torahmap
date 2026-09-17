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
 * How much larger a label sets its Hebrew than its nominal size, measured
 * baseline to letter-top, which is what tracks apparent size: David Libre's
 * מ, ב and ת average 0.528 of the em against 0.606 for the sans Hebrew faces
 * around it. Say which statistic, because whole glyph boxes give 1.12 instead
 * — two of David's three dip a few units under the baseline, and those spurs
 * are not what the eye reads the size from.
 *
 * font-size-adjust is not a substitute: its x-height and cap-height metrics
 * describe the Latin glyphs these faces also carry, not their Hebrew.
 *
 * Applied outside the zoom clamps — an em on the Hebrew span in labels.ts, a
 * multiplier on the clamped size in talmudLabels.ts — so MIN and MAX go on
 * meaning the size a label appears to be.
 */
export const HEBREW_LABEL_SCALE = 1.15;
