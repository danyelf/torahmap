// Renders a video script to MP4, one screenshot per frame on a fake clock.
//
//   npm run video -- video/scripts/sample.md [--out file.mp4]
//     [--fps 10] [--scale 0.5] [--from 30] [--to 45]
//
// The times come from the file beside the script, sample.times.json. The last
// four options make a rough cut: fewer, smaller frames, of one stretch.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser, Page } from 'playwright';
import { parseScript } from './script.ts';
import {
  buildTimeline,
  duration,
  glides,
  segmentAt,
  transition,
  viewHash,
  doEvents,
  actionsDue,
  type Camera,
  type Segment,
  type TimedAction,
} from './timeline.ts';
import { launch, measureCameras, openMap } from './browser.ts';
import { holdCssAnimations, restingScrollTops } from './inPage.ts';

const PORT = Number(process.env.VIDEO_PORT ?? 5198);
const BASE = `http://localhost:${PORT}/`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    fps: { type: 'string' },
    scale: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
  },
});
const scriptPath = positionals[0];
if (!scriptPath) throw new Error('usage: npm run video -- <script.md> [options]');

const script = parseScript(readFileSync(scriptPath, 'utf8'));
const timeline = buildTimeline(
  script,
  JSON.parse(readFileSync(scriptPath.replace(/\.md$/, '.times.json'), 'utf8')),
);
const fps = Number(values.fps ?? script.fps);
const scale = Number(values.scale ?? 1);
const from = Number(values.from ?? 0);
const to = Math.min(Number(values.to ?? Infinity), duration(timeline));
const out =
  values.out ?? join(dirname(scriptPath), '..', 'out', `${basename(scriptPath, '.md')}.mp4`);
mkdirSync(dirname(out), { recursive: true });

let server: ChildProcess | undefined;
let browser: Browser | undefined;
try {
  if (spawnSync('ffmpeg', ['-version']).error) throw new Error('ffmpeg is not installed');
  server = await startServer();
  browser = await launch();
  await render(browser);
  console.log(`\nwrote ${out}`);
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}

async function render(browser: Browser): Promise<void> {
  const cameras = await measureCameras(browser, BASE, script);
  const page = await openMap(browser, BASE, script.width, script.height, true);
  // Called with no argument, it reads the page's own document.
  const stopTops = await page.evaluate(restingScrollTops as () => Record<string, number> | null);
  checkStops(stopTops);

  const encoder = startEncoder(out, fps, scale);
  const scene = sceneDriver(page, cameras, stopTops ?? {});
  try {
    for (let frame = 0; frame / fps <= to; frame++) {
      const t = frame / fps;
      await scene.show(segmentAt(timeline, t), t);
      await page.clock.runFor(1000 / fps);
      if (t < from) continue;
      await page.evaluate(holdCssAnimations);
      await encoder.write(
        await page.screenshot(scale < 1 ? { type: 'jpeg', quality: 85 } : { type: 'png' }),
      );
      process.stdout.write(`\r${t.toFixed(1)}s of ${to.toFixed(1)}s`);
    }
    await encoder.finish();
  } catch (e) {
    encoder.abort();
    throw e;
  }
}

function checkStops(stopTops: Record<string, number> | null): void {
  const stories = script.scenes.filter((s) => s.kind === 'story');
  if (stories.length === 0) return;
  if (!stopTops) {
    throw new Error(
      `the story cannot scroll at ${script.width}x${script.height}; use a wider size`,
    );
  }
  for (const s of stories) {
    if (!(s.stop in stopTops)) throw new Error(`scene "${s.id}": story.md has no stop "${s.stop}"`);
  }
}

