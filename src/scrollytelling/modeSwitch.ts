export const MODES = ['story', 'explore'] as const;
export type Mode = (typeof MODES)[number];

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
