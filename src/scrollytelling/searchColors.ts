import type { StoryStop } from './types';

type Color = { r: number; g: number; b: number };

const SEARCH_PALETTE: Color[] = [
  { r: 0, g: 0.9, b: 0.9 },   // cyan/teal
  { r: 1, g: 0.6, b: 0 },     // orange
  { r: 0, g: 0.9, b: 0.4 },   // green
  { r: 0.9, g: 0.2, b: 0.9 }, // magenta
  { r: 1, g: 0.9, b: 0 },     // yellow
  { r: 0.4, g: 0.6, b: 1 },   // blue
  { r: 1, g: 0.4, b: 0.4 },   // red
  { r: 0.6, g: 1, b: 0.6 },   // light green
];

export function assignGlobalSearchColors(
  stops: StoryStop[],
): Map<string, Color> {
  const terms = new Set<string>();

  for (const stop of stops) {
    if (stop.overlay === 'search' && stop.overlayParams?.q) {
      for (const term of stop.overlayParams.q.split(',')) {
        const trimmed = term.trim();
        if (trimmed) terms.add(trimmed);
      }
    }
  }

  const colorMap = new Map<string, Color>();
  let i = 0;
  for (const term of terms) {
    colorMap.set(term, SEARCH_PALETTE[i % SEARCH_PALETTE.length]);
    i++;
  }

  return colorMap;
}
