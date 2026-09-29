// Lays a voiceover under a rendered video.
//
//   npm run mix -- video/out/reel.mp4 voice.m4a --from 3.85 --to 60.3 --at 0.85
//     [--out file.mp4]
//
// The recording is cut to --from..--to seconds, which drops the room noise
// before the first word and after the last, and starts --at seconds into the
// video. It fades in and out, is copied to both channels, and is brought to
// -14 LUFS, where social video sits. Loudness is measured first and corrected
// in one linear step: measuring and correcting together rides the gain up and
// down with the speech.

import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const TARGET = 'I=-14:TP=-1.5:LRA=11';
const FADE_S = { in: 0.1, out: 1 };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: 'string', default: '0' },
    to: { type: 'string' },
    at: { type: 'string', default: '0' },
    out: { type: 'string' },
  },
});
const [video, voice] = positionals;
if (!video || !voice || values.to === undefined) {
  throw new Error(
    'usage: npm run mix -- <video.mp4> <voice> --to S [--from S] [--at S] [--out file]',
  );
}
const from = Number(values.from);
const to = Number(values.to);
const atMs = Math.round(Number(values.at) * 1000);
const out = values.out ?? video.replace(/\.mp4$/, '-voiced.mp4');

// Copied to stereo before measuring: a loudness meter sums the channels, so a
// mono voice measured alone comes out 3 dB louder once it is in both.
const shape = [
  `atrim=start=${from}:end=${to}`,
  'asetpts=PTS-STARTPTS',
  `afade=t=in:d=${FADE_S.in}`,
  `afade=t=out:st=${to - from - FADE_S.out}:d=${FADE_S.out}`,
  'pan=stereo|c0=c0|c1=c0',
].join(',');

const measured = JSON.parse(
  /\{[^{}]*"input_i"[^{}]*\}/.exec(
    ffmpeg([
      '-hide_banner',
      '-i',
      voice,
      '-af',
      `${shape},loudnorm=${TARGET}:print_format=json`,
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
  `[1:a]${shape},loudnorm=${TARGET}` +
    `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
    `:offset=${measured.target_offset}:linear=true,` +
    `aresample=48000,adelay=${atMs}|${atMs},apad[a]`,
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

/** Runs ffmpeg, returning what it prints to stderr, where it reports. */
function ffmpeg(args: string[]): string {
  const run = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (run.error) throw new Error('ffmpeg is not installed');
  if (run.status !== 0) throw new Error(`ffmpeg failed:\n${run.stderr}`);
  return run.stderr;
}
