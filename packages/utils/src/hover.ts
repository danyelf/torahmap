/** How long a hover outlasts the pointer, so crossing the gap between two targets does not blink the map. */
export const HOVER_LINGER_MS = 150;

/**
 * Hands `show` each target the pointer enters, and null once the pointer has
 * been off every target for HOVER_LINGER_MS.
 */
export function lingeringHover<T>(show: (target: T | null) => void): {
  enter(target: T): void;
  leave(): void;
} {
  let leaving: ReturnType<typeof setTimeout> | undefined;
  return {
    enter(target) {
      clearTimeout(leaving);
      show(target);
    },
    leave() {
      clearTimeout(leaving);
      leaving = setTimeout(() => show(null), HOVER_LINGER_MS);
    },
  };
}
