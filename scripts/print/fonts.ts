// The faces the prints are set in. A face that fails to load leaves Chromium
// to substitute one silently, so the run checks each before drawing.
//
// Inter comes as one file per weight, not Google Fonts' variable font:
// Chromium embeds a variable font in a PDF as Type 3, which some print shops'
// software handles badly.

export const HEBREW = 'David Libre';
export const LATIN = 'Inter';

const INTER = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.3.0/files';

/** What the page's head needs to load every face. */
export const FONT_HEAD = [
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=David+Libre:wght@700&display=block">',
  '<style>',
  ...[400, 600, 700].map(
    (w) =>
      `@font-face { font-family: "${LATIN}"; font-weight: ${w}; font-display: block; ` +
      `src: url(${INTER}/inter-latin-${w}-normal.woff2) format("woff2"); }`,
  ),
  '</style>',
].join('\n');

export interface Face {
  family: string;
  weight: number;
}

export const FACES: Face[] = [
  { family: HEBREW, weight: 700 },
  { family: LATIN, weight: 400 },
  { family: LATIN, weight: 600 },
  { family: LATIN, weight: 700 },
];

/** A face as the page's document.fonts reports it. */
export interface LoadedFace {
  family: string;
  weight: string;
  status: string;
}

/**
 * The faces the page did not load. Asked of document.fonts.check instead,
 * the page answers yes for a family it has no face for at all, which is what
 * an unreachable stylesheet leaves.
 */
export function unloadedFaces(faces: Face[], loaded: LoadedFace[]): Face[] {
  return faces.filter(
    (face) =>
      !loaded.some(
        (l) =>
          l.family.replace(/"/g, '') === face.family &&
          l.weight === String(face.weight) &&
          l.status === 'loaded',
      ),
  );
}
