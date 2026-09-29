// When each scene is on screen, and what it shows at a given second.

import { easingFunctions, lerpCamera } from '../src/scrollytelling/interpolation.ts';
import type { Scene, Script, Step, ViewScene } from './script.ts';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Scene id → the second it starts, plus `end`, when the video ends. */
export type Times = Record<string, number>;

export interface Segment {
  scene: Scene;
  previous: Scene | null;
  start: number;
  end: number;
}

export type Action =
  { kind: 'click'; text: string } | { kind: 'key'; text: string } | { kind: 'press'; key: string };

/** An action `at` seconds after its scene starts. */
export interface TimedAction {
  at: number;
  action: Action;
}

export const TYPE_INTERVAL_S = 0.08;
export const CLICK_PAUSE_S = 0.5;

export function buildTimeline(script: Script, times: Times): Segment[] {
  const missing = [...script.scenes.map((s) => s.id), 'end'].filter(
    (id) => typeof times[id] !== 'number',
  );
  if (missing.length > 0) throw new Error(`the times file has no time for: ${missing.join(', ')}`);

  const first = script.scenes[0];
  if (times[first.id] !== 0) throw new Error(`the first scene, "${first.id}", must start at 0`);

  return script.scenes.map((scene, i) => {
    const start = times[scene.id];
    const end = i + 1 < script.scenes.length ? times[script.scenes[i + 1].id] : times.end;
    if (!(end > start)) {
      throw new Error(
        `scene "${scene.id}" starts at ${start}s, but what follows it starts at ${end}s`,
      );
    }
    const segment = { scene, previous: i > 0 ? script.scenes[i - 1] : null, start, end };
    const needs =
      scene.kind === 'do' ? lastActionAt(scene.steps) : glides(segment) ? scene.over : 0;
    if (needs > end - start) {
      throw new Error(
        `scene "${scene.id}" needs ${seconds(needs)}s, but lasts only ${seconds(end - start)}s before what follows`,
      );
    }
    if (scene.fade > end - start) {
      throw new Error(
        `scene "${scene.id}" has a ${seconds(scene.fade)}s fade, but lasts only ${seconds(end - start)}s`,
      );
    }
    return segment;
  });
}

/** How long a caption takes to appear or go. */
export const CAPTION_EASE_S = 0.3;

/**
 * How opaque the caption of scene `index` is at `t`, 0 to 1. A caption eases in
 * as its scene starts and out as it ends, unless the scene beside it carries the
 * same words, when it holds across the change.
 */
export function captionOpacity(timeline: Segment[], index: number, t: number): number {
  const { scene, start, end } = timeline[index];
  if (!scene.caption) return 0;
  const same = (i: number) => timeline[i]?.scene.caption === scene.caption;
  const easeIn = same(index - 1) ? 1 : (t - start) / CAPTION_EASE_S;
  const easeOut = same(index + 1) ? 1 : (end - t) / CAPTION_EASE_S;
  return Math.max(0, Math.min(1, easeIn, easeOut));
}

/** How much of the picture before a fading scene still shows at `t`: 1 as it starts, 0 once done. */
export function fadeRemaining(segment: Segment, t: number): number {
  const { fade } = segment.scene;
  if (fade <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (t - segment.start) / fade));
}

export function segmentAt(timeline: Segment[], t: number): Segment {
  let found = timeline[0];
  for (const segment of timeline) if (segment.start <= t) found = segment;
  return found;
}

export function duration(timeline: Segment[]): number {
  return timeline[timeline.length - 1].end;
}

/** A scene glides in from one of its own kind; any other change is a cut. */
export function glides(segment: Segment): boolean {
  return segment.scene.kind !== 'do' && segment.previous?.kind === segment.scene.kind;
}

/**
 * How far through its glide a scene is at `t`, eased: 0 at its start, 1 once
 * arrived. A scene that cuts has arrived from its first frame.
 */
export function transition(segment: Segment, t: number): number {
  const { scene } = segment;
  if (scene.kind === 'do' || !glides(segment) || scene.over <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (t - segment.start) / scene.over));
  return easingFunctions['ease-in-out'](linear);
}

export function cameraOf(params: Record<string, string>): Camera | null {
  if (params.x === undefined || params.y === undefined) return null;
  return { x: Number(params.x), y: Number(params.y), zoom: Number(params.zoom ?? 1) };
}

/**
 * The URL query for `scene`, its camera `p` of the way from `from` to `to`. A
 * pinned verse centres the camera on itself, so the verse is held back until
 * the camera has arrived.
 */
export function viewQuery(scene: ViewScene, from: Camera | null, to: Camera, p: number): string {
  const arrived = from === null || p >= 1;
  const camera = arrived ? to : lerpCamera(from, to, p);
  const params: Record<string, string> = {
    ...scene.params,
    x: String(camera.x),
    y: String(camera.y),
    zoom: String(camera.zoom),
  };
  if (!arrived) delete params.verse;
  return new URLSearchParams(params).toString();
}

export function doEvents(steps: Step[]): TimedAction[] {
  const events: TimedAction[] = [];
  let at = 0;
  for (const step of steps) {
    switch (step.kind) {
      case 'click':
        events.push({ at, action: { kind: 'click', text: step.text } });
        at += CLICK_PAUSE_S;
        break;
      case 'press':
        events.push({ at, action: { kind: 'press', key: step.key } });
        at += TYPE_INTERVAL_S;
        break;
      case 'type':
        for (const ch of step.text) {
          events.push({ at, action: { kind: 'key', text: ch } });
          at += TYPE_INTERVAL_S;
        }
        break;
      case 'wait':
        at += step.seconds;
        break;
    }
  }
  return events;
}

/**
 * The actions of a do: scene due by `t`: all of them once the scene has
 * ended, since the last may fall between two frames and no frame would fire it.
 */
export function actionsDue(segment: Segment, events: TimedAction[], t: number): TimedAction[] {
  return events.filter((e) => t >= segment.end || segment.start + e.at <= t);
}

function seconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function lastActionAt(steps: Step[]): number {
  const events = doEvents(steps);
  return events.length > 0 ? events[events.length - 1].at : 0;
}
