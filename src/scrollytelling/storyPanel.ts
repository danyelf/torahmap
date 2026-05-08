// src/scrollytelling/storyPanel.ts
import type { StoryData, StoryStop, ResolvedStoryStop, CameraPosition, CameraRef } from './types';
import type { VerseLayout } from '../types';
import { parseVerseFromUrl } from '../urlState';
import { parseStoryMarkdown } from './storyParser';

function isVerseRef(cam: CameraRef): cam is { kind: 'verse'; ref: string } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'verse';
}

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
 * Compute camera position that centers on a verse.
 */
function cameraForVerse(
  verse: VerseLayout,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): CameraPosition {
  return {
    x: canvasWidth / 2 / zoom - verse.x - verse.size / 2,
    y: canvasHeight / 2 / zoom - verse.y - verse.size / 2,
    zoom,
  };
}

/**
 * Resolve camera references to actual coordinates.
 * - "initial": use the app's default camera position
 * - If the stop has a verse and camera is "initial", center on that verse
 */
export function resolveStops(
  stops: StoryStop[],
  initialCamera: CameraPosition,
  verses?: VerseLayout[],
  canvasWidth?: number,
  canvasHeight?: number
): ResolvedStoryStop[] {
  return stops.map(stop => {
    const cam = stop.camera;
    let camera: CameraPosition;

    if (isVerseRef(cam)) {
      // Verse-ref camera: look up world position, default zoom to 3 if not specified
      const zoom = stop.zoom ?? 3;
      const parsed = parseVerseFromUrl(cam.ref);
      const verseLayout = parsed && verses && canvasWidth && canvasHeight
        ? verses.find(v => v.book === parsed.book && v.chapter === parsed.chapter && v.verse === parsed.verse)
        : undefined;
      if (verseLayout && canvasWidth && canvasHeight) {
        camera = cameraForVerse(verseLayout, zoom, canvasWidth, canvasHeight);
      } else {
        camera = { ...initialCamera };
      }
    } else if (cam !== 'initial') {
      camera = cam;
    } else if (stop.verse && verses && canvasWidth && canvasHeight) {
      // Center camera on the pinned verse
      const parsed = parseVerseFromUrl(stop.verse);
      const verseLayout = parsed && verses.find(
        v => v.book === parsed.book && v.chapter === parsed.chapter && v.verse === parsed.verse
      );
      if (verseLayout) {
        camera = cameraForVerse(verseLayout, initialCamera.zoom, canvasWidth, canvasHeight);
      } else {
        camera = { ...initialCamera };
      }
    } else {
      camera = { ...initialCamera };
    }

    return { ...stop, camera };
  });
}

/**
 * Compute the scroll offset for each stop element.
 */
export function computeStopOffsets(stopElements: HTMLElement[]): number[] {
  return stopElements.map((el) => el.offsetTop);
}
