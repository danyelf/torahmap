// Writes the code map's data for a repo's pull request:
// npm run codemap -- [--repo <path>] [--base origin/main] [--head HEAD] [<out dir>]

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { CODEMAP_DATA_DIR, STRUCTURE_FILE, TEXTS_FILE } from '../../apps/codemap/src/data.ts';
import { collect } from './collect.ts';

/** A web address for the repo, from an ssh or https remote. */
function webUrl(remote: string): string {
  return remote
    .trim()
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '');
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    repo: { type: 'string', default: '.' },
    base: { type: 'string', default: 'origin/main' },
    head: { type: 'string', default: 'HEAD' },
  },
});
const outDir = positionals[0] ?? join('public/data', CODEMAP_DATA_DIR);
const repoUrl = webUrl(
  execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: values.repo, encoding: 'utf8' }),
);

const { structure, texts } = collect(values.repo, values.base, values.head, repoUrl);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, basename(STRUCTURE_FILE)), JSON.stringify(structure));
writeFileSync(join(outDir, basename(TEXTS_FILE)), JSON.stringify(texts));
console.log(`${structure.files.length} files, ${structure.commits.length} commits → ${outDir}`);
