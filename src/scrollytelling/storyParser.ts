import type { StoryData, StoryStop, EasingName, CameraRef } from './types';
import { parseVerseFromUrl } from '../urlState';

// A story is optional YAML frontmatter (`title`, `description`, `easing`)
// followed by stops, each opened by `<!-- stop: id | camera: ... | overlay: ... | key: value -->`
// and a `# Title` heading; params other than camera/overlay/easing/verse/zoom
// become that stop's overlay params. See public/data/stories/ for examples.
export function parseStoryMarkdown(markdown: string): StoryData {
  const front = parseFrontmatter(markdown);
  const stops = parseStops(stripFrontmatter(markdown));
  const easing = front.easing as EasingName | undefined;
  return {
    stops,
    defaults: easing ? { easing } : undefined,
    title: front.title,
    description: front.description,
  };
}

// --- Frontmatter ---

function parseFrontmatter(md: string): Record<string, string> {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  const fields: Record<string, string> = {};
  if (!match) return fields;
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (key.trim() && value) fields[key.trim()] = value;
  }
  return fields;
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

// --- Stop parsing ---

const STOP_COMMENT_RE = /<!--\s*stop:\s*([^|>]+?)(?:\s*\|(.+?))?\s*-->/g;

interface StopMeta {
  id: string;
  params: Record<string, string>;
  contentStart: number;
}

function parseStopComment(
  id: string,
  paramsStr: string | undefined,
): { id: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  if (paramsStr) {
    for (const part of paramsStr.split('|')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx >= 0) {
        const key = part.slice(0, colonIdx).trim();
        const value = part.slice(colonIdx + 1).trim();
        if (key && value) params[key] = value;
      }
    }
  }
  return { id: id.trim(), params };
}

function parseCamera(params: Record<string, string>): CameraRef {
  const cameraStr = params.camera;
  if (!cameraStr || cameraStr === 'initial') return 'initial';

  // Support "x,y,zoom" format
  const parts = cameraStr.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return { x: parts[0], y: parts[1], zoom: parts[2] };
  }

  // e.g. "Genesis.12.1" or "I.Samuel.1.5"
  if (parseVerseFromUrl(cameraStr)) {
    return { kind: 'verse', ref: cameraStr };
  }

  // Region names, checked against the map when the stop is resolved.
  const names = cameraStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { kind: 'regions', names };
}

function parseStops(body: string): StoryStop[] {
  const stops: StoryStop[] = [];
  const metas: StopMeta[] = [];

  let match;
  STOP_COMMENT_RE.lastIndex = 0;
  while ((match = STOP_COMMENT_RE.exec(body)) !== null) {
    const { id, params } = parseStopComment(match[1], match[2]);
    // Scrolling resyncs a stop only when the id changes, and the URL names a stop by id.
    if (metas.some((m) => m.id === id)) {
      console.error(`[story] duplicate stop id "${id}"; each stop needs its own`);
    }
    metas.push({
      id,
      params,
      contentStart: match.index + match[0].length,
    });
  }

  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const contentEnd =
      i + 1 < metas.length ? body.lastIndexOf('<!--', metas[i + 1].contentStart) : body.length;
    const rawContent = body.slice(meta.contentStart, contentEnd).trim();

    const titleMatch = rawContent.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1].trim();

    const text = titleMatch
      ? rawContent.slice(rawContent.indexOf(titleMatch[0]) + titleMatch[0].length).trim()
      : rawContent;

    const camera = parseCamera(meta.params);

    const overlayParams: Record<string, string> = {};
    let overlay: string | null = null;
    let easing: EasingName | undefined;

    let verse: string | undefined;
    let zoom: number | undefined;

    for (const [key, value] of Object.entries(meta.params)) {
      if (key === 'camera') continue;
      if (key === 'overlay') {
        overlay = value;
      } else if (key === 'easing') {
        easing = value as EasingName;
      } else if (key === 'verse') {
        verse = value;
      } else if (key === 'zoom') {
        const z = parseFloat(value);
        if (!isNaN(z)) zoom = z;
      } else {
        overlayParams[key] = value;
      }
    }

    stops.push({
      id: meta.id,
      title,
      text,
      camera,
      overlay,
      overlayParams: Object.keys(overlayParams).length > 0 ? overlayParams : undefined,
      verse,
      easing,
      zoom,
    });
  }

  return stops;
}
