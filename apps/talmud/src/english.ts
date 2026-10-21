// A segment's English as the popup files store it: plain text with a marker on each side of a
// bold or italic stretch.

import type { TextStyle } from '@torahmap/shell/sidebar.ts';

export const BOLD = '*';
export const ITALIC = '_';

const STYLE_OF: Record<string, TextStyle['style']> = { [BOLD]: 'bold', [ITALIC]: 'italic' };

/** `marked` as plain text, with its bold and italic stretches. */
export function englishText(marked: string): { text: string; styles: TextStyle[] } {
  const styles: TextStyle[] = [];
  const open: Partial<Record<TextStyle['style'], number>> = {};
  let text = '';
  for (const char of marked) {
    const style = STYLE_OF[char];
    if (!style) {
      text += char;
    } else if (open[style] === undefined) {
      open[style] = text.length;
    } else {
      styles.push({ start: open[style], end: text.length, style });
      delete open[style];
    }
  }
  return { text, styles };
}

/** Where search reads the English: its bold, the literal translation, joined where only space parts it. */
export function searchedStretches(
  text: string,
  styles: readonly TextStyle[],
): { start: number; end: number }[] {
  const bold = styles.filter((s) => s.style === 'bold').sort((a, b) => a.start - b.start);
  const stretches: { start: number; end: number }[] = [];
  for (const { start, end } of bold) {
    const last = stretches[stretches.length - 1];
    if (last && text.slice(last.end, start).trim() === '') last.end = Math.max(last.end, end);
    else stretches.push({ start, end });
  }
  return stretches;
}

const LEADING_ELLIPSIS = /^(?:\.\.\.|…)\s*/;
const TRAILING_ELLIPSIS = /\s*(?:\.\.\.|…)$/;

/**
 * What search reads of `marked`: each searched stretch, apart, so no phrase runs from one to the
 * next. Where a stretch begins or ends with its own ellipsis beside the one between, one is shown.
 */
export function englishSearchText(marked: string): string {
  const { text, styles } = englishText(marked);
  const stretches = searchedStretches(text, styles)
    .map(({ start, end }) => text.slice(start, end).trim())
    .filter((stretch) => stretch !== '');
  const last = stretches.length - 1;
  return stretches
    .map((stretch, i) => {
      const from = i > 0 ? stretch.replace(LEADING_ELLIPSIS, '') : stretch;
      return i < last ? from.replace(TRAILING_ELLIPSIS, '') : from;
    })
    .filter((stretch) => stretch !== '')
    .join(' … ');
}
