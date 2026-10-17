// A segment's English as the popup files store it: `*` opens and closes bold, `_` italic
// (scripts/talmud/english.ts writes them).

import type { TextStyle } from '@torahmap/shell/sidebar.ts';

const MARKERS: Record<string, TextStyle['style']> = { '*': 'bold', _: 'italic' };

/** `marked` as plain text, with its bold and italic stretches. A stretch left open ends with the text. */
export function englishText(marked: string): { text: string; styles: TextStyle[] } {
  const styles: TextStyle[] = [];
  const open: Partial<Record<TextStyle['style'], number>> = {};
  let text = '';
  for (const char of marked) {
    const style = MARKERS[char];
    if (!style) {
      text += char;
      continue;
    }
    const start = open[style];
    if (start === undefined) {
      open[style] = text.length;
    } else {
      if (start < text.length) styles.push({ start, end: text.length, style });
      delete open[style];
    }
  }
  for (const [style, start] of Object.entries(open) as [TextStyle['style'], number][]) {
    if (start < text.length) styles.push({ start, end: text.length, style });
  }
  return { text, styles };
}
