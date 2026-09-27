// A video script: the comment syntax of public/data/story.md, one comment per
// scene, and the prose after it the narration. See
// docs/plans/2026-09-27-video-harness-design.md.

export type Step =
  | { kind: 'click'; text: string }
  | { kind: 'type'; text: string }
  | { kind: 'press'; key: string }
  | { kind: 'wait'; seconds: number };

interface SceneBase {
  id: string;
  narration: string;
}
export type StoryScene = SceneBase & { kind: 'story'; stop: string; over: number };
export type ViewScene = SceneBase & { kind: 'view'; params: Record<string, string>; over: number };
export type DoScene = SceneBase & { kind: 'do'; steps: Step[] };
export type Scene = StoryScene | ViewScene | DoScene;

export interface Script {
  width: number;
  height: number;
  fps: number;
  scenes: Scene[];
}

export const DEFAULT_OVER_S = 1.5;

const SCENE_RE = /<!--\s*scene:\s*([^|>]+?)\s*(?:\|([\s\S]*?))?\s*-->/g;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const STEP_RE = /^(\w+)\s+(?:"([^"]*)"|(\S+))$/;

export function parseScript(markdown: string): Script {
  const front = markdown.match(FRONTMATTER_RE);
  const settings = front ? parseSettings(front[1]) : {};
  const body = front ? markdown.slice(front[0].length) : markdown;

  const size = settings.size ?? '1920x1080';
  const [width, height] = size.split('x').map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`size must be WIDTHxHEIGHT, not "${size}"`);
  const fps = Number(settings.fps ?? 60);
  if (!(fps > 0)) throw new Error(`fps must be a positive number, not "${settings.fps}"`);

  const matches = [...body.matchAll(SCENE_RE)];
  if (matches.length === 0) throw new Error('the script has no scenes');

  const scenes = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
    const narration = body
      .slice(start, end)
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    return parseScene(m[1], parseParams(m[2] ?? ''), narration);
  });

  const seen = new Set<string>();
  for (const { id } of scenes) {
    if (id === 'end') {
      throw new Error('"end" names the end of the video; call the scene something else');
    }
    if (seen.has(id)) throw new Error(`scene "${id}" is named twice`);
    seen.add(id);
  }
  return { width, height, fps, scenes };
}

function parseSettings(block: string): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) settings[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return settings;
}

function parseParams(source: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of source.split('|')) {
    const colon = part.indexOf(':');
    if (colon > 0) params[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return params;
}

function parseScene(id: string, params: Record<string, string>, narration: string): Scene {
  const kinds = (['story', 'view', 'do'] as const).filter((k) => k in params);
  if (kinds.length !== 1) {
    throw new Error(`scene "${id}" needs exactly one of story:, view: or do:`);
  }
  const over = params.over === undefined ? DEFAULT_OVER_S : parseSeconds(params.over, id);
  switch (kinds[0]) {
    case 'story':
      return { id, narration, kind: 'story', stop: params.story, over };
    case 'view':
      return {
        id,
        narration,
        kind: 'view',
        params: Object.fromEntries(new URLSearchParams(params.view)),
        over,
      };
    case 'do':
      return {
        id,
        narration,
        kind: 'do',
        steps: splitSteps(params.do).map((s) => parseStep(s, id)),
      };
  }
}

function parseSeconds(value: string, id: string): number {
  const m = value.match(/^(\d+(?:\.\d+)?)s?$/);
  if (!m) throw new Error(`scene "${id}": "${value}" is not a number of seconds`);
  return Number(m[1]);
}

/** Splits on semicolons, except inside double quotes. */
function splitSteps(source: string): string[] {
  const steps: string[] = [];
  let current = '';
  let quoted = false;
  for (const ch of source) {
    if (ch === '"') quoted = !quoted;
    if (ch === ';' && !quoted) {
      steps.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  steps.push(current);
  return steps.map((s) => s.trim()).filter(Boolean);
}

function parseStep(source: string, id: string): Step {
  const m = source.match(STEP_RE);
  const [verb, quoted, bare] = m ? [m[1], m[2], m[3]] : [source, undefined, undefined];
  if (verb === 'click' && quoted !== undefined) return { kind: 'click', text: quoted };
  if (verb === 'type' && quoted !== undefined) return { kind: 'type', text: quoted };
  if (verb === 'press' && bare !== undefined) return { kind: 'press', key: bare };
  if (verb === 'wait' && bare !== undefined) {
    return { kind: 'wait', seconds: parseSeconds(bare, id) };
  }
  throw new Error(
    `scene "${id}": cannot read the step "${source}" — expected click "…", type "…", press Key or wait 1s`,
  );
}
