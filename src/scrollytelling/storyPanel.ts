// src/scrollytelling/storyPanel.ts
import type { StoryData, StoryStop, ResolvedStoryStop, CameraPosition } from './types';

export async function loadStoryData(): Promise<StoryData> {
  const response = await fetch('/data/story.json');
  return response.json();
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

    const text = document.createElement('p');
    text.textContent = stop.text;
    el.appendChild(text);

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
