// Seeded random for deterministic values (same result every time for same seed)

/**
 * Generate a deterministic pseudo-random number from a seed.
 * Uses hash-based approach for consistent values across sessions.
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
