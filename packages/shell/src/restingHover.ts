// What the map's colours follow of the pointer: a square once the pointer has rested on it, and
// nothing as soon as it leaves the map.

// Long enough that sweeping across the map does not flash it, short enough to feel immediate.
export const HOVER_REST_MS = 150;

export function restingHover<I>(settle: (item: I | null) => void, delayMs = HOVER_REST_MS) {
  let waiting: ReturnType<typeof setTimeout> | null = null;
  const stopWaiting = (): void => {
    if (waiting !== null) clearTimeout(waiting);
    waiting = null;
  };
  return {
    /** The pointer is on `item`, or off the map when null. */
    move(item: I | null): void {
      stopWaiting();
      if (item === null) settle(null);
      else
        waiting = setTimeout(() => {
          waiting = null;
          settle(item);
        }, delayMs);
    },
  };
}