/** Puts the page into the state `segment` has at `t`. */
function sceneDriver(page: Page, cameras: Map<string, Camera>, stopTops: Record<string, number>) {
  let current: Segment | null = null;
  let hash = '';
  let fromTop = 0;
  let fromCamera: Camera | null = null;
  let actions: TimedAction[] = [];
  let fired = 0;

  const fireDue = async (segment: Segment, t: number) => {
    const due = actionsDue(segment, actions, t);
    for (; fired < due.length; fired++) await act(page, segment.scene.id, due[fired]);
  };

  const setHash = async (next: string) => {
    if (next === hash) return;
    hash = next;
    await page.evaluate((h) => (location.hash = h), next);
  };
  const storyTop = () =>
    page.evaluate(() => document.getElementById('story-content')?.scrollTop ?? 0);

  async function enter(segment: Segment): Promise<void> {
    const { scene } = segment;
    // The app rewrites the URL itself as it goes, so the last hash written
    // here says nothing about the page once a scene is over.
    hash = '';
    if (scene.kind === 'story') {
      if (!glides(segment)) {
        await setHash(`#story=${scene.stop}`);
        await page.clock.runFor(50);
      }
      fromTop = await storyTop();
    } else if (scene.kind === 'view') {
      const previous = segment.previous;
      fromCamera = glides(segment) && previous ? (cameras.get(previous.id) ?? null) : null;
    } else {
      actions = doEvents(scene.steps);
      fired = 0;
    }
  }

  return {
    async show(segment: Segment, t: number): Promise<void> {
      if (segment !== current) {
        if (current?.scene.kind === 'do') await fireDue(current, current.end);
        current = segment;
        await enter(segment);
      }
      const { scene } = segment;
      const p = transition(segment, t);
      if (scene.kind === 'story') {
        const top = fromTop + (stopTops[scene.stop] - fromTop) * p;
        await page.evaluate((y) => {
          const content = document.getElementById('story-content');
          if (content && content.scrollTop !== y) content.scrollTop = y;
        }, top);
      } else if (scene.kind === 'view') {
        await setHash(viewHash(scene, fromCamera, cameras.get(scene.id)!, p));
      } else {
        await fireDue(segment, t);
      }
    },
  };
}

async function act(page: Page, sceneId: string, { action }: TimedAction): Promise<void> {
  switch (action.kind) {
    case 'click': {
      // Playwright's own click waits for the element to hold still across
      // animation frames, which never come on a paused clock; clicking at the
      // element's centre does not wait.
      const box = await page
        .getByText(action.text, { exact: true })
        .first()
        .boundingBox({ timeout: 2000 })
        .catch(() => null);
      if (!box) throw new Error(`scene "${sceneId}": nothing on screen says "${action.text}"`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      break;
    }
    case 'key':
      await page.keyboard.type(action.text);
      break;
    case 'press':
      await page.keyboard.press(action.key);
      break;
  }
}

function startEncoder(file: string, rate: number, factor: number) {
  const args = [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(rate),
    '-i',
    '-',
  ];
  if (factor !== 1) args.push('-vf', `scale=trunc(iw*${factor}/2)*2:-2`);
  args.push('-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '18', file);
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', (e) => reject(new Error(`could not run ffmpeg: ${e.message}`)));
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
  // An early exit is reported through `done`, on the next write; unhandled,
  // either would end the process before the dev server is stopped.
  let failure: Error | null = null;
  done.catch((e: Error) => (failure = e));
  ffmpeg.stdin.on('error', () => {});
  return {
    write: async (image: Buffer) => {
      if (failure) throw failure;
      if (!ffmpeg.stdin.write(image)) await Promise.race([once(ffmpeg.stdin, 'drain'), done]);
    },
    finish: async () => {
      ffmpeg.stdin.end();
      await done;
    },
    // On SIGTERM ffmpeg finishes the file, waiting on an input that never
    // closes, so the pipe is shut and the process killed outright.
    abort: () => {
      ffmpeg.stdin.destroy();
      ffmpeg.kill('SIGKILL');
    },
  };
}

/**
 * Starts vite and waits for its own banner. A request to the port is no test:
 * another server already on it would answer, and the video would be rendered
 * from its code.
 */
async function startServer(): Promise<ChildProcess> {
  const vite = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stderr.resume();
  await new Promise<void>((resolve, reject) => {
    const fail = (message: string) => {
      clearTimeout(timer);
      vite.kill();
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail('the dev server did not start within 30 seconds'), 30_000);
    vite.on('exit', () =>
      fail(`the dev server could not start; is port ${PORT} in use? VIDEO_PORT picks another`),
    );
    vite.stdout.on('data', (chunk: Buffer) => {
      // The banner prints the port in bold.
      if (
        chunk
          .toString()
          .replace(/\x1b\[[0-9;]*m/g, '')
          .includes(`:${PORT}/`)
      ) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return vite;
}
