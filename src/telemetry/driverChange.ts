import { driverKind, type Driver } from '../scrollytelling/driver.ts';

/**
 * How the reader took the map: acting on it while the story was open, or
 * leaving the story — a tool chosen from its menu, its last stop's button, or
 * a link into the explore view followed after the page has loaded.
 */
export type ExitHow = 'takeover' | 'fold';
/** How the story took it back: scrolling it, opening it, or a link or Back/Forward. */
export type ReturnHow = 'rejoin' | 'open' | 'link';

/** The event a change of driver sends, or null when the same one keeps the map. */
export function driverChangeEvent(from: Driver, to: Driver): 'story_exit' | 'story_return' | null {
  const before = driverKind(from);
  const after = driverKind(to);
  if (before === after) return null;
  return after === 'reader' ? 'story_exit' : 'story_return';
}

/** The stop at `index` and its place in the story, counting from one. */
export function stopAt(
  stops: readonly { id: string }[],
  index: number,
): { id: string; number: number } {
  const stop = stops[index];
  return stop ? { id: stop.id, number: index + 1 } : { id: '', number: 0 };
}
