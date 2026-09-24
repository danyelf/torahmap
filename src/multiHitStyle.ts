// Prototype switch for comparing ways to draw a verse that several search
// terms hit. Chosen with ?multi=<name> in the query string, since the hash
// holds the app's own state.

export const MULTI_HIT_STYLES = [
  'scatter',
  'coarse',
  'dense',
  'wedges',
  'wedges-big',
  'rings',
  'diagonal',
  'checker',
  'frame',
  'underline',
  'coarse-flat',
  'halo-all',
  'grown-diagonal',
  'halo-ordered',
  'glow',
  'glow-fade',
  'contrast',
  'edge-px',
] as const;
export type MultiHitStyle = (typeof MULTI_HIT_STYLES)[number];

/** World units a hit may spread past its own square, per style. */
const BLEED: Record<MultiHitStyle, number> = {
  scatter: 3,
  coarse: 3,
  dense: 1.5,
  wedges: 0,
  'wedges-big': 1,
  rings: 1.5,
  diagonal: 0.5,
  checker: 0,
  frame: 0.5,
  underline: 1,
  'coarse-flat': 0,
  'halo-all': 3,
  'grown-diagonal': 1.25,
  'halo-ordered': 1.5,
  glow: 1.5,
  'glow-fade': 1.5,
  contrast: 0,
  // The widest the screen-sized edge may reach; it is clipped here when zoomed out.
  'edge-px': 3,
};

const params = new URLSearchParams(globalThis.location?.search ?? '');

function numberParam(name: string): number | null {
  const value = Number(params.get(name) ?? NaN);
  return Number.isFinite(value) ? value : null;
}

function styleFromUrl(): MultiHitStyle {
  const name = params.get('multi');
  return (MULTI_HIT_STYLES as readonly string[]).includes(name ?? '')
    ? (name as MultiHitStyle)
    : 'scatter';
}

export const multiHitStyle: MultiHitStyle = styleFromUrl();
export const multiHitStyleIndex = MULTI_HIT_STYLES.indexOf(multiHitStyle);
export const multiHitBleed = numberParam('halo') ?? BLEED[multiHitStyle];

/** Opacity of the glow's edge (?alpha=), or its opacity next to the square when it fades. */
export const multiHitAlpha =
  numberParam('alpha') ??
  (multiHitStyle === 'glow-fade' ? 1 : multiHitStyle === 'edge-px' ? 0.6 : 0.4);

/** How the fading glow falls off (?curve=): 1 is linear, higher holds it bright longer. */
export const multiHitCurve = numberParam('curve') ?? 1;

/** Screen pixels the edge reaches past the square, at any zoom (?px=). */
export const edgePixels = numberParam('px') ?? 2.5;

/** Every hit gets the halo, single hits too; they arrive as one-colour lists. */
export const haloOnEveryHit = (
  ['halo-all', 'grown-diagonal', 'halo-ordered', 'glow', 'glow-fade', 'edge-px'] as MultiHitStyle[]
).includes(multiHitStyle);

/** What verses no term hits show (?bg=length borrows Verse Length's colours). */
export const searchBackground: 'grey' | 'length' =
  params.get('bg') === 'length' ? 'length' : 'grey';

/**
 * How much of a no-hit verse's colour shows over the canvas (?dim=), 0 to 1.
 * Null keeps today's grey. The contrast sketch fades the background to half.
 */
export const missStrength: number | null =
  numberParam('dim') ??
  (multiHitStyle === 'contrast' ? (searchBackground === 'length' ? 0.2 : 0.08) : null);
