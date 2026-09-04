// src/scrollytelling/modeSwitch.ts
export type AppMode = 'story' | 'explore';

export function switchToExplore(
  storyPanel: HTMLElement,
  explorePanel: HTMLElement,
): void {
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
