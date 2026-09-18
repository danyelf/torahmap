import type { StoryData, StoryStop, ResolvedStoryStop, CameraPosition, CameraRef } from './types';
import type { TanakhLayout } from '../types';
import { findTanakhItem } from '../types';
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

// Minimal markdown-to-HTML for story text: **bold**, *italic*, [links](url),
// paragraphs, and raw HTML (e.g. <span>).
function renderMarkdown(md: string): string {
  return md
    .split(/\n\n+/)
    .map((paragraph) => {
      const html = paragraph
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, ' ');
      return `<p>${html}</p>`;
    })
    .join('\n');
}

/**
 * What stands for a stop when the story is folded: its title, or else its
 * first sentence. Given `maxChars`, a longer label is cut at the last whole
 * word that fits and ends in an ellipsis.
 */
export function stopLabel(stop: Pick<StoryStop, 'title' | 'text'>, maxChars?: number): string {
  let label = stop.title;
  if (!label) {
    const div = document.createElement('div');
    div.innerHTML = renderMarkdown(stop.text);
    const text = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
    // A sentence can end inside a closing quote or bracket: Abraham.”
    label = text.match(/^.*?[.!?]["'”’)\]]*(?=\s|$)/)?.[0] ?? text;
  }
  if (maxChars === undefined || label.length <= maxChars) return label;
  const cut = label.slice(0, maxChars).replace(/\s+\S*$/, '');
  return `${cut.replace(/[\s,;:—–-]+$/, '')}…`;
}

export function renderStoryPanel(container: HTMLElement, stops: StoryStop[]): HTMLElement[] {
  container.innerHTML = '';
  const stopElements: HTMLElement[] = [];

  for (const stop of stops) {
    const el = document.createElement('div');
    el.className = 'story-stop';
    el.dataset.stopId = stop.id;

    if (stop.title) {
      const title = document.createElement('h2');
      title.textContent = stop.title;
      el.appendChild(title);
    }

    const textContainer = document.createElement('div');
    textContainer.className = 'story-text';
    textContainer.innerHTML = renderMarkdown(stop.text);
    el.appendChild(textContainer);

    container.appendChild(el);
    stopElements.push(el);
  }

  return stopElements;
}

function cameraForVerse(
  verse: TanakhLayout,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): CameraPosition {
  return {
    x: canvasWidth / 2 / zoom - verse.x - verse.size / 2,
    y: canvasHeight / 2 / zoom - verse.y - verse.size / 2,
    zoom,
  };
}

// "initial" uses the app's default camera position, unless the stop names a
// verse to pin on, in which case that verse is centered instead.
export function resolveStops(
  stops: StoryStop[],
  initialCamera: CameraPosition,
  verses?: TanakhLayout[],
  canvasWidth?: number,
  canvasHeight?: number,
): ResolvedStoryStop[] {
  return stops.map((stop) => {
    const cam = stop.camera;
    let camera: CameraPosition;

    if (isVerseRef(cam)) {
      const zoom = stop.zoom ?? 3;
      const parsed = parseVerseFromUrl(cam.ref);
      const verseLayout =
        parsed && verses && canvasWidth && canvasHeight ? findTanakhItem(verses, parsed) : null;
      if (verseLayout && canvasWidth && canvasHeight) {
        camera = cameraForVerse(verseLayout, zoom, canvasWidth, canvasHeight);
      } else {
        camera = { ...initialCamera };
      }
    } else if (cam !== 'initial') {
      camera = cam;
    } else if (stop.verse && verses && canvasWidth && canvasHeight) {
      const parsed = parseVerseFromUrl(stop.verse);
      const verseLayout = parsed ? findTanakhItem(verses, parsed) : null;
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

export function computeStopOffsets(stopElements: HTMLElement[]): number[] {
  return stopElements.map((el) => el.offsetTop);
}
