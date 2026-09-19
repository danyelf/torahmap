export const MODES = ['story', 'explore'] as const;
export type Mode = (typeof MODES)[number];

/**
 * The stop a change of mode names: leaving names the last stop reached,
 * returning names the stop the story resumes at. With neither, the story is
 * at, or resumes from, the first stop.
 */
export function stopForModeChange<S extends { id: string }>(
  stops: readonly S[],
  to: Mode,
  lastReached: string,
  resumeAt: string | null,
): S | undefined {
  const named = to === 'story' ? resumeAt : lastReached;
  return stops.find((s) => s.id === named) ?? stops[0];
}

/** A stop's place in the story, counting from one; zero if it is not in it. */
export function stopNumber(stops: readonly { id: string }[], id: string): number {
  return stops.findIndex((s) => s.id === id) + 1;
}

export function switchToExplore(storyPanel: HTMLElement, explorePanel: HTMLElement): void {
  storyPanel.style.display = 'none';
  explorePanel.style.display = 'flex';
}

export function switchToStory(
  storyPanel: HTMLElement,
  explorePanel: HTMLElement,
  storyContent: HTMLElement,
  lastScrollTop: number,
): void {
  explorePanel.style.display = 'none';
  storyPanel.style.display = 'flex';
  storyContent.scrollTop = lastScrollTop;
}
