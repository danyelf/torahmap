// Rehearsal: the app in an iframe, the narration beside it. Space moves to the
// next scene and notes the time; Copy timings hands over the times file.
// Without a script the page only captures: explore the app, and C turns each
// view into a story.md stop or a script scene.
//
//   npm run rehearse   (opens /video/rehearse.html?script=sample)
//   npm run capture    (opens /video/rehearse.html)

import { parseScript, type Scene } from './script.ts';
import { cameraOf, doEvents, viewHash } from './timeline.ts';
import { restingScrollTops } from './inPage.ts';
import { captureLine, storyStopLine } from './capture.ts';
import { easingFunctions } from '../src/scrollytelling/interpolation.ts';

const scriptName = new URLSearchParams(location.search).get('script');
const script = scriptName
  ? parseScript(await (await fetch(`/video/scripts/${scriptName}.md`)).text())
  : null;
const scenes = script?.scenes ?? [];
const width = script?.width ?? 1920;
const height = script?.height ?? 1080;

const frame = document.querySelector<HTMLIFrameElement>('#app')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const status = document.querySelector<HTMLElement>('#status')!;
const now = document.querySelector<HTMLElement>('#now')!;
const next = document.querySelector<HTMLElement>('#next')!;
const captured = document.querySelector<HTMLTextAreaElement>('#captured')!;
const shotName = document.querySelector<HTMLInputElement>('#shot-name')!;
const format = document.querySelector<HTMLSelectElement>('#format')!;

// The app is laid out at the video's size, then scaled to fit, so what you
// rehearse over is what renders.
frame.width = String(width);
frame.height = String(height);
function fit(): void {
  const scale = Math.min(stage.clientWidth / width, stage.clientHeight / height);
  frame.style.transform = `scale(${scale})`;
}
addEventListener('resize', fit);
fit();

let index = -1;
let startedAt = 0;
let times: Record<string, number> = {};
let playing = 0; // bumped to cancel a glide or steps still running
// While a do: scene holds the cursor in a text box, Space still moves on:
// otherwise it would type a space into the box in the middle of the scene.
let acting = false;

/** Cancels whatever is still playing, and takes back the cursor a do: scene placed. */
function cancel(): void {
  playing++;
  if (acting) (frame.contentDocument?.activeElement as HTMLElement | null)?.blur();
  acting = false;
}

function advance(): void {
  cancel();
  if (index === -1) startedAt = performance.now();
  const at = Math.round((performance.now() - startedAt) / 100) / 10;
  index++;
  if (index === scenes.length) {
    times.end = at;
    status.textContent = `Done: ${at}s. Copy timings, or R to go again.`;
    return;
  }
  if (index > scenes.length) return;
  const scene = scenes[index];
  times[scene.id] = at;
  status.textContent = `Scene ${index + 1} of ${scenes.length}: ${scene.id}`;
  now.textContent = scene.narration;
  next.textContent = scenes[index + 1]?.narration.split('\n')[0] ?? '(last scene)';
  play(scene, scenes[index - 1] ?? null);
}

function restart(): void {
  index = -1;
  times = {};
  cancel();
  status.textContent = script
    ? 'Space: start · R: restart · C: capture'
    : 'Explore the map; C or Capture adds what it shows to the list.';
  now.textContent = scenes[0]?.narration ?? '';
  next.textContent = '';
}

function play(scene: Scene, previous: Scene | null): void {
  const run = ++playing;
  const win = frame.contentWindow!;
  const doc = frame.contentDocument!;

  if (scene.kind === 'story') {
    if (previous?.kind !== 'story' || !win.location.hash.startsWith('#story=')) {
      win.location.hash = `#story=${scene.stop}`;
      return;
    }
    const top = restingScrollTops(doc)?.[scene.stop];
    if (top !== undefined) {
      doc.getElementById('story-content')?.scrollTo({ top, behavior: 'smooth' });
    }
    return;
  }

  if (scene.kind === 'view') {
    const to = cameraOf(scene.params);
    const from = previous?.kind === 'view' ? cameraOf(previous.params) : null;
    // Cut straight to the scene's own URL state when there is nothing to glide
    // from, or no camera to glide to: rehearsal does not measure verse cameras.
    if (!to || !from) {
      win.location.hash = `#${new URLSearchParams(scene.params)}`;
      return;
    }
    const began = performance.now();
    const step = () => {
      if (run !== playing) return;
      const linear = Math.min(1, (performance.now() - began) / 1000 / scene.over);
      win.location.hash = viewHash(scene, from, to, easingFunctions['ease-in-out'](linear));
      if (linear < 1) requestAnimationFrame(step);
    };
    step();
    return;
  }

  const events = doEvents(scene.steps);
  acting = true;
  const lastAt = events.length > 0 ? events[events.length - 1].at : 0;
  setTimeout(
    () => {
      if (run === playing) cancel();
    },
    lastAt * 1000 + 100,
  );
  for (const { at, action } of events) {
    setTimeout(() => {
      if (run !== playing) return;
      if (action.kind === 'click') {
        const target = [...doc.querySelectorAll<HTMLElement>('body *')]
          .reverse()
          .find((el) => el.textContent?.trim() === action.text);
        target?.click();
      } else if (action.kind === 'key') {
        doc.execCommand('insertText', false, action.text);
      } else {
        doc.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: action.key, bubbles: true }),
        );
      }
    }, at * 1000);
  }
}

function onKey(e: KeyboardEvent): void {
  const target = e.target as Element | null;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
  if (typing && !acting) return;
  if (e.key === 'c' || e.key === 'C') {
    capture();
  } else if (!script) {
    return;
  } else if (e.key === ' ') {
    e.preventDefault();
    advance();
  } else if (e.key === 'r' || e.key === 'R') {
    restart();
  }
}
addEventListener('keydown', onKey);
frame.addEventListener('load', () => frame.contentWindow?.addEventListener('keydown', onKey));

// Scripts are what rehearsal is for; without one, story.md is.
format.value = script ? 'scene' : 'stop';
let captures = 0;

/** Adds what the app shows now to the list, as the chosen kind of line. */
function capture(): void {
  const hash = frame.contentWindow!.location.hash;
  const name = shotName.value.trim() || `shot${++captures}`;
  const line = format.value === 'stop' ? storyStopLine(name, hash) : `${captureLine(name, hash)}\n`;
  if (line === null) {
    status.textContent = 'This is the story itself: leave it, or capture a scene line instead.';
    return;
  }
  captured.value += line;
  captured.scrollTop = captured.scrollHeight;
  shotName.value = '';
  status.textContent = `Captured ${name}.`;
}
document.querySelector('#capture')!.addEventListener('click', capture);

document.querySelector('#copy-all')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(captured.value);
  status.textContent = 'The list is on the clipboard.';
});

const copyTimes = document.querySelector<HTMLButtonElement>('#copy-times')!;
copyTimes.hidden = !script;
copyTimes.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(times, null, 2));
  status.textContent = 'Timings copied: save them beside the script as <name>.times.json';
});

restart();
