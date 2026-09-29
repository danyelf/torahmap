// The faces the prints are set in. A face that fails to load leaves Chromium
// to substitute one silently, so the run checks each before drawing.
//
// Inter comes as one file per weight, not Google Fonts' variable font:
// Chromium embeds a variable font in a PDF as Type 3, which some print shops'
// software handles badly.

const INTER = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.3.0/files';

/** What the page's head needs to load every face. */
export const FONT_HEAD = [
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=David+Libre:wght@700&display=block">',
  '<style>',
  ...[400, 600, 700].map(
    (w) =>
      `@font-face { font-family: "Inter"; font-weight: ${w}; font-display: block; ` +
      `src: url(${INTER}/inter-latin-${w}-normal.woff2) format("woff2"); }`,
  ),
  '</style>',
].join('\n');

/** As document.fonts.check takes them. */
export const FACES = [
  '700 20px "David Libre"',
  '400 20px "Inter"',
  '600 20px "Inter"',
  '700 20px "Inter"',
];

export function unloadedFaces(faces: string[], check: (face: string) => boolean): string[] {
  return faces.filter((f) => !check(f));
}
