import {
  EASINGS,
  type StoryData,
  type StoryStop,
  type EasingName,
  type CameraRef,
  type CameraPosition,
} from './types.ts';

/** The frontmatter keys a story may set. */
export const STORY_HEADER_KEYS = ['title', 'description', 'order', 'draft', 'easing'] as const;
type HeaderKey = (typeof STORY_HEADER_KEYS)[number];

/** The settings a stop's comment may give, beside the search's and the overlay's. */
const STOP_KEYS = ['camera', 'zoom', 'overlay', 'pin', 'easing'] as const;
type StopKey = (typeof STOP_KEYS)[number];
type StopSettings = Partial<Record<StopKey, string>>;

function isStopKey(key: string): key is StopKey {
  return (STOP_KEYS as readonly string[]).includes(key);
}

// A story is optional frontmatter (STORY_HEADER_KEYS) followed by stops, each
// opened by `<!-- stop: id | camera: ... | search: ... | overlay: ... | key: value -->`
// and a `# Title` heading. `searchKeys` go to the search, and settings other
// than STOP_KEYS to the overlay. See markdown/ for examples.
export function parseStoryMarkdown(markdown: string, searchKeys: ReadonlySet<string>): StoryData {
  const front = parseFrontmatter(markdown);
  const stops = parseStops(stripFrontmatter(markdown), searchKeys);
  const order = Number(front.order);
  return {
    stops,
    easing: easingNamed(front.easing),
    title: front.title ?? '',
    description: front.description ?? '',
    order: Number.isFinite(order) ? order : undefined,
    draft: front.draft === 'true',
  };
}

function easingNamed(name: string | undefined): EasingName | undefined {
  if (name === undefined) return undefined;
  const known: readonly string[] = EASINGS;
  if (!known.includes(name)) {
    throw new Error(`[story] no easing named "${name}"; use one of ${EASINGS.join(', ')}`);
  }
  return name as EasingName;
}

// --- Frontmatter ---

function parseFrontmatter(md: string): Partial<Record<HeaderKey, string>> {
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

/** A stop's opening comment: its id, then its `key: value` settings, each after a `|`. */
export const STOP_COMMENT_RE = /<!--\s*stop:\s*([^|>]+?)(?:\s*\|(.+?))?\s*-->/g;

/** A camera position as a stop's comment writes it, to two decimals. */
export function cameraSetting(camera: CameraPosition): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return [camera.x, camera.y, camera.zoom].map(round).join(',');
}

/** The comment that opens stop `id`: its settings, then the search's and the overlay's `params`. */
export function writeStopComment(
  id: string,
  settings: StopSettings,
  params: Record<string, string> = {},
): string {
  const own = STOP_KEYS.flatMap((key) => (settings[key] ? [[key, settings[key]]] : []));
  const parts = [...own, ...Object.entries(params)].map(([key, value]) => `${key}: ${value}`);
  return `<!-- stop: ${[id, ...parts].join(' | ')} -->`;
}

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

function parseCamera(cameraStr: string | undefined): CameraRef {
  if (!cameraStr || cameraStr === 'initial') return 'initial';

  // Support "x,y,zoom" format
  const parts = cameraStr.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return { x: parts[0], y: parts[1], zoom: parts[2] };
  }

  // Places on the map, which the text finds when the stop is resolved.
  const names = cameraStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { kind: 'places', names };
}

function parseStops(body: string, searchKeys: ReadonlySet<string>): StoryStop[] {
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

    const settings: StopSettings = {};
    const overlayParams: Record<string, string> = {};
    const searchParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta.params)) {
      if (isStopKey(key)) settings[key] = value;
      else if (searchKeys.has(key)) searchParams[key] = value;
      else overlayParams[key] = value;
    }
    const zoom = parseFloat(settings.zoom ?? '');

    stops.push({
      id: meta.id,
      title,
      text,
      camera: parseCamera(settings.camera),
      overlay: settings.overlay ?? null,
      overlayParams: Object.keys(overlayParams).length > 0 ? overlayParams : undefined,
      searchParams: Object.keys(searchParams).length > 0 ? searchParams : undefined,
      pin: settings.pin,
      easing: easingNamed(settings.easing),
      zoom: isNaN(zoom) ? undefined : zoom,
    });
  }

  return stops;
}
