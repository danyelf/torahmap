// Rehearsal: the app in an iframe, the narration beside it. Space moves to the
// next scene and notes the time; Copy timings hands over the times file.
//
//   npm run rehearse   (opens /video/rehearse.html?script=sample)

import { parseScript, type Scene } from './script.ts';
import { cameraOf, doEvents, viewHash } from './timeline.ts';
import { restingScrollTops } from './inPage.ts';
import { captureLine } from './capture.ts';
import { easingFunctions } from '../src/scrollytelling/interpolation.ts';

const name = new URLSearchParams(location.search).get('script') ?? 'sample';
const script = parseScript(await (await fetch(`/video/scripts/${name}.md`)).text());

const frame = document.querySelector<HTMLIFrameElement>('#app')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const status = document.querySelector<HTMLElement>('#status')!;
const now = document.querySelector<HTMLElement>('#now')!;
const next = document.querySelector<HTMLElement>('#next')!;
const captured = document.querySelector<HTMLElement>('#captured')!;

// The app is laid out at the video's size, then scaled to fit, so what you
// rehearse over is what renders.
frame.width = String(script.width);
frame.height = String(script.height);
function fit(): void {
  const scale = Math.min(stage.clientWidth / script.width, stage.clientHeight / script.height);
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
  if (index === script.scenes.length) {
    times.end = at;
    status.textContent = `Done: ${at}s. Copy timings, or R to go again.`;
    return;
  }
  if (index > script.scenes.length) return;
  const scene = script.scenes[index];
  times[scene.id] = at;
  status.textContent = `Scene ${index + 1} of ${script.scenes.length}: ${scene.id}`;
  now.textContent = scene.narration;
  next.textContent = script.scenes[index + 1]?.narration.split('\n')[0] ?? '(last scene)';
  play(scene, script.scenes[index - 1] ?? null);
}

function restart(): void {
  index = -1;
  times = {};
  cancel();
  status.textContent = 'Space: start · R: restart';
  now.textContent = script.scenes[0].narration;
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
  const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
  if (typing && !acting) return;
  if (e.key === ' ') {
    e.preventDefault();
    advance();
  } else if (e.key === 'r' || e.key === 'R') {
    restart();
  }
}
addEventListener('keydown', onKey);
frame.addEventListener('load', () => frame.contentWindow?.addEventListener('keydown', onKey));

let captures = 0;
document.querySelector('#capture')!.addEventListener('click', async () => {
  const line = captureLine(`shot${++captures}`, frame.contentWindow!.location.hash);
  captured.textContent += `${line}\n`;
  await navigator.clipboard.writeText(line);
});

document.querySelector('#copy-times')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(times, null, 2));
  status.textContent = 'Timings copied: save them beside the script as <name>.times.json';
});

restart();
