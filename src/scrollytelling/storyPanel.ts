// src/scrollytelling/storyPanel.ts
import type { StoryData, StoryStop, ResolvedStoryStop, CameraPosition } from './types';
import { parseStoryMarkdown } from './storyParser';

export async function loadStoryData(): Promise<StoryData> {
  const response = await fetch('/data/story.md');
  const markdown = await response.text();
  return parseStoryMarkdown(markdown);
}

/**
 * Minimal markdown-to-HTML for story text.
 * Supports: **bold**, *italic*, [links](url), paragraphs, and raw HTML (e.g. <span>).
 */
function renderMarkdown(md: string): string {
  return md
    .split(/\n\n+/)
    .map(paragraph => {
      const html = paragraph
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, ' ');
      return `<p>${html}</p>`;
    })
    .join('\n');
}

export function renderStoryPanel(
  container: HTMLElement,
  stops: StoryStop[]
): HTMLElement[] {
  container.innerHTML = '';
  const stopElements: HTMLElement[] = [];

  for (const stop of stops) {
    const el = document.createElement('div');
    el.className = 'story-stop';
    el.dataset.stopId = stop.id;

    const title = document.createElement('h2');
    title.textContent = stop.title;
    el.appendChild(title);

    const textContainer = document.createElement('div');
    textContainer.className = 'story-text';
    textContainer.innerHTML = renderMarkdown(stop.text);
    el.appendChild(textContainer);

    container.appendChild(el);
    stopElements.push(el);
  }

  return stopElements;
}

/**
 * Resolve "initial" camera references to actual coordinates.
 */
export function resolveStops(
  stops: StoryStop[],
  initialCamera: CameraPosition
): ResolvedStoryStop[] {
  return stops.map(stop => ({
    ...stop,
    camera: stop.camera === 'initial' ? { ...initialCamera } : stop.camera,
  }));
}

/**
 * Compute the scroll offset for each stop element.
 */
export function computeStopOffsets(stopElements: HTMLElement[]): number[] {
  return stopElements.map((el) => el.offsetTop);
}
