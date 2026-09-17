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
 * letter bodies fill 0.53 of the em where the sans Hebrew faces around it fill
 * 0.59 to 0.61 (mean of מ, ב and ת, steady from 200px up), so the plain number
 * reads small. 1.15 puts it at the top of that range.
 *
 * Applied outside the zoom clamps — an em on the Hebrew span in labels.ts, a
 * multiplier on the clamped size in talmudLabels.ts — so MIN and MAX go on
 * meaning the size a label appears to be.
 */
export const HEBREW_LABEL_SCALE = 1.15;
