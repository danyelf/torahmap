// Whether the reader has been here before, kept in browser storage.

export const VISITED_KEY = 'torahMap.visited';

// Set once the reader has left the story or moved past the stop it opened on;
// until then, a visit to the bare address starts the story again.
export function hasVisited(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function rememberVisit(): void {
  try {
    localStorage.setItem(VISITED_KEY, 'true');
  } catch {
    // Storage can be unavailable; the story simply opens next time.
  }
}
