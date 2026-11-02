// What the code map leaves out: files that are not text written by hand.

const LOCKFILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'uv.lock',
  'poetry.lock',
  'Cargo.lock',
]);

// Downloaded sources, not written by hand.
const DIRECTORIES = ['public/data/', 'data/'];
const DOWNLOADS = /^experiments\/[^/]+\/downloads\//;

const BINARY =
  /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|pdf|mp3|mp4|mov|wav|m4a|webm|woff2?|ttf|otf|eot|zip|gz|tgz|wasm)$/i;

// Written by the AI Act parsers, not by hand.
const GENERATED_FILES = new Set([
  'experiments/eu-ai-act/ai-act.json',
  'experiments/eu-ai-act/refs.json',
]);

const GENERATED = /(\.min\.(js|css)|\.map|\.snap)$/;

export function isExcluded(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return (
    LOCKFILES.has(name) ||
    DIRECTORIES.some((dir) => path.startsWith(dir)) ||
    DOWNLOADS.test(path) ||
    BINARY.test(path) ||
    GENERATED.test(path) ||
    GENERATED_FILES.has(path)
  );
}
