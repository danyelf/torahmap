// Lays a voiceover under a rendered video.
//
//   npm run mix -- video/out/reel.mp4 voice.m4a --from 3.85 --to 60.3 --at 0.85
//     [--cut 24.9-30.1 ...] [--pause 24.9:4.3 ...] [--out file.mp4]
//
// The recording is cut to --from..--to seconds, which drops the room noise
// before the first word and after the last, and starts --at seconds into the
// video. In the recording's own seconds, each --cut takes out a stretch such
// as a fluffed line, and each --pause adds that much silence at a moment, to
// hold the voice while the picture catches up. It fades in and out, is copied
// to both channels, and is brought to -14 LUFS, where social video sits.
// Loudness is measured first and corrected in one linear step: measuring and
// correcting together rides the gain up and down with the speech.

import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const TARGET = 'I=-14:TP=-1.5:LRA=11';
const FADE_S = { in: 0.1, out: 1 };
const RATE = 48000;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: 'string', default: '0' },
    to: { type: 'string' },
    at: { type: 'string', default: '0' },
    cut: { type: 'string', multiple: true, default: [] },
    pause: { type: 'string', multiple: true, default: [] },
    out: { type: 'string' },
  },
});
const [video, voice] = positionals;
if (!video || !voice || values.to === undefined) {
  throw new Error(
    'usage: npm run mix -- <video.mp4> <voice> --to S [--from S] [--at S]' +
      ' [--cut S-E ...] [--pause S:SECONDS ...] [--out file]',
  );
}
const atMs = Math.round(Number(values.at) * 1000);
const out = values.out ?? video.replace(/\.mp4$/, '-voiced.mp4');
const cuts = values.cut.map((c) => pair(c, '-', '--cut is START-END'));
const pauses = values.pause.map((p) => pair(p, ':', '--pause is AT:SECONDS'));

type Piece = { kind: 'voice'; start: number; end: number } | { kind: 'silence'; seconds: number };

/** The recording between --from and --to, less the cuts, with the pauses laid in. */
function pieces(): Piece[] {
  let spans = [[Number(values.from), Number(values.to!)]];
  for (const [a, b] of cuts) {
    spans = spans.flatMap(([s, e]) =>
      [
        [s, Math.min(e, a)],
        [Math.max(s, b), e],
      ].filter(([x, y]) => x < y),
    );
  }
  for (const [at] of pauses) {
    spans = spans.flatMap(([s, e]) =>
      s < at && at < e
        ? [
            [s, at],
            [at, e],
          ]
        : [[s, e]],
    );
  }
  return spans.flatMap(([s, e]): Piece[] => [
    { kind: 'voice', start: s, end: e },
    ...pauses
      .filter(([at]) => Math.abs(at - e) < 1e-6)
      .map(([, seconds]): Piece => ({ kind: 'silence', seconds })),
  ]);
}

/** The shaped voice from input `input`, labelled [voice]. */
function shaped(input: number): string {
  const parts = pieces();
  const length = parts.reduce(
    (sum, p) => sum + (p.kind === 'voice' ? p.end - p.start : p.seconds),
    0,
  );
  const voices = parts.filter((p) => p.kind === 'voice').length;
  const chains: string[] = [`[${input}:a]aresample=${RATE},asplit=${voices}${labels('v', voices)}`];
  let v = 0;
  const order = parts.map((p, i) => {
    if (p.kind === 'silence') {
      chains.push(`aevalsrc=0:c=mono:s=${RATE}:d=${p.seconds}[p${i}]`);
    } else {
      chains.push(`[v${v++}]atrim=start=${p.start}:end=${p.end},asetpts=PTS-STARTPTS[p${i}]`);
    }
    return `[p${i}]`;
  });
  // Copied to stereo before measuring: a loudness meter sums the channels, so
  // a mono voice measured alone comes out 3 dB louder once it is in both.
  chains.push(
    `${order.join('')}concat=n=${order.length}:v=0:a=1,` +
      `afade=t=in:d=${FADE_S.in},afade=t=out:st=${length - FADE_S.out}:d=${FADE_S.out},` +
      'pan=stereo|c0=c0|c1=c0[voice]',
  );
  return chains.join(';');
}

const measured = JSON.parse(
  /\{[^{}]*"input_i"[^{}]*\}/.exec(
    ffmpeg([
      '-hide_banner',
      '-i',
      voice,
      '-filter_complex',
      `${shaped(0)};[voice]loudnorm=${TARGET}:print_format=json[m]`,
      '-map',
      '[m]',
      '-f',
      'null',
      '-',
    ]),
  )![0],
);

ffmpeg([
  '-loglevel',
  'error',
  '-y',
  '-i',
  video,
  '-i',
  voice,
  '-filter_complex',
  `${shaped(1)};[voice]loudnorm=${TARGET}` +
    `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
    `:offset=${measured.target_offset}:linear=true,` +
    `aresample=${RATE},adelay=${atMs}|${atMs},apad[a]`,
  '-map',
  '0:v',
  '-map',
  '[a]',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-shortest',
  out,
]);
console.log(`wrote ${out}`);

function pair(value: string, separator: string, shape: string): [number, number] {
  const [a, b] = value.split(separator).map(Number);
  if (!(a >= 0 && b > 0) || (separator === '-' && a >= b)) {
    throw new Error(`${shape}, not "${value}"`);
  }
  return [a, b];
}

function labels(prefix: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `[${prefix}${i}]`).join('');
}

/** Runs ffmpeg, returning what it prints to stderr, where it reports. */
function ffmpeg(args: string[]): string {
  const run = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (run.error) throw new Error('ffmpeg is not installed');
  if (run.status !== 0) throw new Error(`ffmpeg failed:\n${run.stderr}`);
  return run.stderr;
}
