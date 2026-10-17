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
